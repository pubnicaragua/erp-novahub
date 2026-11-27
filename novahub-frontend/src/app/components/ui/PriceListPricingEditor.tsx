import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { priceFromCost } from '../../utils/marginPricing';

export type PriceListPricingMode = 'FIXED' | 'MARGIN';

interface PriceListPricingModeSelectProps {
  value: PriceListPricingMode;
  onValueChange: (value: PriceListPricingMode) => void;
  allowMargin: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function PriceListPricingModeSelect({
  value,
  onValueChange,
  allowMargin,
  disabled = false,
  ariaLabel = 'Modo de precio para todas las listas',
  className = '',
}: PriceListPricingModeSelectProps) {
  return (
    <div className="w-full min-w-0 max-w-52">
      <Select value={allowMargin ? value : 'FIXED'} onValueChange={(mode) => onValueChange(mode as PriceListPricingMode)} disabled={disabled || !allowMargin}>
        <SelectTrigger className={`h-8 w-full px-2 text-xs ${className}`} aria-label={ariaLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="FIXED">Monto fijo</SelectItem>
          <SelectItem value="MARGIN" disabled={!allowMargin}>% ganancia sobre costo</SelectItem>
        </SelectContent>
      </Select>
      {!allowMargin && <p className="mt-1 text-[10px] leading-4 text-muted-foreground">El porcentaje requiere permiso para consultar costos.</p>}
    </div>
  );
}

interface PriceListPricingEditorProps {
  listName: string;
  price: number | string;
  pricingMode: PriceListPricingMode;
  marginPercent: number | string;
  cost: number | string;
  currency: string;
  allowMargin: boolean;
  disabled?: boolean;
  inputTestId?: string;
  onPriceChange: (value: string) => void;
  onMarginPercentChange: (value: string) => void;
}

const formatMoney = (value: number, currency: string) => `${currency === 'USD' ? '$' : 'C$'} ${value.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PriceListPricingEditor({
  listName,
  price,
  pricingMode,
  marginPercent,
  cost,
  currency,
  allowMargin,
  disabled = false,
  inputTestId,
  onPriceChange,
  onMarginPercentChange,
}: PriceListPricingEditorProps) {
  const activeMode: PriceListPricingMode = allowMargin ? pricingMode : 'FIXED';
  const calculatedPrice = activeMode === 'MARGIN' && marginPercent !== ''
    ? priceFromCost(Number(cost), Number(marginPercent), 'markup')
    : null;

  return (
    <div className="min-w-0 space-y-1.5">
      <span className="block min-w-0 truncate text-[10px] font-bold uppercase text-muted-foreground">{listName}</span>
      <Input
        data-testid={inputTestId}
        type="number"
        min={0}
        step={activeMode === 'MARGIN' ? '0.01' : 'any'}
        value={activeMode === 'MARGIN' ? marginPercent : price}
        onChange={(event) => activeMode === 'MARGIN' ? onMarginPercentChange(event.target.value) : onPriceChange(event.target.value)}
        className="h-8 w-full text-right text-xs tabular-nums"
        placeholder={activeMode === 'MARGIN' ? 'Ej. 30' : '0.00'}
        aria-label={activeMode === 'MARGIN' ? `Porcentaje de ganancia sobre costo para ${listName}` : `Precio ${listName}`}
        disabled={disabled}
        currencyPrecision={activeMode === 'FIXED'}
      />
      {activeMode === 'MARGIN' && marginPercent !== '' && (
        <p className="text-[10px] leading-4 text-muted-foreground" role="status">
          Precio de venta con esta ganancia: <strong className="text-foreground">{calculatedPrice === null ? '—' : formatMoney(calculatedPrice, currency)}</strong>
        </p>
      )}
    </div>
  );
}
