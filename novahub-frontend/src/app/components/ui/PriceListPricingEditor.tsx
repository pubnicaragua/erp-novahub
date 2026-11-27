import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { priceFromCost } from '../../utils/marginPricing';

export type PriceListPricingMode = 'FIXED' | 'MARGIN';

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
  onPricingModeChange: (value: PriceListPricingMode) => void;
  onMarginPercentChange: (value: string) => void;
  onApplyMargin: (price: number) => void;
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
  onPricingModeChange,
  onMarginPercentChange,
  onApplyMargin,
}: PriceListPricingEditorProps) {
  const activeMode: PriceListPricingMode = allowMargin ? pricingMode : 'FIXED';
  const calculatedPrice = activeMode === 'MARGIN' && marginPercent !== ''
    ? priceFromCost(Number(cost), Number(marginPercent), 'margin')
    : null;

  const commitMargin = () => {
    if (calculatedPrice !== null) onApplyMargin(calculatedPrice);
  };

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[10px] font-bold uppercase text-muted-foreground">{listName}</span>
        <Select
          value={activeMode}
          onValueChange={(value) => onPricingModeChange(value as PriceListPricingMode)}
          disabled={disabled || !allowMargin}
        >
          <SelectTrigger className="h-7 w-[6.6rem] shrink-0 px-2 text-[10px]" aria-label={`Modo de precio ${listName}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FIXED">Monto fijo</SelectItem>
            <SelectItem value="MARGIN" disabled={!allowMargin}>% margen bruto</SelectItem>
          </SelectContent>
        </Select>
      </div>
        <Input
        data-testid={inputTestId}
        type="number"
        min={0}
        max={activeMode === 'MARGIN' ? 99.99 : undefined}
        step={activeMode === 'MARGIN' ? '0.01' : 'any'}
        value={activeMode === 'MARGIN' ? marginPercent : price}
        onChange={(event) => activeMode === 'MARGIN' ? onMarginPercentChange(event.target.value) : onPriceChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || activeMode !== 'MARGIN') return;
          event.preventDefault();
          event.stopPropagation();
          commitMargin();
        }}
        className="h-8 w-full text-right text-xs tabular-nums"
        placeholder={activeMode === 'MARGIN' ? 'Ej. 30' : '0.00'}
        aria-label={activeMode === 'MARGIN' ? `Margen bruto para ${listName}, porcentaje` : `Precio ${listName}`}
        aria-invalid={activeMode === 'MARGIN' && marginPercent !== '' && calculatedPrice === null}
        disabled={disabled}
        currencyPrecision={activeMode === 'FIXED'}
      />
      {activeMode === 'MARGIN' && (
        <p className="text-[10px] leading-4 text-muted-foreground" role="status">
          {calculatedPrice === null
            ? 'Ingresa un costo y un margen menor a 100%.'
            : <>Presiona Enter para aplicar · Precio de venta: <strong className="text-foreground">{formatMoney(calculatedPrice, currency)}</strong></>}
        </p>
      )}
      {!allowMargin && <p className="text-[10px] text-muted-foreground">El margen requiere permiso para consultar costos.</p>}
    </div>
  );
}
