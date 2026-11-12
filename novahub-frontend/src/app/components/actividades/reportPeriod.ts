export type PeriodPreset = 'ALL' | 'TODAY' | '7D' | '30D' | 'CUSTOM';

export const toLocalDateInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Fechas «desde/hasta» (día local, AAAA-MM-DD) que corresponden a cada atajo de periodo; «7 días» incluye hoy. */
export function resolvePeriod(preset: PeriodPreset, custom: { from: string; to: string }, now: Date = new Date()): { from: string; to: string } {
  if (preset === 'ALL') return { from: '', to: '' };
  if (preset === 'CUSTOM') return custom;
  const today = toLocalDateInput(now);
  if (preset === 'TODAY') return { from: today, to: today };
  const back = new Date(now);
  back.setDate(back.getDate() - (preset === '7D' ? 6 : 29));
  return { from: toLocalDateInput(back), to: today };
}
