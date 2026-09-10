import { AlertTriangle, ArrowRight, Check, Info, Loader2, Plus } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import type { SimilarProductGroup, SimilarProductMatch } from '../../services/inventario.service';

type SimilarProductVariant = NonNullable<SimilarProductMatch['variants']>[number];

interface ProductSimilarityAlertProps {
  open: boolean;
  groups: SimilarProductGroup[];
  title?: string;
  description?: string;
  continueLabel?: string;
  selectionHint?: string;
  onOpenChange: (open: boolean) => void;
  onContinue?: () => void;
  onSelectExisting?: (group: SimilarProductGroup, match: SimilarProductMatch, variant?: SimilarProductVariant) => void;
  onCreateNew?: (group: SimilarProductGroup) => void;
  resolvingKey?: string | null;
}

export function ProductSimilarityAlert({
  open,
  groups,
  title = 'Producto similar encontrado',
  description = 'La alerta se genera por SKU exacto o por nombre igual/similar. Marca, descripción y atributos solo aportan contexto y no generan alertas por sí solos.',
  continueLabel,
  selectionHint,
  onOpenChange,
  onContinue,
  onSelectExisting,
  onCreateNew,
  resolvingKey,
}: ProductSimilarityAlertProps) {
  const hasDynamicResolution = Boolean(onSelectExisting || onCreateNew);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[min(88vh,calc(100dvh-3rem))] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <AlertTriangle className="size-5 shrink-0" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {groups.map((group) => {
            const groupHasExactSkuMatch = group.matches.some((match) => (match.reasons || []).includes('SKU'));
            return (
            <section key={group.inputKey} className="space-y-3 rounded-2xl border border-warning/30 bg-warning/[0.03] p-3 sm:p-4" aria-label={`Coincidencias para ${group.inputKey}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/20 pb-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-warning dark:text-warning">Registro de la plantilla</p>
                  <p className="mt-1 break-words font-mono text-xs font-bold text-foreground">{group.inputKey || 'Sin identificador'}</p>
                </div>
                <Badge variant="outline" className="border-warning/50 text-[10px]">{group.matches.length} posible{group.matches.length === 1 ? '' : 's'} coincidencia{group.matches.length === 1 ? '' : 's'}</Badge>
              </div>
              {group.matches.map((match) => {
                const matchKey = `${group.inputKey}:${match.id}`;
                const isResolving = resolvingKey === matchKey;
                return (
                  <article key={matchKey} className="rounded-xl border border-warning/40 bg-background p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-black">{match.name || 'Sin nombre'}</p>
                        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">SKU: {match.sku || match.code || 'Sin SKU'}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(match.reasons || []).map((reason) => <Badge key={reason} variant="outline" className="border-warning/50 text-[10px]">Coincide por {reason}</Badge>)}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                      <div><span className="font-bold text-muted-foreground">Marca:</span> {match.brand || 'Sin marca'}</div>
                      <div><span className="font-bold text-muted-foreground">Categoría:</span> {match.category || 'Sin categoría'}</div>
                      <div className="sm:col-span-2"><span className="font-bold text-muted-foreground">Descripción:</span> {match.description || 'Sin descripción'}</div>
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
                    {hasDynamicResolution && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                        <Button type="button" size="sm" className="gap-2" disabled={isResolving} onClick={() => onSelectExisting?.(group, match)}>
                          {isResolving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                          Usar este producto
                        </Button>
                        {match.variants?.map((variant) => (
                          <Button key={variant.id} type="button" size="sm" variant="outline" className="gap-2" disabled={isResolving} onClick={() => onSelectExisting?.(group, match, variant)}>
                            <Check className="size-4" /> Usar variante {variant.sku}
                          </Button>
                        ))}
                        {selectionHint && (
                          <p className="basis-full mt-1 flex items-start gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-[11px] leading-4 text-muted-foreground">
                            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                            <span>{selectionHint}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
              {hasDynamicResolution && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                  {groupHasExactSkuMatch && <span className="text-right text-[11px] font-semibold text-warning dark:text-warning">SKU exacto: selecciona el registro existente</span>}
                  <Button type="button" size="sm" variant="outline" className="gap-2 border-warning/50 text-warning hover:bg-warning hover:text-warning-foreground dark:text-warning" disabled={resolvingKey === `${group.inputKey}:CREATE_NEW` || groupHasExactSkuMatch} onClick={() => onCreateNew?.(group)}>
                    {resolvingKey === `${group.inputKey}:CREATE_NEW` ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    {groupHasExactSkuMatch ? 'No se puede duplicar el SKU' : 'Crear como nuevo'}
                  </Button>
                  </div>
              )}
            </section>
            );
          })}
        </div>
        <DialogFooter className="shrink-0 border-t pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Revisar datos</Button>
          {!hasDynamicResolution && onContinue && continueLabel && (
            <Button type="button" onClick={onContinue} className="gap-2">
              <ArrowRight className="size-4" /> {continueLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
