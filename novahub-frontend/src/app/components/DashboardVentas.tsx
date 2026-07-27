import { useEffect, useState } from 'react';
import { motion, Variants } from 'motion/react';
import {
  DollarSign, CalendarDays, TrendingUp, Clock,
  Loader2, AlertTriangle, Receipt, BarChart3, PieChart as PieChartIcon, Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import { cn } from './ui/utils';
import { reportsService } from '../services/ventas.service';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

const statusColors: Record<string, string> = {
  PENDIENTE: '#f59e0b',
  PAGADA: '#10b981',
  CANCELADA: '#ef4444',
  ANULADA: '#6b7280',
  VENCIDA: '#f97316',
};

const statusLabels: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  PAGADA: 'Pagada',
  CANCELADA: 'Cancelada',
  ANULADA: 'Anulada',
  VENCIDA: 'Vencida',
};

const fmt = (amount: number) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(amount);

interface SalesSummary {
  kpis: {
    todayTotal: number;
    todayCount: number;
    weekTotal: number;
    weekCount: number;
    monthTotal: number;
    monthCount: number;
    totalInvoices: number;
    pendingInvoices: number;
  };
  statusBreakdown: { status: string; total: number }[];
  salesByDay: { date: string; total: number }[];
  topProducts: { name: string; qty: number; total: number }[];
}

export function DashboardVentas() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SalesSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await reportsService.getSalesSummary();
      setData(res);
      setError(false);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const kpiCards = data ? [
    { label: 'Total Hoy', value: fmt(data.kpis.todayTotal), sub: `${data.kpis.todayCount} facturas`, icon: DollarSign, accent: 'text-emerald-400', iconBg: 'bg-emerald-500/10' },
    { label: 'Esta Semana', value: fmt(data.kpis.weekTotal), sub: `${data.kpis.weekCount} facturas`, icon: CalendarDays, accent: 'text-blue-400', iconBg: 'bg-blue-500/10' },
    { label: 'Este Mes', value: fmt(data.kpis.monthTotal), sub: `${data.kpis.monthCount} facturas`, icon: TrendingUp, accent: 'text-violet-400', iconBg: 'bg-violet-500/10' },
    { label: 'Facturas Pendientes', value: String(data.kpis.pendingInvoices), sub: `de ${data.kpis.totalInvoices} totales`, icon: Clock, accent: 'text-amber-400', iconBg: 'bg-amber-500/10' },
  ] : [];

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background p-6">
        <Loader2 className="size-8 animate-spin text-primary/40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6">
        <Card className="border-border/50 rounded-3xl bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <AlertTriangle className="size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground font-bold">No se pudieron cargar los datos de ventas</p>
            <p className="text-xs text-muted-foreground/60">Verificá la conexión e intentá de nuevo.</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-2 relative">
        <div className="absolute -left-10 -top-10 size-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl tracking-tight text-foreground mb-2 font-bold">
            Dashboard de{' '}
            <span className="bg-primary text-primary-foreground px-3 py-1 rounded-md inline-block transform -rotate-2 shadow-lg font-semibold mx-1 border border-primary/50">Ventas</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl">
            Resumen de facturación, ingresos y rendimiento comercial.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <motion.div key={kpi.label} variants={itemVariants}>
              <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 group border-border/30 bg-card/80 backdrop-blur-sm shadow-md rounded-2xl">
                <div className={cn('absolute -top-8 -right-8 size-24 rounded-full blur-2xl opacity-40 pointer-events-none', kpi.iconBg)} />
                <CardContent className="p-4 relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.label}</span>
                    <div className={cn('size-8 items-center justify-center rounded-lg flex', kpi.iconBg)}>
                      <Icon className={cn('size-4', kpi.accent)} />
                    </div>
                  </div>
                  <p className="text-2xl font-black tracking-tighter tabular-nums text-foreground">{kpi.value}</p>
                  <p className="text-[11px] font-bold mt-1 text-muted-foreground">{kpi.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* BarChart - Ventas Diarias */}
        <Card className="rounded-2xl border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              <CardTitle className="text-sm font-black uppercase tracking-tight">Ventas Diarias (30 días)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.salesByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `C$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [fmt(value), 'Total']}
                  labelFormatter={(label) => {
                    const d = new Date(label);
                    return d.toLocaleDateString('es-NI', { weekday: 'long', day: 'numeric', month: 'long' });
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* PieChart - Estado de Facturas */}
        <Card className="rounded-2xl border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <div className="flex items-center gap-2">
              <PieChartIcon className="size-4 text-primary" />
              <CardTitle className="text-sm font-black uppercase tracking-tight">Estado de Facturas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.statusBreakdown}
                  dataKey="total"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                >
                  {data.statusBreakdown.map((entry) => (
                    <Cell key={entry.status} fill={statusColors[entry.status] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [value, statusLabels[name] || name]}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs font-medium text-muted-foreground">{statusLabels[value] || value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Productos */}
      <Card className="rounded-2xl bg-card/80 backdrop-blur-sm border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="pb-2 px-5 pt-4">
          <div className="flex items-center gap-2">
            <Package className="size-4 text-primary" />
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-tight">Top 10 Productos</CardTitle>
              <p className="text-[10px] text-muted-foreground/50 font-medium">Los más vendidos del período.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="font-black py-2.5 pl-5 uppercase text-[10px] tracking-widest">#</TableHead>
                  <TableHead className="font-black py-2.5 uppercase text-[10px] tracking-widest">Producto</TableHead>
                  <TableHead className="font-black py-2.5 text-right uppercase text-[10px] tracking-widest">Cantidad</TableHead>
                  <TableHead className="font-black py-2.5 text-right pr-5 uppercase text-[10px] tracking-widest">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topProducts.slice(0, 10).map((p, i) => (
                  <TableRow key={p.name} className="border-border/30 hover:bg-muted/30 transition-colors">
                    <TableCell className="font-black pl-5 text-xs text-muted-foreground/50 w-8">{i + 1}</TableCell>
                    <TableCell className="text-xs font-bold">{p.name}</TableCell>
                    <TableCell className="font-black text-right text-xs tabular-nums">{p.qty}</TableCell>
                    <TableCell className="font-black text-right pr-5 text-xs tabular-nums text-emerald-500">{fmt(p.total)}</TableCell>
                  </TableRow>
                ))}
                {data.topProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground/40 italic font-medium">
                      Sin ventas registradas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
