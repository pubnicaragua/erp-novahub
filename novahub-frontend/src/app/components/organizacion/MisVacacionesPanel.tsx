import { useState } from 'react';
import { CalendarCheck, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { toast } from '../../services/toast';
import { LEAVE_TYPE_LABEL, employeeProfileService, type LeaveRequestRow } from '../../services/employee-profile.service';
import { Field, NativeSelect, Panel, controlClass } from './OrgBits';
import { errorMessage } from './organizacion.utils';

const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'Pendiente', tone: 'bg-amber-100 text-amber-900' }, APPROVED: { label: 'Aprobada', tone: 'bg-emerald-100 text-emerald-900' },
  REJECTED: { label: 'Rechazada', tone: 'bg-red-100 text-red-900' }, CANCELLED: { label: 'Cancelada', tone: 'bg-slate-200 text-slate-600' },
};
const num = (value: number) => new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(value);
const day = (iso: string) => new Date(iso).toLocaleDateString('es-NI', { dateStyle: 'medium', timeZone: 'UTC' });
const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** Mis vacaciones y permisos: el empleado ve su saldo y pide ausencias sin entrar a Recursos Humanos. */
export function MisVacacionesPanel() {
  const client = useQueryClient();
  const context = useTenantQuery(['hr', 'my-leave'], (signal) => employeeProfileService.getMyLeave(signal), { staleTime: 30_000, retry: false });
  const [leaveType, setLeaveType] = useState('VACATION');
  const [startDate, setStartDate] = useState(isoDay(4));
  const [endDate, setEndDate] = useState(isoDay(4));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  if (context.isLoading) return <Panel title="Mis vacaciones y permisos" icon={<CalendarCheck className="size-4" />}><Skeleton className="h-28 w-full" aria-busy="true" /></Panel>;
  // Quien no está vinculado a un empleado no ve el panel: no es un error para el resto de Mi día.
  if (context.isError || !context.data) return null;
  const { vacations, policy, requests } = context.data;

  const startsAt = new Date(`${startDate}T00:00:00`);
  const hours = Math.floor((startsAt.getTime() - Date.now()) / 3_600_000);
  const short = leaveType === 'VACATION' && hours < policy.minNoticeHours;
  const total = endDate >= startDate ? Math.round((new Date(`${endDate}T12:00:00Z`).getTime() - new Date(`${startDate}T12:00:00Z`).getTime()) / 86_400_000) + 1 : 0;

  const submit = async () => {
    setBusy(true);
    try {
      const created = await employeeProfileService.requestMyLeave({ leaveType, startDate, endDate, reason: reason.trim() || undefined });
      toast.success(created.isExtraordinary ? 'Solicitud enviada como extraordinaria' : 'Solicitud enviada');
      setReason('');
      void client.invalidateQueries({ queryKey: ['tenant-module'] });
    } catch (error) { toast.error(errorMessage(error, 'No se pudo enviar la solicitud')); } finally { setBusy(false); }
  };

  return (
    <Panel title="Mis vacaciones y permisos" icon={<CalendarCheck className="size-4" />}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Acumuladas</p><p className="text-xl font-bold tabular-nums">{num(vacations.accruedDays)} días</p><p className="text-[11px] text-muted-foreground">Ganas {num(vacations.perMonth)} días por mes</p></div>
        <div className="rounded-xl border border-border p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tomadas</p><p className="text-xl font-bold tabular-nums">{num(vacations.takenDays)} días</p>{vacations.pendingDays > 0 && <p className="text-[11px] text-muted-foreground">{num(vacations.pendingDays)} por aprobar o por tomar</p>}</div>
        <div className="rounded-xl border border-border p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Te quedan</p><p className={`text-xl font-bold tabular-nums ${vacations.balanceDays < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{num(vacations.balanceDays)} días</p></div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Field label="Tipo" htmlFor="leave-type"><NativeSelect id="leave-type" value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>{['VACATION', 'PERSONAL', 'SICK', 'BEREAVEMENT', 'UNPAID', 'OTHER'].map((value) => <option key={value} value={value}>{LEAVE_TYPE_LABEL[value]}</option>)}</NativeSelect></Field>
        <Field label="Desde" htmlFor="leave-start"><input id="leave-start" type="date" value={startDate} min={isoDay(0)} onChange={(e) => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} className={controlClass} /></Field>
        <Field label="Hasta" htmlFor="leave-end"><input id="leave-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={controlClass} /></Field>
        <Field label={short ? 'Motivo (obligatorio)' : 'Motivo (opcional)'} htmlFor="leave-reason"><input id="leave-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className={controlClass} /></Field>
      </div>
      <p className={`mt-2 text-[12px] ${short ? 'font-semibold text-amber-800' : 'text-muted-foreground'}`}>
        {short
          ? `Pides con ${Math.max(0, hours)} horas de aviso: es una solicitud extraordinaria (el mínimo es ${policy.minNoticeHours} h y el reglamento fija ${policy.policyNoticeHours} h). Tu jefe decide si la aprueba.`
          : `Las vacaciones se piden con al menos ${policy.minNoticeHours} horas de aviso (el reglamento interno fija ${policy.policyNoticeHours} h).`}
        {total > 0 && ` Son ${total} día(s).`}
      </p>
      <div className="mt-3 flex justify-end"><Button type="button" onClick={() => void submit()} disabled={busy || total <= 0 || (short && reason.trim().length < 10)}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Enviar solicitud</Button></div>

      {requests.length > 0 && (
        <ul className="mt-4 space-y-2">
          {requests.slice(0, 8).map((request: LeaveRequestRow) => (
            <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-[13px]">
              <span className="min-w-0"><strong>{LEAVE_TYPE_LABEL[request.leaveType] ?? request.leaveType}</strong> · {day(request.startDate)}{request.endDate !== request.startDate ? ` al ${day(request.endDate)}` : ''} · {request.days} día(s){request.isExtraordinary ? ' · extraordinaria' : ''}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[request.status]?.tone ?? ''}`}>{STATUS[request.status]?.label ?? request.status}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
