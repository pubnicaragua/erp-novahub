import { useState, useEffect } from 'react';
import { 
  ClipboardList, Plus, Search, TrendingUp, Clock, ArrowRightCircle, Package, Eye, Ban, ChevronLeft, Trash2, Settings2, Check
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { salesOrdersService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { SalesOrder, Customer, Product, Employee, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { generateEstimatePDF } from '../../utils/pdfGenerator';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { FileDown } from 'lucide-react';
import { SalesLinePriceListSelect, PriceMissingBadge } from './SalesLinePriceListSelect';
import { SalesAccountingLegend } from './SalesAccountingLegend';
import { formatSalesAmount, getMissingSalesPriceMessage } from '../../utils/salesPriceList';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import { SalesKpiCard } from './SalesKpiCard';

interface OrdenesVentaViewProps {
  data: SalesOrder[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  onGenerateInvoice: (order: SalesOrder) => Promise<void> | void;
  targetOrderId?: string | null;
  onClearTargetOrderId?: () => void;
  customers?: Customer[];
  products?: Product[];
  employees?: Employee[];
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
}

const statusOptions = [
  { label: 'Pendiente Revisión', value: 'PENDING_REVIEW', color: 'bg-orange-500/10 text-orange-500' },
  { label: 'Borrador',       value: 'DRAFT',       color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Confirmada',     value: 'CONFIRMED',   color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'En Proceso',     value: 'IN_PROGRESS', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Enviada',        value: 'SHIPPED',     color: 'bg-purple-500/10 text-purple-500' },
  { label: 'Entregada',      value: 'DELIVERED',   color: 'bg-cyan-500/10 text-cyan-500' },
  { label: 'Cancelada',      value: 'CANCELLED',   color: 'bg-rose-500/10 text-rose-500' },
];

export function OrdenesVentaView({ data, loading, onRefresh, onGenerateInvoice, targetOrderId, onClearTargetOrderId, customers = [], products = [], employees = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange }: OrdenesVentaViewProps) {
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, formatConvertedAmount, toBaseAmount, formatAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'IN_PROGRESS'>('ALL');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<SalesOrder | null>(null);
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([
    'number', 'customer', 'itemCount', 'total', 'status', 'date',
    'invoiceNumber', 'invoicedAt', 'invoicedBy',
  ]);
  const [layoutMode, setLayoutMode] = useState<'table' | 'cards'>('table');
  const productCatalog = products.filter((p) => p.itemType !== 'SERVICE');
  const serviceCatalog = products.filter((p) => p.itemType === 'SERVICE');
  const resolveItemType = (item: any) => item.itemType || (products.find((p) => p.id === item.productId)?.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT');
  const findProductForItem = (item: any) => {
    const itemCode = String(item?.productCode || item?.code || '').trim().toLowerCase();
    const itemName = String(item?.description || '').trim().toLowerCase();
    return products.find((product) => product.id === item?.productId)
      || (itemCode ? products.find((product) => String(product.code || '').trim().toLowerCase() === itemCode) : undefined)
      || (itemName ? products.find((product) => String(product.name || '').trim().toLowerCase() === itemName) : undefined);
  };
  const getLineProductOptions = (item: any) => {
    const itemType = resolveItemType(item);
    const catalog = itemType === 'SERVICE' ? serviceCatalog : productCatalog;
    const options = catalog.map((product) => ({
      label: `${itemType === 'SERVICE' ? 'Servicio' : 'Producto'} · ${product.code} - ${product.name}`,
      value: product.id,
    }));
    const hasSelectedOption = Boolean(item.productId) && options.some((option) => option.value === item.productId);
    if (item.productId && !hasSelectedOption && String(item.description || '').trim()) {
      options.unshift({
        label: `${itemType === 'SERVICE' ? 'Servicio' : 'Producto'} · ${item.description}`,
        value: item.productId,
      });
    }
    return options;
  };
  const [invoicingOrderId, setInvoicingOrderId] = useState<string | null>(null);
  const [pricingMode, setPricingMode] = useState<'global' | 'individual'>('global');

  const handleInvoiceOrder = async (order: SalesOrder) => {
    if (!canPerform('SALES_INVOICES', 'create')) {
      toast.error('No tienes permiso para facturar órdenes de venta');
      return;
    }
    if (invoicingOrderId) return;
    const orderForConversion = localDoc?.id === order.id
      ? {
          ...order,
          sellerEmployeeId: localDoc.sellerEmployeeId,
        }
      : order;
    const customer = orderForConversion.customer || customers.find((item) => item.id === orderForConversion.customerId);
    if (!customer || String(customer.status || '').toUpperCase() !== 'ACTIVE') {
      toast.error('El cliente de la orden no está activo');
      return;
    }
    if (!orderForConversion.items?.length) {
      toast.error('La orden debe contener al menos un producto o servicio');
      return;
    }
    const priceMessage = getMissingSalesPriceMessage(orderForConversion.items);
    if (priceMessage) {
      toast.error(priceMessage);
      return;
    }
    for (const item of orderForConversion.items) {
      if (!item.description?.trim() || Number(item.quantity) <= 0 || Number(item.unitPrice) < 0) {
        toast.error('La orden contiene productos o servicios con datos inválidos');
        return;
      }
      if (item.productId) {
        const product = findProductForItem(item);
        if (product && String(product.status || '').toUpperCase() === 'INACTIVE') {
          toast.error(`El producto ${item.description} ya no está disponible`);
          return;
        }
        if (product && product.itemType !== 'SERVICE' && Number(product.stock) < Number(item.quantity)) {
          toast.error(`Stock insuficiente para ${item.description}`);
          return;
        }
      }
    }
    if (orderForConversion.invoiceId || orderForConversion.invoiceNumber) {
      toast.info(`La orden ya está facturada${orderForConversion.invoiceNumber ? ` con ${orderForConversion.invoiceNumber}` : ''}`);
      return;
    }
    setInvoicingOrderId(order.id);
    try {
      const currentStatus = String(orderForConversion.status || '').toUpperCase();
      if (!['CONFIRMED', 'SHIPPED'].includes(currentStatus)) {
        await salesOrdersService.update(order.id, { status: 'CONFIRMED' as any });
      }
      await onGenerateInvoice({ ...orderForConversion, status: 'confirmed' as any });
      await onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo abrir la factura');
    } finally {
      setInvoicingOrderId(null);
    }
  };

  // NOTE: intentionally NOT listening to data changes here.
  // Resetting localDoc on every server refresh would re-mount SalesLinePriceListSelect
  // (because deleteMany+create gives items new IDs), resetting the appliedRef and
  // causing an infinite PATCH loop. localDoc is only reset when editingId changes.
  // See the useEffect below (line ~207) for the single source of truth.

  useEffect(() => {
    if (!targetOrderId) return;
    const timer = setTimeout(() => {
      if (data.some((order) => order.id === targetOrderId)) {
        setEditingId(targetOrderId);
        onClearTargetOrderId?.();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [targetOrderId, data, onClearTargetOrderId]);

  const filtered = data.filter(o => 
    (statusFilter === 'ALL' || String(o.status || '').toUpperCase() === statusFilter) &&
    o.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (statusFilter === 'ALL' || String(o.status || '').toUpperCase() === statusFilter) &&
    (o.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<SalesOrder>) => {
    try {
      if (updates.status && String(updates.status).toUpperCase() === 'SHIPPED') {
        const orderToConvert = data.find(o => o.id === id) || localDoc;
        if (orderToConvert) {
          await onGenerateInvoice({ ...orderToConvert, status: 'SHIPPED' as any });
          await onRefresh();
          return;
        }
      }

      await salesOrdersService.update(id.toString(), updates);
      onRefresh();
    } catch (error: any) {
       const msg = error.response?.data?.message;
       toast.error(`Error al actualizar status: ${Array.isArray(msg) ? msg.join(', ') : (msg || error.message)}`);
       throw error;
    }
  };

  const buildOrderStatusPayload = (status: 'DRAFT' | 'CONFIRMED') => ({
    number: localDoc?.number,
    customerId: localDoc?.customerId || null,
    sellerEmployeeId: localDoc?.sellerEmployeeId || null,
    commissionType: localDoc?.commissionType,
    commissionRate: localDoc?.commissionRate || 0,
    commissionAmount: localDoc?.commissionAmount || 0,
    priceListId: localDoc?.priceListId || null,
    date: localDoc?.date,
    expectedDelivery: localDoc?.expectedDelivery || null,
    subtotal: localDoc?.subtotal,
    taxAmount: localDoc?.taxAmount,
    discountAmount: localDoc?.discountAmount,
    irRate: localDoc?.irRate || 0,
    irTaxId: localDoc?.irTaxId || null,
    irAmount: localDoc?.irAmount || 0,
    total: localDoc?.total,
    currency: localDoc?.currency,
    exchangeRate: localDoc?.exchangeRate,
    baseTotal: localDoc?.baseTotal,
    warehouseId: localDoc?.warehouseId || null,
    notes: localDoc?.notes,
    items: localDoc?.items || [],
    status,
  } as Partial<SalesOrder>);

  const handleSaveOrder = async (status: 'DRAFT' | 'CONFIRMED') => {
    if (!localDoc) return;
    if (status === 'CONFIRMED') {
      const priceMessage = getMissingSalesPriceMessage(localDoc.items || []);
      if (priceMessage) {
        toast.error(priceMessage);
        return;
      }
    }
    try {
      await handleUpdate(localDoc.id, buildOrderStatusPayload(status));
      setEditingId(null);
      toast.success(status === 'CONFIRMED' ? 'Orden confirmada' : 'Orden guardada como borrador');
    } catch {
      // handleUpdate already shows the error
    }
  };

  const calculateRates = (doc: any) => {
    const sub = Number(doc?.subtotal || 0);
    if (sub === 0) return { dRate: 0, tRate: 0 };
    const dAmount = Number(doc?.discountAmount || 0);
    const dRate = (dAmount / sub) * 100;
    const base = sub - dAmount;
    const tAmount = Number(doc?.taxAmount || 0);
    const tRate = base > 0 ? (tAmount / base) * 100 : 0;
    return { dRate: Math.round(dRate * 100) / 100, tRate: Math.round(tRate * 100) / 100 };
  };

  const recalculateIndividualPricing = (items: any[]) => {
    const pricedItems = items.map((line) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      const discount = gross * (Number(line.discount || 0) / 100);
      const taxable = gross - discount;
      const tax = taxable * (Number(line.taxRate || 0) / 100);
      return { ...line, total: taxable + tax };
    });
    const subtotal = pricedItems.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
    const discountAmount = pricedItems.reduce((sum, line) => sum + (Number(line.quantity || 0) * Number(line.unitPrice || 0) * Number(line.discount || 0) / 100), 0);
    const taxAmount = pricedItems.reduce((sum, line) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      return sum + ((gross - gross * Number(line.discount || 0) / 100) * Number(line.taxRate || 0) / 100);
    }, 0);
    return { items: pricedItems, subtotal, discountAmount, taxAmount, total: subtotal - discountAmount + taxAmount };
  };

  const recalculateGlobalPricing = (items: any[]) => {
    const normalizedItems = items.map((line: any) => ({ ...line, total: Number(line.quantity || 0) * Number(line.unitPrice || 0) }));
    const subtotal = normalizedItems.reduce((sum: number, line: any) => sum + Number(line.total || 0), 0);
    const discountAmount = subtotal * (Number(localRates.dRate || 0) / 100);
    const base = subtotal - discountAmount;
    const taxAmount = base * (Number(localRates.tRate || 0) / 100);
    return { items: normalizedItems, subtotal, discountAmount, taxAmount, total: base + taxAmount };
  };


  const formatNumber2 = (value: number) => formatSalesAmount(value);
  const priceInCurrency = (basePrice: number, currency: string, rate: number) => currency === 'USD' ? basePrice / (rate || 1) : basePrice;

  const [localRates, setLocalRates] = useState({ dRate: 0, tRate: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingId) {
        const e = data.find(x => x.id === editingId);
        setLocalDoc(e ? JSON.parse(JSON.stringify(e)) : null);
        if (e) {
          setLocalRates(calculateRates(e));
          setPricingMode((e.items || []).some((line: any) => Number(line.discount || 0) !== 0 || Number(line.taxRate || 0) !== 0 || Number(line.irRate || 0) !== 0) ? 'individual' : 'global');
        }
      } else {
        setLocalDoc(null);
        setLocalRates({ dRate: 0, tRate: 0 });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [editingId]); // Intentionally removed 'data' to prevent server-refreshes from destroying mid-edit local states

  const handleAddOrder = async () => {
    const createToastId = toast.loading('Creando orden de venta...');
    try {
      const newOrd = await salesOrdersService.create({
        // No customerId — el usuario lo elige en el formulario
        date: new Date().toISOString(),
        expectedDelivery: new Date(Date.now() + 7 * 86400000).toISOString(),
        discountAmount: 0,
        total: 0,
        currency: displayCurrency as any,
        exchangeRate: globalRate,
        status: 'DRAFT' as any,
        items: [],
        number: `ORD-${Date.now().toString().slice(-6)}`
      });
      await onRefresh();
      toast.success('Orden de venta creada como borrador', { id: createToastId });
      setEditingId(newOrd.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo crear la orden de venta', { id: createToastId });
    }
  };

  const columns: ColumnDef<SalesOrder>[] = [
    { 
      key: 'number', 
      header: 'Número de Orden', 
      width: '200px',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <span 
            className={cn(
              "text-xs font-black font-mono text-primary",
              canPerform('SALES_ORDERS', 'edit') ? "cursor-pointer hover:underline" : "cursor-default"
            )} 
            onClick={() => canPerform('SALES_ORDERS', 'edit') && setEditingId(row.id)}
          >
            {val}
          </span>
          {row.estimateId && (
            <Badge className="text-[8px] font-black bg-orange-500/10 text-orange-500 border-none px-1.5 py-0">
              Desde Cotización
            </Badge>
          )}
        </div>
      )
    },
    { 
      key: 'customer', 
      header: 'Cliente', 
      render: (_val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    { 
      key: 'itemCount', 
      header: 'Items', 
      width: '100px',
      render: (_val, row) => <span className="text-xs font-medium text-muted-foreground">{row.items?.length || 0} art.</span>
    },
    { 
      key: 'total', 
      header: 'Monto Total', 
      width: '150px',
      render: (val, row) => (
        <span className="text-[13px] font-black tabular-nums text-emerald-500">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}
        </span>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      width: '135px',
      editable: false,
      type: 'select',
      options: statusOptions,
      render: (val) => {
        const opt = statusOptions.find(o => o.value === String(val || '').toUpperCase());
        return (
          <Badge variant="outline" className={cn(
            "whitespace-nowrap text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border-none shadow-none",
            opt?.color || 'bg-muted/20 text-muted-foreground'
          )}>
            {opt?.label || val}
          </Badge>
        );
      }
    },
    { 
      key: 'date', 
      header: 'Fecha Compromiso', 
      render: (val) => (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
           <Clock className="size-3" />
           {new Date(val).toLocaleDateString()}
        </div>
      )
    },
    { key: 'invoiceNumber', header: 'Factura relacionada', render: (val, row) => <span className="text-xs font-mono font-bold text-primary">{val || row.invoiceId || '—'}</span> },
    { key: 'invoicedAt', header: 'Fecha facturación', render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '—'}</span> },
    { key: 'invoicedBy', header: 'Facturado por', render: (_val, row) => <span className="text-xs text-muted-foreground">{row.invoicedBy?.name || '—'}</span> },
    { key: 'paymentNumber', header: 'Pago relacionado', render: (val, row) => <span className="text-xs font-mono font-bold text-emerald-500">{val || (row.invoiceId ? 'Pendiente' : '—')}</span> },
    { key: 'paymentDate', header: 'Fecha pago', render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '—'}</span> },
    {
      key: 'paymentStatus',
      header: 'Estado pago',
      render: (val, row) => {
        const status = String(val || '').toUpperCase();
        const labels: Record<string, string> = { PAID: 'Pagada', PARTIAL: 'Parcial', PENDING: 'Pendiente', OVERDUE: 'Vencida' };
        return row.invoiceId ? (
          <Badge variant="outline" className={cn(
            'whitespace-nowrap border-none px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-none',
            status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' : status === 'PARTIAL' ? 'bg-orange-500/10 text-orange-500' : 'bg-muted/20 text-muted-foreground',
          )}>
            {labels[status] || status || 'Pendiente'}
          </Badge>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
  ];

  const visibleColumns = columns.filter((column) => visibleColumnKeys.includes(String(column.key)));
  const columnOptions = [
    { key: 'number', label: 'Número de orden' },
    { key: 'customer', label: 'Cliente' },
    { key: 'itemCount', label: 'Artículos' },
    { key: 'total', label: 'Monto total' },
    { key: 'status', label: 'Estado de la orden' },
    { key: 'date', label: 'Fecha compromiso' },
    { key: 'invoiceNumber', label: 'Factura relacionada' },
    { key: 'invoicedAt', label: 'Fecha facturación' },
    { key: 'invoicedBy', label: 'Facturado por' },
    { key: 'paymentNumber', label: 'Pago relacionado' },
    { key: 'paymentDate', label: 'Fecha de pago' },
    { key: 'paymentStatus', label: 'Estado de pago' },
  ];

  const confirmedAmountInDisplayCurrency = data
    .filter(order => (order.status || '').toUpperCase() === 'CONFIRMED')
    .reduce((acc, order) => acc + ((order as any).baseTotal !== null && (order as any).baseTotal !== undefined
      ? Number((order as any).baseTotal)
      : toBaseAmount(order.total || 0, order.currency, order.exchangeRate)), 0);

  if (editingId && localDoc) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Orden {localDoc?.number}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle de la orden de venta</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canPerform('SALES_ORDERS', 'edit') && (
              <>
                <Button variant="outline" className="rounded-xl border-border/50 font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => void handleSaveOrder('DRAFT')}>
                  Guardar Borrador
                </Button>
                <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => void handleSaveOrder('CONFIRMED')}>
                  Confirmar Orden
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <SalesAccountingLegend flow="order" />
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Número</p>
                  <Input defaultValue={localDoc?.number} onBlur={(e) => handleUpdate(localDoc!.id, { number: e.target.value })} className="h-8 text-xs font-black uppercase" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Vendedor</p>
                  <Combobox
                    options={employees.map((employee) => ({ label: `${employee.firstName} ${employee.lastName}`, value: employee.id }))}
                    value={localDoc?.sellerEmployeeId || ''}
                    onChange={(val) => { setLocalDoc({ ...localDoc, sellerEmployeeId: val }); void handleUpdate(localDoc!.id, { sellerEmployeeId: val }); }}
                    placeholder="Seleccionar vendedor"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Tipo de comisión</p>
                  <Select
                    value={localDoc?.commissionType || 'PERCENTAGE'}
                    disabled={!localDoc?.sellerEmployeeId}
                    onValueChange={(commissionType) => {
                      const nextType = commissionType as 'PERCENTAGE' | 'FIXED';
                      const updates = nextType === 'FIXED'
                        ? { commissionType: nextType, commissionRate: 0 }
                        : { commissionType: nextType, commissionAmount: 0 };
                      setLocalDoc({ ...localDoc, ...updates } as any);
                      void handleUpdate(localDoc!.id, updates as any);
                    }}
                  >
                    <SelectTrigger className={cn("h-8 text-xs", !localDoc?.sellerEmployeeId && "opacity-50 cursor-not-allowed bg-muted/20")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Porcentaje</SelectItem>
                      <SelectItem value="FIXED">Monto fijo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">{localDoc?.commissionType === 'FIXED' ? 'Monto de comisión' : '% Comisión'}</p>
                  <Input
                    type="number"
                    min="0"
                    max={localDoc?.commissionType === 'FIXED' ? undefined : 100}
                    value={localDoc?.commissionType === 'FIXED' ? (localDoc?.commissionAmount || '') : (localDoc?.commissionRate || '')}
                    placeholder="0"
                    disabled={!localDoc?.sellerEmployeeId}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setLocalDoc({ ...localDoc, ...(localDoc?.commissionType === 'FIXED' ? { commissionAmount: value } : { commissionRate: value }) } as any);
                    }}
                    onBlur={() => {
                      if (!localDoc?.sellerEmployeeId) return;
                      const updates = localDoc.commissionType === 'FIXED'
                        ? { commissionAmount: Number(localDoc.commissionAmount || 0), commissionRate: 0 }
                        : { commissionRate: Number(localDoc.commissionRate || 0), commissionAmount: 0 };
                      void handleUpdate(localDoc.id, updates as any);
                    }}
                    className={cn("h-8 text-xs", !localDoc?.sellerEmployeeId && "opacity-50 cursor-not-allowed bg-muted/20")}
                  />
                  {!localDoc?.sellerEmployeeId && <p className="text-[9px] text-muted-foreground/60 mt-0.5 italic">Selecciona un empleado primero</p>}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox 
                    options={(customers || [])
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))}
                    value={localDoc?.customerId || ''}
                    onChange={(val) => {
                      const customer = customers.find((entry) => entry.id === val);
                      const priceListId = customer?.priceListId || null;
                      const items = (localDoc?.items || []).map((item: any) => item.productId
                        ? { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false }
                        : { ...item, priceListId });
                      setLocalDoc({ ...localDoc, customerId: val, priceListId, items } as any);
                      void handleUpdate(localDoc!.id, { customerId: val, priceListId, items } as any);
                    }}
                    placeholder="Seleccionar Cliente"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input type="date" defaultValue={localDoc?.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} onBlur={(e) => handleUpdate(localDoc!.id, { date: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Entrega Esperada</p>
                  <Input type="date" defaultValue={localDoc?.expectedDelivery ? new Date(localDoc.expectedDelivery).toISOString().split('T')[0] : ''} onBlur={(e) => handleUpdate(localDoc!.id, { expectedDelivery: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Moneda de la transacción</p>
                  <Select
                    value={localDoc?.currency || 'NIO'}
                    onValueChange={(currency) => {
                      const exchangeRate = currency === 'NIO' ? 1 : Number(globalRate || 1);
                      const previousCurrency = localDoc?.currency || 'NIO';
                      const previousRate = previousCurrency === 'NIO' ? 1 : Number(localDoc?.exchangeRate || globalRate || 1);
                      const convertedItems = (localDoc?.items || []).map((line: any) => {
                        const basePrice = previousCurrency === 'USD' ? Number(line.unitPrice || 0) * previousRate : Number(line.unitPrice || 0);
                        const unitPrice = priceInCurrency(basePrice, currency, exchangeRate);
                        return { ...line, unitPrice, total: Number(line.quantity || 0) * unitPrice };
                      });
                      const recalculated = pricingMode === 'individual'
                        ? recalculateIndividualPricing(convertedItems)
                        : (() => {
                            const subtotal = convertedItems.reduce((sum: number, line: any) => sum + Number(line.total || 0), 0);
                            const discountAmount = subtotal * (localRates.dRate / 100);
                            const base = subtotal - discountAmount;
                            const taxAmount = base * (localRates.tRate / 100);
                            return { items: convertedItems, subtotal, discountAmount, taxAmount, total: base + taxAmount };
                          })();
                      setLocalDoc({ ...localDoc, currency, exchangeRate, ...recalculated } as any);
                      void handleUpdate(localDoc!.id, { currency, exchangeRate, ...recalculated } as any);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar moneda" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NIO">Córdobas (C$)</SelectItem>
                      <SelectItem value="USD">Dólares (US$)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    Tasa de cambio configurada: <span className="font-bold">{formatNumber2(Number(localDoc?.currency === 'NIO' ? 1 : localDoc?.exchangeRate || globalRate || 1))}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/10 p-2 text-[10px] font-black uppercase tracking-widest">
                <span className="text-muted-foreground">Aplicar impuestos/descuentos:</span>
                <Button type="button" size="sm" variant={pricingMode === 'global' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => {
                  const items = (localDoc.items || []).map((line: any) => ({ ...line, taxRate: 0, discount: 0, irRate: 0, irTaxId: null, irAmount: 0 }));
                  const recalculated = recalculateGlobalPricing(items);
                  setPricingMode('global');
                  setLocalDoc({ ...localDoc, ...recalculated } as any);
                  void handleUpdate(localDoc.id, recalculated as any);
                }}>Global</Button>
                <Button type="button" size="sm" variant={pricingMode === 'individual' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => { setPricingMode('individual'); setLocalRates({ dRate: 0, tRate: 0 }); }}>Por producto</Button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <div className="flex items-center gap-2">{localDoc?.currency === 'USD' ? '$' : 'C$'} <Input type="text" value={formatSalesAmount(localDoc?.subtotal)} readOnly className="w-28 h-8 text-right font-bold bg-muted/20" /></div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Descuento</span>
                  <div className="flex items-center gap-2 text-rose-500">
                    <div className="flex items-center mr-2">{pricingMode === 'global' ? <Input type="number" min="0" max="100" value={localRates.dRate || ''} placeholder="0" onChange={(e) => {
                      const newRate = Number(e.target.value);
                      const dAmount = Number(localDoc?.subtotal||0) * (newRate / 100);
                      const base = Number(localDoc?.subtotal||0) - dAmount;
                      const tAmount = base * (localRates.tRate / 100);
                      const newTotal = base + tAmount;
                      setLocalRates(prev => ({ ...prev, dRate: newRate }));
                      setLocalDoc({ ...localDoc, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                    }} onBlur={(e) => {
                      const newRate = Number(e.target.value);
                      const dAmount = Number(localDoc?.subtotal||0) * (newRate / 100);
                      const base = Number(localDoc?.subtotal||0) - dAmount;
                      const tAmount = base * (localRates.tRate / 100);
                      const newTotal = base + tAmount;
                      handleUpdate(localDoc!.id, { discountAmount: dAmount, taxAmount: tAmount, total: newTotal });
                    }} className="w-16 h-8 text-right font-bold text-rose-500 bg-transparent" /> : <span className="text-right text-xs font-black">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatNumber2(Number(localDoc?.discountAmount || 0))}</span>} {pricingMode === 'global' && <span className="ml-1 text-xs font-black">%</span>}</div>
                    -{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatNumber2(Number(localDoc?.discountAmount || 0))}
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Impuesto (IVA)</span>
                  <div className="flex items-center gap-2">
                    {pricingMode === 'global' ? (
                      <label className="flex h-8 items-center gap-1.5 rounded-md bg-muted/30 px-2 text-xs font-black">
                        <input
                          type="checkbox"
                          checked={Number(localRates.tRate || 0) > 0}
                          onChange={(e) => {
                            const newRate = e.target.checked ? 15 : 0;
                            const dAmount = Number(localDoc?.subtotal || 0) * (localRates.dRate / 100);
                            const base = Number(localDoc?.subtotal || 0) - dAmount;
                            const tAmount = base * (newRate / 100);
                            const newTotal = base + tAmount;
                            setLocalRates(prev => ({ ...prev, tRate: newRate }));
                            setLocalDoc({ ...localDoc, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                            void handleUpdate(localDoc!.id, { discountAmount: dAmount, taxAmount: tAmount, total: newTotal });
                          }}
                        />
                        Aplicar
                      </label>
                    ) : null}
                    <span className="text-xs font-black">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatNumber2(Number(localDoc?.taxAmount || 0))}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black">Total</span>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 text-primary font-black">
                      {localDoc?.currency === 'USD' ? '$' : 'C$'} 
                      <Input type="text" value={formatSalesAmount(localDoc?.total)} readOnly className="w-28 h-8 text-right font-black text-primary bg-muted/20" />
                    </div>
                    {localDoc?.currency === 'USD' && (
                      <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">
                        ≈ C$ {formatNumber2(Number(localDoc?.total || 0) * (localDoc?.exchangeRate || globalRate))}
                      </p>
                    )}
                    {localDoc?.currency === 'NIO' && (
                      <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">
                        ≈ $ {formatNumber2(Number(localDoc?.total || 0) / (localDoc?.exchangeRate || globalRate))}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- PRODUCT LINE ITEMS --- */}
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos / Servicios</p>
              <div className="flex flex-wrap gap-2">
                {(['PRODUCT', 'SERVICE'] as const).map((itemType) => <Button key={itemType} type="button" variant="outline" size="sm" onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: Date.now().toString(), itemType, productId: '', description: '', quantity: 1, unitPrice: 0, total: 0 }] as any[];
                  setLocalDoc({ ...localDoc, items: newItems } as any);
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl"><Plus className="size-3 mr-2" /> Agregar {itemType === 'PRODUCT' ? 'Producto' : 'Servicio'}</Button>)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="hidden xl:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className={cn('col-span-6', pricingMode === 'individual' && 'xl:col-span-5')}>Descripción</div>
                {pricingMode === 'individual' && <div className="col-span-2" />}
                <div className={cn('col-span-2 text-right', pricingMode === 'individual' && 'xl:col-span-1')}>Cant.</div>
                <div className="col-span-2 text-right">Precio U.</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} data-item-layout="standard" className={cn('sales-item-row grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 items-start xl:grid-cols-12 xl:gap-2 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0', pricingMode === 'individual' && 'pricing-individual')}>
                  <div className={cn('min-w-0 xl:col-span-6', pricingMode === 'individual' && 'xl:col-span-5')}>
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <Combobox 
                          options={getLineProductOptions(item)}
                          value={item.productId || ''}
                          onChange={(val) => {
                            const newItems = [...(localDoc.items || [])] as any[];
                            const selectedProd = (resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog).find(p => p.id === val);
                            newItems[idx].productId = val;
                            if (selectedProd) {
                              newItems[idx].description = selectedProd.name;
                              const baseSalePrice = Number(selectedProd.salePrice ?? selectedProd.price ?? 0);
                              newItems[idx].unitPrice = priceInCurrency(baseSalePrice, localDoc?.currency || 'NIO', Number(localDoc?.exchangeRate || globalRate || 1));
                              newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice);
                            } else {
                              newItems[idx].description = 'Producto Customizado';
                              newItems[idx].unitPrice = 0;
                              newItems[idx].total = 0;
                            }
                            const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                            const dAmount = newSubtotal * (localRates.dRate / 100);
                            const base = newSubtotal - dAmount;
                            const tAmount = base * (localRates.tRate / 100);
                            const newTotal = base + tAmount;
                            setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                            void handleUpdate(localDoc!.id, { items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                          }}
                          placeholder={resolveItemType(item) === 'SERVICE' ? 'Seleccionar servicio...' : 'Seleccionar producto...'}
                          disabled={!localDoc?.customerId}
                        />
                      </div>
                      <SalesLinePriceListSelect 
                        productId={(productCatalog.find((product) => product.id === item.productId) || productCatalog.find((product) => String(product.name).trim() === String(item.description || '').trim()))?.id || item.productId} 
                        productCode={(productCatalog.find((product) => product.id === item.productId) || productCatalog.find((product) => String(product.name).trim() === String(item.description || '').trim()))?.code || item.code} 
                        itemType={item.itemType}
                        value={item.priceListId} 
                        defaultPriceListId={localDoc?.priceListId} 
                        currency={localDoc?.currency} 
                        exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)} 
                        onChange={(priceListId, result) => { 
                          const currentItem = localDoc?.items?.[idx];
                          // Guarda de idempotencia: no actualizar si el precio ya está aplicado
                          if (
                            currentItem &&
                            currentItem.priceListId === priceListId &&
                            Math.abs(Number(currentItem.unitPrice || 0) - Number(result.unitPrice || 0)) < 0.01 &&
                            !!currentItem.priceMissing === !!result.priceMissing
                          ) return;
                          const nextItems = [...(localDoc.items || [])] as any[]; 
                          nextItems[idx] = { 
                            ...nextItems[idx],
                            productId: (productCatalog.find((product) => product.id === item.productId) || productCatalog.find((product) => String(product.name).trim() === String(item.description || '').trim()))?.id || nextItems[idx].productId,
                            priceListId, 
                            unitPrice: result.unitPrice ?? 0, 
                            total: Number(nextItems[idx].quantity || 1) * Number(result.unitPrice ?? 0),
                            priceMissing: result.priceMissing 
                          }; 
                          const next = pricingMode === 'individual' ? recalculateIndividualPricing(nextItems) : recalculateGlobalPricing(nextItems); 
                          // Solo actualiza estado local — sin handleUpdate para evitar el loop
                          // PATCH → onRefresh → deleteMany+create → IDs cambian → re-mount → loop
                          // El precio se persiste en el próximo save explícito (cantidad, guardar borrador, etc.)
                          setLocalDoc({ ...localDoc, ...next } as any); 
                        }} 
                      />
                    </div>

                    {item.productId && (
                      <div className="mt-1 flex min-h-4 flex-wrap items-center gap-x-2 gap-y-1 px-1">
                        {(() => {
                          const p = products.find(x => x.id === item.productId);
                          if (!p) return null;
                          const stock = Number(p.stock || 0);
                          return (
                            <>
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-black border-none px-1.5 py-0 h-4 bg-muted/20",
                                stock <= 0 ? "text-rose-500 bg-rose-500/10" : "text-emerald-500 bg-emerald-500/10"
                              )}>
                                STOCK: {stock}
                              </Badge>
                              {item.priceMissing && <PriceMissingBadge />}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  {pricingMode === 'individual' && (
                    <div className="col-span-2 mt-0 flex min-w-0 items-start gap-2 self-start text-[10px]">
                      <label className="flex min-w-0 flex-1 flex-col items-start gap-1 font-black uppercase tracking-wider">
                        <span className="flex h-8 w-full items-center gap-1.5 rounded-md bg-muted/30 px-2">
                          <input
                            type="checkbox"
                            checked={Number(item.taxRate || 0) > 0}
                            onChange={(event) => {
                              const nextItems = [...(localDoc.items || [])] as any[];
                              nextItems[idx] = { ...nextItems[idx], taxRate: event.target.checked ? 15 : 0 };
                              const next = recalculateIndividualPricing(nextItems);
                              setLocalDoc({ ...localDoc, ...next } as any);
                              void handleUpdate(localDoc!.id, next as any);
                            }}
                          />
                          <span className="text-xs">Aplicar</span>
                        </span>
                      </label>
                      <label className="relative flex-1">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Desc.</span>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount || ''}
                          onChange={(event) => {
                            const nextItems = [...(localDoc.items || [])] as any[];
                            nextItems[idx] = { ...nextItems[idx], discount: Number(event.target.value) || 0 };
                            const next = recalculateIndividualPricing(nextItems);
                            setLocalDoc({ ...localDoc, ...next } as any);
                            void handleUpdate(localDoc!.id, next as any);
                          }}
                          className="h-8 w-full rounded-md bg-muted/30 pl-12 text-right text-xs"
                        />
                      </label>
                    </div>
                  )}
                  <div className={cn('min-w-0 xl:col-span-2', pricingMode === 'individual' && 'xl:col-span-1')}>
                    <Input 
                      type="number" 
                      min="0"
                      max={Number(products.find(x => x.id === item.productId)?.stock || 1000000)}
                      value={Number(item.quantity) || ''} 
                      placeholder="0"
                      onChange={(e) => {
                        let newQty = Number(e.target.value);
                        const p = products.find(x => x.id === item.productId);
                        if (p && newQty > Number(p.stock || 0)) {
                          toast.warning(`Stock insuficiente. Disponible: ${p.stock}`, { id: `stock-warn-${idx}` });
                          newQty = Number(p.stock || 0);
                        }
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems[idx].quantity = newQty;
                        newItems[idx].total = newQty * Number(newItems[idx].unitPrice || 0);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount;
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                        void handleUpdate(localDoc!.id, { items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                      }}
                      onBlur={() => {
                        handleUpdate(localDoc!.id, { items: localDoc.items, subtotal: localDoc.subtotal, discountAmount: localDoc.discountAmount, taxAmount: localDoc.taxAmount, total: localDoc.total });
                      }}
                      className="h-8 text-xs text-right" 
                    />
                  </div>
                  <div className="col-span-2 min-w-0">
                    <Input 
                      min="0"
                      type="text"
                      value={item.unitPrice === undefined || item.unitPrice === null ? '' : formatSalesAmount(item.unitPrice)} 
                      placeholder="0"
                      onChange={(e) => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems[idx].unitPrice = Number(String(e.target.value).replace(/,/g, ''));
                        newItems[idx].total = Number(newItems[idx].quantity || 0) * Number(newItems[idx].unitPrice);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount;
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                      }}
                      onBlur={() => {
                        handleUpdate(localDoc!.id, { items: localDoc.items, subtotal: localDoc.subtotal, discountAmount: localDoc.discountAmount, taxAmount: localDoc.taxAmount, total: localDoc.total });
                      }}
                      className="h-8 text-xs text-right" 
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span className="text-xs font-black w-16 text-right">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(item.total)}</span>
                    <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md" onClick={() => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems.splice(idx, 1);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount;
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                        void handleUpdate(localDoc!.id, { items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                    }}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay productos o servicios asignados a esta orden. Haz clic en "Agregar Item".
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {localDoc?.notes && (
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Notas</p><p className="text-sm">{localDoc.notes}</p></CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="sales-list-kpis">
        <SalesKpiCard title="Órdenes Abiertas" value={data.filter(o => (o.status||'').toUpperCase() === 'CONFIRMED').length} icon={Package} color="text-orange-500" bg="bg-orange-500/10" active={statusFilter === 'CONFIRMED'} onClick={() => setStatusFilter(statusFilter === 'CONFIRMED' ? 'ALL' : 'CONFIRMED')} />
        <SalesKpiCard title={`Monto Confirmado (${baseCurrency})`} value={formatConvertedAmount(confirmedAmountInDisplayCurrency, baseCurrency)} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-500/10" />
        <SalesKpiCard title="En Proceso" value={data.filter(o => (o.status||'').toUpperCase() === 'IN_PROGRESS').length} icon={Clock} color="text-blue-500" bg="bg-blue-500/10" active={statusFilter === 'IN_PROGRESS'} onClick={() => setStatusFilter(statusFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')} />
        <SalesKpiCard title="Total del Mes" value={data.length} icon={ClipboardList} color="text-purple-500" bg="bg-purple-500/10" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Órdenes de Venta</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Órdenes confirmadas listas para preparación y facturación.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="orders" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar orden..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setColumnConfigOpen(true)}
              className="h-10 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest"
            >
              <Settings2 className="mr-2 size-4" /> Columnas <span className="ml-1 text-muted-foreground">{visibleColumns.length}</span>
            </Button>
            <select
              value={layoutMode}
              onChange={(event) => setLayoutMode(event.target.value as 'table' | 'cards')}
              aria-label="Elegir distribución de órdenes"
              className="h-10 w-32 rounded-xl border border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-primary"
            >
              <option value="table">Lista</option>
              <option value="cards">Tarjetas</option>
            </select>
            {canPerform('SALES_ORDERS', 'create') && (
              <Button onClick={handleAddOrder} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Nueva Orden
              </Button>
            )}
          </div>
        </div>
        <EditableDataTable 
          data={filtered}
          pagination={pagination}
          showHorizontalControls
          actionsWidth="w-44"
          fitContent
          columns={visibleColumns}
          layoutMode={layoutMode}
          onRowUpdate={handleUpdate}
          onRowClick={(row) => setEditingId(row.id)}
          isLoading={loading}
          actions={(row) => (
            <div className="flex min-w-max items-center justify-end gap-2 pr-1">
                {canPerform('SALES_INVOICES', 'create') && (row.status || '').toUpperCase() !== 'CANCELLED' && !row.invoiceId && !row.invoiceNumber && (
                  <Button 
                    type="button"
                    title="Aprobar y enviar a Factura" 
                    aria-label="Aprobar y enviar a Factura"
                    onClick={() => void handleInvoiceOrder(row)}
                    disabled={invoicingOrderId === row.id}
                    variant="ghost" 
                    size="icon" 
                    className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors"
                  >
                    <ArrowRightCircle className={cn('size-4 text-muted-foreground', invoicingOrderId === row.id && 'animate-pulse')} />
                  </Button>
                )}
                <Button type="button" title="Ver detalle" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4 text-muted-foreground" /></Button>
                <Button type="button" title="Exportar PDF" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors" onClick={async () => { try { toast.promise(generateEstimatePDF({ estimate: row, tenantName: user?.tenantName || 'Empresa', formatAmount, tenantLogo: themeConfig?.logo, documentType: 'order' }), { loading: 'Generando PDF...', success: 'PDF generado exitosamente', error: 'Error al generar PDF' }); } catch (e: any) { console.error(e) } }}><FileDown className="size-4 text-muted-foreground" /></Button>
                {canPerform('SALES_ORDERS', 'delete') &&
                  !['CANCELLED', 'DELIVERED'].includes(String(row.status || '').toUpperCase()) &&
                  !row.invoiceId && !row.invoiceNumber && (
                  <Button
                    type="button"
                    title="Cancelar orden"
                    aria-label="Cancelar orden"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setPendingCancelId(row.id);
                    }}
                  >
                  <Ban className="size-4 text-muted-foreground" />
                  </Button>
                )}
             </div>
           )}
         />
       </div>

      <Dialog open={columnConfigOpen} onOpenChange={setColumnConfigOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" /> Configurar columnas</DialogTitle>
            <DialogDescription>Elige qué información quieres ver en la lista o en las tarjetas de órdenes de venta.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {columnOptions.map((option) => {
              const active = visibleColumnKeys.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setVisibleColumnKeys((current) => active
                    ? (current.length > 1 ? current.filter((key) => key !== option.key) : current)
                    : [...current, option.key])}
                  className={cn(
                    'flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-xs font-bold transition-colors',
                    active ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 bg-muted/10 text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <span>{option.label}</span>
                  {active && <Check className="size-4 text-primary" />}
                </button>
              );
            })}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setVisibleColumnKeys(columnOptions.map((option) => option.key))}>Mostrar todas</Button>
            <Button onClick={() => setColumnConfigOpen(false)}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => { if (!open && !cancelLoading) setPendingCancelId(null); }}
        title="¿Cancelar orden de venta?"
        description="La orden quedará cancelada y ya no podrá continuar al proceso de facturación."
        confirmLabel="Cancelar orden"
        variant="destructive"
        loading={cancelLoading}
        onConfirm={async () => {
          if (!pendingCancelId) return;
          try {
            setCancelLoading(true);
            await salesOrdersService.update(pendingCancelId, { status: 'cancelled' });
            toast.success('Orden cancelada');
            if (editingId === pendingCancelId) setEditingId(null);
            await onRefresh();
          } catch (error: any) {
            const message = error?.response?.data?.message || error?.message || 'Error al cancelar la orden';
            toast.error(Array.isArray(message) ? message.join(', ') : message);
          } finally {
            setCancelLoading(false);
            setPendingCancelId(null);
          }
        }}
      />

    </div>
  );
}

