/**
 * Fórmulas de precio a partir del costo.
 *
 * - "margin" (margen sobre el precio de venta): la ganancia es un % del PRECIO.
 *   precio = costo / (1 − margen/100). Con margen 30 % el divisor es 0.70.
 *   Es lo que la mayoría de los clientes entiende por "quiero ganar el 30 %".
 * - "markup" (recargo sobre el costo): la ganancia es un % del COSTO.
 *   precio = costo × (1 + recargo/100).
 *
 * Ejemplo con costo 100: margen 30 % → 142.86 (ganancia 42.86 = 30 % de 142.86);
 * recargo 30 % → 130.00 (ganancia 30 = 30 % de 100).
 */
export type MarginMode = 'margin' | 'markup';

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Devuelve el precio sugerido, o null si el costo o el porcentaje no permiten calcularlo. */
export function priceFromCost(cost: number, percent: number, mode: MarginMode = 'margin'): number | null {
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(percent) || percent < 0) return null;
  if (mode === 'margin') {
    if (percent >= 100) return null; // con 100 % el divisor sería 0
    return roundMoney(cost / (1 - percent / 100));
  }
  return roundMoney(cost * (1 + percent / 100));
}

/** Operación inversa: qué porcentaje de ganancia representa un precio dado. */
export function percentFromPrice(cost: number, price: number, mode: MarginMode = 'margin'): number | null {
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(price) || price <= 0) return null;
  const percent = mode === 'margin' ? ((price - cost) / price) * 100 : ((price - cost) / cost) * 100;
  return Math.round(percent * 100) / 100;
}

export const MARGIN_MODE_LABEL: Record<MarginMode, string> = {
  margin: 'Margen sobre el precio (costo ÷ (1 − %))',
  markup: 'Recargo sobre el costo (costo × (1 + %))',
};
