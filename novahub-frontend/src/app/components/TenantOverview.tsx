import React, { useEffect, useState } from 'react';
import { motion, Variants } from 'motion/react';
import {
  TrendingUp, TrendingDown, Package, DollarSign, ShoppingCart, Users,
  ArrowUpRight, Loader2, Target, Download, Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { type Module } from '../contexts/AuthContext';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { salesOrdersService, customersService, invoicesService } from '../services/ventas.service';
import { incomeService } from '../services/finanzas.service';
import { inventoryService } from '../services/inventario.service';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';

interface TenantOverviewProps {
  onNavigate?: (module: Module) => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

const statusColors: Record<string, string> = {
  'PAID': 'bg-emerald-500/10 text-emerald-500',
  'PENDING': 'bg-amber-500/10 text-amber-500',
  'PARTIAL': 'bg-blue-500/10 text-blue-500',
  'OVERDUE': 'bg-rose-500/10 text-rose-500',
  'DRAFT': 'bg-muted/10 text-muted-foreground',
  'CONFIRMED': 'bg-emerald-500/20 text-emerald-400',
  'IN_PROGRESS': 'bg-blue-500/20 text-blue-400',
  'DELIVERED': 'bg-emerald-600/20 text-emerald-400',
  'CANCELLED': 'bg-rose-600/20 text-rose-400',
};

const statusLabel: Record<string, string> = {
  'PAID': 'Pagada', 'PENDING': 'Pendiente', 'PARTIAL': 'Parcial',
  'OVERDUE': 'Vencida', 'DRAFT': 'Borrador', 'CONFIRMED': 'Confirmada',
  'IN_PROGRESS': 'En proceso', 'DELIVERED': 'Entregada', 'CANCELLED': 'Cancelada',
};

export function TenantOverview({ onNavigate }: TenantOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [totalVentas, setTotalVentas] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [ordenesPendientes, setOrdenesPendientes] = useState(0);
  const [totalProductos, setTotalProductos] = useState(0);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [metaOpen, setMetaOpen] = useState(false);
  const [salesGoal, setSalesGoal] = useState(50000);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [orders, ingresos, customers, products] = await Promise.allSettled([
          salesOrdersService.getAll(),
          incomeService.getAll(),
          customersService.getAll(),
          inventoryService.getProducts(),
        ]);

        if (orders.status === 'fulfilled') {
          const orderList = orders.value?.data || orders.value || [];
          setOrdenesPendientes(orderList.filter((o: any) =>
            ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(o.status)).length);
          setRecentOrders(orderList.slice(0, 3));
        }

        if (ingresos.status === 'fulfilled') {
          const ingresoList = ingresos.value?.data || ingresos.value || [];
          const total = ingresoList.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);
          setTotalVentas(total);
        }

        if (customers.status === 'fulfilled') {
          const list = customers.value?.data || customers.value || [];
          setTotalClientes(list.length);
        }

        if (products.status === 'fulfilled') {
          const list = products.value?.data || products.value || [];
          setTotalProductos(list.length);
        }

        try {
          const inv = await invoicesService.getAll();
          setRecentInvoices((inv.data || []).slice(0, 5));
        } catch (err) {
          console.error('Error fetching recent invoices:', err);
        }
      } catch (e) {
        console.error('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const handleExport = async () => {
    setIsExporting(true);
    toast.info('Generando reporte consolidado...');
    
    try {
      const headers = ['Concepto', 'Total'];
      const data = [
        ['Ingresos Totales', totalVentas],
        ['Productos en Stock', totalProductos],
        ['Ordenes Activas', ordenesPendientes],
        ['Clientes Activos', totalClientes]
      ];
      
      const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + data.map(e => e.join(",")).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `reporte_ejecutivo_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Reporte exportado exitosamente');
    } catch (e) {
      toast.error('Error al exportar reporte');
    } finally {
      setIsExporting(false);
    }
  };

  const kpis = [
    {
      title: 'Ingresos Totales', value: loading ? '...' : formatCurrency(totalVentas),
      change: '+12.5%', trend: 'up', icon: DollarSign,
      color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', module: 'finanzas' as Module, primary: true,
    },
    {
      title: 'Productos en Stock', value: loading ? '...' : totalProductos.toString(),
      change: '', trend: 'up', icon: Package,
      color: 'text-blue-500', bgColor: 'bg-blue-500/10', module: 'inventario' as Module, primary: false,
    },
    {
      title: 'Órdenes Activas', value: loading ? '...' : ordenesPendientes.toString(),
      change: '', trend: 'up', icon: ShoppingCart,
      color: 'text-orange-500', bgColor: 'bg-orange-500/10', module: 'ventas' as Module, primary: false,
    },
    {
      title: 'Clientes Activos', value: loading ? '...' : totalClientes.toString(),
      change: '', trend: 'up', icon: Users,
      color: 'text-purple-500', bgColor: 'bg-purple-500/10', module: 'clientes' as Module, primary: false,
    },
  ];

  return (
    <div className="space-y-8 p-4 md:p-6 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative">
        <div className="absolute -left-10 -top-10 size-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl tracking-tight text-foreground mb-3 font-bold">
            Centraliza, optimiza y{' '}
            <span className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md inline-block transform -rotate-2 shadow-lg font-semibold mx-1 border border-primary/50">
              escala
            </span>,
            <br />
            <span className="text-2xl md:text-3xl mt-4 block text-muted-foreground/90 tracking-normal font-medium">
              la solución integral que tu crecimiento{' '}
              <span className="text-foreground border-b-[3px] border-primary pb-0.5 inline-block transform rotate-1">necesita.</span>
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-4 max-w-xl">
            Supervisa el rendimiento en tiempo real, descubre nuevas oportunidades y toma decisiones estratégicas con nuestra visión analítica de 360°.
          </p>
        </div>
        <div className="flex items-center gap-3 z-10">
          <Button variant="outline" onClick={() => setMetaOpen(true)} className="border-primary/20 hover:bg-primary/5 transition-all rounded-xl font-bold uppercase text-[10px] tracking-widest">
            <Target className="mr-2 size-4 text-primary" />Configurar Meta
          </Button>
          <Button 
            disabled={isExporting}
            onClick={handleExport}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all active:scale-95 rounded-xl font-bold uppercase text-[10px] tracking-widest"
          >
            {isExporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
            Exportar Reporte
          </Button>
        </div>
      </div>

      <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
        <DialogContent className="rounded-3xl border-border/50 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Establecer Meta de Ventas</DialogTitle>
            <DialogDescription>Define el objetivo mensual para el tenant actual.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Monto Objetivo (USD)</label>
            <Input 
              type="number" 
              value={salesGoal} 
              onChange={(e) => setSalesGoal(Number(e.target.value))}
              className="text-lg font-bold bg-muted/20 border-border/50 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button className="rounded-xl font-bold" onClick={() => {
              setMetaOpen(false);
              toast.success('Meta actualizada correctamente');
            }}>Guardar Meta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPIs */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown;
          return (
            <motion.div key={kpi.title} variants={itemVariants}>
              <Card
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group border-border/50 rounded-3xl ${kpi.primary ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-transparent shadow-lg' : 'bg-card/50 backdrop-blur-sm shadow-sm'}`}
                onClick={() => onNavigate?.(kpi.module)}
              >
                <div className={`absolute -right-6 -top-6 size-24 rounded-full blur-2xl opacity-50 transition-transform group-hover:scale-150 duration-500 ${kpi.primary ? 'bg-white/20' : kpi.bgColor}`} />
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`flex size-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-inner ${kpi.primary ? 'bg-white/20 backdrop-blur-md' : `${kpi.bgColor} border border-border/50`}`}>
                      <Icon className={`size-6 ${kpi.primary ? 'text-white' : kpi.color}`} />
                    </div>
                    {kpi.change && (
                      <Badge variant={kpi.primary ? 'default' : 'secondary'} className={`bg-opacity-20 flex items-center gap-1 ${kpi.primary ? 'bg-white/20 text-white hover:bg-white/30' : ''}`}>
                        <TrendIcon className="size-3" />{kpi.change}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${kpi.primary ? 'text-white/80' : 'text-muted-foreground'}`}>{kpi.title}</p>
                    <p className={`text-3xl font-black tracking-tighter tabular-nums ${kpi.primary ? 'text-white drop-shadow-sm' : 'text-foreground'}`}>
                      {loading ? <Loader2 className="size-6 animate-spin opacity-50" /> : kpi.value}
                    </p>
                  </div>
                  <div className={`mt-5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-0 transform translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ${kpi.primary ? 'text-white/90' : 'text-primary'}`}>
                    <span>Detalles del módulo</span>
                    <ArrowUpRight className="size-4" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
          <Card className="rounded-3xl border-border/50 bg-card/30 backdrop-blur-md overflow-hidden shadow-sm">
            <CardHeader><CardTitle className="text-lg font-bold uppercase tracking-tight">Actividad Reciente — Órdenes</CardTitle></CardHeader>
            <CardContent>
              {recentOrders.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={recentOrders.map(o => ({
                    name: o.number || o.id?.slice(0,8),
                    total: Number(o.total || 0),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[8,8,0,0]} name="Total" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm italic">
                  {loading ? <Loader2 className="animate-spin size-6" /> : 'No hay órdenes registradas aún'}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
          <Card className="rounded-3xl bg-card/30 backdrop-blur-md shadow-sm border-border/50">
            <CardHeader><CardTitle className="text-lg font-bold uppercase tracking-tight">Resumen Ejecutivo</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4 pt-2">
                {[
                  { label: 'Clientes registrados', value: totalClientes, color: 'bg-indigo-500' },
                  { label: 'Productos en catálogo', value: totalProductos, color: 'bg-sky-500' },
                  { label: 'Órdenes activas', value: ordenesPendientes, color: 'bg-orange-500' },
                  { label: 'Ingresos registrados', value: formatCurrency(totalVentas), color: 'bg-emerald-500' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/30 hover:bg-muted/30 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className={`size-3 rounded-full ${item.color} shadow-sm group-hover:scale-125 transition-transform`} />
                      <span className="text-sm font-bold text-muted-foreground/80">{item.label}</span>
                    </div>
                    <span className="font-black text-sm tabular-nums text-foreground">
                      {loading ? '...' : item.value}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Transactions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="rounded-3xl bg-card/30 backdrop-blur-md border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-black uppercase tracking-tight">Facturas Recientes</CardTitle>
                <p className="text-xs text-muted-foreground/60 font-medium">Últimas transacciones procesadas.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onNavigate?.('ventas')} className="hover:bg-primary/5 border-border/50 rounded-xl font-bold uppercase text-[10px] tracking-widest">
                Ver Historial <ArrowUpRight className="ml-2 size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 sm:pt-0">
            <div className="overflow-x-auto rounded-2xl border border-border/20">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/40 hover:bg-transparent">
                    <TableHead className="font-black py-4 pl-4 uppercase text-[10px] tracking-widest">Factura</TableHead>
                    <TableHead className="font-black py-4 uppercase text-[10px] tracking-widest">Cliente</TableHead>
                    <TableHead className="font-black py-4 text-right uppercase text-[10px] tracking-widest">Monto</TableHead>
                    <TableHead className="font-black py-4 text-center uppercase text-[10px] tracking-widest">Estado</TableHead>
                    <TableHead className="font-black py-4 text-right pr-4 uppercase text-[10px] tracking-widest">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20">
                        <Loader2 className="size-8 animate-spin mx-auto text-primary/20" />
                      </TableCell>
                    </TableRow>
                  ) : recentInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-muted-foreground text-xs font-bold uppercase tracking-widest italic opacity-40">
                        Sin facturas registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentInvoices.map((inv: any) => (
                      <TableRow key={inv.id} className="border-border/30 hover:bg-muted/30 transition-colors group">
                        <TableCell className="font-black pl-4 text-sm text-foreground/80">{inv.number}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full flex items-center justify-center text-[10px] font-black bg-primary/10 text-primary border border-primary/20">
                              {(inv.customer?.name || inv.customerId || 'N').substring(0, 1).toUpperCase()}
                            </div>
                            <span className="font-bold text-sm text-foreground/70">{inv.customer?.name || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-black text-right text-sm tabular-nums">
                          {formatCurrency(Number(inv.total || 0))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn("px-3 py-1 font-black uppercase text-[9px] tracking-widest border-none", statusColors[inv.paymentStatus] || 'bg-muted/10 text-muted-foreground')}>
                            {statusLabel[inv.paymentStatus] || inv.paymentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground/60 text-[10px] font-black text-right pr-4 uppercase tracking-tighter">
                          {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('es-NI') : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
