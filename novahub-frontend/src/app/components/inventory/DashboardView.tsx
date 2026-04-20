import React from 'react';
import { Package, Warehouse, AlertTriangle, TrendingUp, Clock, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useCurrency } from '../../contexts/CurrencyContext';
import { cn } from '../ui/utils';

export function DashboardView({ products, warehouses, movements = [], transfers = [], adjustments = [] }: any) {
  const { formatAmount } = useCurrency();
  const totalValue = products.reduce((acc: number, p: any) => acc + ((p.stock || 0) * (p.costPrice || 0)), 0);
  const totalStockUnits = products.reduce((acc: number, p: any) => acc + Number(p.stock || 0), 0);
  const averageTicketValue = products.length > 0 ? totalValue / products.length : 0;
  const lowStockCount = products.filter((p: any) => (p.stock || 0) < 10 && (p.stock || 0) > 0).length;
  const outOfStockCount = products.filter((p: any) => (p.stock || 0) === 0).length;
  const pendingTransfers = transfers.filter((t: any) => ['PENDING', 'IN_TRANSIT'].includes(String(t.status || '').toUpperCase())).length;
  const draftAdjustments = adjustments.filter((a: any) => String(a.status || '').toUpperCase() === 'DRAFT').length;
  
  const stats = [
    { label: 'Total Productos', value: products.length, icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Valor Total', value: totalValue, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', isCurrency: true },
    { label: 'Almacenes', value: warehouses.length, icon: Warehouse, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Stock Bajo/Cero', value: lowStockCount + outOfStockCount, icon: AlertTriangle, color: lowStockCount + outOfStockCount > 0 ? 'text-rose-500' : 'text-emerald-500', bg: lowStockCount + outOfStockCount > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10' },
    { label: 'Unidades en Stock', value: totalStockUnits, icon: Package, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { label: 'Valor Promedio', value: averageTicketValue, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10', isCurrency: true },
    { label: 'Transferencias', value: pendingTransfers, icon: Clock, color: pendingTransfers > 0 ? 'text-amber-500' : 'text-emerald-500', bg: pendingTransfers > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10' },
    { label: 'Ajustes Pendientes', value: draftAdjustments, icon: AlertTriangle, color: draftAdjustments > 0 ? 'text-rose-500' : 'text-emerald-500', bg: draftAdjustments > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10' },
  ];

  const recentActivity = [
    ...movements.slice(0, 4).map((m: any) => ({
      type: m.type === 'IN' ? 'Entrada' : m.type === 'OUT' ? 'Salida' : 'Mov',
      desc: `${m.product?.name || 'Producto'}`,
      info: `${m.quantity} unidades`,
      location: m.warehouse?.name || '',
      date: new Date(m.date),
      alert: false
    })),
    ...transfers.filter((t: any) => t.status === 'PENDING' || t.status === 'IN_TRANSIT').slice(0, 2).map((t: any) => ({
      type: 'Transf.',
      desc: `${t.from?.name || ''} → ${t.to?.name || ''}`,
      info: t.number,
      location: t.to?.name,
      date: new Date(t.date),
      alert: true
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);

  const lowStockProducts = products.filter((p: any) => (p.stock || 0) < 10).sort((a: any, b: any) => (a.stock || 0) - (b.stock || 0)).slice(0, 6);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-border/50 bg-card/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em]">{stat.label}</p>
                  <h3 className="text-2xl font-black mt-1 tracking-tighter italic">
                    {stat.isCurrency ? formatAmount(stat.value as number) : stat.value}
                  </h3>
                </div>
                <div className={cn("p-3 rounded-xl transition-colors", stat.bg)}>
                  <stat.icon className={cn("size-5", stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50 rounded-2xl overflow-hidden shadow-sm">
          <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-rose-500" />
                Control de <span className="text-rose-500">Stock Crítico</span>
              </span>
              <span className="text-muted-foreground/40 font-bold">{lowStockProducts.length} detectados</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lowStockProducts.length > 0 ? (
              <div className="divide-y divide-border/40">
                {lowStockProducts.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-tight truncate group-hover:text-primary transition-colors">{p.name}</p>
                      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest truncate mt-0.5">{p.code} · {p.category?.name || 'SIN CATEGORÍA'}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                       <div className="text-right">
                          <p className={cn("text-xs font-black tracking-tighter", (p.stock || 0) === 0 ? 'text-rose-600' : 'text-amber-600')}>
                            {p.stock || 0} UNIDADES
                          </p>
                          <p className="text-[9px] font-black text-muted-foreground/30 uppercase">Existencia</p>
                       </div>
                       <ArrowRight className="size-3 text-muted-foreground/20 group-hover:text-primary/40 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                 <Package className="size-12 mx-auto mb-4 text-emerald-500/10" />
                 <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/40">Inventario saludable</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50 rounded-2xl overflow-hidden shadow-sm">
          <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                Historial de <span className="text-primary">Movimientos</span>
              </span>
              <span className="text-muted-foreground/40 font-bold">Últimos eventos</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length > 0 ? (
              <div className="divide-y divide-border/40">
                {recentActivity.map((act: any, i: number) => (
                  <div key={i} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors group">
                    <div className={cn("mt-0.5 p-2 rounded-lg shrink-0", act.alert ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary')}>
                      {act.type === 'Transf.' ? <Warehouse className="size-3.5" /> : <Package className="size-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                         <p className="text-xs font-black uppercase tracking-tight truncate">{act.desc}</p>
                         <span className="text-[9px] font-black text-muted-foreground/30 shrink-0">{act.date.toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={cn("text-[8px] font-black h-4 px-1 border-none shadow-none uppercase", act.type === 'Entrada' ? 'bg-emerald-500/10 text-emerald-600' : act.type === 'Salida' ? 'bg-rose-500/10 text-rose-600' : 'bg-primary/10 text-primary')}>
                          {act.type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-bold tracking-tight truncate">{act.info} · {act.location}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                 <Clock className="size-12 mx-auto mb-4 text-muted-foreground/10" />
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/30">Sin actividad reciente</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="px-2 text-[9px] text-muted-foreground font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4">
        <span>NovaHub Analytics</span>
        <div className="size-1 rounded-full bg-border" />
        <span>Inventory Real-time Monitoring</span>
      </div>
    </div>
  );
}

