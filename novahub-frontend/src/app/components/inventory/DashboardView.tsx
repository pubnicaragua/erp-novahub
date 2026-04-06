import React from 'react';
import { Package, Warehouse, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useCurrency } from '../../contexts/CurrencyContext';

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
    { label: 'Valor Total', value: totalValue, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10', isCurrency: true },
    { label: 'Almacenes', value: warehouses.length, icon: Warehouse, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Stock Bajo', value: lowStockCount + outOfStockCount, icon: AlertTriangle, color: lowStockCount + outOfStockCount > 0 ? 'text-orange-500' : 'text-green-500', bg: lowStockCount + outOfStockCount > 0 ? 'bg-orange-500/10' : 'bg-green-500/10' },
    { label: 'Unidades en Stock', value: totalStockUnits, icon: Package, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { label: 'Valor Promedio/Producto', value: averageTicketValue, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', isCurrency: true },
    { label: 'Transferencias Pendientes', value: pendingTransfers, icon: Clock, color: pendingTransfers > 0 ? 'text-amber-500' : 'text-green-500', bg: pendingTransfers > 0 ? 'bg-amber-500/10' : 'bg-green-500/10' },
    { label: 'Ajustes por Aprobar', value: draftAdjustments, icon: AlertTriangle, color: draftAdjustments > 0 ? 'text-rose-500' : 'text-green-500', bg: draftAdjustments > 0 ? 'bg-rose-500/10' : 'bg-green-500/10' },
  ];

  const recentActivity = [
    ...movements.slice(0, 4).map((m: any) => ({
      type: m.type === 'IN' ? 'Entrada' : m.type === 'OUT' ? 'Salida' : 'Mov',
      desc: `${m.product?.name || 'Producto'} (${m.quantity} uds)`,
      location: m.warehouse?.name || '',
      date: new Date(m.date),
      alert: false
    })),
    ...transfers.filter((t: any) => t.status === 'PENDING' || t.status === 'IN_TRANSIT').slice(0, 2).map((t: any) => ({
      type: 'Transfer',
      desc: `${t.from?.name || ''} → ${t.to?.name || ''}`,
      location: t.number,
      date: new Date(t.date),
      alert: t.status === 'PENDING'
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

  const lowStockProducts = products.filter((p: any) => (p.stock || 0) < 10).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <Card key={i} className="border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{stat.label}</p>
                  <h3 className="text-2xl font-black mt-1 tracking-tighter italic">
                    {stat.isCurrency ? formatAmount(stat.value as number) : stat.value}
                  </h3>
                </div>
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`size-4 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="size-4 text-orange-500" />
              Stock <span className="text-orange-500">Bajo</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length > 0 ? (
              <div className="space-y-2">
                {lowStockProducts.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-bold italic">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{p.code}</p>
                    </div>
                    <span className={`text-sm font-bold ${(p.stock || 0) === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                      {p.stock || 0} uds
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Todos los productos tienen stock suficiente</p>
            )}
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              Actividad <span className="text-primary">Reciente</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((act: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 py-2 border-b last:border-0">
                    <div className={`mt-1.5 size-2 rounded-full ${act.alert ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'bg-primary shadow-[0_0_8px_rgba(6,114,49,0.5)]'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{act.desc}</p>
                      <p className="text-xs text-muted-foreground">{act.type} · {act.date.toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No hay actividad reciente</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
