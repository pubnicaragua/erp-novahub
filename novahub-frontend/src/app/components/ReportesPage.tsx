import React, { useState, useEffect } from 'react';
import { BarChart3, Download, FileText, TrendingUp, Calendar, Filter } from 'lucide-react';
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
  const [reportType, setReportType] = useState('ventas');
  const [realKpis, setRealKpis] = useState({
    totalSales: 0,
    totalProfit: 0,
    margin: 0,
    inventoryRotation: 4.2
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [sales, income, expenses] = await Promise.all([
          salesOrdersService.getAll(),
          incomeService.getAll(),
          expensesService.getAll()
        ]);

        const totalSales = (sales?.data || []).reduce((acc: number, curr: any) => acc + Number(curr.total || 0), 0);
        const totalIncome = (income?.data || []).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
        const totalExpenses = (expenses?.data || []).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
        
        const totalProfit = totalIncome - totalExpenses;
        const margin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

        setRealKpis(prev => ({
          ...prev,
          totalSales,
          totalProfit,
          margin
        }));
      } catch (error) {
        console.error('Error fetching reporting data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes y Análisis</h1>
          <p className="text-sm text-muted-foreground">
            Análisis detallado de ventas, inventario y rendimiento
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
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
          <Button variant="outline">
            <Download className="mr-2 size-4" />
            Exportar
          </Button>
          <Button>
            <FileText className="mr-2 size-4" />
            Generar Reporte
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="size-4" />
              Ventas Totales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              ${realKpis.totalSales.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-400">+12.5%</span> vs mes anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="size-4" />
              Utilidad Neta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              ${realKpis.totalProfit.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-400">+8.3%</span> vs mes anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="size-4" />
              Margen Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {realKpis.margin.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-400">+2.1%</span> vs mes anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="size-4" />
              Rotación Inventario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">
              {realKpis.inventoryRotation}x
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-yellow-400">-0.3x</span> vs mes anterior
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para diferentes reportes */}
      <Tabs defaultValue="ventas" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="inventario">Inventario</TabsTrigger>
          <TabsTrigger value="financiero">Financiero</TabsTrigger>
        </TabsList>

        {/* Tab de Ventas */}
        <TabsContent value="ventas" className="space-y-4">
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
        <TabsContent value="productos" className="space-y-4">
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
        <TabsContent value="inventario" className="space-y-4">
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
        <TabsContent value="financiero" className="space-y-4">
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
      </Tabs>
    </div>
  );
}
