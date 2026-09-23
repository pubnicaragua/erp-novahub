import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { PosProduct, PosProductVariant } from '../../services/caja.service';
import { SalesWarehouseStockHint } from './SalesWarehouseStockHint';
import { formatSalesStock, getAvailableSalesStock, getSalesStockOptionLabel, getSalesWarehouseStockBreakdown } from '../../utils/sales-stock';

type WarehouseOption = { id: string; name: string };

interface VariantPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: PosProduct | null;
  onSelect: (variant: PosProductVariant) => void;
  warehouseId?: string;
  warehouses?: WarehouseOption[];
}

export function VariantPickerModal({ open, onOpenChange, product, onSelect, warehouseId, warehouses = [] }: VariantPickerModalProps) {
  const variants = (product?.variants || []).filter((variant) => variant.isActive !== false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [product?.id, product?.imageUrl]);

  const matchedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const matchedVariantStock = product?.trackInventory && matchedVariant
    ? getAvailableSalesStock(product, warehouseId, matchedVariant.id)
    : null;
  const matchedVariantHasStock = !product?.trackInventory
    || Boolean(warehouseId && matchedVariant && matchedVariantStock !== null && matchedVariantStock > 0);
  const selectedWarehouseName = warehouses.find((warehouse) => warehouse.id === warehouseId)?.name;

  const handleConfirm = () => {
    if (matchedVariant) {
      onSelect(matchedVariant as PosProductVariant);
      onOpenChange(false);
      setSelectedVariantId(null);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedVariantId(null);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{product.name}</DialogTitle>
          <DialogDescription>Selecciona una variante y revisa su disponibilidad antes de agregarla.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
              {product.imageUrl && !imageFailed
                ? <img src={product.imageUrl} alt="" className="size-full object-cover" onError={() => setImageFailed(true)} />
                : <Package className="size-5" aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold">{product.name}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{product.code}</p>
            </div>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border/50 p-2">
            {variants.map((variant) => {
              const isSelected = variant.id === selectedVariantId;
              const stock = product.trackInventory ? getAvailableSalesStock(product, warehouseId, variant.id) : null;
              const isOutOfStock = Boolean(product.trackInventory && warehouseId && stock === 0);
              const attributesLabel = variant.attributes?.map((attribute) => attribute.value).filter(Boolean).join(' / ');
              const warehouseStockSummary = product.trackInventory
                ? getSalesWarehouseStockBreakdown(product, variant.id).map((warehouse) =>
                  `${warehouse.name}: ${warehouse.available === null ? 'no disponible' : formatSalesStock(warehouse.available)}`,
                ).join(' · ')
                : '';
              return (
                <button
                  key={variant.id}
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => setSelectedVariantId(variant.id)}
                  aria-pressed={isSelected}
                  className="flex w-full min-w-0 flex-col gap-2 rounded-lg border border-border/70 bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-border/70 disabled:hover:bg-background sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="break-words text-xs font-bold">{attributesLabel || variant.name || variant.sku}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">SKU {variant.sku || 'Sin SKU'}</span>
                  </span>
                  {product.trackInventory && (
                    <Badge variant={!warehouseId || stock === null ? 'outline' : stock > 0 ? 'secondary' : 'destructive'} className="text-[10px]">
                      {getSalesStockOptionLabel(product, warehouseId, variant.id)}
                    </Badge>
                  )}
                  {warehouseStockSummary && <span className="basis-full break-words text-[10px] leading-4 text-muted-foreground">Stock por bodega: {warehouseStockSummary}</span>}
                </button>
              );
            })}
          </div>

          {matchedVariant && (
            <div className="rounded-xl border bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">SKU:</span>
                <span className="font-mono font-bold">{matchedVariant.sku}</span>
              </div>
              {product.trackInventory && <div className="mt-1 font-semibold text-muted-foreground">
                {selectedWarehouseName ? `Disponibilidad en ${selectedWarehouseName}: ` : 'Disponibilidad: '}
                {getSalesStockOptionLabel(product, warehouseId, matchedVariant.id)}
              </div>}
              {product.trackInventory && !warehouseId && (
                <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                  Selecciona una bodega de salida para consultar existencias.
                </p>
              )}
              {product.trackInventory && (
              <SalesWarehouseStockHint
                  product={product}
                  warehouseId={warehouseId}
                  warehouses={warehouses}
                  variantId={matchedVariant.id}
                  className="mt-2 px-0"
                />
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!matchedVariant || !matchedVariantHasStock}>
            Seleccionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
