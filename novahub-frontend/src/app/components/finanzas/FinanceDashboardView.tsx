import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownRight, Download } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie
} from 'recharts';
import { useCurrency } from '../../contexts/CurrencyContext';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface FinanceDashboardViewProps {
  incomes: any[];
  expenses: any[];
  recurringExpenses: any[];
}

export function FinanceDashboardView({ incomes, expenses, recurringExpenses }: FinanceDashboardViewProps) {
  const { displayCurrency, convertAmount, formatConvertedAmount } = useCurrency();
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';

  // Calculations from real data
  const totalIncomes = incomes.reduce(
    (acc, i) => acc + convertAmount(i.amount || 0, i.currency, i.exchangeRate),
    0,
  );
  const totalExpenses = expenses.reduce(
    (acc, e) => acc + convertAmount(e.amount || 0, e.currency, e.exchangeRate),
    0,
  );
  const totalRecurring = recurringExpenses.reduce(
    (acc, r) => acc + convertAmount(r.amount || 0, r.currency, r.exchangeRate),
    0,
  );
  const netUtility = totalIncomes - totalExpenses;
  const margin = totalIncomes > 0 ? ((netUtility / totalIncomes) * 100).toFixed(1) : '0';
  
  // Aggregate expenses by category for pie chart
  const expenseByCategory = expenses.reduce((acc: Record<string, number>, curr) => {
    const cat = curr.category || 'Otros';
    acc[cat] = (acc[cat] || 0) + convertAmount(curr.amount || 0, curr.currency, curr.exchangeRate);
    return acc;
  }, {});

  const pieData = Object.keys(expenseByCategory).map(key => ({
    name: key,
    value: expenseByCategory[key]
  }));

  // If no expense data, show placeholder
  if (pieData.length === 0) {
    pieData.push({ name: 'Sin gastos', value: 1 });
  }

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

  // Monthly data grouped from real incomes/expenses
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const currentMonth = new Date().getMonth();
  
  // Get last 6 months of data
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const monthIdx = (currentMonth - i + 12) % 12;
    const monthIncomes = incomes.filter(inc => new Date(inc.date).getMonth() === monthIdx);
    const monthExpenses = expenses.filter(exp => new Date(exp.date).getMonth() === monthIdx);
    
    monthlyData.push({
      mes: monthNames[monthIdx],
      ingresos: monthIncomes.reduce((acc, i) => acc + convertAmount(i.amount || 0, i.currency, i.exchangeRate), 0),
      gastos: monthExpenses.reduce((acc, e) => acc + convertAmount(e.amount || 0, e.currency, e.exchangeRate), 0)
    });
  }

  const handleExportReport = () => {
    const csvContent = [
      ['Métrica', 'Valor'].join(','),
      ['Total Ingresos', totalIncomes].join(','),
      ['Total Gastos', totalExpenses].join(','),
      ['Utilidad Neta', netUtility].join(','),
      ['Margen %', margin].join(','),
      ['Gastos Recurrentes Mensuales', totalRecurring].join(','),
      [''],
      ['--- Detalle Ingresos ---', ''].join(','),
      ...incomes.map(i => [i.source || i.description || 'Ingreso', i.amount].join(',')),
      [''],
      ['--- Detalle Gastos ---', ''].join(','),
      ...expenses.map(e => [e.description || 'Gasto', e.amount].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dashboard_financiero_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Reporte del dashboard exportado');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Panel de Control Financiero</h2>
          <p className="text-sm text-muted-foreground">
            {incomes.length} ingresos · {expenses.length} gastos · {recurringExpenses.length} recurrentes
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={handleExportReport}>
          <Download className="size-4 mr-2" /> Exportar Dashboard
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="size-4 text-green-500" /> Ingresos Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{formatConvertedAmount(totalIncomes, displayCurrency)}</div>
            <div className="flex items-center gap-1 mt-1 font-medium">
              <ArrowUpRight className="size-3 text-green-500" />
              <span className="text-xs text-green-500">{incomes.length} transacciones</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="size-4 text-red-500" /> Gastos Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{formatConvertedAmount(totalExpenses, displayCurrency)}</div>
            <div className="flex items-center gap-1 mt-1 font-medium">
              <ArrowDownRight className="size-3 text-red-500" />
              <span className="text-xs text-red-500">{expenses.length} transacciones</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="size-4 text-emerald-500" /> Utilidad Neta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netUtility >= 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
              {formatConvertedAmount(netUtility, displayCurrency)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Margen: {margin}%</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="size-4 text-purple-500" /> Gastos Recurrentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{formatConvertedAmount(totalRecurring, displayCurrency)}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium italic">{recurringExpenses.length} compromisos activos</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Ingresos vs Gastos (Últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full pt-4">
              {monthlyData.some(d => d.ingresos > 0 || d.gastos > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(v) => `${currencySymbol}${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(value: number) => [`${currencySymbol}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, '']}
                    />
                    <Legend iconType="circle" />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="size-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Sin datos suficientes para mostrar gráfico</p>
                    <p className="text-xs">Agrega ingresos y gastos para ver el análisis</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Distribución de Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {expenses.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(value: number) => [`${currencySymbol}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <TrendingDown className="size-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Sin gastos registrados</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Promedio Ingreso</p>
              <p className="text-lg font-bold">{formatConvertedAmount(incomes.length > 0 ? totalIncomes / incomes.length : 0, displayCurrency)}</p>
            </div>
            <div className="rounded-full bg-green-500/10 p-2">
              <TrendingUp className="size-4 text-green-500" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Promedio Gasto</p>
              <p className="text-lg font-bold">{formatConvertedAmount(expenses.length > 0 ? totalExpenses / expenses.length : 0, displayCurrency)}</p>
            </div>
            <div className="rounded-full bg-red-500/10 p-2">
              <TrendingDown className="size-4 text-red-500" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Ratio Ahorro</p>
              <p className="text-lg font-bold">{totalIncomes > 0 ? ((netUtility / totalIncomes) * 100).toFixed(1) : 0}%</p>
            </div>
            <div className="rounded-full bg-emerald-500/10 p-2">
              <Wallet className="size-4 text-emerald-500" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
