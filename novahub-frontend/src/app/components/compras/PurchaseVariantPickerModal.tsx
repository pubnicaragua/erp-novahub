import { useState, useMemo } from 'react';
import { Check, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { ProductVariant } from '../../types/variants';
import { extractVariantAttributes, findVariantByAttributes } from '../../types/variants';

interface PurchaseVariantPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; code: string; name: string; variants?: ProductVariant[] } | null;
  onSelect: (variant: ProductVariant) => void;
}

export function PurchaseVariantPickerModal({ open, onOpenChange, product, onSelect }: PurchaseVariantPickerModalProps) {
  const variants = product?.variants || [];
  const attributes = useMemo(() => extractVariantAttributes(variants), [variants]);
  const [selected, setSelected] = useState<Record<string, string>>({});

  const matchedVariant = useMemo(
    () => findVariantByAttributes(variants, selected),
    [variants, selected]
  );

  const toggleValue = (attribute: string, value: string) => {
    setSelected((prev) => ({
      ...prev,
      [attribute]: prev[attribute] === value ? undefined as any : value,
    }));
  };

  const handleConfirm = () => {
    if (matchedVariant) {
      onSelect(matchedVariant);
      onOpenChange(false);
      setSelected({});
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelected({});
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5 text-primary" />
            {product.name}
          </DialogTitle>
          <DialogDescription>Selecciona la variante a ordenar</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {attributes.map(({ attribute, values }) => (
            <div key={attribute}>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{attribute}</p>
              <div className="flex flex-wrap gap-2">
                {values.map((value) => {
                  const isSelected = selected[attribute] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleValue(attribute, value)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/30'
                      }`}
                    >
                      {isSelected && <Check className="size-3" />}
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {matchedVariant && (
            <div className="rounded-xl border bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">SKU:</span>
                <span className="font-mono font-bold">{matchedVariant.sku}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!matchedVariant}>
            Seleccionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
