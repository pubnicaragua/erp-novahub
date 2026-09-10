import { useState, useMemo, useEffect } from 'react';
import { Check, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import type { ProductVariant } from '../../types/variants';
import { buildVariantDescription, extractVariantAttributes, findVariantByAttributes } from '../../types/variants';

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
  const [selectedVariantId, setSelectedVariantId] = useState('');

  useEffect(() => {
    setSelected({});
    setSelectedVariantId(attributes.length === 0 && variants.length === 1 ? variants[0].id : '');
  }, [product?.id, open]);

  const matchedVariant = useMemo(
    () => findVariantByAttributes(variants, selected),
    [variants, selected]
  );

  const selectedDirectVariant = attributes.length === 0
    ? variants.find((variant) => variant.id === selectedVariantId)
    : undefined;
  const selectedVariant = selectedDirectVariant || matchedVariant;

  const toggleValue = (attribute: string, value: string) => {
    setSelected((prev) => ({
      ...prev,
      [attribute]: prev[attribute] === value ? undefined as any : value,
    }));
  };

  const handleConfirm = () => {
    if (selectedVariant) {
      onSelect(selectedVariant);
      onOpenChange(false);
      setSelected({});
      setSelectedVariantId('');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelected({});
    setSelectedVariantId('');
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
          {attributes.length === 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Variantes disponibles</p>
              <div className="space-y-2">
                {variants.map((variant) => {
                  const isSelected = selectedVariantId === variant.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/30'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{buildVariantDescription(variant) || 'Variante sin nombre'}</span>
                        <span className="block font-mono text-[10px] text-muted-foreground">SKU: {variant.sku}</span>
                      </span>
                      {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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

          {selectedVariant && (
            <div className="rounded-xl border bg-muted/30 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">SKU:</span>
                <span className="font-mono font-bold">{selectedVariant.sku}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selectedVariant}>
            Seleccionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
