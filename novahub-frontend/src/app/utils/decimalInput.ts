/**
 * Normaliza valores decimales usados en inputs financieros sin permitir más
 * precisión de la que puede presentar el formulario.
 *
 * Se conserva el punto final durante la edición (por ejemplo, `12.`), pero
 * se recorta cualquier dígito posterior al límite configurado.
 */
export function normalizeDecimalInput(value: unknown, decimals = 2): string {
  const raw = String(value ?? '').replace(',', '.');
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dotIndex = cleaned.indexOf('.');

  if (dotIndex < 0) return cleaned;

  const integerPart = cleaned.slice(0, dotIndex);
  const fractionPart = cleaned
    .slice(dotIndex + 1)
    .replace(/\./g, '')
    .slice(0, decimals);

  return `${integerPart}.${fractionPart}`;
}

export function formatDecimalInput(value: unknown, decimals = 2): string {
  if (value === '' || value === null || value === undefined) return '';
  return normalizeDecimalInput(value, decimals);
}
