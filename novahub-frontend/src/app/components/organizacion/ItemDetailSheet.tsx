import { useState } from 'react';
import { CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { eventsService, remindersService, tasksService } from '../../services/actividades.service';
import { toast } from '../../services/toast';
import type { AgendaEvent, AgendaReminder, AgendaTask } from '../../services/organizacion.service';
import { Field, controlClass } from './OrgBits';
import { KIND_LABEL, MAX_FEEDBACK_LENGTH, errorMessage, serifStyle, type CalendarItem } from './organizacion.utils';
import { fromZonedInputs, toZonedInputs } from './organizacion.time';
import { TaskRatingPanel } from './TaskRating';

interface Props {
  item: CalendarItem | null;
  /** La agenda de otra persona es de solo lectura. */
  readOnly: boolean;
  timezone: string;
  timezoneLabel: string;
  onClose: () => void;
  onChanged: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', WAITING_APPROVAL: 'En aprobación', COMPLETED: 'Completado',
  CANCELLED: 'Cancelado', SENT: 'Enviado', APPROVED: 'Aprobado',
};

export function ItemDetailSheet(props: Props) {
  const { item, onClose } = props;
  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {item && <ItemDetailForm key={item.key} {...props} item={item} />}
      </SheetContent>
    </Sheet>
  );
}

function ItemDetailForm({ item, readOnly, timezone, timezoneLabel, onClose, onChanged }: Props & { item: CalendarItem }) {
  const initial = toZonedInputs(item.start, timezone);
  const { canPerform } = useAuth();
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(String((item.raw as AgendaEvent | AgendaTask).description || ''));
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.time);
  const [endTime, setEndTime] = useState(toZonedInputs(item.end, timezone).time);
  const [busy, setBusy] = useState<'save' | 'complete' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');

  const module = item.kind === 'TASK' ? 'ACTIVITIES_TASKS'
    : item.kind === 'REMINDER' ? 'ACTIVITIES_REMINDERS'
      : item.kind === 'MEETING' ? 'ACTIVITIES_MEETINGS' : 'ACTIVITIES_EVENTS';
  const isBusyBlock = Boolean(item.busy);
  const canEdit = !readOnly && !isBusyBlock && canPerform(module, 'edit');
  const canDelete = !readOnly && !isBusyBlock && canPerform(module, 'delete');
  const canComplete = !readOnly && !isBusyBlock && !item.completed && item.kind !== 'REMINDER'
    && (item.kind === 'TASK' ? canPerform('ACTIVITIES_TASKS', 'complete') : canPerform(module, 'complete'));

  const run = async (kind: 'save' | 'complete' | 'delete', fn: () => Promise<unknown>, success: string) => {
    setBusy(kind); setError('');
    try {
      await fn();
      toast.success(success);
      onChanged();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const save = () => {
    if (!title.trim()) return setError('El título es obligatorio.');
    const start = fromZonedInputs(date, startTime || '09:00', timezone);
    const end = fromZonedInputs(date, endTime || startTime || '10:00', timezone);
    if (!start || !end) return setError('La fecha u hora no es válida.');
    if ((item.kind === 'EVENT' || item.kind === 'MEETING') && end <= start) return setError('La hora de fin debe ser posterior a la de inicio.');
    if (item.kind === 'TASK') {
      return run('save', () => tasksService.update(item.id, { title: title.trim(), description: description.trim(), dueDate: start.toISOString() } as never), 'Tarea actualizada');
    }
    if (item.kind === 'REMINDER') {
      return run('save', () => remindersService.update(item.id, { title: title.trim(), reminderDate: start.toISOString() } as never), 'Recordatorio actualizado');
    }
    return run('save', () => eventsService.update(item.id, { title: title.trim(), description: description.trim(), startDate: start.toISOString(), endDate: end.toISOString() } as never), 'Evento actualizado');
  };

  const complete = () => run('complete', () => (item.kind === 'TASK'
    ? tasksService.complete(item.id, deliveryNote.trim() ? { notes: deliveryNote.trim() } : undefined)
    : eventsService.update(item.id, { status: 'COMPLETED' } as never)), 'Marcado como completado');

  const remove = () => run('delete', () => (item.kind === 'TASK'
    ? tasksService.delete(item.id)
    : item.kind === 'REMINDER' ? remindersService.delete(item.id) : eventsService.delete(item.id)), 'Eliminado');

  const raw = item.raw as AgendaEvent;
  const customFields = (item.raw as AgendaTask).customFields;

  return (
    <>
          <SheetHeader className="space-y-1 border-b border-border px-6 pb-4 pt-6 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{KIND_LABEL[item.kind]}</Badge>
              <Badge variant="secondary">{STATUS_LABEL[item.status] || item.status}</Badge>
              {readOnly && <Badge variant="outline">Solo lectura</Badge>}
            </div>
            <SheetTitle className="text-2xl text-primary dark:text-foreground" style={serifStyle}>{isBusyBlock ? 'Ocupado' : item.title}</SheetTitle>
            <SheetDescription>Hora mostrada en {timezoneLabel}. Este registro es el mismo que ves en Actividades.</SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {isBusyBlock ? (
              <p className="rounded-xl bg-muted/40 p-3 text-[13px] text-muted-foreground">
                Esta persona compartió solo su disponibilidad. No se muestran detalles.
              </p>
            ) : (
              <>
                <Field label="Título" htmlFor="det-title"><Input id="det-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} /></Field>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Fecha" htmlFor="det-date"><input id="det-date" type="date" className={controlClass} value={date} onChange={(e) => setDate(e.target.value)} disabled={!canEdit} /></Field>
                  <Field label="Hora" htmlFor="det-start">
                    <div className="flex items-center gap-2">
                      <input id="det-start" type="time" className={controlClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={!canEdit} aria-label="Hora de inicio" />
                      {(item.kind === 'EVENT' || item.kind === 'MEETING') && (
                        <>
                          <span aria-hidden="true">–</span>
                          <input type="time" className={controlClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={!canEdit} aria-label="Hora de fin" />
                        </>
                      )}
                    </div>
                  </Field>
                </div>
                {item.kind !== 'REMINDER' && (
                  <Field label="Descripción" htmlFor="det-desc"><Textarea id="det-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} /></Field>
                )}
                {(item.kind === 'EVENT' || item.kind === 'MEETING') && (
                  <dl className="grid grid-cols-2 gap-3 text-[12px]">
                    {raw.location && <div><dt className="text-muted-foreground">Ubicación</dt><dd className="font-semibold">{raw.location}</dd></div>}
                    {typeof raw.guestCount === 'number' && <div><dt className="text-muted-foreground">Invitados</dt><dd className="font-semibold">{raw.guestCount}</dd></div>}
                    {raw.meetingUrl && (
                      <div className="col-span-2"><dt className="text-muted-foreground">Enlace</dt>
                        <dd><a className="break-all font-semibold text-primary underline dark:text-accent" href={raw.meetingUrl} target="_blank" rel="noreferrer">{raw.meetingUrl}</a></dd></div>
                    )}
                  </dl>
                )}
                {customFields?.cliente && (
                  <p className="text-[12px]"><span className="text-muted-foreground">Cliente: </span><strong>{customFields.cliente}</strong></p>
                )}
                {item.kind === 'REMINDER' && (item.raw as AgendaReminder).description && (
                  <p className="text-[12px] text-muted-foreground">{(item.raw as AgendaReminder).description}</p>
                )}
                {item.kind === 'TASK' && canComplete && (
                  <Field label="Nota de entrega" htmlFor="det-delivery-note" hint="Opcional. Qué hiciste y qué quedó pendiente; la verá quien revise la tarea.">
                    <Textarea id="det-delivery-note" rows={2} maxLength={MAX_FEEDBACK_LENGTH} value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} />
                  </Field>
                )}
                {item.kind === 'TASK' && item.completed && (item.raw as AgendaTask).deliveryNote && (
                  <p className="rounded-xl bg-muted/40 p-3 text-[12px]"><span className="font-semibold">Nota de entrega: </span>{(item.raw as AgendaTask).deliveryNote}</p>
                )}
                {item.kind === 'TASK' && (
                  <TaskRatingPanel key={`${item.key}:${(item.raw as AgendaTask).ratedAt ?? ''}`} task={item.raw as AgendaTask} canRate={false} />
                )}
              </>
            )}
            {!canEdit && !isBusyBlock && !readOnly && (
              <p className="text-[11px] text-muted-foreground">Tu rol no puede editar este tipo de actividad.</p>
            )}
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[12px] text-destructive">{error}</p>}
          </div>

          {!isBusyBlock && (
            <SheetFooter className="flex flex-row flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-4">
              <div className="flex gap-2">
                {canDelete && (
                  <Button type="button" variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)} disabled={busy !== null}>
                    <Trash2 className="size-4" aria-hidden="true" />Eliminar
                  </Button>
                )}
                {canComplete && (
                  <Button type="button" variant="outline" onClick={complete} disabled={busy !== null}>
                    {busy === 'complete' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}Completar
                  </Button>
                )}
              </div>
              {canEdit && (
                <Button type="button" onClick={save} disabled={busy !== null}>
                  {busy === 'save' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Guardar cambios
                </Button>
              )}
            </SheetFooter>
          )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eliminar actividad"
        description="Esta acción elimina el registro también en Actividades y no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => { setConfirmDelete(false); void remove(); }}
      />
    </>
  );
}
