/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Package,
  Receipt,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShoppingCart,
  Store,
  TrendingDown,
  WalletCards,
} from 'lucide-react';
import { NovaHubLogo } from './NovaHubLogo';
import {
  Area,
  AreaChart,
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
import { useTheme } from '../contexts/ThemeContext';
import { useTenantQuery } from '../hooks/useTenantQuery';
import { cajaService } from '../services/caja.service';
import { inventoryService } from '../services/inventario.service';
import { safeGetItem, safeSetItem } from '../services/safe-storage';
import type { PdfTemplateChart } from '../services/pdf-template-definition';
import { loadModuleWithChunkRecovery } from '../utils/chunk-recovery';
import { CurrencyValuationAmount, CurrencyValuationBanner } from './ui/CurrencyValuation';
import { ProductThumbnail } from './ui/ProductImage';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { DateField } from './ui/DateField';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from '@/app/services/toast';
import { BLOCKS, changeLabel, chartRows, dashboardRange, DEFAULT_PREFERENCES, INDICATORS, normalizePreferences, type DashboardBlock, type DashboardPeriod, type DashboardPreferences, type IndicatorDefinition } from './dashboard/executive-model';
import { buildDatedDownloadFileName } from '../utils/exportFileNames';
import { generateConfiguredReportSectionsPDF } from '../utils/pdfGenerator';
import { capturePdfChartSnapshot, yieldToBrowser } from '../utils/pdf-template-renderer';
import { createReportWorkbook } from '../utils/reportWorkbook';
import { getBase64Image } from '../utils/reportExportUtils';
import salesKpiAsset from '../../assets/dashboard/VentasPagadas.png';
import expensesKpiAsset from '../../assets/dashboard/GastosRegistrados.png';
import invoicesKpiAsset from '../../assets/dashboard/FacturasPagadas.png';
import ticketKpiAsset from '../../assets/dashboard/TicketVentaPagada.png';
import capitalAsset from '../../assets/dashboard/CapitalInmovilizado.png';
import reposicionAsset from '../../assets/dashboard/Reposicion.png';
import signalsAsset from '../../assets/dashboard/Senales.png';
import noSalesRegisterAsset from '../../assets/dashboard/NoHayVentasPorCaja.png';
import './dashboard/executive-dashboard.css';

const ProductDetailDrawer = lazy(() =>
  loadModuleWithChunkRecovery(
    () => import('./inventory/ProductDetailDrawer').then((module) => ({ default: module.ProductDetailDrawer })),
    'executive-product-detail-drawer',
  ),
);

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

const CHART_COLORS = ['#01422c', '#74c044', '#0a6b48', '#4f936d', '#a0cf82', '#2563eb'];
const INVENTORY_COLORS: Record<string, string> = {
  'Sin stock': '#ef3340',
  'Stock bajo': '#74c044',
  Reordenar: '#01422c',
};
const KPI_ASSETS: Record<string, string> = {
  totalRevenue: salesKpiAsset,
  totalExpenses: expensesKpiAsset,
  paidInvoicesCount: invoicesKpiAsset,
  averagePaidInvoice: ticketKpiAsset,
};
const formatDate = (value: string) => new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00Z`));

const safeNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const COST_DERIVED_INDICATORS = ['operatingMargin', 'grossMargin', 'commercialMargin', 'netMargin', 'profitability', 'netProfit'];

const readPreferences = (key: string): DashboardPreferences => {
  const stored = safeGetItem(key);
  const raw = stored
    || safeGetItem(key.replace('.v4.', '.v3.'))
    || safeGetItem(key.replace('.v4.', '.v2.'))
    || safeGetItem(key.replace('.v4.', '.v1.'));
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const normalized = normalizePreferences(JSON.parse(raw));
    if (!stored && key.includes('.v4.')) {
      const migratedIndicators = [...new Set(normalized.indicators.map((id) => id === 'netMargin' ? 'operatingMargin' : id))];
      return {
        ...normalized,
        indicators: migratedIndicators.includes('operatingMargin') ? migratedIndicators : [...migratedIndicators, 'operatingMargin'],
        blocks: [...new Set([...normalized.blocks, ...DEFAULT_PREFERENCES.blocks])],
      };
    }
    return normalized;
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
    netProfit: safeNumber(kpis?.netProfit),
    operatingMargin: safeNumber(kpis?.operatingMargin),
    grossMargin: safeNumber(kpis?.grossMargin),
    commercialMargin: safeNumber(kpis?.commercialMargin),
    netMargin: safeNumber(kpis?.netMargin),
    profitability: safeNumber(kpis?.profitability),
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
  if (COST_DERIVED_INDICATORS.includes(definition.id) && data?.kpis?.hasComparableCostData === false) {
    return <span className="executive-kpi-value executive-kpi-value-muted" title="Configura el costo unitario de los productos para calcular este indicador">—</span>;
  }
  if (['operatingMargin', 'grossMargin', 'commercialMargin', 'netMargin', 'profitability'].includes(definition.id)) return <span className="executive-kpi-value">{safeNumber(value).toFixed(1)}%</span>;
  const money = ['totalRevenue', 'totalExpenses', 'averagePaidInvoice', 'operatingResult', 'netProfit'].includes(definition.id);
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
  const asset = KPI_ASSETS[id];
  if (asset) return <img src={asset} alt="" className="executive-kpi-asset" />;
  if (id === 'totalRevenue' || id === 'operatingResult') return <Banknote />;
  if (id.includes('Expense')) return <TrendingDown />;
  if (id === 'averagePaidInvoice') return <WalletCards />;
  if (id.includes('Product') || id.includes('Sale')) return <Package />;
  if (id.includes('Register')) return <Store />;
  if (id === 'netMargin') return <Activity />;
  if (id.includes('Invoice')) return <Receipt />;
  if (id.includes('Order')) return <ShoppingCart />;
  return <Activity />;
}

export function ExecutiveTenantOverview({ onNavigate }: ExecutiveTenantOverviewProps) {
  const { user, canPerform } = useAuth();
  const { baseCurrency, valuationMode, formatConvertedAmount } = useCurrency();
  const { themeConfig } = useTheme();
  const canViewPos = canPerform('RETAIL_POS', 'view') || canPerform('SALES', 'view');
  const canViewInventory = canPerform('INVENTORY_PRODUCTS', 'view') || canPerform('INVENTORY', 'view');
  const tenantKey = user?.clientTenantId || user?.tenantId || 'current';
  const storageKey = `novahub.dashboard.executive.v4.${tenantKey}.${user?.id || 'user'}`;
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => readPreferences(storageKey));
  const [draftPreferences, setDraftPreferences] = useState<DashboardPreferences>(() => readPreferences(storageKey));
  const [configOpen, setConfigOpen] = useState(false);
  const [configSearch, setConfigSearch] = useState('');
  const [rangeEditorOpen, setRangeEditorOpen] = useState(false);
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [trendGranularity, setTrendGranularity] = useState<'day' | 'month'>('day');
  const [productMetric, setProductMetric] = useState<'units' | 'revenue'>('units');
  const [productDrawerId, setProductDrawerId] = useState<string | null>(null);
  const [productSnapshot, setProductSnapshot] = useState<any>(null);
  const [formulaProduct, setFormulaProduct] = useState<any>(null);

  const range = useMemo(() => dashboardRange(period, dateFrom, dateTo), [period, dateFrom, dateTo]);
  const openRangeEditor = () => {
    setDraftDateFrom(period === 'custom' ? dateFrom : range?.start || '');
    setDraftDateTo(period === 'custom' ? dateTo : range?.end || '');
    setRangeEditorOpen(true);
  };
  const applyDateRange = () => {
    if (!dashboardRange('custom', draftDateFrom, draftDateTo)) {
      toast.error('Selecciona una fecha inicial y una fecha final válidas.');
      return;
    }
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setPeriod('custom');
    setRangeEditorOpen(false);
  };
  const fetchDashboard = (start: string, end: string, signal: AbortSignal) => cajaService.getDashboard('custom', undefined, start, end, signal, valuationMode).then((response: any) => response?.data ?? response);
  const currentQuery = useTenantQuery<any>(['executive-dashboard', period, range?.start, range?.end, valuationMode], (signal) => fetchDashboard(range!.start, range!.end, signal), { enabled: canViewPos && Boolean(range) });
  const previousQuery = useTenantQuery<any>(['executive-dashboard-previous', period, range?.previousStart, range?.previousEnd, valuationMode], (signal) => fetchDashboard(range!.previousStart, range!.previousEnd, signal), { enabled: canViewPos && Boolean(range) });
  const inventoryQuery = useTenantQuery<any>(['executive-inventory-insights', tenantKey], (signal) => inventoryService.getDashboardInsights(signal).then((response: any) => response?.data ?? response), { enabled: canViewInventory });
  const registersQuery = useTenantQuery<any[]>(['executive-dashboard-registers', tenantKey], (signal) => cajaService.getRegisters(true, signal).then((response: any) => response?.data ?? response), { enabled: canViewPos });
  const data = currentQuery.data && typeof currentQuery.data === 'object' ? currentQuery.data : null;
  const kpis = data?.kpis || {};
  const performance = useMemo(() => data?.productPerformance || {}, [data]);
  const previous = previousQuery.data?.kpis || {};
  const alerts = useMemo(() => Array.isArray(data?.inventoryAlerts) ? data.inventoryAlerts : [], [data]);
  const registers = useMemo(() => Array.isArray(data?.salesByRegister) ? data.salesByRegister : [], [data]);
  const registerDirectory = useMemo(() => (Array.isArray(registersQuery.data) ? registersQuery.data : []).filter((register: any) => register?.isActive !== false), [registersQuery.data]);
  const registerSummary = useMemo(() => {
    const salesById = new Map(registers.map((item: any) => [String(item.registerId), item]));
    const configured = registerDirectory.map((register: any) => {
      const sale = salesById.get(String(register.id));
      return {
        registerId: register.id,
        registerCode: register.code,
        registerName: register.name,
        total: safeNumber(sale?.total),
        count: safeNumber(sale?.count),
      };
    });
    const known = new Set(configured.map((item: any) => String(item.registerId)));
    const missingSales = registers.filter((item: any) => !known.has(String(item.registerId)));
    return [...configured, ...missingSales].sort((a: any, b: any) => String(a.registerCode || a.registerName || '').localeCompare(String(b.registerCode || b.registerName || ''), 'es'));
  }, [registerDirectory, registers]);
  const trend = range ? chartRows(Array.isArray(data?.dailyTrend) ? data.dailyTrend : [], range, trendGranularity) : [];
  const inventoryInsights = inventoryQuery.data && typeof inventoryQuery.data === 'object' ? inventoryQuery.data : null;
  const inventorySummary = inventoryInsights?.inventory || {};

  useEffect(() => {
    const next = readPreferences(storageKey);
    const timer = window.setTimeout(() => {
      setPreferences(next);
      setDraftPreferences(next);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  const money = (amount: number) => formatConvertedAmount(safeNumber(amount), data?.baseCurrency || baseCurrency);
  const compactAxis = (value: number) => {
    const label = money(value).replace(/\s/g, '');
    const symbol = label.replace(/[\d.,-]/g, '');
    const parsed = Number(label.replace(/[^\d.,-]/g, '').replace(/,/g, ''));
    const compact = new Intl.NumberFormat('es-NI', { notation: 'compact', maximumFractionDigits: 1 }).format(Number.isFinite(parsed) ? parsed : 0);
    return `${symbol}${compact}`;
  };
  const rangeLabel = range ? `${formatDate(range.start)} – ${formatDate(range.end)}` : 'Selecciona un rango válido';
  const alertCount = new Set(alerts.map((row: any) => getProductId(row))).size;
  const hasData = Boolean(data && data.kpis);
  const productSalesChart = useMemo(() => (performance.topSelling || []).slice(0, 6).map((item: any) => ({
    productId: getProductId(item),
    name: getProductName(item),
    value: productMetric === 'revenue' ? safeNumber(item.totalRevenue) : safeNumber(item.totalQty),
    imageUrl: item.imageUrl || null,
    raw: item,
  })).reverse(), [performance, productMetric]);
  const productMarginChart = useMemo(() => (performance.topMargin || []).slice(0, 6).map((item: any) => ({
    productId: getProductId(item),
    name: getProductName(item),
    value: safeNumber(item.profit),
    imageUrl: item.imageUrl || null,
    raw: item,
  })).reverse(), [performance]);
  const inventoryChart = useMemo(() => {
    const statusCounts = data?.inventoryStatusCounts;
    if (statusCounts && Number.isFinite(Number(statusCounts.total))) {
      return [
        { name: 'Reordenar', value: safeNumber(statusCounts.reorder), fill: INVENTORY_COLORS.Reordenar },
        { name: 'Sin stock', value: safeNumber(statusCounts.outOfStock), fill: INVENTORY_COLORS['Sin stock'] },
        { name: 'Óptimo', value: safeNumber(statusCounts.optimal), fill: '#74c044' },
      ];
    }
    const counts = alerts.reduce((result: Record<string, number>, item: any) => {
      const key = item.status === 'SIN_STOCK' ? 'Sin stock' : item.status === 'STOCK_BAJO' ? 'Stock bajo' : 'Reordenar';
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {} as Record<string, number>);
    return ['Reordenar', 'Sin stock', 'Stock bajo']
      .filter((name) => counts[name])
      .map((name) => ({ name, value: counts[name], fill: INVENTORY_COLORS[name] }));
  }, [alerts, data]);
  const inventoryCriticalCount = inventoryChart.filter((entry: any) => entry.name !== 'Óptimo').reduce((total: number, entry: any) => total + safeNumber(entry.value), 0);

  const openMarginFormula = (item: any) => setFormulaProduct(item);

  const renderProductBars = (items: any[], formatValue: (value: number) => string, emptyText: string, onItemClick: (item: any) => void = openProduct) => {
    if (!items.length) return <div className="executive-no-data">{emptyText}</div>;
    const maxValue = Math.max(...items.map((item) => safeNumber(item.value)), 1);
    return (
      <div className="executive-product-bars">
        {items.map((item) => (
          <button type="button" className="executive-product-bar-row" key={item.productId || item.name} onClick={() => onItemClick(item.raw)}>
            <ProductThumbnail src={item.imageUrl} alt={item.name} size="sm" fit="contain" className="executive-product-thumb" />
            <span className="executive-product-bar-name" title={item.name}>{item.name}</span>
            <span className="executive-product-bar-track"><i style={{ width: `${Math.max(4, Math.round((safeNumber(item.value) / maxValue) * 100))}%` }} /></span>
            <strong className="executive-product-bar-value">{formatValue(safeNumber(item.value))}</strong>
          </button>
        ))}
      </div>
    );
  };

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
    if (isExporting) return;
    setIsExporting(true);
    const exportToastId = toast.loading('Preparando el PDF del resumen…');
    try {
      await yieldToBrowser();
      const selectedKpis = preferences.indicators.map((id) => {
        const definition = INDICATORS.find((item) => item.id === id);
        const value = indicatorValue(id, kpis, performance, data);
        return {
          label: definition?.label || id,
          value: id === 'netMargin'
            ? `${safeNumber(value).toFixed(1)}%`
            : typeof value === 'number' ? money(value) : String(value),
          detail: definition?.description || '',
        };
      });
      const sections: Array<{ id: string; title: string; headers: string[]; rows: Array<Array<string | number | null | undefined>>; widths?: number[] }> = [
        { id: 'dashboard-kpis', title: 'Indicadores seleccionados', headers: ['Indicador', 'Valor', 'Detalle'], rows: selectedKpis.map(item => [item.label, item.value, item.detail]), widths: [22, 18, 60] },
      ];
      const charts: PdfTemplateChart[] = [];
      if (preferences.blocks.includes('trend')) {
        charts.push({ id: 'dashboard.trend', title: 'Ventas y gastos', type: 'area', labels: trend.map(item => item.date.length > 7 ? item.date.slice(5) : formatDate(item.date)), valueFormat: 'currency', unitLabel: data?.baseCurrency || baseCurrency, series: [{ label: 'Ventas', values: trend.map(item => safeNumber(item.revenue)), color: CHART_COLORS[0] }, { label: 'Gastos', values: trend.map(item => safeNumber(item.expenses)), color: '#ef3340' }] });
      }
      if (preferences.blocks.includes('products') && canViewInventory) {
        charts.push({ id: 'dashboard.products-sales', title: 'Ventas por producto', type: 'bar', labels: productSalesChart.map((item: { name: string; value: number }) => item.name), values: productSalesChart.map((item: { name: string; value: number }) => safeNumber(item.value)), valueFormat: productMetric === 'revenue' ? 'currency' : 'count', unitLabel: productMetric === 'revenue' ? (data?.baseCurrency || baseCurrency) : 'unidades', colors: CHART_COLORS });
        charts.push({ id: 'dashboard.products-margin', title: 'Utilidad de referencia', type: 'bar', labels: productMarginChart.map((item: { name: string; value: number }) => item.name), values: productMarginChart.map((item: { name: string; value: number }) => safeNumber(item.value)), valueFormat: 'currency', unitLabel: data?.baseCurrency || baseCurrency, colors: CHART_COLORS });
        const productsById = new Map<string, any>();
        [...(performance.topSelling || []), ...(performance.topMargin || [])].forEach((item: any) => {
          const key = getProductId(item) || getProductName(item);
          const current = productsById.get(key) || { name: getProductName(item), units: 0, revenue: 0, profit: 0 };
          current.units = Math.max(current.units, safeNumber(item.totalQty));
          current.revenue = Math.max(current.revenue, safeNumber(item.totalRevenue));
          current.profit = Math.max(current.profit, safeNumber(item.profit));
          productsById.set(key, current);
        });
        const productRows = [...productsById.values()].map(item => [item.name, item.units, money(item.revenue), money(item.profit)]);
        sections.push({ id: 'dashboard-products', title: 'Desempeño de productos', headers: ['Producto', 'Unidades', 'Venta pagada', 'Utilidad de referencia'], rows: productRows, widths: [42, 14, 22, 22] });
      }
      if (preferences.blocks.includes('registers')) {
        sections.push({ id: 'dashboard-registers', title: 'Ventas por caja', headers: ['Caja', 'Operaciones', 'Ventas pagadas'], rows: registerSummary.slice(0, 8).map((item: any) => [item.registerName || item.registerCode || 'Caja', safeNumber(item.count), money(safeNumber(item.total))]), widths: [44, 20, 36] });
      }
      if (preferences.blocks.includes('inventory') && canViewInventory) {
        charts.push({ id: 'dashboard.inventory', title: 'Estado del inventario', type: 'donut', labels: inventoryChart.length ? inventoryChart.map(item => item.name) : ['Sin alertas'], values: inventoryChart.length ? inventoryChart.map(item => safeNumber(item.value)) : [0], valueFormat: 'count', unitLabel: 'productos', colors: inventoryChart.length ? inventoryChart.map(item => item.fill) : [CHART_COLORS[0]] });
      }
      const chartPanels = new Map(Array.from(document.querySelectorAll<HTMLElement>('[data-pdf-chart-id]')).map(panel => [panel.dataset.pdfChartId || '', panel]));
      const exportCharts: PdfTemplateChart[] = [];
      for (let index = 0; index < charts.length; index += 1) {
        const chart = charts[index];
        const panel = chartPanels.get(chart.id);
        if (!panel) throw new Error(`No se encontró la gráfica visible «${chart.title}» para exportarla.`);
        toast.loading(`Preparando gráfica ${index + 1} de ${charts.length}: ${chart.title}…`, { id: exportToastId });
        await yieldToBrowser();
        exportCharts.push({ ...chart, ...await capturePdfChartSnapshot(panel) });
      }
      const fileName = buildDatedDownloadFileName(['resumen_gestion'], 'pdf');
      toast.loading('Organizando las páginas del PDF…', { id: exportToastId });
      await yieldToBrowser();
      const configured = await generateConfiguredReportSectionsPDF({
        targetKey: 'dashboard.tenant-overview',
        title: 'Resumen de gestión',
        tenantName: user?.sessionBranding?.kind === 'branch' ? (user.sessionBranding.name || user.tenantName || 'Mi Empresa') : (user?.tenantName || user?.clientTenant?.name || 'Mi Empresa'),
        tenantLogo: user?.sessionBranding?.logo || user?.clientTenant?.logo || '',
        branchName: user?.sessionBranding?.kind === 'branch' ? user.sessionBranding.name : undefined,
        periodLabel: rangeLabel,
        kpis: selectedKpis,
        charts: exportCharts,
        dashboardPreferences: { indicators: [...preferences.indicators], blocks: [...preferences.blocks] },
        sections,
        fileName,
        onProgress: ({ page, totalPages }) => {
          toast.loading(`Generando PDF · página ${page} de ${totalPages}…`, { id: exportToastId });
        },
      });
      if (!configured) throw new Error('No se pudo preparar el reporte del dashboard.');
      toast.success('Resumen exportado en PDF', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo exportar el resumen', { id: exportToastId });
    } finally {
      setIsExporting(false);
    }
  };

  const exportDashboardExcel = async () => {
    try {
      const companyName = user?.sessionBranding?.kind === 'branch'
        ? (user.sessionBranding.name || user.tenantName || user.clientTenant?.name || 'Nova Hub ERP')
        : (themeConfig.tenantName || user?.tenantName || user?.clientTenant?.name || 'Nova Hub ERP');
      const logoUrl = user?.sessionBranding?.logo || themeConfig.logo || user?.clientTenant?.logo || '';
      const logoBase64 = logoUrl ? await getBase64Image(logoUrl) : null;
      const reportCurrency = data?.baseCurrency || baseCurrency;
      const currencyLabel = reportCurrency === 'USD' ? 'Dólares (USD) ($)' : 'Córdobas (NIO) (C$)';
      const selectedKpis = preferences.indicators.map((id) => {
        const definition = INDICATORS.find((item) => item.id === id);
        const value = indicatorValue(id, kpis, performance, data);
        return { Indicador: definition?.label || id, Valor: typeof value === 'number' ? value : String(value), Detalle: definition?.description || '' };
      });
      const productsById = new Map<string, any>();
      [...(performance.topSelling || []), ...(performance.topMargin || [])].forEach((item: any) => {
        const key = getProductId(item) || getProductName(item);
        const current = productsById.get(key) || { Producto: getProductName(item), Unidades: 0, Venta: 0, Utilidad: 0 };
        current.Unidades = Math.max(current.Unidades, safeNumber(item.totalQty));
        current.Venta = Math.max(current.Venta, safeNumber(item.totalRevenue));
        current.Utilidad = Math.max(current.Utilidad, safeNumber(item.profit));
        productsById.set(key, current);
      });
      const productRows = [...productsById.values()];
      createReportWorkbook({
        fileName: buildDatedDownloadFileName(['resumen_gestion'], 'xlsx'),
        branding: {
          companyName,
          reportTitle: 'Resumen de gestión',
          metadata: `Moneda: ${currencyLabel}  |  Período: ${rangeLabel}  |  ${new Date().toLocaleDateString('es-NI')}`,
          primaryColor: themeConfig.colors.primary,
          logoBase64,
        },
        sheets: [
          { name: 'Indicadores', rows: selectedKpis },
          { name: 'Finanzas', rows: trend.map((item) => ({ Fecha: item.date, Ventas: safeNumber(item.revenue), Gastos: safeNumber(item.expenses) })) },
          { name: 'Ventas por caja', rows: registerSummary.map((item: any) => ({ Caja: item.registerName || item.registerCode || 'Caja', Operaciones: safeNumber(item.count), Ventas: safeNumber(item.total) })) },
          { name: 'Productos', rows: productRows },
        ],
        filters: { Periodo: rangeLabel, Alcance: hasData ? 'Datos disponibles' : 'Sin datos para el periodo' },
      });
      toast.success('Resumen exportado en Excel');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo exportar el resumen en Excel');
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
      navigate('inventario', { subModule: 'productos', stockFilter: definition.id === 'outOfStock' ? 'out' : 'low' });
      return;
    }
    const target: Record<string, unknown> = definition.id === 'totalExpenses'
      ? { subModule: 'egresos' }
      : ['operatingResult', 'operatingMargin', 'grossMargin', 'commercialMargin', 'netMargin', 'profitability', 'netProfit'].includes(definition.id)
        ? { subModule: 'resumen-financiero' }
        : definition.id === 'registersWithSales' || definition.id === 'topRegister'
          ? { subModule: 'control-caja', section: 'history', registerId: 'ALL' }
          : definition.id === 'ordersCount' || definition.id === 'pendingOrders'
            ? { subModule: 'ordenes-venta' }
            : { subModule: 'facturas' };
    navigate(definition.id === 'totalExpenses' || ['operatingResult', 'operatingMargin', 'grossMargin', 'commercialMargin', 'netMargin', 'profitability', 'netProfit'].includes(definition.id) ? 'finanzas' : 'ventas', target);
  };

  const askNova = (message = '¿Cómo va mi negocio en este período?') => {
    window.dispatchEvent(new CustomEvent('open-erp-chat', { detail: { message, context: { source: 'executive-dashboard', periodFrom: range?.start, periodTo: range?.end } } }));
  };

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
          <h1><em>Resumen de gestión</em></h1>
        </div>
        <div className="executive-toolbar">
          <Select value={period} onValueChange={(value) => value === 'custom' ? openRangeEditor() : setPeriod(value as DashboardPeriod)}>
            <SelectTrigger className="executive-period"><CalendarDays className="size-4" /><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PERIOD_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
          {canPerform('DASHBOARD', 'export') && <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" className="executive-toolbar-button" disabled={isExporting || currentQuery.isFetching} aria-busy={isExporting}><FileDown className="size-4" /> {isExporting ? 'Generando PDF…' : 'Exportar'} <ChevronRight className="size-3.5 rotate-90" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem className="gap-2 text-xs" disabled={isExporting} onClick={() => void exportDashboard()}><FileDown className="size-3.5 text-rose-600" /> Exportar PDF</DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-xs" onClick={exportDashboardExcel}><FileSpreadsheet className="size-3.5 text-emerald-600" /> Exportar Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
          <Button variant="outline" className="executive-toolbar-button" onClick={() => { setDraftPreferences(preferences); setConfigOpen(true); }}><Settings2 className="size-4" /> Configurar</Button>
          <Button className="executive-toolbar-button executive-ask-button" onClick={() => askNova()}><NovaHubLogo size={17} /> <span>Preguntar a Nova</span></Button>
          <Button variant="outline" size="icon" className="executive-toolbar-icon" onClick={() => void currentQuery.refetch()} aria-label="Actualizar dashboard"><RefreshCw className={`size-4 ${currentQuery.isFetching ? 'animate-spin' : ''}`} /></Button>
        </div>
      </header>

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
            const previousValue = typeof value === 'number' && ['totalRevenue', 'totalExpenses', 'ordersCount', 'paidInvoicesCount', 'averagePaidInvoice', 'operatingMargin', 'grossMargin', 'commercialMargin', 'netMargin', 'profitability', 'netProfit'].includes(id) ? safeNumber(previous[id]) : undefined;
            const costDataUnavailable = COST_DERIVED_INDICATORS.includes(id) && data?.kpis?.hasComparableCostData === false;
            const change = costDataUnavailable ? null : changeLabel(typeof value === 'number' ? value : 0, previousValue);
            const title = costDataUnavailable ? `${definition.label}: configura costos unitarios para calcularlo` : `Abrir detalle de ${definition.label}`;
            return <button type="button" key={id} className="executive-kpi" onClick={() => openKpi(definition)} title={title}><span className="executive-kpi-top"><span className="executive-kpi-icon"><KpiIcon id={id} /></span><span className="executive-kpi-label">{definition.label}</span><ArrowUpRight className="executive-kpi-arrow" /></span><KpiValue definition={definition} value={value} data={data} />{change && <span className={`executive-kpi-change ${change.startsWith('-') ? 'is-negative' : 'is-positive'}`}>{change} vs. período anterior</span>}</button>;
          })}
        </section>

        {canViewInventory && <section className="executive-insights-panel" aria-labelledby="nova-insights-title">
          <div className="executive-insights-layout">
            <div className="executive-insights-heading">
              <img src={signalsAsset} alt="" className="executive-insights-image" />
              <div className="executive-insights-copy">
                <span className="executive-section-kicker" aria-label="Nova detectó estas señales"><NovaHubLogo size={20} className="executive-insights-logo" /><span className="executive-insights-brand-copy">ova detectó estas señales</span></span>
                <h2 id="nova-insights-title">Datos que necesitan una <em>decisión</em></h2>
                <p className="executive-insights-description">Hemos analizado tu inventario y operaciones para ayudarte a tomar mejores decisiones.</p>
              </div>
              <span className="executive-panel-caption">Inventario · actualización automática</span>
            </div>
            {inventoryQuery.isPending ? <div className="executive-insights-loading executive-insights-loading-grid"><Loader2 className="animate-spin" /> Calculando inventario…</div> : inventoryQuery.isError ? <div className="executive-insights-loading executive-insights-loading-grid">No se pudo consultar el análisis de inventario. El resto del dashboard sigue disponible.</div> : <div className="executive-insights-grid">
            <article className="executive-insight-card is-warning">
              <img src={capitalAsset} alt="" className="executive-insight-asset" />
              <div className="executive-insight-copy">
                <span>Capital inmovilizado</span>
                <strong>{money(inventorySummary.stuckInventoryValue || 0)}</strong>
                <small>{safeNumber(inventorySummary.stuckProductsCount)} productos sin salidas de inventario en 90 días.</small>
              </div>
              <button type="button" onClick={() => navigate('inventario', { subModule: 'productos', stockFilter: 'no-sale' })}>Ver productos <ArrowUpRight /></button>
            </article>
            <article className="executive-insight-card is-info">
              <img src={reposicionAsset} alt="" className="executive-insight-asset" />
              <div className="executive-insight-copy">
                <span>Reposición prioritaria</span>
                <strong>{money(inventorySummary.lowStockValue || 0)} en stock bajo</strong>
                <small>{safeNumber(alertCount)} productos con agotado, mínimo o reordenación detectada.</small>
              </div>
              <button type="button" onClick={() => navigate('inventario', { subModule: 'productos', stockFilter: 'low' })}>Revisar stock <ArrowUpRight /></button>
            </article>
            </div>}
          </div>
        </section>}

        <div className="executive-chart-wall" aria-label="Gráficas ejecutivas">
          {preferences.blocks.includes('trend') && <section className="executive-panel executive-chart-card executive-chart-card-trend" data-pdf-chart-id="dashboard.trend">
            <div className="executive-panel-heading"><div><span className="executive-section-kicker">Finanzas</span><h2>Ventas y gastos</h2></div><div className="executive-chart-controls"><button type="button" className="executive-chart-range-button" onClick={openRangeEditor}><CalendarDays className="size-3.5" /> {period === 'custom' ? 'Editar rango' : 'Personalizar rango'}</button><span className="executive-chart-range">{rangeLabel}</span><Select value={trendGranularity} onValueChange={(value) => setTrendGranularity(value as 'day' | 'month')}><SelectTrigger className="executive-chart-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Por día</SelectItem><SelectItem value="month">Por mes</SelectItem></SelectContent></Select></div></div>
            <div className="executive-chart executive-chart-wall-trend"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="executiveRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} /></linearGradient><linearGradient id="executiveExpenses" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef3340" stopOpacity={0.2} /><stop offset="100%" stopColor="#ef3340" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" /><XAxis dataKey="date" tickFormatter={(value) => String(value).length > 7 ? String(value).slice(5) : formatDate(String(value))} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} minTickGap={28} /><YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} tickFormatter={(value) => compactAxis(value)} /><Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11 }} formatter={(value: number, name: string) => [money(value), name === 'revenue' ? 'Ventas' : 'Gastos']} labelFormatter={(label) => String(label).length > 7 ? String(label) : formatDate(String(label))} /><Area type="monotone" dataKey="revenue" name="revenue" stroke="var(--primary)" fill="url(#executiveRevenue)" strokeWidth={2.5} /><Area type="monotone" dataKey="expenses" name="expenses" stroke="#ef3340" fill="url(#executiveExpenses)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div><div className="executive-legend"><span><i className="legend-dot revenue" /> Ventas</span><span><i className="legend-dot expenses" /> Gastos</span></div>
          </section>}

          {preferences.blocks.includes('products') && <section className="executive-panel executive-chart-card executive-chart-card-sales" data-pdf-chart-id="dashboard.products-sales">
            <div className="executive-panel-heading"><div><span className="executive-section-kicker">Volumen</span><h2>Ventas por producto</h2></div><Select value={productMetric} onValueChange={(value) => setProductMetric(value as 'units' | 'revenue')}><SelectTrigger className="executive-chart-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="units">Unidades</SelectItem><SelectItem value="revenue">Ventas pagadas</SelectItem></SelectContent></Select></div>
            <div className="executive-mini-chart">{renderProductBars(productSalesChart, (value) => productMetric === 'revenue' ? compactAxis(value) : `${value.toLocaleString('es-NI')} uds.`, 'Sin ventas')}</div>
          </section>}

          {preferences.blocks.includes('products') && <section className="executive-panel executive-chart-card executive-chart-card-margin" data-pdf-chart-id="dashboard.products-margin">
            <div className="executive-panel-heading"><div><span className="executive-section-kicker">Inventario</span><h2>Utilidad por producto</h2></div><WalletCards className="executive-chart-heading-icon" /></div>
            <div className="executive-mini-chart">{renderProductBars(productMarginChart, (value) => compactAxis(value), 'Sin datos de utilidad', openMarginFormula)}</div>
          </section>}

          {preferences.blocks.includes('registers') && <section className="executive-panel executive-chart-card executive-chart-card-registers"><div className="executive-panel-heading"><div><span className="executive-section-kicker">Puntos de venta</span><h2>Ventas por caja</h2></div><button type="button" className="executive-text-button" onClick={() => navigate('ventas', { subModule: 'control-caja', section: 'history', registerId: 'ALL' })}>Ver control de caja <ArrowUpRight /></button></div><div className="executive-register-list">{registers.length ? registerSummary.slice(0, 6).map((register: any, index: number) => { const max = Math.max(...registerSummary.map((item: any) => safeNumber(item.total)), 1); const percent = Math.round(safeNumber(register.total) / max * 100); const label = register.registerName || `Caja ${register.registerCode}`; return <button type="button" className="executive-register-row" key={register.registerId || index} title={`Abrir historial de ${label}`} onClick={() => navigate('ventas', { subModule: 'control-caja', section: 'history', registerId: register.registerId })}><span className="executive-register-label"><span><Store className="size-4" /> <span className="executive-register-name">{label}</span></span><strong>{money(register.total)}</strong></span><span className="executive-progress"><i style={{ width: `${percent}%` }} /></span><small>{safeNumber(register.count)} operaciones · {percent}% de la caja líder</small></button>; }) : <div className="executive-register-empty"><img src={noSalesRegisterAsset} alt="" /><strong>Aún no hay ventas por caja</strong><span>Cuando registres ventas, aquí podrás comparar el rendimiento de cada caja.</span><button type="button" onClick={() => navigate('ventas', { subModule: 'control-caja', section: 'settings' })}>Configurar cajas</button></div>} {registerSummary.length > 0 && <div className="executive-register-chips" aria-label={`${registerSummary.length} cajas configuradas`}>{registerSummary.map((register: any, index: number) => { const label = register.registerName || `Caja ${register.registerCode}`; return <button type="button" className={`executive-register-chip tone-${index % 4}`} key={`chip-${register.registerId || index}`} title={`Abrir historial de ${label}`} onClick={() => navigate('ventas', { subModule: 'control-caja', section: 'history', registerId: register.registerId })}><span><Store className="size-3.5" /><span className="executive-register-chip-name">{label}</span></span><strong>{money(register.total)}</strong></button>; })}</div>}</div></section>}

          {preferences.blocks.includes('inventory') && <section className="executive-panel executive-chart-card executive-chart-card-inventory" data-pdf-chart-id="dashboard.inventory">
            <div className="executive-panel-heading"><div><span className="executive-section-kicker">Existencias</span><h2>Estado del inventario</h2></div><Package className="executive-chart-heading-icon" /></div>
            <div className="executive-donut-wrap">{inventoryChart.length ? <><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={inventoryChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={53} outerRadius={79} paddingAngle={4} stroke="none">{inventoryChart.map((entry: any) => <Cell key={entry.name} fill={entry.fill} />)}</Pie><Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--primary)', borderRadius: 10, fontSize: 11, color: 'var(--foreground)', boxShadow: '0 10px 24px color-mix(in srgb, var(--foreground) 12%, transparent)' }} labelStyle={{ color: 'var(--foreground)', fontWeight: 800 }} itemStyle={{ color: 'var(--foreground)', fontWeight: 700 }} formatter={(value: number) => [`${safeNumber(value)} productos`, 'Cantidad']} /></PieChart></ResponsiveContainer><div className="executive-donut-center"><strong>{inventoryCriticalCount.toLocaleString('es-NI')}</strong><span>productos críticos</span></div></> : <div className="executive-no-data">Inventario sin alertas</div>}</div>
            <div className="executive-chart-legend executive-inventory-legend">{inventoryChart.map((entry: any) => <span key={entry.name}><i style={{ background: entry.fill }} /><span>{entry.name}</span><strong>{safeNumber(entry.value).toLocaleString('es-NI')}</strong></span>)}</div>
          </section>}
        </div>

      </>}

      <div className="executive-footnote"><CircleHelp className="size-4" /><span>Los importes de ventas y gastos provienen del resumen de Caja. Para utilidad contable, costo de ventas, cuentas por cobrar y cuentas por pagar, utiliza los reportes financieros y contables.</span></div>

      <Dialog open={rangeEditorOpen} onOpenChange={setRangeEditorOpen}><DialogContent className="executive-range-dialog sm:!max-w-md"><DialogHeader><DialogTitle className="executive-dialog-title"><CalendarDays /> Personalizar rango</DialogTitle><DialogDescription>Elige las fechas que alimentan el resumen, las gráficas y la comparación del período anterior.</DialogDescription></DialogHeader><div className="executive-range-form"><label><span>Desde</span><DateField value={draftDateFrom} onChange={setDraftDateFrom} maxDate={draftDateTo || undefined} placeholder="Fecha inicial" /></label><span className="executive-range-separator">hasta</span><label><span>Hasta</span><DateField value={draftDateTo} onChange={setDraftDateTo} minDate={draftDateFrom || undefined} placeholder="Fecha final" /></label></div><DialogFooter><Button variant="outline" onClick={() => setRangeEditorOpen(false)}>Cancelar</Button><Button onClick={applyDateRange}>Aplicar rango</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(formulaProduct)} onOpenChange={(open) => { if (!open) setFormulaProduct(null); }}><DialogContent className="executive-formula-dialog sm:!max-w-md"><DialogHeader><DialogTitle className="executive-dialog-title"><WalletCards /> Cómo se calcula la utilidad</DialogTitle><DialogDescription>Detalle de la fórmula aplicada a {getProductName(formulaProduct)}.</DialogDescription></DialogHeader><div className="executive-formula-card"><div><span>Precio de venta unitario</span><strong>{money(safeNumber(formulaProduct?.salePrice))}</strong></div><div><span>Costo unitario</span><strong>{money(safeNumber(formulaProduct?.costPrice))}</strong></div><div><span>Unidades vendidas</span><strong>{safeNumber(formulaProduct?.totalQty).toLocaleString('es-NI')}</strong></div><div className="executive-formula-total"><span>Utilidad estimada</span><strong>{money(safeNumber(formulaProduct?.profit))}</strong></div></div><p className="executive-formula-equation">(Precio de venta − costo unitario) × unidades vendidas</p><DialogFooter><Button variant="outline" onClick={() => setFormulaProduct(null)}>Cerrar</Button><Button onClick={() => { openProduct(formulaProduct); setFormulaProduct(null); }}>Ver producto <ArrowUpRight className="size-4" /></Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={configOpen} onOpenChange={setConfigOpen}><DialogContent className="executive-config-dialog sm:!max-w-3xl"><DialogHeader><DialogTitle className="executive-dialog-title"><Settings2 /> Configurar resumen de gestión</DialogTitle><DialogDescription>Elige los indicadores y bloques que ayudan a tu rol a decidir más rápido. Las selecciones se guardan para este usuario y tenant.</DialogDescription></DialogHeader><div className="executive-config-search"><Input placeholder="Buscar indicador…" value={configSearch} onChange={(event) => setConfigSearch(event.target.value)} /><span>{draftPreferences.indicators.length} indicadores seleccionados</span></div><div className="executive-config-body"><div className="executive-config-column"><h3>Indicadores</h3>{Object.entries(groupedIndicators).map(([group, definitions]) => <section key={group} className="executive-config-group"><div className="executive-config-group-title">{group}</div>{definitions.map((definition) => { const checked = draftPreferences.indicators.includes(definition.id); const allowed = !definition.permission || canPerform(definition.permission, 'view'); return <label key={definition.id} className={`executive-config-item ${!allowed ? 'disabled' : ''}`}><Checkbox checked={checked} disabled={!allowed} onCheckedChange={(value) => toggleIndicator(definition.id, value === true)} /><span><strong>{definition.label}</strong><small>{definition.description}</small><em>Decisión: {definition.decision}</em></span></label>; })}</section>)}</div><div className="executive-config-column"><h3>Bloques de información</h3>{BLOCKS.map((block) => { const allowed = !block.permission || canPerform(block.permission, 'view'); return <label key={block.id} className={`executive-config-item ${!allowed ? 'disabled' : ''}`}><Checkbox checked={draftPreferences.blocks.includes(block.id)} disabled={!allowed} onCheckedChange={(value) => toggleBlock(block.id, value === true)} /><span><strong>{block.label}</strong><small>{block.description}</small></span></label>; })}<div className="executive-config-callout"><CircleHelp /><span>Las gráficas de ventas, productos, utilidad, cajas e inventario se actualizan según el período y los datos disponibles.</span></div></div></div><DialogFooter><Button variant="outline" onClick={() => setDraftPreferences(DEFAULT_PREFERENCES)}>Restaurar recomendados</Button><Button onClick={savePreferences}><Check className="size-4" /> Aplicar cambios</Button></DialogFooter></DialogContent></Dialog>
      {productDrawerId && <Suspense fallback={null}><ProductDetailDrawer productId={productDrawerId} productSnapshot={productSnapshot} onOpenChange={(open) => { if (!open) { setProductDrawerId(null); setProductSnapshot(null); } }} /></Suspense>}
    </div>
  );
}
