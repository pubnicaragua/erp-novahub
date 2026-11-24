/**
 * Límites inclusivos pueden continuar al siguiente centavo o a la unidad
 * entera siguiente, igual que la validación del backend.
 */
export function areCommissionScaleRulesConsecutive(currentMax: number, nextMin: number): boolean {
  const currentMaxCents = Math.round(currentMax * 100);
  const nextMinCents = Math.round(nextMin * 100);
  return nextMinCents === currentMaxCents + 1 || nextMinCents === currentMaxCents + 100;
}
