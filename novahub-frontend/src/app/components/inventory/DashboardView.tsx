import { Package, Warehouse, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { normalizeCurrency, summarizeAmountsByCurrency, type SupportedCurrency } from '../../utils/currency';

export function DashboardView({ products, warehouses, movements = [], transfers = [], adjustments = [] }: any) {
  const { displayCurrency, displayMode, valuationMode, formatExplicitAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const { canPerform } = useAuth();
  const canViewInventoryCost = canPerform('INVENTORY', 'viewCost');
  const stockInfo = (product: any) => {
    const levels = Array.isArray(product?.stockLevels) ? product.stockLevels : [];
    const stock = levels.length > 0
      ? levels.reduce((sum: number, level: any) => sum + Number(level?.quantity || 0), 0)
      : Number(product?.stock || 0);
    const configuredMinStock = Number(product?.minStock ?? product?.details?.minStock ?? 0);
    const defaultMinimum = configuredMinStock > 0 ? configuredMinStock : 10;
    const hasLowLevel = levels.length > 0
      ? levels.some((level: any) => Number(level?.quantity || 0) > 0 && Number(level?.quantity || 0) <= (Number(level?.minStock || 0) > 0 ? Number(level.minStock) : defaultMinimum))
      : stock > 0 && stock <= defaultMinimum;
    return { stock, hasLowLevel, outOfStock: stock <= 0 };
  };
  const productValue = (product: any) => stockInfo(product).stock * Number(product.costPrice ?? product.details?.costPrice ?? 0);
  const totalValue = products.reduce((acc: number, product: any) => {
    const amount = productValue(product);
    return acc + (valuationMode === 'CURRENT' ? convertCurrentAmount(amount, product.currency) : convertAmount(amount, product.currency, product.exchangeRate));
  }, 0);
  const originalCurrencies = summarizeAmountsByCurrency(products, productValue, (product: any) => product.currency).map((item) => item.currency);
  const originalValue = (currency: SupportedCurrency) => products
    .filter((product: any) => normalizeCurrency(product.currency) === currency)
    .reduce((acc: number, product: any) => acc + productValue(product), 0);
  const originalProductCount = (currency: SupportedCurrency) => products.filter((product: any) => normalizeCurrency(product.currency) === currency).length;
  const totalStockUnits = products.reduce((acc: number, p: any) => acc + stockInfo(p).stock, 0);
  const averageTicketValue = products.length > 0 ? totalValue / products.length : 0;
  const lowStockCount = products.filter((p: any) => stockInfo(p).hasLowLevel).length;
  const outOfStockCount = products.filter((p: any) => stockInfo(p).outOfStock).length;
  const pendingTransfers = transfers.filter((t: any) => ['PENDING', 'IN_TRANSIT'].includes(String(t.status || '').toUpperCase())).length;
  const draftAdjustments = adjustments.filter((a: any) => String(a.status || '').toUpperCase() === 'DRAFT').length;
  
  const stats = [
    { label: 'Total Productos', value: products.length, icon: Package, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Valor Total', value: totalValue, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10', isCurrency: true },
    { label: 'Almacenes', value: warehouses.length, icon: Warehouse, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Stock Bajo', value: lowStockCount + outOfStockCount, icon: AlertTriangle, color: lowStockCount + outOfStockCount > 0 ? 'text-warning' : 'text-success', bg: lowStockCount + outOfStockCount > 0 ? 'bg-warning/10' : 'bg-success/10' },
    { label: 'Unidades en Stock', value: totalStockUnits, icon: Package, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Valor Promedio/Producto', value: averageTicketValue, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10', isCurrency: true },
    { label: 'Transferencias Pendientes', value: pendingTransfers, icon: Clock, color: pendingTransfers > 0 ? 'text-warning' : 'text-success', bg: pendingTransfers > 0 ? 'bg-warning/10' : 'bg-success/10' },
    { label: 'Ajustes por Aprobar', value: draftAdjustments, icon: AlertTriangle, color: draftAdjustments > 0 ? 'text-destructive' : 'text-success', bg: draftAdjustments > 0 ? 'bg-destructive/10' : 'bg-success/10' },
  ].filter((stat) => canViewInventoryCost || !stat.isCurrency);

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

  const lowStockProducts = products.filter((p: any) => stockInfo(p).hasLowLevel || stockInfo(p).outOfStock).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.flatMap((stat, statIndex) => {
          const entries = stat.isCurrency && displayMode === 'ORIGINAL'
            ? originalCurrencies.map((currency) => ({ ...stat, label: `${stat.label} (${currency})`, value: stat.label === 'Valor Total' ? originalValue(currency) : originalValue(currency) / Math.max(1, originalProductCount(currency)), sourceCurrency: currency }))
            : [{ ...stat, sourceCurrency: displayCurrency }];
          return entries.map((entry, entryIndex) => (
            <Card key={`${entry.label}-${statIndex}-${entryIndex}`} className="border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{entry.label}</p>
                    <h3 className="mt-1 text-2xl font-black tracking-tighter italic">
                      {entry.isCurrency ? formatExplicitAmount(entry.value as number, entry.sourceCurrency) : entry.value}
                    </h3>
                  </div>
                  <div className={`rounded-lg p-2 ${entry.bg}`}>
                    <entry.icon className={`size-4 ${entry.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ));
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              Stock <span className="text-warning">Bajo</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length > 0 ? (
              <div className="space-y-2">
                {lowStockProducts.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold italic truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">{p.code}</p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${stockInfo(p).outOfStock ? 'text-destructive' : 'text-warning'}`}>
                      {stockInfo(p).stock} uds
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
                  <div key={i} className="flex items-start gap-2 py-2 border-b last:border-0 overflow-hidden">
                    <div className={`mt-1.5 size-2 shrink-0 rounded-full ${act.alert ? 'bg-warning inventory-status-glow-warning' : 'bg-primary inventory-status-glow-primary'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{act.desc}</p>
                      <p className="text-xs text-muted-foreground truncate">{act.type} · {act.date.toLocaleDateString()}</p>
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

