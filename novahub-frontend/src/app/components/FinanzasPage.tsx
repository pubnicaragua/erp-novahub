import { cn } from './ui/utils';
import { useState, useEffect, useMemo } from 'react';
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
import { accountsService, incomeService, expensesService, recurringExpensesService, recurringIncomesService } from '../services/finanzas.service';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../contexts/AuthContext';
import { useBranchScope } from '../hooks/useBranchScope';
import { BranchScopeFilter } from './ui/BranchScopeFilter';

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

export function FinanzasPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: FinanzasPageProps) {
  const { user, canPerform } = useAuth();
  const { selectedBranchId, filterByBranch, isRestricted, accessibleBranches } = useBranchScope();
  const { displayCurrency, exchangeRate: globalRate, convertAmount } = useCurrency();

  const hasAccess = (moduleId: string) => {
    if (!user?.enabledModules) return true;
    if (user.enabledModules.includes(moduleId)) return true;
    const hasSpecificSubmodules = user.enabledModules.some(m => m.startsWith('FINANCIAL_'));
    return user.enabledModules.includes('FINANCIAL') && !hasSpecificSubmodules;
  };

  const subModuleToTab: Record<string, string> = { 
    'resumen-financiero': 'resumen',
    'caja-bancos': 'caja-bancos',
    'cuentas-cobrar': 'cuentas-cobrar',
    'cuentas-pagar': 'cuentas-pagar',
    'ingresos': 'ingresos', 
    'egresos': 'gastos', 
    'movimientos-recurrentes': 'recurrentes',
    'calendario-financiero': 'calendario',
    'analisis-ingresos-gastos': 'analisis',
    'balance-general': 'balance-general',
  };
  
  const [activeTab, setActiveTab] = useState(() => activeSubModule ? (subModuleToTab[activeSubModule] || 'resumen') : 'resumen');
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([]);
  const [recurringIncomes, setRecurringIncomes] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePreset, setActivePreset] = useState<string>('');

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

  const fIncomes = filterByDate(filterByBranch(incomes));
  const fExpenses = filterByDate(filterByBranch(expenses));
  const fRecurringExpenses = filterByDate(filterByBranch(recurringExpenses)).filter((r: any) => Number(r.amount) > 0);
  const fRecurringIncomes = filterByDate(filterByBranch(recurringIncomes)).filter((r: any) => Number(r.amount) > 0);
  const fAccounts = filterByDate(filterByBranch(accounts));

  const normalizeListResponse = (response: any) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  };

  const normalizeItemResponse = (response: any) => {
    if (response && typeof response === 'object' && 'data' in response && response.data) {
      return response.data;
    }
    return response;
  };

  const getAccountType = (account: any) => String(account?.type || '').toUpperCase();

  const findAccountByPreferredTypes = (preferredTypes: string[]) => {
    const activeAccounts = accounts.filter((acc) => acc?.isActive !== false);
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
    const existing = findAccountByPreferredTypes(preferredTypes);
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
    setAccounts((prev) => [createdAccount, ...prev]);
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

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const subModule = Object.keys(subModuleToTab).find(key => subModuleToTab[key] === value) || value;
    if (onSubModuleChange) onSubModuleChange(subModule);
  };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [incRes, expRes, rexpRes, accRes, rincRes] = await Promise.allSettled([
        incomeService.getAll(),
        expensesService.getAll(),
        recurringExpensesService.getAll(),
        accountsService.getAll(),
        recurringIncomesService.getAll(),
      ]);

      setIncomes(incRes.status === 'fulfilled' ? normalizeListResponse(incRes.value) : []);
      setExpenses(expRes.status === 'fulfilled' ? normalizeListResponse(expRes.value) : []);
      setRecurringExpenses(rexpRes.status === 'fulfilled' ? normalizeListResponse(rexpRes.value) : []);
      setAccounts(accRes.status === 'fulfilled' ? normalizeListResponse(accRes.value) : []);
      setRecurringIncomes(rincRes.status === 'fulfilled' ? normalizeListResponse(rincRes.value) : []);

      if ([incRes, expRes, rexpRes, accRes].every((res) => res.status === 'rejected')) {
        toast.error('Error al cargar datos financieros');
      }
    } catch (error) {
      console.error('Error fetching finance data:', error);
      toast.error('Error al cargar datos financieros');
    } finally {
      setLoading(false);
    }
  };

  const INCOME_COLUMNS = [
    { key: 'number', label: 'No. Recibo', type: 'text' as const, editable: false },
    { key: 'createdAt', label: 'Fecha Reg.', type: 'datetime' as const, editable: false },
    { key: 'source', label: 'Origen', type: 'source' as const, editable: false },
    { key: 'description', label: 'Descripción', type: 'text' as const, editable: true },
    { key: 'category', label: 'Categoría', type: 'select' as const, editable: true },
    { key: 'amount', label: 'Monto', type: 'currency' as const, editable: true },
    { key: 'notes', label: 'Notas', type: 'text' as const, editable: true },
  ];

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
    setExpenses(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleUpdateIncome = async (id: string, updates: any) => {
    const existing = fIncomes.find((i: any) => i.id === id);
    if (existing && !['Manual', 'manual', '', null, undefined].includes(existing.source)) {
      toast.error('No se puede editar un ingreso generado automáticamente');
      return;
    }
    await incomeService.update(id, updates);
    setIncomes(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleUpdateRecurring = async (id: string, updates: any) => {
    const isIncome = recurringIncomes.some(r => r.id === id);
    if (isIncome) {
      await recurringIncomesService.update(id, updates);
      setRecurringIncomes(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    } else {
      await recurringExpensesService.update(id, updates);
      setRecurringExpenses(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
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
        const res = await recurringIncomesService.create(payload);
        setRecurringIncomes([res, ...recurringIncomes]);
      } else {
        const res = await recurringExpensesService.create(payload);
        setRecurringExpenses([res, ...recurringExpenses]);
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
      const res = await incomeService.create(newItem);
      setIncomes([res, ...incomes]);
      toast.success('Nuevo ingreso añadido');
    } catch (error) { toast.error('Error al crear ingreso'); }
  };

  const handleAddExpense = async () => {
    try {
      const defaultAccount = await ensureDefaultAccount('EXPENSE');
      const newItem = { source: 'Manual', description: 'Nuevo Gasto', category: 'OTROS', amount: 0, date: new Date().toISOString(), accountId: defaultAccount.id, currency: 'NIO' as any, exchangeRate: globalRate, status: 'PENDING' as any, notes: '' };
      const res = await expensesService.create(newItem);
      setExpenses([res, ...expenses]);
      toast.success('Nuevo gasto añadido');
    } catch (error) { toast.error('Error al crear gasto'); }
  };

  const totalIncome = fIncomes.reduce((acc, i) => acc + convertAmount(i.amount || 0, i.currency, i.exchangeRate), 0);
  const totalExpense = fExpenses.reduce((acc, e) => acc + convertAmount(e.amount || 0, e.currency, e.exchangeRate), 0);

  const tabTriggerClass = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all";

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: BarChart3, module: 'FINANCIAL_DASHBOARD' },
    { id: 'caja-bancos', label: 'Caja y Bancos', icon: Landmark, module: 'FINANCIAL_DASHBOARD' },
    { id: 'cuentas-cobrar', label: 'CxC', icon: TrendingUp, module: 'FINANCIAL_INCOMES' },
    { id: 'cuentas-pagar', label: 'CxP', icon: TrendingDown, module: 'FINANCIAL_EXPENSES' },
    { id: 'ingresos', label: 'Ingresos', icon: TrendingUp, module: 'FINANCIAL_INCOMES' },
    { id: 'gastos', label: 'Gastos', icon: Wallet, module: 'FINANCIAL_EXPENSES' },
    { id: 'recurrentes', label: 'Recurrentes', icon: RotateCcw, module: 'FINANCIAL_EXPENSES_REC' },
    { id: 'calendario', label: 'Calendario', icon: CalendarClock, module: 'FINANCIAL_DASHBOARD' },
    { id: 'analisis', label: 'Análisis', icon: BarChart3, module: 'FINANCIAL_BALANCE' },
    { id: 'balance-general', label: 'Balance Gral', icon: Landmark, module: 'FINANCIAL_BALANCE' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-4 p-4 pb-20 sm:p-6 md:p-10">
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
                {totalIncome.toLocaleString()} ingresos · {totalExpense.toLocaleString()} gastos
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border/40 bg-card/50">
        <CalendarDays className="size-4 text-muted-foreground" />
        {PERIOD_PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p.label, p.days)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activePreset === p.label ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>
            {p.label}
          </button>
        ))}
        <div className="h-5 w-px bg-border mx-1" />
        <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActivePreset(''); }} className="h-8 w-36 text-xs" placeholder="Desde" />
        <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActivePreset(''); }} className="h-8 w-36 text-xs" placeholder="Hasta" />
        {(dateFrom || dateTo || activePreset) && (
          <button onClick={clearFilters} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Limpiar filtros"><X className="size-3.5" /></button>
        )}
        <BranchScopeFilter className="ml-auto" showLabel={false} />
      </div>

      <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
        <TabsList className={cn(!isSidebarCollapsed && "hidden lg:hidden", "w-full min-w-0 h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6 [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground")}>
          {tabs.map((tab) => {
            if (!hasAccess(tab.module)) return null;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className={tabTriggerClass}>
                <tab.icon className="size-4" />
                <span>{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4 min-h-[600px]">
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
                  <FinanceDashboardView incomes={fIncomes} expenses={fExpenses} recurringExpenses={fRecurringExpenses} recurringIncomes={fRecurringIncomes} accounts={fAccounts} onNavigate={(tab) => handleTabChange(tab)} />
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
                    subtitle="Datos consolidados de ingresos. Los registros automáticos (Ventas) son solo lectura."
                    data={fIncomes.map((i: any) => ({ ...i, isPayment: !['Manual', 'manual', '', null, undefined].includes(i.source) }))}
                    columns={INCOME_COLUMNS}
                    onUpdate={handleUpdateIncome}
                    onAdd={handleAddIncome}
                    onDelete={async (id) => { await incomeService.delete(id); setIncomes(prev => prev.filter(i => i.id !== id)); toast.success('Ingreso eliminado'); }}
                    loading={loading}
                    canCreate={false}
                    canEdit={canPerform('FINANCIAL_INCOMES', 'edit')}
                    canDelete={false}
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="gastos" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <FinanceTableView 
                    title="Gastos"
                    subtitle="Datos consolidados de egresos. Los registros automáticos (Compras, Nómina) son solo lectura."
                    data={fExpenses.map((e: any) => ({ ...e, isPayment: !['Manual', 'manual', '', null, undefined].includes(e.source) }))}
                    columns={EXPENSE_COLUMNS}
                    onUpdate={handleUpdateExpense}
                    onAdd={handleAddExpense}
                    onDelete={async (id) => {
                      const item = fExpenses.find((e: any) => e.id === id);
                      if (item && !['Manual', 'manual', '', null, undefined].includes(item.source)) { toast.error('No se puede eliminar un registro generado automáticamente'); return; }
                      await expensesService.delete(id); setExpenses(prev => prev.filter(e => e.id !== id)); toast.success('Gasto eliminado');
                    }}
                    loading={loading}
                    canCreate={false}
                    canEdit={canPerform('FINANCIAL_EXPENSES', 'edit')}
                    canDelete={false}
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="recurrentes" className="m-0" asChild>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
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
                          onDelete={async (id) => { await recurringIncomesService.delete(id); setRecurringIncomes(prev => prev.filter(r => r.id !== id)); toast.success('Eliminado'); }}
                          loading={loading}
                          canCreate={false}
                          canEdit={false}
                          canDelete={false}
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
                          onDelete={async (id) => { await recurringExpensesService.delete(id); setRecurringExpenses(prev => prev.filter(r => r.id !== id)); toast.success('Eliminado'); }}
                          loading={loading}
                          canCreate={false}
                          canEdit={false}
                          canDelete={false}
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
            </>
          )}
        </motion.div>
      </Tabs>
    </div>
  );
}
