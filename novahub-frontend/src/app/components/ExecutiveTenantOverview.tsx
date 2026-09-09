/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  FileDown,
  Loader2,
  Package,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShoppingCart,
  Store,
  TrendingDown,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { type Module, useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { useTenantQuery } from '../hooks/useTenantQuery';
import { cajaService } from '../services/caja.service';
import { safeGetItem, safeSetItem } from '../services/safe-storage';
import { CurrencyValuationAmount, CurrencyValuationBanner } from './ui/CurrencyValuation';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { BLOCKS, changeLabel, chartRows, dashboardRange, DEFAULT_PREFERENCES, INDICATORS, normalizePreferences, type DashboardBlock, type DashboardPeriod, type DashboardPreferences, type IndicatorDefinition } from './dashboard/executive-model';
import { buildDatedDownloadFileName } from '../utils/exportFileNames';
import { generateConfiguredReportTemplate, getPdfDesignSettings, pdfDesignPaper } from '../utils/pdfGenerator';
import './dashboard/executive-dashboard.css';

const ProductDetailDrawer = lazy(() => import('./inventory/ProductDetailDrawer').then((module) => ({ default: module.ProductDetailDrawer })));

interface ExecutiveTenantOverviewProps {
  onNavigate?: (module: Module) => void;
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  today: 'Hoy',
  month: 'Este mes',
  quarter: 'Este trimestre',
  year: 'Este año',
  custom: 'Rango personalizado',
};

const PRODUCT_TABS = [
  { id: 'topSelling', label: 'Más vendidos' },
  { id: 'leastSelling', label: 'Menos vendidos' },
  { id: 'noSaleProducts', label: 'Sin ventas' },
  { id: 'topMargin', label: 'Utilidad de referencia' },
] as const;

type ProductTab = typeof PRODUCT_TABS[number]['id'];

const CHART_COLORS = ['#08b78a', '#2563eb', '#f59e0b', '#ef6b73', '#7767d9', '#0ea5a4'];
const shortenLabel = (value: unknown, max = 18) => {
  const label = String(value || 'Sin nombre');
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
};

const formatDate = (value: string) => new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00Z`));

const safeNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROCESS: 'En proceso',
  IN_PROGRESS: 'En progreso',
  APPROVED: 'Aprobado',
  CONFIRMED: 'Confirmado',
  PAID: 'Pagada',
  PARTIAL: 'Pago parcial',
  DRAFT: 'Borrador',
  COMPLETED: 'Completado',
  SENT: 'Enviada',
  SUBMITTED: 'Enviada',
  IN_REVIEW: 'En revisión',
  PENDING_REVIEW: 'Pendiente de revisión',
  PENDING_APPROVAL: 'Pendiente de aprobación',
  IN_QUOTATION: 'En cotización',
  RETURNED_FOR_CORRECTION: 'Devuelta para corrección',
  CONVERTED_TO_ORDER: 'Convertida a orden',
  CLOSED: 'Cerrada',
  SHIPPED: 'Enviada',
  DELIVERED: 'Entregada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
  OVERDUE: 'Vencida',
  WITH_INCIDENTS: 'Con incidencias',
  ISSUED: 'Emitida',
  CREDIT: 'A crédito',
  REFUNDED: 'Reembolsada',
  VOIDED: 'Anulada',
  POSTED: 'Registrada',
};

const formatTransactionStatus = (value: unknown) => {
  const normalized = String(value || '').trim().toUpperCase();
  return TRANSACTION_STATUS_LABELS[normalized] || (normalized ? 'Sin estado' : 'Pagada');
};

const readPreferences = (key: string): DashboardPreferences => {
  const raw = safeGetItem(key);
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const getProductId = (item: any) => String(item?.productId || item?.id || '');

const getProductName = (item: any) => String(item?.name || item?.product?.name || 'Producto sin nombre');

const indicatorValue = (id: string, kpis: any, performance: any, data: any) => {
  const top = performance?.topSelling?.[0];
  const least = performance?.leastSelling?.[0];
  const margin = performance?.topMargin?.[0];
  const registers = Array.isArray(data?.salesByRegister) ? data.salesByRegister : [];
  const map: Record<string, string | number> = {
    totalRevenue: safeNumber(kpis?.totalRevenue),
    totalExpenses: safeNumber(kpis?.totalExpenses),
    paidInvoicesCount: safeNumber(kpis?.paidInvoicesCount),
    averagePaidInvoice: safeNumber(kpis?.averagePaidInvoice),
    operatingResult: safeNumber(kpis?.totalRevenue) - safeNumber(kpis?.totalExpenses),
    ordersCount: safeNumber(kpis?.ordersCount),
    pendingOrders: safeNumber(kpis?.pendingOrders),
    inventoryAlerts: new Set((data?.inventoryAlerts || []).map((row: any) => getProductId(row))).size,
    outOfStock: new Set((data?.inventoryAlerts || []).filter((row: any) => row.status === 'SIN_STOCK').map((row: any) => getProductId(row))).size,
    noSaleProducts: safeNumber(kpis?.noSaleProductsCount ?? performance?.noSaleProducts?.length),
    productsWithSales: safeNumber(kpis?.productsWithSalesCount ?? performance?.topSelling?.length),
    topSellingProduct: getProductName(top) || 'Sin datos',
    leastSellingProduct: getProductName(least) || 'Sin datos',
    topMarginProduct: getProductName(margin) || 'Sin datos',
    registersWithSales: registers.length,
    topRegister: registers[0]?.registerName || 'Sin datos',
  };
  return map[id] ?? '—';
};

function KpiValue({ definition, value, data }: { definition: IndicatorDefinition; value: string | number; data: any }) {
  const money = ['totalRevenue', 'totalExpenses', 'averagePaidInvoice', 'operatingResult'].includes(definition.id);
  if (!money) return <span className="executive-kpi-value">{typeof value === 'number' ? value.toLocaleString('es-NI') : value}</span>;
  const amount = typeof value === 'number' ? value : 0;
  return (
    <CurrencyValuationAmount
      amount={amount}
      sourceCurrency={data?.baseCurrency || 'NIO'}
      className="executive-kpi-value"
      showDifference={false}
      showMode={false}
    />
  );
}

function KpiIcon({ id }: { id: string }) {
  if (id.includes('Revenue') || id === 'averagePaidInvoice' || id === 'operatingResult') return <WalletCards />;
  if (id.includes('Expense')) return <TrendingDown />;
  if (id.includes('Product') || id.includes('Sale')) return <Package />;
  if (id.includes('Register')) return <Store />;
  if (id.includes('Order') || id.includes('Invoice')) return <ShoppingCart />;
  return <Activity />;
}

export function ExecutiveTenantOverview({ onNavigate }: ExecutiveTenantOverviewProps) {
  const { user, canPerform } = useAuth();
  const { baseCurrency, valuationMode, formatConvertedAmount } = useCurrency();
  const canViewPos = canPerform('RETAIL_POS', 'view') || canPerform('SALES', 'view');
  const canViewInventory = canPerform('INVENTORY_PRODUCTS', 'view') || canPerform('INVENTORY', 'view');
  const tenantKey = user?.clientTenantId || user?.tenantId || 'current';
  const storageKey = `novahub.dashboard.executive.v1.${tenantKey}.${user?.id || 'user'}`;
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => readPreferences(storageKey));
  const [draftPreferences, setDraftPreferences] = useState<DashboardPreferences>(() => readPreferences(storageKey));
  const [configOpen, setConfigOpen] = useState(false);
  const [configSearch, setConfigSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [productTab, setProductTab] = useState<ProductTab>('topSelling');
  const [productDrawerId, setProductDrawerId] = useState<string | null>(null);
  const [productSnapshot, setProductSnapshot] = useState<any>(null);
  const attentionRef = useRef<HTMLDivElement>(null);

  const range = useMemo(() => dashboardRange(period, dateFrom, dateTo), [period, dateFrom, dateTo]);
  const fetchDashboard = (start: string, end: string, signal: AbortSignal) => cajaService.getDashboard('custom', undefined, start, end, signal, valuationMode).then((response: any) => response?.data ?? response);
  const currentQuery = useTenantQuery<any>(['executive-dashboard', period, range?.start, range?.end, valuationMode], (signal) => fetchDashboard(range!.start, range!.end, signal), { enabled: canViewPos && Boolean(range) });
  const previousQuery = useTenantQuery<any>(['executive-dashboard-previous', period, range?.previousStart, range?.previousEnd, valuationMode], (signal) => fetchDashboard(range!.previousStart, range!.previousEnd, signal), { enabled: canViewPos && Boolean(range) });
  const data = currentQuery.data && typeof currentQuery.data === 'object' ? currentQuery.data : null;
  const kpis = data?.kpis || {};
  const performance = useMemo(() => data?.productPerformance || {}, [data]);
  const previous = previousQuery.data?.kpis || {};
  const alerts = useMemo(() => Array.isArray(data?.inventoryAlerts) ? data.inventoryAlerts : [], [data]);
  const registers = useMemo(() => Array.isArray(data?.salesByRegister) ? data.salesByRegister : [], [data]);
  const transactions = Array.isArray(data?.recentTransactions) ? data.recentTransactions : [];
  const trend = range ? chartRows(Array.isArray(data?.dailyTrend) ? data.dailyTrend : [], range) : [];

  useEffect(() => {
    const next = readPreferences(storageKey);
    const timer = window.setTimeout(() => {
      setPreferences(next);
      setDraftPreferences(next);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  const money = (amount: number) => formatConvertedAmount(safeNumber(amount), data?.baseCurrency || baseCurrency);
  const rangeLabel = range ? `${formatDate(range.start)} – ${formatDate(range.end)}` : 'Selecciona un rango válido';
  const alertCount = new Set(alerts.map((row: any) => getProductId(row))).size;
  const hasData = Boolean(data && data.kpis);
  const productSalesChart = useMemo(() => (performance.topSelling || []).slice(0, 6).map((item: any) => ({
    name: shortenLabel(getProductName(item)),
    value: safeNumber(item.totalQty),
  })).reverse(), [performance]);
  const productMarginChart = useMemo(() => (performance.topMargin || []).slice(0, 6).map((item: any) => ({
    name: shortenLabel(getProductName(item)),
    value: safeNumber(item.profit),
  })).reverse(), [performance]);
  const registerChart = useMemo(() => registers.slice(0, 6).map((item: any) => ({
    name: shortenLabel(item.registerName || item.registerCode || 'Caja'),
    value: safeNumber(item.total),
  })).reverse(), [registers]);
  const inventoryChart = useMemo(() => {
    const counts = alerts.reduce<Record<string, number>>((result, item: any) => {
      const key = item.status === 'SIN_STOCK' ? 'Sin stock' : item.status === 'STOCK_BAJO' ? 'Stock bajo' : 'Reordenar';
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).map(([name, value], index) => ({ name, value, fill: CHART_COLORS[index + 2] || CHART_COLORS[0] }));
  }, [alerts]);

  const toggleIndicator = (id: string, checked: boolean) => {
    setDraftPreferences((current) => ({ ...current, indicators: checked ? [...current.indicators, id] : current.indicators.filter((item) => item !== id) }));
  };

  const toggleBlock = (id: DashboardBlock, checked: boolean) => {
    setDraftPreferences((current) => ({ ...current, blocks: checked ? [...current.blocks, id] : current.blocks.filter((item) => item !== id) }));
  };

  const savePreferences = () => {
    const next = normalizePreferences(draftPreferences);
    if (!next.indicators.length) next.indicators = [...DEFAULT_PREFERENCES.indicators];
    if (!next.blocks.length) next.blocks = [...DEFAULT_PREFERENCES.blocks];
    setPreferences(next);
    setDraftPreferences(next);
    safeSetItem(storageKey, JSON.stringify(next));
    setConfigOpen(false);
    toast.success('Dashboard actualizado');
  };

  const exportDashboard = async () => {
    if (!hasData) {
      toast.error('No hay datos para exportar');
      return;
    }
    setIsExporting(true);
    try {
      const rows = preferences.indicators.map((id) => {
        const definition = INDICATORS.find((item) => item.id === id);
        const value = indicatorValue(id, kpis, performance, data);
        return { label: definition?.label || id, value: typeof value === 'number' ? money(value) : String(value), detail: definition?.description || '' };
      });
      const fileName = buildDatedDownloadFileName(['resumen_gestion'], 'pdf');
      const configured = await generateConfiguredReportTemplate({
        targetKey: 'dashboard.tenant-overview',
        title: 'Resumen de gestión',
        tenantName: user?.tenantName || user?.clientTenant?.name || 'Mi Empresa',
        tenantLogo: user?.clientTenant?.logo || '',
        rows,
        columns: [
          { header: 'Indicador', value: (row) => row.label },
          { header: 'Valor', value: (row) => row.value },
          { header: 'Detalle', value: (row) => row.detail },
        ],
        fileName,
      });
      if (configured) {
        toast.success('Resumen exportado en PDF');
        return;
      }

      const { default: jsPDF } = await import('jspdf');
      const settings = await getPdfDesignSettings('dashboard.tenant-overview');
      const doc = new jsPDF(pdfDesignPaper(settings));
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Resumen de gestión', pageWidth / 2, 20, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(110);
      doc.text(`Período: ${rangeLabel} · Generado: ${new Date().toLocaleDateString('es-NI')}`, pageWidth / 2, 28, { align: 'center' });
      doc.setTextColor(0);
      let y = 44;
      for (const row of rows) {
        doc.setFont('helvetica', 'bold');
        doc.text(row.label, 22, y);
        doc.setFont('helvetica', 'normal');
        doc.text(row.value, 105, y);
        y += 7;
      }
      doc.save(fileName);
      toast.success('Resumen exportado en PDF');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo exportar el resumen');
    } finally {
      setIsExporting(false);
    }
  };

  const navigate = (module: Module, detail?: Record<string, unknown>) => {
    onNavigate?.(module);
    window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module, ...(detail || {}) } }));
  };

  const openProduct = (item: any) => {
    const productId = getProductId(item);
    if (!productId) return;
    setProductSnapshot(item);
    setProductDrawerId(productId);
  };

  const openKpi = (definition: IndicatorDefinition) => {
    if (definition.id.includes('Product') || definition.id === 'noSaleProducts' || definition.id === 'inventoryAlerts' || definition.id === 'outOfStock') {
      if (definition.id === 'topSellingProduct') return openProduct(performance.topSelling?.[0]);
      if (definition.id === 'leastSellingProduct') return openProduct(performance.leastSelling?.[0]);
      if (definition.id === 'topMarginProduct') return openProduct(performance.topMargin?.[0]);
      attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const target: Record<string, unknown> = definition.id === 'totalExpenses'
      ? { subModule: 'egresos' }
      : definition.id === 'operatingResult'
        ? { subModule: 'resumen-financiero' }
        : definition.id === 'registersWithSales' || definition.id === 'topRegister'
          ? { subModule: 'control-caja', section: 'history', registerId: 'ALL' }
          : definition.id === 'ordersCount' || definition.id === 'pendingOrders'
            ? { subModule: 'ordenes-venta' }
            : { subModule: 'facturas' };
    navigate(definition.id === 'totalExpenses' || definition.id === 'operatingResult' ? 'finanzas' : 'ventas', target);
  };

  const openTransaction = (transaction: any) => {
    const destination = transaction?.destination;
    if (destination?.module) {
      navigate(destination.module as Module, { subModule: destination.subModule, targetId: destination.id, invoiceId: destination.subModule === 'facturas' ? destination.id : undefined, orderId: destination.subModule === 'ordenes-venta' ? destination.id : undefined });
      return;
    }
    navigate('ventas', { subModule: 'facturas', invoiceId: transaction?.id });
  };

  const productRows = useMemo(() => {
    if (productTab === 'noSaleProducts') return (performance.noSaleProducts || []).slice(0, 6);
    if (productTab === 'leastSelling') return (performance.leastSelling || []).slice(0, 6);
    if (productTab === 'topMargin') return (performance.topMargin || []).slice(0, 6);
    return (performance.topSelling || []).slice(0, 6);
  }, [performance, productTab]);

  const visibleIndicators = INDICATORS.filter((definition) => definition.label.toLowerCase().includes(configSearch.toLowerCase()) || definition.description.toLowerCase().includes(configSearch.toLowerCase()));
  const groupedIndicators = visibleIndicators.reduce<Record<string, IndicatorDefinition[]>>((groups, definition) => { (groups[definition.group] ||= []).push(definition); return groups; }, {});

  if (!canViewPos) {
    return <div className="executive-empty"><ShieldAlert /><h2>Resumen no disponible</h2><p>Tu usuario no tiene acceso al módulo de ventas y caja que alimenta este resumen.</p></div>;
  }

  return (
    <div className="executive-dashboard">
      <header className="executive-header">
        <div>
          <div className="executive-eyebrow"><span className="executive-eyebrow-dot" /> Panel ejecutivo</div>
          <h1>Resumen de gestión</h1>
        </div>
        <div className="executive-toolbar">
          <Select value={period} onValueChange={(value) => setPeriod(value as DashboardPeriod)}>
            <SelectTrigger className="executive-period"><CalendarDays className="size-4" /><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PERIOD_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" className="executive-toolbar-button" onClick={() => void exportDashboard()} disabled={isExporting || currentQuery.isFetching}><FileDown className="size-4" /> {isExporting ? 'Exportando…' : 'Exportar'}</Button>
          <Button variant="outline" className="executive-toolbar-button" onClick={() => { setDraftPreferences(preferences); setConfigOpen(true); }}><Settings2 className="size-4" /> Configurar</Button>
          <Button variant="outline" size="icon" className="executive-toolbar-icon" onClick={() => void currentQuery.refetch()} aria-label="Actualizar dashboard"><RefreshCw className={`size-4 ${currentQuery.isFetching ? 'animate-spin' : ''}`} /></Button>
        </div>
      </header>

      {period === 'custom' && <div className="executive-date-row"><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Fecha inicial" /><span>hasta</span><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="Fecha final" /></div>}
      <div className="executive-meta-row"><span>Período: <strong>{rangeLabel}</strong></span><span className="executive-meta-separator">•</span><span>{data?.generatedAt ? `Actualizado ${new Date(data.generatedAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}` : 'Actualización automática'}</span><span className="executive-meta-spacer" /><span className="executive-live-dot" /> Datos del tenant actual</div>
      <CurrencyValuationBanner className="mb-5" compact />

      {currentQuery.isPending && <div className="executive-loading"><Loader2 className="animate-spin" /><span>Preparando el resumen de gestión…</span></div>}
      {currentQuery.isError && <div className="executive-error"><AlertTriangle /><div><strong>No pudimos cargar el resumen.</strong><span>La información operativa no se modificó. Intenta actualizar nuevamente.</span></div><Button variant="outline" onClick={() => void currentQuery.refetch()}>Reintentar</Button></div>}
      {!currentQuery.isPending && !currentQuery.isError && !hasData && <div className="executive-empty"><CircleHelp /><h2>Sin datos para este período</h2><p>Prueba con otro período o registra una operación para comenzar a ver indicadores.</p></div>}

      {hasData && <>
        <section className="executive-kpi-grid" aria-label="Indicadores principales">
          {preferences.indicators.map((id) => {
            const definition = INDICATORS.find((item) => item.id === id);
            if (!definition) return null;
            const value = indicatorValue(id, kpis, performance, data);
            const previousValue = typeof value === 'number' && ['totalRevenue', 'totalExpenses', 'ordersCount', 'paidInvoicesCount', 'averagePaidInvoice'].includes(id) ? safeNumber(previous[id]) : undefined;
            const change = changeLabel(typeof value === 'number' ? value : 0, previousValue);
            return <button type="button" key={id} className="executive-kpi" onClick={() => openKpi(definition)} title={`Abrir detalle de ${definition.label}`}><span className="executive-kpi-top"><span className="executive-kpi-icon"><KpiIcon id={id} /></span><span className="executive-kpi-label">{definition.label}</span><ArrowUpRight className="executive-kpi-arrow" /></span><KpiValue definition={definition} value={value} data={data} />{change && <span className={`executive-kpi-change ${change.startsWith('-') ? 'is-negative' : 'is-positive'}`}>{change} vs. período anterior</span>}</button>;
          })}
        </section>

        <div className="executive-chart-wall" aria-label="Gráficas ejecutivas">
          {preferences.blocks.includes('trend') && <section className="executive-panel executive-chart-card executive-chart-card-trend">
            <div className="executive-panel-heading"><div><span className="executive-section-kicker">Tendencia</span><h2>Ventas y gastos</h2></div><span className="executive-panel-caption">{(range?.days || 0) > 62 ? 'Por mes' : 'Por día'}</span></div>
            <div className="executive-chart executive-chart-wall-trend"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}><defs><linearGradient id="executiveRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} /></linearGradient><linearGradient id="executiveExpenses" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" /><XAxis dataKey="date" tickFormatter={(value) => String(value).length > 7 ? String(value).slice(5) : formatDate(String(value))} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} minTickGap={28} /><YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} tickFormatter={(value) => money(value).replace(/\s/g, '')} /><Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11 }} formatter={(value: number, name: string) => [money(value), name === 'revenue' ? 'Ventas' : 'Gastos']} labelFormatter={(label) => String(label).length > 7 ? String(label) : formatDate(String(label))} /><Area type="monotone" dataKey="revenue" name="revenue" stroke="var(--primary)" fill="url(#executiveRevenue)" strokeWidth={2.5} /><Area type="monotone" dataKey="expenses" name="expenses" stroke="#f59e0b" fill="url(#executiveExpenses)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div><div className="executive-legend"><span><i className="legend-dot revenue" /> Ventas</span><span><i className="legend-dot expenses" /> Gastos</span></div>
          </section>}

          {preferences.blocks.includes('products') && <section className="executive-panel executive-chart-card executive-chart-card-sales">
            <div className="executive-panel-heading"><div><span className="executive-section-kicker">Volumen</span><h2>Ventas por producto</h2></div><BarChart3 className="executive-chart-heading-icon" /></div>
            <div className="executive-mini-chart">{productSalesChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={productSalesChart} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}><CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={112} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} /><Tooltip cursor={{ fill: 'var(--muted)', opacity: .3 }} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11 }} formatter={(value: number) => [`${safeNumber(value).toLocaleString('es-NI')} uds.`, 'Unidades']} /><Bar dataKey="value" fill="var(--primary)" radius={[0, 6, 6, 0]} barSize={16} /></BarChart></ResponsiveContainer> : <div className="executive-no-data">Sin ventas</div>}</div>
          </section>}

          {preferences.blocks.includes('products') && <section className="executive-panel executive-chart-card executive-chart-card-margin">
            <div className="executive-panel-heading"><div><span className="executive-section-kicker">Rentabilidad</span><h2>Utilidad por producto</h2></div><WalletCards className="executive-chart-heading-icon" /></div>
            <div className="executive-mini-chart">{productMarginChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={productMarginChart} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}><CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={112} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} /><Tooltip cursor={{ fill: 'var(--muted)', opacity: .3 }} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11 }} formatter={(value: number) => [money(value), 'Utilidad']} /><Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={16} /></BarChart></ResponsiveContainer> : <div className="executive-no-data">Sin datos de utilidad</div>}</div>
          </section>}

          {preferences.blocks.includes('registers') && <section className="executive-panel executive-chart-card executive-chart-card-registers">
            <div className="executive-panel-heading"><div><span className="executive-section-kicker">Puntos de venta</span><h2>Ventas por caja</h2></div><Store className="executive-chart-heading-icon" /></div>
            <div className="executive-mini-chart">{registerChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={registerChart} margin={{ top: 8, right: 8, left: -18, bottom: 2 }}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} /><YAxis hide /><Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11 }} formatter={(value: number) => [money(value), 'Ventas']} /><Bar dataKey="value" fill="#7767d9" radius={[6, 6, 0, 0]} barSize={28} /></BarChart></ResponsiveContainer> : <div className="executive-no-data">Sin ventas por caja</div>}</div>
          </section>}

          {preferences.blocks.includes('attention') && <section className="executive-panel executive-chart-card executive-chart-card-inventory">
            <div className="executive-panel-heading"><div><span className="executive-section-kicker">Existencias</span><h2>Estado del inventario</h2></div><Package className="executive-chart-heading-icon" /></div>
            <div className="executive-donut-wrap">{inventoryChart.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={inventoryChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={53} outerRadius={79} paddingAngle={4} stroke="none">{inventoryChart.map((entry: any) => <Cell key={entry.name} fill={entry.fill} />)}</Pie><Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11 }} formatter={(value: number) => [`${safeNumber(value)} productos`, 'Cantidad']} /></PieChart></ResponsiveContainer> : <div className="executive-no-data">Inventario sin alertas</div>}</div>
            <div className="executive-chart-legend">{inventoryChart.map((entry: any) => <span key={entry.name}><i style={{ background: entry.fill }} />{entry.name}<strong>{entry.value}</strong></span>)}</div>
          </section>}
        </div>

        <div className="executive-section-grid executive-attention-grid">
          {preferences.blocks.includes('attention') && <section ref={attentionRef} className="executive-panel executive-attention-panel"><div className="executive-panel-heading"><div><span className="executive-section-kicker">Prioridades</span><h2>Atención requerida</h2></div><span className="executive-attention-count">{alertCount} alertas</span></div><div className="executive-attention-list"><button type="button" className="executive-attention-row" onClick={() => navigate('ventas', { subModule: 'ordenes-venta' })}><span className="executive-attention-icon orange"><ShoppingCart /></span><span><strong>{safeNumber(kpis.pendingOrders)} órdenes abiertas</strong><small>Seguimiento comercial y despacho</small></span><ChevronRight /></button><button type="button" className="executive-attention-row" onClick={() => navigate('inventario', { subModule: 'productos', stockFilter: 'low' })}><span className="executive-attention-icon red"><AlertTriangle /></span><span><strong>{alertCount} productos requieren revisión</strong><small>Agotados, bajo mínimo o por reordenar</small></span><ChevronRight /></button><button type="button" className="executive-attention-row" onClick={() => setProductTab('noSaleProducts')}><span className="executive-attention-icon blue"><Package /></span><span><strong>{safeNumber(kpis.noSaleProductsCount ?? performance.noSaleProducts?.length)} productos sin ventas</strong><small>Con stock disponible en el período</small></span><ChevronRight /></button></div><div className="executive-panel-footer"><span><CircleHelp className="size-3.5" /> Las alertas muestran productos distintos, aunque existan en varias ubicaciones.</span></div></section>}
        </div>

        <div className="executive-section-grid lower">
          {preferences.blocks.includes('products') && canViewInventory && <section className="executive-panel executive-products-panel"><div className="executive-panel-heading"><div><span className="executive-section-kicker">Catálogo</span><h2>Desempeño de productos</h2></div><button type="button" className="executive-text-button" onClick={() => navigate('inventario', { subModule: 'productos' })}>Abrir inventario <ArrowUpRight /></button></div><div className="executive-tabs" role="tablist">{PRODUCT_TABS.map((tab) => <button type="button" key={tab.id} className={productTab === tab.id ? 'active' : ''} onClick={() => setProductTab(tab.id)}>{tab.label}</button>)}</div><div className="executive-product-list">{productRows.length ? productRows.map((product: any, index: number) => <button type="button" className="executive-product-row" key={`${getProductId(product)}-${index}`} onClick={() => openProduct(product)}><span className="executive-product-rank">{String(index + 1).padStart(2, '0')}</span><span className="executive-product-main"><strong>{getProductName(product)}</strong><small>{product.code || 'Sin código'} {product.totalQty != null ? `· ${safeNumber(product.totalQty).toLocaleString('es-NI')} unidades` : product.stock != null ? `· ${safeNumber(product.stock).toLocaleString('es-NI')} en stock` : ''}</small></span><span className="executive-product-value">{productTab === 'topMargin' && product.profit != null ? money(product.profit) : productTab === 'noSaleProducts' ? `${safeNumber(product.stock).toLocaleString('es-NI')} uds.` : money(product.totalRevenue || 0)}<ArrowUpRight /></span></button>) : <div className="executive-no-data">No hay productos suficientes para este ranking.</div>}</div></section>}

          {preferences.blocks.includes('registers') && <section className="executive-panel executive-registers-panel"><div className="executive-panel-heading"><div><span className="executive-section-kicker">Puntos de venta</span><h2>Ventas por caja</h2></div><button type="button" className="executive-text-button" onClick={() => navigate('ventas', { subModule: 'control-caja', section: 'history', registerId: 'ALL' })}>Ver control de caja <ArrowUpRight /></button></div><div className="executive-register-list">{registers.length ? registers.slice(0, 6).map((register: any, index: number) => { const max = Math.max(...registers.map((item: any) => safeNumber(item.total)), 1); const percent = Math.round(safeNumber(register.total) / max * 100); return <button type="button" className="executive-register-row" key={register.registerId || index} onClick={() => navigate('ventas', { subModule: 'control-caja', section: 'history', registerId: register.registerId })}><span className="executive-register-label"><span><Store className="size-4" /> {register.registerName || `Caja ${register.registerCode}`}</span><strong>{money(register.total)}</strong></span><span className="executive-progress"><i style={{ width: `${percent}%` }} /></span><small>{safeNumber(register.count)} operaciones · {percent}% de la caja líder</small></button>; }) : <div className="executive-no-data">No hay ventas por caja en el período.</div>}</div></section>}
        </div>

        {preferences.blocks.includes('transactions') && <section className="executive-panel executive-transactions-panel"><div className="executive-panel-heading"><div><span className="executive-section-kicker">Trazabilidad</span><h2>Actividad reciente</h2></div><button type="button" className="executive-text-button" onClick={() => navigate('ventas', { subModule: 'facturas' })}>Ver facturas <ArrowUpRight /></button></div><div className="executive-table-wrap"><table><thead><tr><th>Documento</th><th>Origen</th><th>Cliente</th><th className="align-right">Monto</th><th>Estado</th></tr></thead><tbody>{transactions.slice(0, 8).map((transaction: any, index: number) => <tr key={`${transaction.id || 'transaction'}-${index}`} onClick={() => openTransaction(transaction)}><td><strong>{transaction.number || `Factura ${index + 1}`}</strong><small>{transaction.date ? new Date(transaction.date).toLocaleDateString('es-NI') : '—'}</small></td><td>{transaction.register?.name || transaction.origin || 'Factura de venta'}</td><td>{transaction.customer || 'Cliente general'}</td><td className="align-right"><CurrencyValuationAmount amount={safeNumber(transaction.sourceTotal ?? transaction.total)} sourceCurrency={transaction.currency || data?.baseCurrency} sourceExchangeRate={transaction.exchangeRate} showDifference={false} /></td><td><span className="executive-status"><Check className="size-3" /> {formatTransactionStatus(transaction.status)}</span></td></tr>)}</tbody></table>{!transactions.length && <div className="executive-no-data">No hay transacciones recientes en este período.</div>}</div></section>}
      </>}

      <div className="executive-footnote"><CircleHelp className="size-4" /><span>Los importes de ventas y gastos provienen del resumen de Caja. Para utilidad contable, costo de ventas, cuentas por cobrar y cuentas por pagar, utiliza los reportes financieros y contables.</span></div>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}><DialogContent className="executive-config-dialog sm:!max-w-3xl"><DialogHeader><DialogTitle className="executive-dialog-title"><Settings2 /> Configurar resumen de gestión</DialogTitle><DialogDescription>Elige los indicadores y bloques que ayudan a tu rol a decidir más rápido. Las selecciones se guardan para este usuario y tenant.</DialogDescription></DialogHeader><div className="executive-config-search"><Input placeholder="Buscar indicador…" value={configSearch} onChange={(event) => setConfigSearch(event.target.value)} /><span>{draftPreferences.indicators.length} indicadores seleccionados</span></div><div className="executive-config-body"><div className="executive-config-column"><h3>Indicadores</h3>{Object.entries(groupedIndicators).map(([group, definitions]) => <section key={group} className="executive-config-group"><div className="executive-config-group-title">{group}</div>{definitions.map((definition) => { const checked = draftPreferences.indicators.includes(definition.id); const allowed = !definition.permission || canPerform(definition.permission, 'view'); return <label key={definition.id} className={`executive-config-item ${!allowed ? 'disabled' : ''}`}><Checkbox checked={checked} disabled={!allowed} onCheckedChange={(value) => toggleIndicator(definition.id, value === true)} /><span><strong>{definition.label}</strong><small>{definition.description}</small><em>Decisión: {definition.decision}</em></span></label>; })}</section>)}</div><div className="executive-config-column"><h3>Bloques de información</h3>{BLOCKS.map((block) => { const allowed = !block.permission || canPerform(block.permission, 'view'); return <label key={block.id} className={`executive-config-item ${!allowed ? 'disabled' : ''}`}><Checkbox checked={draftPreferences.blocks.includes(block.id)} disabled={!allowed} onCheckedChange={(value) => toggleBlock(block.id, value === true)} /><span><strong>{block.label}</strong><small>{block.description}</small></span></label>; })}<div className="executive-config-callout"><CircleHelp /><span>Los clics en tarjetas, rankings, cajas y transacciones abren el detalle operativo correspondiente.</span></div></div></div><DialogFooter><Button variant="outline" onClick={() => setDraftPreferences(DEFAULT_PREFERENCES)}>Restaurar recomendados</Button><Button onClick={savePreferences}><Check className="size-4" /> Aplicar cambios</Button></DialogFooter></DialogContent></Dialog>
      {productDrawerId && <Suspense fallback={null}><ProductDetailDrawer productId={productDrawerId} productSnapshot={productSnapshot} onOpenChange={(open) => { if (!open) { setProductDrawerId(null); setProductSnapshot(null); } }} /></Suspense>}
    </div>
  );
}
