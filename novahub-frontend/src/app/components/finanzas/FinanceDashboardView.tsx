import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { useAuth } from '../../contexts/AuthContext';
import { invoicesService } from '../../services/ventas.service';
import { supplierInvoicesService } from '../../services/compras.service';
import { accountsService } from '../../services/finanzas.service';
import { toast } from 'sonner';
import { FINANCE_AXIS_TICK, FINANCE_GRID, FINANCE_TOOLTIP_WRAPPER, FinanceTooltipCard } from './financeChartTheme';

interface Props {
  incomes: any[];
  expenses: any[];
  recurringExpenses: any[];
  recurringIncomes?: any[];
  accounts?: any[];
  onNavigate?: (tab: string) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

const toList = (response: any) => Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);

export function FinanceDashboardView({ incomes, expenses, recurringExpenses, recurringIncomes, accounts, onNavigate }: Props) {
  const { displayCurrency, valuationMode, valuationModeSuffix, formatCurrentAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const { user } = useAuth();
  const tenantKey = user?.clientTenantId || user?.tenantId || 'current';
  const sym = displayCurrency === 'USD' ? '$' : 'C$';

  const salesInvoicesQuery = useQuery({
    queryKey: ['finance', 'sales-invoices', tenantKey],
    queryFn: ({ signal }) => invoicesService.getAll({ page: 1, pageSize: 200 }, signal),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const supplierInvoicesQuery = useQuery({
    queryKey: ['finance', 'supplier-invoices', tenantKey],
    queryFn: ({ signal }) => supplierInvoicesService.getAll({ page: 1, pageSize: 200 }, signal),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const chartAccountsQuery = useQuery({
    queryKey: ['finance', 'accounts', tenantKey],
    queryFn: ({ signal }) => accountsService.getAll({ page: 1, pageSize: 500 }, signal),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const salesInvoices = toList(salesInvoicesQuery.data);
  const supplierInvoices = toList(supplierInvoicesQuery.data);
  const bankAccounts = toList(chartAccountsQuery.data).filter((a: any) =>
    ['CASH', 'BANK'].includes(String(a.subtype || '').toUpperCase()) ||
    String(a.name || '').toUpperCase().includes('CAJA') ||
    String(a.name || '').toUpperCase().includes('BANCO')
  );

  const cv = (item: any) => {
    const amount = Number(item.amount ?? item.baseAmount ?? 0);
    return valuationMode === 'CURRENT'
      ? convertCurrentAmount(amount, item.currency)
      : convertAmount(amount, item.currency, item.exchangeRate);
  };
  const docBalance = (item: any) => {
    const amount = Number(item.balance ?? item.balanceDue ?? (Number(item.total || 0) - Number(item.amountPaid || 0)));
    return valuationMode === 'CURRENT'
      ? convertCurrentAmount(amount, item.currency)
      : convertAmount(amount, item.currency, item.exchangeRate);
  };
  const totalIncome = useMemo(() => incomes.reduce((a, i) => a + cv(i), 0), [incomes, valuationMode, convertAmount, convertCurrentAmount]);
  const totalExpense = useMemo(() => expenses.reduce((a, e) => a + cv(e), 0), [expenses, valuationMode, convertAmount, convertCurrentAmount]);
  const netCashFlow = totalIncome - totalExpense;
  const marginPct = totalIncome > 0 ? ((netCashFlow / totalIncome) * 100) : 0;

  const pendingSalesInvoices = useMemo(() => salesInvoices.filter((inv: any) => { const s = String(inv.status || '').toUpperCase(); return s !== 'PAID' && s !== 'CANCELLED' && s !== 'CANCELED' }), [salesInvoices]);
  const pendingSupplierInvoices = useMemo(() => supplierInvoices.filter((inv: any) => { const s = String(inv.status || '').toUpperCase(); return s !== 'PAID' && s !== 'CANCELLED' && s !== 'CANCELED' }), [supplierInvoices]);
  const totalCxc = useMemo(() => pendingSalesInvoices.reduce((a, inv: any) => a + docBalance(inv), 0), [pendingSalesInvoices, valuationMode, convertAmount, convertCurrentAmount]);
  const totalCxp = useMemo(() => pendingSupplierInvoices.reduce((a, inv: any) => a + docBalance(inv), 0), [pendingSupplierInvoices, valuationMode, convertAmount, convertCurrentAmount]);
  const cxcOverdue = useMemo(() => pendingSalesInvoices.filter((inv: any) => {
    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    return due && due < new Date() && docBalance(inv) > 0;
  }).reduce((a, inv: any) => a + docBalance(inv), 0), [pendingSalesInvoices, valuationMode, convertAmount, convertCurrentAmount]);
  const cxpOverdue = useMemo(() => pendingSupplierInvoices.filter((inv: any) => {
    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    return due && due < new Date() && docBalance(inv) > 0;
  }).reduce((a, inv: any) => a + docBalance(inv), 0), [pendingSupplierInvoices, valuationMode, convertAmount, convertCurrentAmount]);
  const bankBalance = useMemo(() => bankAccounts.reduce((a, acc: any) => a + (valuationMode === 'CURRENT'
    ? convertCurrentAmount(Number(acc.balance || 0), acc.currency)
    : convertAmount(Number(acc.balance || 0), acc.currency, acc.exchangeRate)), 0), [bankAccounts, valuationMode, convertAmount, convertCurrentAmount]);

  const activeRecurringExpenses = useMemo(() => recurringExpenses.filter((r: any) => r.status === 'ACTIVE' && Number(r.amount) > 0), [recurringExpenses]);
  const activeRecurringIncomes = useMemo(() => (recurringIncomes || []).filter((r: any) => r.status === 'ACTIVE' && Number(r.amount) > 0), [recurringIncomes]);
  const monthlyRecurring = useMemo(() =>
    activeRecurringExpenses.reduce((a, r) => a + cv(r), 0),
    [activeRecurringExpenses, valuationMode, convertAmount, convertCurrentAmount]
  );
  const monthlyRecurringIncome = useMemo(() =>
    activeRecurringIncomes.reduce((a, r) => a + cv(r), 0),
    [activeRecurringIncomes, valuationMode, convertAmount, convertCurrentAmount]
  );
  const next7d = monthlyRecurring * (7 / 30);
  const next15d = monthlyRecurring * (15 / 30);
  const next30d = monthlyRecurring;
  const projected30 = netCashFlow + monthlyRecurringIncome - monthlyRecurring;
  const projected60 = projected30 + monthlyRecurringIncome - monthlyRecurring;
  const projected90 = projected60 + monthlyRecurringIncome - monthlyRecurring;

  const monthlyData = useMemo(() => {
    const months: Record<string, { income: number; expense: number; net: number }> = {};
    for (const i of incomes) { const m = i.date ? i.date.substring(0, 7) : 'unknown'; months[m] = months[m] || { income: 0, expense: 0, net: 0 }; months[m].income += cv(i); }
    for (const e of expenses) { const m = e.date ? e.date.substring(0, 7) : 'unknown'; months[m] = months[m] || { income: 0, expense: 0, net: 0 }; months[m].expense += cv(e); }
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({ month, ...d, net: d.income - d.expense }));
  }, [incomes, expenses, valuationMode, convertAmount, convertCurrentAmount]);

  const agingData = useMemo(() => {
    const ranges = [{ label: '0-30 días', min: 0, max: 30 }, { label: '31-60 días', min: 31, max: 60 }, { label: '61-90 días', min: 61, max: 90 }, { label: '+90 días', min: 91, max: Infinity }];
    return ranges.map(r => {
      const cxcAmt = pendingSalesInvoices.filter((inv: any) => { const due = inv.dueDate ? new Date(inv.dueDate) : null; if (!due) return false; const days = Math.floor((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24)); return days >= r.min && days <= r.max && docBalance(inv) > 0; }).reduce((a: number, inv: any) => a + docBalance(inv), 0);
      const cxpAmt = pendingSupplierInvoices.filter((inv: any) => { const due = inv.dueDate ? new Date(inv.dueDate) : null; if (!due) return false; const days = Math.floor((new Date().getTime() - due.getTime()) / (1000 * 60 * 60 * 24)); return days >= r.min && days <= r.max && docBalance(inv) > 0; }).reduce((a: number, inv: any) => a + docBalance(inv), 0);
      return { label: r.label, cxc: cxcAmt, cxp: cxpAmt };
    });
  }, [pendingSalesInvoices, pendingSupplierInvoices, valuationMode, convertAmount, convertCurrentAmount]);

  const projectData = useMemo(() => {
    const last = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1] : null;
    const base = last ? last.net + monthlyRecurringIncome - monthlyRecurring : 0;
    return [{ label: 'Actual', amount: base }, { label: '30d', amount: projected30 }, { label: '60d', amount: projected60 }, { label: '90d', amount: projected90 }];
  }, [monthlyData, projected30, projected60, projected90, monthlyRecurringIncome, monthlyRecurring]);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const e of expenses) { const cat = e.category || 'OTROS'; cats[cat] = (cats[cat] || 0) + cv(e); }
    return Object.entries(cats).sort(([, a], [, b]) => b - a).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [expenses, valuationMode, convertAmount, convertCurrentAmount]);

  const fmt = (n: number) => formatCurrentAmount(n, displayCurrency);
  const fmtShort = (n: number) => {
    const displayed = n;
    if (Math.abs(displayed) >= 1_000_000) return sym + (displayed / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(displayed) >= 1_000) return sym + (displayed / 1_000).toFixed(1) + 'K';
    return sym + displayed.toLocaleString(undefined, { minimumFractionDigits: 0 });
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={Landmark} label={`Saldo Disponible${valuationModeSuffix}`} value={fmt(bankBalance)} onClick={() => onNavigate?.('caja-bancos')} />
        <KpiCard icon={TrendingUp} label={`Ingresos Cobrados${valuationModeSuffix}`} value={fmt(totalIncome)} onClick={() => onNavigate?.('ingresos')} />
        <KpiCard icon={TrendingDown} label={`Pagos Realizados${valuationModeSuffix}`} value={fmt(totalExpense)} onClick={() => onNavigate?.('gastos')} />
        <KpiCard icon={DollarSign} label={`Flujo Neto${valuationModeSuffix}`} value={fmt(netCashFlow)} />
        <KpiCard icon={BarChart3} label={`Total por Cobrar${valuationModeSuffix}`} value={fmt(totalCxc)} sub={`${cxcOverdue > 0 ? fmt(cxcOverdue) + ' vencido' : 'Sin vencidos'}`} onClick={() => onNavigate?.('cuentas-cobrar')} />
        <KpiCard icon={BarChart3} label={`Total por Pagar${valuationModeSuffix}`} value={fmt(totalCxp)} sub={`${cxpOverdue > 0 ? fmt(cxpOverdue) + ' vencido' : 'Sin vencidos'}`} onClick={() => onNavigate?.('cuentas-pagar')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Cobros vs Pagos por Mes</CardTitle>
            <p className="text-[10px] text-muted-foreground">Barras: ingresos (verde) y gastos (rojo). Línea naranja: resultado neto.</p>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible px-2 pb-3">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={monthlyData} margin={{ top: 12, right: 20, left: 8, bottom: 14 }}>
                <defs>
                  <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.9} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.6} /></linearGradient>
                  <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0.6} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={FINANCE_GRID} opacity={0.45} vertical={false} />
                <XAxis dataKey="month" tick={FINANCE_AXIS_TICK} tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tick={FINANCE_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtShort(v)} width={64} />
                <Tooltip content={<FinanceTooltipCard formatter={fmt} />} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Legend verticalAlign="bottom" height={28} formatter={(value: string) => <span style={{ color: 'var(--foreground)', fontWeight: 600, fontSize: 11 }}>{value}</span>} />
                <Bar dataKey="income" name="Ingresos" fill="url(#incG)" radius={[5, 5, 0, 0]} maxBarSize={36} onClick={(data: any) => toast.info(`Ingresos ${data.month}: ${fmt(data.income)}`)} style={{ cursor: 'pointer' }} />
                <Bar dataKey="expense" name="Gastos" fill="url(#expG)" radius={[5, 5, 0, 0]} maxBarSize={36} onClick={(data: any) => toast.info(`Gastos ${data.month}: ${fmt(data.expense)}`)} style={{ cursor: 'pointer' }} />
                <Line dataKey="net" name="Resultado Neto" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Flujo de Caja Proyectado</CardTitle>
            <p className="text-[10px] text-muted-foreground">Proyección a 30, 60 y 90 días según recurrentes</p>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible px-2 pb-3">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={projectData} margin={{ top: 12, right: 20, left: 8, bottom: 14 }}>
                <defs>
                  <linearGradient id="projG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} /><stop offset="100%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={FINANCE_GRID} opacity={0.45} vertical={false} />
                <XAxis dataKey="label" tick={FINANCE_AXIS_TICK} tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tick={FINANCE_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtShort(v)} width={64} />
                <Tooltip content={<FinanceTooltipCard formatter={fmt} />} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} cursor={{ stroke: '#06b6d4', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area dataKey="amount" fill="url(#projG)" stroke="#06b6d4" strokeWidth={2.5} type="monotone" dot={{ r: 4, fill: '#06b6d4', strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="min-w-0 lg:col-span-2 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">CxC y CxP por Vencimiento</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible px-2 pb-3">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={agingData} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 14 }}>
                <CartesianGrid strokeDasharray="4 4" stroke={FINANCE_GRID} opacity={0.45} horizontal={false} />
                <XAxis type="number" tick={FINANCE_AXIS_TICK} tickFormatter={(v: number) => fmtShort(v)} tickMargin={8} />
                <YAxis dataKey="label" type="category" tick={{ ...FINANCE_AXIS_TICK, fill: 'var(--foreground)', fontWeight: 600 }} width={96} />
                <Tooltip content={<FinanceTooltipCard formatter={fmt} />} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Legend verticalAlign="bottom" height={28} formatter={(value: string) => <span style={{ color: 'var(--foreground)', fontWeight: 600, fontSize: 11 }}>{value}</span>} />
                <Bar dataKey="cxc" name="Por Cobrar" fill="#10b981" radius={[0, 5, 5, 0]} maxBarSize={32} onClick={(data: any) => toast.info(`CxC ${data.label}: ${fmt(data.cxc)}`)} style={{ cursor: 'pointer' }} />
                <Bar dataKey="cxp" name="Por Pagar" fill="#ef4444" radius={[0, 5, 5, 0]} maxBarSize={32} onClick={(data: any) => toast.info(`CxP ${data.label}: ${fmt(data.cxp)}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Gastos por Categoría</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible px-2 pb-3">
            {categoryData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-12 text-center">Sin datos de gastos</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 14 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke={FINANCE_GRID} opacity={0.45} horizontal={false} />
                  <XAxis type="number" tick={FINANCE_AXIS_TICK} tickFormatter={(v: number) => fmtShort(v)} tickMargin={8} />
                  <YAxis dataKey="name" type="category" tick={{ ...FINANCE_AXIS_TICK, fill: 'var(--foreground)', fontWeight: 500 }} width={96} />
                  <Tooltip content={<FinanceTooltipCard formatter={fmt} />} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
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
              <>
              {incomes.slice(0, 5).map((inc: any) => (
                <div key={inc.id} className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0 group hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><ArrowUpRight className="size-3.5 text-emerald-500" /></div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{inc.description || inc.source || 'Ingreso'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{inc.category} · {inc.date ? new Date(inc.date).toLocaleDateString('es-NI') : ''}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-500 shrink-0 ml-2">{fmt(cv(inc))}</span>
                </div>
              ))}
              {incomes.length > 5 && (
                <button onClick={() => onNavigate?.('ingresos')} className="w-full mt-2 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
                  Ver todos ({incomes.length}) →
                </button>
              )}
              </>
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
              <>
              {expenses.slice(0, 5).map((exp: any) => (
                <div key={exp.id} className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0 group hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-7 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0"><ArrowDownRight className="size-3.5 text-rose-500" /></div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{exp.description || exp.source || 'Gasto'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{exp.category} · {exp.date ? new Date(exp.date).toLocaleDateString('es-NI') : ''}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-rose-500 shrink-0 ml-2">{fmt(cv(exp))}</span>
                </div>
              ))}
              {expenses.length > 5 && (
                <button onClick={() => onNavigate?.('gastos')} className="w-full mt-2 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
                  Ver todos ({expenses.length}) →
                </button>
              )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, onClick }: { icon: any; label: string; value: string; sub?: string; onClick?: () => void }) {
  return (
    <Card className={`rounded-xl border-border/40 bg-card shadow-sm ${onClick ? 'cursor-pointer hover:border-primary/40 hover:shadow-md transition-all' : ''}`} onClick={onClick}>
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
