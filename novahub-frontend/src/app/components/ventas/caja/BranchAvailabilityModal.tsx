import { useState } from 'react';
import { Loader2, Search, Store, PackageSearch, ShoppingCart } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { cn } from '../../ui/utils';
import type { PosProduct, BranchProductAvailability } from '../../../services/caja.service';

export interface HoldReservationSelection {
  deliveryClientTenantId: string;
  deliveryWarehouseId: string | null;
  notes?: string;
  payNow: boolean;
}

interface BranchAvailabilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: PosProduct | null;
  requestedQuantity: number;
  availability: BranchProductAvailability[];
  loading: boolean;
  submitting: boolean;
  onSubmit: (selection: HoldReservationSelection) => void;
}

export function BranchAvailabilityModal({
  open,
  onOpenChange,
  product,
  requestedQuantity,
  availability,
  loading,
  submitting,
  onSubmit,
}: BranchAvailabilityModalProps) {
  // Solo se persiste la selección explícita del usuario; si apunta a una
  // sucursal ya no disponible o llegan datos nuevos, se cae al primer
  // resultado disponible sin necesidad de efectos.
  const [explicitWarehouseId, setExplicitWarehouseId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [payNow, setPayNow] = useState(false);

  const firstAvailable = availability.find((row) => row.available && row.warehouseId)?.warehouseId || null;
  const selectedWarehouseId =
    explicitWarehouseId && availability.some((row) => row.warehouseId === explicitWarehouseId && row.available)
      ? explicitWarehouseId
      : firstAvailable;

  const selectedRow = availability.find((row) => row.warehouseId === selectedWarehouseId) || null;
  const canSubmit = Boolean(product && requestedQuantity > 0 && selectedRow && !loading && !submitting);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setExplicitWarehouseId(null);
      setNotes('');
      setPayNow(false);
    }
    onOpenChange(next);
  };

  const handleSubmit = () => {
    if (!canSubmit || !selectedRow) return;
    onSubmit({
      deliveryClientTenantId: selectedRow.branchId,
      deliveryWarehouseId: selectedRow.warehouseId,
      notes: notes.trim() || undefined,
      payNow,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sales-modal sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <PackageSearch className="size-5 text-primary" /> Disponibilidad en otras sucursales
          </DialogTitle>
          <DialogDescription>
            {product ? (
              <>
                <span className="font-bold text-foreground">{product.name}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{product.code}</span>
                {' · '}cantidad solicitada: <span className="font-bold text-foreground">{requestedQuantity}</span>
              </>
            ) : 'Consultando disponibilidad del producto en el resto de sucursales.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs">Consultando existencias en las sucursales...</p>
            </div>
          ) : availability.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 py-10 text-center">
              <Search className="size-6 text-muted-foreground" />
              <p className="max-w-xs text-xs text-muted-foreground">
                No hay sucursales con existencias disponibles para esta cantidad, o no tienes acceso a sus inventarios.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-border/50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/30">
                      <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sucursal</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Stock disponible</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cant. solicitada</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">Disponible</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">Entregar desde</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {availability.map((row) => (
                      <tr key={row.branchId} className={cn('transition-colors', row.available ? 'hover:bg-muted/20' : 'opacity-60')}>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Store className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="font-bold">{row.branchName}</span>
                          </div>
                          {row.warehouseName && <p className="pl-5 text-[10px] text-muted-foreground">{row.warehouseName}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">{row.currentStock}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{row.requestedQuantity}</td>
                        <td className="px-3 py-2.5 text-center">
                          {row.available ? (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-[9px] text-emerald-600 dark:text-emerald-400">Sí</Badge>
                          ) : (
                            <Badge variant="outline" className="border-rose-500/30 bg-rose-500/5 text-[9px] text-rose-600 dark:text-rose-400">No</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {row.available && row.warehouseId ? (
                            <input
                              type="radio"
                              name="delivery-branch"
                              checked={selectedWarehouseId === row.warehouseId}
                              onChange={() => setExplicitWarehouseId(row.warehouseId)}
                              className="size-3.5 accent-primary"
                            />
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-[11px] text-muted-foreground">
                La venta se factura desde tu caja y el producto se entregará desde la sucursal seleccionada.
                El stock queda <span className="font-bold text-foreground">reservado</span> para esta venta hasta que se entregue o cancele.
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Observaciones (opcional)</Label>
                <Input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ej. coordinar retiro antes de las 5 pm"
                  className="h-9 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3">
                <div className="pr-4">
                  <p className="text-xs font-black uppercase tracking-wider">Cobrar ahora</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Emite la factura y cobra en esta caja; la entrega queda pendiente en la sucursal seleccionada.
                  </p>
                </div>
                <Switch checked={payNow} onCheckedChange={setPayNow} />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShoppingCart className="size-4" />}
            {payNow ? 'Cobrar y reservar venta' : 'Reservar venta (cobro al entregar)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
