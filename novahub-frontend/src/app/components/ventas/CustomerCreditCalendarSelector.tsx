import { useQuery } from '@tanstack/react-query';
import { customerCreditCalendarService, type CustomerCreditHoliday } from '../../services/ventas.service';
import { useAuth } from '../../contexts/AuthContext';

const unwrap = (response: any): any => response?.data?.data ?? response?.data ?? response;
const weekdays = [
  { id: 1, label: 'Lunes' }, { id: 2, label: 'Martes' }, { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' }, { id: 5, label: 'Viernes' }, { id: 6, label: 'Sábado' }, { id: 7, label: 'Domingo' },
];

export function CustomerCreditCalendarSelector({
  excludedWeekdays,
  holidayIds,
  onChange,
}: {
  excludedWeekdays: number[];
  holidayIds: string[];
  onChange: (value: { excludedWeekdays: number[]; holidayIds: string[]; excludedDates: string[] }) => void;
}) {
  const { user, selectedBranchId } = useAuth();
  const tenantId = String(user?.clientTenantId || user?.tenantId || '');
  const holidaysQuery = useQuery({
    queryKey: ['sales', 'customer-credit-holidays', tenantId, selectedBranchId || 'all-branches'],
    queryFn: async () => {
      const value = unwrap(await customerCreditCalendarService.listHolidays());
      return (Array.isArray(value) ? value : value?.items || []) as CustomerCreditHoliday[];
    },
    staleTime: 60_000,
    enabled: Boolean(tenantId),
  });
  const holidays = holidaysQuery.data || [];
  const update = (days: number[], ids: string[]) => onChange({
    excludedWeekdays: days,
    holidayIds: ids,
    excludedDates: holidays.filter((holiday) => ids.includes(holiday.id)).map((holiday) => String(holiday.date).slice(0, 10)),
  });
  const dateLabel = (value: string) => {
    const date = String(value).slice(0, 10);
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium' }).format(new Date(year, month - 1, day));
  };
  return <div className="grid min-w-0 gap-4 rounded-xl border border-border/50 bg-background/70 p-3 sm:grid-cols-2">
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-xs font-semibold">Excluir días de la semana</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{weekdays.map((day) => <label key={day.id} className="flex items-center gap-2 text-xs text-foreground"><input type="checkbox" className="size-4 accent-primary" checked={excludedWeekdays.includes(day.id)} onChange={(event) => update(event.target.checked ? [...excludedWeekdays, day.id].sort() : excludedWeekdays.filter((value) => value !== day.id), holidayIds)} />{day.label}</label>)}</div>
    </fieldset>
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-xs font-semibold">Aplicar feriados de la sucursal</legend>
      {holidaysQuery.isLoading ? <p className="text-xs text-muted-foreground">Cargando feriados…</p>
        : holidays.length ? <div className="max-h-32 space-y-2 overflow-y-auto">{holidays.map((holiday) => <label key={holiday.id} className="flex items-start gap-2 text-xs text-foreground"><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={holidayIds.includes(holiday.id)} onChange={(event) => update(excludedWeekdays, event.target.checked ? [...holidayIds, holiday.id] : holidayIds.filter((id) => id !== holiday.id))} /><span>{holiday.name} · {dateLabel(holiday.date)}</span></label>)}</div>
          : <p className="text-xs text-muted-foreground">No hay feriados configurados en Créditos.</p>}
      {holidaysQuery.error && <p role="alert" className="text-xs text-destructive">No se pudieron cargar los feriados.</p>}
    </fieldset>
  </div>;
}
