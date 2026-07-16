import React, { useEffect, useState } from 'react';
import { motion, Variants } from 'motion/react';
import {
  TrendingDown, Package, DollarSign, ShoppingCart, Users,
  ArrowUpRight, Loader2, Target, Download, Briefcase, HandCoins,
  UserCheck, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { type Module, useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { salesOrdersService, customersService, invoicesService } from '../services/ventas.service';
import { incomeService, expensesService as finExpensesService } from '../services/finanzas.service';
import { inventoryService } from '../services/inventario.service';
import { suppliersService, purchaseOrdersService } from '../services/compras.service';
import { hrService } from '../services/hr.service';
import { subscriptionsService } from '../services/subscriptions.service';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { cn } from './ui/utils';

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

// ── Module-to-KPI mapping ──
interface KpiDef {
  id: string;
  requiredModule: string; // matches ModuleType from backend
  permModule: string;     // matches canPerform module key
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  navModule: Module;
  fetchKey: string;
}

const ALL_KPIS: KpiDef[] = [
  { id: 'ingresos', requiredModule: 'FINANCIAL', permModule: 'finanzas', title: 'Ingresos Totales', icon: DollarSign, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', navModule: 'finanzas', fetchKey: 'income' },
  { id: 'gastos', requiredModule: 'FINANCIAL', permModule: 'finanzas', title: 'Gastos Totales', icon: TrendingDown, color: 'text-rose-500', bgColor: 'bg-rose-500/10', navModule: 'finanzas', fetchKey: 'expenses' },
  { id: 'ordenes', requiredModule: 'SALES', permModule: 'ventas', title: 'Órdenes Activas', icon: ShoppingCart, color: 'text-orange-500', bgColor: 'bg-orange-500/10', navModule: 'ventas', fetchKey: 'orders' },
  { id: 'clientes', requiredModule: 'SALES', permModule: 'ventas', title: 'Clientes Activos', icon: Users, color: 'text-purple-500', bgColor: 'bg-purple-500/10', navModule: 'ventas', fetchKey: 'customers' },
  { id: 'productos', requiredModule: 'INVENTORY', permModule: 'inventario', title: 'Productos en Stock', icon: Package, color: 'text-blue-500', bgColor: 'bg-blue-500/10', navModule: 'inventario', fetchKey: 'products' },
  { id: 'proveedores', requiredModule: 'PURCHASES', permModule: 'compras', title: 'Proveedores Activos', icon: HandCoins, color: 'text-teal-500', bgColor: 'bg-teal-500/10', navModule: 'compras', fetchKey: 'suppliers' },
  { id: 'oc', requiredModule: 'PURCHASES', permModule: 'compras', title: 'Órdenes de Compra', icon: Briefcase, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10', navModule: 'compras', fetchKey: 'purchaseOrders' },
  { id: 'empleados', requiredModule: 'HR', permModule: 'rh', title: 'Empleados Activos', icon: UserCheck, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10', navModule: 'rh', fetchKey: 'employees' },
];

export function TenantOverview({ onNavigate }: TenantOverviewProps) {
  const { user, canPerform } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [modulesLoaded, setModulesLoaded] = useState(false);

  // Dynamic data store
  const [dataStore, setDataStore] = useState<Record<string, number>>({});
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [metaOpen, setMetaOpen] = useState(false);
  const [salesGoal, setSalesGoal] = useState(50000);
  const [isExporting, setIsExporting] = useState(false);
  const { displayCurrency, convertAmount, formatConvertedAmount } = useCurrency();

  // ── Check which modules are available ──
  const isModuleAvailable = (requiredModule: string, permModule: string): boolean => {
    // If modules haven't loaded yet, assume nothing
    if (!modulesLoaded) return false;
    
    // Check if module is enabled at tenant level
    const moduleEnabled = enabledModules.length === 0 || 
      enabledModules.some(m => m.startsWith(requiredModule));
    
    if (!moduleEnabled) return false;

    // Check user permissions
    try {
      return canPerform(permModule as any, 'view');
    } catch {
      return true; // If canPerform doesn't recognize the module, allow it
    }
  };

  // ── Compute visible KPIs ──
  const visibleKpis = modulesLoaded 
    ? ALL_KPIS.filter(k => isModuleAvailable(k.requiredModule, k.permModule)).slice(0, 4)
    : [];
  
  // Make the first KPI "primary" (highlighted card)
  const kpisWithPrimary = visibleKpis.map((k, i) => ({ ...k, primary: i === 0 }));

  useEffect(() => {
    const loadModules = async () => {
      if (!user?.tenantId) {
        setModulesLoaded(true);
        return;
      }
      try {
        const modules = await subscriptionsService.getEnabledModules(user.tenantId);
        setEnabledModules(modules || []);
      } catch (error) {
        console.error('Error fetching enabled modules:', error);
        setEnabledModules([]); // Show all if can't fetch
      } finally {
        setModulesLoaded(true);
      }
    };
    loadModules();
  }, [user?.tenantId]);

  useEffect(() => {
    if (!modulesLoaded) return;
    loadData();
  }, [modulesLoaded, enabledModules]);

  const loadData = async () => {
    setLoading(true);
    const newData: Record<string, number> = {};
    const promises: Promise<void>[] = [];

    // Only fetch data for modules that are available
    if (isModuleAvailable('FINANCIAL', 'finanzas')) {
      promises.push(
        (async () => {
          try {
            const res = await incomeService.getAll();
            const list = Array.isArray(res) ? res : (res as any)?.data || [];
            setIncomes(list);
            newData.income = list.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);
          } catch {
            setIncomes([]);
            newData.income = 0;
          }
        })(),
        (async () => {
          try {
            const res = await finExpensesService.getAll();
            const list = Array.isArray(res) ? res : (res as any)?.data || [];
            setExpenses(list);
            newData.expenses = list.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
          } catch {
            setExpenses([]);
            newData.expenses = 0;
          }
        })()
      );
    }

    if (isModuleAvailable('SALES', 'ventas')) {
      promises.push(
        (async () => {
          try {
            const res = await salesOrdersService.getAll();
            const list = (res as any)?.data || res || [];
            newData.orders = list.filter((o: any) =>
              ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(o.status)).length;
            setRecentOrders(list.slice(0, 3));
          } catch { newData.orders = 0; }
        })(),
        (async () => {
          try {
            const res = await customersService.getAll();
            const list = (res as any)?.data || res || [];
            newData.customers = list.length;
          } catch { newData.customers = 0; }
        })(),
        (async () => {
          try {
            const inv = await invoicesService.getAll();
            setRecentInvoices(((inv as any).data || []).slice(0, 5));
          } catch {}
        })()
      );
    }

    if (isModuleAvailable('INVENTORY', 'inventario')) {
      promises.push(
        (async () => {
          try {
            const res = await inventoryService.getProducts();
            const list = (res as any)?.data || res || [];
            newData.products = list.length;
          } catch { newData.products = 0; }
        })()
      );
    }

    if (isModuleAvailable('PURCHASES', 'compras')) {
      promises.push(
        (async () => {
          try {
            const res = await suppliersService.getAll();
            const list = (res as any)?.data || res || [];
            newData.suppliers = list.length;
          } catch { newData.suppliers = 0; }
        })(),
        (async () => {
          try {
            const res = await purchaseOrdersService.getAll();
            const list = (res as any)?.data || res || [];
            newData.purchaseOrders = list.filter((o: any) =>
              ['PENDING', 'APPROVED', 'DRAFT'].includes(o.status)).length;
          } catch { newData.purchaseOrders = 0; }
        })()
      );
    }

    if (isModuleAvailable('HR', 'rh')) {
      promises.push(
        (async () => {
          try {
            const res = await hrService.getEmployees();
            const list = (res as any)?.data || res || [];
            newData.employees = list.length;
          } catch { newData.employees = 0; }
        })()
      );
    }

    await Promise.allSettled(promises);
    setDataStore(newData);
    setLoading(false);
  };

  const totalIncome = incomes.reduce(
    (sum: number, i: any) => sum + convertAmount(Number(i.amount || 0), i.currency, i.exchangeRate), 0
  );
  const totalExpenses = expenses.reduce(
    (sum: number, e: any) => sum + convertAmount(Number(e.amount || 0), e.currency, e.exchangeRate), 0
  );

  const formatCurrency = (n: number, sourceCurrency?: string, sourceExchangeRate?: number) =>
    formatConvertedAmount(n, sourceCurrency, sourceExchangeRate);

  const getKpiValue = (fetchKey: string): string => {
    if (loading) return '...';
    if (fetchKey === 'income') return formatCurrency(totalIncome, displayCurrency);
    if (fetchKey === 'expenses') return formatCurrency(totalExpenses, displayCurrency);
    const val = dataStore[fetchKey] ?? 0;
    return val.toString();
  };

  const handleExport = async () => {
    setIsExporting(true);
    toast.info('Generando reporte consolidado...');
    
    try {
      const headers = ['Concepto', 'Total'];
      const data = kpisWithPrimary.map(k => [k.title, getKpiValue(k.fetchKey)]);
      
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

  // ── Determine what to show in bottom section ──
  const hasSales = isModuleAvailable('SALES', 'ventas');

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
        <DialogContent className="rounded-3xl border-border/50 bg-popover">
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

      {/* KPIs — dynamic based on enabled modules */}
      {!modulesLoaded ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-primary/30" />
        </div>
      ) : kpisWithPrimary.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/50 rounded-3xl bg-card shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <AlertCircle className="size-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground font-bold">No hay módulos habilitados para mostrar métricas.</p>
              <p className="text-xs text-muted-foreground/60">Contacta al administrador para habilitar módulos en tu suscripción.</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="show" className={`grid gap-5 md:grid-cols-2 lg:grid-cols-${Math.min(kpisWithPrimary.length, 4)}`}>
          {kpisWithPrimary.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <motion.div key={kpi.id} variants={itemVariants}>
                <Card
                  className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group border-border/50 rounded-3xl ${kpi.primary ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-transparent shadow-lg' : 'bg-card shadow-sm'}`}
                  onClick={() => onNavigate?.(kpi.navModule)}
                >
                  <div className={`absolute -right-6 -top-6 size-24 rounded-full blur-2xl opacity-50 transition-transform group-hover:scale-150 duration-500 ${kpi.primary ? 'bg-white/20' : kpi.bgColor}`} />
                  <CardContent className="p-6 relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`flex size-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-inner ${kpi.primary ? 'bg-white/20 backdrop-blur-md' : `${kpi.bgColor} border border-border/50`}`}>
                        <Icon className={`size-6 ${kpi.primary ? 'text-white' : kpi.color}`} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className={`text-[10px] font-black uppercase tracking-widest ${kpi.primary ? 'text-white/80' : 'text-muted-foreground'}`}>{kpi.title}</p>
                      <p className={`text-3xl font-black tracking-tighter tabular-nums ${kpi.primary ? 'text-white drop-shadow-sm' : 'text-foreground'}`}>
                        {loading ? <Loader2 className="size-6 animate-spin opacity-50" /> : getKpiValue(kpi.fetchKey)}
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
      )}

      {/* Charts row — adapts to available modules */}
      {modulesLoaded && kpisWithPrimary.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
            <Card className="rounded-3xl border-border/50 bg-card shadow-sm">
              <CardHeader><CardTitle className="text-lg font-bold uppercase tracking-tight">
                {hasSales ? 'Actividad Reciente — Órdenes' : 'Resumen de Actividad'}
              </CardTitle></CardHeader>
              <CardContent>
                {hasSales && recentOrders.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={recentOrders.map(o => ({
                      name: o.number || o.id?.slice(0,8),
                      total: convertAmount(Number(o.total || 0), o.currency, o.exchangeRate),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'currentColor', fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                      <YAxis tick={{ fill: 'currentColor', fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          color: 'hsl(var(--popover-foreground))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                        labelStyle={{ color: 'hsl(var(--popover-foreground))', fontWeight: 700 }}
                        itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                        formatter={(value: any) => [formatCurrency(Number(value), displayCurrency), 'Total']}
                      />
                      <Bar dataKey="total" fill="var(--primary)" radius={[8,8,0,0]} name="Total" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm italic">
                    {loading ? <Loader2 className="animate-spin size-6" /> : 'No hay datos disponibles para graficar'}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
            <Card className="rounded-3xl bg-card shadow-sm border-border/50">
              <CardHeader><CardTitle className="text-lg font-bold uppercase tracking-tight">Resumen Ejecutivo</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4 pt-2">
                  {kpisWithPrimary.map(kpi => (
                    <div key={kpi.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/30 hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className={`size-3 rounded-full ${kpi.bgColor.replace('/10', '')} shadow-sm group-hover:scale-125 transition-transform`} 
                          style={{ backgroundColor: `var(--${kpi.color.replace('text-', '')}, currentColor)` }} />
                        <span className="text-sm font-bold text-muted-foreground/80">{kpi.title}</span>
                      </div>
                      <span className="font-black text-sm tabular-nums text-foreground">
                        {loading ? '...' : getKpiValue(kpi.fetchKey)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Recent Transactions — only if sales module is available */}
      {hasSales && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="rounded-3xl bg-card border-border/50 shadow-sm overflow-hidden">
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
                            {formatCurrency(Number(inv.total || 0), inv.currency, inv.exchangeRate)}
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
      )}
    </div>
  );
}
