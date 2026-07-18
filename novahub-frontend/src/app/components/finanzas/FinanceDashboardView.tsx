import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  Info,
  Percent,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useCurrency } from '../../contexts/CurrencyContext';

interface FinanceDashboardViewProps {
  incomes: any[];
  expenses: any[];
  recurringExpenses: any[];
  recurringIncomes?: any[];
  accounts?: any[];
}

type MetricTone = 'positive' | 'negative' | 'neutral';

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone: MetricTone;
  trend: number | null;
  trendLabel: string;
  positiveIsGood?: boolean;
}

const metricToneStyles: Record<MetricTone, { icon: string; value: string; surface: string }> = {
  positive: {
    icon: 'bg-emerald-500/10 text-emerald-500',
    value: 'text-emerald-500',
    surface: 'hover:border-emerald-500/30',
  },
  negative: {
    icon: 'bg-rose-500/10 text-rose-500',
    value: 'text-rose-500',
    surface: 'hover:border-rose-500/30',
  },
  neutral: {
    icon: 'bg-primary/10 text-primary',
    value: 'text-foreground',
    surface: 'hover:border-primary/30',
  },
};

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
  trend,
  trendLabel,
  positiveIsGood = true,
}: MetricCardProps) {
  const styles = metricToneStyles[tone];
  const trendIsUp = trend !== null && trend > 0;
  const trendIsGood = trend === null || trend === 0
    ? null
    : positiveIsGood
      ? trend > 0
      : trend < 0;

  return (
    <Card
      className={`group border-border/60 bg-card/65 shadow-none transition-colors duration-200 ${styles.surface}`}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">{title}</p>
            <p className={`mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums ${styles.value}`}>
              {value}
            </p>
          </div>
          <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
            <Icon className="size-4.5" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-4 flex min-h-5 items-center justify-between gap-3 text-[11px]">
          <span className="truncate text-muted-foreground">{description}</span>
          {trend === null ? (
            <span className="shrink-0 text-muted-foreground">Sin comparación</span>
          ) : (
            <span
              className={`inline-flex shrink-0 items-center gap-1 font-semibold tabular-nums ${
                trendIsGood === null
                  ? 'text-muted-foreground'
                  : trendIsGood
                    ? 'text-emerald-500'
                    : 'text-rose-500'
              }`}
              aria-label={`${Math.abs(trend).toFixed(1)} por ciento ${trendIsUp ? 'más' : 'menos'} ${trendLabel}`}
            >
              {trendIsUp ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const percentChange = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : null;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Math.abs(change) > 500 ? null : change;
};

const humanizeCategory = (value: string) =>
  value
    .replace(/_/g, ' ')
    .toLocaleLowerCase('es-NI')
    .replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase('es-NI'));

export function FinanceDashboardView({
  incomes,
  expenses,
  recurringExpenses,
  recurringIncomes = [],
  accounts = [],
}: FinanceDashboardViewProps) {
  const { displayCurrency, convertAmount, formatConvertedAmount } = useCurrency();
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';

  const totalIncomes = incomes.reduce(
    (total, item) => total + convertAmount(item.amount || 0, item.currency, item.exchangeRate),
    0,
  );
  const totalExpenses = expenses.reduce(
    (total, item) => total + convertAmount(item.amount || 0, item.currency, item.exchangeRate),
    0,
  );
  const totalRecurringExpenses = recurringExpenses.reduce(
    (total, item) => total + convertAmount(item.amount || 0, item.currency, item.exchangeRate),
    0,
  );
  const totalRecurringIncomes = recurringIncomes.reduce(
    (total, item) => total + convertAmount(item.amount || 0, item.currency, item.exchangeRate),
    0,
  );

  const netUtility = totalIncomes - totalExpenses;
  const margin = totalIncomes > 0 ? (netUtility / totalIncomes) * 100 : 0;
  const expenseToIncomeRatio = totalIncomes > 0 ? (totalExpenses / totalIncomes) * 100 : 0;
  const netRecurringFlow = totalRecurringIncomes - totalRecurringExpenses;
  const recurringCoverage = totalRecurringExpenses > 0
    ? (totalRecurringIncomes / totalRecurringExpenses) * 100
    : totalRecurringIncomes > 0
      ? 100
      : 0;
  const activeAccounts = accounts.filter((account) => {
    const status = String(account.status || '').toUpperCase();
    return account.isActive !== false && status !== 'INACTIVE' && status !== 'CLOSED';
  }).length;

  const monthlyData = useMemo(() => {
    const now = new Date();
    const data: Array<{
      mes: string;
      monthIndex: number;
      year: number;
      ingresos: number;
      gastos: number;
      balance: number;
    }> = [];

    for (let offset = 5; offset >= 0; offset -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const monthIndex = monthDate.getMonth();
      const year = monthDate.getFullYear();

      const monthIncomes = incomes.reduce((total, item) => {
        const itemDate = new Date(item.date || item.createdAt);
        if (Number.isNaN(itemDate.getTime()) || itemDate.getMonth() !== monthIndex || itemDate.getFullYear() !== year) {
          return total;
        }
        return total + convertAmount(item.amount || 0, item.currency, item.exchangeRate);
      }, 0);

      const monthExpenses = expenses.reduce((total, item) => {
        const itemDate = new Date(item.date || item.createdAt);
        if (Number.isNaN(itemDate.getTime()) || itemDate.getMonth() !== monthIndex || itemDate.getFullYear() !== year) {
          return total;
        }
        return total + convertAmount(item.amount || 0, item.currency, item.exchangeRate);
      }, 0);

      data.push({
        mes: monthNames[monthIndex],
        monthIndex,
        year,
        ingresos: Math.round(monthIncomes),
        gastos: Math.round(monthExpenses),
        balance: Math.round(monthIncomes - monthExpenses),
      });
    }

    return data;
  }, [convertAmount, expenses, incomes]);

  const activeMonths = monthlyData.filter((month) => month.ingresos > 0 || month.gastos > 0);
  const comparableMonths = monthlyData
    .slice(0, -1)
    .filter((month) => month.ingresos > 0 || month.gastos > 0);
  const latestMonth = comparableMonths.at(-1);
  const previousMonth = comparableMonths.at(-2);

  const incomeTrend = latestMonth && previousMonth
    ? percentChange(latestMonth.ingresos, previousMonth.ingresos)
    : null;
  const expenseTrend = latestMonth && previousMonth
    ? percentChange(latestMonth.gastos, previousMonth.gastos)
    : null;
  const utilityTrend = latestMonth && previousMonth
    ? percentChange(latestMonth.balance, previousMonth.balance)
    : null;
  const comparisonLabel = previousMonth ? `vs. ${previousMonth.mes} (mes cerrado)` : 'vs. periodo anterior';

  const categoryData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    expenses.forEach((expense) => {
      const category = humanizeCategory(String(expense.category || 'Otros'));
      categoryTotals[category] = (categoryTotals[category] || 0)
        + convertAmount(expense.amount || 0, expense.currency, expense.exchangeRate);
    });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        share: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [convertAmount, expenses, totalExpenses]);

  const completedActiveMonths = monthlyData
    .slice(0, -1)
    .filter((month) => month.ingresos > 0 || month.gastos > 0);
  const baselineMonths = (completedActiveMonths.length > 0 ? completedActiveMonths : activeMonths).slice(-3);
  const averageHistoricalIncome = baselineMonths.length > 0
    ? baselineMonths.reduce((total, month) => total + month.ingresos, 0) / baselineMonths.length
    : 0;
  const averageHistoricalExpense = baselineMonths.length > 0
    ? baselineMonths.reduce((total, month) => total + month.gastos, 0) / baselineMonths.length
    : 0;
  const projectedIncome = Math.max(averageHistoricalIncome, totalRecurringIncomes);
  const projectedExpense = Math.max(averageHistoricalExpense, totalRecurringExpenses);
  const projectedNet = projectedIncome - projectedExpense;

  const projectionData = useMemo(() => {
    const now = new Date();
    const history = monthlyData.map((month) => ({
      mes: month.mes,
      ingresos: month.ingresos,
      gastos: month.gastos,
      forecastBalance: null as number | null,
      confidence: null as [number, number] | null,
    }));

    if (history.length > 0) {
      const lastHistoryPoint = history[history.length - 1];
      lastHistoryPoint.forecastBalance = monthlyData[monthlyData.length - 1].balance;
      lastHistoryPoint.confidence = [monthlyData[monthlyData.length - 1].balance, monthlyData[monthlyData.length - 1].balance];
    }

    const uncertainty = Math.max(Math.abs(projectedNet) * 0.2, (projectedIncome + projectedExpense) * 0.04);
    const forecast = Array.from({ length: 3 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
      return {
        mes: `${monthNames[monthDate.getMonth()]} est.`,
        ingresos: null,
        gastos: null,
        forecastBalance: Math.round(projectedNet),
        confidence: [Math.round(projectedNet - uncertainty), Math.round(projectedNet + uncertainty)] as [number, number],
      };
    });

    return [...history, ...forecast];
  }, [monthlyData, projectedExpense, projectedIncome, projectedNet]);

  const topCategory = categoryData[0];
  const signals = [
    margin < 0
      ? {
          tone: 'critical' as const,
          title: 'Resultado operativo negativo',
          description: 'Los gastos superan los ingresos registrados.',
        }
      : margin < 15
        ? {
            tone: 'warning' as const,
            title: 'Margen ajustado',
            description: `${margin.toFixed(1)}% de margen; conviene revisar los gastos de mayor peso.`,
          }
        : {
            tone: 'healthy' as const,
            title: 'Margen en rango saludable',
            description: `${margin.toFixed(1)}% de los ingresos queda como utilidad.`,
          },
    netRecurringFlow < 0
      ? {
          tone: 'warning' as const,
          title: 'Compromisos recurrentes sin cobertura',
          description: `Faltan ${formatConvertedAmount(Math.abs(netRecurringFlow), displayCurrency)} por ciclo.`,
        }
      : {
          tone: 'healthy' as const,
          title: 'Flujo recurrente cubierto',
          description: `Cobertura estimada de ${recurringCoverage.toFixed(0)}%.`,
        },
    topCategory && topCategory.share >= 40
      ? {
          tone: 'warning' as const,
          title: 'Gasto concentrado',
          description: `${topCategory.name} representa ${topCategory.share.toFixed(0)}% del gasto total.`,
        }
      : {
          tone: 'info' as const,
          title: 'Distribución de gasto estable',
          description: topCategory
            ? `La categoría principal concentra ${topCategory.share.toFixed(0)}%.`
            : 'Aún no hay gastos suficientes para analizar concentración.',
        },
    activeMonths.length < 3
      ? {
          tone: 'info' as const,
          title: 'Proyección con confianza limitada',
          description: 'Se necesitan al menos tres meses con actividad para una base más sólida.',
        }
      : {
          tone: 'healthy' as const,
          title: 'Base histórica disponible',
          description: `La estimación usa ${baselineMonths.length} meses recientes con actividad.`,
        },
  ];

  const fmtShort = (value: number) => {
    if (Math.abs(value) >= 1_000_000) return `${currencySymbol}${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${currencySymbol}${(value / 1_000).toFixed(1)}k`;
    return `${currencySymbol}${value.toLocaleString('es-NI', { maximumFractionDigits: 0 })}`;
  };

  const chartTooltipStyle = {
    backgroundColor: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    color: 'var(--popover-foreground)',
    boxShadow: '0 14px 34px rgba(0, 0, 0, 0.16)',
    fontSize: '12px',
  };

  return (
    <section className="space-y-5" aria-labelledby="finance-dashboard-title" data-testid="finance-dashboard">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="finance-dashboard-title" className="text-xl font-semibold tracking-tight">
            Resumen financiero
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Una lectura rápida del rendimiento actual, los compromisos y la tendencia de caja.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <span className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
            Tendencia: últimos 6 meses
          </span>
          {activeAccounts > 0 && (
            <span className="rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
              {activeAccounts} {activeAccounts === 1 ? 'cuenta activa' : 'cuentas activas'}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="finance-kpi-grid">
        <MetricCard
          title="Ingresos"
          value={formatConvertedAmount(totalIncomes, displayCurrency)}
          description={`${incomes.length} transacciones registradas`}
          icon={TrendingUp}
          tone="positive"
          trend={incomeTrend}
          trendLabel={comparisonLabel}
        />
        <MetricCard
          title="Gastos"
          value={formatConvertedAmount(totalExpenses, displayCurrency)}
          description={`${expenses.length} transacciones registradas`}
          icon={TrendingDown}
          tone="negative"
          trend={expenseTrend}
          trendLabel={comparisonLabel}
          positiveIsGood={false}
        />
        <MetricCard
          title="Utilidad neta"
          value={formatConvertedAmount(netUtility, displayCurrency)}
          description="Ingresos menos gastos"
          icon={Scale}
          tone={netUtility >= 0 ? 'positive' : 'negative'}
          trend={utilityTrend}
          trendLabel={comparisonLabel}
        />
        <MetricCard
          title="Margen"
          value={`${margin.toFixed(1)}%`}
          description={`${expenseToIncomeRatio.toFixed(1)}% se destina a gastos`}
          icon={Percent}
          tone="neutral"
          trend={null}
          trendLabel=""
        />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
        <Card className="min-w-0 border-border/60 bg-card/65 shadow-none" data-testid="cashflow-projection-chart">
          <CardHeader className="gap-3 pb-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <BarChart3 className="size-4 text-primary" aria-hidden="true" />
                Flujo real y proyección
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Historial mensual y estimación base para los próximos 3 meses.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-emerald-500" />Ingresos</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-rose-400" />Gastos</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-amber-500" />Proyección neta</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[330px] min-w-0 w-full pt-2">
              {activeMonths.length > 0 || totalRecurringExpenses > 0 || totalRecurringIncomes > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={projectionData} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" opacity={0.75} />
                    <XAxis
                      dataKey="mes"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontWeight: 500 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                      tickFormatter={fmtShort}
                      width={54}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      labelStyle={{ color: 'var(--popover-foreground)', fontWeight: 600 }}
                      formatter={(value: any, name: string) => {
                        if (Array.isArray(value)) {
                          return [`${fmtShort(Number(value[0]))} – ${fmtShort(Number(value[1]))}`, 'Rango estimado'];
                        }
                        const names: Record<string, string> = {
                          ingresos: 'Ingresos',
                          gastos: 'Gastos',
                          forecastBalance: 'Flujo neto estimado',
                        };
                        return [fmtShort(Number(value)), names[name] || name];
                      }}
                    />
                    <ReferenceLine
                      x={monthlyData.at(-1)?.mes}
                      stroke="var(--muted-foreground)"
                      strokeDasharray="3 4"
                      opacity={0.55}
                    />
                    <Area
                      type="monotone"
                      dataKey="confidence"
                      stroke="none"
                      fill="#f59e0b"
                      fillOpacity={0.12}
                      connectNulls
                    />
                    <Bar dataKey="ingresos" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="gastos" fill="#fb7185" radius={[5, 5, 0, 0]} maxBarSize={24} />
                    <Line
                      type="monotone"
                      dataKey="forecastBalance"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      strokeDasharray="6 5"
                      dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                  <div>
                    <BarChart3 className="mx-auto mb-3 size-9 opacity-35" />
                    <p className="text-sm font-medium text-foreground">Aún no hay una tendencia que proyectar</p>
                    <p className="mt-1 text-xs">Registra ingresos y gastos para construir el histórico.</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-1 border-t border-border/50 pt-3 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>Base: promedio de hasta 3 meses recientes + compromisos recurrentes.</span>
              <span className="font-medium tabular-nums text-foreground">
                Flujo mensual estimado: {formatConvertedAmount(projectedNet, displayCurrency)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/60 bg-card/65 shadow-none" data-testid="expense-category-chart">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingDown className="size-4 text-rose-500" aria-hidden="true" />
              Gastos por categoría
            </CardTitle>
            <p className="text-xs text-muted-foreground">Las cinco categorías con mayor peso.</p>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] min-w-0 w-full">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryData}
                    layout="vertical"
                    margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 5" opacity={0.65} />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                      tickFormatter={fmtShort}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      width={92}
                      tick={{ fill: 'var(--foreground)', fontSize: 10, fontWeight: 500 }}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      labelStyle={{ color: 'var(--popover-foreground)', fontWeight: 600 }}
                      formatter={(value: any) => [fmtShort(Number(value)), 'Gasto']}
                    />
                    <Bar dataKey="value" fill="var(--primary)" radius={[0, 6, 6, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                  <div>
                    <TrendingDown className="mx-auto mb-3 size-9 opacity-35" />
                    <p className="text-sm font-medium text-foreground">Sin gastos registrados</p>
                    <p className="mt-1 text-xs">Las categorías aparecerán aquí.</p>
                  </div>
                </div>
              )}
            </div>
            {topCategory && (
              <div className="rounded-xl bg-muted/35 px-3 py-2.5 text-xs">
                <span className="text-muted-foreground">Mayor concentración</span>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="truncate font-medium">{topCategory.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{topCategory.share.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/65 shadow-none" data-testid="recurring-summary">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="size-4 text-primary" aria-hidden="true" />
              Flujo recurrente
            </CardTitle>
            <p className="text-xs text-muted-foreground">Ingresos comprometidos frente a obligaciones periódicas.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Flujo neto por ciclo</p>
                <p className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums ${netRecurringFlow >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {formatConvertedAmount(netRecurringFlow, displayCurrency)}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-muted-foreground">Cobertura</p>
                <p className="mt-1 font-semibold tabular-nums">{recurringCoverage.toFixed(0)}%</p>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Cobertura de compromisos</span>
                <span className="tabular-nums">{Math.min(recurringCoverage, 100).toFixed(0)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${recurringCoverage >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.max(0, Math.min(recurringCoverage, 100))}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/50 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowUpRight className="size-3.5 text-emerald-500" /> Ingresos recurrentes
                </div>
                <p className="mt-2 font-semibold tabular-nums text-emerald-500">
                  {formatConvertedAmount(totalRecurringIncomes, displayCurrency)}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {recurringIncomes.length} {recurringIncomes.length === 1 ? 'compromiso' : 'compromisos'}
                </p>
              </div>
              <div className="rounded-xl border border-border/50 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowDownRight className="size-3.5 text-rose-500" /> Gastos recurrentes
                </div>
                <p className="mt-2 font-semibold tabular-nums text-rose-500">
                  {formatConvertedAmount(totalRecurringExpenses, displayCurrency)}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {recurringExpenses.length} {recurringExpenses.length === 1 ? 'compromiso' : 'compromisos'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/65 shadow-none" data-testid="financial-signals">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="size-4 text-primary" aria-hidden="true" />
              Señales financieras
            </CardTitle>
            <p className="text-xs text-muted-foreground">Lecturas que merecen atención según los datos actuales.</p>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {signals.map((signal, index) => {
              const Icon = signal.tone === 'healthy'
                ? CircleCheck
                : signal.tone === 'info'
                  ? Info
                  : CircleAlert;
              const styles = signal.tone === 'healthy'
                ? 'bg-emerald-500/8 text-emerald-500'
                : signal.tone === 'critical'
                  ? 'bg-rose-500/8 text-rose-500'
                  : signal.tone === 'warning'
                    ? 'bg-amber-500/8 text-amber-500'
                    : 'bg-primary/8 text-primary';

              return (
                <div key={`${signal.title}-${index}`} className="flex gap-3 rounded-xl border border-border/45 p-3">
                  <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${styles}`}>
                    <Icon className="size-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{signal.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{signal.description}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span>
          La proyección es una estimación orientativa basada en el histórico reciente y los registros recurrentes; no sustituye un presupuesto aprobado.
        </span>
      </div>
    </section>
  );
}
