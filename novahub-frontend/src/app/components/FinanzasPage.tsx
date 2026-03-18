import { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, BarChart3, 
  CalendarClock, Landmark, Download
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { FinanceDashboardView } from './finanzas/FinanceDashboardView';
import { FinanceTableView } from './finanzas/FinanceTableView';
import { FinanceBalanceView } from './finanzas/FinanceBalanceView';
import { incomeService, expensesService, recurringExpensesService } from '../services/finanzas.service';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface FinanzasPageProps {
  activeSubModule?: string;
}

export function FinanzasPage({ activeSubModule }: FinanzasPageProps) {
  const tabMap: Record<string, string> = { 
    'ingresos': 'ingresos', 
    'egresos': 'gastos', 
    'gastos-recurrentes': 'gastos-rec', 
    'balance': 'balance' 
  };
  
  const [activeTab, setActiveTab] = useState(() => activeSubModule ? (tabMap[activeSubModule] || 'dashboard') : 'dashboard');
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeSubModule) {
      setActiveTab(tabMap[activeSubModule] || 'dashboard');
    }
  }, [activeSubModule]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [incRes, expRes, rexpRes] = await Promise.all([
        incomeService.getAll(),
        expensesService.getAll(),
        recurringExpensesService.getAll()
      ]);
      setIncomes(Array.isArray(incRes) ? incRes : (incRes as any)?.data || []);
      setExpenses(Array.isArray(expRes) ? expRes : (expRes as any)?.data || []);
      setRecurringExpenses(Array.isArray(rexpRes) ? rexpRes : (rexpRes as any)?.data || []);
    } catch (error) {
      console.error('Error fetching finance data:', error);
      toast.error('Error al cargar datos financieros');
    } finally {
      setLoading(false);
    }
  };

  const INCOME_COLUMNS = [
    { key: 'number', label: 'No. Recibo', type: 'text' as const, editable: false },
    { key: 'source', label: 'Origen / Cliente', type: 'text' as const, editable: true },
    { key: 'amount', label: 'Monto', type: 'currency' as const, editable: true },
    { key: 'date', label: 'Fecha', type: 'date' as const, editable: true },
    { key: 'notes', label: 'Notas', type: 'text' as const, editable: true },
  ];

  const EXPENSE_COLUMNS = [
    { key: 'number', label: 'No. Gasto', type: 'text' as const, editable: false },
    { key: 'description', label: 'Descripción', type: 'text' as const, editable: true },
    { key: 'category', label: 'Categoría', type: 'select' as const, editable: true },
    { key: 'amount', label: 'Monto', type: 'currency' as const, editable: true },
    { key: 'date', label: 'Fecha', type: 'date' as const, editable: true },
  ];

  const RECURRING_COLUMNS = [
    { key: 'description', label: 'Descripción', type: 'text' as const, editable: true },
    { key: 'frequency', label: 'Frecuencia', type: 'select' as const, editable: true },
    { key: 'amount', label: 'Monto', type: 'currency' as const, editable: true },
    { key: 'category', label: 'Categoría', type: 'select' as const, editable: true },
    { key: 'status', label: 'Estado', type: 'select' as const, editable: true },
  ];

  const handleUpdateIncome = async (id: string, updates: any) => {
    await incomeService.update(id, updates);
    setIncomes(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleUpdateExpense = async (id: string, updates: any) => {
    await expensesService.update(id, updates);
    setExpenses(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleUpdateRecurring = async (id: string, updates: any) => {
    await recurringExpensesService.update(id, updates);
    setRecurringExpenses(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleAddIncome = async () => {
    try {
      const newItem = {
        description: 'Nuevo Ingreso',
        amount: 0,
        date: new Date().toISOString(),
        accountId: 'acc-inc-001'
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
      const newItem = {
        description: 'Nuevo Gasto',
        category: 'Otros',
        amount: 0,
        date: new Date().toISOString(),
        accountId: 'acc-exp-001'
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
      const newItem = {
        description: 'Nuevo Gasto Recurrente',
        frequency: 'monthly' as const,
        amount: 0,
        startDate: new Date().toISOString(),
        accountId: 'acc-exp-001',
        status: 'active' as const,
        category: 'Otros'
      };
      const res = await recurringExpensesService.create(newItem);
      setRecurringExpenses([res, ...recurringExpenses]);
      toast.success('Nueva fila de gasto recurrente añadida');
    } catch (error) {
      toast.error('Error al crear gasto recurrente');
    }
  };

  const totalIncome = incomes.reduce((acc, i) => acc + Number(i.amount || 0), 0);
  const totalExpense = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

  return (
    <div className="space-y-4 p-4 md:p-6 pb-20 max-w-[1800px] mx-auto">
      {/* Header - Inventario Style */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 rounded-xl">
            <DollarSign className="size-9 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
              Finanzas <span className="text-emerald-500">Empresariales</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                {incomes.length} ingresos · {expenses.length} gastos · Balance: ${(totalIncome - totalExpense).toLocaleString()}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="rounded-xl font-bold"
            onClick={() => {
              const csvContent = [
                ['Tipo', 'Descripción', 'Monto', 'Fecha'].join(','),
                ...incomes.map(i => ['Ingreso', i.description || i.source || '', i.amount, i.date].join(',')),
                ...expenses.map(e => ['Gasto', e.description || '', e.amount, e.date].join(','))
              ].join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `finanzas_${new Date().toISOString().split('T')[0]}.csv`;
              link.click();
              toast.success('Reporte financiero exportado');
            }}
          >
            <Download className="size-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Main Navigation Tabs - Inventario Style */}
      <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
        <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex flex-wrap gap-1.5 rounded-2xl border border-border/40">
          <TabsTrigger value="dashboard" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
              data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-700
              data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">
            <BarChart3 className="size-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="ingresos" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
              data-[state=active]:bg-gradient-to-br data-[state=active]:from-green-600 data-[state=active]:to-green-700
              data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">
            <TrendingUp className="size-4" />
            <span className="hidden sm:inline">Ingresos</span>
          </TabsTrigger>
          <TabsTrigger value="gastos" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
              data-[state=active]:bg-gradient-to-br data-[state=active]:from-red-600 data-[state=active]:to-red-700
              data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">
            <TrendingDown className="size-4" />
            <span className="hidden sm:inline">Gastos</span>
          </TabsTrigger>
          <TabsTrigger value="gastos-rec" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
              data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-600 data-[state=active]:to-purple-700
              data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">
            <CalendarClock className="size-4" />
            <span className="hidden sm:inline">Recurrentes</span>
          </TabsTrigger>
          <TabsTrigger value="balance" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
              data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-600 data-[state=active]:to-blue-700
              data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">
            <Landmark className="size-4" />
            <span className="hidden sm:inline">Balance</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 min-h-[600px]">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="size-10 border-4 border-muted border-t-emerald-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <TabsContent value="dashboard" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <FinanceDashboardView incomes={incomes} expenses={expenses} recurringExpenses={recurringExpenses} />
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
                      await expensesService.delete(id);
                      setExpenses(prev => prev.filter(e => e.id !== id));
                      toast.success('Gasto eliminado');
                    }}
                    loading={loading}
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
                  />
                </motion.div>
              </TabsContent>

              <TabsContent value="balance" className="m-0" asChild>
                <motion.div 
                  initial={{ opacity: 0, y: 16 }} 
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <FinanceBalanceView />
                </motion.div>
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>
    </div>
  );
}