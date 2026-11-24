import { useEffect, useMemo, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, DollarSign, Landmark, BarChart3, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, ComposedChart, Line, Legend, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { sourceDocumentsService, accountsService } from '../../services/finanzas.service';
import { toast } from '@/app/services/toast';
import { FINANCE_AXIS_TICK, FINANCE_GRID, FINANCE_TOOLTIP_WRAPPER, FinanceTooltipCard, financeCategoryLabel } from './financeChartTheme';
import { normalizeCurrency, summarizeAmountsByCurrency, type SupportedCurrency } from '../../utils/currency';
import { SalesKpiCard } from '../ventas/SalesKpiCard';
import { financeSourceDocumentQueryKeys } from '../../utils/financeSourceDocumentQueryKeys';

interface Props {
  incomes: any[];
  expenses: any[];
  undatedExpenses?: any[];
  recentIncomes?: any[];
  recentExpenses?: any[];
  recurringForecastRows?: any[];
  operationalSummaryAvailable?: boolean;
  historicalFilterActive?: boolean;
  onNavigate?: (tab: string) => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

const toList = (response: any) => Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);

export function FinanceDashboardView({ incomes, expenses, undatedExpenses = [], recentIncomes = [], recentExpenses = [], recurringForecastRows = [], operationalSummaryAvailable = false, historicalFilterActive = false, onNavigate }: Props) {
  const indicatorsStartedAt = useRef<number | null>(typeof performance === 'undefined' ? null : performance.now());
  const indicatorsSpan = useRef<ReturnType<typeof Sentry.startInactiveSpan> | null>(Sentry.startInactiveSpan({ op: 'ui.load', name: 'Finance dashboard indicators ready' }));
  const indicatorsMeasured = useRef(false);
  const { displayCurrency, displayMode, valuationMode, valuationModeSuffix, formatCurrentAmount, formatExplicitAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const canReadSales = canPerform('SALES', 'view');
  const canReadPurchases = canPerform('PURCHASES', 'view')
    || canPerform('FINANCIAL_DASHBOARD', 'view')
    || canPerform('FINANCIAL', 'view');
  const canReadFinancial = canPerform('FINANCIAL', 'view');
  const tenantKey = user?.clientTenantId || user?.tenantId || 'current';
  const sym = displayCurrency === 'USD' ? '$' : 'C$';

  const salesInvoicesQuery = useQuery({
    queryKey: financeSourceDocumentQueryKeys.summary('SALES', tenantKey),
    queryFn: ({ signal }) => sourceDocumentsService.getDashboardSummary('SALES', signal),
    enabled: canReadSales,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const supplierInvoicesQuery = useQuery({
    queryKey: financeSourceDocumentQueryKeys.summary('PURCHASES', tenantKey),
    queryFn: ({ signal }) => sourceDocumentsService.getDashboardSummary('PURCHASES', signal),
    enabled: canReadPurchases,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const salesProjectionQuery = useQuery({
    queryKey: financeSourceDocumentQueryKeys.projection('SALES', tenantKey),
    queryFn: ({ signal }) => sourceDocumentsService.getProjectionSummary('SALES', signal),
    enabled: canReadSales,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const supplierProjectionQuery = useQuery({
    queryKey: financeSourceDocumentQueryKeys.projection('PURCHASES', tenantKey),
    queryFn: ({ signal }) => sourceDocumentsService.getProjectionSummary('PURCHASES', signal),
    enabled: canReadPurchases,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const chartAccountsQuery = useQuery({
    queryKey: ['finance', 'cash-bank-summary', tenantKey],
    queryFn: ({ signal }) => accountsService.getCashBankSummary(signal),
    enabled: canReadFinancial,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const salesInvoices = toList(salesInvoicesQuery.data);
  const supplierInvoices = toList(supplierInvoicesQuery.data);
  const salesProjectionRows = toList(salesProjectionQuery.data);
  const supplierProjectionRows = toList(supplierProjectionQuery.data);
  const bankAccounts = toList(chartAccountsQuery.data);
  const indicatorsQueries = [
    { query: salesInvoicesQuery, enabled: canReadSales },
    { query: supplierInvoicesQuery, enabled: canReadPurchases },
    { query: chartAccountsQuery, enabled: canReadFinancial },
    { query: salesProjectionQuery, enabled: canReadSales },
    { query: supplierProjectionQuery, enabled: canReadPurchases },
  ];
  const indicatorsReady = indicatorsQueries.every(({ query, enabled }) => !enabled || query.isSuccess || query.isError);
  useEffect(() => {
    if (!indicatorsReady || indicatorsMeasured.current) return;
    indicatorsMeasured.current = true;
    const failed = indicatorsQueries.some(({ query, enabled }) => enabled && query.isError);
    if (indicatorsStartedAt.current != null && typeof performance !== 'undefined') {
      performance.measure('novahub.finance.indicators-ready', { start: indicatorsStartedAt.current, end: performance.now() });
    }
    indicatorsSpan.current?.setAttribute('outcome', failed ? 'partial' : 'success');
    indicatorsSpan.current?.end();
    indicatorsSpan.current = null;
  }, [indicatorsReady, salesInvoicesQuery.isError, supplierInvoicesQuery.isError, chartAccountsQuery.isError, salesProjectionQuery.isError, supplierProjectionQuery.isError]);
  useEffect(() => () => {
    if (indicatorsMeasured.current || !indicatorsSpan.current) return;
    indicatorsSpan.current.setAttribute('outcome', 'cancelled');
    indicatorsSpan.current.end();
    indicatorsSpan.current = null;
  }, []);

  const cv = (item: any) => {
    const amount = Number(item.amount ?? item.baseAmount ?? 0);
    return valuationMode === 'CURRENT'
      ? convertCurrentAmount(amount, item.currency)
      : convertAmount(amount, item.currency, item.exchangeRate);
  };
  const rawDocBalance = (item: any) => Number(item.amount ?? item.balance ?? item.balanceDue ?? (Number(item.total || 0) - Number(item.amountPaid || 0)));
  const includedUndatedExpenses = historicalFilterActive ? [] : undatedExpenses;
  const totalIncome = useMemo(() => operationalSummaryAvailable ? incomes.reduce((a: number, i: any) => a + cv(i), 0) : null, [incomes, operationalSummaryAvailable, valuationMode, convertAmount, convertCurrentAmount]);
  const totalExpense = useMemo(() => operationalSummaryAvailable
    ? [...expenses, ...includedUndatedExpenses].reduce((a: number, e: any) => a + cv(e), 0)
    : null, [expenses, includedUndatedExpenses, operationalSummaryAvailable, valuationMode, convertAmount, convertCurrentAmount]);
  const netCashFlow = totalIncome === null || totalExpense === null ? null : totalIncome - totalExpense;

  const pendingSalesInvoices = salesInvoices;
  const pendingSupplierInvoices = supplierInvoices;
  const salesSummaryAvailable = canReadSales && salesInvoicesQuery.isSuccess;
  const purchasesSummaryAvailable = canReadPurchases && supplierInvoicesQuery.isSuccess;
  const totalCxc = useMemo(() => salesSummaryAvailable
    ? pendingSalesInvoices.reduce((sum: number, row: any) => sum + cv(row), 0)
    : null, [pendingSalesInvoices, salesSummaryAvailable, valuationMode, convertAmount, convertCurrentAmount]);
  const totalCxp = useMemo(() => purchasesSummaryAvailable
    ? pendingSupplierInvoices.reduce((sum: number, row: any) => sum + cv(row), 0)
    : null, [pendingSupplierInvoices, purchasesSummaryAvailable, valuationMode, convertAmount, convertCurrentAmount]);
  const bankBalance = useMemo(() => bankAccounts.reduce((a: number, acc: any) => a + (valuationMode === 'CURRENT'
    ? convertCurrentAmount(Number(acc.amount || 0), acc.currency)
    : convertAmount(Number(acc.amount || 0), acc.currency, acc.exchangeRate)), 0), [bankAccounts, valuationMode, convertAmount, convertCurrentAmount]);
  const cashSummaryAvailable = canReadFinancial && chartAccountsQuery.isSuccess;
  const availableCash = cashSummaryAvailable ? bankBalance : null;

  const originalCurrencies = useMemo<SupportedCurrency[]>(() => summarizeAmountsByCurrency(
    [...incomes, ...expenses, ...includedUndatedExpenses, ...bankAccounts, ...pendingSalesInvoices, ...pendingSupplierInvoices],
    () => 0,
    (row: any) => row.currency,
  ).map((item) => item.currency), [incomes, expenses, includedUndatedExpenses, bankAccounts, pendingSalesInvoices, pendingSupplierInvoices]);
  const currenciesForDisplay = originalCurrencies.length ? originalCurrencies : [displayCurrency as SupportedCurrency];
  const originalSum = (rows: any[], amountOf: (row: any) => number, currency: SupportedCurrency) => rows
    .filter((row) => normalizeCurrency(row.currency) === currency)
    .reduce((sum, row) => sum + (Number.isFinite(amountOf(row)) ? amountOf(row) : 0), 0);
  const originalIncome = (currency: SupportedCurrency) => operationalSummaryAvailable ? originalSum(incomes, (row) => Number(row.amount ?? row.baseAmount ?? 0), currency) : null;
  const originalExpense = (currency: SupportedCurrency) => operationalSummaryAvailable ? originalSum([...expenses, ...includedUndatedExpenses], (row) => Number(row.amount ?? row.baseAmount ?? 0), currency) : null;
  const originalBank = (currency: SupportedCurrency) => cashSummaryAvailable ? originalSum(bankAccounts, (row) => Number(row.amount || 0), currency) : null;
  const originalCxc = (currency: SupportedCurrency) => salesSummaryAvailable ? originalSum(pendingSalesInvoices, rawDocBalance, currency) : null;
  const originalCxp = (currency: SupportedCurrency) => purchasesSummaryAvailable ? originalSum(pendingSupplierInvoices, rawDocBalance, currency) : null;
  const originalOverdue = (rows: any[], currency: SupportedCurrency) => originalSum(
    rows.filter((row: any) => row.agingBucket !== 'NOT_DUE'), rawDocBalance, currency,
  );

  const monthlyData = useMemo(() => {
    const months: Record<string, { income: number; expense: number; net: number }> = {};
    for (const i of incomes) { const m = i.date ? i.date.substring(0, 7) : 'unknown'; months[m] = months[m] || { income: 0, expense: 0, net: 0 }; months[m].income += cv(i); }
    for (const e of expenses) { const m = e.date ? e.date.substring(0, 7) : 'unknown'; months[m] = months[m] || { income: 0, expense: 0, net: 0 }; months[m].expense += cv(e); }
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({ month, ...d, net: d.income - d.expense }));
  }, [incomes, expenses, valuationMode, convertAmount, convertCurrentAmount]);

  const agingData = useMemo(() => ['0-30 días', '31-60 días', '61-90 días', '+90 días'].map((label) => ({
    label,
    cxc: pendingSalesInvoices.filter((row: any) => row.agingBucket === label).reduce((sum: number, row: any) => sum + cv(row), 0),
    cxp: pendingSupplierInvoices.filter((row: any) => row.agingBucket === label).reduce((sum: number, row: any) => sum + cv(row), 0),
  })), [pendingSalesInvoices, pendingSupplierInvoices, valuationMode, convertAmount, convertCurrentAmount]);

  const projectionAvailable = canReadFinancial && canReadSales && canReadPurchases
    && cashSummaryAvailable && operationalSummaryAvailable
    && salesProjectionQuery.isSuccess && supplierProjectionQuery.isSuccess;
  const projectionLoading = (canReadSales && salesProjectionQuery.isLoading)
    || (canReadPurchases && supplierProjectionQuery.isLoading);
  const sumProjection = (rows: any[], predicate: (row: any) => boolean, field: 'amount' | 'overdueAmount' = 'amount') => rows
    .filter(predicate)
    .reduce((sum: number, row: any) => sum + (valuationMode === 'CURRENT'
      ? convertCurrentAmount(Number(row[field] || 0), row.currency)
      : convertAmount(Number(row[field] || 0), row.currency, row.exchangeRate)), 0);
  const overdueCxc = sumProjection(salesProjectionRows, (row) => row.bucket === '0-30 días', 'overdueAmount');
  const overdueCxp = sumProjection(supplierProjectionRows, (row) => row.bucket === '0-30 días', 'overdueAmount');
  const undatedCxc = sumProjection(salesProjectionRows, (row) => row.bucket === 'NO_DUE_DATE');
  const undatedCxp = sumProjection(supplierProjectionRows, (row) => row.bucket === 'NO_DUE_DATE');
  const undatedExpenseTotal = includedUndatedExpenses.reduce((sum: number, row: any) => sum + cv(row), 0);
  const agingAvailable = canReadSales && canReadPurchases && salesInvoicesQuery.isSuccess && supplierInvoicesQuery.isSuccess;
  const agingLoading = (canReadSales && salesInvoicesQuery.isLoading)
    || (canReadPurchases && supplierInvoicesQuery.isLoading);
  const projectData = useMemo(() => {
    if (!projectionAvailable || availableCash === null) return [];
    const totalDueBy = (rows: any[], days: 30 | 60 | 90) => sumProjection(rows, (row) => {
      if (row.bucket === '0-30 días') return true;
      if (days >= 60 && row.bucket === '31-60 días') return true;
      return days >= 90 && row.bucket === '61-90 días';
    });
    const recurringBy = (kind: 'INCOME' | 'EXPENSE', days: 30 | 60 | 90) => recurringForecastRows
      .filter((row: any) => row.kind === kind && new Date(row.date).getTime() <= Date.now() + days * 86_400_000)
      .reduce((sum: number, row: any) => sum + cv(row), 0);
    const balanceAt = (days: 30 | 60 | 90) => availableCash
      + totalDueBy(salesProjectionRows, days) - totalDueBy(supplierProjectionRows, days)
      + recurringBy('INCOME', days) - recurringBy('EXPENSE', days);
    return [
      { label: 'Hoy', amount: availableCash },
      { label: '30 días', amount: balanceAt(30) },
      { label: '60 días', amount: balanceAt(60) },
      { label: '90 días', amount: balanceAt(90) },
    ];
  }, [projectionAvailable, availableCash, salesProjectionRows, supplierProjectionRows, recurringForecastRows, valuationMode, convertAmount, convertCurrentAmount]);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const e of expenses) {
      const cat = financeCategoryLabel(e.category || 'OTROS');
      cats[cat] = (cats[cat] || 0) + cv(e);
    }
    if (!historicalFilterActive) {
      for (const e of includedUndatedExpenses) {
        const category = 'Compras sin fecha confiable';
        cats[category] = (cats[category] || 0) + cv(e);
      }
    }
    return Object.entries(cats).sort(([, a], [, b]) => b - a).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [expenses, includedUndatedExpenses, historicalFilterActive, valuationMode, convertAmount, convertCurrentAmount]);

  const fmt = (n: number) => formatCurrentAmount(n, displayCurrency);
  const fmtShort = (n: number) => {
    const displayed = n;
    if (Math.abs(displayed) >= 1_000_000) return sym + (displayed / 1_000_000).toFixed(1) + 'M';
    if (Math.abs(displayed) >= 1_000) return sym + (displayed / 1_000).toFixed(1) + 'K';
    return sym + displayed.toLocaleString(undefined, { minimumFractionDigits: 0 });
  };
  const renderKpi = (
    label: string,
    icon: any,
    total: number | null,
    amountByCurrency: (currency: SupportedCurrency) => number | null,
    onClick?: () => void,
    subByCurrency?: (currency: SupportedCurrency) => string,
  ) => displayMode === 'ORIGINAL'
    ? currenciesForDisplay.map((currency) => (
      <KpiCard
        key={`${label}-${currency}`}
        icon={icon}
        label={`${label} (${currency})`}
        value={amountByCurrency(currency) === null ? '—' : formatExplicitAmount(amountByCurrency(currency) as number, currency)}
        sub={subByCurrency?.(currency)}
        onClick={onClick}
      />
    ))
    : <KpiCard icon={icon} label={`${label}${valuationModeSuffix}`} value={total === null ? '—' : fmt(total)} onClick={onClick} />;

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {renderKpi('Saldo Disponible', Landmark, availableCash, originalBank, () => onNavigate?.('caja-bancos'))}
        {renderKpi('Ingresos Cobrados', TrendingUp, totalIncome, originalIncome, () => onNavigate?.('ingresos'))}
        {renderKpi('Pagos Realizados', TrendingDown, totalExpense, originalExpense, () => onNavigate?.('gastos'), (currency) => {
          const undated = originalSum(undatedExpenses, (row) => Number(row.amount ?? row.baseAmount ?? 0), currency);
          if (undated <= 0) return undefined;
          return historicalFilterActive
            ? `${formatExplicitAmount(undated, currency)} sin fecha confiable · fuera del período`
            : `${formatExplicitAmount(undated, currency)} sin fecha confiable · incluido`;
        })}
        {renderKpi('Flujo Neto', DollarSign, netCashFlow, (currency) => {
          const income = originalIncome(currency);
          const expense = originalExpense(currency);
          return income === null || expense === null ? null : income - expense;
        })}
        {renderKpi('Total por Cobrar', BarChart3, totalCxc, originalCxc, () => onNavigate?.('cuentas-cobrar'), (currency) => {
          if (!salesSummaryAvailable) return 'No disponible';
          const overdue = originalOverdue(pendingSalesInvoices, currency);
          return overdue > 0 ? `${formatExplicitAmount(overdue, currency)} vencido` : 'Sin vencidos';
        })}
        {renderKpi('Total por Pagar', BarChart3, totalCxp, originalCxp, () => onNavigate?.('cuentas-pagar'), (currency) => {
          if (!purchasesSummaryAvailable) return 'No disponible';
          const overdue = originalOverdue(pendingSupplierInvoices, currency);
          return overdue > 0 ? `${formatExplicitAmount(overdue, currency)} vencido` : 'Sin vencidos';
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Cobros vs Pagos por Mes</CardTitle>
            <p className="text-[10px] text-muted-foreground">Cobros y pagos reales según su fecha. Línea naranja: resultado neto.</p>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible px-2 pb-3">
            {!operationalSummaryAvailable ? <p className="py-20 text-center text-xs text-muted-foreground">No se pudo cargar el resumen operativo.</p> : <ResponsiveContainer width="100%" height={320}>
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
            </ResponsiveContainer>}
            {operationalSummaryAvailable && undatedExpenseTotal > 0 && !historicalFilterActive && (
              <p className="px-3 pt-1 text-[10px] text-amber-600 dark:text-amber-400">{fmt(undatedExpenseTotal)} en facturas pagadas sin fecha confiable se incluye en los totales, pero no se asigna a un mes.</p>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Flujo de Caja Proyectado</CardTitle>
            <p className="text-[10px] text-muted-foreground">Saldo de hoy más cobros, pagos y recurrencias previstas desde hoy.</p>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible px-2 pb-3">
            {!projectionAvailable ? <p className="py-20 text-center text-xs text-muted-foreground">{projectionLoading ? 'Calculando proyección…' : 'La proyección no está disponible. Verifica el saldo de caja y los permisos de Ventas y Compras.'}</p> : <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={projectData} margin={{ top: 12, right: 20, left: 8, bottom: 14 }}>
                <defs>
                  <linearGradient id="projG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} /><stop offset="100%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke={FINANCE_GRID} opacity={0.45} vertical={false} />
                <XAxis dataKey="label" tick={FINANCE_AXIS_TICK} tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tick={FINANCE_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtShort(v)} width={64} />
                <Tooltip content={<FinanceTooltipCard formatter={fmt} />} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} cursor={{ stroke: '#06b6d4', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area dataKey="amount" name="Flujo proyectado" fill="url(#projG)" stroke="#06b6d4" strokeWidth={2.5} type="monotone" dot={{ r: 4, fill: '#06b6d4', strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>}
            {projectionAvailable && <div className="space-y-1 px-3 pt-1 text-[10px] text-muted-foreground">
              <p>Vencido incluido en 0–30 días: por cobrar {fmt(overdueCxc)} · por pagar {fmt(overdueCxp)}.</p>
              {(undatedCxc > 0 || undatedCxp > 0) && <p>Sin fecha de vencimiento, excluido de la proyección: por cobrar {fmt(undatedCxc)} · por pagar {fmt(undatedCxp)}.</p>}
            </div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="min-w-0 lg:col-span-2 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">CxC y CxP por Vencimiento</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible px-2 pb-3">
            {!agingAvailable ? <p className="py-20 text-center text-xs text-muted-foreground">{agingLoading ? 'Cargando vencimientos…' : 'No se pudieron cargar ambos resúmenes de vencimiento.'}</p> : <ResponsiveContainer width="100%" height={260}>
              <BarChart data={agingData} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 14 }}>
                <CartesianGrid strokeDasharray="4 4" stroke={FINANCE_GRID} opacity={0.45} horizontal={false} />
                <XAxis type="number" tick={FINANCE_AXIS_TICK} tickFormatter={(v: number) => fmtShort(v)} tickMargin={8} />
                <YAxis dataKey="label" type="category" tick={{ ...FINANCE_AXIS_TICK, fill: 'var(--foreground)', fontWeight: 600 }} width={96} />
                <Tooltip content={<FinanceTooltipCard formatter={fmt} />} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Legend verticalAlign="bottom" height={28} formatter={(value: string) => <span style={{ color: 'var(--foreground)', fontWeight: 600, fontSize: 11 }}>{value}</span>} />
                <Bar dataKey="cxc" name="Por Cobrar" fill="#10b981" radius={[0, 5, 5, 0]} maxBarSize={32} onClick={(data: any) => toast.info(`CxC ${data.label}: ${fmt(data.cxc)}`)} style={{ cursor: 'pointer' }} />
                <Bar dataKey="cxp" name="Por Pagar" fill="#ef4444" radius={[0, 5, 5, 0]} maxBarSize={32} onClick={(data: any) => toast.info(`CxP ${data.label}: ${fmt(data.cxp)}`)} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ResponsiveContainer>}
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <CardTitle className="text-sm font-black uppercase tracking-tight text-foreground">Gastos por Categoría</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible px-2 pb-3">
            {!operationalSummaryAvailable ? (
              <p className="text-xs text-muted-foreground py-12 text-center">No se pudo cargar el resumen de gastos.</p>
            ) : categoryData.length === 0 ? (
              <p className="text-xs text-muted-foreground py-12 text-center">Sin datos de gastos</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 14 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke={FINANCE_GRID} opacity={0.45} horizontal={false} />
                  <XAxis type="number" tick={FINANCE_AXIS_TICK} tickFormatter={(v: number) => fmtShort(v)} tickMargin={8} />
                  <YAxis dataKey="name" type="category" tick={{ ...FINANCE_AXIS_TICK, fill: 'var(--foreground)', fontWeight: 500, fontSize: 10 }} width={132} tickFormatter={(value: string) => value.length > 20 ? `${value.slice(0, 19)}…` : value} />
                  <Tooltip content={<FinanceTooltipCard formatter={fmt} />} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Bar dataKey="value" name="Gastos" radius={[0, 5, 5, 0]} maxBarSize={32} onClick={(data: any) => toast.info(`Gastos ${data.name}: ${fmt(data.value)}`)} style={{ cursor: 'pointer' }}>
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
              <Badge variant="secondary" className="text-[9px]">{recentIncomes.length} recientes</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {!operationalSummaryAvailable ? <p className="py-10 text-center text-xs text-muted-foreground">Resumen no disponible</p> : recentIncomes.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground"><TrendingUp className="size-6 mx-auto mb-2 text-muted-foreground/30" />Sin ingresos registrados</div>
            ) : (
              <>
              {recentIncomes.map((inc: any) => (
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
              <button onClick={() => onNavigate?.('ingresos')} className="w-full mt-2 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary transition-colors">Ver ingresos →</button>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/40 bg-card shadow-sm">
          <CardHeader className="pb-2 px-5 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-tight text-foreground">Últimos Gastos</CardTitle>
              <Badge variant="secondary" className="text-[9px]">{recentExpenses.length} recientes</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {!operationalSummaryAvailable ? <p className="py-10 text-center text-xs text-muted-foreground">Resumen no disponible</p> : recentExpenses.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground"><TrendingDown className="size-6 mx-auto mb-2 text-muted-foreground/30" />Sin gastos registrados</div>
            ) : (
              <>
              {recentExpenses.map((exp: any) => (
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
              <button onClick={() => onNavigate?.('gastos')} className="w-full mt-2 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary transition-colors">Ver gastos →</button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, onClick }: { icon: any; label: string; value: string; sub?: string; onClick?: () => void }) {
  return <SalesKpiCard title={label} value={value} icon={icon} sub={sub} onClick={onClick} />;
}
