import { useEffect, useState } from 'react';
import { Clock, Loader2, XCircle, ChevronDown, ChevronRight, PackageCheck, Store } from 'lucide-react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { cn } from '../../ui/utils';
import { formatSalesAmount } from '../../../utils/salesPriceList';
import type { PosHold } from '../../../services/caja.service';

export const POS_HOLD_STATUS_META: Record<string, { label: string; className: string }> = {
  SUSPENDED: { label: 'Suspendida', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  READY: { label: 'Cobrada', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  DELIVERED: { label: 'Entregada', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  CANCELLED: { label: 'Cancelada', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
};

export function formatHoldDate(date: string) {
  return new Date(date).toLocaleDateString('es-NI');
}

function formatHoldCurrency(hold: PosHold) {
  return hold.currency === 'USD' ? '$' : 'C$';
}

interface SuspendedSalesPanelProps {
  holds: PosHold[];
  loading: boolean;
  branches: { id: string; name: string }[];
  deliveryBranchFilter: string;
  onDeliveryBranchFilterChange: (branchId: string) => void;
  canPay: boolean;
  canDeliver: (hold: PosHold) => boolean;
  onConfirm: (hold: PosHold) => void;
  onDeliver: (hold: PosHold) => void;
  onCancel: (hold: PosHold) => void;
  highlightHoldId?: string | null;
}

export function SuspendedSalesPanel({
  holds,
  loading,
  branches,
  deliveryBranchFilter,
  onDeliveryBranchFilterChange,
  canPay,
  canDeliver,
  onConfirm,
  onDeliver,
  onCancel,
  highlightHoldId,
}: SuspendedSalesPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(() => (highlightHoldId ? highlightHoldId : null));

  useEffect(() => {
    if (!highlightHoldId) return;
    const timer = setTimeout(() => {
      document.getElementById(`hold-${highlightHoldId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    return () => clearTimeout(timer);
  }, [highlightHoldId]);

  const pendingCount = holds.filter((hold) => hold.status !== 'DELIVERED' && hold.status !== 'CANCELLED').length;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
              <Clock className="size-4 text-primary" /> Ventas Suspendidas
              {pendingCount > 0 && (
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[9px] text-primary">{pendingCount} pendientes</Badge>
              )}
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Ventas facturadas o reservadas cuya entrega ocurre desde otra sucursal.
            </p>
          </div>
          <div className="w-full lg:w-64">
            <Select
              value={deliveryBranchFilter}
              onValueChange={onDeliveryBranchFilterChange}
            >
              <SelectTrigger className="h-9 rounded-lg text-xs">
                <SelectValue placeholder="Todas las sucursales de entrega" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales de entrega</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="text-xs">Cargando ventas suspendidas...</p>
          </div>
        ) : holds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-xs text-muted-foreground">
            No hay ventas suspendidas con los filtros seleccionados.
          </div>
        ) : (
          <div className="space-y-2">
            {holds.map((hold) => {
              const statusMeta = POS_HOLD_STATUS_META[hold.status] || { label: hold.status, className: '' };
              const isExpanded = expandedId === hold.id;
              const isActionable = hold.status === 'SUSPENDED' || (hold.status === 'READY' && hold.deliveryStatus !== 'DELIVERED');
              const isHighlighted = highlightHoldId === hold.id;
              return (
                <div
                  key={hold.id}
                  id={`hold-${hold.id}`}
                  className={cn(
                    'rounded-xl border transition-colors scroll-mt-4',
                    isHighlighted
                      ? 'border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/10'
                      : isActionable
                        ? 'border-border/50 bg-card hover:border-primary/30'
                        : 'border-border/30 bg-muted/10',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : hold.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {isExpanded ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                      <span className="font-mono text-[10px] font-bold text-primary">{hold.number}</span>
                      {hold.invoiceNumber && <span className="font-mono text-[10px] text-muted-foreground">{hold.invoiceNumber}</span>}
                      <Badge variant="outline" className={cn('text-[9px]', statusMeta.className)}>{statusMeta.label}</Badge>
                      {hold.status === 'READY' && hold.deliveryStatus !== 'DELIVERED' && (
                        <Badge variant="outline" className="text-[9px]">Entrega pendiente</Badge>
                      )}
                      <span className="min-w-0 truncate text-xs font-bold">
                        {hold.customer?.name || hold.customCustomerName || 'Cliente General'}
                      </span>
                      <span className="hidden text-[10px] text-muted-foreground sm:inline">· {formatHoldDate(hold.date)}</span>
                      <span className="hidden items-center gap-1 text-[10px] text-muted-foreground lg:flex">
                        <Store className="size-3" /> {hold.deliveryBranch?.name || '—'}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-xs font-black">{formatHoldCurrency(hold)} {formatSalesAmount(hold.total)}</span>
                      {hold.status === 'SUSPENDED' && canPay && (
                        <Button size="sm" onClick={(event) => { event.stopPropagation(); onConfirm(hold); }} className="h-7 rounded-lg px-2 text-[10px] font-black">
                          Cobrar
                        </Button>
                      )}
                      {hold.status === 'READY' && hold.deliveryStatus !== 'DELIVERED' && canDeliver(hold) && (
                        <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); onDeliver(hold); }} className="h-7 gap-1 rounded-lg border-emerald-500/30 px-2 text-[10px] font-black text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
                          <PackageCheck className="size-3" /> Entregar
                        </Button>
                      )}
                      {hold.status === 'SUSPENDED' && (
                        <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); onCancel(hold); }} className="h-7 gap-1 rounded-lg px-2 text-[10px] font-black text-destructive hover:bg-destructive/10">
                          <XCircle className="size-3" /> Cancelar
                        </Button>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/30 px-4 py-3">
                      <div className="grid gap-3 text-[11px] sm:grid-cols-2">
                        <div className="space-y-1 text-muted-foreground">
                          <p><span className="font-black uppercase tracking-wider text-[9px]">Factura desde:</span> <span className="font-bold text-foreground">{hold.billingBranch?.name || '—'}</span></p>
                          <p><span className="font-black uppercase tracking-wider text-[9px]">Entrega desde:</span> <span className="font-bold text-foreground">{hold.deliveryBranch?.name || '—'}</span></p>
                          <p><span className="font-black uppercase tracking-wider text-[9px]">Caja:</span> <span className="font-bold text-foreground">{hold.register ? `${hold.register.code} - ${hold.register.name}` : '—'}</span></p>
                          <p><span className="font-black uppercase tracking-wider text-[9px]">Cobro:</span> <span className="font-bold text-foreground">{hold.payNow ? 'Cobrada al reservar' : 'Al entregar'}</span></p>
                          <p><span className="font-black uppercase tracking-wider text-[9px]">Facturó:</span> <span className="font-bold text-foreground">{hold.createdBy?.name || '—'}</span></p>
                          {hold.deliveredBy && <p><span className="font-black uppercase tracking-wider text-[9px]">Entregó:</span> <span className="font-bold text-foreground">{hold.deliveredBy.name}</span></p>}
                        </div>
                        <div className="space-y-1 text-muted-foreground">
                          {hold.deliveredAt && <p><span className="font-black uppercase tracking-wider text-[9px]">Entregada:</span> <span className="font-bold text-foreground">{formatHoldDate(hold.deliveredAt)}</span></p>}
                          {hold.confirmedAt && <p><span className="font-black uppercase tracking-wider text-[9px]">Cobrada:</span> <span className="font-bold text-foreground">{formatHoldDate(hold.confirmedAt)}</span></p>}
                          {hold.cancelledAt && <p><span className="font-black uppercase tracking-wider text-[9px]">Cancelada:</span> <span className="font-bold text-foreground">{formatHoldDate(hold.cancelledAt)}</span></p>}
                          {hold.notes && <p><span className="font-black uppercase tracking-wider text-[9px]">Observaciones:</span> <span className="font-bold text-foreground">{hold.notes}</span></p>}
                        </div>
                      </div>
                      <div className="mt-3 overflow-hidden rounded-lg border border-border/40">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="bg-muted/30 border-b border-border/30">
                              <th className="px-3 py-1.5 text-left font-black uppercase tracking-widest text-[9px] text-muted-foreground">Producto</th>
                              <th className="px-3 py-1.5 text-center font-black uppercase tracking-widest text-[9px] text-muted-foreground">Cant.</th>
                              <th className="px-3 py-1.5 text-right font-black uppercase tracking-widest text-[9px] text-muted-foreground">P. unit.</th>
                              <th className="px-3 py-1.5 text-right font-black uppercase tracking-widest text-[9px] text-muted-foreground">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {hold.items.map((item) => (
                              <tr key={item.id}>
                                <td className="px-3 py-1.5 font-bold">{item.description}</td>
                                <td className="px-3 py-1.5 text-center font-mono">{item.quantity}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{formatSalesAmount(item.unitPrice)}</td>
                                <td className="px-3 py-1.5 text-right font-mono font-bold">{formatSalesAmount(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
