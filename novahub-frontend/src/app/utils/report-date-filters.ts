/**
 * Construye límites para que los reportes consulten solo el período que van
 * a mostrar. Se envían como ISO completos para conservar correctamente la
 * zona horaria del navegador y evitar cortes en los extremos del día.
 */
export function buildReportDateFilters(
  start: Date | null | undefined,
  end: Date,
  ...additionalStarts: Array<Date | null | undefined>
): Record<string, string> {
  const candidates = [start, ...additionalStarts]
    .filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()) && value.getTime() > 0);
  if (candidates.length === 0) return {};
  const first = new Date(Math.min(...candidates.map((value) => value.getTime())));
  return { dateFrom: first.toISOString(), dateTo: end.toISOString() };
}

export function buildInventoryReportDateFilters(
  start: Date | null | undefined,
  end: Date,
  ...additionalStarts: Array<Date | null | undefined>
): Record<string, string> {
  const filters = buildReportDateFilters(start, end, ...additionalStarts);
  if (!filters.dateFrom) return {};
  return { from: filters.dateFrom, to: filters.dateTo };
}
