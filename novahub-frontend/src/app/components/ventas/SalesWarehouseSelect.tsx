import { Warehouse } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { getAvailableSalesStock as getProductStockForSalesWarehouse } from '../../utils/sales-stock';

export { getProductStockForSalesWarehouse };

export type SalesWarehouseOption = {
  id: string;
  name: string;
  isActive?: boolean;
};

export function getDefaultSalesWarehouseId(warehouses: SalesWarehouseOption[] = []) {
  const active = warehouses.filter((warehouse) => warehouse?.isActive !== false);
  return active.find((warehouse: any) => Number(warehouse?.stockCount || 0) > 0)?.id
    || active[0]?.id
    || '';
}

interface SalesWarehouseSelectProps {
  warehouses?: SalesWarehouseOption[];
  value?: string | null;
  onChange: (warehouseId: string) => void;
  disabled?: boolean;
  required?: boolean;
  helpText?: string;
  testId?: string;
}

/** Selector común para documentos comerciales no-POS. */
export function SalesWarehouseSelect({ warehouses = [], value, onChange, disabled = false, required = false, helpText = 'La salida y el stock se validan en esta bodega.', testId }: SalesWarehouseSelectProps) {
  const selectedValue = value || '';
  const activeWarehouses = warehouses.filter((warehouse) => warehouse?.isActive !== false);
  const selectedWarehouseIsInactive = Boolean(selectedValue) && !activeWarehouses.some((warehouse) => warehouse.id === selectedValue);
  const selectValue = selectedWarehouseIsInactive ? '' : selectedValue;
  return (
    <div className="min-w-0" data-testid={testId}>
      <p className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Warehouse className="size-3 text-primary" />
        Bodega de salida{required ? ' *' : ''}
      </p>
      <Select value={selectValue} onValueChange={onChange} disabled={disabled || activeWarehouses.length === 0}>
        <SelectTrigger className="h-8 max-w-full text-xs">
          <SelectValue placeholder={selectedWarehouseIsInactive
            ? 'La bodega anterior está inactiva; selecciona una activa'
            : activeWarehouses.length ? 'Seleccionar bodega' : 'No hay bodegas activas disponibles'} />
        </SelectTrigger>
        <SelectContent>
          {activeWarehouses.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}
        </SelectContent>
      </Select>
      {selectedWarehouseIsInactive && <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">La bodega guardada en este documento está inactiva; elige una activa para continuar.</p>}
      <p className="mt-1 text-[10px] text-muted-foreground/70">{helpText}</p>
    </div>
  );
}
