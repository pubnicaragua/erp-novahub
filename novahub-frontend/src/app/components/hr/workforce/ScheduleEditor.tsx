import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Skeleton } from '../../ui/skeleton';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { VACATION_RULE_LABEL, WEEKDAY_NAMES, workforceService, type DayMode, type DaySchedule, type ScheduleResponse, type VacationRule } from '../../../services/workforce.service';
import { failure } from './workforceUtils';

const MODE_LABEL: Record<DayMode, string> = { REGULAR: 'Laboral', EXTRA: 'Extra (se paga aparte)', OFF: 'No se trabaja' };
const field = 'h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';

export interface EmployeeOption { id: string; firstName?: string; lastName?: string; employeeNumber?: string; employmentStatus?: string }

function ScheduleForm({ schedule, employeeId, canEdit }: { schedule: ScheduleResponse; employeeId: string; canEdit: boolean }) {
  const client = useQueryClient();
  const [days, setDays] = useState<Record<string, DaySchedule>>(schedule.days);
  const [rule, setRule] = useState<VacationRule>(schedule.vacationRule);
  const [fullDay, setFullDay] = useState(String(schedule.fullDayHours));
  const [multiplier, setMultiplier] = useState(String(schedule.overtimeMultiplier));
  const [busy, setBusy] = useState(false);
  const setDay = (day: number, patch: Partial<DaySchedule>) => setDays((current) => {
    const next = { ...current[String(day)], ...patch } as DaySchedule;
    if (next.mode === 'OFF') { next.start = null; next.end = null; } else { next.start = next.start || '08:00'; next.end = next.end || '12:00'; }
    return { ...current, [String(day)]: next };
  });
  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await action(); toast.success(message); void client.invalidateQueries({ queryKey: ['tenant-module'] }); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const weekHours = Object.values(days).reduce((sum, day) => {
    if (day.mode !== 'REGULAR' || !day.start || !day.end) return sum;
    const [sh, sm] = day.start.split(':').map(Number); const [eh, em] = day.end.split(':').map(Number);
    return sum + Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
  }, 0);

  return (
    <div className="space-y-4">
      <fieldset disabled={!canEdit || busy} className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const entry = days[String(day)];
          return (
            <div key={day} className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-center gap-2 rounded-xl border border-border/50 p-2 sm:grid-cols-[100px_200px_minmax(0,1fr)]">
              <span className="text-sm font-semibold">{WEEKDAY_NAMES[day]}</span>
              <select aria-label={`Tipo de día ${WEEKDAY_NAMES[day]}`} className={field} value={entry.mode} onChange={(e) => setDay(day, { mode: e.target.value as DayMode })}>{(Object.keys(MODE_LABEL) as DayMode[]).map((mode) => <option key={mode} value={mode}>{MODE_LABEL[mode]}</option>)}</select>
              {entry.mode !== 'OFF' && (
                <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                  <Input aria-label={`Entrada ${WEEKDAY_NAMES[day]}`} type="time" value={entry.start ?? ''} onChange={(e) => setDay(day, { start: e.target.value })} className="w-32" />
                  <span className="text-xs text-muted-foreground">a</span>
                  <Input aria-label={`Salida ${WEEKDAY_NAMES[day]}`} type="time" value={entry.end ?? ''} onChange={(e) => setDay(day, { end: e.target.value })} className="w-32" />
                </div>
              )}
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">{weekHours.toLocaleString('es-NI', { maximumFractionDigits: 1 })} horas laborales a la semana · {schedule.operatingHoursPerMonth.toLocaleString('es-NI', { maximumFractionDigits: 0 })} horas de operación al mes.</p>
      </fieldset>

      <fieldset disabled={!canEdit || busy} className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="ws-rule">Cuando alguien falta o toma vacaciones un día, se descuenta…</Label><select id="ws-rule" className={field} value={rule} onChange={(e) => setRule(e.target.value as VacationRule)}>{(Object.keys(VACATION_RULE_LABEL) as VacationRule[]).map((key) => <option key={key} value={key}>{VACATION_RULE_LABEL[key]}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="ws-full">Horas de una jornada completa</Label><Input id="ws-full" type="number" min="1" max="24" step="0.5" value={fullDay} onChange={(e) => setFullDay(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="ws-mult">Pago de horas extra (veces la hora normal)</Label><Input id="ws-mult" type="number" min="1" max="5" step="0.25" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} /></div>
      </fieldset>

      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          {employeeId && schedule.scope === 'EMPLOYEE' && <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => workforceService.removeEmployeeSchedule(employeeId), 'Vuelve a usar el horario de la empresa')}>Quitar horario propio</Button>}
          <Button type="button" disabled={busy} onClick={() => void run(() => workforceService.saveSchedule({ employeeId: employeeId || null, days, vacationRule: rule, fullDayHours: Number(fullDay), overtimeMultiplier: Number(multiplier) }), employeeId ? 'Horario del empleado guardado' : 'Horario de la empresa guardado')}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar horario</Button>
        </div>
      )}
    </div>
  );
}

/** Horario de la empresa y, si hace falta, uno propio para cada empleado (por ejemplo quien estudia los sábados). */
export function ScheduleEditor({ employees }: { employees: EmployeeOption[] }) {
  const { canPerform } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const query = useTenantQuery(['workforce', 'schedule', employeeId], (signal) => workforceService.getSchedule(employeeId || undefined, signal), { staleTime: 0 });
  return (
    <section className="space-y-4" aria-label="Horario de trabajo">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="text-base font-black">Horario de trabajo</h3><p className="text-xs text-muted-foreground">Define cuándo se trabaja. Cada empleado puede tener un horario distinto al de la empresa.</p></div>
        <div className="min-w-[220px] space-y-1"><Label htmlFor="ws-employee">Aplicar a</Label>
          <select id="ws-employee" className={field} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Toda la empresa</option>
            {employees.filter((employee) => (employee.employmentStatus || 'ACTIVE') === 'ACTIVE').map((employee) => <option key={employee.id} value={employee.id}>{[employee.employeeNumber, `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim()].filter(Boolean).join(' · ')}</option>)}
          </select>
        </div>
      </div>
      {employeeId && query.data?.scope === 'COMPANY' && <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Este empleado usa el horario de la empresa. Si lo guardas aquí, tendrá uno propio.</p>}
      {query.isLoading ? <Skeleton className="h-72 w-full rounded-2xl" aria-busy="true" />
        : query.isError || !query.data ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">No se pudo cargar el horario.</p>
        : <ScheduleForm key={`${employeeId}-${query.data.scope}-${query.dataUpdatedAt}`} schedule={query.data} employeeId={employeeId} canEdit={canPerform('HR_LEAVES', 'edit')} />}
    </section>
  );
}
