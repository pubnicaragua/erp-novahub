import { Warehouse } from 'lucide-react';
import { cn } from '../ui/utils';
import {
  formatSalesStock,
  getAvailableSalesStock,
  getSalesWarehouseStockBreakdown,
  tracksSalesInventory,
  type SalesStockProduct,
} from '../../utils/sales-stock';

type WarehouseStockOption = {
  id: string;
  name: string;
  isActive?: boolean;
};

type WarehouseStockHintProps = {
  product?: SalesStockProduct | null;
  warehouseId?: string | null;
  warehouses?: WarehouseStockOption[];
  variantId?: string | null;
  className?: string;
};

export function SalesWarehouseStockHint({ product, warehouseId, warehouses = [], variantId, className }: WarehouseStockHintProps) {
  if (!product || !tracksSalesInventory(product)) return null;

  const selectedWarehouseId = String(warehouseId || '').trim();
  const warehouseNames = new Map(warehouses.map((warehouse) => [String(warehouse.id), warehouse.name]));
  const breakdown = getSalesWarehouseStockBreakdown(product, variantId);
  const selectedWarehouseName = warehouseNames.get(selectedWarehouseId)
    || breakdown.find((warehouse) => warehouse.id === selectedWarehouseId)?.name
    || product.warehouseCatalog?.find((warehouse) => String(warehouse.id) === selectedWarehouseId)?.name
    || 'bodega seleccionada';
  const selectedStock = getAvailableSalesStock(product, selectedWarehouseId, variantId);
  const otherWarehouses = breakdown.filter((warehouse) => warehouse.id !== selectedWarehouseId);
  const fullOtherSummary = otherWarehouses
    .map((row) => `${row.name}: ${row.available === null ? 'no disponible' : formatSalesStock(row.available)}`)
    .join(' · ');
  const noWarehouse = !selectedWarehouseId;
  const hasSelectedStock = selectedStock !== null && selectedStock > 0;
  const hasNoSelectedStock = selectedStock === 0;
  const selectedDescription = noWarehouse
    ? 'Selecciona una bodega para consultar existencias'
    : selectedStock === null
      ? `Existencia no disponible en ${selectedWarehouseName}`
      : hasNoSelectedStock
        ? `Sin existencias en ${selectedWarehouseName} · Disponible: 0`
        : `Disponible en ${selectedWarehouseName}: ${formatSalesStock(selectedStock)}`;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 px-1 text-[10px] leading-4',
        hasSelectedStock ? 'text-muted-foreground' : selectedStock === null || noWarehouse ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400',
        className,
      )}
      role="status"
      aria-label={fullOtherSummary ? `${selectedDescription}. También disponible en ${fullOtherSummary}` : selectedDescription}
      title={fullOtherSummary || undefined}
    >
      <Warehouse className="size-3 shrink-0" aria-hidden="true" />
      <span className="font-semibold">{selectedDescription}</span>
      {otherWarehouses.length > 0 && (
        <span className={cn('font-medium', hasSelectedStock ? 'text-primary' : 'font-bold')}>
          · Otras bodegas: {fullOtherSummary}
        </span>
      )}
    </div>
  );
}
