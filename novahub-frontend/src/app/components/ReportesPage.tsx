import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, Download, TrendingUp, TrendingDown, Calendar,
  Package, Printer,
  DollarSign, Users, ShoppingCart, Target,
  AlertTriangle, CheckCircle2, Activity, PieChart as PieIcon,
  FileText, BarChart2, Layers, Zap
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { invoicesService, customersService, salesOrdersService, paymentsService } from '../services/ventas.service';
import { inventoryService } from '../services/inventario.service';
import { incomeService, expensesService } from '../services/finanzas.service';
import { subscriptionsService } from '../services/subscriptions.service';
import { tenantsService } from '../services/tenants.service';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmt(n: number) { return `$${n.toLocaleString('es-NI', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`; }
function pct(v: number, t: number) { return t > 0 ? ((v / t) * 100).toFixed(1) + '%' : '0%'; }
function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isDateInRange(value: unknown, range: string): boolean {
  const date = toDate(value);
  if (!date) return false;

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const start = new Date(now);
  switch (range) {
    case 'hoy':
      return date >= startToday;
    case 'ultima-semana':
      start.setDate(now.getDate() - 7);
      break;
    case 'ultimo-mes':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'ultimo-trimestre':
      start.setMonth(now.getMonth() - 3);
      break;
    case 'ultimo-año':
      start.setFullYear(now.getFullYear() - 1);
      break;
    default:
      return true;
  }

  start.setHours(0, 0, 0, 0);
  return date >= start;
}

export function ReportesPage() {
  const [dateRange, setDateRange] = useState('ultimo-mes');
  const [activeTab, setActiveTab] = useState('ejecutivo');
  const [loading, setLoading] = useState(true);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [tenantReports, setTenantReports] = useState<any[]>([]);
  const [subscriptionRequests, setSubscriptionRequests] = useState<any[]>([]);
  const [hasSubscriptionsAccess, setHasSubscriptionsAccess] = useState(false);

  const filteredIncomes = useMemo(() => incomes.filter(i => isDateInRange(i.date, dateRange)), [incomes, dateRange]);
  const filteredExpenses = useMemo(() => expenses.filter(e => isDateInRange(e.date, dateRange)), [expenses, dateRange]);
  const filteredInvoices = useMemo(() => invoices.filter(i => isDateInRange(i.date, dateRange)), [invoices, dateRange]);
  const filteredPayments = useMemo(() => payments.filter(p => isDateInRange(p.date, dateRange)), [payments, dateRange]);
  const filteredOrders = useMemo(() => orders.filter(o => isDateInRange(o.date, dateRange)), [orders, dateRange]);

  // ── Core KPIs ──────────────────────────────────────────────────────────────
  const totalIncome   = useMemo(() => filteredIncomes.reduce((a, i) => a + Number(i.amount || 0), 0), [filteredIncomes]);
  const totalExpenses = useMemo(() => filteredExpenses.reduce((a, e) => a + Number(e.amount || 0), 0), [filteredExpenses]);
  const netProfit     = totalIncome - totalExpenses;
  const grossMargin   = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
  const inventoryVal  = useMemo(() => products.reduce((a, p) => a + Number(p.stock || 0) * Number(p.costPrice || 0), 0), [products]);
  const totalSales    = useMemo(() => filteredInvoices.reduce((a, i) => a + Number(i.total || 0), 0), [filteredInvoices]);
  const totalPaid     = useMemo(() => filteredPayments.reduce((a, p) => a + Number(p.amount || 0), 0), [filteredPayments]);
  const pendingOrders = useMemo(() => filteredOrders.filter(o => o.status === 'CONFIRMED' || o.status === 'IN_PROGRESS').length, [filteredOrders]);
  const activeClients = useMemo(() => customers.filter(c => c.status === 'ACTIVE').length, [customers]);
  const activeModulesCount = useMemo(
    () => tenantReports.reduce((acc, tenant) => acc + (tenant.subscriptions?.length || 0), 0),
    [tenantReports],
  );
  const pendingRequestCount = useMemo(
    () => subscriptionRequests.filter(req => req.status === 'PENDING').length,
    [subscriptionRequests],
  );

  // ROI: (income - expenses) / expenses * 100
  const roi = totalExpenses > 0 ? ((netProfit / totalExpenses) * 100).toFixed(1) : '0';
  // EBITDA approx = net profit + depreciation (assumed 5% of expenses)
  const ebitda = netProfit + totalExpenses * 0.05;
  // Current ratio approx
  const currentRatio = totalExpenses > 0 ? (totalIncome / totalExpenses).toFixed(2) : '0';
  // Break-even
  const breakEven = totalExpenses;

  // ── Monthly trends (last 6 months) ────────────────────────────────────────
  const monthlyTrend = useMemo(() => {
    const now = new Date().getMonth();
    return Array.from({ length: 6 }, (_, i) => {
      const idx = (now - (5 - i) + 12) % 12;
      const mInc = filteredIncomes.filter(x => new Date(x.date).getMonth() === idx).reduce((a, x) => a + Number(x.amount || 0), 0);
      const mExp = filteredExpenses.filter(x => new Date(x.date).getMonth() === idx).reduce((a, x) => a + Number(x.amount || 0), 0);
      const mInv = filteredInvoices.filter(x => new Date(x.date).getMonth() === idx).reduce((a, x) => a + Number(x.total || 0), 0);
      return { mes: MONTH_NAMES[idx], ingresos: mInc, gastos: mExp, facturas: mInv, utilidad: mInc - mExp };
    });
  }, [filteredIncomes, filteredExpenses, filteredInvoices]);

  // ── Expense by category ────────────────────────────────────────────────────
  const expByCat = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach(e => { const k = e.category || 'Otros'; map[k] = (map[k] || 0) + Number(e.amount || 0); });
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [filteredExpenses]);

  // ── Top products by revenue value ─────────────────────────────────────────
  const topProducts = useMemo(() =>
    [...products]
      .map(p => ({ name: p.name || '?', valor: Number(p.salePrice || 0) * Math.max(Number(p.stock || 0), 1), stock: Number(p.stock || 0), precio: Number(p.salePrice || 0) }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6),
  [products]);

  // ── Inventory ABC classification ───────────────────────────────────────────
  const inventoryABC = useMemo(() => {
    const sorted = [...products]
      .map(p => ({ name: p.name || '?', valor: Number(p.salePrice || 0) * Math.max(Number(p.stock || 0), 1), stock: Number(p.stock || 0) }))
      .sort((a, b) => b.valor - a.valor);
    const total = sorted.reduce((a, p) => a + p.valor, 0);
    let cum = 0;
    return sorted.map(p => {
      cum += p.valor;
      const pctCum = total > 0 ? (cum / total) * 100 : 0;
      return { ...p, clase: pctCum <= 70 ? 'A' : pctCum <= 90 ? 'B' : 'C' };
    });
  }, [products]);

  // ── Customer segments by invoice value ────────────────────────────────────
  const customerSegments = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInvoices.forEach(inv => {
      if (inv.customer?.name) map[inv.customer.name] = (map[inv.customer.name] || 0) + Number(inv.total || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredInvoices]);

  // ── Invoice status breakdown ───────────────────────────────────────────────
  const invoiceStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInvoices.forEach(i => { const k = i.status || 'UNKNOWN'; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([status, count], i) => ({ status, count, color: COLORS[i % COLORS.length] }));
  }, [filteredInvoices]);

  const requestsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    subscriptionRequests.forEach(req => {
      const status = req.status || 'UNKNOWN';
      map[status] = (map[status] || 0) + 1;
    });

    return Object.entries(map).map(([status, count], i) => ({
      status,
      count,
      color: COLORS[i % COLORS.length],
    }));
  }, [subscriptionRequests]);
  const approvedRequestCount = useMemo(
    () => subscriptionRequests.filter(req => req.status === 'APPROVED').length,
    [subscriptionRequests],
  );
  const rejectedRequestCount = useMemo(
    () => subscriptionRequests.filter(req => req.status === 'REJECTED').length,
    [subscriptionRequests],
  );

  const planDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    tenantReports.forEach(tenant => {
      const plan = tenant.plan || 'N/A';
      map[plan] = (map[plan] || 0) + 1;
    });
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [tenantReports]);

  const requestedModules = useMemo(() => {
    const map: Record<string, number> = {};
    subscriptionRequests.forEach(req => {
      const moduleName = req.requestedModule || 'N/A';
      map[moduleName] = (map[moduleName] || 0) + 1;
    });
    return Object.entries(map)
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [subscriptionRequests]);

  const topTenantsByModules = useMemo(() =>
    [...tenantReports]
      .map(tenant => ({
        name: tenant.name || 'Sin nombre',
        modules: tenant.subscriptions?.length || 0,
        users: tenant._count?.users || 0,
      }))
      .sort((a, b) => b.modules - a.modules)
      .slice(0, 8),
  [tenantReports]);

  const approvalsMonthlyTrend = useMemo(() => {
    const now = new Date().getMonth();
    return Array.from({ length: 6 }, (_, i) => {
      const idx = (now - (5 - i) + 12) % 12;
      const monthRequests = subscriptionRequests.filter(req => {
        const reqDate = toDate(req.createdAt);
        return reqDate ? reqDate.getMonth() === idx : false;
      });

      return {
        mes: MONTH_NAMES[idx],
        pendientes: monthRequests.filter(req => req.status === 'PENDING').length,
        aprobadas: monthRequests.filter(req => req.status === 'APPROVED').length,
        rechazadas: monthRequests.filter(req => req.status === 'REJECTED').length,
      };
    });
  }, [subscriptionRequests]);

  // ── Radar for financial health ─────────────────────────────────────────────
  const radarData = [
    { metric: 'Liquidez', value: Math.min(Number(currentRatio) * 50, 100) },
    { metric: 'Margen', value: Math.min(Math.max(grossMargin, 0), 100) },
    { metric: 'ROI', value: Math.min(Math.max(Number(roi), 0), 100) },
    { metric: 'Cobertura', value: Math.min((totalPaid / Math.max(totalSales, 1)) * 100, 100) },
    { metric: 'Inventario', value: Math.min((inventoryVal / Math.max(totalIncome, 1)) * 50, 100) },
    { metric: 'Ventas', value: Math.min((totalSales / Math.max(totalIncome + totalSales, 1)) * 100, 100) },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invR, incR, expR, prodR, catR, custR, ordR, payR] = await Promise.all([
        invoicesService.getAll(),
        incomeService.getAll(),
        expensesService.getAll(),
        inventoryService.getProducts(),
        inventoryService.getCategories(),
        customersService.getAll(),
        salesOrdersService.getAll(),
        paymentsService.getAll(),
      ]);
      const a = (r: any) => Array.isArray(r) ? r : (r?.data || []);
      setInvoices(a(invR)); setIncomes(a(incR)); setExpenses(a(expR));
      setProducts(a(prodR)); setCategories(a(catR)); setCustomers(a(custR));
      setOrders(a(ordR)); setPayments(a(payR));

      let tenantsData: any[] = [];
      let requestsData: any[] = [];
      let accessGranted = false;

      try {
        const tenantsResponse = await tenantsService.getAll();
        tenantsData = a(tenantsResponse);
        accessGranted = true;
      } catch {
        tenantsData = [];
      }

      try {
        const requestsResponse = await subscriptionsService.getAllRequests();
        requestsData = a(requestsResponse);
        accessGranted = true;
      } catch {
        try {
          const partnerRequestsResponse = await subscriptionsService.getPartnerRequests();
          requestsData = a(partnerRequestsResponse);
          accessGranted = true;
        } catch {
          requestsData = [];
        }
      }

      setTenantReports(tenantsData);
      setSubscriptionRequests(requestsData);
      setHasSubscriptionsAccess(accessGranted);
    } catch (e) {
      toast.error('Error al cargar datos del reporte');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleExport = () => {
    const rows = [
      ['REPORTE EJECUTIVO CONSOLIDADO', ''],
      ['Generado', new Date().toLocaleString()],
      ['Período', dateRange],
      [''],
      ['=== KPIs EJECUTIVOS ===', ''],
      ['Ingresos Totales', fmt(totalIncome)],
      ['Gastos Totales', fmt(totalExpenses)],
      ['Utilidad Neta', fmt(netProfit)],
      ['Margen Bruto', grossMargin.toFixed(1) + '%'],
      ['ROI', roi + '%'],
      ['EBITDA', fmt(ebitda)],
      ['Ratio Liquidez', currentRatio],
      ['Punto de Equilibrio', fmt(breakEven)],
      ['Valor Inventario', fmt(inventoryVal)],
      ['Clientes Activos', activeClients],
      ['Órdenes Pendientes', pendingOrders],
      [''],
      ['=== TOP PRODUCTOS ===', ''],
      ['Producto', 'Valor', 'Stock', 'Precio'],
      ...topProducts.map(p => [p.name, fmt(p.valor), p.stock, fmt(p.precio)]),
      [''],
      ['=== CLIENTES POR FACTURACIÓN ===', ''],
      ['Cliente', 'Total Facturado'],
      ...customerSegments.map(c => [c.name, fmt(c.value)]),
    ].map(r => r.join(',')).join('\n');

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `reporte_ejecutivo_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Reporte ejecutivo exportado');
  };

  const tooltipStyle = { backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center space-y-3">
        <div className="size-12 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground font-medium">Cargando analytics...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 p-4 md:p-6 pb-20 max-w-[1900px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <BarChart3 className="size-9 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
              Reportes <span className="text-primary">Avanzados</span>
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                {filteredInvoices.length} facturas (período) · {customers.length} clientes · {products.length} productos
              </Badge>
              <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest">
                {activeModulesCount} módulos activos · {pendingRequestCount} pendientes
              </Badge>
              {netProfit >= 0
                ? <Badge className="bg-green-500/10 text-green-500 border-green-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest"><CheckCircle2 className="size-3 mr-1 inline" />Rentable</Badge>
                : <Badge className="bg-red-500/10 text-red-500 border-red-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest"><AlertTriangle className="size-3 mr-1 inline" />Déficit</Badge>
              }
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px] rounded-xl font-bold bg-muted/20 border-border/40">
              <Calendar className="mr-2 size-4 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoy">Hoy</SelectItem>
              <SelectItem value="ultima-semana">Última semana</SelectItem>
              <SelectItem value="ultimo-mes">Último mes</SelectItem>
              <SelectItem value="ultimo-trimestre">Último trimestre</SelectItem>
              <SelectItem value="ultimo-año">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="rounded-xl font-bold" onClick={handleExport}>
            <Download className="size-4 mr-2" />Exportar CSV
          </Button>
          <Button size="sm" className="rounded-xl font-bold bg-[#05602b] hover:bg-[#044c22]"
            onClick={() => { window.print(); toast.success('Preparando impresión...'); }}>
            <Printer className="size-4 mr-2" />Imprimir
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex flex-wrap gap-1.5 rounded-2xl border border-border/40">
          {[
            { id: 'ejecutivo', label: 'Ejecutivo', icon: Zap },
            { id: 'financiero', label: 'Financiero', icon: DollarSign },
            { id: 'ventas', label: 'Ventas', icon: ShoppingCart },
            { id: 'inventario', label: 'Inventario', icon: Package },
            { id: 'clientes', label: 'Clientes', icon: Users },
            { id: 'suscripciones', label: 'Suscripciones', icon: Layers },
            { id: 'aprobaciones', label: 'Aprobaciones', icon: CheckCircle2 },
          ].map(t => (
            <TabsTrigger key={t.id} value={t.id}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
              <t.icon className="size-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══ TAB: EJECUTIVO ════════════════════════════════════════════════ */}
        <TabsContent value="ejecutivo" className="m-0 mt-4 space-y-5">
          {/* Strategic KPI Row */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'Ingresos Totales',
                value: fmt(totalIncome),
                sub: `${filteredIncomes.length} transacciones`,
                icon: TrendingUp,
                cardClass: 'border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent',
                iconClass: 'text-green-500',
                valueClass: 'text-green-400',
              },
              {
                label: 'Gastos Totales',
                value: fmt(totalExpenses),
                sub: `${filteredExpenses.length} registros`,
                icon: TrendingDown,
                cardClass: 'border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent',
                iconClass: 'text-red-500',
                valueClass: 'text-red-400',
              },
              {
                label: 'Utilidad Neta',
                value: fmt(netProfit),
                sub: `Margen: ${grossMargin.toFixed(1)}%`,
                icon: DollarSign,
                cardClass: netProfit >= 0
                  ? 'border-primary/20 bg-gradient-to-br from-primary/5 to-transparent'
                  : 'border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent',
                iconClass: netProfit >= 0 ? 'text-primary' : 'text-orange-500',
                valueClass: netProfit >= 0 ? 'text-primary' : 'text-orange-400',
              },
              {
                label: 'Facturas Emitidas',
                value: fmt(totalSales),
                sub: `${filteredInvoices.length} facturas`,
                icon: FileText,
                cardClass: 'border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent',
                iconClass: 'text-blue-500',
                valueClass: 'text-blue-400',
              },
            ].map((kpi, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={kpi.cardClass}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <kpi.icon className={`size-4 ${kpi.iconClass}`} />
                      {kpi.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${kpi.valueClass}`}>{kpi.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Secondary KPI Row */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {[
              { label: 'ROI', value: `${roi}%`, icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/10', desc: 'Retorno inversión' },
              { label: 'EBITDA', value: fmt(ebitda), icon: BarChart2, color: 'text-blue-400', bg: 'bg-blue-500/10', desc: 'Resultado operativo' },
              { label: 'Ratio Liquidez', value: currentRatio, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10', desc: 'Ingresos / Gastos' },
              { label: 'Punto Equilibrio', value: fmt(breakEven), icon: Target, color: 'text-amber-400', bg: 'bg-amber-500/10', desc: 'Mínimo para cubrir costos' },
            ].map((k, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${k.bg}`}><k.icon className={`size-4 ${k.color}`} /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{k.label}</p>
                    <p className={`text-lg font-black ${k.color}`}>{k.value}</p>
                    <p className="text-[10px] text-muted-foreground/60">{k.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="size-4 text-primary" /> Tendencia Financiera — Últimos 6 Meses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthlyTrend}>
                    <defs>
                      <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                    <Legend iconType="circle" />
                    <Area type="monotone" dataKey="ingresos" stroke="#10b981" fill="url(#gInc)" strokeWidth={2} name="Ingresos" />
                    <Area type="monotone" dataKey="gastos"   stroke="#ef4444" fill="url(#gExp)" strokeWidth={2} name="Gastos" />
                    <ReferenceLine y={breakEven / 6} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Break-even', fill: '#f59e0b', fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <PieIcon className="size-4 text-primary" /> Salud Financiera
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                    <Radar name="Score" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.25} strokeWidth={2} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v.toFixed(1), 'Score']} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Alerts */}
          <div className="grid gap-3 md:grid-cols-3">
            <Card className={`p-4 border-l-4 ${netProfit >= 0 ? 'border-l-green-500 bg-green-500/5' : 'border-l-red-500 bg-red-500/5'}`}>
              <div className="flex items-center gap-2 mb-1">
                {netProfit >= 0 ? <CheckCircle2 className="size-4 text-green-500" /> : <AlertTriangle className="size-4 text-red-500" />}
                <p className="text-xs font-black uppercase tracking-widest">Rentabilidad</p>
              </div>
              <p className="text-lg font-black">{netProfit >= 0 ? 'Positiva' : 'Negativa'}</p>
              <p className="text-[10px] text-muted-foreground">Margen neto: {grossMargin.toFixed(1)}%</p>
            </Card>
            <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-500/5">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="size-4 text-amber-500" />
                <p className="text-xs font-black uppercase tracking-widest">Órdenes Activas</p>
              </div>
              <p className="text-lg font-black">{pendingOrders}</p>
              <p className="text-[10px] text-muted-foreground">Pendientes de procesar</p>
            </Card>
            <Card className="p-4 border-l-4 border-l-blue-500 bg-blue-500/5">
              <div className="flex items-center gap-2 mb-1">
                <Users className="size-4 text-blue-500" />
                <p className="text-xs font-black uppercase tracking-widest">Cobranza</p>
              </div>
              <p className="text-lg font-black">{pct(totalPaid, totalSales)}</p>
              <p className="text-[10px] text-muted-foreground">Del total facturado cobrado</p>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ TAB: FINANCIERO ════════════════════════════════════════════════ */}
        <TabsContent value="financiero" className="m-0 mt-4 space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Ingresos Brutos',
                value: fmt(totalIncome),
                sub: `${filteredIncomes.length} registros`,
                cardClass: 'border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent',
                valueClass: 'text-green-400',
              },
              {
                title: 'Gastos Operativos',
                value: fmt(totalExpenses),
                sub: `${filteredExpenses.length} egresos`,
                cardClass: 'border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent',
                valueClass: 'text-red-400',
              },
              {
                title: 'Resultado Neto',
                value: fmt(netProfit),
                sub: `Margen: ${grossMargin.toFixed(1)}%`,
                cardClass: netProfit >= 0
                  ? 'border-primary/20 bg-gradient-to-br from-primary/5 to-transparent'
                  : 'border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent',
                valueClass: netProfit >= 0 ? 'text-primary' : 'text-orange-400',
              },
            ].map((k, i) => (
              <Card key={i} className={k.cardClass}>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{k.title}</CardTitle></CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${k.valueClass}`}>{k.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Ingresos vs Gastos Mensuales (P&L)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyTrend} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                    <Legend />
                    <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" radius={[4,4,0,0]} />
                    <Bar dataKey="gastos"   fill="#ef4444" name="Gastos" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Distribución de Gastos por Categoría</CardTitle></CardHeader>
              <CardContent>
                {expByCat.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={expByCat} innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {expByCat.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center"><TrendingDown className="size-12 mx-auto mb-2 opacity-20" /><p className="text-sm">Sin gastos registrados</p></div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Flujo de Utilidad Mensual</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Bar dataKey="utilidad" name="Utilidad" radius={[4,4,0,0]}
                    fill="#10b981"
                    label={{ position: 'top', fontSize: 10, formatter: (v: number) => v > 0 ? `+${(v/1000).toFixed(1)}k` : `${(v/1000).toFixed(1)}k` }}
                  >
                    {monthlyTrend.map((entry, i) => <Cell key={i} fill={entry.utilidad >= 0 ? '#10b981' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: VENTAS ════════════════════════════════════════════════════ */}
        <TabsContent value="ventas" className="m-0 mt-4 space-y-5">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {[
              { label: 'Total Facturado', value: fmt(totalSales), c: 'text-green-400', bg: 'bg-green-500/10', icon: DollarSign },
              { label: 'Total Cobrado',   value: fmt(totalPaid), c: 'text-blue-400', bg: 'bg-blue-500/10', icon: CheckCircle2 },
              { label: 'Órds. Activas',  value: pendingOrders, c: 'text-amber-400', bg: 'bg-amber-500/10', icon: ShoppingCart },
              { label: 'Facturas',        value: filteredInvoices.length, c: 'text-purple-400', bg: 'bg-purple-500/10', icon: FileText },
            ].map((k, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${k.bg}`}><k.icon className={`size-4 ${k.c}`} /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{k.label}</p>
                    <p className={`text-lg font-black ${k.c}`}>{k.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Facturación Mensual</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                    <Legend />
                    <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={3} name="Ingresos" dot={{ fill: '#10b981', r: 4 }} />
                    <Line type="monotone" dataKey="facturas" stroke="#3b82f6" strokeWidth={2} name="Facturas" dot={{ fill: '#3b82f6', r: 3 }} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Estado de Facturas</CardTitle></CardHeader>
              <CardContent>
                {invoiceStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={invoiceStatus} dataKey="count" nameKey="status" cx="50%" cy="50%"
                        outerRadius={100} label={({ status, count }) => `${status}: ${count}`} labelLine={false}>
                        {invoiceStatus.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">Sin facturas registradas</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Facturación por Cliente (Top)</CardTitle></CardHeader>
            <CardContent>
              {customerSegments.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={customerSegments} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={160} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                    <Bar dataKey="value" name="Total Facturado" radius={[0, 4, 4, 0]}>
                      {customerSegments.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  <p className="text-sm">Sin facturas con clientes asignados</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: INVENTARIO ════════════════════════════════════════════════ */}
        <TabsContent value="inventario" className="m-0 mt-4 space-y-5">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {[
              { label: 'Valor Inventario', value: fmt(inventoryVal), c: 'text-purple-400', bg: 'bg-purple-500/10', icon: Package },
              { label: 'Productos',        value: products.length,   c: 'text-blue-400',   bg: 'bg-blue-500/10',   icon: Layers },
              { label: 'Categorías',       value: categories.length, c: 'text-green-400',  bg: 'bg-green-500/10',  icon: PieIcon },
              { label: 'Clase A (70%)',    value: inventoryABC.filter(p => p.clase === 'A').length, c: 'text-amber-400', bg: 'bg-amber-500/10', icon: Target },
            ].map((k, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${k.bg}`}><k.icon className={`size-4 ${k.c}`} /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{k.label}</p>
                    <p className={`text-lg font-black ${k.c}`}>{k.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Top Productos por Valor</CardTitle></CardHeader>
              <CardContent>
                {topProducts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={topProducts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={v => v.length > 12 ? v.slice(0, 12) + '…' : v} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                      <Bar dataKey="valor" name="Valor Total" radius={[4, 4, 0, 0]}>
                        {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">Sin productos registrados</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Clasificación ABC de Inventario</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {inventoryABC.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge className={`text-[9px] font-black w-6 h-6 flex items-center justify-center rounded-lg p-0 ${
                          p.clase === 'A' ? 'bg-green-500/15 text-green-500' :
                          p.clase === 'B' ? 'bg-blue-500/15 text-blue-500' :
                          'bg-muted/30 text-muted-foreground'}`}>
                          {p.clase}
                        </Badge>
                        <span className="text-xs font-medium truncate">{p.name}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold">{fmt(p.valor)}</p>
                        <p className="text-[10px] text-muted-foreground">{p.stock} uds</p>
                      </div>
                    </div>
                  ))}
                  {inventoryABC.length === 0 && <p className="text-sm text-center text-muted-foreground py-8">Sin productos</p>}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {(['A', 'B', 'C'] as const).map(cls => {
                    const count = inventoryABC.filter(p => p.clase === cls).length;
                    const val   = inventoryABC.filter(p => p.clase === cls).reduce((a, p) => a + p.valor, 0);
                    const colors = { A: 'text-green-400', B: 'text-blue-400', C: 'text-muted-foreground' };
                    return (
                      <div key={cls} className="text-center p-2 rounded-lg bg-muted/20">
                        <p className={`text-lg font-black ${colors[cls]}`}>Clase {cls}</p>
                        <p className="text-xs font-bold">{count} productos</p>
                        <p className="text-[10px] text-muted-foreground">{fmt(val)}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ TAB: CLIENTES ══════════════════════════════════════════════════ */}
        <TabsContent value="clientes" className="m-0 mt-4 space-y-5">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {[
              { label: 'Total Clientes',   value: customers.length, c: 'text-blue-400',   bg: 'bg-blue-500/10',   icon: Users },
              { label: 'Activos',          value: activeClients,    c: 'text-green-400',  bg: 'bg-green-500/10',  icon: CheckCircle2 },
              { label: 'Con Facturas',     value: customerSegments.length, c: 'text-purple-400', bg: 'bg-purple-500/10', icon: FileText },
              { label: 'Ticket Promedio',  value: fmt(customers.length > 0 ? totalSales / Math.max(filteredInvoices.length, 1) : 0), c: 'text-amber-400', bg: 'bg-amber-500/10', icon: Target },
            ].map((k, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${k.bg}`}><k.icon className={`size-4 ${k.c}`} /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{k.label}</p>
                    <p className={`text-lg font-black ${k.c}`}>{k.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Segmentación de Clientes por Tipo</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Empresa', value: customers.filter(c => c.type === 'COMPANY').length },
                        { name: 'Individual', value: customers.filter(c => c.type === 'INDIVIDUAL').length },
                        { name: 'Otro', value: customers.filter(c => c.type !== 'COMPANY' && c.type !== 'INDIVIDUAL').length },
                      ].filter(d => d.value > 0)}
                      cx="50%" cy="50%" outerRadius={100} dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}
                    >
                      {COLORS.map((c, i) => <Cell key={i} fill={c} stroke="transparent" />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Top Clientes por Facturación</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {customerSegments.length > 0 ? customerSegments.map((c, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex size-7 items-center justify-center rounded-lg text-xs font-black text-white"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{c.name}</p>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: pct(c.value, customerSegments[0]?.value || 1), backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                      <p className="text-sm font-bold text-primary">{fmt(c.value)}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-center text-muted-foreground py-8">Sin datos de clientes con facturas</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ TAB: SUSCRIPCIONES ═════════════════════════════════════════════ */}
        <TabsContent value="suscripciones" className="m-0 mt-4 space-y-5">
          {!hasSubscriptionsAccess ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No tienes permisos para consultar datos de suscripciones.</p>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {[
                  { label: 'Empresas Activas', value: tenantReports.length, c: 'text-blue-400', bg: 'bg-blue-500/10', icon: Users },
                  { label: 'Módulos Activos', value: activeModulesCount, c: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Layers },
                  { label: 'Solicitudes', value: subscriptionRequests.length, c: 'text-purple-400', bg: 'bg-purple-500/10', icon: FileText },
                  { label: 'Pendientes', value: pendingRequestCount, c: 'text-amber-400', bg: 'bg-amber-500/10', icon: AlertTriangle },
                ].map((k, i) => (
                  <Card key={i} className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-xl p-2.5 ${k.bg}`}><k.icon className={`size-4 ${k.c}`} /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{k.label}</p>
                        <p className={`text-lg font-black ${k.c}`}>{k.value}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Módulos Más Solicitados</CardTitle></CardHeader>
                  <CardContent>
                    {requestedModules.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={requestedModules}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="module" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={v => String(v).slice(0, 12)} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="count" name="Solicitudes" radius={[4, 4, 0, 0]}>
                            {requestedModules.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                        <p className="text-sm">Sin solicitudes registradas</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Distribución de Planes por Empresa</CardTitle></CardHeader>
                  <CardContent>
                    {planDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie data={planDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                            label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                            {planDistribution.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                        <p className="text-sm">Sin empresas registradas</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">Empresas con Mayor Cobertura de Módulos</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topTenantsByModules.length > 0 ? topTenantsByModules.map((tenant, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                        <div>
                          <p className="text-sm font-bold">{tenant.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{tenant.users} usuarios</p>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-black uppercase">
                          {tenant.modules} módulos
                        </Badge>
                      </div>
                    )) : (
                      <p className="text-sm text-center text-muted-foreground py-8">Sin datos para mostrar</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ═══ TAB: APROBACIONES ═══════════════════════════════════════════════ */}
        <TabsContent value="aprobaciones" className="m-0 mt-4 space-y-5">
          {!hasSubscriptionsAccess ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No tienes permisos para consultar aprobaciones.</p>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {[
                  { label: 'Pendientes', value: pendingRequestCount, c: 'text-amber-400', bg: 'bg-amber-500/10', icon: AlertTriangle },
                  { label: 'Aprobadas', value: approvedRequestCount, c: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
                  { label: 'Rechazadas', value: rejectedRequestCount, c: 'text-rose-400', bg: 'bg-rose-500/10', icon: TrendingDown },
                  { label: 'Total', value: subscriptionRequests.length, c: 'text-blue-400', bg: 'bg-blue-500/10', icon: FileText },
                ].map((k, i) => (
                  <Card key={i} className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-xl p-2.5 ${k.bg}`}><k.icon className={`size-4 ${k.c}`} /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{k.label}</p>
                        <p className={`text-lg font-black ${k.c}`}>{k.value}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Evolución de Aprobaciones (6 meses)</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={approvalsMonthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Line type="monotone" dataKey="pendientes" stroke="#f59e0b" strokeWidth={2} name="Pendientes" />
                        <Line type="monotone" dataKey="aprobadas" stroke="#10b981" strokeWidth={2} name="Aprobadas" />
                        <Line type="monotone" dataKey="rechazadas" stroke="#ef4444" strokeWidth={2} name="Rechazadas" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Distribución por Estado</CardTitle></CardHeader>
                  <CardContent>
                    {requestsByStatus.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie data={requestsByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100}
                            label={({ status, count }) => `${status}: ${count}`} labelLine={false}>
                            {requestsByStatus.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                        <p className="text-sm">Sin solicitudes registradas</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">Últimas Solicitudes</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {subscriptionRequests.slice(0, 10).map((req, i) => (
                      <div key={req.id || i} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                        <div>
                          <p className="text-sm font-bold">{req.requestedModule}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                            {req.clientTenant?.name || 'Empresa no identificada'}
                          </p>
                        </div>
                        <Badge className={
                          req.status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            : req.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        }>
                          {req.status}
                        </Badge>
                      </div>
                    ))}
                    {subscriptionRequests.length === 0 && (
                      <p className="text-sm text-center text-muted-foreground py-8">Sin solicitudes para mostrar</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
