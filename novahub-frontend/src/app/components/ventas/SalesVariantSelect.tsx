import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';
import { buildVariantDescription } from '../../types/variants';

interface SalesVariantSelectProps {
  product?: { variants?: any[] } | null;
  value?: string | null;
  onChange: (variantId: string) => void;
  disabled?: boolean;
  className?: string;
  labelLayout?: 'inline' | 'stacked';
}

/** Selector común para todos los editores comerciales. Los precios no se
 * consultan aquí: la variante solo identifica el SKU y su stock. */
export function SalesVariantSelect({ product, value, onChange, disabled, className, labelLayout = 'stacked' }: SalesVariantSelectProps) {
  const variants = (product?.variants || []).filter((variant: any) => variant.isActive !== false);
  if (variants.length <= 1) return null;
  const isStacked = labelLayout === 'stacked';
  return (
    <div className={cn(isStacked ? 'w-full min-w-0 space-y-1' : 'mt-1 flex min-w-0 items-center gap-2', className)}>
      <span className={cn('block truncate text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground', !isStacked && 'shrink-0 text-primary')}>Variante</span>
      <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={cn('h-8 min-w-0 text-xs', isStacked ? 'w-full' : 'flex-1')} aria-label="Seleccionar variante del producto">
          <SelectValue placeholder="Seleccionar variante / SKU" />
        </SelectTrigger>
        <SelectContent>
          {variants.map((variant: any) => (
            <SelectItem key={variant.id} value={variant.id}>
              <span className="font-mono">{variant.sku}</span> · {buildVariantDescription(variant)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
