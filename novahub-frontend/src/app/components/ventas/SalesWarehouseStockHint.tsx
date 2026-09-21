import { Warehouse } from 'lucide-react';
import { cn } from '../ui/utils';

type WarehouseStockOption = {
  id: string;
  name: string;
  isActive?: boolean;
};

type WarehouseStockLevel = {
  warehouseId?: string;
  warehouseName?: string;
  variantId?: string | null;
  available?: number | null;
  currentStock?: number | null;
  quantity?: number | null;
  stock?: number | null;
  reserved?: number | null;
  warehouse?: { id?: string; name?: string };
};

type StockTrackedProduct = {
  itemType?: string | null;
  type?: string | null;
  trackInventory?: boolean;
  warehouseStock?: WarehouseStockLevel[];
  stockLevels?: WarehouseStockLevel[];
  currentStock?: number | null;
  variants?: Array<{ id: string; currentStock?: number | null }>;
};

type WarehouseStockHintProps = {
  product?: StockTrackedProduct | null;
  warehouseId?: string | null;
  warehouses?: WarehouseStockOption[];
  variantId?: string | null;
  className?: string;
};

type StockByWarehouse = {
  warehouseId: string;
  warehouseName: string;
  stock: number;
};

const numberOrZero = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const availableFromLevel = (level: WarehouseStockLevel) => {
  if (level?.available !== undefined && level?.available !== null) return numberOrZero(level.available);
  if (level?.currentStock !== undefined && level?.currentStock !== null) return numberOrZero(level.currentStock);
  const quantity = numberOrZero(level?.quantity ?? level?.stock);
  return quantity - numberOrZero(level?.reserved);
};

const formatStock = (value: number) => new Intl.NumberFormat('es-NI', {
  maximumFractionDigits: 2,
}).format(value);

/**
 * Indica el stock de la bodega de salida y resume existencias positivas en
 * otras bodegas visibles. Es solo informativo: nunca cambia la bodega ni
 * sustituye la validación al guardar o emitir el documento.
 */
export function SalesWarehouseStockHint({ product, warehouseId, warehouses = [], variantId, className }: WarehouseStockHintProps) {
  if (!product || String(product.itemType || product.type || 'PRODUCT').toUpperCase() === 'SERVICE') return null;
  if (product.trackInventory === false) return null;

  const selectedWarehouseId = String(warehouseId || '').trim();
  if (!selectedWarehouseId) return null;

  const rawLevels = Array.isArray(product.warehouseStock) && product.warehouseStock.length > 0
    ? product.warehouseStock
    : (Array.isArray(product.stockLevels) ? product.stockLevels : []);

  const normalizedVariantId = String(variantId || '').trim();
  const variantStock = normalizedVariantId
    ? product.variants?.find((variant) => String(variant.id || '') === normalizedVariantId)?.currentStock
    : product.currentStock;
  const exactVariantLevels = normalizedVariantId
    ? rawLevels.filter((level) => String(level?.variantId || '').trim() === normalizedVariantId)
    : rawLevels;
  const levels = normalizedVariantId ? exactVariantLevels : rawLevels;
  const warehouseNames = new Map(
    warehouses.map((warehouse) => [String(warehouse.id), warehouse.name]),
  );
  const visibleWarehouseIds = new Set(warehouses.map((warehouse) => String(warehouse.id)));
  const stockMap = new Map<string, StockByWarehouse>();

  levels.forEach((level) => {
    const id = String(level?.warehouseId || level?.warehouse?.id || '').trim();
    if (!id || (id !== selectedWarehouseId && !visibleWarehouseIds.has(id))) return;
    const existing = stockMap.get(id);
    stockMap.set(id, {
      warehouseId: id,
      warehouseName: String(level?.warehouseName || level?.warehouse?.name || warehouseNames.get(id) || 'Bodega'),
      stock: (existing?.stock || 0) + availableFromLevel(level),
    });
  });

  // getProducts devuelve 0 cuando la bodega no tiene una fila de inventario.
  // Conservamos esa señal para que la ausencia de niveles no oculte el aviso.
  if (stockMap.size === 0) {
    stockMap.set(selectedWarehouseId, {
      warehouseId: selectedWarehouseId,
      warehouseName: warehouseNames.get(selectedWarehouseId) || 'bodega seleccionada',
      stock: numberOrZero(variantStock),
    });
  }

  const selectedStock = stockMap.get(selectedWarehouseId)?.stock || 0;
  const otherWarehouses = Array.from(stockMap.values())
    .filter((row) => row.warehouseId !== selectedWarehouseId && row.stock > 0)
    .sort((left, right) => right.stock - left.stock || left.warehouseName.localeCompare(right.warehouseName, 'es'));
  const selectedWarehouseName = warehouseNames.get(selectedWarehouseId)
    || stockMap.get(selectedWarehouseId)?.warehouseName
    || 'bodega seleccionada';

  if (otherWarehouses.length === 0 && selectedStock > 0) return null;

  const visibleOtherWarehouses = otherWarehouses.slice(0, 3);
  const remainingWarehouses = otherWarehouses.length - visibleOtherWarehouses.length;
  const otherSummary = visibleOtherWarehouses
    .map((row) => `${row.warehouseName}: ${formatStock(row.stock)}`)
    .join(' · ');
  const fullOtherSummary = otherWarehouses
    .map((row) => `${row.warehouseName}: ${formatStock(row.stock)}`)
    .join(' · ');
  const hasSelectedStock = selectedStock > 0;
  const hasOtherStock = otherWarehouses.length > 0;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 px-1 text-[10px] leading-4',
        hasSelectedStock ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400',
        className,
      )}
      role="status"
      aria-label={hasSelectedStock
        ? (hasOtherStock
          ? `Stock en ${selectedWarehouseName}: ${formatStock(selectedStock)}. También disponible en ${fullOtherSummary}`
          : `Stock en ${selectedWarehouseName}: ${formatStock(selectedStock)}`)
        : (hasOtherStock
          ? `Sin stock en ${selectedWarehouseName}. Disponible en ${fullOtherSummary}`
          : `Sin stock en ${selectedWarehouseName}`)}
      title={fullOtherSummary || undefined}
    >
      <Warehouse className="size-3 shrink-0" aria-hidden="true" />
      <span className="font-semibold">
        {hasSelectedStock ? `En ${selectedWarehouseName}: ${formatStock(selectedStock)}` : `Sin stock en ${selectedWarehouseName}`}
      </span>
      {hasOtherStock && (
        <span className={cn('font-medium', hasSelectedStock ? 'text-primary' : 'font-bold')}>
          · {hasSelectedStock ? 'También disponible' : 'Disponible en'}: {otherSummary}
          {remainingWarehouses > 0 ? ` · +${remainingWarehouses} bodega(s)` : ''}
        </span>
      )}
    </div>
  );
}
