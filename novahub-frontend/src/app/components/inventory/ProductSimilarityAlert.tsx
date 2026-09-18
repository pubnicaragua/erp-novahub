import { useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Info, Loader2, Plus } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import type { SimilarProductGroup, SimilarProductMatch } from '../../services/inventario.service';

type SimilarProductVariant = NonNullable<SimilarProductMatch['variants']>[number];

type SimilarProductLineDetails = {
  unitPrice?: number | string;
  currentStock?: number | string;
  currency?: string;
};

const normalizeSku = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '')
  .toLowerCase();

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
  onCreateNew?: (group: SimilarProductGroup, newSku?: string) => void;
  canSelectParentForGroup?: (group: SimilarProductGroup) => boolean;
  resolvingKey?: string | null;
  allowExactSkuCreate?: boolean;
  allowExactSkuCreateInput?: boolean;
  lineDetailsForGroup?: (group: SimilarProductGroup) => SimilarProductLineDetails | undefined;
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
  canSelectParentForGroup,
  resolvingKey,
  allowExactSkuCreate = false,
  allowExactSkuCreateInput = false,
  lineDetailsForGroup,
}: ProductSimilarityAlertProps) {
  const hasDynamicResolution = Boolean(onSelectExisting || onCreateNew);
  const [newSkuDrafts, setNewSkuDrafts] = useState<Record<string, string>>({});
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
            const lineDetails = lineDetailsForGroup?.(group);
            const newSku = newSkuDrafts[group.inputKey] || '';
            const existingSkuKeys = new Set(group.matches.flatMap((match) => [
              match.code,
              match.sku,
              ...(match.variants || []).map((variant) => variant.sku),
            ].map(normalizeSku).filter(Boolean)));
            const newSkuIsValid = Boolean(newSku.trim()) && !existingSkuKeys.has(normalizeSku(newSku));
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
                const hasMultipleVariants = (match.variants?.length || 0) > 1;
                const hasExactVariant = (match.variants || []).some((variant) => normalizeSku(variant.sku) === normalizeSku(group.inputKey));
                const canCreateVariantUnderParent = canSelectParentForGroup?.(group) === true;
                const canUseParent = !hasMultipleVariants || (canCreateVariantUnderParent && !hasExactVariant && !groupHasExactSkuMatch);
                return (
                  <article key={matchKey} className="rounded-xl border border-warning/40 bg-background p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-black">{match.name || 'Sin nombre'}</p>
                        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">SKU: {match.sku || match.code || 'Sin SKU'}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(match.reasons || []).map((reason) => <Badge key={reason} variant="outline" className="border-warning/50 text-[10px]">Coincide por {reason}</Badge>)}
                        <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                          {match.variants?.some((variant) => variant.sku !== match.code || variant.attributes?.length || (variant.name && variant.name !== 'Estándar')) ? 'Producto con variantes' : 'Producto sin variante'}
                        </Badge>
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
                      {lineDetails && (
                        <div className="sm:col-span-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <span><span className="font-bold text-muted-foreground">Costo de entrada:</span> {lineDetails.unitPrice ?? '—'} {lineDetails.currency || ''}</span>
                            {lineDetails.currentStock !== undefined && <span><span className="font-bold text-muted-foreground">Stock actual:</span> {lineDetails.currentStock}</span>}
                          </div>
                          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">Costo después de recibir: (stock actual × costo actual + cantidad × costo de entrada) ÷ existencias totales.</p>
                        </div>
                      )}
                    </div>
                    {hasDynamicResolution && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                        {canUseParent && (
                          <Button type="button" size="sm" className="gap-2" disabled={isResolving} onClick={() => onSelectExisting?.(group, match)}>
                            {isResolving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                            {hasMultipleVariants ? 'Vincular producto padre' : 'Vincular producto existente'}
                          </Button>
                        )}
                        {match.variants?.map((variant) => (
                          <Button key={variant.id} type="button" size="sm" variant="outline" className="gap-2" disabled={isResolving} onClick={() => onSelectExisting?.(group, match, variant)}>
                            <Check className="size-4" /> Vincular variante {variant.sku}
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
                  {groupHasExactSkuMatch && allowExactSkuCreateInput && (
                    <div className="basis-full flex flex-wrap items-center justify-end gap-2">
                      <label htmlFor={`new-sku-${normalizeSku(group.inputKey)}`} className="text-[11px] font-semibold text-warning dark:text-warning">Nuevo SKU obligatorio:</label>
                      <Input
                        id={`new-sku-${normalizeSku(group.inputKey)}`}
                        value={newSku}
                        onChange={(event) => setNewSkuDrafts((current) => ({ ...current, [group.inputKey]: event.target.value }))}
                        placeholder="Ej. APL-IP15-128-BLU-NUEVO"
                        className="h-8 w-full max-w-xs bg-background text-xs font-mono"
                        disabled={resolvingKey === `${group.inputKey}:CREATE_NEW`}
                      />
                      {newSku.trim() && !newSkuIsValid && <span className="text-[11px] font-semibold text-destructive">Debe ser diferente a todos los SKU existentes.</span>}
                    </div>
                  )}
                  {groupHasExactSkuMatch && !allowExactSkuCreate && <span className="text-right text-[11px] font-semibold text-warning dark:text-warning">SKU exacto: usa el existente o cambia el SKU para crear uno nuevo</span>}
                  <Button type="button" size="sm" variant="outline" className="gap-2 border-warning/50 text-warning hover:bg-warning hover:text-warning-foreground dark:text-warning" disabled={resolvingKey === `${group.inputKey}:CREATE_NEW` || (groupHasExactSkuMatch && (!allowExactSkuCreate && !allowExactSkuCreateInput || allowExactSkuCreateInput && !newSkuIsValid))} onClick={() => onCreateNew?.(group, groupHasExactSkuMatch && allowExactSkuCreateInput ? newSku.trim() : undefined)}>
                    {resolvingKey === `${group.inputKey}:CREATE_NEW` ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    {groupHasExactSkuMatch && !allowExactSkuCreate && !allowExactSkuCreateInput ? 'No se puede duplicar el SKU' : 'Crear como nuevo'}
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
