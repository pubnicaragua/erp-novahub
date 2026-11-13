/**
 * Formato de fechas del sistema: siempre d/m/y (DD/MM/YYYY) y en español,
 * sin depender de la configuración regional del navegador.
 */
export function formatDateEs(value: string | number | Date | null | undefined, withTime = false): string {
  if (value === null || value === undefined || value === '') return '';
  // «2026-12-03» sin hora es una fecha civil: `new Date()` la toma como medianoche UTC y en Nicaragua (UTC−6)
  // se mostraba como 02/12. Se lee por partes para que siempre salga el mismo día que se escribió.
  if (typeof value === 'string') {
    const civil = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (civil) {
      const parsed = new Date(Number(civil[1]), Number(civil[2]) - 1, Number(civil[3]));
      if (!Number.isNaN(parsed.getTime()) && parsed.getMonth() === Number(civil[2]) - 1) {
        return withTime ? `${civil[3]}/${civil[2]}/${civil[1]} 00:00` : `${civil[3]}/${civil[2]}/${civil[1]}`;
      }
    }
  }
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

/** Fecha civil actual en una zona IANA, útil para inputs type="date". */
export function todayIso(timeZone = 'America/Managua', now = new Date()): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Formats a civil date without shifting it through the browser's local zone. */
export function formatDateOnly(value: string | number | Date | null | undefined, locale = 'es-NI'): string {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(date);
  }
  const civilDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'UTC' }).format(civilDate);
}

/** Formats an event timestamp in the tenant's display zone. */
export function formatInstant(value: string | number | Date | null | undefined, timeZone = 'America/Managua', locale = 'es-NI'): string {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);
}

export function formatInstantDate(value: string | number | Date | null | undefined, timeZone = 'America/Managua', locale = 'es-NI'): string {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone }).format(date);
}
