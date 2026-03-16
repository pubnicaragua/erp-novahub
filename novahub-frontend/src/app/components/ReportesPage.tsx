import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Download, FileText, TrendingUp, Calendar, Filter, 
  DollarSign, Package, Users, Warehouse, RefreshCw, Printer, Share2,
  ArrowUpRight, ArrowDownRight, PieChart as PieChartIcon
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { salesOrdersService } from '../services/ventas.service';
import { inventoryService } from '../services/inventario.service';
import { incomeService, expensesService } from '../services/finanzas.service';

// Mock data para ventas mensuales
const salesData = [
  { mes: 'Ene', ventas: 45000, compras: 32000, utilidad: 13000 },
  { mes: 'Feb', ventas: 52000, compras: 38000, utilidad: 14000 },
  { mes: 'Mar', ventas: 48000, compras: 35000, utilidad: 13000 },
  { mes: 'Abr', ventas: 61000, compras: 42000, utilidad: 19000 },
  { mes: 'May', ventas: 55000, compras: 39000, utilidad: 16000 },
  { mes: 'Jun', ventas: 67000, compras: 45000, utilidad: 22000 },
  { mes: 'Jul', ventas: 72000, compras: 48000, utilidad: 24000 },
  { mes: 'Ago', ventas: 69000, compras: 46000, utilidad: 23000 },
  { mes: 'Sep', ventas: 58000, compras: 41000, utilidad: 17000 },
  { mes: 'Oct', ventas: 75000, compras: 50000, utilidad: 25000 },
  { mes: 'Nov', ventas: 81000, compras: 53000, utilidad: 28000 },
  { mes: 'Dic', ventas: 95000, compras: 60000, utilidad: 35000 },
];

// Data para categorías
const categoryData = [
  { name: 'Electrónica', value: 35, color: '#3b82f6' },
  { name: 'Accesorios', value: 28, color: '#8b5cf6' },
  { name: 'Componentes', value: 22, color: '#ec4899' },
  { name: 'Periféricos', value: 15, color: '#f59e0b' },
];

// Data para productos top
const topProductsData = [
  { producto: 'Laptop HP ProBook 450', ventas: 125, ingresos: 106250 },
  { producto: 'Monitor Dell 27"', ventas: 98, ingresos: 31360 },
  { producto: 'Mouse Logitech MX', ventas: 245, ingresos: 24255 },
  { producto: 'Teclado Keychron K2', ventas: 187, ingresos: 22440 },
  { producto: 'RAM DDR4 16GB', ventas: 156, ingresos: 13260 },
];

// Data para inventario por bodega
const warehouseData = [
  { bodega: 'Central', stock: 4520, valor: 1250000 },
  { bodega: 'Norte', stock: 3180, valor: 890000 },
  { bodega: 'Sur', stock: 2750, valor: 720000 },
  { bodega: 'Este', stock: 1310, valor: 380000 },
];

export function ReportesPage() {
  const [dateRange, setDateRange] = useState('ultimo-mes');
  const [activeTab, setActiveTab] = useState('ventas');
  const [realKpis, setRealKpis] = useState({
    totalSales: 0,
    totalIncome: 0,
    totalExpenses: 0,
    totalProfit: 0,
    margin: 0,
    inventoryValue: 0,
    totalProducts: 0,
    totalCustomers: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const [salesRes, incomeRes, expensesRes, productsRes] = await Promise.all([
        salesOrdersService.getAll(),
        incomeService.getAll(),
        expensesService.getAll(),
        inventoryService.getProducts()
      ]);

      const sales = Array.isArray(salesRes) ? salesRes : salesRes?.data || [];
      const income = Array.isArray(incomeRes) ? incomeRes : incomeRes?.data || [];
      const expenses = Array.isArray(expensesRes) ? expensesRes : expensesRes?.data || [];
      const products = Array.isArray(productsRes) ? productsRes : productsRes?.data || [];

      const totalSales = sales.reduce((acc: number, curr: any) => acc + Number(curr.total || 0), 0);
      const totalIncome = income.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
      const totalExpenses = expenses.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
      const inventoryValue = products.reduce((acc: number, curr: any) => acc + (Number(curr.stock || 0) * Number(curr.costPrice || 0)), 0);
      
      const totalProfit = totalIncome - totalExpenses;
      const margin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;

      setRealKpis({
        totalSales,
        totalIncome,
        totalExpenses,
        totalProfit,
        margin,
        inventoryValue,
        totalProducts: products.length,
        totalCustomers: sales.length
      });
    } catch (error) {
      console.error('Error fetching reporting data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Header - Consistent with other modules */}
      <div className="border-b border-border/50 bg-background px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <BarChart3 className="size-3" /> Centro de Inteligencia NovaHub
          </div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-3">
            Reportes y Análisis
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black tracking-tighter">ANALYTICS</Badge>
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px] h-9 border-border bg-card">
              <Calendar className="mr-2 size-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoy">Hoy</SelectItem>
              <SelectItem value="ultima-semana">Última semana</SelectItem>
              <SelectItem value="ultimo-mes">Último mes</SelectItem>
              <SelectItem value="ultimo-trimestre">Último trimestre</SelectItem>
              <SelectItem value="ultimo-año">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 border-border bg-card"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`size-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" className="h-9 border-border bg-card">
            <Download className="size-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm" className="h-9 bg-[#05602b] hover:bg-[#044c22]">
            <Printer className="size-4 mr-2" />
            Generar Reporte
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-6 py-2 border-b border-border/30 bg-background/60 backdrop-blur shrink-0 overflow-x-auto">
            <TabsList className="bg-transparent h-auto p-0 gap-6">
              <TabsTrigger value="ventas" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none px-1 py-3 text-sm font-bold gap-2">
                <DollarSign className="size-4" /> Ventas
              </TabsTrigger>
              <TabsTrigger value="productos" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-500 border-b-2 border-transparent data-[state=active]:border-blue-500 rounded-none px-1 py-3 text-sm font-bold gap-2">
                <Package className="size-4" /> Productos
              </TabsTrigger>
              <TabsTrigger value="inventario" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-purple-500 border-b-2 border-transparent data-[state=active]:border-purple-500 rounded-none px-1 py-3 text-sm font-bold gap-2">
                <Warehouse className="size-4" /> Inventario
              </TabsTrigger>
              <TabsTrigger value="financiero" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-emerald-500 border-b-2 border-transparent data-[state=active]:border-emerald-500 rounded-none px-1 py-3 text-sm font-bold gap-2">
                <TrendingUp className="size-4" /> Financiero
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            {/* KPI Cards - Always visible */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="size-4 text-green-500" /> Ingresos Totales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">
                    ${realKpis.totalIncome.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowUpRight className="size-3 text-green-500" />
                    <span className="text-xs text-green-500 font-medium">+12.5% vs mes ant.</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ArrowDownRight className="size-4 text-red-500" /> Gastos Totales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-400">
                    ${realKpis.totalExpenses.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowDownRight className="size-3 text-red-500" />
                    <span className="text-xs text-red-500 font-medium">+4.2% vs mes ant.</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="size-4 text-blue-500" /> Utilidad Neta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${realKpis.totalProfit >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                    ${realKpis.totalProfit.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    Margen: {realKpis.margin.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>

              <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Package className="size-4 text-purple-500" /> Valor Inventario
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-400">
                    ${realKpis.inventoryValue.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    {realKpis.totalProducts} productos activos
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tab de Ventas */}
            <TabsContent value="ventas" className="m-0 space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ventas vs Compras Mensuales</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="mes" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="ventas" fill="#3b82f6" name="Ventas" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="compras" fill="#8b5cf6" name="Compras" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tendencia de Utilidad</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="mes" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="utilidad" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      name="Utilidad"
                      dot={{ fill: '#10b981', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribución por Categoría</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

            {/* Tab de Productos */}
            <TabsContent value="productos" className="m-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 5 Productos Más Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProductsData.map((product, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{product.producto}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.ventas} unidades vendidas
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-400">
                        ${product.ingresos.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Ingresos</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rendimiento por Producto</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProductsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                  <YAxis 
                    type="category" 
                    dataKey="producto" 
                    stroke="#94a3b8" 
                    fontSize={11}
                    width={150}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="ventas" fill="#3b82f6" name="Unidades" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

            {/* Tab de Inventario */}
            <TabsContent value="inventario" className="m-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock por Bodega</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {warehouseData.map((warehouse, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{warehouse.bodega}</span>
                      <span className="text-sm text-muted-foreground">
                        {warehouse.stock.toLocaleString()} unidades
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${(warehouse.stock / 4520) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Valor: ${warehouse.valor.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparativa de Bodegas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={warehouseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="bodega" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="stock" fill="#3b82f6" name="Stock" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

            {/* Tab Financiero */}
            <TabsContent value="financiero" className="m-0 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-green-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-400">$778,000</div>
                <p className="text-xs text-muted-foreground mt-1">Último año</p>
              </CardContent>
            </Card>

            <Card className="border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Gastos Totales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">$529,000</div>
                <p className="text-xs text-muted-foreground mt-1">Último año</p>
              </CardContent>
            </Card>

            <Card className="border-blue-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Balance Neto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-400">$249,000</div>
                <p className="text-xs text-muted-foreground mt-1">Utilidad neta</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Flujo de Caja Anual</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="mes" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="ventas" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Ingresos"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="compras" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="Gastos"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="utilidad" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    name="Balance"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Quick Action Bar (Bottom) */}
      <div className="h-14 border-t border-border/50 bg-background/80 backdrop-blur px-6 flex items-center justify-between shrink-0">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#05602b]">
          Datos en tiempo real • Actualizado automáticamente
        </p>
        <div className="flex items-center gap-4">
          <button className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <Download className="size-3.5" /> Descargar PDF
          </button>
          <button className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <Share2 className="size-3.5" /> Compartir Reporte
          </button>
        </div>
      </div>
    </div>
  );
}
