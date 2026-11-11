/**
 * Paso de las flechas de un campo numérico.
 *
 * Un campo de dinero con step="0.01" hace que las flechas muevan el valor de a centavo (500 → 499.99). Para que suban y
 * bajen de a una unidad y aun así acepten decimales, el campo debe usar step="any". Esta regla se aplica en un solo
 * lugar (el componente Input) para que ninguna pantalla tenga que acordarse.
 */
const DECIMAL_MONEY_STEP = /^0?\.0*1$/;

export function resolveNumberInputStep(
  type: string | undefined,
  step: string | number | undefined,
  currencyPrecision?: boolean,
): string | number | undefined {
  if (type !== 'number') return step;
  if (currencyPrecision) return 'any';
  if (step !== undefined && DECIMAL_MONEY_STEP.test(String(step).trim())) return 'any';
  return step;
}
