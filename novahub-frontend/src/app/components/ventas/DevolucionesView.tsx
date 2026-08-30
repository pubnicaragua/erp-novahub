import { useEffect, useRef, useState } from 'react';
import { 
  FileOutput, Plus, Search, Clock, CheckCircle2, XCircle, Eye, Trash2, ChevronLeft, ShieldCheck
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { salesReturnsService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { SalesReturn, Customer, Invoice, Product, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { previewSalesTransactionPDF } from '../../utils/pdfGenerator';
import { SalesAccountingLegend } from './SalesAccountingLegend';
import { getMissingSalesPriceMessage, hasSalesProductPriceListConflicts } from '../../utils/salesPriceList';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { SalesKpiCard } from './SalesKpiCard';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from '../compras/PurchaseAlertsButton';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { SALES_STATUS_COLORS, SALES_WORKFLOW_STATUS_COLORS } from '../../utils/salesStatus';
import { SalesDocumentDetailSheet, type SalesDocumentPanelData } from './SalesDocumentDetailSheet';
import { SalesWarehouseSelect, getDefaultSalesWarehouseId } from './SalesWarehouseSelect';
import { clearSalesEditorDraft, getSalesEditorDraftKey, readSalesEditorDraft, writeSalesEditorDraft } from '../../services/sales-draft-storage';
import { summarizeAmountsByCurrency } from '../../utils/currency';

const toWholeQuantity = (value: string | number, max?: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const whole = Math.max(0, Math.trunc(parsed));
  return max === undefined ? whole : Math.min(Math.floor(max), whole);
};

const roundMoney = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(2));

const allocateInvoiceAmount = (target: number, rows: any[], valueKey: string, basisKey: string) => {
  if (!rows.length) return [];
  const targetAmount = roundMoney(target);
  const baseline = rows.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);
  const basisTotal = rows.reduce((sum, row) => sum + Math.max(0, Number(row[basisKey] || 0)), 0);
  const delta = targetAmount - baseline;
  let allocated = 0;
  return rows.map((row, index) => {
    if (index === rows.length - 1) return roundMoney(targetAmount - allocated);
    const weight = basisTotal > 0 ? Math.max(0, Number(row[basisKey] || 0)) / basisTotal : 1 / rows.length;
    const amount = roundMoney(Number(row[valueKey] || 0) + delta * weight);
    allocated = roundMoney(allocated + amount);
    return amount;
  });
};

const buildInvoiceReturnItems = (invoice?: Invoice | null) => {
  const invoiceItems = invoice?.items || [];
  const rows = invoiceItems.map((source: any) => {
    const originalQuantity = toWholeQuantity(source.quantity || 0);
    const unitPrice = Number(source.unitPrice || 0);
    const gross = roundMoney(originalQuantity * unitPrice);
    const discountRate = Number(source.discount || 0);
    const taxRate = Number(source.taxRate || 0);
    const itemDiscount = roundMoney(gross * discountRate / 100);
    const net = roundMoney(Math.max(0, gross - itemDiscount));
    const itemTax = roundMoney(net * taxRate / 100);
    return { source, originalQuantity, unitPrice, gross, discountRate, taxRate, irRate: 0, itemDiscount, net, itemTax, itemIr: 0 };
  });
  const discounts = allocateInvoiceAmount(Number(invoice?.discountAmount || 0), rows, 'itemDiscount', 'gross');
  const taxes = allocateInvoiceAmount(Number(invoice?.taxAmount || 0), rows, 'itemTax', 'net');
  const irAmounts = allocateInvoiceAmount(0, rows, 'itemIr', 'net');
  const pricedRows = rows.map((row, index) => ({
    ...row,
    sourceDiscountAmount: discounts[index] || 0,
    sourceTaxAmount: taxes[index] || 0,
    sourceIrAmount: irAmounts[index] || 0,
    sourceLineTotal: roundMoney(row.gross - (discounts[index] || 0) + (taxes[index] || 0)),
  }));
  if (pricedRows.length) {
    const difference = roundMoney(Number(invoice?.total || 0) - pricedRows.reduce((sum, row) => sum + row.sourceLineTotal, 0));
    pricedRows[pricedRows.length - 1].sourceLineTotal = roundMoney(pricedRows[pricedRows.length - 1].sourceLineTotal + difference);
  }
  return pricedRows.map((row) => {
    const itemType = String(row.source.itemType || '').toUpperCase() === 'SERVICE' ? 'SERVICE' : 'PRODUCT';
    return {
      id: row.source.id,
      invoiceItemId: row.source.id,
      itemType,
      productId: row.source.productId || '',
      description: row.source.description || '',
      originalQuantity: row.originalQuantity,
      quantity: row.originalQuantity,
      quantityToInventory: itemType === 'SERVICE' ? 0 : row.originalQuantity,
      quantityDiscarded: itemType === 'SERVICE' ? row.originalQuantity : 0,
      discardReason: itemType === 'SERVICE' ? 'Servicio no inventariable' : '',
      unitPrice: row.unitPrice,
      taxRate: row.taxRate,
      discount: row.discountRate,
      irRate: row.irRate,
      irTaxId: row.source.irTaxId || undefined,
      priceListId: row.source.priceListId || undefined,
      total: row.sourceLineTotal,
      sourceSubtotal: row.gross,
      sourceDiscountAmount: row.sourceDiscountAmount,
      sourceTaxAmount: row.sourceTaxAmount,
      sourceIrAmount: row.sourceIrAmount,
      sourceLineTotal: row.sourceLineTotal,
    };
  });
};

const returnTotalsFor = (items: any[], invoice?: Invoice | null) => {
  const rows = items.reduce((acc, item) => ({
    subtotal: roundMoney(acc.subtotal + Number(item.sourceSubtotal || 0) * (Number(item.quantity || 0) / Math.max(1, Number(item.originalQuantity || item.quantity || 1)))),
    discountAmount: roundMoney(acc.discountAmount + Number(item.sourceDiscountAmount || 0) * (Number(item.quantity || 0) / Math.max(1, Number(item.originalQuantity || item.quantity || 1)))),
    taxAmount: roundMoney(acc.taxAmount + Number(item.sourceTaxAmount || 0) * (Number(item.quantity || 0) / Math.max(1, Number(item.originalQuantity || item.quantity || 1)))),
    irAmount: 0,
    total: roundMoney(acc.total + Number(item.total || 0)),
  }), { subtotal: 0, discountAmount: 0, taxAmount: 0, irAmount: 0, total: 0 });
  const isFull = Boolean(invoice?.items?.length)
    && invoice.items.length === items.length
    && items.every((item) => Number(item.quantity || 0) >= Number(item.originalQuantity || item.quantity || 0));
  return isFull && invoice
    ? { subtotal: Number(invoice.subtotal || rows.subtotal), discountAmount: Number(invoice.discountAmount || 0), taxAmount: Number(invoice.taxAmount || 0), irAmount: 0, total: Number(invoice.total || 0) }
    : rows;
};

interface DevolucionesViewProps {
  data: SalesReturn[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  invoices?: Invoice[];
  products?: Product[];
  warehouses?: any[];
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
  salesAlert?: PurchaseAlertDetail;
}

const statusOptions = [
  { label: 'Pendiente',  value: 'PENDING',   color: SALES_STATUS_COLORS.PENDING },
  { label: 'Aprobada',   value: 'APPROVED',  color: SALES_WORKFLOW_STATUS_COLORS.APPROVED },
  { label: 'Aplicada',   value: 'PROCESSED', color: SALES_STATUS_COLORS.PROCESSED },
  { label: 'Rechazada',  value: 'REJECTED',  color: SALES_STATUS_COLORS.REJECTED },
];

export function DevolucionesView({ data, loading, onRefresh, customers = [], invoices = [], products = [], warehouses = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange, salesAlert }: DevolucionesViewProps) {
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, displayMode, formatConvertedAmount, formatExplicitAmount, toBaseAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const salesDraftStorageKey = getSalesEditorDraftKey('sales-return', user?.tenantId, user?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('sales-returns-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'PROCESSED' | 'REJECTED'>('ALL');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [detailReturn, setDetailReturn] = useState<SalesReturn | null>(null);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timeout = window.setTimeout(() => setHighlightedAlertId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedAlertId]);
  const resolveItemType = (item: any) => item.itemType || (products.find((p) => p.id === item.productId)?.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT');
  const [isCreating, setIsCreating] = useState(false);
  const localDocRef = useRef<any>(null);
  const hydratedDraftKeyRef = useRef<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const commitLocalDoc = (nextDoc: any) => {
    localDocRef.current = nextDoc;
    setLocalDoc(nextDoc);
  };

  useEffect(() => {
    localDocRef.current = localDoc;
  }, [localDoc]);

  useEffect(() => {
    if (!salesDraftStorageKey || hydratedDraftKeyRef.current === salesDraftStorageKey) return;
    hydratedDraftKeyRef.current = salesDraftStorageKey;
    const stored = readSalesEditorDraft<any>(salesDraftStorageKey);
    const timer = window.setTimeout(() => {
      if (stored) {
        if (stored.document) commitLocalDoc(stored.document);
        if (stored.editingId) setEditingId(stored.editingId);
        setIsCreating(Boolean(stored.isCreating));
      }
      setDraftHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [salesDraftStorageKey]);

  useEffect(() => {
    if (!draftHydrated || !salesDraftStorageKey) return;
    if (!localDoc || (!editingId && !isCreating)) {
      clearSalesEditorDraft(salesDraftStorageKey);
      return;
    }
    writeSalesEditorDraft(salesDraftStorageKey, { editingId, isCreating, document: localDoc });
  }, [draftHydrated, editingId, isCreating, localDoc, salesDraftStorageKey]);

  const startEdit = (id: string) => {
    const r = data.find(x => x.id === id);
    if (!r) return;
    setEditingId(id);
    setIsCreating(false);
    commitLocalDoc(JSON.parse(JSON.stringify(r)));
  };

  const closeEditor = () => {
    clearSalesEditorDraft(salesDraftStorageKey);
    localDocRef.current = null;
    setEditingId(null);
    setIsCreating(false);
    commitLocalDoc(null);
  };

  const filtered = data.filter(r =>
    (statusFilter === 'ALL' || String(r.status || '').toUpperCase() === statusFilter) &&
    (r.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const colFilters = useColumnFilters();
  const filterGetters = {
    customer: (row: SalesReturn) => row.customer?.name || 'Cliente',
    date: (row: SalesReturn) => (row.date ? new Date(row.date).getTime() : null),
    total: (row: SalesReturn) => Number(row.total || 0),
    status: (row: SalesReturn) => String(row.status || '').toUpperCase(),
  };
  const filteredData = colFilters.applyTo(filtered, filterGetters);
  const distinctCustomers = [...new Map(filtered.map((r) => [r.customer?.name || 'Cliente', r.customer?.name || 'Cliente'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filtered.filter((r) => (r.customer?.name || 'Cliente') === label).length }));
  const statusOptionsForFilter = statusOptions.map((option) => ({ value: option.value, label: option.label, count: filtered.filter((r) => String(r.status || '').toUpperCase() === option.value).length }));

  const startNew = () => {
    clearSalesEditorDraft(salesDraftStorageKey);
    setIsCreating(true);
    setEditingId(null);
    commitLocalDoc({
      customerId: '',
      invoiceId: '',
      date: new Date().toISOString().split('T')[0],
      reason: '',
      items: [],
      total: 0,
      currency: displayCurrency,
      exchangeRate: globalRate,
      warehouseId: getDefaultSalesWarehouseId(warehouses) || null,
    });
  };

  const selectedInvoice = localDoc?.invoiceId ? invoices.find((invoice) => invoice.id === localDoc.invoiceId) : undefined;
  const recalcTotal = (items: any[], invoice: Invoice | null | undefined = selectedInvoice) => returnTotalsFor(items, invoice).total;
  const isReturnPartial = (record: SalesReturn) => Boolean(record.isPartial ?? record.items?.some((item) =>
    Number(item.quantity || 0) + 0.0001 < Number(item.originalQuantity || item.quantity || 0),
  ));

  const handleSave = async () => {
    if (!localDoc) return;
    if (!localDoc.customerId) { toast.error('Selecciona un cliente'); return; }
    if (!localDoc.invoiceId) { toast.error('Selecciona la factura de origen'); return; }
    if (!localDoc.reason.trim()) { toast.error('Ingresa la razón de la nota de crédito'); return; }
    if (!localDoc.items?.length) { toast.error('La factura no tiene líneas para devolver'); return; }
    const priceMessage = getMissingSalesPriceMessage(localDoc.items || []);
    if (priceMessage) { toast.error(priceMessage); return; }
    const returnTotals = returnTotalsFor(localDoc.items || [], selectedInvoice);
    const saveToastId = toast.loading(isCreating ? 'Creando nota de crédito...' : 'Guardando nota de crédito...');
    try {
      const payload: any = {
        customerId: localDoc.customerId,
        invoiceId: localDoc.invoiceId,
        date: new Date(localDoc.date).toISOString(),
        reason: localDoc.reason.trim(),
        items: (localDoc.items || []).map((item: any) => ({
          invoiceItemId: item.invoiceItemId || undefined,
          productId: item.productId || undefined,
          description: item.description || '',
          commercialNoteSnapshot: item.commercialNoteSnapshot || null,
          quantity: toWholeQuantity(item.quantity || 1),
          originalQuantity: toWholeQuantity(item.originalQuantity || item.quantity || 1),
          quantityToInventory: toWholeQuantity(item.quantityToInventory || 0),
          quantityDiscarded: toWholeQuantity(item.quantityDiscarded || 0),
          discardReason: item.discardReason || undefined,
          unitPrice: Number(item.unitPrice || 0),
          taxRate: Number(item.taxRate || 0),
          discount: Number(item.discount || 0),
          irRate: 0,
          irTaxId: undefined,
          priceListId: item.priceListId || undefined,
          total: Number(item.total || 0),
        })),
        ...returnTotals,
        status: localDoc.status || 'PENDING',
        currency: localDoc.currency || displayCurrency,
        exchangeRate: localDoc.exchangeRate || globalRate,
        warehouseId: localDoc.warehouseId || selectedInvoice?.warehouseId || null,
        priceListId: localDoc.priceListId || undefined,
      };
      if (isCreating) {
        await salesReturnsService.create(payload);
        toast.success('Nota de crédito registrada', { id: saveToastId });
      } else {
        await salesReturnsService.update(localDoc.id, payload);
      }
      clearSalesEditorDraft(salesDraftStorageKey);
      localDocRef.current = null;
      setIsCreating(false); setEditingId(null); commitLocalDoc(null); onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'No se pudo guardar', { id: saveToastId }); }
  };

  const handleExportPDF = async (row: SalesReturn, format: PdfDownloadFormat = 'configured') => {
    const previewToastId = toast.loading('Preparando la previsualización de la nota de crédito...');
    try {
      const tenantName = user?.sessionBranding?.name || user?.tenantName || 'Mi Empresa';
      await previewSalesTransactionPDF({
        document: { ...row, number: row.number, customer: row.customer },
        tenantName,
        formatAmount: formatConvertedAmount,
        tenantLogo: themeConfig?.logo,
        documentType: 'return',
        format,
      });
      toast.success('Previsualización abierta. Descargá el PDF desde el visor del navegador.', { id: previewToastId });
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'No se pudo abrir la previsualización', { id: previewToastId }); }
  };

  const buildReturnPanel = (row: SalesReturn): SalesDocumentPanelData => ({
    id: row.id,
    number: row.number,
    title: 'Nota de crédito',
    customerName: row.customer?.name || customers.find((customer) => customer.id === row.customerId)?.name || 'Cliente',
    status: String(row.status || ''),
    sourceLabel: row.invoice?.number ? `Factura origen: ${row.invoice.number}` : undefined,
    totalLabel: formatConvertedAmount(Number(row.total || 0), row.currency, row.exchangeRate),
    sourceCurrency: row.currency,
    sourceExchangeRate: row.exchangeRate,
    summaryDetails: [
      { label: 'Tipo', value: isReturnPartial(row) ? 'Parcial' : 'Total' },
      { label: 'Moneda', value: row.currency || 'NIO' },
    ],
    metadata: [
      { label: 'Fecha', value: formatDateEs(row.date) },
      { label: 'Factura origen', value: row.invoice?.number || 'No disponible' },
    ],
    lines: (row.items || []).map((item) => ({
      id: item.id,
      description: item.description,
      secondaryLabel: item.commercialNoteSnapshot ? `Nota: ${item.commercialNoteSnapshot}` : undefined,
      quantity: Number(item.quantity || 0),
      unitPriceLabel: formatConvertedAmount(Number(item.unitPrice || 0), row.currency, row.exchangeRate),
      totalLabel: formatConvertedAmount(Number(item.total || 0), row.currency, row.exchangeRate),
    })),
    reason: row.reason,
  });

  const handleApprove = async (id: string) => {
    const approveToastId = toast.loading('Aprobando nota de crédito...');
    try {
      await salesReturnsService.approve(id);
      toast.success('Nota de crédito aprobada; lista para aplicar', { id: approveToastId });
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al aprobar', { id: approveToastId }); }
  };

  const handleProcess = async (id: string) => {
    const processToastId = toast.loading('Aplicando saldo y actualizando inventario...');
    try {
      await salesReturnsService.process(id);
      toast.success('Nota de crédito aplicada; inventario y saldo actualizados', { id: processToastId });
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al aplicar la nota de crédito', { id: processToastId }); }
  };

  // Get invoices for selected customer
  const customerInvoices = localDoc?.customerId
    ? invoices.filter(i => i.customerId === localDoc.customerId && !['DRAFT', 'CANCELLED', 'VOIDED'].includes(String(i.status || '').toUpperCase()))
    : [];

  const columns: ColumnDef<SalesReturn>[] = [
    { key: 'number', header: 'N° Devolución', width: '140px',
      render: (val, row) => (
        <span 
          className={cn(
            "text-xs font-black font-mono text-primary",
            canPerform('SALES_RETURNS', 'edit') ? "cursor-pointer hover:underline" : "cursor-default"
          )} 
          onClick={() => setDetailReturn(row)}
        >
          {val}
        </span>
      )
    },
    { key: 'customer', header: 'Cliente', headerExtra: <ColumnFilterMenu label="Cliente" options={distinctCustomers} selected={colFilters.state.customer?.values || []} onSelect={(values) => colFilters.setValues('customer', values)} sort={colFilters.state.customer?.sort || null} onSort={(sort) => colFilters.setSort('customer', sort)} />, render: (_, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Cliente'}</span> },
    { key: 'invoice', header: 'Factura Origen', render: (_, row) => <span className="text-xs font-bold text-blue-500">{row.invoice?.number || 'N/A'}</span> },
    { key: 'date', header: 'Fecha', headerExtra: <ColumnFilterMenu label="Fecha" sort={colFilters.state.date?.sort || null} onSort={(sort) => colFilters.setSort('date', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} />, render: (val) => <span className="text-xs font-medium text-muted-foreground">{formatDateEs(val)}</span> },
    { key: 'total', header: 'Total', width: '130px', headerExtra: <ColumnFilterMenu label="Total" sort={colFilters.state.total?.sort || null} onSort={(sort) => colFilters.setSort('total', sort)} />, render: (val, row) => <span className="text-[13px] font-black tabular-nums text-rose-500">{formatConvertedAmount(Number(val||0), (row as any).currency, (row as any).exchangeRate)}</span> },
    { key: 'status', header: 'Estado', width: '110px', headerExtra: <ColumnFilterMenu label="Estado" options={statusOptionsForFilter} selected={colFilters.state.status?.values || []} onSelect={(values) => colFilters.setValues('status', values)} sort={colFilters.state.status?.sort || null} onSort={(sort) => colFilters.setSort('status', sort)} />, render: (val) => {
      const opt = statusOptions.find(o => o.value === (val||'').toUpperCase());
      return <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none", opt?.color || 'bg-muted/20 text-muted-foreground')}>{opt?.label || val}</Badge>; } },
    { key: 'isPartial', header: 'Tipo', width: '95px', render: (_, row) => <Badge variant="outline" className={cn('border-none text-[9px] font-black uppercase', isReturnPartial(row) ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary')}>{isReturnPartial(row) ? 'Parcial' : 'Total'}</Badge> },
  ];

  const totalReturnedInDisplayCurrency = data.reduce(
    (acc, salesReturn) => acc + ((salesReturn as any).baseTotal !== null && (salesReturn as any).baseTotal !== undefined
      ? Number((salesReturn as any).baseTotal)
      : toBaseAmount(salesReturn.total || 0, (salesReturn as any).currency, (salesReturn as any).exchangeRate || globalRate)),
    0,
  );
  const originalReturnedAmounts = summarizeAmountsByCurrency(data, (salesReturn) => Number((salesReturn as any).total || 0), (salesReturn) => (salesReturn as any).currency, baseCurrency);

  // ─── INLINE FORM ────────────────────────────────────────────────────
  if ((editingId || isCreating) && localDoc) {
    const statusOpt = statusOptions.find(o => o.value === (localDoc?.status || '').toUpperCase());
    const canApprove = !isCreating && (localDoc?.status || '').toUpperCase() === 'PENDING' && canPerform('SALES_RETURNS', 'approve');
    const editorTotals = returnTotalsFor(localDoc.items || [], selectedInvoice);
    const editorCurrency = localDoc?.currency || displayCurrency;
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300" data-tour="sales-form-title">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={closeEditor} className="rounded-full"><ChevronLeft className="size-5" /></Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Nueva Nota de Crédito' : `Nota ${localDoc?.number}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{isCreating ? 'Aplicar saldo a favor desde una factura' : 'Detalle de la nota de crédito'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3" data-tour="sales-form-actions">
            <SalesViewTutorial view="returns" context="form" />
            {canPerform('SALES_RETURNS', 'edit') && (
              <>
                {!isCreating && <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-700 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={async () => { await salesReturnsService.delete(localDoc.id); setEditingId(null); setLocalDoc(null); onRefresh(); }}><Trash2 className="size-3 mr-2" /> Eliminar</Button>}
                {canApprove && <Button variant="outline" className="rounded-xl border-emerald-500/50 text-emerald-500 hover:bg-emerald-700 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => { handleApprove(localDoc.id); setEditingId(null); setLocalDoc(null); }}><ShieldCheck className="size-3 mr-2" /> Aprobar Nota</Button>}
                {!isCreating && (localDoc?.status || '').toUpperCase() === 'APPROVED' && canPerform('SALES_RETURNS', 'approve') && <Button variant="outline" className="rounded-xl border-blue-500/50 text-blue-500 hover:bg-blue-700 hover:text-white font-black uppercase text-[10px] tracking-widest px-4" onClick={() => handleProcess(localDoc.id)}><CheckCircle2 className="mr-2 size-3" /> Aplicar Saldo</Button>}
                <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6" onClick={handleSave}>
                  {isCreating ? 'Registrar Nota' : 'Guardar Cambios'}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50" data-tour="sales-form-data">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <SalesAccountingLegend flow="return" />
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox 
                    options={(customers || [])
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))} 
                    value={localDoc?.customerId || ''} 
                    onChange={(val) => { const customer = customers?.find((entry) => entry.id === val); const priceListId = customer?.priceListId || null; const items = (localDoc?.items || []).map((item: any) => item.productId ? { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false } : { ...item, priceListId }); if (hasSalesProductPriceListConflicts(items, priceListId)) { toast.error('No se puede aplicar esta lista: hay productos repetidos con la misma lista de precios.'); return; } setLocalDoc({ ...localDoc, customerId: val, priceListId, items, invoiceId: '' }); }}
                    placeholder="Seleccionar Cliente" 
                  /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Factura Origen</p>
                  <Combobox options={customerInvoices.map(i => ({ label: `${i.number} — ${formatConvertedAmount(Number(i.total||0), i.currency, i.exchangeRate)}`, value: i.id }))} value={localDoc?.invoiceId || ''} onChange={(val) => {
                    const inv = invoices.find(i => i.id === val);
                    const invoiceItems = buildInvoiceReturnItems(inv).map((item: any) => {
                      const product = products.find((candidate) => candidate.id === item.productId);
                      const itemType = product?.itemType === 'SERVICE' ? 'SERVICE' : item.itemType;
                      return {
                        ...item,
                        itemType,
                        quantityToInventory: itemType === 'SERVICE' ? 0 : item.quantity,
                        quantityDiscarded: itemType === 'SERVICE' ? item.quantity : 0,
                        discardReason: itemType === 'SERVICE' ? 'Servicio no inventariable' : '',
                      };
                    });
                    const invoiceTotals = returnTotalsFor(invoiceItems, inv);
                    setLocalDoc({
                      ...localDoc,
                      invoiceId: val,
                      warehouseId: inv?.warehouseId || null,
                      currency: inv?.currency || localDoc?.currency || displayCurrency,
                      exchangeRate: inv?.exchangeRate || localDoc?.exchangeRate || globalRate,
                      items: invoiceItems,
                      ...invoiceTotals,
                    });
                   }} placeholder="Seleccionar Factura" /></div>
                <SalesWarehouseSelect
                  warehouses={warehouses}
                  value={localDoc?.warehouseId || selectedInvoice?.warehouseId}
                  onChange={(warehouseId) => setLocalDoc({ ...localDoc, warehouseId })}
                  disabled={Boolean(selectedInvoice?.warehouseId)}
                  required
                  helpText={selectedInvoice?.warehouseId ? 'La devolución debe usar la bodega de la factura origen.' : 'Se usará para recibir los productos devueltos.'}
                />
                <div><p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                  <Input type="date" value={localDoc?.date ? (typeof localDoc.date === 'string' && localDoc.date.includes('T') ? localDoc.date.split('T')[0] : localDoc.date) : ''} onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value })} className="h-8 text-xs" /></div>
                {!isCreating && <div><p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${statusOpt?.color || 'bg-muted/20 text-muted-foreground'}`}>{statusOpt?.label || localDoc?.status}</span></div>}
                {!isCreating && <div><p className="text-[10px] text-muted-foreground mb-1">Tipo de nota</p>
                  <Badge variant="outline" className={cn('w-fit border-none text-[9px] font-black uppercase', isReturnPartial(localDoc) ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary')}>{isReturnPartial(localDoc) ? 'Parcial' : 'Total'}</Badge></div>}
              </div>
              <div><p className="text-[10px] text-muted-foreground mb-1">Motivo de la Nota</p>
                <textarea value={localDoc?.reason || ''} onChange={(e) => setLocalDoc({ ...localDoc, reason: e.target.value })}
                  className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Describe el motivo de la nota de crédito..." /></div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50" data-tour="sales-form-summary">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen</p>
              <div className="flex justify-between items-center text-base border-b pb-3 border-border/50">
                <span className="font-black">Saldo a favor</span>
                <span className="text-rose-500 font-black text-lg">{formatConvertedAmount(editorTotals.total, editorCurrency, localDoc?.exchangeRate)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-lg border border-border/50 bg-muted/10 p-2"><p className="text-muted-foreground">Subtotal</p><p className="mt-1 font-black">{formatConvertedAmount(editorTotals.subtotal, editorCurrency, localDoc?.exchangeRate)}</p></div>
                <div className="rounded-lg border border-border/50 bg-muted/10 p-2"><p className="text-muted-foreground">Descuento</p><p className="mt-1 font-black text-rose-500">-{formatConvertedAmount(editorTotals.discountAmount, editorCurrency, localDoc?.exchangeRate)}</p></div>
                <div className="rounded-lg border border-border/50 bg-muted/10 p-2"><p className="text-muted-foreground">IVA incluido</p><p className="mt-1 font-black">{formatConvertedAmount(editorTotals.taxAmount, editorCurrency, localDoc?.exchangeRate)}</p></div>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Al aplicar esta nota, el sistema actualiza la factura, el inventario y el saldo del cliente.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50" data-tour="sales-form-items">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Detalle de la Nota de Crédito</p><p className="mt-1 text-[10px] text-muted-foreground">La factura seleccionada define las líneas; registra cantidades parciales y su destino.</p></div><Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">{localDoc.items?.length || 0} líneas</Badge></div>
            <div className="space-y-3">{(localDoc.items || []).map((item: any, idx: number) => {
              const returned = toWholeQuantity(item.quantity || 0);
              const toInventory = toWholeQuantity(item.quantityToInventory || 0, returned);
              const discarded = Math.max(0, returned - toInventory);
              const itemType = resolveItemType(item);
              const quantityRatio = returned / Math.max(1, Number(item.originalQuantity || returned || 1));
              const lineDiscountAmount = roundMoney(Number(item.sourceDiscountAmount || 0) * quantityRatio);
              const lineTaxAmount = roundMoney(Number(item.sourceTaxAmount || 0) * quantityRatio);
              const product = item.productId ? products.find((candidate) => candidate.id === item.productId) : undefined;
              const sku = product?.sku || item.sku || item.productSku || product?.code || item.productCode || item.code;
              return <div key={item.id || idx} className="grid min-w-0 gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 xl:grid-cols-[minmax(210px,1.5fr)_100px_110px_130px_110px_minmax(190px,1fr)_100px] xl:items-end">
                <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{itemType === 'SERVICE' ? 'Servicio' : 'Producto'}</p><p className="text-sm font-bold text-foreground">{item.description || 'Sin descripción'}</p>{itemType !== 'SERVICE' && <p className="mt-1 text-[10px] font-semibold text-muted-foreground">SKU: {sku || 'Sin SKU'}</p>}<p className="mt-1 text-[10px] text-muted-foreground">Facturado: {Number(item.originalQuantity || 0)}</p></div>
                <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Devuelve</p><Input type="number" inputMode="numeric" min="0" max={Math.floor(Number(item.originalQuantity || returned))} step="1" value={returned || ''} onChange={(event) => { const next = toWholeQuantity(event.target.value, Number(item.originalQuantity || returned)); const nextDiscarded = Math.max(0, next - toInventory); const sourceTotal = Number(item.sourceLineTotal ?? item.total ?? 0); const items = [...localDoc.items]; items[idx] = { ...items[idx], quantity: next, quantityDiscarded: nextDiscarded, total: roundMoney(sourceTotal * next / Math.max(1, Number(item.originalQuantity || returned || 1))) }; setLocalDoc({ ...localDoc, items, total: recalcTotal(items) }); }} /></div>
                <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">A inventario</p><Input type="number" inputMode="numeric" min="0" max={returned} step="1" value={itemType === 'SERVICE' ? 0 : toInventory} disabled={itemType === 'SERVICE'} onChange={(event) => { const next = toWholeQuantity(event.target.value, returned); const items = [...localDoc.items]; items[idx] = { ...items[idx], quantityToInventory: next, quantityDiscarded: Math.max(0, returned - next) }; setLocalDoc({ ...localDoc, items }); }} /></div>
                <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Se descarta</p><div className="flex h-9 items-center rounded-md border border-input bg-background px-3 text-xs font-black text-amber-500">{discarded}</div></div>
                <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Precio U.</p><div className="rounded-md border border-input bg-muted/20 px-3 py-1.5 text-right"><p className="text-xs font-bold">{formatConvertedAmount(Number(item.unitPrice || 0), localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}</p><p className="mt-0.5 text-[9px] font-medium text-muted-foreground">Desc. -{formatConvertedAmount(lineDiscountAmount, localDoc?.currency || displayCurrency, localDoc?.exchangeRate)} · IVA {formatConvertedAmount(lineTaxAmount, localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}</p></div></div>
                <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Motivo de descarte {discarded > 0 ? '*' : ''}</p><Input value={item.discardReason || ''} disabled={itemType === 'SERVICE'} onChange={(event) => { const items = [...localDoc.items]; items[idx] = { ...items[idx], discardReason: event.target.value }; setLocalDoc({ ...localDoc, items }); }} placeholder={itemType === 'SERVICE' ? 'Servicio no inventariable' : 'Ej. Dañado, vencido...'} /></div>
                <div className="text-right"><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Saldo a favor</p><p className="text-lg font-black text-rose-500">{formatConvertedAmount(Number(item.total || 0), localDoc?.currency || displayCurrency, localDoc?.exchangeRate)}</p></div>
              </div>;
            })}{(!localDoc.items || localDoc.items.length === 0) && <div className="rounded-xl border border-dashed border-border/50 py-8 text-center text-xs text-muted-foreground">Selecciona una factura para cargar sus productos y servicios.</div>}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── TABLE VIEW ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="sales-list-kpis">
        {displayMode === 'ORIGINAL'
          ? originalReturnedAmounts.map((summary) => <SalesKpiCard key={`returned-${summary.currency}`} title={`Saldo a favor generado (${summary.currency})`} value={formatExplicitAmount(summary.amount, summary.currency)} icon={FileOutput} color="text-rose-500" bg="bg-rose-500/10" />)
          : <SalesKpiCard title={`Saldo a favor generado (${displayCurrency})`} value={formatConvertedAmount(totalReturnedInDisplayCurrency, baseCurrency)} icon={FileOutput} color="text-rose-500" bg="bg-rose-500/10" />}
        <SalesKpiCard title="Pendientes" value={data.filter(r => (r.status||'').toUpperCase() === 'PENDING').length} icon={Clock} color="text-amber-500" bg="bg-amber-500/10" active={statusFilter === 'PENDING'} onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')} />
        <SalesKpiCard title="Aprobadas" value={data.filter(r => (r.status||'').toUpperCase() === 'APPROVED').length} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" active={statusFilter === 'APPROVED'} onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? 'ALL' : 'APPROVED')} />
        <SalesKpiCard title="Rechazadas" value={data.filter(r => (r.status||'').toUpperCase() === 'REJECTED').length} icon={XCircle} color="text-rose-500" bg="bg-rose-500/10" active={statusFilter === 'REJECTED'} onClick={() => setStatusFilter(statusFilter === 'REJECTED' ? 'ALL' : 'REJECTED')} />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div><h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Notas de Crédito</h2>
            </div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="returns" />
            <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de notas de crédito" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar nota..." className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {salesAlert && <PurchaseAlertsButton alert={salesAlert} sectionLabel="ventas" storageNamespace="erp-sales-alerts" onItemSelect={setHighlightedAlertId} />}
            {canPerform('SALES_RETURNS', 'create') && (
              <Button onClick={startNew} data-toolbar-role="primary" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Nueva Nota</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filteredData}
          pagination={pagination}
          onBulkDelete={async (ids) => { const deleteToastId = toast.loading(`Eliminando ${ids.length} nota${ids.length === 1 ? '' : 's'} de crédito...`); try { for (const id of ids) { if (String(id).startsWith('new-')) continue; await salesReturnsService.delete(id as string); } toast.success('Eliminadas', { id: deleteToastId }); onRefresh(); } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar', { id: deleteToastId }); } }}
          columns={columns} onRowUpdate={async () => {}} onRowClick={(row) => setDetailReturn(row)} isLoading={loading} actionsWidth="w-28" fitContent showHorizontalControls
          layoutMode={layoutMode}
          highlightedRowId={highlightedAlertId}
          actions={(row) => (
            <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
               {canPerform('SALES_RETURNS', 'approve') && (row.status||'').toUpperCase() === 'PENDING' && (
                 <Button title="Aprobar Nota de Crédito" variant="ghost" size="icon" className="size-8 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors" onClick={() => handleApprove(row.id)}><ShieldCheck className="size-4" /></Button>
               )}
               {canPerform('SALES_RETURNS', 'approve') && (row.status||'').toUpperCase() === 'APPROVED' && (
                 <Button title="Aplicar saldo y actualizar inventario" variant="ghost" size="icon" className="size-8 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors" onClick={() => handleProcess(row.id)}><CheckCircle2 className="size-4" /></Button>
               )}
                <Button title="Ver nota de crédito completa" aria-label="Ver nota de crédito completa" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => { setDetailReturn(null); startEdit(row.id); }}><Eye className="size-4" /></Button>
               {canPerform('SALES_RETURNS', 'delete') && (
                 <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
               )}
            </div>
          )}
        />
      </div>

      <SalesDocumentDetailSheet
        key={detailReturn?.id || 'return-detail'}
        document={detailReturn ? buildReturnPanel(detailReturn) : null}
        entity="SALES_RETURN"
        open={Boolean(detailReturn)}
        onClose={() => setDetailReturn(null)}
        onOpenDocument={() => {
          if (!detailReturn) return;
          setDetailReturn(null);
          startEdit(detailReturn.id);
        }}
        onDownloadPdf={(format) => { if (detailReturn) void handleExportPDF(detailReturn, format); }}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title={"¿Eliminar nota de crédito?"}
        description="¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          const deleteToastId = toast.loading('Eliminando nota de crédito...');
          try {
            setDeleteLoading(true);
            await salesReturnsService.delete(pendingDeleteId);
            toast.success('Registro eliminado', { id: deleteToastId });
            onRefresh();
          } catch (error: any) {
            toast.error(error?.message || 'Error al eliminar', { id: deleteToastId });
          } finally {
            setDeleteLoading(false);
            setPendingDeleteId(null);
          }
        }}
      />
    </div>
  );
}

