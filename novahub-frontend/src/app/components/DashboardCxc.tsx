import { useEffect, useState, useCallback } from 'react';
import { motion, Variants } from 'motion/react';
import {
  DollarSign, Clock, AlertTriangle, Loader2, Users, Truck,
  CheckCircle2, XCircle, FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';
import { reportsService } from '../services/ventas.service';
import { purchasesReportsService } from '../services/compras.service';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

const fmt = (amount: number) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(amount);

interface AgingData {
  summary: { current: number; days1_30: number; days31_60: number; days61_90: number; days90plus: number; total: number };
  byCustomer?: any[];
  bySupplier?: any[];
}

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

const defaultChecklist: ChecklistItem[] = [
  { id: '1', label: 'Todas las facturas del período están registradas', done: false },
  { id: '2', label: 'Todos los pagos recibidos están aplicados', done: false },
  { id: '3', label: 'Facturas de proveedores del período registradas', done: false },
  { id: '4', label: 'Pagos realizados conciliados', done: false },
  { id: '5', label: 'Asientos contables del período generados', done: false },
  { id: '6', label: 'Concilación bancaria del mes realizada', done: false },
  { id: '7', label: 'Estado de resultados revisado', done: false },
  { id: '8', label: 'Balance general verificado', done: false },
];

function DashboardCxc() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ar, setAr] = useState<AgingData | null>(null);
  const [ap, setAp] = useState<AgingData | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => {
    try {
      const saved = localStorage.getItem('erp-cierre-checklist');
      return saved ? JSON.parse(saved) : defaultChecklist;
    } catch { return defaultChecklist; }
  });

  useEffect(() => {
    localStorage.setItem('erp-cierre-checklist', JSON.stringify(checklist));
  }, [checklist]);

  const loadData = useCallback(async () => {
    try {
      const [arRes, apRes] = await Promise.all([
        reportsService.getAging(),
        purchasesReportsService.getAging(),
      ]);
      setAr(arRes);
      setAp(apRes);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const toggleChecklist = (id: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
  };

  const progress = checklist.length > 0 ? Math.round((checklist.filter(c => c.done).length / checklist.length) * 100) : 0;

  const buildBucketData = (summary: AgingData['summary']) => [
    { name: 'Al día', value: summary.current },
    { name: '1-30d', value: summary.days1_30 },
    { name: '31-60d', value: summary.days31_60 },
    { name: '61-90d', value: summary.days61_90 },
    { name: '90d+', value: summary.days90plus },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background p-6">
        <Loader2 className="size-8 animate-spin text-primary/40" />
      </div>
    );
  }

  if (error || !ar || !ap) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 md:p-6">
        <Card className="border-border/50 rounded-3xl bg-card shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <AlertTriangle className="size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground font-bold">No se pudieron cargar los datos</p>
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
            Cuentas por{' '}
            <span className="bg-primary text-primary-foreground px-3 py-1 rounded-md inline-block transform -rotate-2 shadow-lg font-semibold mx-1 border border-primary/50">Cobrar / Pagar</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl">
            Antigüedad de saldos y checklist de cierre contable.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={itemVariants}>
          <Card className="rounded-2xl border-border/30 bg-card/80 backdrop-blur-sm shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Por Cobrar Total</span>
                <div className="size-8 flex items-center justify-center rounded-lg bg-emerald-500/10"><DollarSign className="size-4 text-emerald-400" /></div>
              </div>
              <p className="text-2xl font-black tracking-tighter tabular-nums text-foreground">{fmt(ar.summary.total)}</p>
              <p className="text-[11px] font-bold mt-1 text-muted-foreground">{ar.byCustomer?.length || 0} clientes</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="rounded-2xl border-border/30 bg-card/80 backdrop-blur-sm shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Vencido (AR)</span>
                <div className="size-8 flex items-center justify-center rounded-lg bg-red-500/10"><Clock className="size-4 text-red-400" /></div>
              </div>
              <p className="text-2xl font-black tracking-tighter tabular-nums text-foreground">{fmt(ar.summary.days1_30 + ar.summary.days31_60 + ar.summary.days61_90 + ar.summary.days90plus)}</p>
              <p className="text-[11px] font-bold mt-1 text-muted-foreground">al día: {fmt(ar.summary.current)}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="rounded-2xl border-border/30 bg-card/80 backdrop-blur-sm shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Por Pagar Total</span>
                <div className="size-8 flex items-center justify-center rounded-lg bg-amber-500/10"><DollarSign className="size-4 text-amber-400" /></div>
              </div>
              <p className="text-2xl font-black tracking-tighter tabular-nums text-foreground">{fmt(ap.summary.total)}</p>
              <p className="text-[11px] font-bold mt-1 text-muted-foreground">{ap.bySupplier?.length || 0} proveedores</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="rounded-2xl border-border/30 bg-card/80 backdrop-blur-sm shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Vencido (AP)</span>
                <div className="size-8 flex items-center justify-center rounded-lg bg-red-500/10"><AlertTriangle className="size-4 text-red-400" /></div>
              </div>
              <p className="text-2xl font-black tracking-tighter tabular-nums text-foreground">{fmt(ap.summary.days1_30 + ap.summary.days31_60 + ap.summary.days61_90 + ap.summary.days90plus)}</p>
              <p className="text-[11px] font-bold mt-1 text-muted-foreground">al día: {fmt(ap.summary.current)}</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Aging Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-emerald-400" />
              <CardTitle className="text-sm font-black uppercase tracking-tight">Cuentas por Cobrar</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={buildBucketData(ar.summary)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `C$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(value: number) => [fmt(value), 'Saldo']} />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <div className="flex items-center gap-2">
              <Truck className="size-4 text-amber-400" />
              <CardTitle className="text-sm font-black uppercase tracking-tight">Cuentas por Pagar</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={buildBucketData(ap.summary)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `C$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(value: number) => [fmt(value), 'Saldo']} />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Invoices & Checklist */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Clientes con saldo vencido */}
        <Card className="rounded-2xl border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <CardTitle className="text-sm font-black uppercase tracking-tight">Clientes con Saldo Vencido</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-[320px] overflow-y-auto">
            {ar.byCustomer && ar.byCustomer.length > 0 ? (
              <div className="divide-y divide-border/20">
                {ar.byCustomer.filter((c: any) => c.buckets.total > 0).slice(0, 10).map((c: any, idx: number) => (
                  <div key={c.customer?.id || `overdue-${idx}`} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-7 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                        <Users className="size-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-xs font-bold truncate">{c.customer?.name || 'Cliente'}</span>
                    </div>
                    <span className="text-xs font-black tabular-nums text-red-400">{fmt(c.buckets.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground/40 italic font-medium">Sin datos</div>
            )}
          </CardContent>
        </Card>

        {/* Checklist de Cierre */}
        <Card className="rounded-2xl border-border/40 bg-card/80 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                <CardTitle className="text-sm font-black uppercase tracking-tight">Checklist de Cierre</CardTitle>
              </div>
              <Badge variant={progress === 100 ? 'default' : 'secondary'} className="text-[10px] font-black">
                {progress}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/20">
              {checklist.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleChecklist(item.id)}
                  className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  {item.done ? (
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="size-4 text-muted-foreground/30 shrink-0" />
                  )}
                  <span className={cn('text-xs font-bold', item.done ? 'text-muted-foreground/50 line-through' : '')}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default DashboardCxc;
export { DashboardCxc };
