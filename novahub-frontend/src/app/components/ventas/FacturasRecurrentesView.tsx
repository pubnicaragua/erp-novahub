import { useEffect, useState } from 'react';
import { 
  RotateCcw, Plus, Search, TrendingUp, Clock, Calendar, Play, Pause, Eye, Trash2, ChevronLeft, FileDown
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { recurringInvoicesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { RecurringInvoice, Customer, Product, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateRecurringInvoicePDF } from '../../utils/pdfGenerator';
import { recurringExpensesService } from '../../services/finanzas.service';
import { PriceMissingBadge, SalesLinePriceListSelect } from './SalesLinePriceListSelect';
import { formatSalesAmount, getMissingSalesPriceMessage } from '../../utils/salesPriceList';
import { SalesIrSelector } from './SalesIrSelector';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import { SalesKpiCard } from './SalesKpiCard';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from '../compras/PurchaseAlertsButton';

interface FacturasRecurrentesViewProps {
  data: RecurringInvoice[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  products?: Product[];
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
  salesAlert?: PurchaseAlertDetail;
}

const statusOptions = [
  { label: 'Activa',     value: 'ACTIVE',  color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Pausada',    value: 'PAUSED',  color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Finalizada', value: 'EXPIRED', color: 'bg-muted/20 text-muted-foreground' },
];

const frequencyOptions = [
  { label: 'Semanal',    value: 'WEEKLY' },
  { label: 'Mensual',    value: 'MONTHLY' },
  { label: 'Trimestral', value: 'QUARTERLY' },
  { label: 'Anual',      value: 'YEARLY' },
];

const toIsoDate = (dateValue?: string) => {
  if (!dateValue) return '';
  return dateValue.includes('T') ? dateValue : new Date(dateValue).toISOString();
};

const toDateInputValue = (dateValue?: string) => {
  if (!dateValue) return '';
  return dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
};

const calculateNextInvoiceDate = (frequency: string, startDate: string) => {
  if (!startDate) return '';
  const base = new Date(startDate.includes('T') ? startDate : `${startDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  const next = new Date(base);
  switch ((frequency || '').toUpperCase()) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'MONTHLY':
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next.toISOString();
};

export function FacturasRecurrentesView({ data, loading, onRefresh, customers = [], products = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange, salesAlert }: FacturasRecurrentesViewProps) {
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, formatConvertedAmount, toBaseAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('sales-recurring-invoices-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE'>('ALL');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timeout = window.setTimeout(() => setHighlightedAlertId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedAlertId]);
  const [isCreating, setIsCreating] = useState(false);
  const [localRates, setLocalRates] = useState({ dRate: 0, tRate: 0, irRate: 0, irTaxId: '' });
  const [pricingMode, setPricingMode] = useState<'global' | 'individual'>('global');
  const productCatalog = products.filter((product) => product.itemType !== 'SERVICE');
  const serviceCatalog = products.filter((product) => product.itemType === 'SERVICE');
  const resolveItemType = (item: any) => String(item.itemType || (products.find((p) => p.id === item.productId)?.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT')).toUpperCase();
  const findProductForItem = (item: any) => products.find((product) => product.id === item?.productId)
    || products.find((product) => product.code && (product.code === item?.code || product.code === item?.productCode))
    || products.find((product) => String(product.name || '').trim().toLowerCase() === String(item?.description || '').trim().toLowerCase());
  const getItemCatalog = (item: any) => {
    const catalog = resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog;
    if (!item?.productId || catalog.some((product) => product.id === item.productId)) return catalog;
    const linkedProduct = findProductForItem(item);
    return [...catalog, linkedProduct || { id: item.productId, code: '', name: item.description || 'Artículo vinculado', itemType: item.itemType || 'PRODUCT' }];
  };

  const handleCatalogItemChange = (idx: number, value: string) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])] as any[];
    const itemType = resolveItemType(newItems[idx]);
    const catalog = itemType === 'SERVICE' ? serviceCatalog : productCatalog;
    const selectedProduct = catalog.find((product) => product.id === value);
    const baseSalePrice = Number(selectedProduct?.salePrice ?? selectedProduct?.price ?? 0);
    const unitPrice = localDoc.currency === 'USD' ? baseSalePrice / Number(localDoc.exchangeRate || globalRate || 1) : baseSalePrice;
    newItems[idx] = {
      ...newItems[idx],
      itemType,
      productId: value,
      serviceName: itemType === 'SERVICE' ? (selectedProduct?.name || newItems[idx].serviceName || '') : '',
      description: selectedProduct?.name || newItems[idx].description || '',
      unitPrice,
      total: Number(newItems[idx].quantity || 1) * unitPrice,
    };
    const calc = recalcTotals(newItems);
    setLocalDoc({ ...localDoc, ...calc, items: calc.items });
  };

  const handlePriceListChange = (idx: number, priceListId: string, result: { unitPrice?: number; priceMissing: boolean }) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])] as any[];
    newItems[idx] = {
      ...newItems[idx],
      priceListId,
      unitPrice: result.unitPrice ?? 0,
      priceMissing: result.priceMissing,
      total: Number(newItems[idx].quantity || 1) * Number(result.unitPrice ?? 0),
    };
    const calc = recalcTotals(newItems);
    setLocalDoc({ ...localDoc, ...calc, items: calc.items, priceListId });
  };

  const calculateRates = (doc: any) => {
    const subtotal = Number(doc?.subtotal || 0);
    const discountAmount = Number(doc?.discountAmount || 0);
    const base = subtotal - discountAmount;
    return {
      dRate: subtotal > 0 ? Math.round((discountAmount / subtotal) * 10000) / 100 : 0,
      tRate: base > 0 ? Math.round((Number(doc?.taxAmount || 0) / base) * 10000) / 100 : 0,
    };
  };

  const [prevEditingId, setPrevEditingId] = useState(editingId);
  if (editingId !== prevEditingId) {
    setPrevEditingId(editingId);
    if (editingId) {
      const r = data.find(x => x.id === editingId);
      if (r) {
        setLocalDoc(JSON.parse(JSON.stringify(r)));
        setLocalRates({ ...calculateRates(r), irRate: Number((r as any).irRate || 0), irTaxId: (r as any).irTaxId || '' });
        setPricingMode((r.items || []).some((item: any) => Number(item.discount || 0) > 0 || Number(item.taxRate || 0) > 0) ? 'individual' : 'global');
      }
    } else if (!isCreating) {
      setLocalDoc(null);
      setLocalRates({ dRate: 0, tRate: 0, irRate: 0, irTaxId: '' });
    }
  }

  const filtered = data.filter(r =>
    (statusFilter === 'ALL' || String(r.status || '').toUpperCase() === statusFilter) &&
    ((r as any).profileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleUpdate = async (id: string | number, updates: Partial<RecurringInvoice>) => {
    try {
      await recurringInvoicesService.update(id.toString(), updates);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar');
      throw e;
    }
  };

  const toggleStatus = async (row: RecurringInvoice) => {
    const statusToastId = toast.loading((row.status || '').toUpperCase() === 'ACTIVE' ? 'Pausando factura recurrente...' : 'Reanudando factura recurrente...');
    try {
      if ((row.status||'').toUpperCase() === 'ACTIVE') {
        await recurringInvoicesService.pause(row.id);
        toast.success('Factura recurrente pausada', { id: statusToastId });
      } else {
        await recurringInvoicesService.resume(row.id);
        toast.success('Factura recurrente reanudada', { id: statusToastId });
      }
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al cambiar estado', { id: statusToastId });
    }
  };

  const startNew = () => {
    setIsCreating(true);
    setEditingId(null);
    setLocalDoc({
      customerId: '',
      frequency: 'MONTHLY',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      nextInvoiceDate: calculateNextInvoiceDate('MONTHLY', new Date().toISOString().split('T')[0]),
      currency: displayCurrency === 'USD' ? 'USD' : 'NIO',
      exchangeRate: globalRate,
      items: [],
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      total: 0,
    });
    setLocalRates({ dRate: 0, tRate: 0, irRate: 0, irTaxId: '' });
    setPricingMode('global');
  };

  // Sync currency from topbar
  const handleExportPDF = async (row: RecurringInvoice) => {
    const pdfToastId = toast.loading('Generando PDF de la factura recurrente...');
    try {
      const tenantName = user?.tenantName || 'Mi Empresa';
      await generateRecurringInvoicePDF({
        recurringInvoice: { ...row, number: `REC-${row.id.slice(0, 8)}`, customer: row.customer },
        tenantName,
        formatAmount: formatConvertedAmount,
      });
      toast.success('PDF generado exitosamente', { id: pdfToastId });
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al generar PDF', { id: pdfToastId }); }
  };

  const recalcTotals = (items: any[], mode = pricingMode, rates = localRates) => {
    const normalizedItems = items.map((item: any) => {
      const gross = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      const discountRate = mode === 'individual' ? Math.min(100, Math.max(0, Number(item.discount || 0))) : 0;
      const taxRate = mode === 'individual' ? Math.max(0, Number(item.taxRate || 0)) : 0;
      const discount = gross * discountRate / 100;
      const tax = (gross - discount) * taxRate / 100;
      const irRate = mode === 'individual' ? Math.max(0, Number(item.irRate || 0)) : 0;
      const irAmount = (gross - discount) * irRate / 100;
      return { ...item, discount: discountRate, taxRate, irRate, irAmount, total: gross - discount + tax - irAmount };
    });
    const subtotal = normalizedItems.reduce((acc: number, it: any) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);
    const discountAmount = mode === 'global' ? subtotal * Number(rates.dRate || 0) / 100 : normalizedItems.reduce((acc: number, it: any) => {
      return acc + Number(it.quantity || 0) * Number(it.unitPrice || 0) * Number(it.discount || 0) / 100;
    }, 0);
    const base = subtotal - discountAmount;
    const taxAmount = mode === 'global' ? base * Number(rates.tRate || 0) / 100 : normalizedItems.reduce((acc: number, it: any) => {
      const gross = Number(it.quantity || 0) * Number(it.unitPrice || 0);
      return acc + (gross - gross * Number(it.discount || 0) / 100) * Number(it.taxRate || 0) / 100;
    }, 0);
    const irAmount = mode === 'global' ? base * Number(rates.irRate || 0) / 100 : normalizedItems.reduce((acc: number, it: any) => acc + Number(it.irAmount || 0), 0);
    return { items: normalizedItems, subtotal, discountAmount, taxAmount, irRate: Number(rates.irRate || 0), irAmount, total: base + taxAmount - irAmount };
  };

  const handleSave = async () => {
    if (!localDoc) return;
    if (!localDoc.customerId) { toast.error('Selecciona un cliente'); return; }
    const priceMessage = getMissingSalesPriceMessage(localDoc.items || []);
    if (priceMessage) { toast.error(priceMessage); return; }
    const saveToastId = toast.loading(isCreating ? 'Creando factura recurrente...' : 'Guardando cambios...');
    const normalizedStartDate = toIsoDate(localDoc.startDate);
    const normalizedEndDate = localDoc.endDate ? toIsoDate(localDoc.endDate) : undefined;
    const calculatedNextInvoiceDate = calculateNextInvoiceDate(localDoc.frequency, localDoc.startDate);
    const normalizedItems = (localDoc.items || []).map((item: any) => {
      const resolvedItemType = String(item.itemType || (item.productId ? 'PRODUCT' : 'SERVICE')).toUpperCase();
      return {
      productId: item.productId || undefined,
      priceListId: item.priceListId || undefined,
      itemType: resolvedItemType,
      serviceName: resolvedItemType === 'SERVICE' ? (item.serviceName || item.description || '') : undefined,
      description: item.description || item.serviceName || '',
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      total: Number(item.total || 0),
      taxRate: Number(item.taxRate || 0),
      discount: Number(item.discount || 0),
    };
    });

    try {
      if (isCreating) {
        const created = await recurringInvoicesService.create({
          customerId: localDoc.customerId,
          frequency: localDoc.frequency,
          startDate: normalizedStartDate,
          endDate: normalizedEndDate,
          nextInvoiceDate: calculatedNextInvoiceDate,
          currency: localDoc.currency,
          exchangeRate: localDoc.exchangeRate || globalRate,
          priceListId: localDoc.priceListId || undefined,
          items: normalizedItems,
          subtotal: localDoc.subtotal,
          discountAmount: localDoc.discountAmount,
          taxAmount: localDoc.taxAmount,
          total: localDoc.total,
          status: 'ACTIVE',
        } as any);

        try {
          const customerName = customers.find(c => c.id === localDoc.customerId)?.name || 'Cliente';
          const recurrentRef = `REC-${created.id?.slice?.(0, 8) || 'N/A'}`;
          await recurringExpensesService.create({
            description: `Factura recurrente ${recurrentRef} - ${customerName}`,
            category: 'VENTAS_RECURRENTE',
            frequency: String(localDoc.frequency || 'MONTHLY').toLowerCase(),
            startDate: normalizedStartDate,
            endDate: normalizedEndDate,
            nextDate: calculatedNextInvoiceDate,
            amount: Number(localDoc.total || 0),
            currency: localDoc.currency || 'NIO',
            exchangeRate: Number(localDoc.exchangeRate || globalRate),
            status: 'ACTIVE',
            sourceRecurringInvoiceId: created.id,
            sourceRecurringInvoiceRef: recurrentRef,
          } as any);
        } catch {
          toast.warning('Factura creada, pero no se pudo vincular automáticamente a Gastos Recurrentes');
        }
        toast.success('Factura recurrente creada', { id: saveToastId });
      } else {
        const { accountId: _ignoredAccountId, ...updatePayload } = localDoc;
        await handleUpdate(localDoc.id, {
          ...updatePayload,
          startDate: normalizedStartDate,
          endDate: normalizedEndDate,
          nextInvoiceDate: calculatedNextInvoiceDate,
          items: normalizedItems,
        } as any);
        toast.success('Factura recurrente actualizada', { id: saveToastId });
      }
      setIsCreating(false); setEditingId(null); setLocalDoc(null); onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'No se pudo guardar', { id: saveToastId }); }
  };

  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [y, m, d] = clean.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString();
  };

  const columns: ColumnDef<RecurringInvoice>[] = [
    { key: 'id', header: 'Referencia', width: '180px',
      render: (_, row) => (
        <span 
          className={cn(
            "text-xs font-black font-mono text-primary group-hover:underline",
            canPerform('SALES_RECURRING', 'edit') ? "cursor-pointer" : "cursor-default"
          )} 
          onClick={() => canPerform('SALES_RECURRING', 'edit') && setEditingId(row.id)}
        >
          Factura #{row.id.slice(0, 8)}
        </span>
      )
    },
    { key: 'customer', header: 'Cliente', render: (_, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Cliente'}</span> },
    { key: 'frequency', header: 'Frecuencia', width: '120px', editable: canPerform('SALES_RECURRING', 'edit'), type: 'select', options: frequencyOptions,
      render: (val) => { const freqMap: Record<string, string> = { WEEKLY: 'Semanal', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', YEARLY: 'Anual' };
        return <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border-none">{freqMap[(val||'').toUpperCase()] || val}</Badge>; } },
    { key: 'total', header: 'Monto Ciclo', width: '150px',
      render: (val, row) => (
        <span className="text-[13px] font-black tabular-nums text-foreground">
          {formatConvertedAmount(Number(val || 0), (row as any).currency, (row as any).exchangeRate)}
        </span>
      ) },
    { key: 'status', header: 'Estado', width: '110px', render: (val) => { const opt = statusOptions.find(o => o.value === (val||'').toUpperCase());
      return <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none", opt?.color || 'bg-muted/20 text-muted-foreground')}>{opt?.label || val}</Badge>; } },
    { key: 'nextInvoiceDate', header: 'Próxima Fecha', render: (val) => <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground"><Calendar className="size-3" />{formatDateSafe(val)}</div> },
  ];

  const activeRecurringInDisplayCurrency = data
    .filter(recurring => (recurring.status || '').toUpperCase() === 'ACTIVE')
    .reduce((acc, recurring) => acc + ((recurring as any).baseTotal !== null && (recurring as any).baseTotal !== undefined
      ? Number((recurring as any).baseTotal)
      : toBaseAmount(recurring.total || 0, (recurring as any).currency, (recurring as any).exchangeRate || globalRate)), 0);
  const sevenDaysAhead = new Date();
  sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingIn7Days = data.filter(recurring => {
    const status = (recurring.status || '').toUpperCase();
    if (status !== 'ACTIVE') return false;
    if (!recurring.nextInvoiceDate) return false;
    const nextDate = new Date(recurring.nextInvoiceDate);
    if (Number.isNaN(nextDate.getTime())) return false;
    return nextDate >= today && nextDate <= sevenDaysAhead;
  }).length;
  const annualRunRateInDisplayCurrency = activeRecurringInDisplayCurrency * 12;
  // ─── INLINE EDITOR ─────────────────────────────────────────────────────
  if ((editingId || isCreating) && localDoc) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300" data-tour="sales-form-title">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setIsCreating(false); setLocalDoc(null); }} className="rounded-full"><ChevronLeft className="size-5" /></Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Agregar Factura Recurrente' : `Factura #${localDoc.id?.slice(0, 8)}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{isCreating ? 'Configurar nueva factura recurrente' : 'Editar factura recurrente'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3" data-tour="sales-form-actions">
            <SalesViewTutorial view="recurring" context="form" />
            {canPerform('SALES_RECURRING', 'edit') && (
              <>
                {!isCreating && <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={async () => { try { await recurringInvoicesService.delete(localDoc.id); setEditingId(null); onRefresh(); } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar'); } }}><Trash2 className="size-3 mr-2" /> Eliminar</Button>}
                <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6" onClick={handleSave}>
                  Guardar Factura Recurrente
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50" data-tour="sales-form-data">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Datos de Factura Recurrente</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox 
                    options={(customers || [])
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))} 
                    value={localDoc?.customerId || ''} 
                    onChange={(val) => { const customer = customers?.find((entry) => entry.id === val); const priceListId = customer?.priceListId || null; const items = (localDoc?.items || []).map((item: any) => item.productId ? { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false } : { ...item, priceListId }); setLocalDoc({ ...localDoc, customerId: val, priceListId, items }); }}
                    placeholder="Seleccionar Cliente" 
                  /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Frecuencia</p>
                  <select
                    value={localDoc?.frequency || 'MONTHLY'}
                    onChange={(e) => {
                      const newFrequency = e.target.value;
                      const nextInvoiceDate = calculateNextInvoiceDate(newFrequency, localDoc?.startDate || '');
                      setLocalDoc({ ...localDoc, frequency: newFrequency, nextInvoiceDate });
                    }}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                  >
                    {frequencyOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Fecha Inicio</p>
                  <Input
                    type="date"
                    value={toDateInputValue(localDoc?.startDate)}
                    onChange={(e) => {
                      const newStartDate = e.target.value;
                      const nextInvoiceDate = calculateNextInvoiceDate(localDoc?.frequency || 'MONTHLY', newStartDate);
                      setLocalDoc({ ...localDoc, startDate: newStartDate, nextInvoiceDate });
                    }}
                    className="h-8 text-xs"
                  /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Fecha Fin (Opcional)</p>
                  <Input type="date" value={toDateInputValue(localDoc?.endDate)} onChange={(e) => setLocalDoc({ ...localDoc, endDate: e.target.value })} className="h-8 text-xs" /></div>
                <div className="col-span-2"><p className="text-[10px] text-muted-foreground mb-1">Próxima Fecha de Facturación (calculada)</p>
                  <Input value={formatDateSafe(localDoc?.nextInvoiceDate || '')} disabled className="h-8 text-xs font-bold bg-muted/20" /></div>
                <div className="col-span-2"><p className="text-[10px] text-muted-foreground mb-1">Moneda de la transacción</p>
                  <Select value={localDoc?.currency || 'NIO'} onValueChange={(currency) => {
                    const exchangeRate = currency === 'NIO' ? 1 : Number(globalRate || 1);
                    const previousCurrency = localDoc?.currency || 'NIO';
                    const previousRate = previousCurrency === 'NIO' ? 1 : Number(localDoc?.exchangeRate || globalRate || 1);
                    const convertedItems = (localDoc?.items || []).map((item: any) => {
                      const basePrice = previousCurrency === 'USD' ? Number(item.unitPrice || 0) * previousRate : Number(item.unitPrice || 0);
                      return { ...item, unitPrice: currency === 'USD' ? basePrice / exchangeRate : basePrice };
                    });
                    const calc = recalcTotals(convertedItems);
                    setLocalDoc({ ...localDoc, currency, exchangeRate, ...calc });
                  }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar moneda" /></SelectTrigger>
                    <SelectContent><SelectItem value="NIO">Córdobas (C$)</SelectItem><SelectItem value="USD">Dólares (US$)</SelectItem></SelectContent>
                  </Select>
                  <p className="mt-1 text-[10px] text-muted-foreground/70">Tasa configurada: <span className="font-bold">{localDoc?.currency === 'NIO' ? '1.00' : Number(localDoc?.exchangeRate || globalRate || 1).toFixed(2)}</span></p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50" data-tour="sales-form-summary">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen por Ciclo</p>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/10 p-2 text-[10px] font-black uppercase tracking-widest">
                <span className="text-muted-foreground">Aplicar impuestos/descuentos:</span>
                <Button type="button" size="sm" variant={pricingMode === 'global' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => {
                  const nextMode = 'global';
                  setPricingMode(nextMode);
                  setLocalDoc({ ...localDoc, ...recalcTotals(localDoc.items || [], nextMode) });
                }}>Global</Button>
                <Button type="button" size="sm" variant={pricingMode === 'individual' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => {
                  const nextMode = 'individual';
                  setPricingMode(nextMode);
                  setLocalDoc({ ...localDoc, ...recalcTotals(localDoc.items || [], nextMode) });
                }}>Por producto</Button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-black">{formatConvertedAmount(Number(localDoc?.subtotal || 0), localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}</span></div>
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Descuento</span><div className="flex items-center gap-2 text-rose-500">
                  {pricingMode === 'global' && <><Input type="number" min="0" max="100" value={localRates.dRate || ''} onChange={(event) => {
                    const dRate = Math.min(100, Math.max(0, Number(event.target.value) || 0));
                    setLocalRates((prev) => ({ ...prev, dRate }));
                    setLocalDoc({ ...localDoc, ...recalcTotals(localDoc.items || [], 'global', { ...localRates, dRate }) });
                  }} className="h-8 w-16 text-right text-xs" /><span>%</span></>}
                  - {formatConvertedAmount(Number(localDoc?.discountAmount || 0), localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}
                </div></div>
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">IVA</span><div className="flex items-center gap-2">
                  {pricingMode === 'global' && <label className="flex h-8 items-center gap-1.5 rounded-md bg-muted/30 px-2 text-xs font-black"><input type="checkbox" checked={Number(localRates.tRate || 0) > 0} onChange={(event) => {
                    const tRate = event.target.checked ? 15 : 0;
                    setLocalRates((prev) => ({ ...prev, tRate }));
                    setLocalDoc({ ...localDoc, ...recalcTotals(localDoc.items || [], 'global', { ...localRates, tRate }) });
                  }} /> Aplicar 15%</label>}
                  {formatConvertedAmount(Number(localDoc?.taxAmount || 0), localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}
                </div></div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50"><span className="font-black">Total por Ciclo</span>
                  <span className="text-primary font-black text-lg">{formatConvertedAmount(Number(localDoc?.total || 0), localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50" data-tour="sales-form-items">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos / Servicios</p>
              <div className="flex flex-wrap gap-2">
              {(['PRODUCT', 'SERVICE'] as const).map((itemType) => <Button key={itemType} type="button" variant="outline" size="sm" onClick={() => {
                const newItems = [...(localDoc.items || []), { id: Date.now().toString(), itemType, productId: '', serviceName: '', description: '', quantity: 1, unitPrice: 0, taxRate: 0, discount: 0, total: 0 }];
                setLocalDoc({ ...localDoc, items: newItems });
              }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/20"><Plus className="size-3 mr-2" /> Agregar {itemType === 'PRODUCT' ? 'Producto' : 'Servicio'}</Button>)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="hidden xl:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className={cn('col-span-4', pricingMode === 'individual' && 'col-span-3')}>Producto / Servicio</div>{pricingMode === 'individual' && <div className="col-span-2 flex gap-1.5"><span className="flex-1">Aplicar</span><span className="flex-1 text-right">Desc.</span></div>}<div className={cn('col-span-2 text-right', pricingMode === 'individual' && 'xl:col-span-1')}>Cant.</div><div className={cn('col-span-2 text-right', pricingMode === 'individual' && 'xl:col-span-1')}>Precio U.</div>{pricingMode === 'individual' && <div className="col-span-2 text-right xl:col-span-1">IVA</div>}<div className={cn('col-span-2 text-right', pricingMode === 'individual' && 'xl:col-span-1')}>Total</div><div className="col-span-1"></div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} data-item-layout="recurrent" className="sales-item-row grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 items-start xl:grid-cols-12 xl:gap-2 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0">
                  <div className={cn('min-w-0 xl:col-span-4', pricingMode === 'individual' && 'xl:col-span-3')}>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Combobox
                          options={getItemCatalog(item).map((product: any) => ({
                            label: `${String(product.itemType || resolveItemType(item)).toUpperCase() === 'SERVICE' ? 'Servicio' : 'Producto'} · ${product.code || ''} - ${product.name}`,
                            value: product.id,
                          }))}
                          value={item.productId || ''}
                          onChange={(value) => handleCatalogItemChange(idx, value)}
                          placeholder={resolveItemType(item) === 'SERVICE' ? 'Seleccionar servicio...' : 'Seleccionar producto...'}
                        />
                      </div>
                      <SalesLinePriceListSelect
                        productId={item.productId}
                        productCode={findProductForItem(item)?.code || item.code}
                        productName={item.description}
                        itemType={item.itemType}
                        value={item.priceListId}
                        defaultPriceListId={localDoc?.priceListId}
                        currency={localDoc?.currency}
                        exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)}
                        onChange={(priceListId, result) => handlePriceListChange(idx, priceListId, result)}
                      />
                    </div>
                    {item.priceMissing && <PriceMissingBadge className="mt-1" />}
                  </div>
                  {pricingMode === 'individual' && <div className="col-span-2 flex min-w-0 flex-wrap items-start gap-1.5 text-[10px] xl:col-span-2">
                    <label className="flex h-9 items-center gap-1 rounded-md bg-muted/30 px-2 font-black"><input type="checkbox" checked={Number(item.taxRate || 0) > 0} onChange={(event) => {
                      const ni = [...(localDoc.items || [])];
                      ni[idx] = { ...ni[idx], taxRate: event.target.checked ? 15 : 0 };
                      const recalculated = recalcTotals(ni, 'individual');
                      setLocalDoc({ ...localDoc, ...recalculated });
                      if (!isCreating) void handleUpdate(localDoc!.id, recalculated as any);
                    }} /> IVA 15%</label>
                    <div className="relative min-w-0 flex-1">
                      <Input type="number" min="0" max="100" value={item.discount || ''} onChange={(event) => {
                        const ni = [...(localDoc.items || [])];
                        ni[idx] = { ...ni[idx], discount: Math.min(100, Math.max(0, Number(event.target.value) || 0)) };
                        const recalculated = recalcTotals(ni, 'individual');
                        setLocalDoc({ ...localDoc, ...recalculated });
                        if (!isCreating) void handleUpdate(localDoc!.id, recalculated as any);
                      }} className="w-full pr-6 text-left text-xs" />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                    </div>
                    <SalesIrSelector value={item.irTaxId} rate={Number(item.irRate || 0)} compact onChange={(option) => { const ni = [...(localDoc.items || [])] as any[]; ni[idx] = { ...ni[idx], irRate: Number(option?.rate || 0), irTaxId: option?.id || null }; const recalculated = recalcTotals(ni, 'individual'); setLocalDoc({ ...localDoc, ...recalculated }); }} />
                  </div>}
                  <div className={cn("col-span-2", pricingMode === 'individual' && "xl:col-span-1")}><Input type="number" min="0" value={Number(item.quantity) || ''} onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx] = { ...ni[idx], quantity: Number(e.target.value), total: Number(e.target.value) * Number(ni[idx].unitPrice || 0) };
                      const calc = recalcTotals(ni); setLocalDoc({ ...localDoc, ...calc }); }} /></div>
                  <div className={cn("col-span-2", pricingMode === 'individual' && "xl:col-span-1")}><Input type="text" value={item.unitPrice === undefined || item.unitPrice === null ? '' : formatSalesAmount(item.unitPrice)} readOnly className="bg-muted/20 text-right" onChange={(e) => {
                    const ni = [...(localDoc.items || [])]; ni[idx] = { ...ni[idx], unitPrice: Number(e.target.value), total: Number(ni[idx].quantity || 1) * Number(e.target.value) };
                      const calc = recalcTotals(ni); setLocalDoc({ ...localDoc, ...calc }); }} /></div>
                  {pricingMode === 'individual' && (
                    <div className="col-span-2 flex items-center justify-end xl:col-span-1">
                      <Input
                        type="text"
                        readOnly
                        value={formatSalesAmount(((Number(item.quantity || 0) * Number(item.unitPrice || 0)) - (Number(item.quantity || 0) * Number(item.unitPrice || 0) * Number(item.discount || 0) / 100)) * Number(item.taxRate || 0) / 100)}
                        className="h-8 w-16 border-none bg-transparent px-0 text-right text-xs font-black shadow-none focus-visible:ring-0 focus-visible:border-transparent"
                      />
                    </div>
                  )}
                  <div className={cn("col-span-2 text-right", pricingMode === 'individual' && "xl:col-span-1")}><span className="text-sm font-black">{formatConvertedAmount(Number(item.total || 0), localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}</span></div>
                  <div className="col-span-1 flex justify-end"><Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md"
                    onClick={() => { const ni = [...(localDoc.items || [])]; ni.splice(idx, 1); const calc = recalcTotals(ni); setLocalDoc({ ...localDoc, ...calc }); }}><Trash2 className="size-3" /></Button></div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">Sin ítems. Haz clic en "Agregar Item".</div>}
            </div>
          </CardContent>
        </Card>
  
      
    </div>
  );
}

  // ─── TABLE VIEW ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="sales-list-kpis">
        <SalesKpiCard title={`MRR Activo (${displayCurrency})`} value={formatConvertedAmount(activeRecurringInDisplayCurrency, baseCurrency)} icon={RotateCcw} color="text-primary" bg="bg-primary/10" />
        <SalesKpiCard title="Próximas 7 días" value={upcomingIn7Days} icon={Calendar} color="text-blue-500" bg="bg-blue-500/10" />
        <SalesKpiCard title="Activas" value={data.filter(r => (r.status||'').toUpperCase() === 'ACTIVE').length} icon={Clock} color="text-emerald-500" bg="bg-emerald-500/10" active={statusFilter === 'ACTIVE'} onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE')} />
        <SalesKpiCard title={`ARR (${displayCurrency})`} value={formatConvertedAmount(annualRunRateInDisplayCurrency, baseCurrency)} icon={TrendingUp} color="text-rose-500" bg="bg-primary/10" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div><h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Facturación Recurrente</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión de contratos, igualas y servicios por suscripción.</p></div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="recurring" />
            <ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de facturas recurrentes" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar suscripción..." className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {salesAlert && <PurchaseAlertsButton alert={salesAlert} sectionLabel="ventas" storageNamespace="erp-sales-alerts" onItemSelect={setHighlightedAlertId} />}
            {canPerform('SALES_RECURRING', 'create') && (
              <Button onClick={startNew} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Agregar Factura Recurrente</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered}
          pagination={pagination}
          onBulkDelete={async (ids) => { const deleteToastId = toast.loading(`Eliminando ${ids.length} factura${ids.length === 1 ? '' : 's'} recurrentes...`); try { for (const id of ids) { if (String(id).startsWith('new-')) continue; await recurringInvoicesService.delete(id as string); } toast.success('Eliminados', { id: deleteToastId }); onRefresh(); } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar', { id: deleteToastId }); } }}
          columns={columns} onRowUpdate={handleUpdate} onRowClick={(row) => setEditingId(row.id)} isLoading={loading} actionsWidth="w-28" fitContent showHorizontalControls
          layoutMode={layoutMode}
          highlightedRowId={highlightedAlertId}
          actions={(row) => (
            <div className="flex items-center gap-1">
               {canPerform('SALES_RECURRING', 'edit') && (
                 (row.status||'').toUpperCase() === 'ACTIVE' ? (
                   <Button title="Pausar" onClick={() => toggleStatus(row)} variant="ghost" size="icon" className="size-8 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"><Pause className="size-4" /></Button>
                 ) : (
                   <Button title="Reanudar" onClick={() => toggleStatus(row)} variant="ghost" size="icon" className="size-8 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"><Play className="size-4" /></Button>
                 )
               )}
               <Button title="PDF" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => handleExportPDF(row)}><FileDown className="size-4" /></Button>
               <Button title="Ver detalle" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
               {canPerform('SALES_RECURRING', 'delete') && (
                 <Button variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
               )}
            </div>
          )}
        />
      </div>
      <ConfirmDialog
              open={pendingDeleteId !== null}
              onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
              title={"¿Eliminar factura recurrente?"}
              description="¿Estás seguro de que deseas eliminar esta factura recurrente? Esta acción no se puede deshacer."
              confirmLabel="Eliminar"
              variant="destructive"
              loading={deleteLoading}
              onConfirm={async () => {
                if (!pendingDeleteId) return;
                const deleteToastId = toast.loading('Eliminando factura recurrente...');
                try {
                  setDeleteLoading(true);
                  await recurringInvoicesService.delete(pendingDeleteId);
                  toast.success('Factura recurrente eliminada', { id: deleteToastId });
                  setEditingId(null);
                  onRefresh();
                } catch (error: any) {
                   const msg = error?.response?.data?.message || error?.message || '';
                  if (msg.includes('foreign') || msg.includes('constraint') || msg.includes('reference') || error?.status === 409) {
                    toast.error('No se puede eliminar: tiene dependencias en el sistema.', { id: deleteToastId });
                  } else {
                    toast.error(`Error al eliminar: ${msg || 'Error desconocido'}`, { id: deleteToastId });
                  }
                } finally {
                  setDeleteLoading(false);
                  setPendingDeleteId(null);
                }
              }}
            />

    </div>
  );
}

