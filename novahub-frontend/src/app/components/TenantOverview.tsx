import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, Variants } from 'motion/react';
import {
  DollarSign, TrendingDown, ShoppingCart, Target,
  ArrowUpRight, Loader2, AlertTriangle, ShieldAlert,
  TrendingUp, Coins, Clock, BarChart3, Package, Store, Receipt,
  FileDown, ClipboardCheck, CalendarDays, Settings2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { type Module, useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { CurrencyValuationAmount, CurrencyValuationBanner } from './ui/CurrencyValuation';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import { cajaService } from '../services/caja.service';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { ImplementationSetupDashboard } from './ImplementationSetupDashboard';
import {
  getImplementationSetupSummary,
  type ImplementationSetupSummary,
} from '../services/implementation-setup.service';
import { getPdfDesignSettings, pdfDesignPaper } from '../utils/pdfGenerator';

interface TenantOverviewProps {
  onNavigate?: (module: Module) => void;
  onNavigateToDashboard?: () => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

const PERIODS = [
  { value: 'today', label: 'Hoy' },
  { value: 'month', label: 'Este Mes' },
  { value: 'quarter', label: 'Este Trimestre' },
  { value: 'year', label: 'Este Año' },
  { value: 'custom', label: 'Rango por fechas' },
];

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const statusStyles: Record<string, string> = {
  SIN_STOCK: 'bg-rose-500/15 text-rose-500 border-rose-500/20',
  STOCK_BAJO: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
  REORDEN: 'bg-orange-500/15 text-orange-500 border-orange-500/20',
};

const statusLabel: Record<string, string> = {
  SIN_STOCK: 'Sin Stock',
  STOCK_BAJO: 'Stock Bajo',
  REORDEN: 'Reordenar',
};

const LOADING_STEPS = [
  'Cargando el resumen de tu empresa...',
  'Consultando ventas del período...',
  'Consultando gastos y compras...',
  'Calculando indicadores de caja...',
  'Preparando los datos...',
];

const KPI_DEFINITIONS = [
  { id: 'totalRevenue', label: 'Ingresos totales', description: 'Ventas registradas en el período.', group: 'Ventas y finanzas', available: true },
  { id: 'totalExpenses', label: 'Gastos totales', description: 'Gastos registrados en el período.', group: 'Ventas y finanzas', available: true },
  { id: 'ordersCount', label: 'Órdenes de venta', description: 'Órdenes creadas en el período.', group: 'Ventas y finanzas', available: true },
  { id: 'netMargin', label: 'Margen de utilidad', description: 'Margen calculado por el resumen actual.', group: 'Ventas y finanzas', available: true },
  { id: 'pendingOrders', label: 'Órdenes pendientes', description: 'Órdenes pendientes por despacho.', group: 'Ventas y finanzas', available: true },
  { id: 'operatingResult', label: 'Resultado operativo', description: 'Ingresos menos gastos del período.', group: 'Ventas y finanzas', available: true },
  { id: 'productsWithSales', label: 'Productos con venta', description: 'Productos incluidos en el ranking recibido.', group: 'Productos e inventario', available: true },
  { id: 'topSellingProduct', label: 'Producto más vendido', description: 'Primer producto del ranking de ventas.', group: 'Productos e inventario', available: true },
  { id: 'topSellingUnits', label: 'Unidades del producto líder', description: 'Unidades del primer producto del ranking.', group: 'Productos e inventario', available: true },
  { id: 'topSellingRevenue', label: 'Venta del producto líder', description: 'Venta acumulada del primer producto.', group: 'Productos e inventario', available: true },
  { id: 'topMarginProduct', label: 'Producto con mayor margen', description: 'Primer producto del ranking de margen.', group: 'Productos e inventario', available: true },
  { id: 'topMarginProfit', label: 'Utilidad del producto líder', description: 'Utilidad del primer producto del ranking.', group: 'Productos e inventario', available: true },
  { id: 'topMarginPercent', label: 'Margen del producto líder', description: 'Margen del primer producto del ranking.', group: 'Productos e inventario', available: true },
  { id: 'noSaleProducts', label: 'Productos sin salida', description: 'Productos sin venta reportados por el resumen.', group: 'Productos e inventario', available: true },
  { id: 'inventoryAlerts', label: 'Alertas de inventario', description: 'Alertas recibidas para el período.', group: 'Productos e inventario', available: true },
  { id: 'outOfStock', label: 'Productos sin stock', description: 'Alertas clasificadas como agotadas.', group: 'Productos e inventario', available: true },
  { id: 'lowStock', label: 'Productos con stock bajo', description: 'Alertas clasificadas como stock bajo.', group: 'Productos e inventario', available: true },
  { id: 'reorderItems', label: 'Productos para reordenar', description: 'Alertas clasificadas para reorden.', group: 'Productos e inventario', available: true },
  { id: 'registersWithSales', label: 'Cajas con ventas', description: 'Cajas incluidas en el resumen de ventas.', group: 'Caja', available: true },
  { id: 'topRegister', label: 'Caja con más ventas', description: 'Caja con mayor total en el resumen.', group: 'Caja', available: true },
  { id: 'topRegisterSales', label: 'Ventas de la caja líder', description: 'Total de la caja con mayor venta.', group: 'Caja', available: true },
  { id: 'recentTransactions', label: 'Movimientos recientes', description: 'Movimientos devueltos por el resumen.', group: 'Caja', available: true },
  { id: 'transactionsWithTax', label: 'Movimientos con IVA', description: 'Movimientos recientes marcados con IVA.', group: 'Caja', available: true },
  { id: 'transactionsWithoutTax', label: 'Movimientos exentos', description: 'Movimientos recientes sin IVA.', group: 'Caja', available: true },
  { id: 'averageRecentSale', label: 'Ticket promedio reciente', description: 'Promedio de los movimientos recibidos.', group: 'Caja', available: true },
  { id: 'largestRecentSale', label: 'Venta reciente mayor', description: 'Mayor importe entre los movimientos recibidos.', group: 'Caja', available: true },
  { id: 'period', label: 'Período consultado', description: 'Período activo del dashboard.', group: 'Calidad de datos', available: true },
  { id: 'topClient', label: 'Cliente con más ventas', description: 'Requiere ampliar el resumen del dashboard.', group: 'Calidad de datos', available: false },
  { id: 'topSupplier', label: 'Proveedor con más compras', description: 'Requiere datos de compras en el resumen.', group: 'Calidad de datos', available: false },
  { id: 'topSeller', label: 'Mejor vendedor', description: 'Requiere datos de vendedor en el resumen.', group: 'Calidad de datos', available: false },
] as const;

const DEFAULT_KPI_IDS = ['totalRevenue', 'totalExpenses', 'ordersCount', 'netMargin'];

export function TenantOverview({ onNavigate, onNavigateToDashboard }: TenantOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [loadStep, setLoadStep] = useState(0);
  const [period, setPeriod] = useState('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cajaData, setCajaData] = useState<any>(null);
  const [prevData, setPrevData] = useState<any>(null);
  const [setupSummary, setSetupSummary] = useState<ImplementationSetupSummary | null>(null);
  const [dataLoadError, setDataLoadError] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSetupView, setShowSetupView] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>(DEFAULT_KPI_IDS);
  const [draftKpiIds, setDraftKpiIds] = useState<string[]>(DEFAULT_KPI_IDS);
  const [showKpiConfig, setShowKpiConfig] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<any | null>(null);
  const { formatConvertedAmount, valuationMode, valuationModeSuffix } = useCurrency();
  const { user, canPerform } = useAuth();
  const canViewPos = canPerform('RETAIL_POS', 'view');
  const kpiStorageScope = `${user?.clientTenantId || user?.tenantId || 'default'}:${user?.id || 'anonymous'}`;
  const kpiStorageKey = `novahub.dashboard.kpis.${kpiStorageScope}`;
  const legacyKpiStorageKey = `novahub.dashboard.kpis.${user?.clientTenantId || user?.tenantId || user?.id || 'default'}`;
  const returnToDashboard = () => {
    setShowSetupView(false);
    onNavigateToDashboard?.();
  };

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setLoadStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 2000);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    try {
      const storedKey = window.localStorage.getItem(kpiStorageKey) !== null
        ? kpiStorageKey
        : legacyKpiStorageKey;
      const stored = JSON.parse(window.localStorage.getItem(storedKey) || 'null');
      if (!Array.isArray(stored)) return;
      const valid = stored.filter((id): id is string =>
        typeof id === 'string' && KPI_DEFINITIONS.some((definition) => definition.id === id && definition.available),
      ).slice(0, 30);
      if (valid.length > 0) {
        setSelectedKpiIds(valid);
        if (storedKey !== kpiStorageKey) window.localStorage.setItem(kpiStorageKey, JSON.stringify(valid));
      }
    } catch {
      // La preferencia visual no debe impedir cargar el dashboard.
    }
  }, [kpiStorageKey, legacyKpiStorageKey]);

  useEffect(() => {
    const syncKpis = (event: StorageEvent) => {
      if (event.key !== kpiStorageKey || !event.newValue) return;
      try {
        const value = JSON.parse(event.newValue);
        if (Array.isArray(value)) setSelectedKpiIds(value.filter((id): id is string => typeof id === 'string').slice(0, 30));
      } catch { /* otra pestaña no debe interrumpir el dashboard */ }
    };
    window.addEventListener('storage', syncKpis);
    return () => window.removeEventListener('storage', syncKpis);
  }, [kpiStorageKey]);

  const openKpiConfig = () => {
    setDraftKpiIds(selectedKpiIds);
    setShowKpiConfig(true);
  };

  const toggleKpi = (id: string, checked: boolean) => {
    setDraftKpiIds((current) => {
      if (checked) return current.includes(id) || current.length >= 30 ? current : [...current, id];
      return current.filter((selectedId) => selectedId !== id);
    });
  };

  const saveKpiConfig = () => {
    setSelectedKpiIds(draftKpiIds);
    try { window.localStorage.setItem(kpiStorageKey, JSON.stringify(draftKpiIds)); } catch { /* preferencia opcional */ }
    setShowKpiConfig(false);
    toast.success(`${draftKpiIds.length} KPI${draftKpiIds.length === 1 ? '' : 's'} configurado${draftKpiIds.length === 1 ? '' : 's'}`);
  };

  const fmt = (amount: number) => formatConvertedAmount(amount);

  const navigateWithTarget = useCallback((module: Module, detail?: Record<string, unknown>) => {
    onNavigate?.(module);
    if (!detail) return;
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('navigate-module', {
        detail: { module, ...detail },
      }));
    }, 100);
  }, [onNavigate]);

  const navigateToTransaction = useCallback((transaction: any) => {
    const destination = transaction?.destination || {
      module: transaction?.transactionType === 'PURCHASE_ORDER' || transaction?.transactionType === 'PURCHASE_INVOICE' || transaction?.transactionType === 'PURCHASE_PAYMENT' ? 'compras' : 'ventas',
            subModule: transaction?.transactionType === 'PURCHASE_ORDER' ? 'ordenes-compra' : transaction?.transactionType === 'PURCHASE_INVOICE' ? 'recepciones-compra' : transaction?.transactionType === 'PURCHASE_PAYMENT' ? 'pagos-realizados' : 'facturas',
      id: transaction?.id,
      number: transaction?.number,
    };
    const detail: Record<string, unknown> = {
      subModule: destination.subModule,
      targetId: destination.id,
      number: destination.number,
    };
    if (destination.subModule === 'facturas') detail.invoiceId = destination.id;
    if (destination.subModule === 'ordenes-venta') detail.orderId = destination.id;
    navigateWithTarget(destination.module as Module, detail);
  }, [navigateWithTarget]);

  const loadDataRef = useRef<() => void>();
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const cajaDataRef = useRef<any>(null);
  const dashboardControllerRef = useRef<AbortController | null>(null);

  const normalizeDashboardResponse = (value: unknown): any | null => {
    const candidate = (value as any)?.data ?? value;
    return candidate && typeof candidate === 'object' && candidate.kpis && typeof candidate.kpis === 'object'
      ? candidate
      : null;
  };

  const handleDashboardError = (err: any): null => {
    if (err?.status === 403 || err?.response?.status === 403 || err?.statusCode === 403) {
      setAccessDenied(true);
    }
    return null;
  };

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, onTimeout?: () => void): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutId = setTimeout(() => {
            onTimeout?.();
            reject(new Error('Timeout'));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const loadData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const isCurrentRequest = () => mountedRef.current && requestId === requestIdRef.current;
    dashboardControllerRef.current?.abort();
    const dashboardController = new AbortController();
    dashboardControllerRef.current = dashboardController;
    setLoading(true);
    setLoadStep(0);
    setDataLoadError(false);
    setAccessDenied(false);

    // Este resumen consulta exclusivamente el dashboard de Caja. No debe
    // intentar acceder a RETAIL_POS cuando el usuario solo tiene acceso a
    // otros módulos del tenant.
    if (!canViewPos) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    const effectivePeriod = period === 'custom' ? 'month' : period;
    const params = period === 'custom'
      ? { startDate: dateFrom || undefined, endDate: dateTo || undefined }
      : {};

    const [current, previous] = await Promise.all([
      withTimeout(
        cajaService.getDashboard(effectivePeriod, undefined, params.startDate, params.endDate, dashboardController.signal, valuationMode),
        12000,
        () => dashboardController.abort(),
      ).then(normalizeDashboardResponse).catch(handleDashboardError),
      withTimeout(
        cajaService.getDashboard('last-month' as any, undefined, undefined, undefined, dashboardController.signal, valuationMode),
        12000,
        () => dashboardController.abort(),
      ).then(normalizeDashboardResponse).catch(handleDashboardError),
    ]);

    if (!isCurrentRequest()) return;

    if (current) {
      cajaDataRef.current = current;
      setCajaData(current);
      setDataLoadError(false);
    } else if (!cajaDataRef.current) {
      setDataLoadError(true);
    }
    setLoading(false);

    if (previous) setPrevData(previous);
  }, [canViewPos, period, dateFrom, dateTo, valuationMode]);

  useEffect(() => {
    mountedRef.current = true;
    loadDataRef.current = loadData;
    const load = async () => {
      await loadData();
    };
    load();

    let focusTimer: ReturnType<typeof setTimeout>;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(focusTimer);
        focusTimer = setTimeout(() => loadDataRef.current?.(), 30000);
      }
    };
    const onFocus = () => {
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => loadDataRef.current?.(), 30000);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      mountedRef.current = false;
      requestIdRef.current++;
      dashboardControllerRef.current?.abort();
      clearTimeout(focusTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadData]);

  const handleExport = async () => {
    if (!cajaData) { toast.error('No hay datos para exportar'); return; }
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdfSettings = await getPdfDesignSettings('dashboard.tenant-overview');
      const doc = new jsPDF(pdfDesignPaper(pdfSettings));
      const pageW = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte del Dashboard', pageW / 2, y, { align: 'center' });
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120);
      doc.text(`Periodo: ${period === 'month' ? 'Este Mes' : period === 'quarter' ? 'Este Trimestre' : 'Este Año'}  |  Generado: ${new Date().toLocaleDateString('es-NI')}`, pageW / 2, y, { align: 'center' });
      y += 12;

      doc.setDrawColor(200);
      doc.line(20, y, pageW - 20, y);
      y += 10;

      doc.setTextColor(0);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumen de KPIs', 20, y);
      y += 8;

      const kpiRows: [string, string][] = selectedKpiData.map((kpi) => [kpi.label, String(kpi.value)]);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      for (const [label, value] of kpiRows) {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 24, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(value), 110, y);
        y += 6;
      }
      y += 6;

      const ensureSpace = (needed: number) => {
        if (y + needed > 272) {
          doc.addPage();
          y = 20;
        }
      };

      const perf = cajaData?.productPerformance;
      if (perf) {
        ensureSpace(20);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Rendimiento de Productos', 20, y);
        y += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Mas Vendidos:', 24, y); y += 5;
        doc.setFont('helvetica', 'normal');
        for (const p of (perf.topSelling || [])) {
          ensureSpace(5);
          doc.text(`- ${p.name}  (${p.totalQty || 0} uds, ${fmt(p.totalRevenue || 0)})`, 28, y);
          y += 5;
        }
        y += 3;
        ensureSpace(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Mayor Utilidad:', 24, y); y += 5;
        doc.setFont('helvetica', 'normal');
        for (const p of (perf.topMargin || [])) {
          ensureSpace(5);
          doc.text(`- ${p.name}  (Margen: ${(p.margin || 0).toFixed(0)}%, Ganancia: ${fmt(p.profit || 0)})`, 28, y);
          y += 5;
        }
        y += 3;
        ensureSpace(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Sin Movimiento:', 24, y); y += 5;
        doc.setFont('helvetica', 'normal');
        for (const p of (perf.noSaleProducts || [])) {
          ensureSpace(5);
          doc.text(`- ${p.name}  (Stock: ${p.stock ?? p.currentStock ?? 0}, ${p.daysWithoutSale || 0} dias sin salida)`, 28, y);
          y += 5;
        }
        y += 6;
      }

      const transactions = cajaData?.recentTransactions || [];
      if (transactions.length > 0) {
        ensureSpace(24);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('Transacciones Recientes', 20, y);
        y += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Factura', 24, y);
        doc.text('Origen', 60, y);
        doc.text('Cliente', 95, y);
        doc.text('Monto', 140, y);
        doc.text('IVA', 170, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        for (const tx of transactions) {
          ensureSpace(5);
          doc.text(tx.number || 'FAC-???', 24, y);
          doc.text((tx.origin || tx.register?.name || '-').substring(0, 24), 60, y);
          doc.text((tx.customer || 'Cliente General').substring(0, 20), 95, y);
          doc.text(fmt(tx.total || 0), 140, y);
          doc.text(tx.hasIVA ? '15%' : 'Exento', 170, y);
          y += 5;
        }
      }

      doc.save(`reporte_dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Reporte PDF exportado');
    } catch (err) {
      console.error('Error exportando PDF:', err);
      toast.error('Error al exportar');
    } finally {
      setIsExporting(false);
    }
  };

  const kpis = cajaData?.kpis;
  const prevKpis = prevData?.previousPeriod;
  const perf = cajaData?.productPerformance;
  const registers = cajaData?.salesByRegister || [];
  const alerts = cajaData?.inventoryAlerts || [];
  const transactions = cajaData?.recentTransactions || [];

  const pctChange = (current: number, previous: number) => {
    if (!previous) return null;
    return ((current - previous) / previous) * 100;
  };

  const now = new Date();
  const periodLabel = period === 'month'
    ? `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
    : period === 'quarter'
      ? `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`
      : String(now.getFullYear());

  const recentAmounts = transactions
    .map((transaction: any) => Number(transaction.sourceTotal ?? transaction.total ?? 0))
    .filter((amount: number) => Number.isFinite(amount));
  const recentTotal = recentAmounts.reduce((sum: number, amount: number) => sum + amount, 0);
  const topSelling = perf?.topSelling?.[0];
  const topMargin = perf?.topMargin?.[0];
  const topRegister = [...registers].sort((a: any, b: any) => Number(b.total || 0) - Number(a.total || 0))[0];
  const productTarget = (product: any) => product?.productId
    ? { module: 'inventario' as Module, detail: { subModule: 'productos', productId: product.productId, productCode: product.code || product.productCode } }
    : undefined;
  const transactionPreview = (items: any[]) => items.slice(0, 5).map((transaction, index) => ({
    label: transaction.number || `Movimiento ${index + 1}`,
    value: fmt(Number(transaction.sourceTotal ?? transaction.total ?? 0)),
  }));
  const allKpiData: any[] = kpis ? [
    { id: 'totalRevenue', label: `Ingresos Totales${valuationModeSuffix}`, value: fmt(kpis.totalRevenue || 0), extra: null, icon: DollarSign, accent: 'text-emerald-400', glow: 'shadow-emerald-500/10', iconBg: 'bg-emerald-500/10', target: { module: 'finanzas' as Module, detail: { subModule: 'ingresos' } }, preview: [{ label: 'Ventas del período', value: fmt(kpis.totalRevenue || 0) }, { label: 'Período', value: periodLabel }] },
    { id: 'totalExpenses', label: `Gastos Totales${valuationModeSuffix}`, value: fmt(kpis.totalExpenses || 0), extra: prevKpis && pctChange(kpis.totalExpenses, prevKpis.expenses) !== null ? { text: `${pctChange(kpis.totalExpenses, prevKpis.expenses)! >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(kpis.totalExpenses, prevKpis.expenses)!).toFixed(1)}% vs anterior`, up: pctChange(kpis.totalExpenses, prevKpis.expenses)! >= 0 } : null, icon: TrendingDown, accent: 'text-rose-400', glow: 'shadow-rose-500/10', iconBg: 'bg-rose-500/10', target: { module: 'finanzas' as Module, detail: { subModule: 'gastos' } }, preview: [{ label: 'Gastos del período', value: fmt(kpis.totalExpenses || 0) }, { label: 'Período', value: periodLabel }] },
    { id: 'ordersCount', label: 'Órdenes de venta', value: String(kpis.ordersCount || 0), extra: { text: `${kpis.pendingOrders || 0} pendientes por despacho`, color: 'text-muted-foreground' }, icon: ShoppingCart, accent: 'text-amber-400', glow: 'shadow-amber-500/10', iconBg: 'bg-amber-500/10', target: { module: 'ventas' as Module, detail: { subModule: 'ordenes-venta' } }, preview: [{ label: 'Órdenes registradas', value: String(kpis.ordersCount || 0) }, { label: 'Pendientes', value: String(kpis.pendingOrders || 0) }] },
    { id: 'netMargin', label: 'Margen de utilidad neta', value: `${(kpis.netMargin || 0).toFixed(1)}%`, extra: { text: (kpis.netMargin || 0) >= 50 ? 'Rentabilidad óptima' : (kpis.netMargin || 0) >= 25 ? 'Rentabilidad moderada' : 'Rentabilidad baja', color: 'text-muted-foreground' }, icon: Target, accent: 'text-cyan-400', glow: 'shadow-cyan-500/10', iconBg: 'bg-cyan-500/10', target: { module: 'finanzas' as Module, detail: { subModule: 'resumen-financiero' } }, preview: [{ label: 'Margen neto', value: `${(kpis.netMargin || 0).toFixed(1)}%` }, { label: 'Resultado operativo', value: fmt(Number(kpis.totalRevenue || 0) - Number(kpis.totalExpenses || 0)) }] },
    { id: 'pendingOrders', label: 'Órdenes pendientes', value: String(kpis.pendingOrders || 0), extra: { text: 'Pendientes por despacho', color: 'text-muted-foreground' }, icon: Clock, accent: 'text-amber-400', glow: 'shadow-amber-500/10', iconBg: 'bg-amber-500/10', target: { module: 'ventas' as Module, detail: { subModule: 'ordenes-venta' } }, preview: [{ label: 'Pendientes por despacho', value: String(kpis.pendingOrders || 0) }] },
    { id: 'operatingResult', label: 'Resultado operativo', value: fmt(Number(kpis.totalRevenue || 0) - Number(kpis.totalExpenses || 0)), extra: { text: 'Ingresos menos gastos', color: 'text-muted-foreground' }, icon: TrendingUp, accent: 'text-emerald-400', glow: 'shadow-emerald-500/10', iconBg: 'bg-emerald-500/10', target: { module: 'finanzas' as Module, detail: { subModule: 'resumen-financiero' } }, preview: [{ label: 'Ingresos', value: fmt(kpis.totalRevenue || 0) }, { label: 'Gastos', value: fmt(kpis.totalExpenses || 0) }, { label: 'Resultado', value: fmt(Number(kpis.totalRevenue || 0) - Number(kpis.totalExpenses || 0)) }] },
    { id: 'productsWithSales', label: 'Productos con venta', value: String(perf?.topSelling?.length || 0), extra: { text: 'Ranking recibido', color: 'text-muted-foreground' }, icon: Package, accent: 'text-emerald-400', glow: 'shadow-emerald-500/10', iconBg: 'bg-emerald-500/10', target: { module: 'inventario' as Module, detail: { subModule: 'productos' } }, preview: [{ label: 'Productos en ranking', value: String(perf?.topSelling?.length || 0) }] },
    { id: 'topSellingProduct', label: 'Producto más vendido', value: topSelling?.name || 'Sin datos', extra: { text: 'Primer producto del ranking', color: 'text-muted-foreground' }, icon: TrendingUp, isText: true, accent: 'text-emerald-400', glow: 'shadow-emerald-500/10', iconBg: 'bg-emerald-500/10', target: productTarget(topSelling), preview: [{ label: 'Producto', value: topSelling?.name || 'Sin datos' }, { label: 'Unidades', value: String(topSelling?.totalQty || 0) }, { label: 'Venta', value: fmt(Number(topSelling?.totalRevenue || 0)) }] },
    { id: 'topSellingUnits', label: 'Unidades del producto líder', value: String(topSelling?.totalQty || 0), extra: { text: 'Unidades vendidas', color: 'text-muted-foreground' }, icon: Package, accent: 'text-emerald-400', glow: 'shadow-emerald-500/10', iconBg: 'bg-emerald-500/10', target: productTarget(topSelling), preview: [{ label: 'Producto', value: topSelling?.name || 'Sin datos' }, { label: 'Unidades vendidas', value: String(topSelling?.totalQty || 0) }] },
    { id: 'topSellingRevenue', label: 'Venta del producto líder', value: fmt(Number(topSelling?.totalRevenue || 0)), extra: null, icon: DollarSign, accent: 'text-emerald-400', glow: 'shadow-emerald-500/10', iconBg: 'bg-emerald-500/10', target: productTarget(topSelling), preview: [{ label: 'Producto', value: topSelling?.name || 'Sin datos' }, { label: 'Venta acumulada', value: fmt(Number(topSelling?.totalRevenue || 0)) }] },
    { id: 'topMarginProduct', label: 'Producto con mayor margen', value: topMargin?.name || 'Sin datos', extra: { text: 'Primer producto del ranking', color: 'text-muted-foreground' }, icon: Target, isText: true, accent: 'text-cyan-400', glow: 'shadow-cyan-500/10', iconBg: 'bg-cyan-500/10', target: productTarget(topMargin), preview: [{ label: 'Producto', value: topMargin?.name || 'Sin datos' }, { label: 'Margen', value: `${Number(topMargin?.margin || 0).toFixed(1)}%` }, { label: 'Utilidad', value: fmt(Number(topMargin?.profit || 0)) }] },
    { id: 'topMarginProfit', label: 'Utilidad del producto líder', value: fmt(Number(topMargin?.profit || 0)), extra: null, icon: Coins, accent: 'text-cyan-400', glow: 'shadow-cyan-500/10', iconBg: 'bg-cyan-500/10', target: productTarget(topMargin), preview: [{ label: 'Producto', value: topMargin?.name || 'Sin datos' }, { label: 'Utilidad', value: fmt(Number(topMargin?.profit || 0)) }] },
    { id: 'topMarginPercent', label: 'Margen del producto líder', value: `${Number(topMargin?.margin || 0).toFixed(1)}%`, extra: null, icon: Target, accent: 'text-cyan-400', glow: 'shadow-cyan-500/10', iconBg: 'bg-cyan-500/10', target: productTarget(topMargin), preview: [{ label: 'Producto', value: topMargin?.name || 'Sin datos' }, { label: 'Margen', value: `${Number(topMargin?.margin || 0).toFixed(1)}%` }] },
    { id: 'noSaleProducts', label: 'Productos sin salida', value: String(perf?.noSaleProducts?.length || 0), extra: { text: 'Productos reportados', color: 'text-muted-foreground' }, icon: Clock, accent: 'text-rose-400', glow: 'shadow-rose-500/10', iconBg: 'bg-rose-500/10', preview: (perf?.noSaleProducts || []).slice(0, 5).map((product: any) => ({ label: product.name, value: `${product.stock ?? product.currentStock ?? 0} en stock` })) },
    { id: 'inventoryAlerts', label: 'Alertas de inventario', value: String(alerts.length), extra: { text: 'Alertas recibidas', color: 'text-muted-foreground' }, icon: AlertTriangle, accent: 'text-amber-400', glow: 'shadow-amber-500/10', iconBg: 'bg-amber-500/10', target: { module: 'inventario' as Module, detail: { subModule: 'productos' } }, preview: alerts.slice(0, 5).map((alert: any) => ({ label: alert.name, value: statusLabel[alert.status] || alert.status })) },
    { id: 'outOfStock', label: 'Productos sin stock', value: String(alerts.filter((alert: any) => alert.status === 'SIN_STOCK').length), extra: null, icon: Package, accent: 'text-rose-400', glow: 'shadow-rose-500/10', iconBg: 'bg-rose-500/10', target: { module: 'inventario' as Module, detail: { subModule: 'productos', stockFilter: 'out' } }, preview: alerts.filter((alert: any) => alert.status === 'SIN_STOCK').slice(0, 5).map((alert: any) => ({ label: alert.name, value: 'Agotado' })) },
    { id: 'lowStock', label: 'Productos con stock bajo', value: String(alerts.filter((alert: any) => alert.status === 'STOCK_BAJO').length), extra: null, icon: Package, accent: 'text-amber-400', glow: 'shadow-amber-500/10', iconBg: 'bg-amber-500/10', target: { module: 'inventario' as Module, detail: { subModule: 'productos', stockFilter: 'low' } }, preview: alerts.filter((alert: any) => alert.status === 'STOCK_BAJO').slice(0, 5).map((alert: any) => ({ label: alert.name, value: `Stock ${alert.currentStock ?? 0}` })) },
    { id: 'reorderItems', label: 'Productos para reordenar', value: String(alerts.filter((alert: any) => alert.status === 'REORDEN').length), extra: null, icon: Package, accent: 'text-orange-400', glow: 'shadow-orange-500/10', iconBg: 'bg-orange-500/10', preview: alerts.filter((alert: any) => alert.status === 'REORDEN').slice(0, 5).map((alert: any) => ({ label: alert.name, value: `Stock ${alert.currentStock ?? 0}` })) },
    { id: 'registersWithSales', label: 'Cajas con ventas', value: String(registers.length), extra: null, icon: Store, accent: 'text-amber-400', glow: 'shadow-amber-500/10', iconBg: 'bg-amber-500/10', target: { module: 'ventas' as Module, detail: { subModule: 'control-caja', section: 'history' } }, preview: [{ label: 'Cajas con movimiento', value: String(registers.length) }] },
    { id: 'topRegister', label: 'Caja con más ventas', value: topRegister?.registerName || 'Sin datos', extra: null, icon: Store, isText: true, accent: 'text-amber-400', glow: 'shadow-amber-500/10', iconBg: 'bg-amber-500/10', target: topRegister?.registerId ? { module: 'ventas' as Module, detail: { subModule: 'control-caja', section: 'history', registerId: topRegister.registerId } } : undefined, preview: [{ label: 'Caja', value: topRegister?.registerName || 'Sin datos' }, { label: 'Ventas', value: fmt(Number(topRegister?.total || 0)) }] },
    { id: 'topRegisterSales', label: 'Ventas de la caja líder', value: fmt(Number(topRegister?.total || 0)), extra: null, icon: DollarSign, accent: 'text-amber-400', glow: 'shadow-amber-500/10', iconBg: 'bg-amber-500/10', target: topRegister?.registerId ? { module: 'ventas' as Module, detail: { subModule: 'control-caja', section: 'history', registerId: topRegister.registerId } } : undefined, preview: [{ label: 'Caja', value: topRegister?.registerName || 'Sin datos' }, { label: 'Total', value: fmt(Number(topRegister?.total || 0)) }] },
    { id: 'recentTransactions', label: 'Movimientos recientes', value: String(transactions.length), extra: { text: 'Movimientos recibidos', color: 'text-muted-foreground' }, icon: Receipt, accent: 'text-primary', glow: 'shadow-primary/10', iconBg: 'bg-primary/10', preview: transactionPreview(transactions) },
    { id: 'transactionsWithTax', label: 'Movimientos con IVA', value: String(transactions.filter((transaction: any) => transaction.hasIVA).length), extra: null, icon: Receipt, accent: 'text-emerald-400', glow: 'shadow-emerald-500/10', iconBg: 'bg-emerald-500/10', preview: transactionPreview(transactions.filter((transaction: any) => transaction.hasIVA)) },
    { id: 'transactionsWithoutTax', label: 'Movimientos exentos', value: String(transactions.filter((transaction: any) => !transaction.hasIVA).length), extra: null, icon: Receipt, accent: 'text-slate-400', glow: 'shadow-slate-500/10', iconBg: 'bg-slate-500/10', preview: transactionPreview(transactions.filter((transaction: any) => !transaction.hasIVA)) },
    { id: 'averageRecentSale', label: 'Ticket promedio reciente', value: fmt(recentAmounts.length ? recentTotal / recentAmounts.length : 0), extra: null, icon: DollarSign, accent: 'text-primary', glow: 'shadow-primary/10', iconBg: 'bg-primary/10', preview: [{ label: 'Movimientos considerados', value: String(recentAmounts.length) }, { label: 'Promedio', value: fmt(recentAmounts.length ? recentTotal / recentAmounts.length : 0) }] },
    { id: 'largestRecentSale', label: 'Venta reciente mayor', value: fmt(recentAmounts.length ? Math.max(...recentAmounts) : 0), extra: null, icon: TrendingUp, accent: 'text-primary', glow: 'shadow-primary/10', iconBg: 'bg-primary/10', preview: [{ label: 'Mayor importe', value: fmt(recentAmounts.length ? Math.max(...recentAmounts) : 0) }] },
    { id: 'period', label: 'Período consultado', value: periodLabel, extra: { text: 'Datos del resumen actual', color: 'text-muted-foreground' }, icon: CalendarDays, isText: true, accent: 'text-primary', glow: 'shadow-primary/10', iconBg: 'bg-primary/10', preview: [{ label: 'Período activo', value: periodLabel }, { label: 'Origen', value: 'Resumen operativo' }] },
  ] : [];
  const selectedKpiData = allKpiData.filter((kpi) => selectedKpiIds.includes(kpi.id));

  const openKpi = (kpi: any) => {
    if (kpi.target) {
      navigateWithTarget(kpi.target.module, kpi.target.detail);
      return;
    }
    setSelectedKpi(kpi);
  };

  if (loading && !cajaData) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary/40" />
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{LOADING_STEPS[Math.min(loadStep, LOADING_STEPS.length - 1)]}</p>
        </div>
      </div>
    );
  }

  if (showSetupView && setupSummary) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Button variant="ghost" size="sm" onClick={returnToDashboard} className="rounded-xl gap-1.5 text-xs font-bold">
          ← Volver al Dashboard
        </Button>
        <ImplementationSetupDashboard
          summary={setupSummary}
          onNavigateToDashboard={returnToDashboard}
          onRefresh={async () => {
            try {
              setSetupLoading(true);
              setSetupSummary(await getImplementationSetupSummary(true, user?.enabledModules));
            } catch { /* silent */ }
            finally { setSetupLoading(false); }
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 pb-16">
      <CurrencyValuationBanner />
      {/* Texto comercial anterior conservado para futuras decisiones de copy, pero oculto del dashboard. */}
      {/* Centraliza, optimiza y escala, la solución integral que tu crecimiento necesita. Supervisa el rendimiento en tiempo real, descubre nuevas oportunidades y toma decisiones estratégicas con nuestra visión analítica de 360°. */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2 relative">
        <div className="absolute -left-10 -top-10 size-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Resumen operativo</p>
           <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground md:text-3xl">Ve lo importante. Decide a tiempo.</h1>
           <p className="mt-2 max-w-xl text-sm text-muted-foreground">Un resumen claro de tu operación, con accesos directos al módulo correcto y vistas previas cuando el detalle aún no tiene una pantalla específica.</p>
        </div>
        <div className="flex items-center gap-2 z-10 shrink-0 flex-wrap">
          <Select value={period} onValueChange={(val) => {
            setPeriod(val);
            if (val !== 'custom') { setDateFrom(''); setDateTo(''); }
          }}>
            <SelectTrigger className="w-44 rounded-xl border-border/50 bg-card text-xs font-bold uppercase tracking-widest">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-border/50">
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value} className="text-xs font-bold">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <label className="relative block">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Fecha desde" className="h-9 w-[170px] rounded-xl border border-border/60 bg-card px-3 pr-10 text-xs font-bold text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 [&::-webkit-calendar-picker-indicator]:opacity-0" />
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
              </label>
              <span className="text-[10px] font-bold text-foreground/70">a</span>
              <label className="relative block">
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  aria-label="Fecha hasta" className="h-9 w-[170px] rounded-xl border border-border/60 bg-card px-3 pr-10 text-xs font-bold text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 [&::-webkit-calendar-picker-indicator]:opacity-0" />
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
              </label>
            </div>
          )}
          <Button
            disabled={isExporting || loading}
            onClick={handleExport}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md rounded-xl font-black uppercase text-[10px] tracking-widest"
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <FileDown className="size-3.5 mr-1.5" />}
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              setShowSetupView(true);
              setSetupLoading(true);
              try {
                const summary = await getImplementationSetupSummary(true, user?.enabledModules);
                setSetupSummary(summary);
              } catch (error: any) {
                toast.error(error?.message || 'No se pudo cargar la implementación');
                setShowSetupView(false);
              } finally { setSetupLoading(false); }
            }}
            disabled={setupLoading}
            className="rounded-xl border-dashed border-primary/30 bg-transparent hover:bg-primary/5 text-primary/80 font-black uppercase text-[10px] tracking-widest gap-1.5"
          >
            {setupLoading ? <Loader2 className="size-3.5 animate-spin" /> : <ClipboardCheck className="size-3.5" />}
            Implementación
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openKpiConfig}
            className="rounded-xl border-border/60 bg-card font-black uppercase text-[10px] tracking-widest gap-1.5"
            title="Configurar indicadores del dashboard"
          >
            <Settings2 className="size-3.5" />
            Configuración
          </Button>
        </div>
      </div>

      {loading && !cajaData ? (
        <div className="space-y-4 py-8">
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>{LOADING_STEPS[Math.min(loadStep, LOADING_STEPS.length - 1)]}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-muted/30 animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-muted/20 animate-pulse" />
        </div>
      ) : !kpis ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/50 rounded-3xl bg-card shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              {accessDenied ? (
                <>
                  <ShieldAlert className="size-12 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground font-bold">No tiene acceso a este módulo</p>
                  <p className="text-xs text-muted-foreground/60">No tenés los permisos necesarios para ver el dashboard de caja.</p>
                </>
              ) : dataLoadError ? (
                <>
                  <AlertTriangle className="size-12 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground font-bold">No se pudieron cargar los datos del dashboard</p>
                  <p className="text-xs text-muted-foreground/60">El servicio tardó demasiado en responder. Intentá recargar la página.</p>
                  <Button variant="outline" size="sm" onClick={() => loadData()} className="mt-2 rounded-xl">
                    Reintentar
                  </Button>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-12 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground font-bold">No hay datos de caja disponibles</p>
                  <p className="text-xs text-muted-foreground/60">Verificá que hayas realizado facturaciones en este período.</p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground" aria-live="polite">
              Período: <span className="text-foreground">{periodLabel}</span> · {selectedKpiData.length} KPI{selectedKpiData.length === 1 ? '' : 's'} activos
            </p>
             <p className="text-[10px] text-muted-foreground">Los indicadores usan el mismo resumen; abrir una tarjeta no genera otra consulta.</p>
          </div>

          {selectedKpiData.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-border/60 bg-card/70">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <Settings2 className="size-8 text-primary/60" />
                <p className="text-sm font-bold text-foreground">No hay KPIs seleccionados</p>
                <p className="max-w-md text-xs text-muted-foreground">Abre Configuración para elegir los indicadores que quieres ver en tu dashboard.</p>
                <Button size="sm" onClick={openKpiConfig} className="rounded-xl">Configurar KPIs</Button>
              </CardContent>
            </Card>
          ) : (
           <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
             {selectedKpiData.map((kpi) => {
               const Icon = kpi.icon;
               const isInteractive = kpi.id !== 'period';
               return (
                 <motion.div key={kpi.id} variants={itemVariants}>
                   <Card
                     role={isInteractive ? 'button' : undefined}
                     tabIndex={isInteractive ? 0 : undefined}
                     onClick={isInteractive ? () => openKpi(kpi) : undefined}
                     onKeyDown={isInteractive ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openKpi(kpi); } } : undefined}
                     className={`group relative overflow-hidden rounded-2xl border-border/30 bg-card/80 shadow-md backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-300 ${isInteractive ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40' : ''}`}
                   >
                    {/* ambient glow */}
                    <div className={`absolute -top-8 -right-8 size-24 rounded-full blur-2xl opacity-40 pointer-events-none ${kpi.iconBg}`} />
                     <CardContent className="relative z-10 flex min-h-[164px] flex-col p-4">
                       <div className="mb-2 flex min-h-10 items-start justify-between gap-3">
                         <span className="pt-1 text-[10px] font-black uppercase tracking-widest text-foreground/80">{kpi.label}</span>
                         <div className={`size-8 items-center justify-center rounded-lg ${kpi.iconBg} flex`}>
                           <Icon className={`size-4 ${kpi.accent}`} />
                         </div>
                       </div>
                       <p className={`${kpi.isText ? 'min-h-12 text-sm leading-snug' : 'min-h-12 text-2xl tracking-tighter'} flex items-center font-black tabular-nums text-foreground break-words`}>{kpi.value}</p>
                       {kpi.extra && (
                         <p className={`mt-1 min-h-[18px] text-[11px] font-bold ${kpi.extra.color || 'text-foreground/75'}`}>
                           {kpi.extra.text}
                         </p>
                       )}
                       {!kpi.extra && <div className="min-h-[18px]" />}
                       <div className={`mt-auto flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-foreground/65 transition-[opacity,transform] duration-300 ${isInteractive ? 'translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100' : 'opacity-60'}`}>
                         <span>{kpi.target ? 'Abrir módulo' : isInteractive ? 'Ver vista previa' : 'Resumen informativo'}</span>
                         {isInteractive && <ArrowUpRight className="size-3" />}
                       </div>
                     </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
          )}

          {/* Rendimiento de Productos */}
          {perf && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="size-4 text-primary" />
                <h2 className="text-base font-black uppercase tracking-tight">Rendimiento de Productos en Caja</h2>
              </div>
              <p className="text-[10px] text-foreground/70 font-medium mb-3 ml-6">Monitoreo por volumen de ventas, margen de utilidad ganada e inventario sin salida.</p>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-gradient-to-r from-border/0 via-border/60 to-border/0" />
                <span className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Análisis en Tiempo Real</span>
                <div className="h-px flex-1 bg-gradient-to-r from-border/0 via-border/60 to-border/0" />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {/* Más Vendidos */}
                <Card className="rounded-2xl border-border/40 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/30 bg-emerald-500/5">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                        <TrendingUp className="size-3 text-emerald-400" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">Más Vendidos</span>
                    </div>
                    <span className="text-[9px] font-bold text-foreground/70 uppercase">Unid.</span>
                  </div>
                  <CardContent className="p-0">
                    {(perf.topSelling || []).length === 0 ? (
                      <p className="text-xs text-foreground/65 italic py-6 text-center font-medium">Sin ventas</p>
                    ) : (perf.topSelling || []).slice(0, 5).map((p: any, i: number) => (
                      <div key={p.productId || i} className="px-4 py-2.5 border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{p.name}</p>
                          <p className="text-[10px] text-foreground/70">Total: {fmt(p.totalRevenue || 0)}</p>
                        </div>
                        <span className="text-[10px] font-black tabular-nums text-emerald-500 ml-3 shrink-0">{p.totalQty || 0} uds</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Mayor Utilidad */}
                <Card className="rounded-2xl border-border/40 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/30 bg-blue-500/5">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                        <Coins className="size-3 text-blue-400" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">Mayor Utilidad</span>
                    </div>
                    <span className="text-[9px] font-bold text-foreground/70 uppercase">Ganancia</span>
                  </div>
                  <CardContent className="p-0">
                    {(perf.topMargin || []).length === 0 ? (
                      <p className="text-xs text-foreground/65 italic py-6 text-center font-medium">Sin datos</p>
                    ) : (perf.topMargin || []).slice(0, 5).map((p: any, i: number) => (
                      <div key={p.productId || i} className="px-4 py-2.5 border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{p.name}</p>
                          <p className="text-[10px] font-black text-blue-500">+{fmt(p.profit || 0)}</p>
                        </div>
                        <span className="text-[10px] font-black tabular-nums text-blue-500 ml-3 shrink-0">{(p.margin || 0).toFixed(0)}%</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Sin Venta */}
                <Card className="rounded-2xl border-border/40 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/30 bg-rose-500/5">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-md bg-rose-500/10 flex items-center justify-center">
                        <Clock className="size-3 text-rose-400" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">Sin Venta</span>
                    </div>
                    <span className="text-[9px] font-bold text-foreground/70 uppercase">Stock Parado</span>
                  </div>
                  <CardContent className="p-0">
                    {(perf.noSaleProducts || []).length === 0 ? (
                      <p className="text-xs text-foreground/65 italic py-6 text-center font-medium">Todos venden</p>
                    ) : (perf.noSaleProducts || []).slice(0, 5).map((p: any, i: number) => (
                      <div key={p.id || i} className="px-4 py-2.5 border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{p.name}</p>
                          <p className="text-[10px] text-foreground/70">{p.daysWithoutSale ? `${p.daysWithoutSale} días sin salida` : 'Sin salidas'}</p>
                        </div>
                        <span className="text-[10px] font-black tabular-nums text-rose-400 ml-3 shrink-0">{p.stock ?? p.currentStock ?? 0} stck</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Transacciones Recientes */}
          {transactions.length > 0 && (
            <Card className="rounded-2xl bg-card/80 backdrop-blur-sm border-border/40 shadow-sm overflow-hidden">
              <CardHeader className="pb-2 px-5 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="size-4 text-primary" />
                    <div>
                      <CardTitle className="text-sm font-black uppercase tracking-tight">Transacciones Recientes</CardTitle>
                      <p className="text-[10px] text-foreground/70 font-medium">Últimos movimientos registrados.</p>
                    </div>
                  </div>
                  <Select onValueChange={(value) => navigateWithTarget('finanzas', { subModule: value })}>
                    <SelectTrigger className="h-8 w-auto min-w-[125px] rounded-lg border-border/50 bg-background px-2.5 text-[10px] font-black uppercase tracking-widest">
                      <SelectValue placeholder="Ver historial" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingresos">Ingresos</SelectItem>
                      <SelectItem value="gastos">Gastos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className="font-black py-2.5 pl-5 uppercase text-[10px] tracking-widest">Documento</TableHead>
                        <TableHead className="font-black py-2.5 uppercase text-[10px] tracking-widest">Origen</TableHead>
                        <TableHead className="font-black py-2.5 uppercase text-[10px] tracking-widest">Cliente / Proveedor</TableHead>
                        <TableHead className="font-black py-2.5 text-right uppercase text-[10px] tracking-widest">Monto</TableHead>
                        <TableHead className="font-black py-2.5 text-center pr-5 uppercase text-[10px] tracking-widest">IVA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.slice(0, 20).map((tx: any, i: number) => (
                        <TableRow key={`${tx.transactionType || 'transaction'}-${tx.id || i}`} className="border-border/30 hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => navigateToTransaction(tx)}>
                          <TableCell className="font-black pl-5 text-xs group-hover:text-primary transition-colors">{tx.number || `FAC-${String(i + 1).padStart(3, '0')}`}</TableCell>
                          <TableCell className="text-xs font-bold py-2.5">
                            <div className="flex items-center gap-1.5"><Store className="size-3 text-primary/75" />{tx.origin || tx.register?.name || 'FACTURA DE VENTA'}</div>
                            {tx.originDetail && <span className="ml-[18px] text-[9px] font-medium text-foreground/70">{tx.originDetail}</span>}
                          </TableCell>
                          <TableCell className="text-xs font-bold text-foreground/70">{tx.customer || 'Cliente General'}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            <CurrencyValuationAmount
                              amount={Number(tx.sourceTotal ?? tx.total ?? 0)}
                              sourceCurrency={tx.currency}
                              sourceExchangeRate={tx.exchangeRate}
                              className="font-black"
                            />
                          </TableCell>
                          <TableCell className="text-center pr-5">
                            {tx.hasIVA ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-black px-2 py-0.5">15%</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-muted/20 text-foreground/75 border-border/30 text-[9px] font-black px-2 py-0.5">EXENTO</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ventas por Cajas + Alertas */}
          <div className="grid gap-4 lg:grid-cols-2">
            {registers.length > 0 && (
              <Card className="rounded-2xl border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
                <CardHeader className="pb-2 px-5 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                      <BarChart3 className="size-4 text-primary" /> Ventas por Cajas
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-[9px] font-black uppercase tracking-widest" onClick={() => navigateWithTarget('ventas', { subModule: 'control-caja', section: 'history', registerId: 'ALL' })}>
                      Ver todo <ArrowUpRight className="ml-1 size-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-3">
                  {(() => {
                    const maxTotal = Math.max(...registers.map((r: any) => r.total || 0));
                    return registers.map((r: any, i: number) => {
                      const pct = maxTotal > 0 ? ((r.total || 0) / maxTotal) * 100 : 0;
                      return (
                        <div key={r.registerId || i} className="cursor-pointer group" onClick={() => navigateWithTarget('ventas', { subModule: 'control-caja', section: 'history', registerId: r.registerId })}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <Store className="size-3 text-primary/70 shrink-0 group-hover:text-primary transition-colors" />
                              <span className="text-xs font-bold truncate group-hover:text-primary transition-colors">{r.registerName || `Caja ${r.registerCode}`}</span>
                            </div>
                            <span className="text-xs font-black tabular-nums">{fmt(r.total || 0)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                              className={`h-full rounded-full ${
                                pct >= 70 ? 'bg-gradient-to-r from-primary to-primary/70' :
                                pct >= 40 ? 'bg-gradient-to-r from-cyan-500 to-blue-500' :
                                'bg-gradient-to-r from-amber-500 to-orange-500'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </CardContent>
              </Card>
            )}

            {alerts.length > 0 && (
              <Card className="rounded-2xl border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
                <CardHeader className="pb-2 px-5 pt-4">
                  <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                    <Package className="size-4 text-amber-500" /> Alertas de Inventario
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-1.5">
                  {alerts.slice(0, 6).map((a: any, i: number) => (
                    <div key={a.productId || i} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer group" onClick={() => navigateWithTarget('inventario', { subModule: 'productos', productId: a.productId, productCode: a.code, stockFilter: a.status === 'SIN_STOCK' ? 'out' : 'low' })}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`size-2 shrink-0 rounded-full ${a.status === 'SIN_STOCK' ? 'bg-rose-500' : a.status === 'STOCK_BAJO' ? 'bg-amber-500' : 'bg-orange-500'}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{a.name}</p>
                          <p className="text-[10px] text-foreground/70 font-medium">{a.status === 'SIN_STOCK' ? 'Agotado' : a.status === 'STOCK_BAJO' ? `Stock Bajo (${a.currentStock})` : `Reordenar (${a.currentStock})`}</p>
                        </div>
                      </div>
                      <Badge className={`text-[9px] font-black uppercase tracking-widest border-none px-2 py-0.5 ${statusStyles[a.status] || 'bg-muted/10 text-muted-foreground'}`}>
                        {statusLabel[a.status] || a.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      <Dialog open={showKpiConfig} onOpenChange={setShowKpiConfig}>
        <DialogContent className="max-w-3xl rounded-2xl border-border/60 bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <Settings2 className="size-5 text-primary" /> Configurar dashboard
            </DialogTitle>
            <DialogDescription>
              Selecciona hasta 30 indicadores. Se alimentan del resumen que ya consulta el dashboard, por lo que activar más KPIs no multiplica las solicitudes. Esta preferencia se guarda en este navegador y en esta cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
            {['Ventas y finanzas', 'Productos e inventario', 'Caja', 'Calidad de datos'].map((group) => (
              <section key={group}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-[0.16em] text-foreground">{group}</h3>
                  <span className="text-[10px] font-bold text-muted-foreground">{KPI_DEFINITIONS.filter((definition) => definition.group === group && definition.available).length} disponibles</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {KPI_DEFINITIONS.filter((definition) => definition.group === group).map((definition) => {
                    const checked = draftKpiIds.includes(definition.id);
                    return (
                      <label key={definition.id} className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${definition.available ? 'cursor-pointer border-border/60 hover:border-primary/40 hover:bg-primary/5' : 'cursor-not-allowed border-dashed border-border/40 opacity-60'}`}>
                        <Checkbox
                          checked={checked}
                          disabled={!definition.available}
                          onCheckedChange={(value) => toggleKpi(definition.id, value === true)}
                          aria-label={definition.label}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-bold text-foreground">{definition.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{definition.description}{!definition.available ? ' Próximamente.' : ''}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-bold text-muted-foreground">{draftKpiIds.length}/30 seleccionados</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDraftKpiIds(DEFAULT_KPI_IDS)} className="rounded-xl">Restaurar base</Button>
              <Button onClick={saveKpiConfig} className="rounded-xl">Aplicar KPIs</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedKpi)} onOpenChange={(open) => { if (!open) setSelectedKpi(null); }}>
        <DialogContent className="max-w-xl rounded-2xl border-border/60 bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              {selectedKpi?.icon && (() => { const PreviewIcon = selectedKpi.icon; return <PreviewIcon className={`size-5 ${selectedKpi.accent}`} />; })()}
              {selectedKpi?.label || 'Vista previa del indicador'}
            </DialogTitle>
            <DialogDescription>Datos incluidos en el resumen del período seleccionado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {(selectedKpi?.preview || []).length > 0 ? selectedKpi.preview.map((row: { label: string; value: string }, index: number) => (
              <div key={`${row.label}-${index}`} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{row.label}</p>
                <p className="mt-1 truncate text-sm font-bold text-foreground" title={row.value}>{row.value}</p>
              </div>
            )) : <p className="col-span-full rounded-xl border border-dashed border-border/60 p-5 text-center text-sm text-muted-foreground">No hay registros suficientes para mostrar una vista previa.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedKpi(null)} className="rounded-xl">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
