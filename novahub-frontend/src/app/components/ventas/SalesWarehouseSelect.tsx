import { Warehouse } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export type SalesWarehouseOption = {
  id: string;
  name: string;
  isActive?: boolean;
};

export function getDefaultSalesWarehouseId(warehouses: SalesWarehouseOption[] = []) {
  const active = warehouses.filter((warehouse) => warehouse?.isActive !== false);
  return active.find((warehouse: any) => Number(warehouse?.stockCount || 0) > 0)?.id
    || active[0]?.id
    || warehouses[0]?.id
    || '';
}

export function getProductStockForSalesWarehouse(product: any, warehouseId?: string | null, variantId?: string | null) {
  if (!product) return 0;
  const selectedId = String(warehouseId || '').trim();
  const selectedVariantId = String(variantId || '').trim();
  const rawLevels = Array.isArray(product.stockLevels) ? product.stockLevels : [];
  const levels = selectedVariantId
    ? rawLevels.filter((level: any) => String(level?.variantId || '').trim() === selectedVariantId)
    : rawLevels;
  if (!selectedId) {
    if (selectedVariantId) return levels.reduce((total: number, level: any) => total + Number(level?.stock || level?.quantity || 0), 0);
    return Number(product.stock || 0);
  }
  if (!levels.length) return 0;
  return levels
    .filter((level: any) => String(level?.warehouseId || '').trim() === selectedId)
    .reduce((total: number, level: any) => total + Number(level?.stock || level?.quantity || 0), 0);
}

interface SalesWarehouseSelectProps {
  warehouses?: SalesWarehouseOption[];
  value?: string | null;
  onChange: (warehouseId: string) => void;
  disabled?: boolean;
  required?: boolean;
  helpText?: string;
}

/** Selector común para documentos comerciales no-POS. */
export function SalesWarehouseSelect({ warehouses = [], value, onChange, disabled = false, required = false, helpText = 'La salida y el stock se validan en esta bodega.' }: SalesWarehouseSelectProps) {
  const selectedValue = value || '';
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Warehouse className="size-3 text-primary" />
        Bodega de salida{required ? ' *' : ''}
      </p>
      <Select value={selectedValue} onValueChange={onChange} disabled={disabled || warehouses.length === 0}>
        <SelectTrigger className="h-8 max-w-full text-xs">
          <SelectValue placeholder={warehouses.length ? 'Seleccionar bodega' : 'No hay bodegas disponibles'} />
        </SelectTrigger>
        <SelectContent>
          {warehouses
            .filter((warehouse) => warehouse?.isActive !== false || warehouse.id === selectedValue)
            .map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="mt-1 text-[10px] text-muted-foreground/70">{helpText}</p>
    </div>
  );
}
