import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';
import { buildVariantDescription } from '../../types/variants';
import { formatSalesStock, getAvailableSalesStock, getSalesStockOptionLabel, getSalesWarehouseStockBreakdown, type SalesStockProduct } from '../../utils/sales-stock';

interface SalesVariantSelectProps {
  product?: (SalesStockProduct & { variants?: any[] }) | null;
  warehouseId?: string | null;
  value?: string | null;
  onChange: (variantId: string, variant?: any) => void;
  disabled?: boolean;
  allowOutOfStockSelection?: boolean;
  className?: string;
  labelLayout?: 'inline' | 'stacked';
  showLabel?: boolean;
  placeholder?: string;
}

/** Selector común para todos los editores comerciales. Los precios no se
 * consultan aquí: la variante solo identifica el SKU y su stock. */
export function SalesVariantSelect({ product, warehouseId, value, onChange, disabled, allowOutOfStockSelection = false, className, labelLayout = 'stacked', showLabel = true, placeholder = 'Seleccionar variante / SKU' }: SalesVariantSelectProps) {
  const variants = (product?.variants || []).filter((variant: any) => variant.isActive !== false);
  if (variants.length <= 1) return null;
  const isStacked = labelLayout === 'stacked';
  return (
    <div className={cn(isStacked ? 'w-full min-w-0 space-y-1' : 'mt-1 flex min-w-0 items-center gap-2', className)}>
      {showLabel && <span className={cn('block truncate text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground', !isStacked && 'shrink-0 text-primary')}>Variante</span>}
      <Select
        value={value || ''}
        onValueChange={(variantId) => onChange(variantId, variants.find((variant: any) => variant.id === variantId))}
        disabled={disabled}
      >
        <SelectTrigger className={cn('h-8 min-w-0 text-xs', isStacked ? 'w-full' : 'flex-1')} aria-label="Seleccionar variante del producto">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {variants.map((variant: any) => (
            <SelectItem
              key={variant.id}
              value={variant.id}
              disabled={!allowOutOfStockSelection && getVariantHasNoStock(product, warehouseId, variant.id)}
            >
              <div className="flex min-w-0 flex-col">
                <span><span className="font-mono">{variant.sku}</span> · {buildVariantDescription(variant)}</span>
                <span className="text-[10px] text-muted-foreground">{getSalesStockOptionLabel(product, warehouseId, variant.id)}</span>
                {getSalesWarehouseStockBreakdown(product, variant.id).length > 0 && (
                  <span className="max-w-[min(70vw,32rem)] whitespace-normal text-[10px] text-muted-foreground">
                    Bodegas: {getSalesWarehouseStockBreakdown(product, variant.id).map((warehouse) =>
                      `${warehouse.name}: ${warehouse.available === null ? 'no disponible' : formatSalesStock(warehouse.available)}`,
                    ).join(' · ')}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function getVariantHasNoStock(product: SalesStockProduct | null | undefined, warehouseId: string | null | undefined, variantId: string) {
  if (!product || product.trackInventory === false || !warehouseId) return false;
  const stock = getAvailableSalesStock(product, warehouseId, variantId);
  return stock === 0;
}
