export type AcquisitionGrouping = 'month' | 'quarter' | 'four-month' | 'semester' | 'year';
export function buildCustomerAcquisitionSection(series: { period: string; count: number }[], group: AcquisitionGrouping, from: string, to: string): { id: string; title: string; headers: string[]; rows: (string | number)[][] } {
  return { id: 'customers-acquisition', title: `Altas de clientes · ${acquisitionPeriodLabel(group, from, to)}`, headers: ['Período', 'Clientes nuevos'], rows: series.map(point => [point.period, point.count]) };
}

export const ACQUISITION_GROUPS: { value: AcquisitionGrouping; label: string; months: number }[] = [
  { value: 'month', label: 'Mes', months: 1 },
  { value: 'quarter', label: 'Trimestre', months: 3 },
  { value: 'four-month', label: 'Cuatrimestre', months: 4 },
  { value: 'semester', label: 'Semestre', months: 6 },
  { value: 'year', label: 'Año', months: 12 },
];
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const calendarFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit' });

function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) > 0
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function customerDay(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return validDay(value) ? value : null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  const parts = calendarFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function buildCustomerAcquisitionSeries(customers: { createdAt?: unknown }[], group: AcquisitionGrouping = 'year', from = '', to = ''): { period: string; count: number }[] {
  if ((from && !validDay(from)) || (to && !validDay(to)) || (from && to && from > to)) return [];
  const days = customers.map(customer => customerDay(customer.createdAt)).filter((day): day is string => day !== null).sort();
  const first = from || days[0] || to;
  const last = to || days[days.length - 1] || from;
  if (!first || !last) return [];
  // With an open bound and no records in its direction, keep the selected period visible at zero.
  const start = first > last ? (from || to) : first;
  const end = first > last ? (to || from) : last;
  const months = ACQUISITION_GROUPS.find(option => option.value === group)!.months;
  const bucket = (day: string) => Number(day.slice(0, 4)) * 12 + Math.floor((Number(day.slice(5, 7)) - 1) / months) * months;
  const counts = new Map<number, number>();
  for (const day of days) {
    if ((from && day < from) || (to && day > to)) continue;
    const key = bucket(day);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const result = [];
  for (let key = bucket(start); key <= bucket(end); key += months) {
    const year = Math.floor(key / 12);
    const month = key % 12;
    const prefix = group === 'quarter' ? 'T' : group === 'four-month' ? 'C' : 'S';
    const period = group === 'year' ? `${year}` : group === 'month' ? `${MONTHS[month]} ${year}` : `${prefix}${month / months + 1} ${year}`;
    result.push({ period, count: counts.get(key) || 0 });
  }
  return result;
}

export function buildCustomerComposition(customers: { status?: unknown }[]): { name: string; count: number; share: number }[] {
  const active = customers.filter(customer => String(customer.status || '').toUpperCase() === 'ACTIVE').length;
  return [{ name: 'Activos', count: active }, { name: 'Inactivos', count: customers.length - active }]
    .map(slice => ({ ...slice, share: customers.length ? slice.count / customers.length * 100 : 0 }));
}

export function acquisitionPeriodLabel(group: AcquisitionGrouping, from: string, to: string): string {
  const range = !from && !to ? 'Historial completo' : `${from || 'Inicio del historial'} a ${to || 'Fin del historial'} (inclusive)`;
  return `${range} · ${ACQUISITION_GROUPS.find(option => option.value === group)!.label} · America/Managua`;
}
