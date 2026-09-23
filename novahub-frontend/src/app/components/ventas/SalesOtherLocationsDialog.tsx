import { useQuery } from '@tanstack/react-query';
import { MapPin, Warehouse } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { inventoryService } from '../../services/inventario.service';
import type { SalesOtherLocationsViewModule } from '../../services/inventario.service';
import { formatSalesStock, type SalesStockProduct } from '../../utils/sales-stock';

type OtherLocationsProduct = SalesStockProduct & {
  id: string;
  name?: string | null;
  code?: string | null;
};

type SalesOtherLocationsDialogProps = {
  product?: OtherLocationsProduct | null;
  warehouseId?: string | null;
  viewModule: SalesOtherLocationsViewModule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const locationTypeLabel = (location: { sourceType: string; isCurrentBranch?: boolean }) => location.isCurrentBranch
  ? 'Otra bodega de esta sucursal'
  : location.sourceType === 'ALMACEN_GRUPO'
  ? 'Almacén de grupo'
  : location.sourceType === 'ALMACEN_RUBRO'
    ? 'Almacén del rubro'
    : 'Sucursal';

/** Consulta informativa; no expone controles para elegir o usar una ubicación ajena. */
export function SalesOtherLocationsDialog({ product, warehouseId, viewModule, open, onOpenChange }: SalesOtherLocationsDialogProps) {
  const locationsQuery = useQuery({
    queryKey: ['sales', 'product-other-locations', product?.id, warehouseId || null, viewModule],
    queryFn: ({ signal }) => inventoryService.getSalesProductOtherLocations(product!.id, warehouseId, viewModule, signal),
    enabled: open && Boolean(product?.id),
  });
  const locations = locationsQuery.data?.locations || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] max-w-2xl gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="shrink-0 px-4 pb-3 pr-14 pt-4 text-left sm:px-6 sm:pb-4 sm:pt-6">
          <DialogTitle className="break-words">Existencias en otras ubicaciones</DialogTitle>
          <DialogDescription>
            {product?.name || 'Producto'}{product?.code ? ` · ${product.code}` : ''}. Disponible por bodega y sucursal del mismo grupo y rubro.
          </DialogDescription>
        </DialogHeader>

        <div role="region" aria-label="Existencias por otras ubicaciones" tabIndex={0} className="max-h-[min(56dvh,calc(100dvh-12rem),34rem)] min-h-0 min-w-0 space-y-2 overflow-y-auto overscroll-contain px-4 pb-2 scrollbar-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6">
          {locationsQuery.isPending ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Consultando otras ubicaciones…</p>
          ) : locationsQuery.isError ? (
            <p role="alert" className="py-10 text-center text-sm text-destructive">No se pudieron consultar las existencias. Cierra e inténtalo de nuevo.</p>
          ) : locations.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No hay otras ubicaciones activas de este producto dentro del grupo y rubro.</p>
          ) : locations.map((location) => (
            <div key={`${location.branchName}-${location.warehouseName}`} className="flex min-w-0 flex-col gap-2 rounded-xl border border-border/70 bg-card p-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-semibold text-foreground">{location.branchName}</p>
                    <Badge variant="secondary" className="max-w-full whitespace-normal text-[10px]">{locationTypeLabel(location)}</Badge>
                  </div>
                  <p className="flex min-w-0 items-center gap-1 break-words text-xs text-muted-foreground">
                    <Warehouse className="size-3 shrink-0" aria-hidden="true" />
                    {location.warehouseName}
                  </p>
                  {location.variantStocks.length > 0 && (
                    <ul className="mt-2 min-w-0 space-y-1 text-[11px] text-muted-foreground">
                      {location.variantStocks.map((variant) => (
                        <li key={variant.sku} className="break-words [overflow-wrap:anywhere]">
                          <span className="font-mono">{variant.sku}</span> · {variant.name}: {formatSalesStock(variant.available)} disponible(s)
                        </li>
                      ))}
                    </ul>
                  )}
                  {location.baseAvailable !== undefined && location.baseAvailable > 0 && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Sin variante: {formatSalesStock(location.baseAvailable)} disponible(s)</p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className={location.available > 0
                ? 'w-fit shrink-0 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'w-fit shrink-0 border-amber-500/30 text-amber-700 dark:text-amber-300'}>
                Disponible: {formatSalesStock(location.available)}
              </Badge>
            </div>
          ))}
        </div>
        <p className="shrink-0 px-4 pb-4 pt-2 text-[10px] text-muted-foreground sm:px-6 sm:pb-6">Consulta de solo lectura. Estas ubicaciones no se pueden seleccionar desde esta ventana.</p>
      </DialogContent>
    </Dialog>
  );
}
