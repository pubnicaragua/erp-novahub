import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, Eye, Pencil, CheckCircle2, TrendingDown, Hash, ChevronLeft, Trash2, Ban, Download, FileDown } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { paymentsService, supplierInvoicesService } from '../../services/compras.service';
import { storageService } from '../../services/storage.service';
import type { PaymentMade, Supplier, SupplierInvoice } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateExpensePDF } from '../../utils/pdfGenerator';
import { PurchaseAuditButton } from './PurchaseAuditButton';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { CurrencySelector } from '../ui/CurrencySelector';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { isBankPaymentMethod, paymentMethodLabel, requiresPaymentReference } from '../../utils/paymentMethods';
import { PrintButton } from '../ui/PrintButton';
import { useBrowserPrint, type PaperSize } from '../../hooks/useBrowserPrint';
import { generateTableHtml, generateDocumentHtml, type DocPrintData } from '../../utils/printUtils';

interface Props {
  data: PaymentMade[];
  loading: boolean;
  onRefresh: () => void;
  supplierInvoices?: SupplierInvoice[];
  supplierCatalog?: Supplier[];
  draftPaymentFromInvoice?: Partial<PaymentMade> | null;
  onDraftConsumed?: () => void;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  targetId?: string | null;
  onClearTargetId?: () => void;
}

const methodOpts = [
  { label: 'Efectivo',        value: 'CASH' },
  { label: 'Tarjeta',         value: 'CARD' },
  { label: 'Transferencia',   value: 'TRANSFER' },
  { label: 'Cheque',          value: 'CHECK' },
];

type PurchasePaymentMethod = 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD';
type PurchasePaymentLine = {
  method: PurchasePaymentMethod;
  amount: number;
  currency: 'NIO' | 'USD';
  exchangeRate: number;
  bankAccountId?: string;
  reference?: string;
};

function groupMadePayments(rows: PaymentMade[], baseCurrency: string, globalRate: number, toBaseAmount: (amount: number, currency?: string, exchangeRate?: number) => number) {
  const groups = new Map<string, PaymentMade[]>();
  rows.forEach((row) => {
    const key = row.supplierInvoiceId ? `invoice:${row.supplierInvoiceId}` : `payment:${row.id}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  });
  return [...groups.values()].map((children) => {
    const ordered = [...children].sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());
    const active = ordered.filter((row) => row.isActive !== false);
    const effective = active.length ? active : ordered;
    const first = effective[0] || ordered[0];
    const currencies = new Set(effective.map((row) => row.currency));
    const baseAmount = Number(effective.reduce((sum, row) => sum + (row.baseAmount !== undefined && row.baseAmount !== null
      ? Number(row.baseAmount)
      : toBaseAmount(Number(row.amount || 0), row.currency, Number(row.exchangeRate || globalRate))), 0).toFixed(2));
    const sameCurrency = currencies.size <= 1;
    const isMixed = effective.length > 1 && (new Set(effective.map((row) => String(row.method || '').toUpperCase())).size > 1 || effective.some((row) => /pago mixto/i.test(String(row.notes || ''))));
    return {
      ...first,
      amount: sameCurrency ? Number(effective.reduce((sum, row) => sum + Number(row.amount || 0), 0).toFixed(2)) : baseAmount,
      currency: sameCurrency ? first.currency : baseCurrency as any,
      exchangeRate: sameCurrency ? Number(first.exchangeRate || 1) : 1,
      baseAmount,
      method: isMixed ? 'MIXED' : first.method,
      payments: ordered,
      paymentLabel: isMixed ? 'Pago mixto' : ordered.length > 1 ? 'Pago parcial' : 'Pago único',
      paymentCount: ordered.length,
      isGroupedPayment: isMixed || ordered.length > 1,
    } as PaymentMade;
  });
}

export function PagosRealizadosView({ data, loading, onRefresh, supplierInvoices = [], supplierCatalog = [], draftPaymentFromInvoice, onDraftConsumed, pagination, onSearchChange, targetId, onClearTargetId }: Props) {
  const { canPerform, user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, valuationMode, valuationModeSuffix, formatConvertedAmount, formatCurrentAmount, convertAmount, convertCurrentAmount, convertBetweenCurrencies, toBaseAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-payments-layout', 'table', 24 * 365);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bills, setBills] = useState<SupplierInvoice[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<PaymentMade> | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [pendingCancelGroup, setPendingCancelGroup] = useState<PaymentMade | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [paymentLines, setPaymentLines] = useState<PurchasePaymentLine[]>([{ method: 'CASH', amount: 0, currency: displayCurrency, exchangeRate: displayCurrency === baseCurrency ? 1 : globalRate }]);
  const [detailPayment, setDetailPayment] = useState<PaymentMade | null>(null);
  const [paymentEvidenceFiles, setPaymentEvidenceFiles] = useState<File[]>([]);
  const groupedPayments = useMemo(() => groupMadePayments(data, baseCurrency, globalRate, toBaseAmount), [data, baseCurrency, globalRate, toBaseAmount]);

  const paymentLineRate = (currency: 'NIO' | 'USD') => currency === baseCurrency ? 1 : Number(globalRate || 1);
  const paymentLine = (method: PurchasePaymentMethod, amount = 0, currency: 'NIO' | 'USD' = displayCurrency): PurchasePaymentLine => ({
    method,
    amount,
    currency,
    exchangeRate: paymentLineRate(currency),
  });

  useEffect(() => {
    if (!targetId || !data.some((payment) => payment.id === targetId)) return;
    setHighlightedTargetId(targetId);
    setEditingId(targetId);
    onClearTargetId?.();
    const timeout = window.setTimeout(() => setHighlightedTargetId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [targetId, data, onClearTargetId]);

  const normalizeMethod = (method?: string): 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' => {
    const normalized = String(method || 'CASH').toUpperCase();
    if (['CASH', 'TRANSFER', 'CHECK', 'CARD'].includes(normalized)) {
      return normalized as 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD';
    }
    return 'CASH';
  };

  useEffect(() => {
    setSuppliers(supplierCatalog);
  }, [supplierCatalog]);

  useEffect(() => {
    if (supplierInvoices.length > 0) {
      setBills(supplierInvoices);
    }
  }, [supplierInvoices]);

  useEffect(() => {
    if (draftPaymentFromInvoice) {
      setEditingId('NEW');
    }
  }, [draftPaymentFromInvoice]);

  useEffect(() => {
    if (editingId) {
      setPaymentEvidenceFiles([]);
      if (editingId === 'NEW') {
         const prefilled = draftPaymentFromInvoice || {};
         const prefilledMethod = normalizeMethod(prefilled.method as any);
         const prefilledCurrency = String(prefilled.currency || displayCurrency).toUpperCase() === 'USD' ? 'USD' : 'NIO';
         const initialCurrency = displayCurrency;
         const initialAmount = Number(convertBetweenCurrencies(
           Number(prefilled.amount || 0),
           prefilledCurrency,
           initialCurrency,
           Number(prefilled.exchangeRate || 1),
           paymentLineRate(initialCurrency),
         ).toFixed(2));
         setLocalDoc({
           supplierId: prefilled.supplierId || '',
           supplierInvoiceId: prefilled.supplierInvoiceId || '',
            date: prefilled.date || new Date().toISOString(),
            amount: Number(prefilled.amount || 0),
            currency: initialCurrency,
            exchangeRate: paymentLineRate(initialCurrency),
            method: prefilledMethod,
            bankAccountId: prefilled.bankAccountId || '',
            reference: requiresPaymentReference(prefilledMethod) ? (prefilled.reference || `PAG-${Date.now().toString().slice(-5)}`) : '',
            notes: prefilled.notes || '',
           });
         setPaymentLines([{
           method: prefilledMethod,
           amount: initialAmount,
           currency: initialCurrency,
           exchangeRate: paymentLineRate(initialCurrency),
           bankAccountId: prefilled.bankAccountId || undefined,
           reference: requiresPaymentReference(prefilledMethod) ? (prefilled.reference || '') : '',
         }]);
         if (draftPaymentFromInvoice && onDraftConsumed) onDraftConsumed();
       } else {
          const found = data.find(x => x.id === editingId);
          setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
          const existingLines = Array.isArray((found as any)?.payments) && (found as any).payments.length > 0
            ? (found as any).payments
            : found ? [found] : [];
          setPaymentLines(existingLines.map((payment: any) => ({
            method: normalizeMethod(payment.method as any),
            amount: Number(payment.amount || 0),
            currency: String(payment.currency || found?.currency || displayCurrency).toUpperCase() === 'USD' ? 'USD' : 'NIO',
            exchangeRate: Number(payment.exchangeRate || globalRate),
            bankAccountId: payment.bankAccountId || undefined,
            reference: requiresPaymentReference(payment.method) ? (payment.reference || '') : '',
          })));
       }
    } else {
      setLocalDoc(null);
      setPaymentLines([paymentLine('CASH')]);
      setPaymentEvidenceFiles([]);
    }
  }, [editingId, data, draftPaymentFromInvoice, onDraftConsumed]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const getMethodLabel = (method?: string) => {
    if (String(method || '').toUpperCase() === 'MIXED') return 'Pago mixto';
    return methodOpts.find((opt) => opt.value === normalizeMethod(method))?.label || method || '-';
  };
  const toExpensePayload = (payment: Partial<PaymentMade>, supplierName?: string) => ({
    number: payment.number || payment.reference || payment.id || `PAG-${Date.now().toString().slice(-5)}`,
    id: payment.id,
    date: payment.date,
    amount: Number(payment.amount || 0),
    currency: payment.currency,
    exchangeRate: payment.exchangeRate,
    category: 'PAGO_PROVEEDOR',
    description: payment.notes || `${payment.paymentLabel || 'Pago único'} a proveedor ${supplierName || '-'}`,
    paidTo: supplierName || '-',
    paymentSource: getMethodLabel(payment.method),
    reference: payment.reference || '-',
    status: 'PAID',
  });

  const filtered = groupedPayments.filter((payment) => {
    if (!normalizedSearchTerm) return true;
    const linkedBill = bills.find((bill) => bill.id === payment.supplierInvoiceId);
    const haystack = [
      payment.reference,
      payment.number,
      payment.supplier?.name,
      payment.supplier?.code,
      payment.notes,
      payment.date ? formatDateEs(payment.date) : '',
      payment.amount,
      Number(payment.amount || 0).toLocaleString(),
      getMethodLabel(payment.method),
      linkedBill?.number,
      linkedBill?.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearchTerm);
  });

  const colFilters = useColumnFilters();
  const filterGetters = {
    supplier: (row: PaymentMade) => row.supplier?.name || '-',
    date: (row: PaymentMade) => (row.date ? new Date(row.date).getTime() : null),
    amount: (row: PaymentMade) => Number(row.amount || 0),
  };
  const filteredData = colFilters.applyTo(filtered, filterGetters);

  const { printContent } = useBrowserPrint();

  const handlePrint = useCallback((paperSize: PaperSize) => {
    const html = generateTableHtml({
      title: 'Pagos Realizados',
      columns: [
        { key: 'reference', label: 'Referencia', align: 'left' },
        { key: 'supplierName', label: 'Proveedor', align: 'left' },
        { key: 'date', label: 'Fecha', align: 'left' },
        { key: 'amount', label: 'Monto', align: 'right', format: (v: number) => `C$ ${v?.toFixed(2) || '0.00'}` },
        { key: 'method', label: 'Método', align: 'center' },
      ],
      rows: filteredData.map((item) => ({
        reference: item.reference || item.number || '',
        supplierName: item.supplier?.name || 'Sin proveedor',
        date: item.date ? new Date(item.date).toLocaleDateString('es-NI') : '',
        amount: Number(item.amount || 0),
        method: item.method || '',
      })),
      filters: {
        'Búsqueda': searchTerm || 'Todas',
      },
    });

    printContent(html, {
      title: 'Reporte de Pagos Realizados',
      paperSize,
      companyName: user?.tenantName || 'Empresa',
    });
  }, [filteredData, searchTerm, printContent, user?.tenantName]);

  const distinctSuppliers = [...new Map(filtered.map((p) => [p.supplier?.name || '-', p.supplier?.name || '-'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filtered.filter((p) => (p.supplier?.name || '-') === label).length }));

  const isSupplierActive = (supplierId?: string) =>
    !!supplierId && (suppliers.find((s) => s.id === supplierId)?.status || '').toUpperCase() === 'ACTIVE';

  const columns: ColumnDef<PaymentMade>[] = [
    { key: 'reference', header: 'Referencia', width: '130px' },
    { key: 'supplierInvoiceId', header: 'Factura #', width: '120px',
      render: (val) => {
        const invoice = bills.find((bill) => bill.id === val);
        return <span className="text-xs font-bold text-primary">{invoice?.number || '-'}</span>;
      } },
    { key: 'supplier',  header: 'Proveedor',
      headerExtra: <ColumnFilterMenu label="Proveedor" options={distinctSuppliers} selected={colFilters.state.supplier?.values || []} onSelect={(values) => colFilters.setValues('supplier', values)} sort={colFilters.state.supplier?.sort || null} onSort={(sort) => colFilters.setSort('supplier', sort)} />,
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',      header: 'Fecha',      width: '110px',
      headerExtra: <ColumnFilterMenu label="Fecha" sort={colFilters.state.date?.sort || null} onSort={(sort) => colFilters.setSort('date', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} />,
      render: (val) => <span className="text-xs text-muted-foreground">{val ? formatDateEs(val) : '-'}</span> },
    { key: 'amount',    header: 'Monto',      width: '130px',
      headerExtra: <ColumnFilterMenu label="Monto" sort={colFilters.state.amount?.sort || null} onSort={(sort) => colFilters.setSort('amount', sort)} />,
      render: (val, row) => (
        <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={row.currency} sourceExchangeRate={row.exchangeRate} className="font-black text-emerald-500" />
      ) },
    { key: 'method',    header: 'Método',     width: '160px',
      render: (val, row) => <div className="flex min-w-0 flex-col items-start gap-1"><Badge variant="outline" className="text-[9px] uppercase bg-blue-500/10 text-blue-500 border-none">{String(val || '').toUpperCase() === 'MIXED' ? 'Pago mixto' : paymentMethodLabel(String(val || '').toUpperCase())}</Badge><span className="text-[9px] font-bold text-muted-foreground">{row.paymentLabel || 'Pago único'}{row.paymentCount && row.paymentCount > 1 ? ` · ${row.paymentCount} movimientos` : ''}</span></div> },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PaymentMade>) => {
    const updateToastId = toast.loading('Guardando cambios en el pago...');
    try {
      const payload = { ...updates } as any;
      if (payload.method) payload.method = normalizeMethod(payload.method);
      delete payload.reference;
      await paymentsService.update(id as string, payload);
      toast.success('Pago actualizado', { id: updateToastId });
      onRefresh();
    }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar', { id: updateToastId }); throw new Error('Update failed'); }
  };

  const uploadPaymentEvidence = async (invoiceId: string, paymentId: string, paymentReference?: string) => {
    for (const file of paymentEvidenceFiles) {
      const isImage = file.type.startsWith('image/');
      const extension = file.name.toLowerCase().split('.').pop() || '';
      const isDocument = ['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(extension) || file.type === 'application/pdf';
      if (!isImage && !isDocument) throw new Error(`El archivo ${file.name} debe ser una imagen o un documento compatible.`);
      const maxSize = isImage ? 2 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) throw new Error(`El archivo ${file.name} supera el límite permitido.`);

      const uploaded = await storageService.uploadFile('purchase-evidence', file, { folder: `pagos/${paymentId}` });
      await supplierInvoicesService.addAttachment(invoiceId, {
        fileName: `Pago-${paymentReference || paymentId}-${file.name}`,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        fileUrl: uploaded.uri,
      });
    }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Seleccione un proveedor');
    const effectiveLines = paymentLines
      .map((line) => ({
        ...line,
        method: normalizeMethod(line.method),
        amount: Number(line.amount || 0),
        reference: String(line.reference || '').trim(),
      }))
      .filter((line) => line.amount > 0);
    if (!effectiveLines.length) return toast.error('El monto debe ser mayor a 0');
    if (effectiveLines.some((line) => requiresPaymentReference(line.method) && !line.reference)) {
      return toast.error('La referencia es obligatoria para transferencia, tarjeta o cheque');
    }
    if (effectiveLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)) {
      return toast.error('Seleccione el banco de cada pago con tarjeta, transferencia o cheque');
    }
    if (!isSupplierActive(localDoc.supplierId)) return toast.error('No se pueden registrar pagos a proveedores inactivos');
    if (paymentEvidenceFiles.length > 0 && !localDoc.supplierInvoiceId) {
      return toast.error('Seleccione una factura de proveedor para asociar las evidencias del pago');
    }
    for (const file of paymentEvidenceFiles) {
      const extension = file.name.toLowerCase().split('.').pop() || '';
      const isImage = file.type.startsWith('image/');
      const isDocument = ['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(extension) || file.type === 'application/pdf';
      const maxSize = isImage ? 2 * 1024 * 1024 : 10 * 1024 * 1024;
      if (!isImage && !isDocument) return toast.error(`El archivo ${file.name} debe ser una imagen o un documento compatible`);
      if (file.size > maxSize) return toast.error(`El archivo ${file.name} supera el límite permitido`);
    }
    
    const saveToastId = toast.loading(editingId === 'NEW' ? 'Registrando pago a proveedor...' : 'Guardando pago a proveedor...');
    try {
      const firstLine = effectiveLines[0];
      const lineCurrency = (value: unknown) => String(value || displayCurrency).toUpperCase() === 'USD' ? 'USD' : 'NIO';
      const currency = lineCurrency(firstLine.currency);
      const exchangeRate = currency === baseCurrency ? 1 : Number(firstLine.exchangeRate || globalRate);
      const amount = Number(effectiveLines.reduce((sum, line) => sum + line.amount, 0).toFixed(2));
      const isMixedPayment = effectiveLines.length > 1;
      const baseAmount = Number(effectiveLines.reduce((sum, line) => sum + toBaseAmount(
        line.amount,
        lineCurrency(line.currency),
        lineCurrency(line.currency) === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
      ), 0).toFixed(2));
      const payload = {
        ...localDoc,
        method: firstLine.method,
        amount,
        currency,
        exchangeRate,
        baseAmount,
        bankAccountId: !isMixedPayment && isBankPaymentMethod(firstLine.method, true) ? firstLine.bankAccountId : undefined,
        reference: !isMixedPayment && requiresPaymentReference(firstLine.method) ? firstLine.reference : undefined,
      } as any;
      let savedPayment: PaymentMade;
      if (editingId === 'NEW') {
        savedPayment = isMixedPayment
          ? await paymentsService.createMixed({
            ...payload,
            payments: effectiveLines.map((line) => ({
              method: line.method,
              amount: line.amount,
              currency: lineCurrency(line.currency),
              exchangeRate: lineCurrency(line.currency) === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
              baseAmount: Number(toBaseAmount(line.amount, lineCurrency(line.currency), lineCurrency(line.currency) === baseCurrency ? 1 : Number(line.exchangeRate || globalRate)).toFixed(2)),
              bankAccountId: line.bankAccountId,
              reference: requiresPaymentReference(line.method) ? line.reference : undefined,
              notes: payload.notes,
            })),
          })
          : await paymentsService.create(payload);
      } else {
        if ((localDoc as any).payments?.length > 1) {
          throw new Error('Los pagos mixtos se consultan desde su desglose; anule el paquete y registre uno nuevo para modificarlo.');
        }
        savedPayment = await paymentsService.update(editingId!, payload);
      }

      let evidenceError = '';
      if (paymentEvidenceFiles.length > 0 && payload.supplierInvoiceId) {
        try {
          await uploadPaymentEvidence(String(payload.supplierInvoiceId), String(savedPayment.id), String(payload.reference || savedPayment.number || savedPayment.id));
        } catch (e: any) {
          evidenceError = e?.response?.data?.message || e?.message || 'No se pudieron adjuntar las evidencias.';
        }
      }
      toast.success(editingId === 'NEW' ? 'Pago registrado exitosamente' : 'Pago guardado', { id: saveToastId });
      if (evidenceError) toast.error(`El pago quedó registrado, pero ${evidenceError.toLowerCase()}`);
      setPaymentEvidenceFiles([]);
      setEditingId(null);
      onRefresh();
    } catch (e: any) { 
        toast.error(e?.response?.data?.message || e?.message || 'Error al registrar', { id: saveToastId });
    }
  };

  const currentBills = bills.filter((b) => {
    if (!localDoc?.supplierId) return false;
    const sameSupplier = String(b.supplierId || '') === String(localDoc.supplierId || '');
    const isOpen = ['PENDING', 'PARTIAL'].includes(String(b.status || '').toUpperCase());
    return sameSupplier && isOpen;
  });

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300" data-tour="purchases-form-title">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Registrar Pago' : `Pago ${localDoc.reference}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Desembolsos y Abonos</p>
            </div>
          </div>
          <div className="flex items-center gap-3" data-tour="purchases-form-actions">
            <PurchaseViewTutorial view="payments" context="form" />
             {!isNew && (
                <Button
                  variant="outline"
                  className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => generateExpensePDF({
                    expense: toExpensePayload(localDoc, suppliers.find((s) => s.id === localDoc.supplierId)?.name),
                    tenantName: user?.tenantName || 'Nova Hub',
                    targetKey: 'compras.payment-made',
                    formatAmount: (amount: number, currency?: string, rate?: number) =>
                      formatConvertedAmount(Number(amount || 0), currency || (localDoc.currency as any), rate || localDoc.exchangeRate),
                  })}
                >
                  <Download className="size-3 mr-2" /> Descargar PDF
                </Button>
              )}
             {!isNew && canPerform('PURCHASES_PAYMENTS', 'delete') && (
                 <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-700 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => { setPendingCancelId(editingId); setCancelReason(''); }}>
                  <Ban className="mr-2 size-3.5" /> Anular
                </Button>
             )}
            {((isNew && canPerform('PURCHASES_PAYMENTS', 'create') && canPerform('PURCHASES_PAYMENTS', 'approve')) || (!isNew && canPerform('PURCHASES_PAYMENTS', 'edit'))) && (
              <Button onClick={handleSaveDoc} disabled={paymentLines.some((line) => requiresPaymentReference(line.method) && !line.reference?.trim()) || paymentLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar Pago
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2 md:col-span-1" data-tour="purchases-form-data">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información del Pago</p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                    <Combobox
                      disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                      options={suppliers
                        .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                        .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                      value={localDoc.supplierId || ''}
                      onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val, supplierInvoiceId: '' })}
                      placeholder="Seleccionar proveedor..."
                    />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Factura a Pagar / Abono (Opcional)</p>
                    <Combobox
                      disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                      options={currentBills.map(s => ({ label: `${s.number} (Saldo: ${s.balance ?? s.total})`, value: s.id }))}
                      value={localDoc.supplierInvoiceId || ''}
                      onChange={(val) => {
                          const b = currentBills.find(x => x.id === val);
                          const nextCurrency = displayCurrency;
                          const nextAmount = Number(b ? (b.balance ?? b.total) : (localDoc.amount || 0));
                          const nextAmountInPaymentCurrency = b
                            ? Number(convertBetweenCurrencies(nextAmount, b.currency || baseCurrency, nextCurrency, Number(b.exchangeRate || 1), paymentLineRate(nextCurrency)).toFixed(2))
                            : Number(convertBetweenCurrencies(nextAmount, localDoc.currency || displayCurrency, nextCurrency, Number(localDoc.exchangeRate || globalRate), paymentLineRate(nextCurrency)).toFixed(2));
                          setLocalDoc({
                            ...localDoc,
                            supplierInvoiceId: val,
                            amount: nextAmountInPaymentCurrency,
                            currency: nextCurrency,
                            exchangeRate: paymentLineRate(nextCurrency),
                          });
                          setPaymentLines((current) => current.map((line, index) => index === 0 ? {
                            ...line,
                            amount: b ? Number(convertBetweenCurrencies(nextAmount, b.currency || baseCurrency, line.currency, Number(b.exchangeRate || 1), Number(line.exchangeRate || paymentLineRate(line.currency))).toFixed(2)) : nextAmountInPaymentCurrency,
                          } : line));
                      }}
                      placeholder={localDoc.supplierId ? "Seleccionar factura abierta" : "Primero seleccione un proveedor"}
                      emptyMessage="No hay facturas abiertas para este proveedor."
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Fecha de Pago</p>
                    <Input 
                      disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                      type="date" 
                      value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                      onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                      className="h-8 text-xs" 
                    />
                  </div>
                  <div className="col-span-2 rounded-2xl border border-border/60 bg-muted/10 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Formas de pago</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">Un pago mixto se registra como un solo paquete con su desglose interno.</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 border-primary/20 bg-primary/5 text-primary">Mixto permitido</Badge>
                    </div>
                    <div className="mt-3 space-y-3">
                      {paymentLines.map((line, index) => (
                        <div key={`${index}-${line.method}`} className="rounded-xl border border-border/60 bg-background/70 p-3">
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,10rem)_minmax(7rem,10rem)_auto] sm:items-end">
                            <div>
                              <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Método</p>
                              <select
                                disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                                value={normalizeMethod(line.method)}
                                onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, method: event.target.value as PurchasePaymentMethod, bankAccountId: undefined, reference: '' } : item))}
                                className="h-10 w-full max-w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                              >
                                {methodOpts.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                              </select>
                            </div>
                            <CurrencySelector
                              value={line.currency}
                              baseCurrency={baseCurrency}
                              exchangeRate={globalRate}
                              label="Moneda"
                              disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                              onChange={(newCurrency) => setPaymentLines((current) => current.map((item, itemIndex) => {
                                if (itemIndex !== index) return item;
                                const previousRate = item.currency === baseCurrency ? 1 : Number(item.exchangeRate || globalRate);
                                const nextRate = paymentLineRate(newCurrency);
                                return {
                                  ...item,
                                  amount: Number(convertBetweenCurrencies(item.amount, item.currency, newCurrency, previousRate, nextRate).toFixed(2)),
                                  currency: newCurrency,
                                  exchangeRate: nextRate,
                                };
                              }))}
                            />
                            <div>
                              <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Monto ({line.currency})</p>
                              <Input
                                disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.amount || ''}
                                onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) || 0 } : item))}
                              />
                            </div>
                            <Button type="button" variant="ghost" size="icon" disabled={paymentLines.length === 1} onClick={() => setPaymentLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Eliminar forma de pago" className="size-10 shrink-0 text-muted-foreground hover:text-rose-500"><Trash2 className="size-4" /></Button>
                          </div>
                          {isBankPaymentMethod(line.method, true) && <BankAccountSelect className="mt-2" value={line.bankAccountId} onChange={(bankAccountId) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccountId } : item))} label="Banco del pago" />}
                          {requiresPaymentReference(line.method) && <div className="mt-2">
                            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Referencia *</p>
                            <Input value={line.reference || ''} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} placeholder="Transferencia, voucher, cheque..." />
                          </div>}
                        </div>
                      ))}
                      <Button type="button" variant="outline" className="w-full border-dashed text-[10px] font-black uppercase tracking-widest" onClick={() => setPaymentLines((current) => [...current, paymentLine('CARD')])}>
                        <Plus className="mr-2 size-4" /> Agregar pago mixto
                      </Button>
                    </div>
                  </div>
                  <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
                    <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Evidencias del pago</p>
                        <p className="text-[10px] text-muted-foreground">Comprobante en imagen o documento (PDF, DOCX, XLSX). Se asociará a la factura seleccionada.</p>
                      </div>
                      {!localDoc.supplierInvoiceId && <Badge variant="outline" className="w-fit border-amber-500/30 bg-amber-500/10 text-amber-600">Seleccione una factura</Badge>}
                    </div>
                    <Input
                      type="file"
                      multiple
                      accept="application/pdf,image/*,.pdf,.doc,.docx,.xls,.xlsx"
                      disabled={(isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')) || !localDoc.supplierInvoiceId}
                      onChange={(event) => setPaymentEvidenceFiles(Array.from(event.target.files || []))}
                      className="h-10 bg-background text-xs"
                    />
                    {paymentEvidenceFiles.length > 0 && <p className="mt-1 truncate text-[10px] text-muted-foreground">Archivos seleccionados: {paymentEvidenceFiles.map((file) => file.name).join(', ')}</p>}
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Notas ADicionales</p>
                    <Input 
                      disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                      value={localDoc.notes || ''} 
                      onChange={(e) => setLocalDoc({ ...localDoc, notes: e.target.value })} 
                      className="h-8 text-xs" 
                      placeholder="Concepto interno..." 
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50" data-tour="purchases-form-summary">
            <CardContent className="p-6 flex flex-col justify-center h-full space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen del pago</p>
                <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/5 text-emerald-600">{paymentLines.length > 1 ? 'Pago mixto' : 'Pago único'}</Badge>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                  <span className="font-black uppercase text-xs tracking-widest">Total entregado</span>
                  <span className="font-black text-xl text-emerald-500 tabular-nums">
                    {baseCurrency === 'USD' ? '$' : 'C$'} {paymentLines.reduce((sum, line) => sum + toBaseAmount(
                      Number(line.amount || 0),
                      line.currency,
                      line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
                    ), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Equivalente base</span>
                  <span className="font-bold tabular-nums">
                    {baseCurrency === 'USD' ? '$' : 'C$'} {paymentLines.reduce((sum, line) => sum + toBaseAmount(
                      Number(line.amount || 0),
                      line.currency,
                      line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
                    ), 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3 text-[10px] text-muted-foreground">
                  Cada método conserva su banco y referencia dentro del mismo pago. Efectivo no solicita referencia; tarjeta, transferencia y cheque sí.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const toDisplayAmount = (amount: number, currency?: string, rate?: number) => valuationMode === 'CURRENT'
    ? convertCurrentAmount(amount, currency)
    : convertAmount(amount, currency, rate || globalRate);
  const paidTotalInDisplayCurrency = groupedPayments.reduce(
    (acc, payment) => acc + toDisplayAmount(Number(payment.amount ?? payment.baseAmount ?? 0), payment.currency, payment.exchangeRate),
    0,
  );

  const kpis = [
    { title: 'Transacciones',   value: groupedPayments.length,                   icon: Hash,         color: 'text-blue-500',   bg: 'bg-blue-500/10'    },
    {
      title: `Pagos Realizados (${displayCurrency}${valuationModeSuffix})`,
      value: formatCurrentAmount(paidTotalInDisplayCurrency, displayCurrency),
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
    { title: 'Conciliados',     value: groupedPayments.length,                   icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="purchases-list-kpis">
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind="indicator" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Pagos Realizados</h2></div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="payments" />
            <PrintButton onPrint={handlePrint} label="Imprimir" showDropdown includeRoll />
            <ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de pagos a proveedores" />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
             {canPerform('PURCHASES_PAYMENTS', 'create') && canPerform('PURCHASES_PAYMENTS', 'approve') && (
               <Button onClick={() => setEditingId('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Registrar Pago</Button>
             )}
          </div>
        </div>
        <EditableDataTable data={filteredData} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination} layoutMode={layoutMode === 'cards' ? 'cards' : 'responsive'} highlightedRowId={highlightedTargetId} bulkAction="cancel"
          onBulkDelete={canPerform('PURCHASES_PAYMENTS', 'delete') ? async (ids) => {
            const cancelToastId = toast.loading(`Anulando ${ids.length} pago${ids.length === 1 ? '' : 's'}...`);
            try {
              const paymentIds = new Set<string>();
              ids.forEach((id) => {
                const grouped = filteredData.find((payment) => payment.id === String(id));
                const details = grouped?.payments?.length ? grouped.payments : [{ id: String(id) } as PaymentMade];
                details.forEach((payment) => {
                  if (payment.id && !String(payment.id).startsWith('new-')) paymentIds.add(String(payment.id));
                });
              });
              for (const paymentId of paymentIds) {
                await paymentsService.cancel(paymentId, 'Anulación masiva');
              }
              toast.success(`${paymentIds.size} pago${paymentIds.size === 1 ? '' : 's'} anulado${paymentIds.size === 1 ? '' : 's'}`, { id: cancelToastId });
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al anular', { id: cancelToastId });
            }
          } : undefined}
           actions={(row) => (
              <div className="flex gap-1">
               <Button
                 title="Descargar PDF"
                 variant="ghost"
                 size="icon"
                 className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                 onClick={() => void (async () => {
                   const pdfToastId = toast.loading('Generando comprobante de pago...');
                   try {
                     await generateExpensePDF({
                       expense: toExpensePayload(row, row.supplier?.name),
                       tenantName: user?.tenantName || 'Nova Hub',
                       targetKey: 'compras.payment-made',
                       formatAmount: (amount: number, currency?: string, rate?: number) =>
                         formatConvertedAmount(Number(amount || 0), currency || row.currency, rate || row.exchangeRate),
                     });
                     toast.success('Comprobante generado', { id: pdfToastId });
                   } catch (error: any) {
                     toast.error(error?.message || 'No se pudo generar el comprobante', { id: pdfToastId });
                   }
                 })()}
               >
                 <FileDown className="size-4" />
               </Button>
                <Button title={row.isGroupedPayment ? 'Ver desglose del pago' : (canPerform('PURCHASES_PAYMENTS', 'edit') ? 'Editar' : 'Ver')} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => row.isGroupedPayment ? setDetailPayment(row) : setEditingId(row.id)}>{row.isGroupedPayment || !canPerform('PURCHASES_PAYMENTS', 'edit') ? <Eye className="size-4" /> : <Pencil className="size-4" />}</Button>
               <PurchaseAuditButton entity="PAYMENT_MADE" entityId={row.id} title="Auditoria del Pago" />
               {canPerform('PURCHASES_PAYMENTS', 'delete') && (
                <Button title="Anular pago" aria-label="Anular pago" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => { setPendingCancelId(row.id); setPendingCancelGroup(row); setCancelReason(''); }}><Ban className="size-4" /></Button>
              )}
            </div>
          )}
        />
      </div>
      <Dialog open={detailPayment !== null} onOpenChange={(open) => { if (!open) setDetailPayment(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <Eye className="size-5 text-primary" /> Detalle del pago
            </DialogTitle>
            <DialogDescription>
              El pago mixto se muestra como un solo registro y conserva aquí el detalle de cada forma de pago.
            </DialogDescription>
          </DialogHeader>
          {detailPayment && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{detailPayment.number || detailPayment.reference || detailPayment.id}</p>
                <p className="mt-1 text-2xl font-black text-primary">{detailPayment.paymentLabel || 'Pago único'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detailPayment.supplier?.name || 'Proveedor'} · {detailPayment.supplierInvoiceId ? (bills.find((bill) => bill.id === detailPayment.supplierInvoiceId)?.number || 'Factura asociada') : 'Sin factura asociada'}</p>
              </div>
              <div className="space-y-2">
                {(detailPayment.payments?.length ? detailPayment.payments : [detailPayment]).map((payment, index) => (
                  <div key={payment.id || index} className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{getMethodLabel(payment.method)}</p>
                        <p className="mt-1 text-sm font-black">{payment.currency === 'USD' ? '$' : 'C$'} {Number(payment.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase">{payment.currency || baseCurrency}</Badge>
                    </div>
                    {payment.bankAccountId && <p className="mt-2 text-[10px] text-muted-foreground">Banco: {payment.bankAccountId}</p>}
                    {payment.reference && <p className="mt-1 text-[10px] font-mono text-muted-foreground">Referencia: {payment.reference}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailPayment(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setPendingCancelGroup(null); setCancelReason(''); } }}
        title="¿Anular pago?"
        description="El pago quedará anulado y se revertirá el saldo del proveedor y la factura asociada. Esta acción no se puede deshacer."
        confirmLabel="Anular Pago"
        variant="destructive"
        loading={cancelLoading}
        disabled={!cancelReason.trim()}
        onConfirm={async () => {
          if (!pendingCancelId || !cancelReason.trim()) return;
          const cancelToastId = toast.loading('Anulando pago a proveedor...');
          try {
            setCancelLoading(true);
            const details = pendingCancelGroup?.payments?.length ? pendingCancelGroup.payments : [{ id: pendingCancelId } as PaymentMade];
            const paymentIds = [...new Set(details.map((payment) => String(payment.id)).filter((id) => id && !id.startsWith('new-')))]
            for (const paymentId of paymentIds) {
              await paymentsService.cancel(paymentId, cancelReason.trim());
            }
            toast.success(paymentIds.length > 1 ? 'Paquete de pagos anulado' : 'Pago anulado', { id: cancelToastId });
            setEditingId(null);
            onRefresh();
          } catch (e: any) {
            toast.error(e?.response?.data?.message || e?.message || 'Error al anular', { id: cancelToastId });
          } finally {
            setCancelLoading(false);
            setPendingCancelId(null);
            setPendingCancelGroup(null);
            setCancelReason('');
          }
        }}
      >
        <div className="mt-4">
          <label className="text-sm font-medium text-foreground mb-1 block">Motivo de anulación *</label>
          <textarea
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={3}
            placeholder="Ej: Pago duplicado, error en monto..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
