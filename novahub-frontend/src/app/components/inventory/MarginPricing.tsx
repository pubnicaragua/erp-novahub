import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { priceFromCost, type MarginMode } from '../../utils/marginPricing';
import { getCurrencyDecimalPlaces } from '../../utils/currency';

const money = (value: number) => value.toLocaleString('es-NI', { minimumFractionDigits: getCurrencyDecimalPlaces(), maximumFractionDigits: getCurrencyDecimalPlaces() });

/**
 * Recomendación de precio para UN producto: el usuario escribe la ganancia deseada,
 * calculada como recargo sobre el costo y decide si la aplica a sus listas de precios.
 */
export function MarginPriceSuggestion({ cost, currencySymbol = '', onApply, className, compact = false }: {
  cost: number | string;
  currencySymbol?: string;
  onApply: (price: number) => void;
  className?: string;
  compact?: boolean;
}) {
  const [percent, setPercent] = useState('');
  const numericCost = Number(cost);
  const suggested = percent === '' ? null : priceFromCost(numericCost, Number(percent), 'markup');
  const hint = percent === '' ? 'Escribe la ganancia que quieres obtener.'
    : !(numericCost > 0) ? 'Ingresa primero el costo.'
      : suggested === null ? 'Ingresa un porcentaje de ganancia válido.'
        : `Precio sugerido: ${currencySymbol} ${money(suggested)} · ganancia ${currencySymbol} ${money(suggested - numericCost)}`;

  return (
    <div className={className ?? `col-span-full rounded-lg border border-dashed border-primary/30 bg-primary/5 ${compact ? 'px-2 py-1.5' : 'p-2'}`} data-testid="inventory-margin-suggestion">
      <div className="flex flex-wrap items-center gap-2">
        <Calculator className="size-4 text-primary" aria-hidden />
        <span className="text-[10px] font-bold uppercase text-muted-foreground">Ganancia sobre costo</span>
        <Input type="number" min={0} step="any" value={percent} onChange={(event) => setPercent(event.target.value)} className="h-8 w-20 text-right text-xs tabular-nums" placeholder="30" aria-label="Porcentaje de ganancia sobre costo" />
        <span className="text-xs">%</span>
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={suggested === null} onClick={() => suggested !== null && onApply(suggested)}>{compact ? 'Aplicar' : 'Aplicar a los precios'}</Button>
      </div>
      {!compact && <p className="mt-1 text-[11px] text-muted-foreground" role="status">{hint}</p>}
    </div>
  );
}

/** Aplicación MASIVA: calcula el precio de cada producto de la lista a partir de su propio costo. */
export function BulkMarginBar({ count, onApply }: { count: number; onApply: (percent: number, mode: MarginMode) => void }) {
  const [percent, setPercent] = useState('');
  const valid = priceFromCost(100, Number(percent), 'markup') !== null && percent !== '';
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2" data-testid="inventory-margin-bulk">
      <Calculator className="size-4 text-primary" aria-hidden />
      <span className="text-[10px] font-bold uppercase text-muted-foreground">Ganancia sobre costo para los {count} productos de la lista</span>
      <Input type="number" min={0} step="any" value={percent} onChange={(event) => setPercent(event.target.value)} className="h-8 w-20 text-right text-xs tabular-nums" placeholder="30" aria-label="Porcentaje de ganancia para toda la lista" />
      <span className="text-xs">%</span>
      <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!valid} onClick={() => onApply(Number(percent), 'markup')}>Calcular precios</Button>
    </div>
  );
}
