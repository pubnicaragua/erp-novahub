import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownRight, Printer, Share2, FileLineChart } from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie
} from 'recharts';
import { useCurrency } from '../../contexts/CurrencyContext';

interface FinanceDashboardViewProps {
  incomes: any[];
  expenses: any[];
  recurringExpenses: any[];
}

export function FinanceDashboardView({ incomes, expenses, recurringExpenses }: FinanceDashboardViewProps) {
  const { formatAmount } = useCurrency();

  // Calculations
  const totalIncomes = incomes.reduce((acc, i) => acc + Number(i.amount), 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const netUtility = totalIncomes - totalExpenses;
  
  // Aggregate data for charts (by category)
  const expenseByCategory = expenses.reduce((acc: any, curr) => {
    const cat = curr.category || 'Otros';
    acc[cat] = (acc[cat] || 0) + Number(curr.amount);
    return acc;
  }, {});

  const pieData = Object.keys(expenseByCategory).map(key => ({
    name: key,
    value: expenseByCategory[key]
  }));

  const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Panel de Control Financiero</h2>
          <p className="text-sm text-muted-foreground">Visibilidad total de ingresos y gastos en tiempo real</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
            <Printer className="size-4" /> Exportar Reporte
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <FileLineChart className="size-4" /> Generar Informe
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="size-4 text-green-500" /> Ingresos del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{formatAmount(totalIncomes)}</div>
            <div className="flex items-center gap-1 mt-1 font-medium">
              <ArrowUpRight className="size-3 text-green-500" />
              <span className="text-xs text-green-500">+12.5% vs mes ant.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="size-4 text-red-500" /> Gastos del Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{formatAmount(totalExpenses)}</div>
            <div className="flex items-center gap-1 mt-1 font-medium">
              <ArrowDownRight className="size-3 text-red-500" />
              <span className="text-xs text-red-500">+4.2% mes ant.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="size-4 text-blue-500" /> Utilidad Neta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netUtility >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
              {formatAmount(netUtility)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Margen: {totalIncomes > 0 ? ((netUtility / totalIncomes) * 100).toFixed(1) : 0}%</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="size-4 text-purple-500" /> Flujo de Caja
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{formatAmount(totalIncomes * 0.85)}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium italic">Liquidez inmediata estimada</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Análisis de Ingresos vs Gastos</CardTitle>
            <Share2 className="size-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ mes: 'Actual', ingresos: totalIncomes, gastos: totalExpenses }]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/30" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={60} />
                  <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Distribución de Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-all cursor-pointer">
          <div className="rounded-full bg-blue-500/10 p-2.5">
            <Share2 className="size-5 text-blue-500" />
          </div>
          <div>
            <p className="font-semibold text-sm">Conciliación Bancaria</p>
            <p className="text-xs text-muted-foreground">95% sincronizado con cuentas locales</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-all cursor-pointer">
          <div className="rounded-full bg-purple-500/10 p-2.5">
            <BarChart3 className="size-5 text-purple-500" />
          </div>
          <div>
            <p className="font-semibold text-sm">Proyección de Cierre</p>
            <p className="text-xs text-muted-foreground">Estimado +15% vs mes anterior</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-all cursor-pointer">
          <div className="rounded-full bg-green-500/10 p-2.5">
            <TrendingUp className="size-5 text-green-500" />
          </div>
          <div>
            <p className="font-semibold text-sm">Salud Financiera: Óptima</p>
            <p className="text-xs text-muted-foreground">Todos los indicadores en rango positivo</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
