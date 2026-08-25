"use client"

import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, Info, Package, Scale, X } from "lucide-react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Separator } from "../ui/separator"
import { useAuth } from '../../contexts/AuthContext'
import { InventoryViewTutorial } from './InventoryViewTutorial'

interface InventoryDetailPanelProps {
  kind: "transfer" | "adjustment"
  data: any
  onClose: () => void
}

const REASON_LABELS: Record<string, string> = {
  DISCREPANCY: 'Discrepancia',
  DAMAGE: 'Daño',
  THEFT: 'Robo',
  EXPIRATION: 'Vencimiento',
  OTHER: 'Otro',
};

function StatCard({ label, value, className, valueClassName }: { label: string; value: React.ReactNode; className?: string; valueClassName?: string }) {
  return (
    <div className={`rounded-xl border p-3 ${className || 'border-border/60 bg-muted/20'}`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 break-words font-mono text-sm font-bold tabular-nums ${valueClassName || ''}`}>{value}</p>
    </div>
  );
}

function TransferDetail({ data }: { data: any }) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const totalUnits = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Transferencia seleccionada</p>
        <h3 className="mt-1 truncate text-lg font-black tracking-tight" title={data.number}>{data.number}</h3>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Unidades</p>
            <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{totalUnits}</p>
          </div>
          <Badge variant="outline" className="shrink-0 bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-600">
            <Check className="mr-1 size-3" /> Completada
          </Badge>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 2xl:grid-cols-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fecha</p>
          <p className="mt-1 text-sm font-semibold">{new Date(data.date).toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' })}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID</p>
          <p className="break-all font-mono text-xs text-muted-foreground" title={data.id}>{data.id}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Origen" value={data.from?.name || '—'} />
        <StatCard label="Destino" value={data.to?.name || '—'} />
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Movimiento de stock</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px] font-black">-{totalUnits}</Badge>
          <span className="min-w-0 max-w-36 truncate text-xs font-semibold" title={data.from?.name}>{data.from?.name || '—'}</span>
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-black">+{totalUnits}</Badge>
          <span className="min-w-0 max-w-36 truncate text-xs font-semibold" title={data.to?.name}>{data.to?.name || '—'}</span>
        </div>
      </div>

      <section className="min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <Package className="size-4 text-primary" />
          <h3 className="truncate text-sm font-black uppercase tracking-tight">Artículos transferidos</h3>
        </div>
        <div className="overflow-hidden rounded-xl border border-border/60">
          <div className="divide-y divide-border/60">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">Sin artículos registrados.</p>
            )}
            {items.map((item: any) => {
              const product = item.variant?.product || {};
              const variantName = item.variant?.name || item.variant?.sku || '';
              const itemQty = Number(item.quantity || 0);
              return (
                <div key={item.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    <Package className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold" title={product.name || 'Producto'}>{product.name || 'Producto'}</p>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">
                      {[product.code, variantName].filter(Boolean).join(' · ') || 'Sin referencia'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-black text-rose-600">-{itemQty}</span>
                      <span className="max-w-28 truncate text-[9px] text-muted-foreground">{data.from?.name || '—'}</span>
                      <ArrowRight className="size-2.5 text-muted-foreground" />
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-black text-emerald-600">+{itemQty}</span>
                      <span className="max-w-28 truncate text-[9px] text-muted-foreground">{data.to?.name || '—'}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[11px] font-bold tabular-nums">×{itemQty}</div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{items.length} {items.length === 1 ? 'artículo' : 'artículos'}</p>
      </section>
    </div>
  );
}

function AdjustmentDetail({ data, canViewInventoryCost }: { data: any; canViewInventoryCost: boolean }) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const totalDelta = items.reduce((sum: number, item: any) => sum + (Number(item.actualStock || 0) - Number(item.currentStock || 0)), 0);
  const referenceCost = items[0]?.unitCost != null ? `${items[0].currency || ''} ${Number(items[0].unitCost || 0)}` : '—';
  const approved = data.status === 'APPROVED';

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Ajuste seleccionado</p>
        <h3 className="mt-1 truncate text-lg font-black tracking-tight" title={data.number}>{data.number}</h3>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cantidad neta</p>
            <p className={`mt-1 text-2xl font-black tabular-nums tracking-tight ${totalDelta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {totalDelta >= 0 ? '+' : ''}{totalDelta}
            </p>
          </div>
          <Badge className={approved ? 'bg-emerald-500/10 text-[10px] text-emerald-600' : 'bg-muted text-[10px] text-muted-foreground'}>
            {approved ? 'Aprobado' : 'Borrador'}
          </Badge>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 2xl:grid-cols-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fecha</p>
          <p className="mt-1 text-sm font-semibold">{new Date(data.date).toLocaleString('es-NI', { dateStyle: 'long', timeStyle: 'short' })}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Almacén</p>
          <p className="truncate text-sm font-semibold" title={data.warehouse?.name}>{data.warehouse?.name || '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Razón</p>
          <p className="truncate text-sm font-semibold" title={REASON_LABELS[data.reason] || data.reason}>{REASON_LABELS[data.reason] || data.reason || '—'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID</p>
          <p className="break-all font-mono text-xs text-muted-foreground" title={data.id}>{data.id}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Cantidad neta"
          value={`${totalDelta >= 0 ? '+' : ''}${totalDelta}`}
          className={totalDelta >= 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}
          valueClassName={totalDelta >= 0 ? 'text-emerald-600' : 'text-rose-500'}
        />
        {canViewInventoryCost && <StatCard label="Costo referencia" value={referenceCost} />}
      </div>

      <section className="min-w-0">
        <div className="mb-3 flex items-center gap-2">
          <Scale className="size-4 text-primary" />
          <h3 className="truncate text-sm font-black uppercase tracking-tight">Artículos ajustados</h3>
        </div>
        <div className="overflow-hidden rounded-xl border border-border/60">
          <div className="divide-y divide-border/60">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">Sin artículos registrados.</p>
            )}
            {items.map((item: any) => {
              const delta = Number(item.actualStock || 0) - Number(item.currentStock || 0);
              const isEntry = delta >= 0;
              return (
                <div key={item.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-3 py-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    {isEntry
                      ? <ArrowDownLeft className="size-3.5 text-emerald-600" />
                      : <ArrowUpRight className="size-3.5 text-rose-500" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold" title={item.product?.name || 'Producto'}>{item.product?.name || 'Producto'}</p>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">
                      {item.product?.code || 'Sin referencia'}
                      {canViewInventoryCost && <> · {item.currency || ''} {Number(item.unitCost || 0)}</>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[11px] font-bold tabular-nums">
                    <p className={isEntry ? 'text-emerald-600' : 'text-rose-500'}>{isEntry ? '+' : ''}{delta}</p>
                    <p className="mt-0.5 text-[9px] font-medium text-muted-foreground">real {Number(item.actualStock || 0)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{items.length} {items.length === 1 ? 'artículo' : 'artículos'}</p>
      </section>
    </div>
  );
}

export function InventoryDetailPanel({ kind, data, onClose }: InventoryDetailPanelProps) {
  const isTransfer = kind === 'transfer';
  const { canPerform } = useAuth();
  const canViewInventoryCost = canPerform('INVENTORY_ADJUSTMENTS', 'viewCost');

  return (
    <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start">
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4" data-tour="inventory-detail-title">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">{isTransfer ? 'Detalle de Transferencia' : 'Detalle de Ajuste'}</CardTitle>
            </div>
            <div className="flex items-center gap-1" data-tour="inventory-detail-actions">
            <InventoryViewTutorial label={isTransfer ? 'Cómo consultar transferencia' : 'Cómo consultar ajuste'} targetPrefix="inventory-detail" stepKeys={['title', 'data']} copy={{ data: { description: isTransfer ? 'Revisa origen, destino, unidades y artículos transferidos.' : 'Revisa almacén, razón, cantidades, costos y diferencias del ajuste.' } }} />
            <Button variant="ghost" size="icon" className="w-6 h-6" onClick={onClose}>
              <X className="w-3.5 h-3.5" />
            </Button>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="max-h-[calc(100vh-6rem)] space-y-5 overflow-y-auto p-4 sm:p-5" data-tour="inventory-detail-data">
          {data && (isTransfer ? <TransferDetail data={data} /> : <AdjustmentDetail data={data} canViewInventoryCost={canViewInventoryCost} />)}
        </CardContent>
      </Card>
    </div>
  );
}
