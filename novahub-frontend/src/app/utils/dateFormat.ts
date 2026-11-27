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

/** Suma días de calendario a una fecha civil sin depender de la zona del navegador. */
export function addCivilDays(value: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(days)) return value;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + Math.trunc(days));
  return date.toISOString().slice(0, 10);
}

/** Convierte un instante a la hora de pared que debe mostrar datetime-local en la zona del tenant. */
export function toDateTimeLocal(value: Date, timeZone = 'America/Managua'): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Interpreta una hora datetime-local como hora civil del tenant y la convierte a ISO UTC. */
export function dateTimeLocalToIso(value: string, timeZone = 'America/Managua'): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const [year, month, day, hour, minute] = [yearText, monthText, dayText, hourText, minuteText].map(Number);
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute);
  const normalized = new Date(wallClockUtc);
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1
    || normalized.getUTCDate() !== day || normalized.getUTCHours() !== hour || normalized.getUTCMinutes() !== minute) return null;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const offsetAt = (timestamp: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(({ type, value: part }) => [type, part]));
    const localAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    return localAsUtc - Math.floor(timestamp / 1000) * 1000;
  };

  let timestamp = wallClockUtc;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const adjusted = wallClockUtc - offsetAt(timestamp);
    if (adjusted === timestamp) break;
    timestamp = adjusted;
  }
  const result = new Date(timestamp);
  if (toDateTimeLocal(result, timeZone) !== value) return null;
  return result.toISOString();
}

/**
 * Refreshes an untouched default document date immediately before creating the
 * document. A date the user changed remains exactly as entered.
 */
export function resolveDocumentDateAtSave(
  date: string | null | undefined,
  draftStartedAt: string | null | undefined,
  isNewDocument: boolean,
  savedAt: Date = new Date(),
): string | null | undefined {
  if (!isNewDocument || !date || !draftStartedAt || Number.isNaN(savedAt.getTime())) return date;

  const datePart = (value: string) => /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(value.trim())?.[1] || null;
  const currentDatePart = datePart(date);
  if (!currentDatePart || currentDatePart !== datePart(draftStartedAt)) return date;

  const savedAtIso = savedAt.toISOString();
  return /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
    ? savedAtIso.slice(0, 10)
    : savedAtIso;
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
