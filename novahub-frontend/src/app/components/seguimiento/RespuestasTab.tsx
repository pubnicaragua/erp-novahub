import { useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Send, Star } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { performanceService, type CheckinPromptRow } from '../../services/performance.service';
import { toast } from '../../services/toast';
import { EmptyState, ErrorState, Field, NativeSelect, controlClass } from '../organizacion/OrgBits';
import { RatingStars } from '../organizacion/TaskRating';
import { FEEDBACK_REQUIRED_AT_OR_BELOW, RATING_LABEL, errorMessage, formatMinutes } from '../organizacion/organizacion.utils';
import { CHECKIN_STATUS_LABEL, CHECKIN_STATUS_TONE } from './seguimiento.utils';
import type { PersonOption } from './TimelineTab';

const PAGE_SIZE = 20;
const STATUS_FILTERS: Array<[string, string]> = [['all', 'Todas'], ['UNRATED', 'Por calificar'], ['ANSWERED', 'Respondidas'], ['MISSED', 'Sin respuesta'], ['PENDING', 'Pendientes']];
const when = (iso: string) => new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

/** Respuestas de las personas a las preguntas por hora: el supervisor las revisa y califica su calidad. */
export function RespuestasTab({ people }: { people: PersonOption[] }) {
  const client = useQueryClient();
  const { user } = useAuth();
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState('UNRATED');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState<CheckinPromptRow | null>(null);
  const [asking, setAsking] = useState(false);

  const params = { userId: userId || undefined, status: status === 'all' ? undefined : status, from: from ? `${from}T00:00:00` : undefined, to: to ? `${to}T23:59:59` : undefined, page, pageSize: PAGE_SIZE };
  const query = useTenantQuery(['performance', 'checkins', JSON.stringify(params)], (signal) => performanceService.getCheckins(params, signal), { staleTime: 15_000, placeholderData: (previous) => previous });
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const reset = <T,>(set: (value: T) => void) => (value: T) => { set(value); setPage(1); };
  const refresh = () => void client.invalidateQueries({ queryKey: ['tenant-module'] });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Persona" className="min-w-44"><NativeSelect value={userId} onChange={(e) => reset(setUserId)(e.target.value)}><option value="">Todas</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></Field>
        <Field label="Estado" className="min-w-40"><NativeSelect value={status} onChange={(e) => reset(setStatus)(e.target.value)}>{STATUS_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></Field>
        <Field label="Desde"><input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className={cn(controlClass, 'w-40')} /></Field>
        <Field label="Hasta"><input type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} className={cn(controlClass, 'w-40')} /></Field>
        <Button type="button" className="ml-auto" onClick={() => setAsking(true)} disabled={!people.length}><Send className="size-4" />Preguntar ahora</Button>
      </div>

      {query.isLoading ? <div className="space-y-2" aria-busy="true">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
        : query.isError ? <ErrorState message={errorMessage(query.error, 'No se pudieron cargar las respuestas')} onRetry={() => void query.refetch()} />
        : !query.data?.items.length ? <EmptyState title="No hay respuestas con estos filtros" description="Cuando las personas respondan a las preguntas por hora aparecerán aquí para que las califiques." />
        : (
          <ul className="space-y-2">
            {query.data.items.map((item) => (
              <li key={item.id} className="min-w-0 rounded-xl border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="text-[13px] font-semibold">{item.userName}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', CHECKIN_STATUS_TONE[item.status === 'PENDING' && item.overdue ? 'MISSED' : item.status])}>
                    {CHECKIN_STATUS_LABEL[item.status === 'PENDING' && item.overdue ? 'MISSED' : item.status]}
                  </span>
                  <span className="text-muted-foreground">{when(item.scheduledFor)}{item.source === 'MANUAL' ? ' · pregunta manual' : ''}</span>
                  {item.answeredAt && new Date(item.answeredAt) > new Date(item.dueAt) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Respondió tarde</span>}
                </div>
                {item.workingOn && <p className="mt-1.5 break-words text-[13px]">{item.workingOn}</p>}
                {(item.remainingMinutes !== null || item.blockers) && (
                  <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                    {item.remainingMinutes !== null && `Faltaba: ${item.remainingMinutes === 0 ? 'ya terminó' : formatMinutes(item.remainingMinutes)}`}
                    {item.remainingMinutes !== null && item.blockers && ' · '}
                    {item.blockers && `Bloqueo: ${item.blockers}`}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {item.rating ? (<><RatingStars value={item.rating} /><span className="text-[11px] text-muted-foreground">{RATING_LABEL[item.rating]}{item.ratingComment ? ` · «${item.ratingComment}»` : ''}</span></>) : null}
                  {item.status === 'ANSWERED' && item.userId !== user?.id && (
                    <Button type="button" size="sm" variant={item.rating ? 'ghost' : 'outline'} onClick={() => setRating(item)}><Star className="size-3.5" />{item.rating ? 'Cambiar calificación' : 'Calificar'}</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

      <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
        <span>{total} registro{total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="outline" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button>
          <span aria-live="polite">Página {page} de {pages}</span>
          <Button type="button" size="icon" variant="outline" aria-label="Página siguiente" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      {rating && <RatingDialog item={rating} onClose={() => setRating(null)} onDone={() => { setRating(null); refresh(); }} />}
      {asking && <AskDialog people={people} onClose={() => setAsking(false)} onDone={() => { setAsking(false); refresh(); }} />}
    </div>
  );
}

function RatingDialog({ item, onClose, onDone }: { item: CheckinPromptRow; onClose: () => void; onDone: () => void }) {
  const [value, setValue] = useState(item.rating ?? 0);
  const [comment, setComment] = useState(item.ratingComment ?? '');
  const [busy, setBusy] = useState(false);
  const needsComment = value > 0 && value <= FEEDBACK_REQUIRED_AT_OR_BELOW;
  const save = async () => {
    setBusy(true);
    try {
      await performanceService.rateCheckin(item.id, { rating: value, comment: comment.trim() || undefined });
      toast.success('Calificación guardada');
      onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Calificar la respuesta de {item.userName}</DialogTitle>
          <DialogDescription>Evalúa qué tan clara, completa y útil fue la respuesta. De aquí sale su cumplimiento.</DialogDescription>
        </DialogHeader>
        <p className="break-words rounded-lg bg-muted/40 p-3 text-[13px]">{item.workingOn}</p>
        <div role="radiogroup" aria-label="Calificación" className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => setValue(n)}
              className={cn('flex min-w-16 flex-col items-center rounded-lg border px-3 py-2 text-[12px] font-semibold transition', value === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted/50')}>
              <span className="text-lg">{n}</span><span className="text-[10px] font-medium">{RATING_LABEL[n]}</span>
            </button>
          ))}
        </div>
        <Field label={needsComment ? 'Motivo (obligatorio)' : 'Comentario (opcional)'} htmlFor="rating-comment">
          <Textarea id="rating-comment" value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} rows={3} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="button" onClick={() => void save()} disabled={busy || value === 0 || (needsComment && !comment.trim())}>{busy && <Loader2 className="size-4 animate-spin" />}Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AskDialog({ people, onClose, onDone }: { people: PersonOption[]; onClose: () => void; onDone: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [minutes, setMinutes] = useState('10');
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const valid = selected.length > 0 && Number.isInteger(Number(minutes)) && Number(minutes) >= 0 && Number(minutes) <= 240;
  const unlimited = minutes === '0';
  const send = async () => {
    setBusy(true);
    try {
      const result = await performanceService.askNow({ userIds: selected, responseMinutes: Number(minutes) });
      toast.success(result.asked === 1 ? 'Pregunta enviada' : `${result.asked} preguntas enviadas`);
      onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Preguntar ahora</DialogTitle>
          <DialogDescription>Envía «¿En qué estás trabajando?» fuera del horario habitual. Tú decides si tienen un tiempo límite para responder o si la responden cuando puedan.</DialogDescription>
        </DialogHeader>
        <Field label="Tiempo para responder (minutos)" htmlFor="ask-minutes" hint={unlimited ? 'Sin límite: la responden cuando puedan durante el día; nunca cuenta como tardía.' : 'Si no responden en ese tiempo se avisa a su supervisor.'}>
          <div className="flex flex-wrap items-center gap-3">
            <input id="ask-minutes" type="number" min={1} max={240} value={unlimited ? '' : minutes} disabled={unlimited} onChange={(e) => setMinutes(e.target.value)} className={cn(controlClass, 'w-28')} />
            <label className="flex cursor-pointer items-center gap-2 text-[13px]"><input type="checkbox" checked={unlimited} onChange={(e) => setMinutes(e.target.checked ? '0' : '10')} />Sin límite de tiempo</label>
          </div>
        </Field>
        <fieldset className="min-w-0">
          <legend className="mb-1.5 flex w-full items-center justify-between text-[12px] font-semibold">
            <span>A quién</span>
            <button type="button" className="font-medium text-primary underline dark:text-accent" onClick={() => setSelected(selected.length === people.length ? [] : people.map((p) => p.id))}>{selected.length === people.length ? 'Quitar todos' : 'Elegir todos'}</button>
          </legend>
          <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {people.map((person) => (
              <li key={person.id}><label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[13px] hover:bg-muted/50"><input type="checkbox" checked={selected.includes(person.id)} onChange={() => toggle(person.id)} />{person.name}</label></li>
            ))}
          </ul>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="button" onClick={() => void send()} disabled={busy || !valid}>{busy && <Loader2 className="size-4 animate-spin" />}Enviar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
