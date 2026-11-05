import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, ListTodo, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { eventsService, remindersService, tasksService } from '../../services/actividades.service';
import { customersService } from '../../services/ventas.service';
import type { OrgUser } from '../../services/organizacion.service';
import { toast } from '../../services/toast';
import { Field, NativeSelect, controlClass } from './OrgBits';
import { errorMessage, serifStyle } from './organizacion.utils';
import { fromZonedInputs, toZonedInputs } from './organizacion.time';

export type ActivityKind = 'TASK' | 'EVENT' | 'REMINDER';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind?: ActivityKind;
  initialDate?: Date;
  timezone: string;
  users: OrgUser[];
  onCreated: () => void;
}

const REMINDER_OPTIONS = [
  { value: '0', label: 'Sin recordatorio' },
  { value: '5', label: '5 minutos antes' },
  { value: '15', label: '15 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
  { value: '1440', label: '1 día antes' },
];

export function NuevaActividadSheet(props: Props) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {props.open && <NuevaActividadForm {...props} />}
      </SheetContent>
    </Sheet>
  );
}

function NuevaActividadForm({ onOpenChange, initialKind, initialDate, timezone, users, onCreated }: Props) {
  const { user, canPerform } = useAuth();
  const can = {
    TASK: canPerform('ACTIVITIES_TASKS', 'create'),
    EVENT: canPerform('ACTIVITIES_EVENTS', 'create') || canPerform('ACTIVITIES_MEETINGS', 'create'),
    REMINDER: canPerform('ACTIVITIES_REMINDERS', 'create'),
  };
  const available = (['TASK', 'EVENT', 'REMINDER'] as ActivityKind[]).filter((k) => can[k]);
  const canMeeting = canPerform('ACTIVITIES_MEETINGS', 'create');
  const canEventOnly = canPerform('ACTIVITIES_EVENTS', 'create');
  const canInvite = canPerform('ACTIVITIES_EVENTS', 'sendInvitations') || canPerform('ACTIVITIES_MEETINGS', 'sendInvitations');
  const canGuests = canPerform('ACTIVITIES_EVENTS', 'manageGuests') || canPerform('ACTIVITIES_MEETINGS', 'manageGuests');
  const canListCustomers = canPerform('SALES_CLIENTS', 'view');

  const base = initialDate ?? new Date();
  const inputs = toZonedInputs(base, timezone);
  const startInit = initialDate && inputs.time !== '00:00' ? inputs.time : '09:00';
  const startInstant = fromZonedInputs(inputs.date, startInit, timezone);
  const endInit = startInstant ? toZonedInputs(new Date(startInstant.getTime() + 60 * 60 * 1000), timezone).time : '10:00';
  const firstKind: ActivityKind = initialKind && available.includes(initialKind) ? initialKind : (available.includes('EVENT') ? 'EVENT' : (available[0] ?? 'EVENT'));

  const [kind, setKind] = useState<ActivityKind>(firstKind);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(inputs.date);
  const [startTime, setStartTime] = useState(startInit);
  const [endTime, setEndTime] = useState(endInit);
  const [location, setLocation] = useState('');
  const [isMeeting, setIsMeeting] = useState(false);
  const [priority, setPriority] = useState('MEDIUM');
  const [estimate, setEstimate] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState('15');
  const [notify, setNotify] = useState(true);
  const [customerId, setCustomerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: customers } = useQuery({
    queryKey: ['organizacion', 'customers-lookup', user?.clientTenantId],
    queryFn: ({ signal }) => customersService.getLookup({ pageSize: 100 }, signal),
    enabled: kind === 'TASK' && canListCustomers,
    staleTime: 5 * 60_000,
  });
  const customerList = customers?.data ?? [];

  const others = useMemo(() => users.filter((u) => u.id !== user?.id), [users, user?.id]);
  const filteredUsers = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    return q ? others.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q)) : others;
  }, [others, participantSearch]);

  const toggleParticipant = (id: string) => setParticipants((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const submit = async () => {
    setError('');
    if (!title.trim()) return setError('El título es obligatorio.');
    if (!date) return setError('La fecha es obligatoria.');
    const start = fromZonedInputs(date, startTime || '09:00', timezone);
    const end = fromZonedInputs(date, endTime || startTime || '10:00', timezone);
    if (!start || !end) return setError('La fecha u hora no es válida.');
    if (kind === 'EVENT' && end <= start) return setError('La hora de fin debe ser posterior a la de inicio.');
    if (!user?.id) return setError('No se pudo identificar tu sesión.');

    setSaving(true);
    try {
      if (kind === 'TASK') {
        const customer = customerList.find((c) => c.id === customerId);
        await tasksService.create({
          title: title.trim(), description: description.trim() || undefined, dueDate: start.toISOString(), priority,
          assignedTo: [user.id],
          ...(estimate.trim() ? { estimatedMinutes: Number(estimate) } : {}),
          ...(customer ? { customFields: { cliente: customer.companyName || customer.name, clienteId: customer.id } } : {}),
        } as never);
        toast.success('Tarea creada. También aparece en Actividades.');
      } else if (kind === 'REMINDER') {
        await remindersService.create({
          title: title.trim(), description: description.trim() || undefined, reminderDate: start.toISOString(),
          scope: 'PERSONAL', targetId: JSON.stringify([user.id]),
        } as never);
        toast.success('Recordatorio creado. También aparece en Actividades.');
      } else {
        const guestPayload = participants.map((id) => ({ guestType: 'INTERNAL', internalUserId: id }));
        const created = await eventsService.create({
          title: title.trim(), description: description.trim() || undefined, location: location.trim() || undefined,
          startDate: start.toISOString(), endDate: end.toISOString(), type: isMeeting ? 'MEETING' : 'EVENT',
          ...(guestPayload.length ? { guests: guestPayload } : {}),
        } as never);
        const minutes = Number(reminderMinutes);
        if (minutes > 0 && created?.id && can.REMINDER) {
          try {
            await remindersService.create({
              title: `Recordatorio: ${title.trim()}`, reminderDate: new Date(start.getTime() - minutes * 60_000).toISOString(),
              scope: 'PERSONAL', targetId: JSON.stringify([user.id]), activityId: created.id,
            } as never);
          } catch (e) {
            toast.warning(`El evento se creó, pero no se pudo programar el recordatorio: ${errorMessage(e)}`);
          }
        }
        if (notify && guestPayload.length && created?.id && canInvite) {
          try {
            await eventsService.sendInvitations(created.id);
          } catch (e) {
            toast.warning(`El evento se creó, pero no se pudieron enviar las invitaciones: ${errorMessage(e)}`);
          }
        }
        toast.success('Evento creado. También aparece en Actividades.');
      }
      onCreated();
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, 'No se pudo crear la actividad. Tus datos se conservaron, intenta de nuevo.'));
    } finally {
      setSaving(false);
    }
  };

  const kinds: Array<{ id: ActivityKind; label: string; icon: typeof ListTodo }> = [
    { id: 'TASK', label: 'Tarea', icon: ListTodo },
    { id: 'EVENT', label: 'Evento', icon: CalendarDays },
    { id: 'REMINDER', label: 'Recordatorio', icon: Bell },
  ];

  return (
    <>
        <SheetHeader className="space-y-1 border-b border-border px-6 pb-4 pt-6 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-foreground/70"><span className="text-primary">Organización personal</span></p>
          <SheetTitle className="text-3xl text-primary dark:text-foreground" style={serifStyle}>Nueva actividad</SheetTitle>
          <SheetDescription>Crea tareas, eventos o recordatorios desde un solo lugar. Las horas se interpretan en {timezone}.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {available.length === 0 ? (
            <p role="alert" className="rounded-xl border border-border bg-muted/40 p-4 text-[13px] text-muted-foreground">
              Tu rol no tiene permiso para crear tareas, eventos ni recordatorios en Actividades. Solicita acceso a tu administrador.
            </p>
          ) : (
            <>
              <fieldset>
                <legend className="mb-2 text-[13px] font-semibold text-foreground">Tipo de actividad</legend>
                <div role="radiogroup" className="grid grid-cols-3 gap-2">
                  {kinds.map(({ id, label, icon: Icon }) => {
                    const enabled = can[id];
                    const selected = kind === id;
                    return (
                      <button
                        key={id} type="button" role="radio" aria-checked={selected} disabled={!enabled}
                        title={enabled ? undefined : 'Sin permiso para crear este tipo'}
                        onClick={() => setKind(id)}
                        className={cn(
                          'flex min-w-0 items-center justify-center gap-2 rounded-xl border px-2 py-3 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
                          selected ? 'border-accent bg-accent/15 text-primary dark:text-accent' : 'border-border bg-card text-foreground hover:bg-muted/50',
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <Field label="Título" htmlFor="org-title" required>
                <Input id="org-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160}
                  placeholder={kind === 'TASK' ? 'Ej. Enviar propuesta comercial' : kind === 'EVENT' ? 'Ej. Reunión de seguimiento comercial' : 'Ej. Llamar al cliente'} />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Fecha" htmlFor="org-date" required>
                  <input id="org-date" type="date" className={controlClass} value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label={kind === 'EVENT' ? 'Hora' : 'Hora límite'} htmlFor="org-start">
                  <div className="flex items-center gap-2">
                    <input id="org-start" type="time" className={controlClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Hora de inicio" />
                    {kind === 'EVENT' && (
                      <>
                        <span aria-hidden="true">–</span>
                        <input type="time" className={controlClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="Hora de fin" />
                      </>
                    )}
                  </div>
                </Field>
              </div>

              {kind === 'EVENT' && (
                <>
                  <Field label="Ubicación / enlace" htmlFor="org-location">
                    <Input id="org-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Sala de reuniones · Presencial, o enlace de videollamada" />
                  </Field>
                  {canMeeting && canEventOnly && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                      <label htmlFor="org-meeting" className="text-[13px] text-foreground">Registrar como reunión</label>
                      <Switch id="org-meeting" checked={isMeeting} onCheckedChange={setIsMeeting} />
                    </div>
                  )}
                  <section aria-labelledby="org-participants">
                    <h3 id="org-participants" className="mb-2 text-[15px] font-semibold text-foreground" style={serifStyle}>Participantes</h3>
                    {!canGuests ? (
                      <p className="rounded-lg bg-muted/40 p-3 text-[12px] text-muted-foreground">Tu rol no puede agregar invitados a eventos.</p>
                    ) : others.length === 0 ? (
                      <p className="rounded-lg bg-muted/40 p-3 text-[12px] text-muted-foreground">No hay otros usuarios activos en tu empresa.</p>
                    ) : (
                      <div className="space-y-2">
                        <Input value={participantSearch} onChange={(e) => setParticipantSearch(e.target.value)} placeholder="Buscar usuario…" aria-label="Buscar participante" />
                        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-1.5">
                          {filteredUsers.map((u) => (
                            <li key={u.id}>
                              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-muted/50">
                                <input type="checkbox" className="size-4 accent-[#01422C]" checked={participants.includes(u.id)} onChange={() => toggleParticipant(u.id)} />
                                <span className="min-w-0 flex-1 truncate">{u.name}<span className="ml-2 text-[11px] text-muted-foreground">{u.email}</span></span>
                              </label>
                            </li>
                          ))}
                          {filteredUsers.length === 0 && <li className="px-2 py-2 text-[12px] text-muted-foreground">Sin resultados.</li>}
                        </ul>
                        {participants.length > 0 && <p className="text-[11px] text-muted-foreground">{participants.length} participante(s) seleccionado(s).</p>}
                      </div>
                    )}
                  </section>
                  {can.REMINDER && (
                    <Field label="Recordatorio" htmlFor="org-reminder">
                      <NativeSelect id="org-reminder" value={reminderMinutes} onChange={(e) => setReminderMinutes(e.target.value)}>
                        {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </NativeSelect>
                    </Field>
                  )}
                  {canInvite && participants.length > 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                      <label htmlFor="org-notify" className="text-[13px] text-foreground">Notificar a participantes</label>
                      <Switch id="org-notify" checked={notify} onCheckedChange={setNotify} />
                    </div>
                  )}
                </>
              )}

              {kind === 'TASK' && (
                <>
                  <Field label="Prioridad" htmlFor="org-priority">
                    <NativeSelect id="org-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                      <option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Tiempo estimado (minutos, opcional)" htmlFor="org-estimate" hint="Se compara con el tiempo realmente registrado para medir qué tareas tardan más de lo previsto.">
                    <input id="org-estimate" type="number" min={1} max={100000} step={1} inputMode="numeric" className={controlClass} value={estimate} onChange={(e) => setEstimate(e.target.value)} />
                  </Field>
                  {canListCustomers && (
                    <Field label="Cliente (opcional)" htmlFor="org-customer" hint="Asocia la tarea a un cliente existente.">
                      <NativeSelect id="org-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                        <option value="">Sin cliente</option>
                        {customerList.map((c) => <option key={c.id} value={c.id}>{c.companyName || c.name}</option>)}
                      </NativeSelect>
                    </Field>
                  )}
                </>
              )}

              {kind !== 'REMINDER' && (
                <Field label="Descripción" htmlFor="org-description">
                  <Textarea id="org-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
                </Field>
              )}
              {kind === 'REMINDER' && (
                <Field label="Nota" htmlFor="org-description">
                  <Textarea id="org-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
                </Field>
              )}

              <p className="rounded-xl bg-accent/10 p-3 text-[12px] text-foreground">
                <strong className="block text-[13px]">Se creará en Actividades y aparecerá también en Mi agenda.</strong>
                {kind === 'EVENT'
                  ? 'Las invitaciones se envían solo a los participantes seleccionados de tu empresa.'
                  : 'Será visible para ti y para quienes tengan acceso a Actividades según sus permisos.'}
              </p>
              {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[12px] text-destructive">{error}</p>}
            </>
          )}
        </div>

        <SheetFooter className="grid grid-cols-2 gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={submit} disabled={saving || available.length === 0}>
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {kind === 'TASK' ? 'Crear tarea' : kind === 'REMINDER' ? 'Crear recordatorio' : isMeeting ? 'Crear reunión' : 'Crear evento'}
          </Button>
        </SheetFooter>
    </>
  );
}
