import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, Variants } from 'motion/react';
import { safeSetItem } from '../services/safe-storage';
import {
  DollarSign, TrendingDown, ShoppingCart, Target,
  ArrowUpRight, Loader2, AlertTriangle, ShieldAlert,
  TrendingUp, Coins, Clock, BarChart3, Package, Store, Receipt,
  FileDown, ClipboardCheck, CalendarDays,
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

export function TenantOverview({ onNavigate, onNavigateToDashboard }: TenantOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [loadStep, setLoadStep] = useState(0);
  const [period, setPeriod] = useState('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cajaData, setCajaData] = useState<any>(null);
  const [prevData, setPrevData] = useState<any>(null);
  const [setupSummary, setSetupSummary] = useState<ImplementationSetupSummary | null>(null);
  const [skipSetup, setSkipSetup] = useState(() => localStorage.getItem('erp-skip-setup') === 'true');
  const [dataLoadError, setDataLoadError] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { formatConvertedAmount, valuationMode, valuationModeSuffix } = useCurrency();
  const { user } = useAuth();

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setLoadStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 2000);
    return () => clearInterval(timer);
  }, [loading]);

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
  const pollCountRef = useRef(0);
  const requestIdRef = useRef(0);
  const setupSummaryRef = useRef<ImplementationSetupSummary | null>(null);
  const setupPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    // La validación de implementación no debe bloquear la primera pintura del
    // dashboard. Se ejecuta en paralelo y solo cambia la vista si realmente hay
    // pasos pendientes.
    const setupPromise = getImplementationSetupSummary(
      setupSummaryRef.current === null || !setupSummaryRef.current.isComplete,
      user?.enabledModules,
    );
    setupPromise.then((setup) => {
      if (!isCurrentRequest()) return;
      setupSummaryRef.current = setup;
      setSetupSummary(setup);
    }).catch(() => {
      // El dashboard sigue siendo utilizable aunque falle la validación auxiliar.
    });

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

    // Nunca reemplazar datos válidos por null durante un refresh transitorio.
    // Así una latencia puntual no convierte el dashboard en una tarjeta vacía.
    if (current) {
      cajaDataRef.current = current;
      setCajaData(current);
      setDataLoadError(false);
    } else if (!cajaDataRef.current) {
      setDataLoadError(true);
    }
    setLoading(false);

    if (previous) setPrevData(previous);
  }, [period, dateFrom, dateTo, user?.enabledModules, valuationMode]);

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
      if (setupPollTimerRef.current) clearTimeout(setupPollTimerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadData]);

  useEffect(() => {
    if (setupSummary && !setupSummary.isComplete && !skipSetup) {
      pollCountRef.current = 0;
      const fn = () => {
        if (!mountedRef.current) return;
        pollCountRef.current++;
        const delay = Math.min(4000 * Math.pow(1.5, pollCountRef.current), 30000);
        setupPollTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          loadDataRef.current?.();
          fn();
        }, delay);
      };
      fn();
    }
    return () => {
      if (setupPollTimerRef.current) {
        clearTimeout(setupPollTimerRef.current);
        setupPollTimerRef.current = null;
      }
    };
  }, [setupSummary?.isComplete, skipSetup]);

  const handleExport = async () => {
    if (!cajaData) { toast.error('No hay datos para exportar'); return; }
    setIsExporting(true);
    try {
      const k = cajaData.kpis;
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

      const kpiRows: [string, string][] = [
        ['Ingresos Totales', fmt(k.totalRevenue || 0)],
        ['Gastos Totales', fmt(k.totalExpenses || 0)],
        ['Ordenes de Venta', String(k.ordersCount || 0)],
        ['Margen de Utilidad', `${(k.netMargin || 0).toFixed(1)}%`],
      ];

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

  const kpiData = kpis ? [
    {
      label: `Ingresos Totales${valuationModeSuffix}`,
      value: fmt(kpis.totalRevenue || 0),
      extra: null,
      icon: DollarSign,
      accent: 'text-emerald-400',
      glow: 'shadow-emerald-500/10',
      iconBg: 'bg-emerald-500/10',
    },
    {
      label: `Gastos Totales${valuationModeSuffix}`,
      value: fmt(kpis.totalExpenses || 0),
      extra: prevKpis && pctChange(kpis.totalExpenses, prevKpis.expenses) !== null
        ? { text: `${pctChange(kpis.totalExpenses, prevKpis.expenses)! >= 0 ? '↑' : '↓'} ${Math.abs(pctChange(kpis.totalExpenses, prevKpis.expenses)!).toFixed(1)}% vs anterior`, up: pctChange(kpis.totalExpenses, prevKpis.expenses)! >= 0 }
        : null,
      icon: TrendingDown,
      accent: 'text-rose-400',
      glow: 'shadow-rose-500/10',
      iconBg: 'bg-rose-500/10',
    },
    {
      label: 'Órdenes de Venta',
      value: String(kpis.ordersCount || 0),
      extra: { text: `${kpis.pendingOrders || 0} pendientes por despacho`, color: 'text-muted-foreground' },
      icon: ShoppingCart,
      accent: 'text-amber-400',
      glow: 'shadow-amber-500/10',
      iconBg: 'bg-amber-500/10',
    },
    {
      label: 'Margen Utilidad Net.',
      value: `${(kpis.netMargin || 0).toFixed(1)}%`,
      extra: { text: (kpis.netMargin || 0) >= 50 ? 'Rentabilidad Óptima' : (kpis.netMargin || 0) >= 25 ? 'Rentabilidad Moderada' : 'Rentabilidad Baja', color: 'text-muted-foreground' },
      icon: Target,
      accent: 'text-cyan-400',
      glow: 'shadow-cyan-500/10',
      iconBg: 'bg-cyan-500/10',
    },
  ] : [];

  if (loading && !cajaData) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background p-6">
        <Loader2 className="size-8 animate-spin text-primary/40" />
      </div>
    );
  }

  if (setupSummary && !setupSummary.isComplete && !skipSetup) {
    return (
      <ImplementationSetupDashboard
        summary={setupSummary}
        onNavigateToDashboard={() => {
          setSkipSetup(true);
          safeSetItem('erp-skip-setup', 'true');
          onNavigateToDashboard?.();
          loadData();
        }}
        onRefresh={async () => {
          setLoading(true);
          try {
            setSetupSummary(await getImplementationSetupSummary(true, user?.enabledModules));
          } finally {
            setLoading(false);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 pb-16">
      <CurrencyValuationBanner />
      {/* Hero */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2 relative">
        <div className="absolute -left-10 -top-10 size-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl tracking-tight text-foreground mb-2 font-bold">
            Centraliza, optimiza y{' '}
            <span className="bg-primary text-primary-foreground px-3 py-1 rounded-md inline-block transform -rotate-2 shadow-lg font-semibold mx-1 border border-primary/50">escala</span>,
            <br />
            <span className="text-xl md:text-2xl mt-3 block text-muted-foreground/90 tracking-normal font-medium">
              la solución integral que tu crecimiento{' '}
              <span className="text-foreground border-b-[3px] border-primary pb-0.5 inline-block transform rotate-1">necesita.</span>
            </span>
          </h1>
          <p className="text-sm text-foreground/75 mt-3 max-w-xl">
            Supervisa el rendimiento en tiempo real, descubre nuevas oportunidades y toma decisiones estratégicas con nuestra visión analítica de 360°.
          </p>
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
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Fecha desde" className="h-9 w-[170px] rounded-xl border border-border/60 bg-card px-3 pr-10 text-xs font-bold text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 [&::-webkit-calendar-picker-indicator]:opacity-0" />
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
              </label>
              <span className="text-[10px] font-bold text-foreground/70">a</span>
              <label className="relative block">
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  aria-label="Fecha hasta" className="h-9 w-[170px] rounded-xl border border-border/60 bg-card px-3 pr-10 text-xs font-bold text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 [&::-webkit-calendar-picker-indicator]:opacity-0" />
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
              </label>
            </div>
          )}
          {setupSummary && !setupSummary.isComplete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSkipSetup(false);
                localStorage.removeItem('erp-skip-setup');
              }}
              className="rounded-xl border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-black uppercase text-[10px] tracking-widest gap-1.5"
            >
              <ClipboardCheck className="size-3.5" />
              Ver Implementación
            </Button>
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
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/75 text-center md:text-left">
            Período: <span className="text-foreground">{periodLabel}</span>
          </p>

          {/* KPIs - dark diffused tech */}
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpiData.map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <motion.div key={kpi.label} variants={itemVariants}>
                  <Card
                    className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer group border-border/30 bg-card/80 backdrop-blur-sm shadow-md rounded-2xl`}
                    onClick={() => onNavigate?.(i < 2 ? 'finanzas' : 'ventas')}
                  >
                    {/* ambient glow */}
                    <div className={`absolute -top-8 -right-8 size-24 rounded-full blur-2xl opacity-40 pointer-events-none ${kpi.iconBg}`} />
                    <CardContent className="p-4 relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80">{kpi.label}</span>
                        <div className={`size-8 items-center justify-center rounded-lg ${kpi.iconBg} flex`}>
                          <Icon className={`size-4 ${kpi.accent}`} />
                        </div>
                      </div>
                      <p className="text-2xl font-black tracking-tighter tabular-nums text-foreground">{kpi.value}</p>
                      {kpi.extra && (
                        <p className={`text-[11px] font-bold mt-1 ${kpi.extra.color || 'text-foreground/75'}`}>
                          {kpi.extra.text}
                        </p>
                      )}
                      {!kpi.extra && <div className="h-[18px]" />}
                      <div className="mt-2 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-foreground/65 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                        <span>Ver detalle</span>
                        <ArrowUpRight className="size-3" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

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
    </div>
  );
}
