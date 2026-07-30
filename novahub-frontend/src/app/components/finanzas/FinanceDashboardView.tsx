import { useMemo, useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Landmark,
  AlertTriangle, CalendarClock, BarChart3, ArrowUpRight, ArrowDownRight, Wallet,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, ComposedChart, Line, Legend, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useCurrency } from '../../contexts/CurrencyContext';
import { invoicesService } from '../../services/ventas.service';
import { supplierInvoicesService } from '../../services/compras.service';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';

interface Props {
  incomes: any[];
  expenses: any[];
  recurringExpenses: any[];
  recurringIncomes?: any[];
  accounts?: any[];
}

const AXIS_TICK = { fontSize: 11, fill: '#9ca3af', fontWeight: 500 }
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

function TooltipCard({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
      <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: 'hsl(var(--foreground))' }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ fontSize: 11, color: entry.color, fontWeight: 600, margin: 0 }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

export function FinanceDashboardView({ incomes, expenses, recurringExpenses, recurringIncomes, accounts }: Props) {
  const { displayCurrency, convertAmount } = useCurrency();
  const sym = displayCurrency === 'USD' ? '$' : 'C$';

  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    invoicesService.getAll().then((res: any) => setSalesInvoices(res?.data || res || [])).catch(() => {});
    supplierInvoicesService.getAll().then((res: any) => setSupplierInvoices(res?.data || res || [])).catch(() => {});
    contabilidadService.getChartOfAccounts().then((res: any) => {
      const all = res?.data || res || [];
      setBankAccounts(all.filter((a: any) => ['CASH', 'BANK'].includes(String(a.subtype || '').toUpperCase()) || String(a.name || '').toUpperCase().includes('CAJA') || String(a.name || '').toUpperCase().includes('BANCO')));
    }).catch(() => {});
  }, []);

  const totalIncome = useMemo(() => incomes.reduce((a, i) => a + convertAmount(i.amount || 0, i.currency, i.exchangeRate), 0), [incomes, convertAmount]);
  const totalExpense = useMemo(() => expenses.reduce((a, e) => a + convertAmount(e.amount || 0, e.currency, e.exchangeRate), 0), [expenses, convertAmount]);
  const netCashFlow = totalIncome - totalExpense;
  const marginPct = totalIncome > 0 ? ((netCashFlow / totalIncome) * 100) : 0;

  const totalCxc = useMemo(() => salesInvoices.reduce((a, inv: any) => a + Number(inv.balanceDue || inv.total || 0), 0), [salesInvoices]);
  const totalCxp = useMemo(() => supplierInvoices.reduce((a, inv: any) => a + Number(inv.balanceDue || inv.total || 0), 0), [supplierInvoices]);
  const cxcOverdue = useMemo(() => salesInvoices.filter((inv: any) => {
    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    return due && due < new Date() && Number(inv.balanceDue || inv.total || 0) > 0;
  }).reduce((a, inv: any) => a + Number(inv.balanceDue || inv.total || 0), 0), [salesInvoices]);
  const cxpOverdue = useMemo(() => supplierInvoices.filter((inv: any) => {
    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    return due && due < new Date() && Number(inv.balanceDue || inv.total || 0) > 0;
  }).reduce((a, inv: any) => a + Number(inv.balanceDue || inv.total || 0), 0), [supplierInvoices]);
  const bankBalance = useMemo(() => bankAccounts.reduce((a, acc: any) => a + Number(acc.balance || 0), 0), [bankAccounts]);

  const activeRecurringExpenses = useMemo(() => recurringExpenses.filter((r: any) => r.status === 'ACTIVE' && Number(r.amount) > 0), [recurringExpenses]);
  const activeRecurringIncomes = useMemo(() => (recurringIncomes || []).filter((r: any) => r.status === 'ACTIVE' && Number(r.amount) > 0), [recurringIncomes]);
  const monthlyRecurring = useMemo(() =>
    activeRecurringExpenses.reduce((a, r) => a + convertAmount(r.amount || 0, r.currency, r.exchangeRate), 0),
    [activeRecurringExpenses, convertAmount]
  );
  const monthlyRecurringIncome = useMemo(() =>
    activeRecurringIncomes.reduce((a, r) => a + convertAmount(r.amount || 0, r.currency, r.exchangeRate), 0),
    [activeRecurringIncomes, convertAmount]
  );
  const next7d = monthlyRecurring * (7 / 30);
  const next15d = monthlyRecurring * (15 / 30);
  const next30d = monthlyRecurring;
  const projected30 = netCashFlow + monthlyRecurringIncome - monthlyRecurring;
  const projected60 = projected30 + monthlyRecurringIncome - monthlyRecurring;
  const projected90 = projected60 + monthlyRecurringIncome - monthlyRecurring;

  const monthlyData = useMemo(() => {
    const months: Record<string, { income: number; expense: number; net: number }> = {};
    for (const i of incomes) { const m = i.date ? i.date.substring(0, 7) : 'unknown'; months[m] = months[m] || { income: 0, expense: 0, net: 0 }; months[m].income += convertAmount(i.amount || 0, i.currency, i.exchangeRate); }
    for (const e of expenses) { const m = e.date ? e.date.substring(0, 7) : 'unknown'; months[m] = months[m] || { income: 0, expense: 0, net: 0 }; months[m].expense += convertAmount(e.amount || 0, e.currency, e.exchangeRate); }
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({ month, ...d, net: d.income - d.expense }));
  }, [incomes, expenses, convertAmount]);

  const agingData = useMemo(() => {
    const ranges = [{ label: '0-30 días', min: 0, max: 30 }, { label: '31-60 días', min: 31, max: 60 }, { label: '61-90 días', min: 61, max: 90 }, { label: '+90 días', min: 91, max: Infinity }];
    return ranges.map(r => {
      const cxcAmt = salesInvoices.filter((inv: any) => { const due = inv.dueDate ? new Date(inv.dueDate) : null; if (!due) return false; const days = Math.floor((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24)); return days >= r.min && days <= r.max && Number(inv.balanceDue || inv.total || 0) > 0; }).reduce((a: number, inv: any) => a + Number(inv.balanceDue || inv.total || 0), 0);
      const cxpAmt = supplierInvoices.filter((inv: any) => { const due = inv.dueDate ? new Date(inv.dueDate) : null; if (!due) return false; const days = Math.floor((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24)); return days >= r.min && days <= r.max && Number(inv.balanceDue || inv.total || 0) > 0; }).reduce((a: number, inv: any) => a + Number(inv.balanceDue || inv.total || 0), 0);
      return { label: r.label, cxc: cxcAmt, cxp: cxpAmt };
    });
  }, [salesInvoices, supplierInvoices]);

  const projectData = useMemo(() => {
    const last = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1] : null;
    const base = last ? last.net + monthlyRecurringIncome - monthlyRecurring : 0;
    return [{ label: 'Actual', amount: base }, { label: '30d', amount: projected30 }, { label: '60d', amount: projected60 }, { label: '90d', amount: projected90 }];
  }, [monthlyData, projected30, projected60, projected90, monthlyRecurringIncome, monthlyRecurring]);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const e of expenses) { const cat = e.category || 'OTROS'; cats[cat] = (cats[cat] || 0) + convertAmount(e.amount || 0, e.currency, e.exchangeRate); }
    return Object.entries(cats).sort(([, a], [, b]) => b - a).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [expenses, convertAmount]);

  const fmt = (n: number) => sym + ' ' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtShort = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return sym + (n / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(n) >= 1_000) return sym + (n / 1_000).toFixed(1) + 'K';
    return sym + n.toLocaleString(undefined, { minimumFractionDigits: 0 });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        <KpiCard icon={Landmark} label="Saldo Disponible" value={fmt(bankBalance)} />
        <KpiCard icon={TrendingUp} label="Ingresos Cobrados" value={fmt(totalIncome)} />
        <KpiCard icon={TrendingDown} label="Pagos Realizados" value={fmt(totalExpense)} />
        <KpiCard icon={DollarSign} label="Flujo Neto" value={fmt(netCashFlow)} />
        <KpiCard icon={BarChart3} label="Total por Cobrar" value={fmt(totalCxc)} sub={`${cxcOverdue > 0 ? fmt(cxcOverdue) + ' vencido' : 'Sin vencidos'}`} />
        <KpiCard icon={BarChart3} label="Total por Pagar" value={fmt(totalCxp)} sub={`${cxpOverdue > 0 ? fmt(cxpOverdue) + ' vencido' : 'Sin vencidos'}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Cobros vs Pagos por Mes</CardTitle>
            <p className="text-[10px] text-muted-foreground">Barras: ingresos (verde) y gastos (rojo). Línea naranja: resultado neto.</p>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={monthlyData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.9} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.6} /></linearGradient>
                  <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0.6} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtShort(v)} width={56} />
                <Tooltip content={<TooltipCard formatter={fmt} />} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Legend verticalAlign="bottom" height={28} formatter={(value: string) => <span style={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: 11 }}>{value}</span>} />
                <Bar dataKey="income" name="Ingresos" fill="url(#incG)" radius={[5, 5, 0, 0]} maxBarSize={36} onClick={(data: any) => toast.info(`Ingresos ${data.month}: ${fmt(data.income)}`)} style={{ cursor: 'pointer' }} />
                <Bar dataKey="expense" name="Gastos" fill="url(#expG)" radius={[5, 5, 0, 0]} maxBarSize={36} onClick={(data: any) => toast.info(`Gastos ${data.month}: ${fmt(data.expense)}`)} style={{ cursor: 'pointer' }} />
                <Line dataKey="net" name="Resultado Neto" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Flujo de Caja Proyectado</CardTitle>
            <p className="text-[10px] text-muted-foreground">Proyección a 30, 60 y 90 días según recurrentes</p>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={projectData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="projG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} /><stop offset="100%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtShort(v)} width={56} />
                <Tooltip content={<TooltipCard formatter={fmt} />} cursor={{ stroke: '#06b6d4', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area dataKey="amount" fill="url(#projG)" stroke="#06b6d4" strokeWidth={2.5} type="monotone" dot={{ r: 4, fill: '#06b6d4', strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">CxC y CxP por Vencimiento</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={agingData} layout="vertical" margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v: number) => fmtShort(v)} />
                <YAxis dataKey="label" type="category" tick={{ ...AXIS_TICK, fill: 'hsl(var(--foreground))', fontWeight: 600 }} width={88} />
                <Tooltip content={<TooltipCard formatter={fmt} />} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Legend verticalAlign="bottom" height={28} formatter={(value: string) => <span style={{ color: 'hsl(var(--foreground))', fontWeight: 600, fontSize: 11 }}>{value}</span>} />
                <Bar dataKey="cxc" name="Por Cobrar" fill="#10b981" radius={[0, 5, 5, 0]} maxBarSize={32} onClick={(data: any) => toast.info(`CxC ${data.label}: ${fmt(data.cxc)}`)} style={{ cursor: 'pointer' }} />
                <Bar dataKey="cxp" name="Por Pagar" fill="#ef4444" radius={[0, 5, 5, 0]} maxBarSize={32} onClick={(data: any) => toast.info(`CxP ${data.label}: ${fmt(data.cxp)}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Gastos por Categoría</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {categoryData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-12 text-center">Sin datos de gastos</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v: number) => fmtShort(v)} />
                  <YAxis dataKey="name" type="category" tick={{ ...AXIS_TICK, fill: 'hsl(var(--foreground))', fontWeight: 500 }} width={88} />
                  <Tooltip content={<TooltipCard formatter={fmt} />} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={32} onClick={(data: any) => toast.info(`Gastos ${data.name}: ${fmt(data.value)}`)} style={{ cursor: 'pointer' }}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-tight text-foreground">Últimos Ingresos</CardTitle>
              <Badge variant="secondary" className="text-[9px]">{incomes.length} total</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {incomes.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground"><TrendingUp className="size-6 mx-auto mb-2 text-muted-foreground/30" />Sin ingresos registrados</div>
            ) : (
              incomes.slice(0, 5).map((inc: any) => (
                <div key={inc.id} className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0 group hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><ArrowUpRight className="size-3.5 text-emerald-500" /></div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{inc.description || inc.source || 'Ingreso'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{inc.category} · {inc.date ? new Date(inc.date).toLocaleDateString('es-NI') : ''}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-500 shrink-0 ml-2">{fmt(convertAmount(inc.amount || 0, inc.currency, inc.exchangeRate))}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-tight text-foreground">Últimos Gastos</CardTitle>
              <Badge variant="secondary" className="text-[9px]">{expenses.length} total</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {expenses.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground"><TrendingDown className="size-6 mx-auto mb-2 text-muted-foreground/30" />Sin gastos registrados</div>
            ) : (
              expenses.slice(0, 5).map((exp: any) => (
                <div key={exp.id} className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0 group hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-7 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0"><ArrowDownRight className="size-3.5 text-rose-500" /></div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{exp.description || exp.source || 'Gasto'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{exp.category} · {exp.date ? new Date(exp.date).toLocaleDateString('es-NI') : ''}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-rose-500 shrink-0 ml-2">{fmt(convertAmount(exp.amount || 0, exp.currency, exp.exchangeRate))}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card className="rounded-xl border-border/40 bg-card shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground truncate">{label}</p>
            <p className="text-sm font-black tabular-nums text-foreground truncate">{value}</p>
            {sub && <p className="text-[7px] text-muted-foreground/60 truncate">{sub}</p>}
          </div>
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0 ml-1">
            <Icon className="size-3.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
