import { useState, useEffect } from 'react';
import { 
  FileStack, Plus, Search, Eye, Pencil, Trash2, Ban, Clock, AlertTriangle, CheckCircle2, ChevronLeft, Download, Banknote, FileDown, Info
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { billsService } from '../../services/compras.service';
import { storageService } from '../../services/storage.service';
import { TaxDetail } from '../ui/TaxSelector';
import { isTaxExempt } from '../../utils/taxUtils';
import type { SupplierInvoice, Supplier } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateSupplierInvoicePDF } from '../../utils/pdfGenerator';
import { PurchaseAuditButton } from './PurchaseAuditButton';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from './PurchaseAlertsButton';

interface Props {
  data: SupplierInvoice[];
  loading: boolean;
  onRefresh: () => void;
  draftInvoiceFromOrder?: any;
  onDraftConsumed?: () => void;
  onRegisterPaymentFromInvoice?: (draft: any) => void;
  supplierCatalog?: Supplier[];
  accountCatalog?: any[];
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  onStatusChange?: (value: string) => void;
  purchaseAlert?: PurchaseAlertDetail;
  targetId?: string | null;
  onClearTargetId?: () => void;
}

const statusOpts = [
  { label: 'Pendiente',   value: 'PENDING',  color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Parcial',     value: 'PARTIAL',  color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Pagada',      value: 'PAID',     color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Vencida',     value: 'OVERDUE',  color: 'bg-rose-500/10 text-rose-500' },
  { label: 'Reembolsada', value: 'REFUNDED', color: 'bg-muted/30 text-muted-foreground/50' },
];

const getPurchaseOriginBadge = (invoice: Partial<SupplierInvoice> | null | undefined) => {
  const type = String(invoice?.originType || '').toUpperCase();
  if (type === 'PURCHASE_REQUEST') return 'Desde solicitud de compra';
  if (type === 'PURCHASE_ORDER' || invoice?.purchaseOrderId) return 'Desde orden de compra';
  return 'Factura directa';
};

function calcItemTax(item: any): { taxBase: number; taxRate: number; taxAmount: number } {
  const tt = (item.taxType || 'GRAVADO').toUpperCase();
  if (isTaxExempt(tt)) return { taxBase: 0, taxRate: 0, taxAmount: 0 };
  const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
  const taxRate = Number(item.taxRate) || 15;
  const taxBase = Number(item.taxBase) || lineTotal;
  return { taxRate, taxBase, taxAmount: (taxBase * taxRate) / 100 };
}

export function FacturasProveedorView({ data, loading, onRefresh, draftInvoiceFromOrder, onDraftConsumed, onRegisterPaymentFromInvoice, supplierCatalog = [], accountCatalog = [], pagination, onSearchChange, onStatusChange, purchaseAlert, targetId, onClearTargetId }: Props) {
  const { canPerform, user } = useAuth();
  const {
    exchangeRate: globalRate,
    displayCurrency,
    baseCurrency,
    valuationMode,
    valuationModeLabel,
    valuationModeSuffix,
    showValuationLegend,
    formatConvertedAmount,
    formatHistoricalAmount,
    formatCurrentAmount,
    convertAmount,
    convertCurrentAmount,
  } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-supplier-invoices-layout', 'table', 24 * 365);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timeout = window.setTimeout(() => setHighlightedAlertId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedAlertId]);

  useEffect(() => {
    if (!targetId || !data.some((invoice) => invoice.id === targetId)) return;
    setHighlightedAlertId(targetId);
    setEditingId(targetId);
    onClearTargetId?.();
  }, [targetId, data, onClearTargetId]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<SupplierInvoice> | null>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [nowMs] = useState(() => Date.now());
  const generateSupplierInvoiceNumber = () => `INV-${Date.now().toString().slice(-6)}`;

  useEffect(() => {
    setSuppliers(supplierCatalog);
    setAccounts(accountCatalog);
  }, [supplierCatalog, accountCatalog]);

  useEffect(() => {
    if (draftInvoiceFromOrder) {
      const applyDraft = () => {
        if (!String(draftInvoiceFromOrder.purchaseOrderId || '').trim()) {
          toast.error('La factura solo puede generarse desde una orden de compra.');
          onDraftConsumed?.();
          return;
        }
        setLocalDoc({ number: generateSupplierInvoiceNumber(), ...draftInvoiceFromOrder, _fromDraft: true });
        setEditingId('NEW');
        if (onDraftConsumed) onDraftConsumed();
      };
      applyDraft();
    }
  }, [draftInvoiceFromOrder]);

  const openEditor = (id: string | null) => {
    setEditingId(id);
    if (id && id !== 'NEW') {
      const found = data.find(x => x.id === id);
      setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
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

  const columns: ColumnDef<SupplierInvoice>[] = [
    { key: 'number',   header: 'Factura #',   width: '170px',
      render: (val, row) => <div className="flex min-w-0 flex-col items-start gap-1"><span className="font-black font-mono text-primary text-xs">{val||'-'}</span><Badge variant="outline" className="border-none bg-primary/10 px-1.5 py-0 text-[8px] font-black text-primary">{getPurchaseOriginBadge(row)}</Badge></div> },
    { key: 'supplier', header: 'Proveedor',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',     header: 'Emisión',     width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'dueDate',  header: 'Vencimiento', width: '110px',
      render: (val) => { const isLate = new Date(val).getTime() < Date.now(); return <span className={cn("text-xs", isLate && "text-rose-500 font-bold")}>{val ? new Date(val).toLocaleDateString() : '-'}</span>; } },
    { key: 'total',    header: 'Total',       width: '130px',
      render: (val, row) => {
        const amount = Number(val || 0);
        const sourceCurrency = String(row.currency || baseCurrency).toUpperCase();
        const difference = sourceCurrency === baseCurrency || sourceCurrency === displayCurrency
          ? 0
          : convertCurrentAmount(amount, row.currency) - convertAmount(amount, row.currency, row.exchangeRate || globalRate);
        return (
          <div className="min-w-0">
            <span className="font-black tabular-nums text-rose-500">
              {valuationMode === 'CURRENT'
                ? formatCurrentAmount(amount, row.currency)
                : formatHistoricalAmount(amount, row.currency, row.exchangeRate)}
            </span>
            {showValuationLegend && <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {valuationModeLabel}
              {valuationMode === 'CURRENT' && Math.abs(difference) >= 0.005 && (
                <span className={cn('ml-1', difference > 0 ? 'text-orange-500' : 'text-emerald-500')}>
                  · Δ {formatCurrentAmount(difference, displayCurrency)}
                </span>
              )}
            </div>}
          </div>
        );
      } },
    { key: 'status',   header: 'Estado',      width: '110px',
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
    const updateToastId = toast.loading('Guardando cambios en la factura de proveedor...');
    try {
      const updatedResponse = await billsService.update(id as string, updates);
      const updatedInvoice = (updatedResponse as any)?.data || updatedResponse;
      toast.success('Factura actualizada', { id: updateToastId });
      onRefresh();
    }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar', { id: updateToastId }); }
  };

  const handleCancelConfirm = async () => {
    if (!pendingCancelId || !cancelReason.trim()) return;
    setCancelLoading(true);
    const cancelToastId = toast.loading('Anulando factura de proveedor...');
    try {
      await billsService.cancel(pendingCancelId, cancelReason.trim());
      toast.success('Factura de proveedor anulada', { id: cancelToastId });
      setPendingCancelId(null);
      setCancelReason('');
      if (editingId === pendingCancelId) {
        openEditor(null);
        setLocalDoc(null);
      }
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al anular factura', { id: cancelToastId });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSaveDoc = async () => {
    if (!String(localDoc?.purchaseOrderId || '').trim()) {
      return toast.error('La factura debe generarse desde una orden de compra.');
    }
    if (!localDoc?.supplierId) return toast.error('Debe seleccionar un proveedor');
    if (!String(localDoc?.number || '').trim()) return toast.error('Debe ingresar el número de factura');
    if (isPayingStatus(String(localDoc.status || '')) && !isSupplierActive(localDoc.supplierId)) {
      return toast.error('No se puede registrar pago en facturas de proveedores inactivos');
    }
    
    const saveToastId = toast.loading(editingId === 'NEW' ? 'Registrando factura de proveedor...' : 'Guardando factura de proveedor...');
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
          taxRate: isTaxExempt(it.taxType) ? 0 : Number(it.taxRate || 15),
          taxBase: isTaxExempt(it.taxType) ? 0 : Number(it.taxBase || 0),
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
            toast.error('Ya existe una factura para esta orden de compra', { id: saveToastId });
            return;
          }
        }
        if (docToSave.purchaseReceiptId) {
          const duplicateForReceipt = data.some((inv) => inv.purchaseReceiptId === docToSave.purchaseReceiptId);
          if (duplicateForReceipt) {
            toast.error('Ya existe una factura para esta recepción', { id: saveToastId });
            return;
          }
        }

        const createdResponse = await billsService.create(docToSave);
        const created = (createdResponse as any)?.data || createdResponse;
        if (attachmentFiles.length > 0 && created?.id) await uploadInvoiceAttachments(String(created.id));
        
        toast.success('Factura creada exitosamente', { id: saveToastId });
        openEditor(null);
        setLocalDoc(null);
      } else {
        const updatedResponse = await billsService.update(editingId!, docToSave);
        if (attachmentFiles.length > 0 && editingId) await uploadInvoiceAttachments(String(editingId));
        toast.success('Factura guardada', { id: saveToastId });
      }
      onRefresh();
      setAttachmentFiles([]);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar la factura', { id: saveToastId });
    }
  };

  const uploadInvoiceAttachments = async (invoiceId: string) => {
    for (const file of attachmentFiles) {
      if (file.size > 10 * 1024 * 1024) throw new Error(`El comprobante "${file.name}" supera el límite de 10 MB`);
      const uploaded = await storageService.uploadFile('purchase-evidence', file, { folder: `facturas/${invoiceId}` });
      await billsService.addAttachment(invoiceId, {
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        fileUrl: uploaded.uri,
      });
    }
  };

  const openInvoiceAttachment = async (attachment: any) => {
    try {
      const url = await storageService.resolveUrl(attachment.fileUrl);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo abrir el comprobante');
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
    
    if (['quantity', 'unitPrice', 'taxType', 'taxRate', 'taxBase', 'taxAmount', 'withholdingType', 'withholdingRate'].includes(field)) {
       const q = Number(newItems[idx].quantity || 0);
       const p = Number(newItems[idx].unitPrice || 0);
       const sub = q * p;
       const tt = (newItems[idx].taxType || 'GRAVADO').toUpperCase();
       if (isTaxExempt(tt)) {
         newItems[idx].taxRate = 0;
         newItems[idx].taxBase = 0;
         newItems[idx].taxAmount = 0;
       } else {
         const tax = calcItemTax(newItems[idx]);
         newItems[idx].taxRate = tax.taxRate;
         newItems[idx].taxBase = tax.taxBase;
         newItems[idx].taxAmount = tax.taxAmount;
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
      return acc + calcItemTax(it).taxAmount;
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
      <><div className="min-w-0 max-w-full space-y-6 animate-in slide-in-from-right duration-300" data-tour="purchases-form-title">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { openEditor(null); setLocalDoc(null); }} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nueva Factura de Proveedor' : `Factura ${localDoc.number||''}`}</h2>
              <div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle financiero</p><Badge variant="outline" className="border-none bg-primary/10 text-[8px] font-black text-primary">{getPurchaseOriginBadge(localDoc)}</Badge></div>
            </div>
          </div>
          <div className="flex items-center gap-3" data-tour="purchases-form-actions">
            <PurchaseViewTutorial view="invoices" context="form" />
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
                {!isNew && canPerform('PURCHASES_INVOICES', 'delete') && (
                  <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                    onClick={() => { setPendingCancelId(editingId); setCancelReason(''); }}>
                    <Ban className="mr-2 size-3.5" /> Anular
                  </Button>
                )}
              {!isNew && canPerform('PURCHASES_PAYMENTS', 'create') && canPerform('PURCHASES_PAYMENTS', 'approve') && onRegisterPaymentFromInvoice && (
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
          <Card className="rounded-2xl border-border/50" data-tour="purchases-form-data">
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
                  <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
                    Esta factura fue generada desde una orden de compra. Los datos de la orden y su recepción se mantienen vinculados.
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
                  <div className="flex h-8 items-center"><Badge variant="outline" className={cn('text-[9px] font-black uppercase border-none', currentStatus?.color || 'bg-muted/20 text-muted-foreground')}>{currentStatus?.label || localDoc.status || 'Pendiente'}</Badge></div>
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

          <Card className="rounded-2xl border-border/50" data-tour="purchases-form-summary">
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
                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3">
                  <div className="flex items-center gap-2">
                    <Info className="size-3.5 shrink-0 text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Contabilización al pagar</p>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    Una factura pendiente o parcial no genera asiento. Al liquidarla se registra un asiento único con inventario/gasto e IVA acreditable en Debe, y el medio de pago más IR/retenciones en Haber.
                  </p>
                  <p className="mt-1 text-[9px] font-semibold text-primary">Las cuentas y los medios de pago se configuran en Contabilidad → Configuración → Compras.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50" data-tour="purchases-form-items">
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
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Cuentas contables</p>
                      <div className="flex h-8 items-center rounded-md border border-primary/20 bg-primary/5 px-2 text-[10px] font-bold text-primary">
                        Inventario, IVA y CxP se toman de la configuración global
                      </div>
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
                    {(item.taxType && !isTaxExempt(item.taxType) && item.taxType !== '') && (
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
        <Card className="rounded-2xl border-border/50">
          <CardContent className="space-y-3 p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Comprobantes de la factura</p>
              <p className="mt-1 text-xs text-muted-foreground">Puedes adjuntar uno o varios PDF, imágenes o archivos de soporte. Máximo 10 MB por archivo.</p>
            </div>
            {((localDoc.attachments || []) as any[]).length > 0 && (
              <div className="space-y-2">
                {((localDoc.attachments || []) as any[]).map((attachment: any) => (
                  <div key={attachment.id} className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 p-2">
                    <FileDown className="size-4 shrink-0 text-primary" />
                    <button type="button" className="min-w-0 flex-1 truncate text-left text-xs font-bold hover:text-primary" onClick={() => openInvoiceAttachment(attachment)}>{attachment.fileName}</button>
                    {!isNew && canPerform('PURCHASES_INVOICES', 'edit') && (
                      <Button variant="ghost" size="icon" className="size-7 shrink-0 text-rose-500" aria-label={`Eliminar ${attachment.fileName}`} onClick={async () => { try { await billsService.removeAttachment(String(editingId), attachment.id); setLocalDoc((prev: any) => prev ? { ...prev, attachments: (prev.attachments || []).filter((item: any) => item.id !== attachment.id) } : prev); toast.success('Comprobante eliminado'); } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || 'No se pudo eliminar el comprobante'); } }}><Trash2 className="size-3.5" /></Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {((isNew && canPerform('PURCHASES_INVOICES', 'create')) || (!isNew && canPerform('PURCHASES_INVOICES', 'edit'))) && (
              <Input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => setAttachmentFiles(Array.from(event.target.files || []))} className="h-9 text-xs" />
            )}
            {attachmentFiles.length > 0 && <p className="text-xs text-muted-foreground">Pendientes por subir: {attachmentFiles.map(file => file.name).join(', ')}</p>}
          </CardContent>
        </Card>
      </div>

    </>
    );
  }

  const pendingTotalInDisplayCurrency = data
    .filter(invoice => ['PENDING', 'PARTIAL'].includes((invoice.status || '').toUpperCase()))
    .reduce((acc, invoice) => {
      const amount = Number(invoice.total ?? invoice.baseTotal ?? 0);
      const converted = valuationMode === 'CURRENT'
        ? convertCurrentAmount(amount, invoice.currency)
        : convertAmount(amount, invoice.currency, invoice.exchangeRate || globalRate);
      return acc + converted;
    }, 0);

  const kpis = [
     { title: 'Facturas',        value: data.length,                   icon: FileStack, color: 'text-blue-500',   bg: 'bg-blue-500/10',    filter: 'ALL'       },
     {
       title: `Por Pagar (${displayCurrency}${valuationModeSuffix})`,
       value: formatCurrentAmount(pendingTotalInDisplayCurrency, displayCurrency),
       icon: Clock,
       color: 'text-amber-500',
       bg: 'bg-amber-500/10',
       filter: 'PENDING',
     },
     { title: 'Vencidas',        value: data.filter(b => new Date(b.dueDate).getTime() < nowMs && (b.status||'').toUpperCase() !== 'PAID').length, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10', filter: 'OVERDUE' },
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
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Facturas de Proveedor</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{showValuationLegend ? `Cuentas por pagar · Vista ${valuationModeLabel.toLowerCase()} al tipo de cambio ${globalRate.toFixed(4)}.` : 'Cuentas por pagar.'}</p></div>
          <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="invoices" />
            <ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de facturas de proveedor" />
            <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-full sm:w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {purchaseAlert && <PurchaseAlertsButton alert={purchaseAlert} onItemSelect={setHighlightedAlertId} />}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination} layoutMode={layoutMode} highlightedRowId={highlightedAlertId} bulkAction="cancel"
          onBulkDelete={canPerform('PURCHASES_INVOICES', 'delete') ? async (ids) => {
            const cancelToastId = toast.loading(`Anulando ${ids.length} factura${ids.length === 1 ? '' : 's'} de proveedor...`);
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await billsService.cancel(id as string, 'Anulación masiva');
              }
              toast.success('Facturas anuladas', { id: cancelToastId });
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al anular', { id: cancelToastId });
            }
          } : undefined}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title={canPerform('PURCHASES_INVOICES', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => openEditor(row.id)}>{canPerform('PURCHASES_INVOICES', 'edit') ? <Pencil className="size-4" /> : <Eye className="size-4" />}</Button>
              {canPerform('PURCHASES_PAYMENTS', 'create') && canPerform('PURCHASES_PAYMENTS', 'approve') && onRegisterPaymentFromInvoice && (
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
                <Button title="Anular factura" aria-label="Anular factura" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => { setPendingCancelId(row.id); setCancelReason(''); }}><Ban className="size-4" /></Button>
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

