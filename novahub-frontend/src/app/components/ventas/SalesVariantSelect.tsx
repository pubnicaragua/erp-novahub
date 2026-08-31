import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { buildVariantDescription } from '../../types/variants';

interface SalesVariantSelectProps {
  product?: { variants?: any[] } | null;
  value?: string | null;
  onChange: (variantId: string) => void;
  disabled?: boolean;
}

/** Selector común para todos los editores comerciales. Los precios no se
 * consultan aquí: la variante solo identifica el SKU y su stock. */
export function SalesVariantSelect({ product, value, onChange, disabled }: SalesVariantSelectProps) {
  const variants = (product?.variants || []).filter((variant: any) => variant.isActive !== false);
  if (variants.length <= 1) return null;
  return (
    <div className="mt-1 flex min-w-0 items-center gap-2">
      <Badge variant="outline" className="shrink-0 text-[9px] font-black uppercase tracking-wider text-primary">Variante</Badge>
      <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-8 min-w-0 flex-1 text-xs" aria-label="Seleccionar variante del producto">
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
