import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownRight,
  CalendarClock, Activity, Percent, PieChart as PieChartIcon, Scale
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, Cell, PieChart, Pie, LabelList, AreaChart, Area
} from 'recharts';
import { useCurrency } from '../../contexts/CurrencyContext';

interface FinanceDashboardViewProps {
  incomes: any[];
  expenses: any[];
  recurringExpenses: any[];
  recurringIncomes?: any[];
  accounts?: any[];
}

export function FinanceDashboardView({ incomes, expenses, recurringExpenses, recurringIncomes = [], accounts = [] }: FinanceDashboardViewProps) {
  const { displayCurrency, convertAmount, formatConvertedAmount } = useCurrency();
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';

  // ─── Core Calculations ────────────────────────
  const totalIncomes = incomes.reduce(
    (acc, i) => acc + convertAmount(i.amount || 0, i.currency, i.exchangeRate), 0
  );
  const totalExpenses = expenses.reduce(
    (acc, e) => acc + convertAmount(e.amount || 0, e.currency, e.exchangeRate), 0
  );
  const totalRecurring = recurringExpenses.reduce(
    (acc, r) => acc + convertAmount(r.amount || 0, r.currency, r.exchangeRate), 0
  );
  const netUtility = totalIncomes - totalExpenses;
  const margin = totalIncomes > 0 ? ((netUtility / totalIncomes) * 100) : 0;
  const avgIncome = incomes.length > 0 ? totalIncomes / incomes.length : 0;
  const avgExpense = expenses.length > 0 ? totalExpenses / expenses.length : 0;
  const savingsRatio = totalIncomes > 0 ? ((netUtility / totalIncomes) * 100) : 0;

  // New metrics
  const totalRecurringIncomes = recurringIncomes.reduce(
    (acc, r) => acc + convertAmount(r.amount || 0, r.currency, r.exchangeRate), 0
  );
  const netRecurringFlow = totalRecurringIncomes - totalRecurring;
  const expenseToIncomeRatio = totalIncomes > 0 ? ((totalExpenses / totalIncomes) * 100) : 0;

  // Accounts summary
  const accountsByType = accounts.reduce((acc: Record<string, { count: number; total: number }>, a: any) => {
    const type = String(a.type || 'OTHER').toUpperCase();
    if (!acc[type]) acc[type] = { count: 0, total: 0 };
    acc[type].count++;
    acc[type].total += Number(a.balance || 0);
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  // ─── Expense by Category (Pie Chart) ──────────
  const pieData = useMemo(() => {
    const cats: Record<string, number> = {};
    expenses.forEach(curr => {
      const cat = curr.category || 'Otros';
      cats[cat] = (cats[cat] || 0) + convertAmount(curr.amount || 0, curr.currency, curr.exchangeRate);
    });
    const result = Object.entries(cats).map(([name, value]) => ({ name, value: Math.round(value) }));
    return result.length > 0 ? result.sort((a, b) => b.value - a.value) : [{ name: 'Sin gastos', value: 1 }];
  }, [expenses]);

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  // ─── Monthly Data (Last 6 months) ─────────────
  const monthlyData = useMemo(() => {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const monthIdx = (currentMonth - i + 12) % 12;
      const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
      const monthIncomes = incomes.filter(inc => {
        const d = new Date(inc.date || inc.createdAt);
        return d.getMonth() === monthIdx && d.getFullYear() === year;
      });
      const monthExpenses = expenses.filter(exp => {
        const d = new Date(exp.date || exp.createdAt);
        return d.getMonth() === monthIdx && d.getFullYear() === year;
      });
      
      const inc = monthIncomes.reduce((acc: number, i: any) => acc + convertAmount(i.amount || 0, i.currency, i.exchangeRate), 0);
      const exp = monthExpenses.reduce((acc: number, e: any) => acc + convertAmount(e.amount || 0, e.currency, e.exchangeRate), 0);
      
      data.push({
        mes: monthNames[monthIdx],
        ingresos: Math.round(inc),
        gastos: Math.round(exp),
        balance: Math.round(inc - exp),
      });
    }
    return data;
  }, [incomes, expenses]);

  // ─── Top items ────────────────────────────────
  const topIncomes = useMemo(() => 
    [...incomes]
      .sort((a, b) => convertAmount(b.amount || 0, b.currency, b.exchangeRate) - convertAmount(a.amount || 0, a.currency, a.exchangeRate))
      .slice(0, 5),
    [incomes]
  );
  const topExpenses = useMemo(() => 
    [...expenses]
      .sort((a, b) => convertAmount(b.amount || 0, b.currency, b.exchangeRate) - convertAmount(a.amount || 0, a.currency, a.exchangeRate))
      .slice(0, 5),
    [expenses]
  );

  // ─── Balance trend for sparkline ──────────────
  const balanceTrend = useMemo(() => {
    let cumulative = 0;
    return monthlyData.map(d => {
      cumulative += d.balance;
      return { mes: d.mes, balance: cumulative };
    });
  }, [monthlyData]);

  const fmtShort = (v: number) => {
    if (Math.abs(v) >= 1000000) return `${currencySymbol}${(v/1000000).toFixed(1)}M`;
    if (Math.abs(v) >= 1000) return `${currencySymbol}${(v/1000).toFixed(1)}k`;
    return `${currencySymbol}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-black tracking-tight uppercase">Panel de Control Financiero</h2>
        <p className="text-sm text-muted-foreground">
          {incomes.length} ingresos · {expenses.length} gastos · {recurringExpenses.length} recurrentes
        </p>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Total Ingresos */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg hover:shadow-emerald-500/5 transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-emerald-500" /> Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(totalIncomes, displayCurrency)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{incomes.length} transacciones</p>
          </CardContent>
        </Card>

        {/* Total Gastos */}
        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent relative overflow-hidden group hover:shadow-lg hover:shadow-rose-500/5 transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingDown className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ArrowDownRight className="size-3.5 text-rose-500" /> Gastos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-rose-500">{formatConvertedAmount(totalExpenses, displayCurrency)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{expenses.length} transacciones</p>
          </CardContent>
        </Card>

        {/* Utilidad Neta */}
        <Card className={`border-${netUtility >= 0 ? 'emerald' : 'orange'}-500/20 bg-gradient-to-br from-${netUtility >= 0 ? 'emerald' : 'orange'}-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all`}>
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="size-3.5" /> Utilidad Neta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-black ${netUtility >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
              {formatConvertedAmount(netUtility, displayCurrency)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Ingresos - Gastos</p>
          </CardContent>
        </Card>

        {/* Margen */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg hover:shadow-blue-500/5 transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Percent className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Percent className="size-3.5 text-blue-500" /> Margen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{margin.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{margin >= 20 ? 'Saludable' : margin >= 0 ? 'Bajo' : 'Negativo'}</p>
          </CardContent>
        </Card>

        {/* Gastos Recurrentes */}
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent relative overflow-hidden group hover:shadow-lg hover:shadow-purple-500/5 transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><CalendarClock className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="size-3.5 text-purple-500" /> Recurrentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-purple-500">{formatConvertedAmount(totalRecurring, displayCurrency)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{recurringExpenses.length} compromisos</p>
          </CardContent>
        </Card>

        {/* Ratio Ahorro */}
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent relative overflow-hidden group hover:shadow-lg hover:shadow-amber-500/5 transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Wallet className="size-3.5 text-amber-500" /> Ratio Ahorro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-amber-500">{savingsRatio.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Prom. Ing: {fmtShort(avgIncome)} · Gto: {fmtShort(avgExpense)}
            </p>
          </CardContent>
        </Card>

        {/* Ingresos Recurrentes */}
        <Card className="border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent relative overflow-hidden group hover:shadow-lg hover:shadow-teal-500/5 transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-teal-500" /> Ing. Recurrentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-teal-500">{formatConvertedAmount(totalRecurringIncomes, displayCurrency)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{recurringIncomes.length} compromisos</p>
          </CardContent>
        </Card>

        {/* Flujo Recurrente Neto */}
        <Card className={`border-${netRecurringFlow >= 0 ? 'sky' : 'orange'}-500/20 bg-gradient-to-br from-${netRecurringFlow >= 0 ? 'sky' : 'orange'}-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all`}>
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Activity className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="size-3.5" /> Flujo Rec. Neto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-black ${netRecurringFlow >= 0 ? 'text-sky-500' : 'text-orange-500'}`}>{formatConvertedAmount(netRecurringFlow, displayCurrency)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Ing. rec. - Gtos. rec.</p>
          </CardContent>
        </Card>

        {/* Ratio Gastos/Ingresos */}
        <Card className="border-pink-500/20 bg-gradient-to-br from-pink-500/5 to-transparent relative overflow-hidden group hover:shadow-lg hover:shadow-pink-500/5 transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Percent className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Percent className="size-3.5 text-pink-500" /> Ratio Gto/Ing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-pink-500">{expenseToIncomeRatio.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{expenseToIncomeRatio <= 70 ? 'Óptimo' : expenseToIncomeRatio <= 90 ? 'Ajustado' : 'Crítico'}</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts Row ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bar Chart - Ingresos vs Gastos */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Ingresos vs Gastos (Últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full pt-2">
              {monthlyData.some(d => d.ingresos > 0 || d.gastos > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.3} />
                    <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 600 }} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }} 
                      tickFormatter={(v) => fmtShort(v)} 
                      width={40}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,0,0,0.02)', radius: 8 }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white/95 backdrop-blur-md border border-border/50 p-4 rounded-2xl shadow-2xl shadow-primary/10 animate-in zoom-in-95 duration-200">
                              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 border-b pb-2">{label}</p>
                              <div className="space-y-2">
                                {payload.map((entry: any, index: number) => (
                                  <div key={index} className="flex items-center justify-between gap-8">
                                    <div className="flex items-center gap-2">
                                      <div className="size-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                                      <span className="text-xs font-bold text-muted-foreground">{entry.name}:</span>
                                    </div>
                                    <span className="text-xs font-black" style={{ color: entry.fill }}>
                                      {formatConvertedAmount(entry.value, displayCurrency)}
                                    </span>
                                  </div>
                                ))}
                                <div className="pt-2 mt-2 border-t flex items-center justify-between gap-8">
                                  <span className="text-xs font-black text-foreground uppercase tracking-tighter">Balance:</span>
                                  <span className={cn("text-xs font-black", (payload[0].value - payload[1].value) >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                    {formatConvertedAmount(payload[0].value - payload[1].value, displayCurrency)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle" 
                      iconSize={8}
                      wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }} 
                    />
                    <Bar dataKey="ingresos" name="Ingresos" fill="url(#ingresosGrad)" radius={[4, 4, 0, 0]} barSize={32} />
                    <Bar dataKey="gastos" name="Gastos" fill="url(#gastosGrad)" radius={[4, 4, 0, 0]} barSize={32} />
                    <defs>
                      <linearGradient id="ingresosGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="gastosGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="size-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">Sin datos suficientes</p>
                    <p className="text-xs">Agrega ingresos y gastos para ver el análisis</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Distribución de Gastos */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <PieChartIcon className="size-4 text-primary" /> Distribución de Gastos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              {expenses.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      formatter={(value: number) => [`${currencySymbol}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <TrendingDown className="size-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">Sin gastos registrados</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Balance Trend + Composición ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Balance Trend Sparkline */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Evolución del Balance Acumulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              {balanceTrend.some(d => d.balance !== 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={balanceTrend}>
                    <defs>
                      <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.3} />
                    <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => fmtShort(v)} />
                    <Tooltip 
                      contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(v: number) => [`${currencySymbol}${v.toLocaleString()}`, 'Balance']}
                    />
                    <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2.5} fill="url(#balanceGrad)" dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Composición del Flujo */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Scale className="size-4 text-primary" /> Composición del Flujo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Progress bar */}
            <div>
              <div className="w-full bg-muted h-5 rounded-full overflow-hidden flex">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all flex items-center justify-center" 
                  style={{width: `${totalIncomes + totalExpenses > 0 ? (totalIncomes / (totalIncomes + totalExpenses)) * 100 : 50}%`}}>
                  <span className="text-[9px] font-black text-white drop-shadow-sm">
                    {totalIncomes + totalExpenses > 0 ? ((totalIncomes / (totalIncomes + totalExpenses)) * 100).toFixed(0) : 50}%
                  </span>
                </div>
                <div className="h-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all flex items-center justify-center" 
                  style={{width: `${totalIncomes + totalExpenses > 0 ? (totalExpenses / (totalIncomes + totalExpenses)) * 100 : 50}%`}}>
                  <span className="text-[9px] font-black text-white drop-shadow-sm">
                    {totalIncomes + totalExpenses > 0 ? ((totalExpenses / (totalIncomes + totalExpenses)) * 100).toFixed(0) : 50}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-black uppercase">
                <span className="text-emerald-500 flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500 inline-block" /> Ingresos</span>
                <span className="text-rose-500 flex items-center gap-1"><span className="size-2 rounded-full bg-rose-500 inline-block" /> Gastos</span>
              </div>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Prom. Ingreso</p>
                <p className="text-lg font-black text-emerald-500">{formatConvertedAmount(avgIncome, displayCurrency)}</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Prom. Gasto</p>
                <p className="text-lg font-black text-rose-500">{formatConvertedAmount(avgExpense, displayCurrency)}</p>
              </div>
            </div>

            {/* Recurring breakdown */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <CalendarClock className="size-4 text-purple-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold">Gastos Recurrentes</p>
                <p className="text-[10px] text-muted-foreground">{recurringExpenses.length} compromisos activos · {formatConvertedAmount(totalRecurring, displayCurrency)}/ciclo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Top Items ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Ingresos */}
        <Card className="border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <ArrowUpRight className="size-4 text-emerald-500" /> Top 5 Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topIncomes.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4 text-center">Sin ingresos</p>
            ) : topIncomes.map((inc: any, idx: number) => (
              <div key={inc.id || idx} className="flex items-start justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors group">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="size-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-[10px] font-black text-emerald-600 shrink-0 mt-0.5">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold break-words">{inc.source || inc.notes || 'Ingreso'}</p>
                    <p className="text-[10px] text-muted-foreground break-words">{inc.category || 'Sin cat.'} · {new Date(inc.date || inc.createdAt).toLocaleDateString('es-NI')}</p>
                  </div>
                </div>
                <span className="text-sm font-black text-emerald-500 shrink-0 ml-3 mt-0.5">+{formatConvertedAmount(inc.amount || 0, inc.currency, inc.exchangeRate)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Gastos */}
        <Card className="border-rose-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <ArrowDownRight className="size-4 text-rose-500" /> Top 5 Gastos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4 text-center">Sin gastos</p>
            ) : topExpenses.map((exp: any, idx: number) => (
              <div key={exp.id || idx} className="flex items-start justify-between p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 transition-colors group">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="size-7 rounded-lg bg-rose-500/20 flex items-center justify-center text-[10px] font-black text-rose-600 shrink-0 mt-0.5">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold break-words">{exp.description || 'Gasto'}</p>
                    <p className="text-[10px] text-muted-foreground break-words">{exp.source ? `${exp.source} · ` : ''}{exp.category || 'Sin cat.'} · {new Date(exp.date || exp.createdAt).toLocaleDateString('es-NI')}</p>
                  </div>
                </div>
                <span className="text-sm font-black text-rose-500 shrink-0 ml-3 mt-0.5">-{formatConvertedAmount(exp.amount || 0, exp.currency, exp.exchangeRate)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Monthly Details Table ═══ */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" /> Detalle Mensual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Mes</th>
                  <th className="text-right py-2 px-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Ingresos</th>
                  <th className="text-right py-2 px-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Gastos</th>
                  <th className="text-right py-2 px-3 text-[10px] font-black text-muted-foreground uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row, i) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold">{row.mes}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-500 font-bold">{row.ingresos > 0 ? fmtShort(row.ingresos) : '-'}</td>
                    <td className="py-2.5 px-3 text-right text-rose-500 font-bold">{row.gastos > 0 ? fmtShort(row.gastos) : '-'}</td>
                    <td className={`py-2.5 px-3 text-right font-black ${row.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {fmtShort(row.balance)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-primary/30 bg-muted/20">
                  <td className="py-2.5 px-3 font-black uppercase text-xs">Total</td>
                  <td className="py-2.5 px-3 text-right text-emerald-500 font-black">
                    {fmtShort(monthlyData.reduce((a, r) => a + r.ingresos, 0))}
                  </td>
                  <td className="py-2.5 px-3 text-right text-rose-500 font-black">
                    {fmtShort(monthlyData.reduce((a, r) => a + r.gastos, 0))}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-black ${monthlyData.reduce((a, r) => a + r.balance, 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {fmtShort(monthlyData.reduce((a, r) => a + r.balance, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
