import { useState, useEffect } from 'react';
import { 
  FileStack, Plus, Search, Eye, Trash2, Clock, AlertTriangle, CheckCircle2, ChevronLeft, Download, Banknote, Upload, FileDown, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { billsService, purchaseOrdersService, paymentsService, expensesService } from '../../services/compras.service';
import { TaxDetail } from '../ui/TaxSelector';
import type { SupplierInvoice, Supplier } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateSupplierInvoicePDF } from '../../utils/pdfGenerator';
import { PurchaseAuditButton } from './PurchaseAuditButton';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';

interface Props {
  data: SupplierInvoice[];
  loading: boolean;
  onRefresh: () => void;
  draftInvoiceFromOrder?: any;
  onDraftConsumed?: () => void;
  onRegisterPaymentFromInvoice?: (draft: any) => void;
  supplierCatalog?: Supplier[];
  accountCatalog?: any[];
  purchaseReceiptCatalog?: any[];
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  onStatusChange?: (value: string) => void;
}

const statusOpts = [
  { label: 'Pendiente',   value: 'PENDING',  color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Parcial',     value: 'PARTIAL',  color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Pagada',      value: 'PAID',     color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Vencida',     value: 'OVERDUE',  color: 'bg-rose-500/10 text-rose-500' },
  { label: 'Reembolsada', value: 'REFUNDED', color: 'bg-muted/30 text-muted-foreground/50' },
];

export function FacturasProveedorView({ data, loading, onRefresh, draftInvoiceFromOrder, onDraftConsumed, onRegisterPaymentFromInvoice, supplierCatalog = [], accountCatalog = [], purchaseReceiptCatalog = [], pagination, onSearchChange, onStatusChange }: Props) {
  const { canPerform, user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<SupplierInvoice> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; created: number; skipped: number; errors: string[] } | null>(null);
  const generateSupplierInvoiceNumber = () => `INV-${Date.now().toString().slice(-6)}`;

  useEffect(() => {
    setSuppliers(supplierCatalog);
    setAccounts(accountCatalog);
    setReceipts(purchaseReceiptCatalog);
  }, [supplierCatalog, accountCatalog, purchaseReceiptCatalog]);

  useEffect(() => {
    if (draftInvoiceFromOrder) {
      setLocalDoc({ number: generateSupplierInvoiceNumber(), ...draftInvoiceFromOrder, _fromDraft: true });
      setEditingId('NEW');
      if (onDraftConsumed) onDraftConsumed();
    }
  }, [draftInvoiceFromOrder]);

  useEffect(() => {
    if (editingId && editingId !== 'NEW') {
       const found = data.find(x => x.id === editingId);
       setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
    }
  }, [editingId, data]);

  const handleCreateNew = () => {
    setLocalDoc({
      supplierId: '',
      date: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      currency: displayCurrency,
      exchangeRate: globalRate,
      status: 'PENDING',
      number: generateSupplierInvoiceNumber(),
      items: [],
      subtotal: 0,
      taxAmount: 0,
      withholdingTotal: 0,
      withholdingBase: 0,
      total: 0
    });
    setEditingId('NEW');
  };

  const parseXlsx = async (file: File): Promise<Record<string, string>[]> => {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (data.length < 2) return [];
    const headers = (data[0] || []).map((h: any) => String(h).toLowerCase().trim());
    return data.slice(1).map((row: any[]) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => { obj[h] = row[idx] !== undefined ? String(row[idx]).trim() : ''; });
      return obj;
    });
  };

  const normalizeStatus = (raw: string) => {
    const s = String(raw || '').trim().toUpperCase();
    if (['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'REFUNDED'].includes(s)) return s;
    return 'PENDING';
  };

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      ['number', 'supplier', 'date', 'dueDate', 'currency', 'status', 'description', 'quantity', 'unitPrice', 'total'],
      ['FAC-001', 'Proveedor Ejemplo', '2026-01-15', '2026-02-15', 'NIO', 'PENDING', 'Servicio de consultoría', '1', '15000', '15000'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = data[0].map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
    XLSX.writeFile(wb, 'plantilla_facturas_proveedor.xlsx');
    toast.success('Plantilla descargada');
  };

  const handleImport = async () => {
    if (!importFile) return toast.error('Selecciona un archivo Excel');
    setImporting(true);
    setImportResult(null);
    try {
      const rows = await parseXlsx(importFile);
      if (rows.length === 0) { toast.error('El archivo no contiene filas'); return; }
      let created = 0, skipped = 0;
      const errors: string[] = [];
      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const rowNum = idx + 2;
        const supplierName = String(row.supplier || row.proveedor || '').trim();
        const supplier = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
        if (!supplier) { skipped++; errors.push(`Fila ${rowNum}: proveedor "${supplierName}" no encontrado`); continue; }
        const description = String(row.description || row.descripcion || '').trim();
        const qty = Number(String(row.quantity || row.cantidad || '1').replace(',', '.'));
        const unitPrice = Number(String(row.unitprice || row.preciounitario || row.price || row.precio || '0').replace(',', '.'));
        const total = Number(String(row.total || '0').replace(',', '.'));
        if (!description) { skipped++; errors.push(`Fila ${rowNum}: descripción del item es obligatoria`); continue; }
        if (total <= 0 && unitPrice <= 0) { skipped++; errors.push(`Fila ${rowNum}: total o precio unitario inválido`); continue; }
        const finalTotal = total > 0 ? total : qty * unitPrice;
        const dateRaw = String(row.date || row.fecha || '').trim();
        const dateParsed = dateRaw ? new Date(dateRaw) : new Date();
        const date = Number.isNaN(dateParsed.getTime()) ? new Date().toISOString() : dateParsed.toISOString();
        const dueDateRaw = String(row.duedate || row.fechavencimiento || row.fechaven || '').trim();
        const dueDateParsed = dueDateRaw ? new Date(dueDateRaw) : new Date(Date.now() + 30 * 86400000);
        const dueDate = Number.isNaN(dueDateParsed.getTime()) ? new Date(Date.now() + 30 * 86400000).toISOString() : dueDateParsed.toISOString();
        const currency = String(row.currency || row.moneda || 'NIO').trim().toUpperCase() === 'USD' ? 'USD' : 'NIO';
        const status = normalizeStatus(String(row.status || row.estado || 'PENDING'));
        try {
          await billsService.create({
            supplierId: supplier.id,
            number: String(row.number || row.numero || `IMP-${Date.now()}-${idx}`).trim(),
            date, dueDate, currency, exchangeRate: globalRate, status,
            subtotal: finalTotal,
            taxAmount: 0,
            withholdingTotal: 0,
            withholdingBase: 0,
            total: finalTotal,
            items: [{ description, quantity: Math.max(qty, 1), unitPrice: Math.max(unitPrice, finalTotal), taxType: 'GRAVADO', taxRate: 0, taxBase: 0, taxAmount: 0, withholdingType: 'NONE', withholdingRate: 0, withholdingBase: 0, accountId: null, costCenterId: null, total: finalTotal }],
          } as any);
          created++;
        } catch (e: any) {
          skipped++;
          errors.push(`Fila ${rowNum}: ${e?.response?.data?.message || e?.message || 'error al crear'}`);
        }
      }
      setImportResult({ total: rows.length, created, skipped, errors: errors.slice(0, 12) });
      if (created > 0) onRefresh();
      toast.success(`Importación finalizada: ${created} creadas, ${skipped} omitidas`);
    } catch (error: any) {
      toast.error(`No se pudo importar: ${error?.message || 'archivo inválido'}`);
    } finally {
      setImporting(false);
    }
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filtered = data.filter((b) => {
    const st = (b.status || '').toUpperCase();
    if (statusFilter === 'PENDING') { if (st !== 'PENDING' && st !== 'PARTIAL') return false; }
    else if (statusFilter === 'OVERDUE') { if (st !== 'OVERDUE') return false; }
    else if (statusFilter === 'PAID') { if (st !== 'PAID') return false; }
    if (!normalizedSearchTerm) return true;
    const haystack = [
      b.number,
      b.supplier?.name,
      b.supplier?.code,
      b.supplier?.email,
      b.supplier?.phone,
      b.notes,
      b.status,
      b.date ? new Date(b.date).toLocaleDateString() : '',
      b.dueDate ? new Date(b.dueDate).toLocaleDateString() : '',
      String(b.total ?? ''),
      String(b.amountPaid ?? ''),
      String(b.balance ?? ''),
      ...(b.items || []).map((item: any) => item.description),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearchTerm);
  });

  const isSupplierActive = (supplierId?: string) =>
    !!supplierId && (suppliers.find((s) => s.id === supplierId)?.status || '').toUpperCase() === 'ACTIVE';
  const isPayingStatus = (status?: string) => ['PAID', 'PARTIAL'].includes((status || '').toUpperCase());

  const getBillPaymentAmount = (invoice: Partial<SupplierInvoice>) => {
    const total = Number(invoice.total || 0);
    const amountPaid = Number(invoice.amountPaid || 0);
    const balance = Number(invoice.balance || 0);
    if (amountPaid > 0) return amountPaid;
    if (total > 0 && balance >= 0 && balance < total) return total - balance;
    return total;
  };

  const ensureFinanceExpenseForInvoice = async (invoice: Partial<SupplierInvoice>) => {
    const nextStatus = String(invoice.status || '').toUpperCase();
    if (!['PAID', 'PARTIAL'].includes(nextStatus)) return;
    if (!invoice.id || !invoice.supplierId) return;

    const amount = getBillPaymentAmount(invoice);
    if (amount <= 0) return;

    const supplier = suppliers.find((s) => s.id === invoice.supplierId);
    const syncReference = `AUTO-INV-${invoice.id}`;
    const [paymentsResponse, expensesResponse] = await Promise.all([
      paymentsService.getAll({ supplierInvoiceId: invoice.id, page: 1, pageSize: 200 }).catch(() => ({ data: [] as any[] })),
      expensesService.getAll({ search: syncReference, page: 1, pageSize: 50 }).catch(() => ({ data: [] as any[] })),
    ]);
    const existingPayments = (paymentsResponse as any)?.data || [];
    const existingExpenses = (expensesResponse as any)?.data || [];

    const paymentExists = existingPayments.some(
      (payment: any) => payment.supplierInvoiceId === invoice.id || payment.reference === syncReference,
    );
    if (!paymentExists) {
      await paymentsService.create({
        supplierId: invoice.supplierId,
        supplierInvoiceId: invoice.id,
        date: invoice.date || new Date().toISOString(),
        amount,
        currency: (invoice.currency as any) || displayCurrency,
        exchangeRate: invoice.exchangeRate || globalRate,
        method: 'TRANSFER',
        reference: syncReference,
        notes: `Pago automático por factura ${invoice.number || invoice.id}`,
      } as any);
    }

    const expenseExists = existingExpenses.some((expense: any) => expense.reference === syncReference);
    if (!expenseExists) {
      await expensesService.create({
        supplierId: invoice.supplierId,
        date: invoice.date || new Date().toISOString(),
        amount,
        currency: (invoice.currency as any) || displayCurrency,
        exchangeRate: invoice.exchangeRate || globalRate,
        category: 'FACTURA_PROVEEDOR',
        description: `Pago de factura proveedor ${invoice.number || invoice.id}`,
        paidTo: supplier?.name || 'Proveedor',
        reference: syncReference,
        status: 'PAID',
      } as any);
    }
  };

  const columns: ColumnDef<SupplierInvoice>[] = [
    { key: 'number',   header: 'Factura #',   width: '120px',
      render: (val) => <span className="font-black font-mono text-primary text-xs">{val||'-'}</span> },
    { key: 'supplier', header: 'Proveedor',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',     header: 'Emisión',     width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'dueDate',  header: 'Vencimiento', width: '110px',
      render: (val) => { const isLate = new Date(val).getTime() < Date.now(); return <span className={cn("text-xs", isLate && "text-rose-500 font-bold")}>{val ? new Date(val).toLocaleDateString() : '-'}</span>; } },
    { key: 'total',    header: 'Total',       width: '130px',
      render: (val, row) => (
        <span className="font-black tabular-nums text-rose-500">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}

        </span>
      ) },
    { key: 'status',   header: 'Estado',      width: '110px', editable: canPerform('PURCHASES_INVOICES', 'edit'), type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<SupplierInvoice>) => {
    const currentInvoice = data.find((x) => x.id === id);
    const previousStatus = String(currentInvoice?.status || '').toUpperCase();
    const statusToApply = (updates.status || currentInvoice?.status || '').toString();
    if (isPayingStatus(statusToApply) && currentInvoice?.supplierId && !isSupplierActive(currentInvoice.supplierId)) {
      toast.error('No se puede registrar pago en facturas de proveedores inactivos');
      return;
    }
    try {
      const updatedResponse = await billsService.update(id as string, updates);
      const updatedInvoice = (updatedResponse as any)?.data || updatedResponse;
      const nextStatus = String(updatedInvoice?.status || updates.status || previousStatus).toUpperCase();
      if (!isPayingStatus(previousStatus) && isPayingStatus(nextStatus)) {
        try {
          await ensureFinanceExpenseForInvoice({
            ...(currentInvoice || {}),
            ...(updatedInvoice || {}),
            id: String(id),
            status: nextStatus,
          });
        } catch (syncError: any) {
          toast.warning(`Factura actualizada, pero no se pudo sincronizar pago/finanzas: ${syncError?.message || 'Error de sincronización'}`);
        }
      }
      toast.success('Factura actualizada');
      onRefresh();
    }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar'); }
  };

  const handleCancelConfirm = async () => {
    if (!pendingCancelId || !cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      await billsService.cancel(pendingCancelId, cancelReason.trim());
      toast.success('Factura de proveedor anulada');
      setPendingCancelId(null);
      setCancelReason('');
      if (editingId === pendingCancelId) {
        setEditingId(null);
        setLocalDoc(null);
      }
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al anular factura');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Debe seleccionar un proveedor');
    if (!String(localDoc?.number || '').trim()) return toast.error('Debe ingresar el número de factura');
    if (isPayingStatus(String(localDoc.status || '')) && !isSupplierActive(localDoc.supplierId)) {
      return toast.error('No se puede registrar pago en facturas de proveedores inactivos');
    }
    
    try {
      const docToSave: any = {
        ...localDoc,
        taxRate: 0,
        withholdingRate: 0,
        subtotal: Number(localDoc.subtotal || 0),
        taxAmount: Number(localDoc.taxAmount || 0),
        withholdingTotal: Number(localDoc.withholdingTotal || 0),
        withholdingBase: Number(localDoc.withholdingBase || 0),
        total: Number(localDoc.total || 0),
        items: (localDoc.items || []).map((it: any) => ({
          ...it,
          description: it.description || it.name || '',
          quantity: Number(it.quantity || 0),
          unitPrice: Number(it.unitPrice || 0),
          taxType: it.taxType || 'GRAVADO',
          taxRate: it.taxType === 'EXENTO' || it.taxType === 'NO_GRAVADO' ? 0 : Number(it.taxRate || 15),
          taxBase: it.taxType === 'EXENTO' || it.taxType === 'NO_GRAVADO' ? 0 : Number(it.taxBase || 0),
          taxAmount: Number(it.taxAmount || 0),
          withholdingType: it.withholdingType || 'NONE',
          withholdingRate: Number(it.withholdingRate || 0),
          withholdingBase: it.withholdingType === 'NONE' ? 0 : Number(it.withholdingBase || 0),
          accountId: it.accountId || null,
          costCenterId: it.costCenterId || null,
          total: Number(it.total || 0),
        })),
      };
      delete docToSave._sourceOrderId;
      delete docToSave._fromDraft;

      if (editingId === 'NEW') {
        if (docToSave.purchaseOrderId) {
          const duplicateForOrder = data.some((inv) => inv.purchaseOrderId === docToSave.purchaseOrderId);
          if (duplicateForOrder) {
            return toast.error('Ya existe una factura para esta orden de compra');
          }
        }
        if (docToSave.purchaseReceiptId) {
          const duplicateForReceipt = data.some((inv) => inv.purchaseReceiptId === docToSave.purchaseReceiptId);
          if (duplicateForReceipt) {
            return toast.error('Ya existe una factura para esta recepción');
          }
        }

        const createdResponse = await billsService.create(docToSave);
        const created = (createdResponse as any)?.data || createdResponse;
        if (isPayingStatus(String(created?.status || localDoc.status || ''))) {
          try {
            await ensureFinanceExpenseForInvoice(created);
          } catch (syncError: any) {
            toast.warning(`Factura creada, pero no se pudo sincronizar pago/finanzas: ${syncError?.message || 'Error de sincronización'}`);
          }
        }
        
        if ((localDoc as any)._sourceOrderId) {
          try {
            await purchaseOrdersService.update((localDoc as any)._sourceOrderId, { status: 'RECEIVED' });
          } catch (err) {
            console.error('Failed to update source order status', err);
          }
        }
        
        toast.success('Factura creada exitosamente');
        setEditingId(null);
        setLocalDoc(null);
      } else {
        const existingInvoice = data.find((x) => x.id === editingId);
        const previousStatus = String(existingInvoice?.status || '').toUpperCase();
        const updatedResponse = await billsService.update(editingId!, docToSave);
        const updatedInvoice = (updatedResponse as any)?.data || updatedResponse;
        const nextStatus = String(updatedInvoice?.status || docToSave.status || '').toUpperCase();
        if (!isPayingStatus(previousStatus) && isPayingStatus(nextStatus)) {
          try {
            await ensureFinanceExpenseForInvoice({
              ...(existingInvoice || {}),
              ...(updatedInvoice || {}),
              id: editingId!,
              status: nextStatus,
            });
          } catch (syncError: any) {
            toast.warning(`Factura guardada, pero no se pudo sincronizar pago/finanzas: ${syncError?.message || 'Error de sincronización'}`);
          }
        }
        toast.success('Factura guardada');
      }
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar la factura');
    }
  };

  const handleDeleteItem = (idx: number) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems.splice(idx, 1);
    recalculateTotals(newItems);
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    
    if (['quantity', 'unitPrice', 'taxType', 'taxRate', 'withholdingType', 'withholdingRate'].includes(field)) {
       const q = Number(newItems[idx].quantity || 0);
       const p = Number(newItems[idx].unitPrice || 0);
       const sub = q * p;
       const tt = (newItems[idx].taxType || 'GRAVADO').toUpperCase();
       if (tt === 'EXENTO' || tt === 'NO_GRAVADO') {
         newItems[idx].taxRate = 0;
         newItems[idx].taxBase = 0;
         newItems[idx].taxAmount = 0;
       }
       const wt = (newItems[idx].withholdingType || 'NONE').toUpperCase();
       if (wt === 'NONE') {
         newItems[idx].withholdingRate = 0;
         newItems[idx].withholdingBase = 0;
       }
       newItems[idx].total = sub;
    }
    recalculateTotals(newItems);
  };

  const calculateTotals = (items: any[]) => {
    const subtotal = items.reduce((acc, it) => acc + (Number(it.quantity||0) * Number(it.unitPrice||0)), 0);
    const taxAmount = items.reduce((acc, it) => {
      const tt = (it.taxType || 'GRAVADO').toUpperCase();
      if (tt !== 'GRAVADO') return acc + 0;
      const lineTotal = Number(it.quantity||0) * Number(it.unitPrice||0);
      const base = Number(it.taxBase) || lineTotal;
      const rate = Number(it.taxRate) || 15;
      return acc + (base * rate / 100);
    }, 0);
    const withholdingTotal = items.reduce((acc, it) => {
      const wt = (it.withholdingType || 'NONE').toUpperCase();
      if (wt === 'NONE') return acc + 0;
      const lineTotal = Number(it.quantity||0) * Number(it.unitPrice||0);
      const base = Number(it.withholdingBase) || lineTotal;
      const rate = Number(it.withholdingRate) || 0;
      return acc + (base * rate / 100);
    }, 0);
    const withholdingBase = items.reduce((acc, it) => {
      const wt = (it.withholdingType || 'NONE').toUpperCase();
      if (wt === 'NONE') return acc + 0;
      const lineTotal = Number(it.quantity||0) * Number(it.unitPrice||0);
      return acc + (Number(it.withholdingBase) || lineTotal);
    }, 0);
    const total = subtotal + taxAmount - withholdingTotal;
    return { subtotal, taxAmount, withholdingTotal, withholdingBase, total };
  };

  const recalculateTotals = (items: any[]) => {
    const totals = calculateTotals(items);
    setLocalDoc(prev => ({ ...prev!, items, ...totals }));
  };

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toUpperCase());
    const paymentDraft = {
      supplierId: localDoc.supplierId || '',
      supplierInvoiceId: localDoc.id || '',
      date: new Date().toISOString(),
      amount: getBillPaymentAmount(localDoc),
      currency: (localDoc.currency as any) || displayCurrency,
      exchangeRate: localDoc.exchangeRate || globalRate,
      method: 'TRANSFER',
      reference: `PAG-${(localDoc.number || localDoc.id || '').toString().replace(/[^A-Za-z0-9-]/g, '').slice(0, 20)}`,
      notes: `Pago de factura proveedor ${localDoc.number || localDoc.id || ''}`.trim(),
    };
    
    return (
      <><div className="min-w-0 max-w-full space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setLocalDoc(null); }} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nueva Factura de Proveedor' : `Factura ${localDoc.number||''}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle financiero</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isNew && (
               <Button
                 variant="outline"
                 className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
                 onClick={() => generateSupplierInvoicePDF({
                   invoice: localDoc,
                   tenantName: user?.tenantName || 'Nova Hub',
                   formatAmount: (amount: number, currency?: string, rate?: number) =>
                     formatConvertedAmount(Number(amount || 0), currency || (localDoc.currency as any), rate || localDoc.exchangeRate),
                 })}
               >
                 <Download className="size-3 mr-2" /> Descargar
               </Button>
             )}
                {!isNew && (
                  <Button variant="outline" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
                    onClick={() => setImportOpen(true)}>
                    <Upload className="size-3 mr-2" /> Importar
                  </Button>
                )}
                {!isNew && canPerform('PURCHASES_INVOICES', 'delete') && (
                  <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                    onClick={() => { setPendingCancelId(editingId); setCancelReason(''); }}>
                    <Trash2 className="size-3 mr-2" /> Anular
                  </Button>
                )}
              {!isNew && canPerform('PURCHASES_INVOICES', 'create') && onRegisterPaymentFromInvoice && (
                <Button
                  variant="outline"
                  className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => onRegisterPaymentFromInvoice(paymentDraft)}
                >
                  <Banknote className="size-3 mr-2" /> Registrar Pago
                </Button>
              )}
            {((isNew && canPerform('PURCHASES_INVOICES', 'create')) || (!isNew && canPerform('PURCHASES_INVOICES', 'edit'))) && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar Factura
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Número de Factura <span className="text-rose-500">*</span></p>
                  <Input 
                    value={localDoc.number || ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, number: e.target.value })}
                    className="h-8 text-xs font-black uppercase" 
                    placeholder="Ej: F001-000001" 
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                  <Combobox 
                    disabled={isNew ? !canPerform('PURCHASES_INVOICES', 'create') : !canPerform('PURCHASES_INVOICES', 'edit')}
                    options={suppliers
                      .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                      .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val })}
                    placeholder="Seleccionar Proveedor"
                  />
                </div>
                {isNew && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Generar desde Recepción (opcional)</p>
                    <Combobox
                      options={[
                        { label: 'Sin recepción (ingreso manual)', value: '__none__' },
                        ...receipts
                          .filter((r: any) => r.status === 'RECEIVED')
                          .map((r: any) => ({
                            label: `#${r.number || r.id?.slice(0, 8)}`,
                            value: r.id,
                            description: `${r.supplier?.name || 'Proveedor'} · ${r.items?.length || 0} ítems`,
                          }))
                      ]}
                      value={(localDoc.purchaseReceiptId as string) || '__none__'}
                      onChange={(val) => {
                        if (val === '__none__' || !val) {
                          setLocalDoc((prev: any) => prev ? { ...prev, purchaseReceiptId: null, purchaseOrderId: null, items: [] } : prev);
                          return;
                        }
                        const receipt = receipts.find((r: any) => r.id === val);
                        if (!receipt) return;
                        const receiptItems = (receipt.items || []).map((it: any) => ({
                          description: it.description || it.name || '',
                          quantity: Number(it.quantity || 0),
                          unitPrice: Number(it.unitPrice || 0),
                          productId: it.productId || null,
                          taxType: it.taxType || 'GRAVADO',
                          taxRate: it.taxType === 'EXENTO' || it.taxType === 'NO_GRAVADO' ? 0 : Number(it.taxRate || 15),
                          taxBase: it.taxType === 'EXENTO' || it.taxType === 'NO_GRAVADO' ? 0 : Number(it.taxBase || 0),
                          taxAmount: Number(it.taxAmount || 0),
                          withholdingType: it.withholdingType || 'NONE',
                          withholdingRate: Number(it.withholdingRate || 0),
                          withholdingBase: it.withholdingType === 'NONE' ? 0 : Number(it.withholdingBase || 0),
                          accountId: it.accountId || null,
                          total: Number(it.total || Number(it.quantity || 0) * Number(it.unitPrice || 0)),
                        }));
                        setLocalDoc((prev: any) => prev ? {
                          ...prev,
                          purchaseReceiptId: val,
                          purchaseOrderId: receipt.purchaseOrderId || null,
                          supplierId: receipt.supplierId || prev.supplierId,
                          items: receiptItems,
                        } : prev);
                      }}
                      placeholder="Buscar recepción..."
                    />
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_INVOICES', 'create') : !canPerform('PURCHASES_INVOICES', 'edit')}
                    type="date" 
                    value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Vencimiento</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_INVOICES', 'create') : !canPerform('PURCHASES_INVOICES', 'edit')}
                    type="date" 
                    value={localDoc.dueDate ? new Date(localDoc.dueDate).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, dueDate: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <select 
                    disabled={isNew ? !canPerform('PURCHASES_INVOICES', 'create') : !canPerform('PURCHASES_INVOICES', 'edit')}
                    value={localDoc.status || 'PENDING'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, status: e.target.value as any })}
                    className={cn("h-8 w-full rounded-md border border-input px-2 text-xs font-bold uppercase", currentStatus?.color || 'bg-background')}
                  >
                    {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                  <select 
                    disabled={isNew ? !canPerform('PURCHASES_INVOICES', 'create') : !canPerform('PURCHASES_INVOICES', 'edit')}
                    value={localDoc.currency || 'NIO'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value as any })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                  >
                    <option value="NIO">NIO (Cordobas)</option>
                    <option value="USD">USD (Dolares)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 flex flex-col justify-center h-full space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold tabular-nums">{localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.subtotal||0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">IVA</span>
                  <span className="font-bold tabular-nums text-rose-500">{localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.taxAmount||0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Retenciones</span>
                  <span className="font-bold tabular-nums text-amber-500">-{localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.withholdingTotal||0).toLocaleString()}</span>
                </div>
                <div className="border-t pt-3 border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-2 font-bold uppercase tracking-widest">Impuestos por línea</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>IVA calculado por producto según tipo fiscal (Gravado/Exento/No Gravado)</p>
                    <p>Retenciones calculadas por producto según tipo de retención</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black uppercase text-xs tracking-widest">Total</span>
                  <span className="font-black text-xl text-primary tabular-nums text-right">
                     {localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.total||0).toLocaleString()}
                     {localDoc.currency === 'NIO' && <span className="block text-[9px] text-muted-foreground mt-1">≈ $ {(Number(localDoc.total||0) / (localDoc.exchangeRate || globalRate)).toLocaleString(undefined, {maximumFractionDigits:2})}</span>}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ítems a Facturar</p>
              {((isNew && canPerform('PURCHASES_INVOICES', 'create')) || (!isNew && canPerform('PURCHASES_INVOICES', 'edit'))) && (
                <Button variant="outline" size="sm" onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: `new-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, taxType: 'GRAVADO', taxRate: 15, taxBase: 0, taxAmount: 0, withholdingType: 'NONE', withholdingRate: 0, withholdingBase: 0, accountId: '', total: 0 }];
                  setLocalDoc({ ...localDoc, items: newItems as any });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <Plus className="size-3 mr-2" /> Agregar Item
                </Button>
              )}
            </div>
            
            <div className="space-y-3">
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="group relative rounded-2xl border border-border/40 bg-background/60 backdrop-blur-sm p-4 space-y-3 hover:border-primary/30 hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1.5">Descripción</p>
                      <Input 
                        disabled={isNew ? !canPerform('PURCHASES_INVOICES', 'create') : !canPerform('PURCHASES_INVOICES', 'edit')}
                        value={item.description || ''} 
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)} 
                        className="h-8 text-xs" 
                        placeholder="Concepto o servicio facturado" 
                      />
                    </div>
                    {((isNew && canPerform('PURCHASES_INVOICES', 'create')) || (!isNew && canPerform('PURCHASES_INVOICES', 'edit'))) && (
                      <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground/40 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteItem(idx)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="purchase-item-fields grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Cant.</p>
                      <Input 
                        disabled={isNew ? !canPerform('PURCHASES_INVOICES', 'create') : !canPerform('PURCHASES_INVOICES', 'edit')}
                        type="number" min="0" 
                        value={item.quantity === 0 ? '' : item.quantity} 
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} 
                        className="h-8 text-xs text-right" placeholder="0" 
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Precio U.</p>
                      <Input 
                        disabled={isNew ? !canPerform('PURCHASES_INVOICES', 'create') : !canPerform('PURCHASES_INVOICES', 'edit')}
                        type="number" min="0" 
                        value={item.unitPrice === 0 ? '' : item.unitPrice} 
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)} 
                        className="h-8 text-xs text-right" placeholder="0" 
                      />
                    </div>
                    <div className="col-span-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Impuestos y Retenciones</p>
                      <TaxDetail
                        item={item}
                        onItemChange={(field, value) => handleItemChange(idx, field, value)}
                        lineTotal={Number(item.quantity || 0) * Number(item.unitPrice || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Cuenta Contable</p>
                      <select
                        disabled={isNew ? !canPerform('PURCHASES_INVOICES', 'create') : !canPerform('PURCHASES_INVOICES', 'edit')}
                        value={item.accountId || ''}
                        onChange={(e) => handleItemChange(idx, 'accountId', e.target.value)}
                        className="h-8 w-full rounded-md border border-input bg-background px-1 text-[10px] font-bold"
                      >
                        <option value="">Seleccionar...</option>
                        {accounts
                          .filter((a: any) => (a.isActive ?? true) !== false)
                          .map((a: any) => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                          ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Total</p>
                      <span className="block h-8 leading-8 text-xs font-black text-right tabular-nums">
                        {localDoc.currency === 'USD' ? '$' : 'C$'} {Number(item.total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-4 pt-1 border-t border-border/30">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Subtotal</span>
                    <span className="text-sm font-black tabular-nums">
                      {localDoc.currency === 'USD' ? '$' : 'C$'} {Number(item.quantity * item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    {(item.taxType && item.taxType !== 'EXENTO' && item.taxType !== 'EXONERADO' && item.taxType !== 'NO_SUJETO' && item.taxType !== '') && (
                      <>
                        <span className="text-[9px] font-black uppercase tracking-widest text-rose-500/60">IVA</span>
                        <span className="text-xs font-black tabular-nums text-rose-500">
                          {localDoc.currency === 'USD' ? '$' : 'C$'} {Number((Number(item.quantity||0) * Number(item.unitPrice||0)) * (Number(item.taxRate||15) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
                    {item.withholdingType !== 'NONE' && (
                      <>
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/60">Ret.</span>
                        <span className="text-xs font-black tabular-nums text-amber-500">
                          -{localDoc.currency === 'USD' ? '$' : 'C$'} {Number((Number(item.quantity||0) * Number(item.unitPrice||0)) * (Number(item.withholdingRate||0) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay ítems registrados.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="size-4" /> Importar facturas de proveedor</DialogTitle>
            <DialogDescription>
              Sube un archivo Excel (.xlsx) para registrar facturas masivamente. Usa la plantilla para mantener el formato correcto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 p-4 bg-muted/20">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Formato esperado</p>
              <p className="text-xs text-muted-foreground">
                Columnas: <span className="font-mono">number, supplier, date, dueDate, currency, status, description, quantity, unitPrice, total</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                status: PENDING/PARTIAL/PAID/OVERDUE/REFUNDED · currency: NIO/USD
              </p>
              <Button variant="ghost" size="sm" className="mt-3 gap-2 h-8" onClick={downloadTemplate}>
                <FileDown className="size-4" /> Descargar plantilla Excel
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Archivo Excel</label>
              <Input type="file" accept=".xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
              {importFile && <p className="text-xs text-muted-foreground">Archivo: <b>{importFile.name}</b> ({Math.round(importFile.size / 1024)} KB)</p>}
            </div>
            {importResult && (
              <div className="rounded-xl border border-border/60 p-4 bg-background">
                <p className="text-xs font-black uppercase tracking-widest mb-2">Resultado</p>
                <p className="text-sm">
                  Total: <b>{importResult.total}</b> · Creadas: <b className="text-emerald-500">{importResult.created}</b> · Omitidas: <b className="text-amber-500">{importResult.skipped}</b>
                </p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-amber-500">
                    <p className="font-semibold flex items-center gap-1"><Info className="size-3" /> Detalles:</p>
                    {importResult.errors.map((err, i) => <p key={i}>- {err}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cerrar</Button>
            <Button onClick={handleImport} disabled={importing || !importFile} className="gap-2">
              <Upload className="size-4" /> {importing ? 'Importando...' : 'Importar facturas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
    );
  }

  const pendingTotalInDisplayCurrency = data
    .filter(invoice => ['PENDING', 'PARTIAL'].includes((invoice.status || '').toUpperCase()))
    .reduce((acc, invoice) => acc + convertAmount(invoice.total || 0, invoice.currency, invoice.exchangeRate), 0);

  const kpis = [
     { title: 'Facturas',        value: data.length,                   icon: FileStack, color: 'text-blue-500',   bg: 'bg-blue-500/10',    filter: 'ALL'       },
     {
       title: `Por Pagar (${displayCurrency})`,
       value: `${displayCurrency === 'USD' ? '$' : 'C$'} ${pendingTotalInDisplayCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
       icon: Clock,
       color: 'text-amber-500',
       bg: 'bg-amber-500/10',
       filter: 'PENDING',
     },
     { title: 'Vencidas',        value: data.filter(b => new Date(b.dueDate).getTime() < Date.now() && (b.status||'').toUpperCase() !== 'PAID').length, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10', filter: 'OVERDUE' },
     { title: 'Pagadas (Mes)',   value: data.filter(b => (b.status||'').toUpperCase() === 'PAID').length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', filter: 'PAID' },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="purchases-list-kpis">
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind="filter" active={statusFilter === k.filter} onClick={() => { const next = statusFilter === k.filter ? 'ALL' : k.filter; setStatusFilter(next); onStatusChange?.(next); }} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Facturas de Proveedor</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Cuentas por pagar</p></div>
          <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="invoices" />
            <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-full sm:w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {canPerform('PURCHASES_INVOICES', 'create') && (
              <>
                <Button onClick={handleCreateNew} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nueva Factura</Button>
              </>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination}
          onBulkDelete={canPerform('PURCHASES_INVOICES', 'delete') ? async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await billsService.cancel(id as string, 'Anulación masiva');
              }
              toast.success('Facturas anuladas');
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al anular');
            }
          } : undefined}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title={canPerform('PURCHASES_INVOICES', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              {canPerform('PURCHASES_INVOICES', 'create') && onRegisterPaymentFromInvoice && (
                <Button
                  title="Registrar Pago"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500"
                  onClick={() => onRegisterPaymentFromInvoice({
                    supplierId: row.supplierId,
                    supplierInvoiceId: row.id,
                    date: new Date().toISOString(),
                    amount: getBillPaymentAmount(row),
                    currency: row.currency || displayCurrency,
                    exchangeRate: row.exchangeRate || globalRate,
                    method: 'TRANSFER',
                    reference: `PAG-${(row.number || row.id || '').toString().replace(/[^A-Za-z0-9-]/g, '').slice(0, 20)}`,
                    notes: `Pago de factura proveedor ${row.number || row.id || ''}`.trim(),
                  })}
                >
                  <Banknote className="size-4" />
                </Button>
              )}
              <PurchaseAuditButton entity="SUPPLIER_INVOICE" entityId={row.id} title="Auditoria de la Factura" />
              {canPerform('PURCHASES_INVOICES', 'delete') && (
                <Button title="Anular" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => { setPendingCancelId(row.id); setCancelReason(''); }}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
        <ConfirmDialog
          open={!!pendingCancelId}
          onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setCancelReason(''); } }}
          title="Anular Factura de Proveedor"
          description="La factura quedará cancelada y se revertirá su efecto en el saldo del proveedor. Esta acción no se puede deshacer."
          confirmLabel="Anular Factura"
          variant="destructive"
          loading={cancelLoading}
          disabled={!cancelReason.trim()}
          onConfirm={handleCancelConfirm}
        >
          <div className="mt-4">
            <label className="text-sm font-medium text-foreground mb-1 block">Motivo de anulación *</label>
            <textarea
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={3}
              placeholder="Ej: Factura duplicada, error del proveedor..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
        </ConfirmDialog>

      </div>
    </div>
  );
}

