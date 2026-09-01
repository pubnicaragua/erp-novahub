import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Eye, Pencil, CheckCircle2, TrendingDown, Hash, ChevronLeft, Trash2, Ban } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
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
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { CurrencySelector } from '../ui/CurrencySelector';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { hasPaymentReferenceField, isBankPaymentMethod, paymentMethodLabel, requiresPaymentReference } from '../../utils/paymentMethods';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { generatePurchaseListPDF, generatePurchaseRecordPDF } from '../../utils/purchaseExports';
import { formatPdfItemDescription } from '../../utils/pdf-line-details';
import { SalesDocumentDetailSheet } from '../ventas/SalesDocumentDetailSheet';
import { summarizeAmountsByCurrency } from '../../utils/currency';
import { cn } from '../ui/utils';

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

function paymentReferenceLabel(payment: PaymentMade): string {
  const reference = String(payment.reference || '').trim();
  if (reference) return reference;
  const method = String(payment.method || '').toUpperCase();
  if (method === 'CASH') return `No aplica · ${payment.number || payment.id}`;
  return payment.number || payment.id || 'Sin referencia';
}

function paymentVariantDetails(payment: PaymentMade): string {
  const invoice = payment.supplierInvoice as any;
  const receiptItems = Array.isArray(invoice?.purchaseReceipt?.items) ? invoice.purchaseReceipt.items : [];
  const invoiceItems = Array.isArray(invoice?.items) ? invoice.items : [];
  const items = receiptItems.length ? receiptItems : invoiceItems;
  const lines = items
    .filter((item: any) => Boolean(
      item?.variantId || item?.variantSku || item?.variantName || item?.variantAttributes
      || item?.variant?.id || item?.variant?.sku || item?.variant?.name || item?.variant?.attributes,
    ))
    .map((item: any) => formatPdfItemDescription(item, item?.description || 'Producto', false))
    .filter(Boolean);
  return lines.length ? `Detalle de variantes de la factura aplicada:\n${lines.join('\n')}` : '';
}

function groupedPaymentReferenceLabel(payments: PaymentMade[]): string {
  if (payments.length <= 1) return paymentReferenceLabel(payments[0] || {} as PaymentMade);
  return payments.map((payment) => `${paymentMethodLabel(String(payment.method || '').toUpperCase())}: ${paymentReferenceLabel(payment)}`).join(' · ');
}

function groupMadePayments(rows: PaymentMade[], baseCurrency: string, globalRate: number, toBaseAmount: (amount: number, currency?: string, exchangeRate?: number) => number) {
  const groups = new Map<string, PaymentMade[]>();
  rows.forEach((row) => {
    const key = row.supplierInvoiceId ? `invoice:${row.supplierInvoiceId}` : `payment:${row.id}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  });
  return [...groups.values()].map((children) => {
    const ordered = [...children].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
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
      displayReference: groupedPaymentReferenceLabel(effective),
    } as PaymentMade;
  });
}

export function PagosRealizadosView({ data, loading, onRefresh, supplierInvoices = [], supplierCatalog = [], draftPaymentFromInvoice, onDraftConsumed, pagination, onSearchChange, targetId, onClearTargetId }: Props) {
  const { canPerform, user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, displayMode, valuationMode, valuationModeSuffix, formatConvertedAmount, formatCurrentAmount, formatExplicitAmount, convertAmount, convertCurrentAmount, convertBetweenCurrencies, toBaseAmount } = useCurrency();
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
  const [partialPaymentEnabled, setPartialPaymentEnabled] = useState(false);
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
         setPartialPaymentEnabled(false);
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
            reference: hasPaymentReferenceField(prefilledMethod) ? (prefilled.reference || (requiresPaymentReference(prefilledMethod) ? `PAG-${Date.now().toString().slice(-5)}` : '')) : '',
            notes: prefilled.notes || '',
           });
         setPaymentLines([{
           method: prefilledMethod,
           amount: initialAmount,
           currency: initialCurrency,
           exchangeRate: paymentLineRate(initialCurrency),
           bankAccountId: prefilled.bankAccountId || undefined,
           reference: hasPaymentReferenceField(prefilledMethod) ? (prefilled.reference || '') : '',
         }]);
         if (draftPaymentFromInvoice && onDraftConsumed) onDraftConsumed();
       } else {
          setPartialPaymentEnabled(false);
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
            reference: hasPaymentReferenceField(payment.method) ? (payment.reference || '') : '',
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
  const filtered = groupedPayments.filter((payment) => {
    if (!normalizedSearchTerm) return true;
    const linkedBill = bills.find((bill) => bill.id === payment.supplierInvoiceId);
    const haystack = [
      payment.reference,
      payment.number,
      payment.supplier?.name,
      payment.supplier?.code,
      payment.notes,
      payment.displayReference,
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

  const linkedInvoiceForPayment = (payment: PaymentMade) =>
    payment.supplierInvoice || bills.find((bill) => bill.id === payment.supplierInvoiceId) || null;
  const selectedInvoice = localDoc?.supplierInvoiceId
    ? bills.find((bill) => bill.id === localDoc.supplierInvoiceId) || (localDoc as any).supplierInvoice || null
    : null;
  const getPaymentLineBase = (line: PurchasePaymentLine) => toBaseAmount(
    Number(line.amount || 0),
    line.currency,
    line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
  );
  const paymentTotalBase = paymentLines.reduce((sum, line) => sum + getPaymentLineBase(line), 0);
  const originalEditingPaymentBase = editingId && editingId !== 'NEW' && localDoc
    ? Number(localDoc.baseAmount ?? toBaseAmount(Number(localDoc.amount || 0), localDoc.currency, Number(localDoc.exchangeRate || globalRate)))
    : 0;
  const selectedInvoiceBalanceBase = selectedInvoice
    ? Math.max(0, toBaseAmount(
      Number((selectedInvoice as any).balance ?? (selectedInvoice as any).total ?? 0),
      (selectedInvoice as any).currency,
      Number((selectedInvoice as any).exchangeRate || globalRate),
    ) + originalEditingPaymentBase)
    : 0;
  const paymentRemainingBase = selectedInvoice
    ? Math.max(0, selectedInvoiceBalanceBase - paymentTotalBase)
    : 0;
  const paymentOverInvoiceBalance = Boolean(selectedInvoice && paymentTotalBase > selectedInvoiceBalanceBase + 0.01);
  const expectedPaymentAmount = (payment: PaymentMade) => {
    const invoice = linkedInvoiceForPayment(payment) as any;
    return Number(invoice?.total || payment.amount || 0);
  };
  const paidPaymentAmount = (payment: PaymentMade) => {
    const invoice = linkedInvoiceForPayment(payment) as any;
    return invoice?.amountPaid !== undefined && invoice?.amountPaid !== null
      ? Number(invoice.amountPaid)
      : Number(payment.amount || 0);
  };
  const paymentExpectedCurrency = (payment: PaymentMade) => {
    const invoice = linkedInvoiceForPayment(payment) as any;
    return invoice?.currency || payment.currency;
  };
  const paymentExpectedRate = (payment: PaymentMade) => {
    const invoice = linkedInvoiceForPayment(payment) as any;
    return invoice?.exchangeRate || payment.exchangeRate;
  };

  const handleExportListPdf = async (format: PdfDownloadFormat) => {
    const exportToastId = toast.loading('Generando reporte de pagos...');
    try {
      await generatePurchaseListPDF({
        title: 'Pagos realizados',
        rows: filteredData,
        tenantName: user?.tenantName || 'Empresa',
        tenantLogo: user?.sessionBranding?.logo || null,
        format,
        targetKey: 'compras.payment-made',
        columns: [
          { label: 'Referencia', value: (row) => row.displayReference || paymentReferenceLabel(row) },
          { label: 'Proveedor', value: (row) => row.supplier?.name || 'Sin proveedor' },
          { label: 'Fecha', value: (row) => row.date ? formatDateEs(row.date) : '—' },
          { label: 'Comprometido', align: 'right', value: (row) => formatConvertedAmount(expectedPaymentAmount(row), paymentExpectedCurrency(row), paymentExpectedRate(row)) },
          { label: 'Pagado', align: 'right', value: (row) => formatConvertedAmount(paidPaymentAmount(row), linkedInvoiceForPayment(row)?.currency || row.currency, linkedInvoiceForPayment(row)?.exchangeRate || row.exchangeRate) },
          { label: 'Método', align: 'center', value: (row) => getMethodLabel(row.method) },
        ],
      });
      toast.success('Reporte PDF descargado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el reporte', { id: exportToastId });
    }
  };

  const distinctSuppliers = [...new Map(filtered.map((p) => [p.supplier?.name || '-', p.supplier?.name || '-'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filtered.filter((p) => (p.supplier?.name || '-') === label).length }));

  const isSupplierActive = (supplierId?: string) =>
    !!supplierId && (suppliers.find((s) => s.id === supplierId)?.status || '').toUpperCase() === 'ACTIVE';

  const columns: ColumnDef<PaymentMade>[] = [
    { key: 'reference', header: 'N° Pago / Referencia', width: '175px',
      render: (_value, row) => <span className="text-xs font-mono text-muted-foreground">{row.displayReference || paymentReferenceLabel(row)}</span> },
    { key: 'supplierInvoiceId', header: 'N° Factura', width: '120px',
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
    { key: 'expectedPayment', header: 'Importe comprometido', width: '155px',
      render: (_val, row) => (
        <CurrencyValuationAmount amount={expectedPaymentAmount(row)} sourceCurrency={paymentExpectedCurrency(row)} sourceExchangeRate={paymentExpectedRate(row)} className="font-black text-amber-600 dark:text-amber-400" />
      ) },
    { key: 'paidAmount', header: 'Pagado', width: '130px',
      headerExtra: <ColumnFilterMenu label="Pagado" sort={colFilters.state.amount?.sort || null} onSort={(sort) => colFilters.setSort('amount', sort)} />,
      render: (_val, row) => (
        <CurrencyValuationAmount amount={paidPaymentAmount(row)} sourceCurrency={linkedInvoiceForPayment(row)?.currency || row.currency} sourceExchangeRate={linkedInvoiceForPayment(row)?.exchangeRate || row.exchangeRate} className="font-black text-emerald-500" />
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
      const maxSize = 10 * 1024 * 1024;
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
      return toast.error('La referencia es obligatoria para tarjeta, transferencia o cheque');
    }
    if (effectiveLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)) {
      return toast.error('Seleccione el banco de cada pago con tarjeta, transferencia o cheque');
    }
    const effectivePaymentBase = effectiveLines.reduce((sum, line) => sum + toBaseAmount(
      line.amount,
      line.currency,
      line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
    ), 0);
    const invoiceBalanceBase = selectedInvoice
      ? Math.max(0, toBaseAmount(
        Number((selectedInvoice as any).balance ?? (selectedInvoice as any).total ?? 0),
        (selectedInvoice as any).currency,
        Number((selectedInvoice as any).exchangeRate || globalRate),
      ) + originalEditingPaymentBase)
      : 0;
    if (selectedInvoice && effectivePaymentBase > invoiceBalanceBase + 0.01) {
      return toast.error('El pago no puede superar el saldo pendiente de la factura del proveedor');
    }
    if (selectedInvoice && effectivePaymentBase < invoiceBalanceBase - 0.01 && !partialPaymentEnabled) {
      return toast.error('Active "Pago parcial" para registrar solo una parte de la factura');
    }
    if (!isSupplierActive(localDoc.supplierId)) return toast.error('No se pueden registrar pagos a proveedores inactivos');
    if (paymentEvidenceFiles.length > 0 && !localDoc.supplierInvoiceId) {
      return toast.error('Seleccione una factura de proveedor para asociar las evidencias del pago');
    }
    for (const file of paymentEvidenceFiles) {
      const extension = file.name.toLowerCase().split('.').pop() || '';
      const isImage = file.type.startsWith('image/');
      const isDocument = ['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(extension) || file.type === 'application/pdf';
      const maxSize = 10 * 1024 * 1024;
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
              reference: hasPaymentReferenceField(line.method) ? line.reference : undefined,
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

  const handleDownloadPaymentPdf = async (payment: PaymentMade, format: PdfDownloadFormat = 'configured') => {
    const exportToastId = toast.loading('Generando comprobante de pago...');
    try {
      const paymentRows = payment.payments?.length ? payment.payments : [payment];
      await generatePurchaseRecordPDF({
        tenantName: user?.tenantName || 'Empresa',
        tenantLogo: user?.sessionBranding?.logo || null,
        format,
        targetKey: 'compras.payment-made',
        document: {
          title: 'Pago a proveedor',
          number: String(payment.number || payment.reference || payment.id),
          date: payment.date ? formatDateEs(payment.date) : undefined,
          status: payment.isActive === false ? 'Anulado' : 'Pagado',
          supplier: payment.supplier?.name || 'Sin proveedor',
          fields: [
            { label: 'Factura', value: linkedInvoiceForPayment(payment)?.number || 'Sin factura asociada' },
            { label: 'Tipo', value: payment.paymentLabel || 'Pago único' },
            { label: 'Referencia', value: payment.displayReference || paymentReferenceLabel(payment) },
          ],
          lines: paymentRows.map((row) => ({ description: getMethodLabel(row.method), quantity: 1, unitPrice: formatCurrentAmount(Number(row.amount || 0), row.currency || displayCurrency), total: formatCurrentAmount(Number(row.amount || 0), row.currency || displayCurrency), secondary: `Referencia: ${paymentReferenceLabel(row)}${row.bankAccountId ? ` · Banco: ${row.bankAccountId}` : ''}` })),
          total: formatCurrentAmount(Number(payment.amount || 0), payment.currency || displayCurrency),
          totalLabel: 'Total pagado',
          notes: [payment.notes, paymentVariantDetails(payment)].filter(Boolean).join('\n'),
        },
      });
      toast.success('Comprobante generado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el comprobante', { id: exportToastId });
    }
  };

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
             {!isNew && <PdfDownloadButton label="Exportar" onDownload={(format) => void handleDownloadPaymentPdf(localDoc as PaymentMade, format)} />}
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
                          setPartialPaymentEnabled(false);
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
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Formas de pago</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">Un pago mixto se registra como un solo paquete con su desglose interno.</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                        {selectedInvoice && <label
                          className={cn(
                            'flex items-center gap-2 text-[10px] font-black uppercase tracking-widest',
                            paymentOverInvoiceBalance ? 'cursor-not-allowed text-muted-foreground/50' : 'cursor-pointer text-muted-foreground',
                          )}
                          title={paymentOverInvoiceBalance ? 'El monto no puede superar el saldo de la factura' : undefined}
                        >
                          <Switch checked={partialPaymentEnabled} onCheckedChange={setPartialPaymentEnabled} disabled={paymentOverInvoiceBalance} aria-label="Activar pago parcial" />
                          Pago parcial
                        </label>}
                        <Badge variant="outline" className="shrink-0 border-primary/20 bg-primary/5 text-primary">Mixto permitido</Badge>
                      </div>
                    </div>
                    <div className="mt-3 space-y-3">
                      {paymentLines.map((line, index) => (
                        <div key={`${index}-${line.method}`} className="rounded-xl border border-border/60 bg-background/70 p-3">
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,10rem)_minmax(7rem,10rem)_auto] sm:items-end">
                            <div>
                              <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Método</p>
                              <Select
                                disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                                value={normalizeMethod(line.method)}
                                onValueChange={(method) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, method: method as PurchasePaymentMethod, bankAccountId: undefined, reference: '' } : item))}
                              >
                                <SelectTrigger className="h-10 w-full max-w-full text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                                <SelectContent>{methodOpts.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent>
                              </Select>
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
                          {hasPaymentReferenceField(line.method) && <div className="mt-2">
                            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Referencia *</p>
                            <Input value={line.reference || ''} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} placeholder="Transferencia, voucher, cheque..." required={requiresPaymentReference(line.method)} />
                          </div>}
                        </div>
                      ))}
                      <Button type="button" variant="outline" className="w-full border-dashed text-[10px] font-black uppercase tracking-widest" onClick={() => setPaymentLines((current) => [...current, paymentLine('CARD')])}>
                        <Plus className="mr-2 size-4" /> Agregar pago mixto
                      </Button>
                    </div>
                  </div>
                  {selectedInvoice && <div className="col-span-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Liquidación de la factura</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">Puede pagarla completa o registrar un abono para continuar después.</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                      <div><span className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground">Saldo anterior</span><span className="font-bold">{formatConvertedAmount(selectedInvoiceBalanceBase, baseCurrency)}</span></div>
                      <div><span className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground">Este pago</span><span className="font-bold text-emerald-600 dark:text-emerald-400">{formatConvertedAmount(paymentTotalBase, baseCurrency)}</span></div>
                       <div><span className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground">Pendiente</span><span className={cn('font-bold', paymentRemainingBase > 0.01 ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400')}>{formatConvertedAmount(paymentRemainingBase, baseCurrency)}</span></div>
                    </div>
                    {paymentOverInvoiceBalance && <p className="mt-2 text-[10px] font-bold text-rose-600">El monto excede el saldo de la factura.</p>}
                  </div>}
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
                    {formatConvertedAmount(paymentTotalBase, baseCurrency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Equivalente base</span>
                  <span className="font-bold tabular-nums">
                    {formatConvertedAmount(paymentTotalBase, baseCurrency)}
                  </span>
                </div>
                <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3 text-[10px] text-muted-foreground">
                  Cada método conserva su banco y referencia dentro del mismo pago. Efectivo no solicita referencia; tarjeta, transferencia y cheque la requieren.
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
  const originalPaidAmounts = summarizeAmountsByCurrency(
    data.filter((payment) => payment.isActive !== false),
    (payment) => Number(payment.amount ?? payment.baseAmount ?? 0),
    (payment) => payment.currency,
    baseCurrency,
  );

  const kpis = [
    { title: 'Transacciones',   value: groupedPayments.length,                   icon: Hash,         color: 'text-blue-500',   bg: 'bg-blue-500/10'    },
    { title: 'Conciliados',     value: groupedPayments.length,                   icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="purchases-list-kpis">
        {displayMode === 'ORIGINAL'
          ? originalPaidAmounts.map((summary) => <PurchaseKpiCard key={`paid-${summary.currency}`} title={`Pagos Realizados (${summary.currency})`} value={formatExplicitAmount(summary.amount, summary.currency)} icon={TrendingDown} color="text-rose-500" bg="bg-rose-500/10" kind="indicator" />)
          : <PurchaseKpiCard title={`Pagos Realizados (${displayCurrency}${valuationModeSuffix})`} value={formatCurrentAmount(paidTotalInDisplayCurrency, displayCurrency)} icon={TrendingDown} color="text-rose-500" bg="bg-rose-500/10" kind="indicator" />}
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind="indicator" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Pagos Realizados</h2></div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="payments" />
            <PdfDownloadButton label="Exportar" includeRoll={false} onDownload={(format) => void handleExportListPdf(format)} />
            <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de pagos a proveedores" />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
             {canPerform('PURCHASES_PAYMENTS', 'create') && canPerform('PURCHASES_PAYMENTS', 'approve') && (
               <Button onClick={() => setEditingId('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Registrar Pago</Button>
             )}
          </div>
        </div>
        <EditableDataTable data={filteredData} columns={columns} onRowUpdate={handleUpdate} onRowClick={(row) => setDetailPayment(row)} isLoading={loading} pagination={pagination} layoutMode={layoutMode === 'cards' ? 'cards' : 'responsive'} highlightedRowId={highlightedTargetId} bulkAction="cancel"
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
              <div className="flex items-center gap-1">
                <Button title="Ver detalle" aria-label="Ver detalle del pago" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setDetailPayment(row)}><Eye className="size-4" /></Button>
                {canPerform('PURCHASES_PAYMENTS', 'edit') && !row.isGroupedPayment && <Button title="Editar pago" aria-label="Editar pago" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={(event) => { event.stopPropagation(); setDetailPayment(null); setEditingId(row.id); }}><Pencil className="size-4" /></Button>}
              </div>
          )}
        />
      </div>
      <SalesDocumentDetailSheet
        document={detailPayment ? {
          id: detailPayment.id,
          number: String(detailPayment.number || detailPayment.reference || detailPayment.id),
          title: 'Pago a proveedor',
          customerName: detailPayment.supplier?.name || 'Sin proveedor',
          hideCustomer: true,
          status: detailPayment.isActive === false ? 'VOIDED' : 'PAID',
          totalLabel: formatCurrentAmount(Number(detailPayment.amount || 0), detailPayment.currency || displayCurrency),
          sourceCurrency: detailPayment.currency || displayCurrency,
          sourceExchangeRate: detailPayment.exchangeRate,
          summaryDetails: [{ label: 'Tipo', value: detailPayment.paymentLabel || 'Pago único' }, { label: 'Método', value: getMethodLabel(detailPayment.method) }],
          metadata: [{ label: 'Fecha', value: detailPayment.date ? formatDateEs(detailPayment.date) : 'No disponible' }, { label: 'Factura', value: linkedInvoiceForPayment(detailPayment)?.number || 'Sin factura asociada' }, { label: 'Referencia', value: detailPayment.displayReference || paymentReferenceLabel(detailPayment) }],
          lines: (detailPayment.payments?.length ? detailPayment.payments : [detailPayment]).map((payment, index) => ({ id: String(payment.id || index), description: getMethodLabel(payment.method), quantity: 1, unitPriceLabel: formatCurrentAmount(Number(payment.amount || 0), payment.currency || displayCurrency), totalLabel: formatCurrentAmount(Number(payment.amount || 0), payment.currency || displayCurrency), secondaryLabel: `Referencia: ${paymentReferenceLabel(payment)}${payment.bankAccountId ? ` · Banco: ${payment.bankAccountId}` : ''}` })),
          notes: detailPayment.notes,
        } : null}
        entity="PAYMENT_MADE"
        open={Boolean(detailPayment)}
        onClose={() => setDetailPayment(null)}
        extraActions={detailPayment && canPerform('PURCHASES_PAYMENTS', 'delete') ? <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs text-rose-500" onClick={() => { setPendingCancelId(detailPayment.id); setPendingCancelGroup(detailPayment); setCancelReason(''); }}><Ban className="size-4" /> Anular</Button> : undefined}
        onDownloadPdf={(format) => detailPayment ? void handleDownloadPaymentPdf(detailPayment, format) : undefined}
      />
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
