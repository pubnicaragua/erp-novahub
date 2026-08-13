/**
 * Formato de fechas del sistema: siempre d/m/y (DD/MM/YYYY) y en español,
 * sin depender de la configuración regional del navegador.
 */
export function formatDateEs(value: string | number | Date | null | undefined, withTime = false): string {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  if (!withTime) return `${day}/${month}/${year}`;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/** Fecha de hoy en formato ISO (yyyy-mm-dd), útil para inputs type="date". */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
