import { useState, useEffect } from 'react';
import { RotateCcw, Plus, Search, Eye, Pencil, TrendingDown, CheckCircle2, Clock, ChevronLeft, Trash2, Ban, PlayCircle, PauseCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Combobox } from '../ui/Combobox';
import { recurringSupplierInvoicesService } from '../../services/compras.service';
import type { RecurringSupplierInvoice, Supplier } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { generatePurchaseListPDF, generatePurchaseRecordPDF } from '../../utils/purchaseExports';
import { SalesDocumentDetailSheet } from '../ventas/SalesDocumentDetailSheet';
import { TaxDetail } from '../ui/TaxSelector';
import { isTaxExempt } from '../../utils/taxUtils';
import { summarizeAmountsByCurrency } from '../../utils/currency';

interface Props { data: RecurringSupplierInvoice[]; loading: boolean; onRefresh: () => void; supplierCatalog?: Supplier[]; productCatalog?: any[]; warehouseCatalog?: any[]; pagination?: SalesPaginationControls; onSearchChange?: (value: string) => void; }

const freqOpts = [
  { label: 'Semanal',    value: 'weekly' },  
  { label: 'Mensual',    value: 'monthly' },
  { label: 'Trimestral', value: 'quarterly' }, 
  { label: 'Anual',      value: 'yearly' },
];
const freqMap: Record<string,string> = { weekly:'Semanal', monthly:'Mensual', quarterly:'Trimestral', yearly:'Anual' };
const statusOpts = [
  { label: 'Activo',     value: 'ACTIVE',    color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Pausado',    value: 'PAUSED',    color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Finalizado', value: 'EXPIRED',   color: 'bg-slate-500/10 text-slate-500' },
  { label: 'Cancelado',  value: 'CANCELLED', color: 'bg-rose-500/10 text-rose-500' },
];

// Estos campos pertenecen a documentos individuales, no a una plantilla
// recurrente de proveedor. También se filtran al editar registros antiguos
// para que no vuelvan a viajar en el payload de la programación.
const RECURRING_INVOICE_CHARGE_FIELDS = new Set([
  'extraCostDescription',
  'extraCostAmount',
  'extraCharges',
  'deliveryDescription',
  'deliveryAmount',
  'evidenceFileName',
  'evidenceFileType',
  'evidenceFileSize',
  'evidenceFileUrl',
]);

const recurringPurchaseTypeOptions = [
  { value: 'INVENTORY', label: 'Inventario' },
  { value: 'ASSET', label: 'Activo fijo' },
  { value: 'SERVICE', label: 'Servicio' },
  { value: 'ADMIN', label: 'Gasto administrativo' },
];

const recurringPurchaseTypeMap: Record<string, string> = Object.fromEntries(
  recurringPurchaseTypeOptions.map((option) => [option.value, option.label]),
);

const toDateInputValue = (value?: string | Date | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const fromDateInputValue = (value: string) => value ? new Date(`${value}T12:00:00`).toISOString() : '';

const isRecurringTaxExempt = (taxType?: string) => isTaxExempt(String(taxType || 'EXENTO'));

const calculateRecurringLine = (item: any) => {
  const quantity = Math.max(0, Number(item.quantity || 0));
  const unitPrice = Math.max(0, Number(item.unitPrice || 0));
  const lineTotal = quantity * unitPrice;
  const taxRate = isRecurringTaxExempt(item.taxType) ? 0 : Number(item.taxRate || 15);
  const taxBase = isRecurringTaxExempt(item.taxType) ? 0 : lineTotal;
  const taxAmount = isRecurringTaxExempt(item.taxType) ? 0 : Number((taxBase * taxRate / 100).toFixed(2));
  const withholdingRate = item.withholdingType && String(item.withholdingType).toUpperCase() !== 'NONE' ? Number(item.withholdingRate || 0) : 0;
  const withholdingBase = withholdingRate > 0 ? lineTotal : 0;
  const withholdingTotal = withholdingRate > 0 ? Number((withholdingBase * withholdingRate / 100).toFixed(2)) : 0;
  return {
    quantity,
    unitPrice,
    lineTotal,
    taxRate,
    taxBase,
    taxAmount,
    withholdingRate,
    withholdingBase,
    withholdingTotal,
    total: Math.max(0, lineTotal + taxAmount - withholdingTotal),
  };
};

function stripRecurringInvoiceCharges(value: Record<string, any>) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !RECURRING_INVOICE_CHARGE_FIELDS.has(key)));
}

function calculateRecurringInvoiceTotals(items: any[]) {
  const subtotal = items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
  const taxAmount = items.reduce((acc, item) => {
    const taxType = String(item.taxType || 'EXENTO').toUpperCase();
    if (['EXENTO', 'EXONERADO', 'NO_GRAVADO', 'NO_SUJETO'].includes(taxType)) return acc;
    return acc + (Number(item.quantity || 0) * Number(item.unitPrice || 0) * Number(item.taxRate || 0) / 100);
  }, 0);
  const withholdingTotal = items.reduce((acc, item) => acc + (Number(item.quantity || 0) * Number(item.unitPrice || 0) * Number(item.withholdingRate || 0) / 100), 0);
  return {
    subtotal,
    taxAmount,
    withholdingTotal,
    total: Math.max(0, subtotal + taxAmount - withholdingTotal),
  };
}

export function FacturasProveedorRecView({ data, loading, onRefresh, supplierCatalog = [], productCatalog = [], warehouseCatalog = [], pagination, onSearchChange }: Props) {
  const { canPerform, user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, displayMode, valuationMode, valuationModeSuffix, formatCurrentAmount, formatExplicitAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-recurring-invoices-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED'>('ALL');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<RecurringSupplierInvoice> | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<RecurringSupplierInvoice | null>(null);

  useEffect(() => { setSuppliers(supplierCatalog); }, [supplierCatalog]);

  const openEditor = (id: string | null) => {
    setEditingId(id);
    if (id === 'NEW') {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setLocalDoc({
        supplierId: '',
        description: '',
        frequency: 'monthly',
        startDate: new Date().toISOString(),
        nextInvoiceDate: nextMonth.toISOString(),
        expectedDelivery: nextMonth.toISOString(),
        purchaseType: 'INVENTORY',
        address: '',
        notes: '',
        currency: displayCurrency,
        exchangeRate: globalRate,
        status: 'ACTIVE',
        warehouseId: null,
        items: [],
        subtotal: 0,
        taxAmount: 0,
        withholdingTotal: 0,
        total: 0,
      } as any);
    } else if (id) {
      const found = data.find(x => x.id === id);
      if (!found) {
        setLocalDoc(null);
      } else {
        const cleanDocument = stripRecurringInvoiceCharges(JSON.parse(JSON.stringify(found)));
        setLocalDoc({ ...cleanDocument, ...calculateRecurringInvoiceTotals(cleanDocument.items || []) });
      }
    } else {
      setLocalDoc(null);
    }
  };

  const filtered = data.filter(r => {
    const status = String((r as any).status || '').toUpperCase();
    if (statusFilter !== 'ALL' && status !== statusFilter) return false;
    return `${(r as any).description || ''} ${(r as any).id || ''} ${(r as any).supplier?.name || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((r as any).supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleExportListPdf = async (format: PdfDownloadFormat) => {
    const exportToastId = toast.loading('Generando reporte de compras recurrentes...');
    try {
      await generatePurchaseListPDF({
        title: 'Compras recurrentes',
        rows: filtered,
        tenantName: user?.tenantName || 'Empresa',
        tenantLogo: user?.sessionBranding?.logo || null,
        format,
        targetKey: 'compras.recurring-supplier-invoice',
        columns: [
          { label: 'Descripción', value: (row) => row.description || 'Compra automática' },
          { label: 'Proveedor', value: (row) => row.supplier?.name || 'Sin proveedor' },
          { label: 'Monto', align: 'right', value: (row) => formatCurrentAmount(Number(row.total || row.amount || 0), row.currency || displayCurrency) },
          { label: 'Frecuencia', align: 'center', value: (row) => freqMap[String(row.frequency || '').toLowerCase()] || row.frequency || '—' },
          { label: 'Estado', align: 'center', value: (row) => statusOpts.find((option) => option.value === String(row.status || '').toUpperCase())?.label || row.status || '—' },
        ],
      });
      toast.success('Reporte PDF descargado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el reporte', { id: exportToastId });
    }
  };

  const handleDownloadRecurringInvoicePdf = async (invoice: RecurringSupplierInvoice, format: PdfDownloadFormat) => {
    const exportToastId = toast.loading('Generando PDF de la compra recurrente...');
    try {
      await generatePurchaseRecordPDF({
        tenantName: user?.tenantName || 'Empresa',
        tenantLogo: user?.sessionBranding?.logo || null,
        format,
        targetKey: 'compras.recurring-supplier-invoice',
        document: {
          title: 'Compra recurrente de proveedor',
          number: String(invoice.id),
          status: statusOpts.find((option) => option.value === String(invoice.status || '').toUpperCase())?.label || invoice.status,
          supplier: invoice.supplier?.name || 'Sin proveedor',
          fields: [
            { label: 'Tipo de compra', value: recurringPurchaseTypeMap[String(invoice.purchaseType || 'INVENTORY').toUpperCase()] || invoice.purchaseType || 'Inventario' },
            { label: 'Frecuencia', value: freqMap[String(invoice.frequency || '').toLowerCase()] || invoice.frequency || '—' },
            { label: 'Próxima emisión', value: invoice.nextInvoiceDate ? new Date(invoice.nextInvoiceDate).toLocaleDateString('es-NI') : '—' },
            { label: 'Entrega esperada', value: invoice.expectedDelivery ? new Date(invoice.expectedDelivery).toLocaleDateString('es-NI') : '—' },
            { label: 'Inicio', value: invoice.startDate ? new Date(invoice.startDate).toLocaleDateString('es-NI') : '—' },
            { label: 'Dirección', value: invoice.address || '—' },
          ],
          lines: ((invoice as any).items || []).map((item: any) => ({ description: item.description || 'Concepto sin descripción', quantity: item.quantity || 0, unitPrice: formatCurrentAmount(Number(item.unitPrice || 0), invoice.currency || displayCurrency), total: formatCurrentAmount(Number(item.total || 0), invoice.currency || displayCurrency), secondary: item.commercialNoteSnapshot ? `Nota: ${item.commercialNoteSnapshot}` : undefined })),
          total: formatCurrentAmount(Number(invoice.total || (invoice as any).amount || 0), invoice.currency || displayCurrency),
          totalLabel: 'Monto estimado',
        },
      });
      toast.success('PDF descargado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el PDF', { id: exportToastId });
    }
  };

  const columns: ColumnDef<RecurringSupplierInvoice>[] = [
    { key: 'description' as any, header: 'Descripción', editable: canPerform('PURCHASES_INVOICES_REC', 'edit'), 
      render: (_, row) => <span className="text-xs font-bold text-primary">{(row as any).description || 'Factura Automática'}</span> },
    { key: 'supplier' as any,    header: 'Proveedor',
      render: (_, row) => <span className="font-bold text-sm">{(row as any).supplier?.name||'-'}</span> },
    { key: 'warehouse' as any,   header: 'Bodega',
      render: (_, row) => <span className="text-xs text-muted-foreground">{(row as any).warehouse?.name || 'Sin configurar'}</span> },
    { key: 'total' as any,       header: 'Monto Estimado',       width: '120px',
      render: (val, row) => (
        <CurrencyValuationAmount amount={Number(val || (row as any).amount || 0)} sourceCurrency={row.currency} sourceExchangeRate={row.exchangeRate} className="font-black text-rose-500" />
      ) },
    { key: 'frequency' as any,   header: 'Frecuencia',  width: '120px', editable: canPerform('PURCHASES_INVOICES_REC', 'edit'), type: 'select', options: freqOpts,
      render: (val) => <Badge variant="outline" className="text-[9px] uppercase bg-purple-500/10 text-purple-500 border-none">{freqMap[(val||'').toLowerCase()]||val||'-'}</Badge> },
    { key: 'status' as any,      header: 'Estado',      width: '110px',
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: any) => {
    try { await recurringSupplierInvoicesService.update(id as string, updates); toast.success('Actualizado'); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar'); throw new Error('Update failed', { cause: e }); }
  };

  const handleStatusAction = async (row: RecurringSupplierInvoice) => {
    const current = String((row as any).status || '').toUpperCase();
    const status = current === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const statusToastId = toast.loading(status === 'ACTIVE' ? 'Activando compra recurrente...' : 'Pausando compra recurrente...');
    try {
      if (status === 'ACTIVE') await recurringSupplierInvoicesService.resume(row.id);
      else await recurringSupplierInvoicesService.pause(row.id);
      toast.success(status === 'ACTIVE' ? 'Compra recurrente activada' : 'Compra recurrente pausada', { id: statusToastId });
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo cambiar el estado', { id: statusToastId });
    }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Seleccione un proveedor');
    if (!localDoc.startDate) return toast.error('Debe configurar la fecha de inicio');
    if (!localDoc?.nextInvoiceDate) return toast.error('Debe configurar la próxima fecha de compra');
    if (!localDoc?.expectedDelivery) return toast.error('Debe configurar la entrega esperada del próximo ciclo');
    if (!String(localDoc.address || '').trim()) return toast.error('Debe ingresar la dirección de entrega o facturación');

    const items = (localDoc as any).items || [];
    if (items.length === 0) return toast.error('Agregue al menos un producto a la compra recurrente');
    if (items.some((item: any) => !item.productId)) return toast.error('Cada ítem recurrente debe estar vinculado a un producto del catálogo');
    if (!localDoc.warehouseId) return toast.error('Seleccione la bodega donde se recibirán los productos');

    const saveToastId = toast.loading(editingId === 'NEW' ? 'Registrando compra recurrente...' : 'Guardando compra recurrente...');
    try {
      const normalizedItems = items.map((item: any) => {
        const line = calculateRecurringLine(item);
        return {
          ...item,
          description: String(item.description || '').trim(),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          // Las programaciones antiguas no tenían configuración fiscal; se
          // conservan como exentas hasta que el usuario seleccione un IVA.
          taxType: item.taxType || 'EXENTO',
          taxRate: line.taxRate,
          taxBase: line.taxBase,
          taxAmount: line.taxAmount,
          withholdingType: item.withholdingType || 'NONE',
          withholdingRate: line.withholdingRate,
          withholdingBase: line.withholdingBase,
          withholdingTotal: line.withholdingTotal,
          total: line.lineTotal,
        };
      });
      const finalDoc = {
        ...stripRecurringInvoiceCharges(localDoc as Record<string, any>),
        ...calculateRecurringInvoiceTotals(normalizedItems),
        purchaseType: localDoc.purchaseType || 'INVENTORY',
        address: String(localDoc.address || '').trim(),
        notes: String(localDoc.notes || '').trim(),
        items: normalizedItems,
      };

      if (editingId === 'NEW') {
        await recurringSupplierInvoicesService.create(finalDoc as any);
        toast.success('Compra recurrente creada', { id: saveToastId });
      } else {
        await recurringSupplierInvoicesService.update(editingId!, finalDoc as any);
        toast.success('Compra recurrente guardada', { id: saveToastId });
      }
      openEditor(null);
      onRefresh();
    } catch (e: any) { 
        toast.error(e?.response?.data?.message || e?.message || 'Error al guardar la compra recurrente', { id: saveToastId });
    }
  };

  const handleDeleteItem = (idx: number) => {
    if (!localDoc) return;
    const newItems = [...((localDoc as any).items || [])];
    newItems.splice(idx, 1);
    recalculateTotals(newItems);
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!localDoc) return;
    const newItems = [...((localDoc as any).items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    
    recalculateTotals(newItems);
  };

  const recalculateTotals = (items: any[], changes: Record<string, any> = {}) => {
    setLocalDoc(prev => {
      const next = { ...(prev || {}), ...changes, items } as any;
      const normalizedItems = items.map((item) => {
        const line = calculateRecurringLine(item);
        return { ...item, ...line, total: line.lineTotal };
      });
      const subtotal = normalizedItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
      const taxAmount = normalizedItems.reduce((acc, it) => acc + Number(it.taxAmount || 0), 0);
      const withholdingTotal = normalizedItems.reduce((acc, it) => acc + Number(it.withholdingTotal || 0), 0);
      return { ...next, items: normalizedItems, subtotal, taxAmount, withholdingTotal, total: Math.max(0, subtotal + taxAmount - withholdingTotal) };
    });
  };


  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toUpperCase());
    const canEditRecurrence = isNew
      ? canPerform('PURCHASES_INVOICES_REC', 'create')
      : canPerform('PURCHASES_INVOICES_REC', 'edit') && ['ACTIVE', 'PAUSED'].includes(String(localDoc.status || '').toUpperCase());
    const currencySymbol = String(localDoc.currency || displayCurrency).toUpperCase() === 'USD' ? '$' : 'C$';
    const items = ((localDoc as any).items || []) as any[];
    const totals = calculateRecurringInvoiceTotals(items);
    const formatMoney = (value: number) => `${currencySymbol} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const productSnapshot = (item: any) => {
      const product = productCatalog.find((candidate: any) => String(candidate?.id) === String(item?.productId));
      const stock = product?.stock != null
        ? Number(product.stock)
        : product?.inventoryLevels?.reduce((sum: number, level: any) => sum + Number(level.quantity || 0), 0);
      return {
        product,
        code: item?.code || product?.code || product?.sku || '',
        name: item?.name || product?.name || item?.description || '',
        category: item?.category || product?.category?.name || product?.category || '',
        stock: item?.currentStock ?? stock,
      };
    };

    return (
      <div className="min-w-0 max-w-full space-y-6 animate-in slide-in-from-right duration-300" data-tour="purchases-form-title">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => openEditor(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Agregar Compra Recurrente' : 'Editar Compra Recurrente'}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Generación periódica de órdenes y recepciones</p>
            </div>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-3" data-tour="purchases-form-actions">
            <PurchaseViewTutorial view="recurring-invoices" context="form" />
            {!isNew && canPerform('PURCHASES_INVOICES_REC', 'delete') && (
              <Button variant="outline" className="rounded-xl border-rose-500/50 px-4 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-700 hover:text-white" onClick={() => setPendingDeleteId(editingId)}>
                <Ban className="mr-2 size-3" /> Anular
              </Button>
            )}
            {canEditRecurrence && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary px-6 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20">
                Guardar compra recurrente
              </Button>
            )}
          </div>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <Card className="min-w-0 rounded-2xl border-border/50" data-tour="purchases-form-data">
            <CardContent className="space-y-4 p-6">
              <p className="text-xs font-black uppercase tracking-widest text-foreground">Información general</p>
              <div className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="mb-1 text-[10px] text-foreground">Proveedor *</p>
                  <Combobox
                    disabled={!canEditRecurrence}
                    options={suppliers.filter((supplier) => (supplier.status || '').toUpperCase() === 'ACTIVE' || supplier.id === localDoc.supplierId).map((supplier) => ({ label: supplier.name, value: supplier.id, description: (supplier.code ? `[${supplier.code}] ` : '') + (supplier.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(value) => setLocalDoc({ ...localDoc, supplierId: value } as any)}
                    placeholder="Seleccionar proveedor"
                  />
                </div>
                <div>
                  <p className="mb-1 text-[10px] text-foreground">Bodega destino *</p>
                  <Combobox
                    disabled={!canEditRecurrence}
                    options={warehouseCatalog.filter((warehouse: any) => warehouse?.isActive !== false || warehouse.id === localDoc.warehouseId).map((warehouse: any) => ({ label: warehouse.name || 'Bodega sin nombre', value: warehouse.id, description: warehouse.location || 'Bodega operativa' }))}
                    value={localDoc.warehouseId || ''}
                    onChange={(value) => setLocalDoc({ ...localDoc, warehouseId: value || null } as any)}
                    placeholder="Seleccionar bodega destino"
                    emptyMessage="No hay bodegas activas disponibles"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">La recepción de cada ciclo se creará en esta bodega.</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] text-foreground">Fecha de emisión del próximo ciclo *</p>
                  <Input disabled={!canEditRecurrence} type="date" value={toDateInputValue(localDoc.nextInvoiceDate)} onChange={(event) => setLocalDoc({ ...localDoc, nextInvoiceDate: fromDateInputValue(event.target.value) } as any)} className="h-8 text-xs" />
                  <p className="mt-1 text-[10px] text-muted-foreground">Después se moverá según la frecuencia.</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] text-foreground">Entrega esperada *</p>
                  <Input disabled={!canEditRecurrence} type="date" value={toDateInputValue(localDoc.expectedDelivery)} onChange={(event) => setLocalDoc({ ...localDoc, expectedDelivery: fromDateInputValue(event.target.value) } as any)} className="h-8 text-xs" />
                  <p className="mt-1 text-[10px] text-muted-foreground">Se repite el mismo desfase en cada ciclo.</p>
                </div>
                <div>
                  <p className="mb-1 text-[10px] text-foreground">Tipo de compra</p>
                  <Select disabled={!canEditRecurrence} value={String(localDoc.purchaseType || 'INVENTORY')} onValueChange={(value) => setLocalDoc({ ...localDoc, purchaseType: value } as any)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{recurringPurchaseTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <p className="mb-1 text-[10px] text-foreground">Dirección</p>
                  <Input disabled={!canEditRecurrence} value={localDoc.address || ''} onChange={(event) => setLocalDoc({ ...localDoc, address: event.target.value } as any)} className="h-8 text-xs" placeholder="Dirección de entrega o facturación" />
                </div>
              </div>

              <div className="border-t border-border/50 pt-4">
                <p className="text-xs font-black uppercase tracking-widest text-foreground">Programación recurrente</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Cada ciclo genera una orden aprobada y una recepción pendiente para confirmar la entrada a inventario.</p>
                <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="mb-1 text-[10px] text-foreground">Nombre de la programación</p>
                    <Input disabled={!canEditRecurrence} value={localDoc.description || ''} onChange={(event) => setLocalDoc({ ...localDoc, description: event.target.value } as any)} className="h-8 text-xs font-bold" placeholder="Ej. Reposición mensual de suministros" />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-foreground">Frecuencia</p>
                    <Select disabled={!canEditRecurrence} value={String(localDoc.frequency || 'monthly')} onValueChange={(value) => setLocalDoc({ ...localDoc, frequency: value as any } as any)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{freqOpts.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-foreground">Fecha de inicio</p>
                    <Input disabled={!canEditRecurrence} type="date" value={toDateInputValue(localDoc.startDate)} onChange={(event) => setLocalDoc({ ...localDoc, startDate: fromDateInputValue(event.target.value) } as any)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-foreground">Fecha de fin (opcional)</p>
                    <Input disabled={!canEditRecurrence} type="date" value={toDateInputValue(localDoc.endDate)} onChange={(event) => setLocalDoc({ ...localDoc, endDate: event.target.value ? fromDateInputValue(event.target.value) : undefined } as any)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-foreground">Estado</p>
                    <div className="flex h-8 items-center"><Badge variant="outline" className={cn('border-none text-[9px] font-black uppercase', currentStatus?.color || 'bg-muted/20 text-muted-foreground')}>{currentStatus?.label || localDoc.status || 'Activa'}</Badge></div>
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-1 text-[10px] text-foreground">Notas generales</p>
                <textarea disabled={!canEditRecurrence} value={localDoc.notes || ''} onChange={(event) => setLocalDoc({ ...localDoc, notes: event.target.value } as any)} className="min-h-20 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" placeholder="Indicaciones para cada orden y recepción generada" />
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 rounded-2xl border-border/50" data-tour="purchases-form-summary">
            <CardContent className="flex h-full flex-col justify-center space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-widest text-foreground">Resumen financiero</p>
                <Badge variant="outline" className="text-[9px] font-black uppercase">Moneda: {String(localDoc.currency || displayCurrency)}</Badge>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Subtotal costo</span><span className="text-right font-bold tabular-nums">{formatMoney(totals.subtotal)}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">IVA</span><span className="text-right font-bold tabular-nums text-rose-500">{formatMoney(totals.taxAmount)}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Retenciones</span><span className="text-right font-bold tabular-nums text-amber-500">-{formatMoney(totals.withholdingTotal)}</span></div>
                <div className="border-t border-border/50 pt-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-foreground">Impuestos por línea</p><div className="space-y-1 text-xs text-muted-foreground"><p>IVA calculado según el tipo fiscal de cada producto.</p><p>Retenciones calculadas según la configuración seleccionada.</p></div></div>
                <div className="flex items-center justify-between border-t border-border/50 pt-3 text-base"><span className="text-xs font-black uppercase tracking-widest">Total</span><span className="text-right text-xl font-black tabular-nums text-primary">{formatMoney(totals.total)}<span className="mt-1 block text-[10px] font-bold text-muted-foreground">Monto por ciclo</span></span></div>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">Al llegar la fecha programada se copiarán estos datos a una orden de compra aprobada y a su recepción pendiente.</div>
            </CardContent>
          </Card>
        </div>

        <Card className="min-w-0 rounded-2xl border-border/50" data-tour="purchases-form-items">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-xs font-black uppercase tracking-widest text-foreground">Ítems de orden</p><p className="mt-1 text-[10px] text-muted-foreground">Estos productos se copiarán en cada orden y recepción del ciclo.</p></div>
              {canEditRecurrence && <Button variant="outline" size="sm" onClick={() => recalculateTotals([...items, { id: `new-${Date.now()}`, productId: '', description: '', quantity: 1, unitPrice: 0, taxType: 'GRAVADO', taxRate: 15, taxBase: 0, taxAmount: 0, withholdingType: 'NONE', withholdingRate: 0, withholdingBase: 0, withholdingTotal: 0, total: 0 }])} className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest"><Plus className="mr-2 size-3" /> Agregar ítem</Button>}
            </div>
            <div className="space-y-3" data-tour="purchases-form-items">
              {items.map((item: any, idx: number) => {
                const snapshot = productSnapshot(item);
                const line = calculateRecurringLine(item);
                return (
                  <div key={item.id || idx} className="group min-w-0 rounded-2xl border-2 border-border/80 bg-card p-4 shadow-sm ring-1 ring-border/20 transition-all hover:border-primary/50 hover:shadow-md">
                    <div className="flex min-w-0 flex-col gap-3 border-b border-border/30 pb-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-widest text-foreground">Producto de inventario *</p><p className="mt-1 text-[10px] text-muted-foreground">La recurrencia necesita un producto existente para poder generar la recepción automáticamente.</p></div>
                      <div className="flex min-w-0 w-full items-end gap-2 sm:w-[30rem] sm:flex-none"><div className="min-w-0 flex-1"><Combobox disabled={!canEditRecurrence} options={productCatalog.filter(Boolean).map((product: any) => ({ label: `${product.code || product.sku || ''} - ${product.name || ''}`.trim(), value: String(product.id), description: product.category?.name || product.category || 'Sin categoría' }))} value={item.productId ? String(item.productId) : ''} onChange={(value) => { const product = productCatalog.find((candidate: any) => String(candidate?.id) === String(value)); const nextItems = [...items]; nextItems[idx] = { ...nextItems[idx], productId: value, code: product?.code || product?.sku || '', name: product?.name || '', description: product?.name || '', category: product?.category?.name || product?.category || '', categoryId: product?.categoryId || product?.category?.id || '', currentStock: product?.stock ?? product?.inventoryLevels?.reduce((sum: number, level: any) => sum + Number(level.quantity || 0), 0), unitPrice: Number(product?.costPrice ?? product?.cost ?? product?.lastPurchasePrice ?? nextItems[idx].unitPrice ?? 0), taxType: nextItems[idx].taxType || 'GRAVADO', taxRate: Number(nextItems[idx].taxRate || 15), commercialNoteSnapshot: product?.commercialNote || null }; recalculateTotals(nextItems); }} placeholder="Buscar producto..." searchPlaceholder="Buscar por nombre, código o SKU..." emptyMessage="No hay productos disponibles" className="h-9 text-xs" /></div>{canEditRecurrence && <Button variant="ghost" size="icon" aria-label="Eliminar ítem" className="size-9 shrink-0 rounded-xl text-muted-foreground/60 hover:bg-rose-500/10 hover:text-rose-500" onClick={() => handleDeleteItem(idx)}><Trash2 className="size-3.5" /></Button>}</div>
                    </div>
                    <div className="mt-3 grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-12">
                      <div className="min-w-0 xl:col-span-2"><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-foreground">Código</p><Input disabled value={snapshot.code} className="h-8 bg-muted/30 text-xs font-mono" placeholder="Código" /></div>
                      <div className="min-w-0 xl:col-span-3"><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-foreground">Nombre</p><Input disabled value={snapshot.name} className="h-8 bg-muted/30 text-xs" placeholder="Producto" /></div>
                      <div className="min-w-0 xl:col-span-2"><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-foreground">Categoría</p><Input disabled value={snapshot.category} className="h-8 bg-muted/30 text-xs" placeholder="Sin categoría" /></div>
                      <div className="min-w-0 xl:col-span-1"><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-foreground">Stock actual</p><div className="flex h-8 items-center text-xs font-black tabular-nums text-primary">{snapshot.stock == null ? '—' : Number(snapshot.stock).toLocaleString()}</div></div>
                      <div className="min-w-0 xl:col-span-2"><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-foreground">Cant.</p><Input disabled={!canEditRecurrence} type="number" min="1" step="1" value={item.quantity ?? 1} onChange={(event) => handleItemChange(idx, 'quantity', event.target.value)} className="h-8 text-xs text-right" /></div>
                      <div className="min-w-0 xl:col-span-2"><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-foreground">Precio</p><Input disabled={!canEditRecurrence} type="number" min="0" step="0.01" value={item.unitPrice ?? 0} onChange={(event) => handleItemChange(idx, 'unitPrice', event.target.value)} className="h-8 text-xs text-right" /></div>
                    </div>
                    <div className="mt-3 grid min-w-0 gap-3 border-t border-border/30 pt-3 lg:grid-cols-[10rem_minmax(0,1fr)] lg:items-start"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-foreground">Impuestos y retenciones</p><p className="mt-1 text-[10px] text-foreground/70">IVA y retención aplicables a esta línea.</p></div><TaxDetail item={{ ...item, currency: localDoc.currency }} onItemChange={(field, value) => handleItemChange(idx, field, value)} lineTotal={line.lineTotal} currency={localDoc.currency} disabled={!canEditRecurrence} calculatedFieldsReadOnly /></div>
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-border/50 pt-2"><span className="text-[9px] font-black uppercase tracking-widest text-foreground">Subtotal costo</span><span className="text-sm font-black tabular-nums">{formatMoney(line.lineTotal)}</span><span className="text-[9px] font-black uppercase tracking-widest text-rose-500/70">IVA</span><span className="text-xs font-black tabular-nums text-rose-500">{formatMoney(line.taxAmount)}</span><span className="text-[9px] font-black uppercase tracking-widest text-amber-500/70">Retención</span><span className="text-xs font-black tabular-nums text-amber-500">-{formatMoney(line.withholdingTotal)}</span><span className="border-l border-border/70 pl-4 text-[9px] font-black uppercase tracking-widest text-primary">Total</span><span className="text-sm font-black tabular-nums text-primary">{formatMoney(line.total)}</span></div>
                  </div>
                );
              })}
              {items.length === 0 && <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 py-8 text-center text-xs italic text-muted-foreground/70">No hay ítems registrados. Agrega los productos que se recibirán en cada ciclo.</div>}
            </div>
          </CardContent>
        </Card>
        <ConfirmDialog
          open={!!pendingDeleteId}
          onOpenChange={(open) => !open && setPendingDeleteId(null)}
          loading={deleteLoading}
          title="Anular Compra Recurrente"
          description="¿Estás seguro de anular esta compra recurrente? No se generarán más órdenes ni recepciones automáticamente."
          onConfirm={async () => {
            if (!pendingDeleteId) return;
            const deleteToastId = toast.loading('Anulando compra recurrente...');
            setDeleteLoading(true);
            try {
               await recurringSupplierInvoicesService.cancel(pendingDeleteId);
               toast.success('Compra recurrente anulada', { id: deleteToastId });
               setPendingDeleteId(null);
               openEditor(null);
               onRefresh();
              } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al anular', { id: deleteToastId }); }
            finally { setDeleteLoading(false); }
          }}
        />
      </div>
    );
  }

  const toDisplayAmount = (amount: number, currency?: string, rate?: number) => valuationMode === 'CURRENT'
    ? convertCurrentAmount(amount, currency)
    : convertAmount(amount, currency, rate || globalRate);
  const monthly = data
    .filter(r => ((r as any).frequency || '').toLowerCase() === 'monthly')
    .reduce((acc, recurring) => {
      const sourceAmount = (recurring as any).total ?? (recurring as any).amount ?? 0;
      return acc + toDisplayAmount(Number(sourceAmount), recurring.currency, recurring.exchangeRate);
    }, 0);
  const originalMonthlyAmounts = summarizeAmountsByCurrency(
    data.filter(r => ((r as any).frequency || '').toLowerCase() === 'monthly'),
    (recurring) => Number((recurring as any).total ?? (recurring as any).amount ?? 0),
    (recurring) => recurring.currency,
    baseCurrency,
  );
  const kpis = [
    { title: 'Activas',         value: data.filter(r => ((r as any).status||'').toUpperCase()==='ACTIVE').length,  icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10', kind: 'filter' as const, filter: 'ACTIVE' as const },
    { title: 'Total Recurrentes', value: data.length,                                                                icon: RotateCcw,     color: 'text-blue-500',    bg: 'bg-blue-500/10', kind: 'indicator' as const },
    { title: 'Pausadas',        value: data.filter(r => ((r as any).status||'').toUpperCase()==='PAUSED').length,   icon: Clock,         color: 'text-amber-500',  bg: 'bg-amber-500/10', kind: 'filter' as const, filter: 'PAUSED' as const },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="purchases-list-kpis">
        {displayMode === 'ORIGINAL'
          ? originalMonthlyAmounts.map((summary) => <PurchaseKpiCard key={`monthly-${summary.currency}`} title={`Est. Mensual (${summary.currency})`} value={formatExplicitAmount(summary.amount, summary.currency)} icon={TrendingDown} color="text-rose-500" bg="bg-rose-500/10" kind="indicator" />)
          : <PurchaseKpiCard title={`Est. Mensual (${displayCurrency}${valuationModeSuffix})`} value={formatCurrentAmount(monthly, displayCurrency)} icon={TrendingDown} color="text-rose-500" bg="bg-rose-500/10" kind="indicator" />}
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind={k.kind} active={k.filter === statusFilter} onClick={k.filter ? () => setStatusFilter(statusFilter === k.filter ? 'ALL' : k.filter) : undefined} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Compras Recurrentes</h2>
            <p className="mt-1 text-xs text-muted-foreground">Cada programación crea una orden y una recepción pendiente por ciclo.</p>
          </div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="recurring-invoices" />
            <PdfDownloadButton label="Exportar" includeRoll={false} onDownload={(format) => void handleExportListPdf(format)} />
            <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de compras recurrentes" />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {canPerform('PURCHASES_INVOICES_REC', 'create') && (
              <Button onClick={() => openEditor('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Agregar Compra Recurrente</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} onRowClick={(row) => setDetailInvoice(row)} isLoading={loading} pagination={pagination} layoutMode={layoutMode === 'cards' ? 'cards' : 'responsive'}
          onBulkDelete={canPerform('PURCHASES_INVOICES_REC', 'delete') ? async (ids) => {
            const deleteToastId = toast.loading(`Anulando ${ids.length} compra${ids.length === 1 ? '' : 's'} recurrente${ids.length === 1 ? '' : 's'}...`);
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await recurringSupplierInvoicesService.cancel(id as string);
              }
              toast.success('Compras recurrentes anuladas', { id: deleteToastId });
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar', { id: deleteToastId });
            }
          } : undefined}
          actions={(row) => (
            <div className="flex items-center gap-1">
              <Button title="Ver detalle" aria-label="Ver detalle de la compra recurrente" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setDetailInvoice(row)}><Eye className="size-4" /></Button>
              {canPerform('PURCHASES_INVOICES_REC', 'edit') && <Button title="Editar compra recurrente" aria-label="Editar compra recurrente" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={(event) => { event.stopPropagation(); setDetailInvoice(null); openEditor(row.id); }}><Pencil className="size-4" /></Button>}
            </div>
          )}
        />
        <SalesDocumentDetailSheet
          document={detailInvoice ? {
            id: detailInvoice.id,
            number: String(detailInvoice.id),
            title: 'Compra recurrente de proveedor',
            customerName: detailInvoice.supplier?.name || 'Sin proveedor',
            hideCustomer: true,
            status: String(detailInvoice.status || 'ACTIVE').toUpperCase(),
            totalLabel: formatCurrentAmount(Number(detailInvoice.total || (detailInvoice as any).amount || 0), detailInvoice.currency || displayCurrency),
            sourceCurrency: detailInvoice.currency || displayCurrency,
            sourceExchangeRate: detailInvoice.exchangeRate,
             summaryDetails: [
               { label: 'Tipo de compra', value: recurringPurchaseTypeMap[String(detailInvoice.purchaseType || 'INVENTORY').toUpperCase()] || detailInvoice.purchaseType || 'Inventario' },
               { label: 'Frecuencia', value: freqMap[String(detailInvoice.frequency || '').toLowerCase()] || detailInvoice.frequency || '—' },
             ],
             metadata: [
               { label: 'Proveedor', value: detailInvoice.supplier?.name || 'No disponible' },
               { label: 'Bodega', value: detailInvoice.warehouse?.name || 'No disponible' },
               { label: 'Próxima emisión', value: detailInvoice.nextInvoiceDate ? new Date(detailInvoice.nextInvoiceDate).toLocaleDateString('es-NI') : 'No disponible' },
               { label: 'Entrega esperada', value: detailInvoice.expectedDelivery ? new Date(detailInvoice.expectedDelivery).toLocaleDateString('es-NI') : 'No disponible' },
               { label: 'Inicio', value: detailInvoice.startDate ? new Date(detailInvoice.startDate).toLocaleDateString('es-NI') : 'No disponible' },
               { label: 'Dirección', value: detailInvoice.address || 'No disponible' },
             ],
            lines: ((detailInvoice as any).items || []).map((item: any, index: number) => ({ id: String(item.id || index), description: item.description || 'Concepto sin descripción', quantity: Number(item.quantity || 0), unitPriceLabel: formatCurrentAmount(Number(item.unitPrice || 0), detailInvoice.currency || displayCurrency), totalLabel: formatCurrentAmount(Number(item.total || 0), detailInvoice.currency || displayCurrency), secondaryLabel: item.commercialNoteSnapshot ? `Nota: ${item.commercialNoteSnapshot}` : undefined })),
          } : null}
          entity="RECURRING_SUPPLIER_INVOICE"
          open={Boolean(detailInvoice)}
          onClose={() => setDetailInvoice(null)}
          extraActions={detailInvoice && (() => {
            const status = String(detailInvoice.status || '').toUpperCase();
            return <>
              {canPerform('PURCHASES_INVOICES_REC', 'edit') && ['ACTIVE', 'PAUSED'].includes(status) && <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs text-amber-600" onClick={() => void handleStatusAction(detailInvoice)}>{status === 'ACTIVE' ? <PauseCircle className="size-4" /> : <PlayCircle className="size-4" />} {status === 'ACTIVE' ? 'Pausar' : 'Activar'}</Button>}
              {canPerform('PURCHASES_INVOICES_REC', 'delete') && <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs text-rose-500" onClick={() => setPendingDeleteId(detailInvoice.id)}><Ban className="size-4" /> Anular</Button>}
            </>;
          })()}
          onDownloadPdf={(format) => detailInvoice ? void handleDownloadRecurringInvoicePdf(detailInvoice, format) : undefined}
        />
      </div>
    </div>
  );
}
