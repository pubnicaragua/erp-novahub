import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { MARGIN_MODE_LABEL, priceFromCost, type MarginMode } from '../../utils/marginPricing';
import { getCurrencyDecimalPlaces } from '../../utils/currency';

const money = (value: number) => value.toLocaleString('es-NI', { minimumFractionDigits: getCurrencyDecimalPlaces(), maximumFractionDigits: getCurrencyDecimalPlaces() });

function ModeSelect({ value, onChange, compact = false }: { value: MarginMode; onChange: (mode: MarginMode) => void; compact?: boolean }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as MarginMode)}
      className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs"
      aria-label="Fórmula de ganancia"
    >
      {(Object.keys(MARGIN_MODE_LABEL) as MarginMode[]).map((mode) => <option key={mode} value={mode}>{compact ? (mode === 'margin' ? 'Margen' : 'Recargo') : MARGIN_MODE_LABEL[mode]}</option>)}
    </select>
  );
}

/**
 * Recomendación de precio para UN producto: el usuario escribe la ganancia deseada,
 * ve el precio sugerido con la fórmula y decide si lo aplica a sus listas de precios.
 */
export function MarginPriceSuggestion({ cost, currencySymbol = '', onApply, className, compact = false }: {
  cost: number | string;
  currencySymbol?: string;
  onApply: (price: number) => void;
  className?: string;
  compact?: boolean;
}) {
  const [percent, setPercent] = useState('');
  const [mode, setMode] = useState<MarginMode>('margin');
  const numericCost = Number(cost);
  const suggested = percent === '' ? null : priceFromCost(numericCost, Number(percent), mode);
  const hint = percent === '' ? 'Escribe la ganancia que quieres obtener.'
    : !(numericCost > 0) ? 'Ingresa primero el costo.'
      : suggested === null ? (mode === 'margin' && Number(percent) >= 100 ? 'El margen debe ser menor a 100 %.' : 'Porcentaje no válido.')
        : `Precio sugerido: ${currencySymbol} ${money(suggested)} · ganancia ${currencySymbol} ${money(suggested - numericCost)}`;

  return (
    <div className={className ?? `col-span-full rounded-lg border border-dashed border-primary/30 bg-primary/5 ${compact ? 'px-2 py-1.5' : 'p-2'}`} data-testid="inventory-margin-suggestion">
      <div className="flex flex-wrap items-center gap-2">
        <Calculator className="size-4 text-primary" aria-hidden />
        <span className="text-[10px] font-bold uppercase text-muted-foreground">Ganancia deseada</span>
        <Input type="number" min={0} max={mode === 'margin' ? 99.99 : undefined} step="any" value={percent} onChange={(event) => setPercent(event.target.value)} className="h-8 w-20 text-right text-xs tabular-nums" placeholder="30" aria-label="Porcentaje de ganancia deseada" />
        <span className="text-xs">%</span>
        <ModeSelect value={mode} onChange={setMode} compact={compact} />
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={suggested === null} onClick={() => suggested !== null && onApply(suggested)}>{compact ? 'Aplicar' : 'Aplicar a los precios'}</Button>
      </div>
      {!compact && <p className="mt-1 text-[11px] text-muted-foreground" role="status">{hint}</p>}
    </div>
  );
}

/** Aplicación MASIVA: calcula el precio de cada producto de la lista a partir de su propio costo. */
export function BulkMarginBar({ count, onApply }: { count: number; onApply: (percent: number, mode: MarginMode) => void }) {
  const [percent, setPercent] = useState('');
  const [mode, setMode] = useState<MarginMode>('margin');
  const valid = priceFromCost(100, Number(percent), mode) !== null && percent !== '';
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2" data-testid="inventory-margin-bulk">
      <Calculator className="size-4 text-primary" aria-hidden />
      <span className="text-[10px] font-bold uppercase text-muted-foreground">Precio por ganancia a los {count} de la lista</span>
      <Input type="number" min={0} step="any" value={percent} onChange={(event) => setPercent(event.target.value)} className="h-8 w-20 text-right text-xs tabular-nums" placeholder="30" aria-label="Porcentaje de ganancia para toda la lista" />
      <span className="text-xs">%</span>
      <ModeSelect value={mode} onChange={setMode} />
      <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!valid} onClick={() => onApply(Number(percent), mode)}>Calcular precios</Button>
    </div>
  );
}
