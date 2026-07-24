import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, TrendingUp, TrendingDown, ShoppingCart, AlertTriangle,
  DollarSign, Package, BarChart3, Clock, ArrowUpRight, Boxes,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { cajaService, type DashboardData } from '../../services/caja.service';
import { useCurrency } from '../../contexts/CurrencyContext';

export function DashboardCajaView({ onNavigateToFacturacion, registerId }: { onNavigateToFacturacion?: () => void, registerId?: string }) {
  const { displayCurrency, exchangeRate: globalRate } = useCurrency();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const formatCurrency = useCallback((value: number) => {
    const isUSD = displayCurrency === 'USD';
    const symbol = isUSD ? '$' : 'C$';
    const converted = isUSD ? value / globalRate : value;
    return `${symbol} ${Number(converted).toLocaleString('en-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [displayCurrency, globalRate]);
  const getTodayDateString = () => {
    const today = new Date();
    // Ajustar a la zona horaria local de forma sencilla
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState(getTodayDateString());

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cajaService.getDashboard(undefined, registerId, startDate, endDate);
      setData(res);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al cargar dashboard de caja');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, registerId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        No hay datos disponibles. Emití facturas desde la pestaña de Facturación por Caja.
      </div>
    );
  }

  const { kpis, productPerformance, salesByRegister, inventoryAlerts, recentTransactions } = data;

  const totalSalesByRegister = salesByRegister.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">
            Panel interactivo de <span className="text-primary">rendimiento financiero</span>, rotación de productos y operaciones de caja.
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            className="w-40 h-10 rounded-xl"
          />
          <span className="text-muted-foreground text-sm font-bold">hasta</span>
          <Input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            className="w-40 h-10 rounded-xl"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="overflow-hidden border-cyan-500/15 shadow-sm bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.035),rgba(34,211,238,0.07))]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Ingresos Totales</p>
                <p className="text-2xl font-black mt-1">{formatCurrency(kpis.totalRevenue)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">≈ {displayCurrency === 'USD' ? 'C$' : '$'} {(displayCurrency === 'USD' ? kpis.totalRevenue : kpis.totalRevenue / globalRate).toLocaleString('en-US', { maximumFractionDigits: 0 })} {displayCurrency === 'USD' ? 'NIO' : 'USD'}</p>
              </div>
              <div className="p-2 bg-cyan-500/10 rounded-xl ring-1 ring-cyan-500/15">
                <TrendingUp className="size-5 text-cyan-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-slate-500/15 shadow-sm bg-[radial-gradient(circle_at_top_right,rgba(100,116,139,0.14),transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.035),rgba(100,116,139,0.07))]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Gastos Totales</p>
                <p className="text-2xl font-black mt-1">{formatCurrency(kpis.totalExpenses)}</p>
                <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  <ArrowUpRight className="size-3" /> Gastos del período
                </p>
              </div>
              <div className="p-2 bg-slate-500/10 rounded-xl ring-1 ring-slate-500/15">
                <TrendingDown className="size-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-indigo-500/15 shadow-sm bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.14),transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.035),rgba(99,102,241,0.07))]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Órdenes de Venta</p>
                <p className="text-2xl font-black mt-1">{kpis.ordersCount}</p>
                {kpis.pendingOrders > 0 && (
                  <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                    <Clock className="size-3" /> {kpis.pendingOrders} pendientes
                  </p>
                )}
              </div>
              <div className="p-2 bg-indigo-500/10 rounded-xl ring-1 ring-indigo-500/15">
                <ShoppingCart className="size-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-emerald-500/15 shadow-sm bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.035),rgba(16,185,129,0.07))]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Margen Utilidad Net.</p>
                <p className="text-2xl font-black mt-1">{kpis.netMargin}%</p>
                <p className={`text-[10px] mt-1 flex items-center gap-1 ${kpis.netMargin >= 30 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {kpis.netMargin >= 30 ? 'Rentabilidad Óptima' : 'Margen mejorable'}
                </p>
              </div>
              <div className={`p-2 rounded-xl ring-1 ${kpis.netMargin >= 30 ? 'bg-emerald-500/10 ring-emerald-500/15' : 'bg-amber-500/10 ring-amber-500/15'}`}>
                <BarChart3 className={`size-5 ${kpis.netMargin >= 30 ? 'text-emerald-600' : 'text-amber-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        {/* Left: Product Performance */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                  <Package className="size-4 text-primary" /> Rendimiento de Productos en Caja
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Monitoreo por volumen de ventas, margen de utilidad ganada e inventario sin salida.</p>
              </div>
              <Badge className="bg-cyan-500/10 text-cyan-700 border-cyan-500/20 text-[9px] font-bold">Análisis en Tiempo Real</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Más Vendidos */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="size-4 text-cyan-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-700">Más Vendidos</span>
                  <span className="text-[9px] font-bold text-muted-foreground ml-auto">UNID.</span>
                </div>
                <div className="space-y-2">
                  {productPerformance.topSelling.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-4">Sin ventas registradas</p>
                  )}
                  {productPerformance.topSelling.slice(0, 10).map((p) => (
                    <div key={p.productId} className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04] px-3 py-2.5 hover:bg-cyan-500/[0.07] transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{p.name}</span>
                        <Badge className="bg-primary/10 text-primary text-[9px] font-mono">{p.totalQty} unid</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Total: {formatCurrency(p.totalRevenue)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mayor Utilidad */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="size-4 text-indigo-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Mayor Utilidad</span>
                  <span className="text-[9px] font-bold text-muted-foreground ml-auto">GANANCIA</span>
                </div>
                <div className="space-y-2">
                  {productPerformance.topMargin.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-4">Sin datos de margen</p>
                  )}
                  {productPerformance.topMargin.slice(0, 10).map((p) => (
                    <div key={p.productId} className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.04] px-3 py-2.5 hover:bg-indigo-500/[0.07] transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{p.name}</span>
                        <span className="text-xs font-black text-emerald-600">+{formatCurrency(p.profit || 0)}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{(p.margin || 0).toFixed(0)}% Margen</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sin Venta */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Boxes className="size-4 text-slate-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Sin Venta</span>
                  <span className="text-[9px] font-bold text-muted-foreground ml-auto">STOCK PARADO</span>
                </div>
                <div className="space-y-2">
                  {productPerformance.noSaleProducts.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center py-4">Todos los productos tienen rotación</p>
                  )}
                  {productPerformance.noSaleProducts.slice(0, 10).map((p) => (
                    <div key={p.id} className="rounded-xl border border-slate-500/15 bg-slate-500/[0.04] px-3 py-2.5 hover:bg-slate-500/[0.07] transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{p.name}</span>
                        <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[9px]">0 unid</Badge>
                      </div>
                      <p className="text-[10px] text-rose-500 mt-0.5">Sin salidas este período</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Sidebar */}
        <div className="space-y-5">
          {/* Ventas por Cajas */}
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-5">
              <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 mb-4">
                <BarChart3 className="size-4 text-primary" /> Ventas por Cajas
              </h3>
              {salesByRegister.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-4">Sin ventas por caja</p>
              ) : (
                <div className="space-y-3">
                  {salesByRegister.map((reg) => {
                    const pct = totalSalesByRegister > 0 ? (reg.total / totalSalesByRegister) * 100 : 0;
                    return (
                      <div key={reg.registerId} className="cursor-pointer hover:bg-muted/20 rounded-xl p-2 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold">{reg.registerCode} - {reg.registerName}</span>
                          <span className="text-xs font-mono font-bold">{formatCurrency(reg.total)}</span>
                        </div>
                        <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[9px] text-muted-foreground">{reg.count} facturas</span>
                          <span className="text-[9px] text-muted-foreground">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alertas de Inventario */}
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-5">
              <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 mb-4">
                <AlertTriangle className="size-4 text-amber-500" /> Alertas de Inventario POS
              </h3>
              {inventoryAlerts.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-4">Inventario OK</p>
              ) : (
                <div className="space-y-2">
                  {inventoryAlerts.map((alert) => (
                    <div key={alert.productId} className="flex items-center justify-between rounded-xl border border-border/30 px-3 py-2 hover:bg-muted/20 transition-colors cursor-pointer">
                      <span className="text-xs font-bold">{alert.name}</span>
                      <Badge
                        className={`text-[9px] font-bold ${
                          alert.status === 'SIN_STOCK'
                            ? 'bg-red-100 text-red-700 border-red-200'
                            : alert.status === 'STOCK_BAJO'
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-blue-100 text-blue-700 border-blue-200'
                        }`}
                      >
                        {alert.status === 'SIN_STOCK' ? 'Sin Stock' : alert.status === 'STOCK_BAJO' ? `Stock Bajo (${alert.currentStock})` : `Reorden (${alert.currentStock})`}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Transactions */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          <h3 className="text-sm font-black uppercase tracking-tight mb-4">Transacciones Recientes de Facturación</h3>
          {recentTransactions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No hay transacciones recientes</p>
          ) : (
            <div className="border border-border/50 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/30">
                    <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Factura</th>
                    <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Caja</th>
                    <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Cliente</th>
                    <th className="px-4 py-3 text-right font-black uppercase tracking-widest text-[10px] text-muted-foreground">Monto (C$)</th>
                    <th className="px-4 py-3 text-center font-black uppercase tracking-widest text-[10px] text-muted-foreground">Estado IVA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {recentTransactions.slice(0, 10).map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/20 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-primary font-bold">{tx.number}</td>
                      <td className="px-4 py-3">
                        {tx.register ? `${tx.register.code} - ${tx.register.name}` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 font-bold">{tx.customer}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(tx.total)}</td>
                      <td className="px-4 py-3 text-center">
                        {tx.hasIVA ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px]">15% IVA</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px]">EXONERADO</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Action */}
      {onNavigateToFacturacion && (
        <div className="flex justify-end">
          <Button onClick={onNavigateToFacturacion} className="gap-2 rounded-xl">
            <ShoppingCart className="size-4" /> Ir a Facturación por Caja
          </Button>
        </div>
      )}
    </div>
  );
}
