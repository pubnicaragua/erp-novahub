import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import type { RecurrenceFrequency } from '../../types';

export const recurrenceFrequencyOptions: Array<{ value: RecurrenceFrequency; label: string }> = [
  { value: 'DAILY', label: 'Diario' },
  { value: 'WEEKLY', label: 'Semanal (cada 7 días)' },
  { value: 'BIWEEKLY', label: 'Quincenal (cada 14 días)' },
  { value: 'CUSTOM_DAYS', label: 'Cada N días' },
  { value: 'TWICE_MONTHLY', label: 'Quincenal (día 15 y fin de mes)' },
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'SEMIANNUAL', label: 'Semestral' },
  { value: 'YEARLY', label: 'Anual' },
];

const recurrenceLabels = Object.fromEntries(recurrenceFrequencyOptions.map((option) => [option.value, option.label]));
export const getRecurrenceFrequencyLabel = (frequency: unknown) => recurrenceLabels[String(frequency || '').toUpperCase()] || String(frequency || '');

export function getMonthlyRecurrenceFactor(frequency: unknown, intervalDays?: unknown) {
  switch (String(frequency || '').toUpperCase()) {
    case 'DAILY': return 365 / 12;
    case 'WEEKLY': return 52 / 12;
    case 'BIWEEKLY': return 26 / 12;
    case 'CUSTOM_DAYS': return 30.4375 / Math.max(2, Number(intervalDays) || 7);
    case 'TWICE_MONTHLY': return 2;
    case 'QUARTERLY': return 1 / 3;
    case 'SEMIANNUAL': return 1 / 6;
    case 'YEARLY': return 1 / 12;
    default: return 1;
  }
}

const monthAnchoredFrequencies = new Set<RecurrenceFrequency>(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'YEARLY']);

export function calculateNextRecurringDate(startDate?: string | Date | null, frequency?: string | null, intervalDays?: number | null, dayOfMonth?: number | null) {
  if (!startDate) return '';
  const dateText = startDate instanceof Date ? startDate.toISOString().slice(0, 10) : String(startDate).slice(0, 10);
  const [year, month, day] = dateText.split('-').map(Number);
  if (!year || !month || !day) return '';
  const next = new Date(Date.UTC(year, month - 1, day));
  const selectedFrequency = String(frequency || 'MONTHLY').toUpperCase();
  switch (selectedFrequency) {
    case 'DAILY': next.setUTCDate(next.getUTCDate() + 1); break;
    case 'WEEKLY': next.setUTCDate(next.getUTCDate() + 7); break;
    case 'BIWEEKLY': next.setUTCDate(next.getUTCDate() + 14); break;
    case 'CUSTOM_DAYS': next.setUTCDate(next.getUTCDate() + Math.min(365, Math.max(2, Number(intervalDays) || 7))); break;
    case 'TWICE_MONTHLY': {
      const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
      if (next.getUTCDate() < 15) next.setUTCDate(15);
      else if (next.getUTCDate() < lastDay) next.setUTCDate(lastDay);
      else {
        next.setUTCDate(1);
        next.setUTCMonth(next.getUTCMonth() + 1);
        next.setUTCDate(15);
      }
      break;
    }
    default: {
      const monthOffset = selectedFrequency === 'QUARTERLY' ? 3 : selectedFrequency === 'SEMIANNUAL' ? 6 : selectedFrequency === 'YEARLY' ? 12 : 1;
      const targetMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + monthOffset, 1));
      const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
      targetMonth.setUTCDate(Math.min(Math.max(1, Number(dayOfMonth) || day), lastDay));
      return targetMonth.toISOString();
    }
  }
  return next.toISOString();
}

interface Props {
  frequency?: string | null;
  intervalDays?: number | null;
  dayOfMonth?: number | null;
  startDate?: string | Date | null;
  disabled?: boolean;
  onChange: (values: { frequency: RecurrenceFrequency; intervalDays?: number; dayOfMonth?: number }) => void;
}

function initialDay(startDate?: string | Date | null) {
  if (!startDate) return 1;
  const dateText = startDate instanceof Date ? startDate.toISOString().slice(0, 10) : String(startDate).slice(0, 10);
  const day = Number(dateText.split('-')[2]);
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : 1;
}

export function RecurrenceScheduleFields({ frequency, intervalDays, dayOfMonth, startDate, disabled, onChange }: Props) {
  const selectedFrequency = String(frequency || 'MONTHLY').toUpperCase() as RecurrenceFrequency;
  const safeFrequency = recurrenceFrequencyOptions.some((option) => option.value === selectedFrequency) ? selectedFrequency : 'MONTHLY';

  return <>
    <div className="min-w-0 space-y-1">
      <p className="text-[10px] text-muted-foreground">Frecuencia</p>
      <Select
        disabled={disabled}
        value={safeFrequency}
        onValueChange={(value) => {
          const nextFrequency = value as RecurrenceFrequency;
          onChange({
            frequency: nextFrequency,
            ...(nextFrequency === 'CUSTOM_DAYS' ? { intervalDays: intervalDays || 7 } : {}),
            ...(monthAnchoredFrequencies.has(nextFrequency) ? { dayOfMonth: dayOfMonth || initialDay(startDate) } : {}),
          });
        }}
      >
        <SelectTrigger className="h-8 w-full min-w-0 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{recurrenceFrequencyOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    {safeFrequency === 'CUSTOM_DAYS' && <div className="min-w-0 space-y-1">
      <label className="text-[10px] text-muted-foreground" htmlFor="recurrence-interval-days">Repetir cada (días)</label>
      <Input id="recurrence-interval-days" disabled={disabled} required type="number" min={2} max={365} step={1} value={intervalDays ?? 7} onChange={(event) => onChange({ frequency: safeFrequency, intervalDays: event.target.value ? Number(event.target.value) : undefined })} className="h-8 text-xs" />
    </div>}
    {monthAnchoredFrequencies.has(safeFrequency) && <div className="min-w-0 space-y-1">
      <label className="text-[10px] text-muted-foreground" htmlFor="recurrence-day-of-month">Día del mes</label>
      <Input id="recurrence-day-of-month" disabled={disabled} required type="number" min={1} max={31} step={1} value={dayOfMonth ?? initialDay(startDate)} onChange={(event) => onChange({ frequency: safeFrequency, dayOfMonth: event.target.value ? Number(event.target.value) : undefined })} className="h-8 text-xs" />
      <p className="text-[10px] text-muted-foreground">Si el mes no tiene ese día, se usa el último.</p>
    </div>}
  </>;
}
