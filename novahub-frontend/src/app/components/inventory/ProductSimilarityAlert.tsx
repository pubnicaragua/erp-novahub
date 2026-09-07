import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import type { SimilarProductGroup } from '../../services/inventario.service';

interface ProductSimilarityAlertProps {
  open: boolean;
  groups: SimilarProductGroup[];
  title?: string;
  description?: string;
  continueLabel?: string;
  onOpenChange: (open: boolean) => void;
  onContinue?: () => void;
}

export function ProductSimilarityAlert({
  open,
  groups,
  title = 'Producto similar encontrado',
  description = 'Revisa los registros existentes antes de continuar. La comparación ignora mayúsculas, minúsculas y acentos.',
  continueLabel,
  onOpenChange,
  onContinue,
}: ProductSimilarityAlertProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[min(88vh,calc(100dvh-3rem))] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="size-5 shrink-0" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {groups.flatMap((group) => group.matches.map((match) => (
            <div key={`${group.inputKey}-${match.id}`} className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-black">{match.name || 'Sin nombre'}</p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">SKU: {match.sku || match.code || 'Sin SKU'}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(match.reasons || []).map((reason) => <Badge key={reason} variant="outline" className="border-amber-500/50 text-[10px]">Coincide por {reason}</Badge>)}
                </div>
              </div>
              <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                <div><span className="font-bold text-muted-foreground">Marca:</span> {match.brand || 'Sin marca'}</div>
                <div><span className="font-bold text-muted-foreground">Categoría:</span> {match.category || 'Sin categoría'}</div>
                <div className="sm:col-span-2">
                  <span className="font-bold text-muted-foreground">Atributos y valores:</span>{' '}
                  {match.attributes?.length ? match.attributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(' · ') : 'Sin atributos'}
                </div>
                <div className="sm:col-span-2">
                  <span className="font-bold text-muted-foreground">Precios:</span>{' '}
                  {match.prices?.length ? match.prices.map((price) => `${price.list}: ${price.price}${price.currency ? ` ${price.currency}` : ''}`).join(' · ') : 'Sin precios configurados'}
                  <span className="mx-1 text-muted-foreground">·</span>
                  <span className="font-bold text-muted-foreground">Costo:</span> {match.costPrice === null || match.costPrice === undefined ? 'No disponible' : match.costPrice}
                </div>
              </div>
            </div>
          ))) }
        </div>
        <DialogFooter className="shrink-0 border-t pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Revisar datos</Button>
          {onContinue && continueLabel && (
            <Button type="button" onClick={onContinue} className="gap-2">
              <ArrowRight className="size-4" /> {continueLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
