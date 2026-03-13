import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Wallet, BarChart3, 
  CalendarClock, Plus, Receipt, Landmark, PieChart, ArrowLeftRight,
  ChevronRight, Search, Filter, Download, MoreHorizontal, Share2
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { FinanceDashboardView } from './finanzas/FinanceDashboardView';
import { FinanceTableView } from './finanzas/FinanceTableView';
import { FinanceBalanceView } from './finanzas/FinanceBalanceView';
import { incomeService, expensesService, recurringExpensesService, balanceService } from '../services/finanzas.service';
import { toast } from 'sonner';

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

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Finance Header */}
      <div className="border-b border-border/50 bg-background px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <DollarSign className="size-3" /> Ecosistema Financiero NovaHub
          </div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-3">
            Gestión de Finanzas 
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black tracking-tighter">REVOLUTION</Badge>
          </h1>
        </div>

        <div className="flex items-center gap-2">
           <div className="flex -space-x-2 mr-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="size-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold">
                  U{i}
                </div>
              ))}
              <div className="size-8 rounded-full border-2 border-background bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black">+4</div>
           </div>
           <button className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/20 transition-all">
              <Landmark className="size-4" /> Conciliar Banco
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-6 py-2 border-b border-border/30 bg-background/60 backdrop-blur shrink-0 overflow-x-auto">
            <TabsList className="bg-transparent h-auto p-0 gap-6">
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-1 py-3 text-sm font-bold gap-2">
                <BarChart3 className="size-4" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="ingresos" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-green-500 border-b-2 border-transparent data-[state=active]:border-green-500 rounded-none px-1 py-3 text-sm font-bold gap-2">
                <Receipt className="size-4" /> Ingresos
              </TabsTrigger>
              <TabsTrigger value="gastos" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-red-500 border-b-2 border-transparent data-[state=active]:border-red-500 rounded-none px-1 py-3 text-sm font-bold gap-2">
                <Wallet className="size-4" /> Gastos
              </TabsTrigger>
              <TabsTrigger value="gastos-rec" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-purple-500 border-b-2 border-transparent data-[state=active]:border-purple-500 rounded-none px-1 py-3 text-sm font-bold gap-2">
                <CalendarClock className="size-4" /> Recurrentes
              </TabsTrigger>
              <TabsTrigger value="balance" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-500 border-b-2 border-transparent data-[state=active]:border-blue-500 rounded-none px-1 py-3 text-sm font-bold gap-2">
                <Landmark className="size-4" /> Balance
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            <TabsContent value="dashboard" className="m-0 focus-visible:outline-none">
              <FinanceDashboardView incomes={incomes} expenses={expenses} recurringExpenses={recurringExpenses} />
            </TabsContent>

            <TabsContent value="ingresos" className="m-0 focus-visible:outline-none">
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
            </TabsContent>

            <TabsContent value="gastos" className="m-0 focus-visible:outline-none">
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
            </TabsContent>

            <TabsContent value="gastos-rec" className="m-0 focus-visible:outline-none">
              <FinanceTableView 
                title="Configuración de Gastos Periódicos"
                data={recurringExpenses}
                columns={RECURRING_COLUMNS}
                onUpdate={handleUpdateRecurring}
                onAdd={handleAddRecurring}
                onDelete={async (id) => {
                   // Add delete for recurring if service supports it
                   toast.info('Función de eliminación en desarrollo');
                }}
                loading={loading}
              />
            </TabsContent>

            <TabsContent value="balance" className="m-0 focus-visible:outline-none">
              <FinanceBalanceView />
            </TabsContent>
          </div>
        </Tabs>
      </div>
      
      {/* Quick Action Bar (Bottom) */}
      <div className="h-14 border-t border-border/50 bg-background/80 backdrop-blur px-6 flex items-center justify-between shrink-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#05602b]">
            Intelligente • Premium • Scalable
          </p>
        <div className="flex items-center gap-4">
           <button className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <Download className="size-3.5" /> Descargar CSV
           </button>
           <button className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              <Share2 className="size-3.5" /> Compartir Informe
           </button>
        </div>
      </div>
    </div>
  );
}