import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  DollarSign, TrendingUp, TrendingDown, BarChart3, 
  CalendarClock, Landmark, RotateCcw, Wallet,
  AlertTriangle, Calendar, CalendarDays, Filter, X,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { FinanceDashboardView } from './finanzas/FinanceDashboardView';
import { FinanceTableView } from './finanzas/FinanceTableView';
import { FinanceBalanceView } from './finanzas/FinanceBalanceView';
import { FinanceCashView } from './finanzas/FinanceCashView';
import { FinanceReceivablesView } from './finanzas/FinanceReceivablesView';
import { FinancePayablesView } from './finanzas/FinancePayablesView';
import { FinanceCalendarView } from './finanzas/FinanceCalendarView';
import { FinanceGeneralBalanceView } from './finanzas/FinanceGeneralBalanceView';
import { FinanceLossesView } from './finanzas/FinanceLossesView';
import { accountsService, incomeService, expensesService, recurringExpensesService, recurringIncomesService } from '../services/finanzas.service';
import { contabilidadService } from '../services/contabilidad.service';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../contexts/AuthContext';
import { useBranchScope } from '../hooks/useBranchScope';
import { BranchScopeFilter } from './ui/BranchScopeFilter';
import { CurrencyValuationAmount, CurrencyValuationBanner } from './ui/CurrencyValuation';
import { cn } from './ui/utils';
import { financeCategoryLabel } from './finanzas/financeChartTheme';

interface FinanzasPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (subModule?: string) => void;
}

const PERIOD_PRESETS = [
  { label: 'Hoy', days: 0 },
  { label: '7 días', days: 7 },
  { label: 'Mes', days: 30 },
  { label: 'Trimestre', days: 90 },
  { label: 'Año', days: 365 },
];

const normalizeListResponse = (response: any) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

function sortByRecentRegistration(items: any[]): any[] {
  return [...items].sort((left, right) => {
    const leftCreatedAt = new Date(left?.createdAt || left?.date || 0).getTime();
    const rightCreatedAt = new Date(right?.createdAt || right?.date || 0).getTime();
    if (rightCreatedAt !== leftCreatedAt) return rightCreatedAt - leftCreatedAt;

    const leftDate = new Date(left?.date || 0).getTime();
    const rightDate = new Date(right?.date || 0).getTime();
    if (rightDate !== leftDate) return rightDate - leftDate;
    return String(right?.id || '').localeCompare(String(left?.id || ''));
  });
}

function extractSalesDocumentNumber(income: any): string | null {
  const text = `${income?.description || ''} ${income?.notes || ''}`;
  const match = text.match(/\b(?:FAC|NC)-[A-Z0-9-]+\b/i);
  return match?.[0]?.toUpperCase() || null;
}

function groupSalesIncomePayments(
  rows: any[],
  baseCurrency: string,
  globalRate: number,
  toBaseAmount: (amount: number, sourceCurrency?: string, sourceExchangeRate?: number) => number,
) {
  const groups = new Map<string, any[]>();

  rows.forEach((row) => {
    const source = String(row?.source || '').trim().toLowerCase();
    const documentNumber = extractSalesDocumentNumber(row);
    const isSalesPayment = ['ventas - pagos', 'ventas - caja'].includes(source);
    const key = isSalesPayment && documentNumber ? `sales:${documentNumber}` : `income:${row.id}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  });

  return [...groups.values()].map((children) => {
    const ordered = [...children].sort((left, right) => new Date(left?.createdAt || left?.date || 0).getTime() - new Date(right?.createdAt || right?.date || 0).getTime());
    if (ordered.length === 1) return ordered[0];

    const first = ordered[0];
    const documentNumber = extractSalesDocumentNumber(first) || 'documento';
    const currencies = new Set(ordered.map((row) => String(row?.currency || baseCurrency).toUpperCase()));
    const baseAmount = Number(ordered.reduce((sum, row) => sum + (
      row?.baseAmount !== undefined && row?.baseAmount !== null
        ? Number(row.baseAmount)
        : toBaseAmount(Number(row?.amount || 0), row?.currency, Number(row?.exchangeRate || globalRate))
    ), 0).toFixed(2));
    const sameCurrency = currencies.size <= 1;
    const isMixed = ordered.some((row) => /cobro mixto|pago mixto/i.test(String(row?.description || '')))
      || (String(first?.source || '').toLowerCase() === 'ventas - caja' && new Set(ordered.map((row) => String(row?.description || '').match(/\(([^)]+)\)/)?.[1] || '')).size > 1);
    const label = isMixed ? 'Pago mixto' : 'Pagos agrupados';

    return {
      ...first,
      id: `income-group:${documentNumber}`,
      number: first.number,
      amount: sameCurrency ? Number(ordered.reduce((sum, row) => sum + Number(row?.amount || 0), 0).toFixed(2)) : baseAmount,
      currency: sameCurrency ? first.currency : baseCurrency,
      exchangeRate: sameCurrency ? Number(first.exchangeRate || 1) : 1,
      baseAmount,
      description: `${label} · ${documentNumber}`,
      notes: `${label} · ${ordered.length} movimientos. Usa "Ver desglose" para consultar cada ingreso.`,
      isGroupedIncome: true,
      groupedItems: ordered,
      paymentLabel: label,
      paymentCount: ordered.length,
    };
  });
}

export function FinanzasPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed }: FinanzasPageProps) {
  const { user, canPerform } = useAuth();
  const canReadFinancial = canPerform('FINANCIAL', 'view');
  const canReadAccounting = canPerform('ACCOUNTING', 'view');
  const queryClient = useQueryClient();
  const { selectedBranchId, filterByBranch, isRestricted, accessibleBranches } = useBranchScope();
  const { displayCurrency, baseCurrency, exchangeRate: globalRate, valuationMode, valuationModeLabel, showValuationLegend, convertAmount, convertCurrentAmount, formatCurrentAmount, toBaseAmount } = useCurrency();

  const hasAccess = (moduleId: string) => {
    if (!user?.enabledModules) return true;
    if (user.enabledModules.includes(moduleId)) return true;
    // La suscripción al módulo padre (FINANCIAL) habilita todas sus vistas,
    // incluso con submódulos granulares contratados.
    return user.enabledModules.includes('FINANCIAL');
  };

  const subModuleToTab: Record<string, string> = { 
    'resumen-financiero': 'resumen',
    'caja-bancos': 'caja-bancos',
    'cuentas-cobrar': 'cuentas-cobrar',
    'cuentas-pagar': 'cuentas-pagar',
    'ingresos': 'ingresos', 
    'gastos': 'gastos',
    'egresos': 'gastos', 
    'movimientos-recurrentes': 'recurrentes',
    'calendario-financiero': 'calendario',
    'analisis-ingresos-gastos': 'analisis',
    'balance-general': 'balance-general',
    'perdidas': 'perdidas',
  };
  
  const [activeTab, setActiveTab] = useState(() => activeSubModule ? (subModuleToTab[activeSubModule] || 'resumen') : 'resumen');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePreset, setActivePreset] = useState<string>('');
  const [targetFinanceId, setTargetFinanceId] = useState<{ tab: 'ingresos' | 'gastos'; id: string } | null>(null);

  const applyPreset = (label: string, days: number) => {
    setActivePreset(label);
    if (days === 0) {
      const d = new Date(); setDateFrom(d.toISOString().split('T')[0]); setDateTo(d.toISOString().split('T')[0]);
    } else {
      const to = new Date(); const from = new Date(); from.setDate(from.getDate() - days);
      setDateFrom(from.toISOString().split('T')[0]); setDateTo(to.toISOString().split('T')[0]);
    }
  };

  const clearFilters = () => { setDateFrom(''); setDateTo(''); setActivePreset(''); };

  const filterByDate = (items: any[]) => {
    if (!dateFrom && !dateTo) return items;
    return items.filter((item: any) => {
      const d = item.date || item.createdAt;
      if (!d) return true;
      const dt = new Date(d);
      if (dateFrom && dt < new Date(dateFrom)) return false;
      if (dateTo) { const end = new Date(dateTo); end.setHours(23, 59, 59, 999); if (dt > end) return false; }
      return true;
    });
  };

  const tenantKey = user?.clientTenantId || user?.tenantId || 'current';
  const financeParams = { page: 1, pageSize: 500, ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) };
  const activeDataTabs = {
    income: ['resumen', 'ingresos', 'analisis', 'balance-general'].includes(activeTab),
    expense: ['resumen', 'gastos', 'analisis', 'balance-general'].includes(activeTab),
    recurringExpense: ['resumen', 'recurrentes', 'calendario', 'analisis'].includes(activeTab),
    recurringIncome: ['resumen', 'recurrentes', 'calendario', 'analisis'].includes(activeTab),
    accounts: ['resumen', 'ingresos', 'gastos', 'recurrentes', 'balance-general'].includes(activeTab),
  };
  const incomesQuery = useQuery({
    queryKey: ['finance', 'income', tenantKey, dateFrom, dateTo],
    queryFn: ({ signal }) => incomeService.getAll(financeParams, signal),
    enabled: canReadFinancial && activeDataTabs.income,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const expensesQuery = useQuery({
    queryKey: ['finance', 'expenses', tenantKey, dateFrom, dateTo],
    queryFn: ({ signal }) => expensesService.getAll(financeParams, signal),
    enabled: canReadFinancial && activeDataTabs.expense,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const recurringExpensesQuery = useQuery({
    queryKey: ['finance', 'recurring-expenses', tenantKey, dateFrom, dateTo],
    queryFn: ({ signal }) => recurringExpensesService.getAll(financeParams, signal),
    enabled: canReadFinancial && activeDataTabs.recurringExpense,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const recurringIncomesQuery = useQuery({
    queryKey: ['finance', 'recurring-incomes', tenantKey, dateFrom, dateTo],
    queryFn: ({ signal }) => recurringIncomesService.getAll(financeParams, signal),
    enabled: canReadFinancial && activeDataTabs.recurringIncome,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const accountsQuery = useQuery({
    queryKey: ['finance', 'accounts', tenantKey],
    queryFn: ({ signal }) => accountsService.getAll({ page: 1, pageSize: 500 }, signal),
    enabled: canReadFinancial && activeDataTabs.accounts,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const accountingMappingsQuery = useQuery({
    queryKey: ['finance', 'accounting-mappings', tenantKey],
    queryFn: ({ signal }) => contabilidadService.getSuggestedAccounts(signal),
    enabled: canReadAccounting && activeDataTabs.accounts,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const incomes = normalizeListResponse(incomesQuery.data);
  const expenses = normalizeListResponse(expensesQuery.data);
  const recurringExpenses = normalizeListResponse(recurringExpensesQuery.data);
  const recurringIncomes = normalizeListResponse(recurringIncomesQuery.data);
  const accounts = normalizeListResponse(accountsQuery.data);
  const activeQueries = [
    activeDataTabs.income && incomesQuery,
    activeDataTabs.expense && expensesQuery,
    activeDataTabs.recurringExpense && recurringExpensesQuery,
    activeDataTabs.recurringIncome && recurringIncomesQuery,
    activeDataTabs.accounts && accountsQuery,
  ].filter(Boolean) as Array<{ isLoading: boolean; isError: boolean }>;
  const loading = activeQueries.some(query => query.isLoading);

  const fIncomes = sortByRecentRegistration(filterByDate(filterByBranch(incomes)));
  const fExpenses = sortByRecentRegistration(filterByDate(filterByBranch(expenses)));
  const fRecurringExpenses = filterByDate(filterByBranch(recurringExpenses)).filter((r: any) => Number(r.amount) > 0);
  const fRecurringIncomes = filterByDate(filterByBranch(recurringIncomes)).filter((r: any) => Number(r.amount) > 0);
  const fAccounts = filterByDate(filterByBranch(accounts));
  const groupedIncomeRows = groupSalesIncomePayments(fIncomes, baseCurrency, globalRate, toBaseAmount);

  const normalizeItemResponse = (response: any) => {
    if (response && typeof response === 'object' && 'data' in response && response.data) {
      return response.data;
    }
    return response;
  };

  const getAccountType = (account: any) => String(account?.type || '').toUpperCase();

  const findAccountByPreferredTypes = (preferredTypes: string[]) => {
    const activeAccounts = accounts.filter((acc) => acc?.isActive !== false && acc?.acceptsPostings !== false);
    return (
      activeAccounts.find((acc) => preferredTypes.includes(getAccountType(acc))) ||
      activeAccounts.find((acc) => getAccountType(acc) === 'ASSET') ||
      accounts.find((acc) => preferredTypes.includes(getAccountType(acc))) ||
      accounts.find((acc) => getAccountType(acc) === 'ASSET') ||
      undefined
    );
  };

  const ensureDefaultAccount = async (accountKind: 'INCOME' | 'EXPENSE') => {
    const preferredTypes = accountKind === 'INCOME' ? ['INCOME', 'REVENUE'] : ['EXPENSE'];
    const configuredModule = accountKind === 'INCOME' ? 'financialIncome' : 'financialExpense';
    const configuredField = accountKind === 'INCOME' ? 'income' : 'expense';
    const configuredCode = accountingMappingsQuery.data?.mappings?.[configuredModule]?.[configuredField]?.code;
    const configured = configuredCode
      ? accounts.find((acc) => acc.code === configuredCode && acc.isActive !== false && acc.acceptsPostings !== false)
      : undefined;
    const existing = configured || findAccountByPreferredTypes(preferredTypes);
    if (existing) return existing;

    const suffix = Date.now().toString().slice(-6);
    const payload = {
      code: accountKind === 'INCOME' ? `ING-${suffix}` : `GAS-${suffix}`,
      name: accountKind === 'INCOME' ? 'Ingresos Generales' : 'Gastos Generales',
      type: accountKind as any,
    };

    const createdResponse = await accountsService.create(payload);
    const createdAccount = normalizeItemResponse(createdResponse);
    if (!createdAccount?.id) throw new Error('No se pudo crear una cuenta contable por defecto');
    queryClient.invalidateQueries({ queryKey: ['finance', 'accounts'] });
    toast.success(accountKind === 'INCOME' ? 'Se creó una cuenta de ingresos por defecto' : 'Se creó una cuenta de gastos por defecto');
    return createdAccount;
  };

  useEffect(() => {
    if (activeSubModule && subModuleToTab[activeSubModule]) {
      if (activeTab !== subModuleToTab[activeSubModule]) {
        setActiveTab(subModuleToTab[activeSubModule]);
      }
    }
  }, [activeSubModule, activeTab]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as any;
      if (detail?.module !== 'finanzas' || !['ingresos', 'gastos'].includes(detail?.subModule) || !detail?.targetId) return;
      setTargetFinanceId({ tab: detail.subModule, id: String(detail.targetId) });
    };
    window.addEventListener('navigate-module', handler);
    return () => window.removeEventListener('navigate-module', handler);
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const subModule = Object.keys(subModuleToTab).find(key => subModuleToTab[key] === value) || value;
    if (onSubModuleChange) onSubModuleChange(subModule);
  };

  useEffect(() => {
    if (activeQueries.length > 0 && activeQueries.every(query => query.isError)) {
      toast.error('Error al cargar datos financieros');
    }
  }, [activeTab, dateFrom, dateTo, activeQueries.map(query => query.isError).join('|')]);

  const INCOME_COLUMNS = [
    { key: 'number', label: 'No. Recibo', type: 'text' as const, editable: false },
    { key: 'createdAt', label: 'Fecha Reg.', type: 'datetime' as const, editable: false },
    { key: 'source', label: 'Origen', type: 'source' as const, editable: false },
    { key: 'description', label: 'Descripción', type: 'text' as const, editable: true },
    { key: 'category', label: 'Categoría', type: 'select' as const, editable: true },
    { key: 'amount', label: 'Monto', type: 'currency' as const, editable: true },
    { key: 'notes', label: 'Notas', type: 'text' as const, editable: true },
  ];

  const renderIncomeDetails = (item: any) => (
    <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
      {(item.groupedItems || [item]).map((child: any) => (
        <div key={child.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs font-black text-primary">{child.number || 'Ingreso'}</p>
              <p className="mt-1 text-xs font-semibold text-foreground">{child.description || 'Ingreso automático'}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{child.createdAt || child.date ? new Date(child.createdAt || child.date).toLocaleString('es-NI') : 'Sin fecha'}{child.notes ? ` · ${child.notes}` : ''}</p>
            </div>
            <CurrencyValuationAmount amount={Number(child.amount || 0)} sourceCurrency={child.currency} sourceExchangeRate={child.exchangeRate} className="shrink-0 font-black text-emerald-600" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderExpenseDetails = (item: any) => (
    <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-black text-primary">{item.number || 'Gasto'}</p>
            <p className="mt-1 text-xs font-semibold text-foreground">{item.description || 'Gasto registrado'}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{item.createdAt || item.date ? new Date(item.createdAt || item.date).toLocaleString('es-NI') : 'Sin fecha'}{item.notes ? ` · ${item.notes}` : ''}</p>
          </div>
          <CurrencyValuationAmount amount={Number(item.amount || 0)} sourceCurrency={item.currency} sourceExchangeRate={item.exchangeRate} className="shrink-0 font-black text-rose-600" />
        </div>
        <div className="mt-3 border-t border-border/30 pt-2 text-[10px] text-muted-foreground">
          <span className="font-bold text-foreground">Categoría:</span> {financeCategoryLabel(item.category)}
        </div>
      </div>
    </div>
  );

  const EXPENSE_COLUMNS = [
    { key: 'number', label: 'No. Gasto', type: 'text' as const, editable: false },
    { key: 'createdAt', label: 'Fecha Reg.', type: 'datetime' as const, editable: false },
    { key: 'source', label: 'Origen', type: 'source' as const, editable: false },
    { key: 'description', label: 'Descripción', type: 'text' as const, editable: true },
    { key: 'category', label: 'Categoría', type: 'select' as const, editable: true },
    { key: 'amount', label: 'Monto', type: 'currency' as const, editable: true },
    { key: 'notes', label: 'Notas', type: 'text' as const, editable: true },
  ];

  const RECURRING_COLUMNS = [
    { key: 'createdAt', label: 'fecha', type: 'datetime' as const, editable: false },
    { key: 'source', label: 'origen', type: 'text' as const, editable: true },
    { key: 'description', label: 'descripcion', type: 'text' as const, editable: true },
    { key: 'frequency', label: 'frecuencia', type: 'select' as const, editable: true, options: [
      { value: 'DAILY', label: 'Diario' }, { value: 'WEEKLY', label: 'Semanal' }, { value: 'BIWEEKLY', label: 'Quincenal' },
      { value: 'MONTHLY', label: 'Mensual' }, { value: 'QUARTERLY', label: 'Trimestral' }, { value: 'SEMIANNUAL', label: 'Semestral' }, { value: 'YEARLY', label: 'Anual' },
    ] },
    { key: 'amount', label: 'monto', type: 'currency' as const, editable: true },
    { key: 'category', label: 'categoria', type: 'select' as const, editable: true },
    { key: 'status', label: 'estado', type: 'select' as const, editable: true, options: [
      { value: 'ACTIVE', label: 'Activo' }, { value: 'PAUSED', label: 'Pausado' },
    ] },
  ];

  const handleUpdateExpense = async (id: string, updates: any) => {
    const existing = fExpenses.find((e: any) => e.id === id);
    if (existing && !['Manual', 'manual', '', null, undefined].includes(existing.source)) {
      toast.error('No se puede editar un registro generado automáticamente');
      return;
    }
    await expensesService.update(id, updates);
    await queryClient.invalidateQueries({ queryKey: ['finance', 'expenses'] });
  };

  const handleUpdateIncome = async (id: string, updates: any) => {
    const existing = fIncomes.find((i: any) => i.id === id);
    if (existing && !['Manual', 'manual', '', null, undefined].includes(existing.source)) {
      toast.error('No se puede editar un ingreso generado automáticamente');
      return;
    }
    await incomeService.update(id, updates);
    await queryClient.invalidateQueries({ queryKey: ['finance', 'income'] });
  };

  const handleUpdateRecurring = async (id: string, updates: any) => {
    const isIncome = recurringIncomes.some(r => r.id === id);
    if (isIncome) {
      await recurringIncomesService.update(id, updates);
      await queryClient.invalidateQueries({ queryKey: ['finance', 'recurring-incomes'] });
    } else {
      await recurringExpensesService.update(id, updates);
      await queryClient.invalidateQueries({ queryKey: ['finance', 'recurring-expenses'] });
    }
  };

  const handleAddRecurring = async (type: 'EXPENSE' | 'INCOME') => {
    try {
      const defaultAccount = await ensureDefaultAccount(type === 'INCOME' ? 'INCOME' : 'EXPENSE');
      const payload: any = {
        source: type === 'INCOME' ? 'Nuevo Ingreso Recurrente' : 'Nuevo Gasto Recurrente',
        description: '',
        frequency: 'MONTHLY',
        amount: 0,
        startDate: new Date().toISOString(),
        accountId: defaultAccount.id,
        status: 'ACTIVE',
        category: 'OTROS',
        currency: 'NIO' as any,
        exchangeRate: globalRate,
      };
      if (type === 'INCOME') {
        await recurringIncomesService.create(payload);
        await queryClient.invalidateQueries({ queryKey: ['finance', 'recurring-incomes'] });
      } else {
        await recurringExpensesService.create(payload);
        await queryClient.invalidateQueries({ queryKey: ['finance', 'recurring-expenses'] });
      }
      toast.success(`Nuevo movimiento ${type === 'INCOME' ? 'de ingreso' : 'de gasto'} recurrente añadido`);
    } catch (error) {
      toast.error('Error al crear movimiento recurrente');
    }
  };

  const handleAddIncome = async () => {
    try {
      const defaultAccount = await ensureDefaultAccount('INCOME');
      const newItem = { source: 'Manual', description: '', amount: 0, date: new Date().toISOString(), accountId: defaultAccount.id, category: 'OTROS', currency: 'NIO' as any, exchangeRate: globalRate, notes: '' };
      await incomeService.create(newItem);
      await queryClient.invalidateQueries({ queryKey: ['finance', 'income'] });
      toast.success('Nuevo ingreso añadido');
    } catch (error) { toast.error('Error al crear ingreso'); }
  };

  const handleAddExpense = async () => {
    try {
      const defaultAccount = await ensureDefaultAccount('EXPENSE');
      const newItem = { source: 'Manual', description: 'Nuevo Gasto', category: 'OTROS', amount: 0, date: new Date().toISOString(), accountId: defaultAccount.id, currency: 'NIO' as any, exchangeRate: globalRate, status: 'PENDING' as any, notes: '' };
      await expensesService.create(newItem);
      await queryClient.invalidateQueries({ queryKey: ['finance', 'expenses'] });
      toast.success('Nuevo gasto añadido');
    } catch (error) { toast.error('Error al crear gasto'); }
  };

  const toDisplayAmount = (amount: number, currency?: string, rate?: number) => valuationMode === 'CURRENT'
    ? convertCurrentAmount(amount, currency)
    : convertAmount(amount, currency, rate || globalRate);
  const totalIncome = fIncomes.reduce((acc, i) => acc + toDisplayAmount(Number(i.amount || i.baseAmount || 0), i.currency, i.exchangeRate), 0);
  const totalExpense = fExpenses.reduce((acc, e) => acc + toDisplayAmount(Number(e.amount || e.baseAmount || 0), e.currency, e.exchangeRate), 0);

  const tabTriggerClass = "flex min-w-10 shrink-0 items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all sm:min-w-0 sm:justify-start sm:px-4";

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: BarChart3, module: 'FINANCIAL_DASHBOARD', permission: ['FINANCIAL_DASHBOARD'] },
    { id: 'caja-bancos', label: 'Caja y Bancos', icon: Landmark, module: 'FINANCIAL_BANK', permission: ['FINANCIAL_BANK', 'FINANCIAL_DASHBOARD'] },
    { id: 'cuentas-cobrar', label: 'CxC', icon: TrendingUp, module: 'FINANCIAL_INCOMES', permission: ['FINANCIAL_RECEIVABLES', 'FINANCIAL_INCOMES'] },
    { id: 'cuentas-pagar', label: 'CxP', icon: TrendingDown, module: 'FINANCIAL_EXPENSES', permission: ['FINANCIAL_PAYABLES', 'FINANCIAL_EXPENSES'] },
    { id: 'ingresos', label: 'Ingresos', icon: TrendingUp, module: 'FINANCIAL_INCOMES', permission: ['FINANCIAL_INCOMES'] },
    { id: 'gastos', label: 'Gastos', icon: Wallet, module: 'FINANCIAL_EXPENSES', permission: ['FINANCIAL_EXPENSES'] },
    { id: 'recurrentes', label: 'Recurrentes', icon: RotateCcw, module: 'FINANCIAL_EXPENSES_REC', permission: ['FINANCIAL_EXPENSES_REC'] },
    { id: 'calendario', label: 'Calendario', icon: CalendarClock, module: 'FINANCIAL_DASHBOARD', permission: ['FINANCIAL_CALENDAR', 'FINANCIAL_DASHBOARD'] },
    { id: 'analisis', label: 'Análisis', icon: BarChart3, module: 'FINANCIAL_BALANCE', permission: ['FINANCIAL_ANALYSIS', 'FINANCIAL_BALANCE'] },
    { id: 'balance-general', label: 'Balance Gral', icon: Landmark, module: 'FINANCIAL_BALANCE', permission: ['FINANCIAL_BALANCE'] },
    { id: 'perdidas', label: 'Pérdidas', icon: TrendingDown, module: 'FINANCIAL_EXPENSES', permission: ['FINANCIAL_LOSSES', 'FINANCIAL_EXPENSES'] },
  ];

  return (
    <div className="finance-module mx-auto min-w-0 w-full max-w-[1700px] space-y-4 overflow-x-hidden p-3 pb-20 sm:p-6 md:p-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <DollarSign className="size-9 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
              Finanzas <span className="text-primary">Empresariales</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                {formatCurrentAmount(totalIncome, displayCurrency)} ingresos · {formatCurrentAmount(totalExpense, displayCurrency)} gastos{showValuationLegend ? ` · ${valuationModeLabel}` : ''}
              </Badge>
              {isRestricted && (
                <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                  {accessibleBranches.length} sucursal(es)
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <CurrencyValuationBanner />

      {/* Filter bar */}
      <div className="grid min-w-0 grid-cols-2 gap-2 rounded-xl border border-border/40 bg-card/50 p-3 sm:flex sm:flex-wrap sm:items-center">
        <CalendarDays className="col-span-2 size-5 text-primary sm:col-span-1" aria-hidden="true" />
        {PERIOD_PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p.label, p.days)}
            className={`min-w-0 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all sm:px-3 ${activePreset === p.label ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-foreground/80 hover:bg-muted'}`}>
            {p.label}
          </button>
        ))}
        <div className="hidden h-5 w-px bg-border mx-1 sm:block" />
        <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActivePreset(''); }} className="h-9 min-w-0 w-full text-xs font-semibold text-foreground sm:w-44" placeholder="Desde" aria-label="Fecha desde" />
        <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActivePreset(''); }} className="h-9 min-w-0 w-full text-xs font-semibold text-foreground sm:w-44" placeholder="Hasta" aria-label="Fecha hasta" />
        {(dateFrom || dateTo || activePreset) && (
          <button onClick={clearFilters} className="col-span-2 justify-self-start rounded-lg p-1.5 text-muted-foreground hover:bg-muted sm:col-span-1" title="Limpiar filtros"><X className="size-3.5" /></button>
        )}
        <BranchScopeFilter className="col-span-2 w-full sm:col-span-1 sm:ml-auto sm:w-auto" showLabel={false} />
      </div>

      <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
        <TabsList className={cn(!isSidebarCollapsed && "hidden lg:hidden", "w-full min-w-0 scroll-px-2 h-auto overflow-x-auto rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 to-muted/50 p-1.5 pl-2 pr-2 mb-6 flex flex-nowrap gap-1.5 [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground")}>
          {tabs.map((tab) => {
            if (!hasAccess(tab.module) || !tab.permission.some((module) => canPerform(module, 'view'))) return null;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className={tabTriggerClass}>
                <tab.icon className="size-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4 min-h-[600px] min-w-0">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/60 blur-xl opacity-50 rounded-full" />
                  <div className="relative size-16 border-4 border-muted border-t-primary rounded-full animate-spin" />
                </div>
                <p className="text-sm font-bold text-muted-foreground tracking-wide">Cargando datos financieros...</p>
              </div>
            </div>
          ) : (
            <>
              <TabsContent value="resumen" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <FinanceDashboardView incomes={fIncomes} expenses={fExpenses} recurringExpenses={fRecurringExpenses} recurringIncomes={fRecurringIncomes} onNavigate={(tab) => handleTabChange(tab)} />
                </motion.div>
              </TabsContent>

              <TabsContent value="caja-bancos" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <FinanceCashView />
                </motion.div>
              </TabsContent>

              <TabsContent value="cuentas-cobrar" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <FinanceReceivablesView />
                </motion.div>
              </TabsContent>

              <TabsContent value="cuentas-pagar" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <FinancePayablesView />
                </motion.div>
              </TabsContent>

              <TabsContent value="ingresos" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <FinanceTableView 
                    title="Ingresos"
                    data={groupedIncomeRows.map((i: any) => ({ ...i, isPayment: !['Manual', 'manual', '', null, undefined].includes(i.source) }))}
                    columns={INCOME_COLUMNS}
                    onUpdate={handleUpdateIncome}
                    onAdd={handleAddIncome}
                    onDelete={async (id) => { await incomeService.delete(id); await queryClient.invalidateQueries({ queryKey: ['finance', 'income'] }); toast.success('Ingreso eliminado'); }}
                    loading={loading}
                    canCreate={false}
                    canEdit={false}
                    canDelete={false}
                    canExport={canPerform('FINANCIAL_INCOMES', 'export')}
                    detailsRenderer={renderIncomeDetails}
                    targetItemId={targetFinanceId?.tab === 'ingresos' ? targetFinanceId.id : null}
                    onClearTargetItem={() => setTargetFinanceId(null)}
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="gastos" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <FinanceTableView 
                    title="Gastos"
                    data={fExpenses.map((e: any) => ({ ...e, isPayment: !['Manual', 'manual', '', null, undefined].includes(e.source) }))}
                    columns={EXPENSE_COLUMNS}
                    onUpdate={handleUpdateExpense}
                    onAdd={handleAddExpense}
                    onDelete={async (id) => {
                      const item = fExpenses.find((e: any) => e.id === id);
                      if (item && !['Manual', 'manual', '', null, undefined].includes(item.source)) { toast.error('No se puede eliminar un registro generado automáticamente'); return; }
                      await expensesService.delete(id); await queryClient.invalidateQueries({ queryKey: ['finance', 'expenses'] }); toast.success('Gasto eliminado');
                    }}
                    loading={loading}
                    canCreate={false}
                    canEdit={false}
                    canDelete={false}
                    canExport={canPerform('FINANCIAL_EXPENSES', 'export')}
                    detailsRenderer={renderExpenseDetails}
                    targetItemId={targetFinanceId?.tab === 'gastos' ? targetFinanceId.id : null}
                    onClearTargetItem={() => setTargetFinanceId(null)}
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="recurrentes" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-lg font-black uppercase tracking-tight">Movimientos Recurrentes</h3>
                        <p className="text-xs text-muted-foreground">Plantillas de compromisos programados. No afectan totales hasta generar el movimiento real.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Ingresos Recurrentes ({fRecurringIncomes.length})</p>
                        <FinanceTableView 
                          title=""
                          data={fRecurringIncomes.map((r: any) => ({ ...r, isPayment: true }))}
                          columns={RECURRING_COLUMNS}
                          onUpdate={handleUpdateRecurring}
                          onAdd={() => handleAddRecurring('INCOME')}
                          onDelete={async (id) => { await recurringIncomesService.delete(id); await queryClient.invalidateQueries({ queryKey: ['finance', 'recurring-incomes'] }); toast.success('Eliminado'); }}
                          loading={loading}
                          canCreate={false}
                          canEdit={false}
                          canDelete={false}
                          canExport={canPerform('FINANCIAL_INCOMES_REC', 'export')}
                        />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-2">Gastos Recurrentes ({fRecurringExpenses.length})</p>
                        <FinanceTableView 
                          title=""
                          data={fRecurringExpenses.map((r: any) => ({ ...r, isPayment: true }))}
                          columns={RECURRING_COLUMNS}
                          onUpdate={handleUpdateRecurring}
                          onAdd={() => handleAddRecurring('EXPENSE')}
                          onDelete={async (id) => { await recurringExpensesService.delete(id); await queryClient.invalidateQueries({ queryKey: ['finance', 'recurring-expenses'] }); toast.success('Eliminado'); }}
                          loading={loading}
                          canCreate={false}
                          canEdit={false}
                          canDelete={false}
                          canExport={canPerform('FINANCIAL_EXPENSES_REC', 'export')}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="calendario" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <FinanceCalendarView recurringExpenses={fRecurringExpenses} recurringIncomes={fRecurringIncomes} />
                </motion.div>
              </TabsContent>

              <TabsContent value="analisis" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <FinanceBalanceView incomes={fIncomes} expenses={fExpenses} recurringIncomes={fRecurringIncomes} recurringExpenses={fRecurringExpenses} />
                </motion.div>
              </TabsContent>

              <TabsContent value="balance-general" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <FinanceGeneralBalanceView incomes={fIncomes} expenses={fExpenses} accounts={fAccounts} />
                </motion.div>
              </TabsContent>

              <TabsContent value="perdidas" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <FinanceLossesView />
                </motion.div>
              </TabsContent>
            </>
          )}
        </motion.div>
      </Tabs>
    </div>
  );
}
