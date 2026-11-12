import { useState } from 'react';
import { CalendarCheck, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { cn } from '../../ui/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { WEEKDAY_NAMES, workforceService, type RecurringLeavePreview } from '../../../services/workforce.service';
import { dayLabel, failure } from './workforceUtils';
import type { EmployeeOption } from './ScheduleEditor';

const field = 'h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';
const days = (value: number) => value.toLocaleString('es-NI', { maximumFractionDigits: 2 });

/** Aprobar de una sola vez las vacaciones de todos los sábados (u otro día fijo) de un período, con el saldo que queda. */
export function RecurringLeavePanel({ employees }: { employees: EmployeeOption[] }) {
  const client = useQueryClient();
  const { canPerform } = useAuth();
  const canApprove = canPerform('HR_LEAVES', 'approve');
  const today = new Date().toISOString().slice(0, 10);
  const [employeeId, setEmployeeId] = useState('');
  const [weekday, setWeekday] = useState('6');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<RecurringLeavePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useTenantQuery(['workforce', 'recurring-leaves'], (signal) => workforceService.listRecurringLeaves(undefined, signal), { staleTime: 10_000 });
  const refresh = () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };
  const payload = { employeeId, weekday: Number(weekday), startDate, endDate };

  const calculate = async () => {
    setBusy(true);
    try { setPreview(await workforceService.previewRecurringLeave(payload)); } catch (error) { toast.error(failure(error)); setPreview(null); } finally { setBusy(false); }
  };
  const approve = async () => {
    setBusy(true);
    try { await workforceService.createRecurringLeave({ ...payload, ...(reason.trim() ? { reason: reason.trim() } : {}) }); toast.success('Vacaciones aprobadas para todo el período'); setPreview(null); refresh(); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const cancel = async (id: string) => {
    setBusy(true);
    try { await workforceService.cancelRecurringLeave(id); toast.success('Vacaciones recurrentes canceladas'); refresh(); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-4" aria-label="Vacaciones de todos los sábados">
      <div><h3 className="nh-module-title">Vacaciones en días fijos (por ejemplo todos los sábados)</h3><p className="text-xs text-muted-foreground">Apruebas el período completo en un solo paso, sin ir día por día. Los feriados no se descuentan y el descuento sigue la regla del horario de la empresa.</p></div>

      <fieldset disabled={busy} className="grid gap-3 rounded-2xl border border-border/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="rl-employee">Empleado</Label>
          <select id="rl-employee" className={field} value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setPreview(null); }}>
            <option value="">Elegir…</option>
            {employees.filter((employee) => (employee.employmentStatus || 'ACTIVE') === 'ACTIVE').map((employee) => <option key={employee.id} value={employee.id}>{[employee.employeeNumber, `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim()].filter(Boolean).join(' · ')}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="rl-weekday">Todos los…</Label><select id="rl-weekday" className={field} value={weekday} onChange={(e) => { setWeekday(e.target.value); setPreview(null); }}>{[1, 2, 3, 4, 5, 6].map((day) => <option key={day} value={day}>{WEEKDAY_NAMES[day]}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="rl-reason">Motivo (opcional)</Label><Input id="rl-reason" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Estudia los sábados" /></div>
        <div className="space-y-1.5"><Label htmlFor="rl-start">Desde</Label><Input id="rl-start" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPreview(null); }} /></div>
        <div className="space-y-1.5"><Label htmlFor="rl-end">Hasta</Label><Input id="rl-end" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPreview(null); }} /></div>
        <div className="flex items-end sm:col-span-2"><Button type="button" variant="outline" disabled={!employeeId || !startDate || !endDate} onClick={() => void calculate()}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Calcular cómo queda</Button></div>
      </fieldset>

      {preview && (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4" role="status">
          <p className="text-sm font-black">{preview.employee.name}: {preview.occurrences} {WEEKDAY_NAMES[preview.weekday].toLowerCase()}s en el período, {days(preview.portion)} día de vacación cada uno</p>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[['Saldo disponible', `${days(preview.vacation.available)} días`], ['Se descontarían', `${days(preview.daysConsumed)} días`], ['Quedarían', `${days(preview.remainingAfter)} días`], ['Cabrían en el saldo', `${preview.occurrencesThatFit} ${WEEKDAY_NAMES[preview.weekday].toLowerCase()}s`]].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted/30 p-3"><dt className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-black tabular-nums">{value}</dd></div>
            ))}
          </dl>
          <p className={cn('rounded-lg px-3 py-2 text-sm', preview.owesVacation ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900')}>
            {preview.owesVacation ? `Con todos esos días el empleado quedaría debiendo ${days(preview.shortfallDays)} días de vacaciones: habría que compensarlos con otro día o descontarlos.` : 'El saldo alcanza: no queda debiendo vacaciones.'}
            {preview.skippedHolidays.length > 0 && <> Se omiten los feriados: {preview.skippedHolidays.map((date) => dayLabel(date)).join(', ')}.</>}
          </p>
          {canApprove && <div className="flex justify-end"><Button type="button" disabled={busy} onClick={() => void approve()}><CalendarCheck className="mr-2 size-4" />Aprobar todas de una vez</Button></div>}
        </div>
      )}

      <div>
        <h4 className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Aprobadas</h4>
        {(list.data?.length ?? 0) === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aún no hay vacaciones en días fijos.</p> : (
          <ul className="space-y-2">
            {list.data?.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
                <span><b>{row.employeeName}</b> · todos los {WEEKDAY_NAMES[row.weekday].toLowerCase()}s · {dayLabel(row.startDate, { day: 'numeric', month: 'short', year: 'numeric' })} al {dayLabel(row.endDate, { day: 'numeric', month: 'short', year: 'numeric' })} · {days(row.portion)} día cada uno{row.reason ? ` · ${row.reason}` : ''}</span>
                <span className="flex items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', row.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-600')}>{row.status === 'ACTIVE' ? 'Vigente' : 'Cancelada'}</span>
                  {row.status === 'ACTIVE' && canApprove && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void cancel(row.id)}>Cancelar</Button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
