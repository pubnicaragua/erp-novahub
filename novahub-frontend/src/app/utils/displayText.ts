/**
 * Texto legible para el usuario. Un identificador interno (UUID de la base de datos, cuid) nunca debe verse como
 * nombre, título o código: si es lo único que hay, se muestra un guion en lugar del identificador.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUID = /^c[a-z0-9]{24}$/;

export function isInternalId(value: unknown): boolean {
  const text = String(value ?? '').trim();
  return UUID.test(text) || CUID.test(text);
}

/** El primer valor que tenga texto y no sea un identificador interno; si no hay ninguno, `fallback` (por defecto «—»). */
export function firstReadable(...values: unknown[]): string {
  let fallback = '—';
  if (values.length && typeof values[values.length - 1] === 'object' && values[values.length - 1] !== null && 'fallback' in (values[values.length - 1] as object)) {
    fallback = String((values.pop() as { fallback: unknown }).fallback);
  }
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text && !isInternalId(text)) return text;
  }
  return fallback;
}

/** Título y subtítulo de una tarjeta: la descripción o el nombre arriba; el número o código debajo, sin repetirse. */
export function cardHeading(row: Record<string, unknown>): { title: string; subtitle: string } {
  const title = firstReadable(row.name, row.title, row.label, row.description, row.customerName, row.supplierName, row.number, row.code);
  const reference = firstReadable(row.number, row.code, { fallback: '' });
  return { title, subtitle: reference && reference !== title ? reference : '' };
}
