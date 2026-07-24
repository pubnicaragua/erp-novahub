import { cn } from './ui/utils';
import { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, BarChart3, 
  CalendarClock, Landmark, RotateCcw
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { FinanceDashboardView } from './finanzas/FinanceDashboardView';
import { FinanceTableView } from './finanzas/FinanceTableView';
import { FinanceBalanceView } from './finanzas/FinanceBalanceView';
import { accountsService, incomeService, expensesService, recurringExpensesService, recurringIncomesService } from '../services/finanzas.service';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { useCurrency } from '../contexts/CurrencyContext';
import { useAuth } from '../contexts/AuthContext';

interface FinanzasPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (subModule?: string) => void;
}

export function FinanzasPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: FinanzasPageProps) {
  const { user, canPerform } = useAuth();
  const { displayCurrency, exchangeRate: globalRate, convertAmount } = useCurrency();

  const hasAccess = (moduleId: string) => {
    if (!user?.enabledModules) return true;
    if (user.enabledModules.includes(moduleId)) return true;
    const hasSpecificSubmodules = user.enabledModules.some(m => m.startsWith('FINANCIAL_'));
    return user.enabledModules.includes('FINANCIAL') && !hasSpecificSubmodules;
  };

  // Map sidebar submodule IDs to tab values
  const subModuleToTab: Record<string, string> = { 
    'dashboard-fin': 'dashboard',
    'ingresos': 'ingresos', 
    'egresos': 'gastos', 
    'gastos-recurrentes-fin': 'gastos-rec', 
    'gastos-recurrentes': 'gastos-rec', 
    'ingresos-recurrentes': 'ingresos-rec',
    'balance': 'balance' 
  };
  
  const [activeTab, setActiveTab] = useState(() => activeSubModule ? (subModuleToTab[activeSubModule] || 'dashboard') : 'dashboard');
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([]);
  const [recurringIncomes, setRecurringIncomes] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      type: accountKind.toLowerCase() as any,
    };

    const createdResponse = await accountsService.create(payload);
    const createdAccount = normalizeItemResponse(createdResponse);

    if (!createdAccount?.id) {
      throw new Error('No se pudo crear una cuenta contable por defecto');
    }

    setAccounts((prev) => [createdAccount, ...prev]);
    toast.success(
      accountKind === 'INCOME'
        ? 'Se creó una cuenta de ingresos por defecto'
        : 'Se creó una cuenta de gastos por defecto',
    );

    return createdAccount;
  };

  // Sync tab when activeSubModule changes from sidebar
  useEffect(() => {
    if (activeSubModule && subModuleToTab[activeSubModule]) {
      if (activeTab !== subModuleToTab[activeSubModule]) {
        setActiveTab(subModuleToTab[activeSubModule]);
      }
    }
  }, [activeSubModule, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Find the reverse mapping to update sidebar
    const subModule = Object.keys(subModuleToTab).find(key => subModuleToTab[key] === value) || value;
    if (onSubModuleChange) {
      onSubModuleChange(subModule);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

      const incomesData = incRes.status === 'fulfilled' ? normalizeListResponse(incRes.value) : [];
      const expensesData = expRes.status === 'fulfilled' ? normalizeListResponse(expRes.value) : [];
      const recurringData = rexpRes.status === 'fulfilled' ? normalizeListResponse(rexpRes.value) : [];
      const accountsData = accRes.status === 'fulfilled' ? normalizeListResponse(accRes.value) : [];
      const recurringIncomesData = rincRes.status === 'fulfilled' ? normalizeListResponse(rincRes.value) : [];

      setIncomes(incomesData);
      setExpenses(expensesData);
      setRecurringExpenses(recurringData);
      setAccounts(accountsData);
      setRecurringIncomes(recurringIncomesData);

      if ([incRes, expRes, rexpRes, accRes].every((res) => res.status === 'rejected')) {
        toast.error('Error al cargar datos financieros');
      }

      if (incRes.status === 'rejected') console.error('Error fetching income:', incRes.reason);
      if (expRes.status === 'rejected') console.error('Error fetching expenses:', expRes.reason);
      if (rexpRes.status === 'rejected') console.error('Error fetching recurring expenses:', rexpRes.reason);
      if (accRes.status === 'rejected') console.error('Error fetching accounts:', accRes.reason);
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
    { key: 'source', label: 'Origen', type: 'text' as const, editable: true },
    { key: 'description', label: 'Descripción', type: 'text' as const, editable: true },
    { key: 'category', label: 'Categoría', type: 'select' as const, editable: true },
    { key: 'amount', label: 'Monto', type: 'currency' as const, editable: true },
    { key: 'notes', label: 'Notas', type: 'text' as const, editable: true },
  ];

  const EXPENSE_COLUMNS = [
    { key: 'number', label: 'No. Gasto', type: 'text' as const, editable: false },
    { key: 'createdAt', label: 'Fecha Reg.', type: 'datetime' as const, editable: false },
    { key: 'source', label: 'Origen', type: 'text' as const, editable: true },
    { key: 'description', label: 'Descripción', type: 'text' as const, editable: true },
    { key: 'category', label: 'Categoría', type: 'select' as const, editable: true },
    { key: 'amount', label: 'Monto', type: 'currency' as const, editable: true },
    { key: 'notes', label: 'Notas', type: 'text' as const, editable: true },
  ];

  const RECURRING_COLUMNS = [
    { key: 'createdAt', label: 'fecha registro', type: 'datetime' as const, editable: false },
    { key: 'source', label: 'origen', type: 'text' as const, editable: true },
    { key: 'description', label: 'descripcion', type: 'text' as const, editable: true },
    { key: 'frequency', label: 'frecuencia', type: 'select' as const, editable: true, options: [
      { value: 'DAILY', label: 'Diario' }, { value: 'WEEKLY', label: 'Semanal' }, { value: 'BIWEEKLY', label: 'Quincenal' },
      { value: 'MONTHLY', label: 'Mensual' }, { value: 'QUARTERLY', label: 'Trimestral' }, { value: 'SEMIANNUAL', label: 'Semestral' }, { value: 'YEARLY', label: 'Anual' },
    ] },
    { key: 'amount', label: 'monto', type: 'currency' as const, editable: true },
    { key: 'category', label: 'categoria', type: 'select' as const, editable: true },
    { key: 'status', label: 'estado', type: 'select' as const, editable: true, options: [
      { value: 'ACTIVE', label: 'Activo' }, { value: 'PAUSED', label: 'Inactivo' },
    ] },
  ];

  const RECURRING_INCOME_COLUMNS = [
    { key: 'createdAt', label: 'fecha registro', type: 'datetime' as const, editable: false },
    { key: 'source', label: 'origen', type: 'text' as const, editable: true },
    { key: 'description', label: 'descripcion', type: 'text' as const, editable: true },
    { key: 'frequency', label: 'frecuencia', type: 'select' as const, editable: true, options: [
      { value: 'DAILY', label: 'Diario' }, { value: 'WEEKLY', label: 'Semanal' }, { value: 'BIWEEKLY', label: 'Quincenal' },
      { value: 'MONTHLY', label: 'Mensual' }, { value: 'QUARTERLY', label: 'Trimestral' }, { value: 'SEMIANNUAL', label: 'Semestral' }, { value: 'YEARLY', label: 'Anual' },
    ] },
    { key: 'amount', label: 'monto', type: 'currency' as const, editable: true },
    { key: 'category', label: 'categoria', type: 'select' as const, editable: true },
    { key: 'status', label: 'estado', type: 'select' as const, editable: true, options: [
      { value: 'ACTIVE', label: 'Activo' }, { value: 'PAUSED', label: 'Inactivo' },
    ] },
  ];

  const handleUpdateIncome = async (id: string, updates: any) => {
    await incomeService.update(id, updates);
    setIncomes(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleUpdateExpense = async (id: string, updates: any) => {
    if (id.startsWith('pm-')) {
      toast.error('Los pagos de facturas deben gestionarse desde el módulo de Compras');
      return;
    }
    await expensesService.update(id, updates);
    setExpenses(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleUpdateRecurring = async (id: string, updates: any) => {
    await recurringExpensesService.update(id, updates);
    setRecurringExpenses(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleUpdateRecurringIncome = async (id: string, updates: any) => {
    await recurringIncomesService.update(id, updates);
    setRecurringIncomes(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleAddIncome = async () => {
    try {
      const defaultAccount = await ensureDefaultAccount('INCOME');

      const newItem = {
        source: 'Nuevo Ingreso',
        description: '',
        amount: 0,
        date: new Date().toISOString(),
        accountId: defaultAccount.id,
        category: 'OTROS',
        currency: 'NIO' as any,
        exchangeRate: globalRate,
        notes: '',
      };
      const res = await incomeService.create(newItem);
      setIncomes([res, ...incomes]);
      toast.success('Nueva fila de ingreso añadida');
    } catch (error) {
      toast.error('Error al crear ingreso');
    }
  };

  const handleAddExpense = async () => {
    try {
      const defaultAccount = await ensureDefaultAccount('EXPENSE');

      const newItem = {
        source: 'Manual',
        description: 'Nuevo Gasto',
        category: 'OTROS',
        amount: 0,
        date: new Date().toISOString(),
        accountId: defaultAccount.id,
        currency: 'NIO' as any,
        exchangeRate: globalRate,
        status: 'PENDING' as any,
        notes: '',
      };
      const res = await expensesService.create(newItem);
      setExpenses([res, ...expenses]);
      toast.success('Nueva fila de gasto añadida');
    } catch (error) {
      toast.error('Error al crear gasto');
    }
  };

  const handleAddRecurring = async () => {
    try {
      const defaultAccount = await ensureDefaultAccount('EXPENSE');

      const newItem = {
        description: 'Nuevo Gasto Recurrente',
        source: 'Manual',
        frequency: 'monthly' as const,
        amount: 0,
        startDate: new Date().toISOString(),
        accountId: defaultAccount.id,
        status: 'active' as const,
        category: 'OTROS',
        currency: 'NIO' as any,
        exchangeRate: globalRate,
      };
      const res = await recurringExpensesService.create(newItem);
      setRecurringExpenses([res, ...recurringExpenses]);
      // Also refresh expenses since createRecurringExpense auto-generates first expense
      try {
        const expRes = await expensesService.getAll();
        setExpenses(normalizeListResponse(expRes));
      } catch {}
      toast.success('Nuevo gasto recurrente añadido (primer gasto generado automáticamente)');
    } catch (error) {
      toast.error('Error al crear gasto recurrente');
    }
  };

  const handleAddRecurringIncome = async () => {
    try {
      const defaultAccount = await ensureDefaultAccount('INCOME');

      const newItem = {
        source: 'Nuevo Ingreso Recurrente',
        description: '',
        frequency: 'monthly' as const,
        amount: 0,
        startDate: new Date().toISOString(),
        accountId: defaultAccount.id,
        status: 'active' as const,
        category: 'OTROS',
        currency: 'NIO' as any,
        exchangeRate: globalRate,
      };
      const res = await recurringIncomesService.create(newItem);
      setRecurringIncomes([res, ...recurringIncomes]);
      // Also refresh incomes since createRecurringIncome auto-generates first income
      try {
        const incRes = await incomeService.getAll();
        setIncomes(normalizeListResponse(incRes));
      } catch {}
      toast.success('Nuevo ingreso recurrente añadido (primer ingreso generado automáticamente)');
    } catch (error) {
      toast.error('Error al crear ingreso recurrente');
    }
  };

  const totalIncome = incomes.reduce((acc, i) => acc + convertAmount(i.amount || 0, i.currency, i.exchangeRate), 0);
  const totalExpense = expenses.reduce((acc, e) => acc + convertAmount(e.amount || 0, e.currency, e.exchangeRate), 0);
  const balanceSymbol = displayCurrency === 'USD' ? '$' : 'C$';

  // Shared tab trigger class matching RH pattern — uses primary theme color
  const tabTriggerClass = "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all";

  return (
    <div className="space-y-4 p-4 md:p-6 pb-20 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl">
            <DollarSign className="size-9 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
              Finanzas <span className="text-primary">Empresariales</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                {incomes.length} ingresos · {expenses.length} gastos · Balance: {balanceSymbol}{(totalIncome - totalExpense).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs — matches RH pattern with primary theme colors */}
      <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
        <TabsList className={cn(!isSidebarCollapsed && "hidden lg:hidden", "w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6 custom-scrollbar")}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3, module: 'FINANCIAL_DASHBOARD' },
            { id: 'ingresos', label: 'Ingresos', icon: TrendingUp, module: 'FINANCIAL_INCOMES' },
            { id: 'gastos', label: 'Gastos', icon: TrendingDown, module: 'FINANCIAL_EXPENSES' },
            { id: 'gastos-rec', label: 'Gastos Rec.', icon: CalendarClock, module: 'FINANCIAL_EXPENSES_REC' },
            { id: 'ingresos-rec', label: 'Ingresos Rec.', icon: RotateCcw, module: 'FINANCIAL_INCOMES_REC' },
            { id: 'balance', label: 'Balance', icon: Landmark, module: 'FINANCIAL_BALANCE' }
          ].map((tab) => {
            if (!hasAccess(tab.module)) return null;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className={tabTriggerClass}>
                <tab.icon className="size-4" />
                <span>{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-4 min-h-[600px]"
        >
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
              <TabsContent value="dashboard" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <FinanceDashboardView incomes={incomes} expenses={expenses} recurringExpenses={recurringExpenses} recurringIncomes={recurringIncomes} accounts={accounts} />
                </motion.div>
              </TabsContent>

              <TabsContent value="ingresos" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <FinanceTableView 
                    title="Libro de Ingresos Directos"
                    data={incomes}
                    columns={INCOME_COLUMNS}
                    onUpdate={handleUpdateIncome}
                    onAdd={handleAddIncome}
                    onDelete={async (id) => {
                      await incomeService.delete(id);
                      setIncomes(prev => prev.filter(i => i.id !== id));
                      toast.success('Ingreso eliminado');
                    }}
                    loading={loading}
                    canCreate={canPerform('FINANCIAL_INCOMES', 'create')}
                    canEdit={canPerform('FINANCIAL_INCOMES', 'edit')}
                    canDelete={canPerform('FINANCIAL_INCOMES', 'delete')}
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="gastos" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <FinanceTableView 
                    title="Control de Egresos Operativos"
                    data={expenses}
                    columns={EXPENSE_COLUMNS}
                    onUpdate={handleUpdateExpense}
                    onAdd={handleAddExpense}
                    onDelete={async (id) => {
                      if (id.startsWith('pm-')) {
                        toast.error('Los pagos de facturas no pueden eliminarse desde aquí. Use el módulo de Compras.');
                        return;
                      }
                      await expensesService.delete(id);
                      setExpenses(prev => prev.filter(e => e.id !== id));
                      toast.success('Gasto eliminado');
                    }}
                    loading={loading}
                    canCreate={canPerform('FINANCIAL_EXPENSES', 'create')}
                    canEdit={canPerform('FINANCIAL_EXPENSES', 'edit')}
                    canDelete={canPerform('FINANCIAL_EXPENSES', 'delete')}
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="gastos-rec" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <FinanceTableView 
                    title="Configuración de Gastos Periódicos"
                    data={recurringExpenses}
                    columns={RECURRING_COLUMNS}
                    onUpdate={handleUpdateRecurring}
                    onAdd={handleAddRecurring}
                    onDelete={async (id) => {
                      await recurringExpensesService.delete(id);
                      setRecurringExpenses(prev => prev.filter(r => r.id !== id));
                      toast.success('Gasto recurrente eliminado');
                    }}
                    loading={loading}
                    canCreate={canPerform('FINANCIAL_EXPENSES_REC', 'create')}
                    canEdit={canPerform('FINANCIAL_EXPENSES_REC', 'edit')}
                    canDelete={canPerform('FINANCIAL_EXPENSES_REC', 'delete')}
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="ingresos-rec" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <FinanceTableView 
                    title="Configuración de Ingresos Recurrentes"
                    data={recurringIncomes}
                    columns={RECURRING_INCOME_COLUMNS}
                    onUpdate={handleUpdateRecurringIncome}
                    onAdd={handleAddRecurringIncome}
                    onDelete={async (id) => {
                      await recurringIncomesService.delete(id);
                      setRecurringIncomes(prev => prev.filter(r => r.id !== id));
                      toast.success('Ingreso recurrente eliminado');
                    }}
                    loading={loading}
                    canCreate={canPerform('FINANCIAL_INCOMES_REC', 'create')}
                    canEdit={canPerform('FINANCIAL_INCOMES_REC', 'edit')}
                    canDelete={canPerform('FINANCIAL_INCOMES_REC', 'delete')}
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="balance" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <FinanceBalanceView incomes={incomes} expenses={expenses} recurringIncomes={recurringIncomes} recurringExpenses={recurringExpenses} />
                </motion.div>
              </TabsContent>
            </>
          )}
        </motion.div>
      </Tabs>
    </div>
  );
}
