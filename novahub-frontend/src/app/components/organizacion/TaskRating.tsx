import { useRef, useState, type KeyboardEvent } from 'react';
import { CheckCircle2, Clock3, Loader2, Star } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { tasksService } from '../../services/actividades.service';
import { toast } from '../../services/toast';
import {
  FEEDBACK_REQUIRED_AT_OR_BELOW, MAX_FEEDBACK_LENGTH, RATING_LABEL, errorMessage, formatMinutes, taskPunctuality,
} from './organizacion.utils';

/** Lo mínimo que se necesita de una tarea para mostrar su cumplimiento y calificación. */
export interface RatableTask {
  id: string;
  status?: string;
  dueDate?: string | null;
  /** Con ella se reconoce una tarea sin plazo real (su fecha límite es la de creación). */
  createdAt?: string | null;
  completedAt?: string | null;
  rating?: number | null;
  ratingComment?: string | null;
  ratedAt?: string | null;
  ratedBy?: { id: string; name: string } | null;
}

const when = (iso?: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

/** Estrellas de solo lectura. El texto alternativo dice la calificación completa. */
export function RatingStars({ value, className }: { value: number; className?: string }) {
  return (
    <span role="img" aria-label={`Calificación ${value} de 5`} className={cn('inline-flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden="true" className={cn('size-4', n <= value ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/40')} />
      ))}
    </span>
  );
}

/** «A tiempo», «Tardía por 2 h», «Sin plazo definido» o «Sin medir» (tareas anteriores al registro de cierre). */
export function PunctualityBadge({ task }: { task: Pick<RatableTask, 'status' | 'dueDate' | 'createdAt' | 'completedAt'> }) {
  const { kind, lateMinutes } = taskPunctuality(task);
  if (kind === 'NO_DEADLINE') return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Sin plazo definido</span>;
  if (kind === 'UNKNOWN') return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Cumplimiento sin medir</span>;
  return kind === 'ON_TIME'
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900"><CheckCircle2 className="size-3" aria-hidden="true" />A tiempo</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-900"><Clock3 className="size-3" aria-hidden="true" />Tardía por {formatMinutes(lateMinutes)}</span>;
}

/** Selector de 1 a 5 estrellas con teclado: flechas cambian el valor, Inicio/Fin van a los extremos. */
function StarPicker({ value, onChange, disabled }: { value: number; onChange: (next: number) => void; disabled?: boolean }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (next: number) => {
    const bounded = Math.min(5, Math.max(1, next));
    onChange(bounded);
    refs.current[bounded - 1]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, n: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); move(n + 1); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); move(n - 1); }
    else if (event.key === 'Home') { event.preventDefault(); move(1); }
    else if (event.key === 'End') { event.preventDefault(); move(5); }
  };
  return (
    <div role="radiogroup" aria-label="Calificación de 1 a 5 estrellas" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          ref={(el) => { refs.current[n - 1] = el; }}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}: ${RATING_LABEL[n]}`}
          tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(n)}
          onKeyDown={(event) => onKeyDown(event, n)}
          className="rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
        >
          <Star aria-hidden="true" className={cn('size-7 transition', n <= value ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground/40 hover:text-amber-400')} />
        </button>
      ))}
      <span className="ml-2 min-w-24 text-[12px] font-semibold text-muted-foreground" aria-live="polite">{value ? RATING_LABEL[value] : 'Elige una calificación'}</span>
    </div>
  );
}

/**
 * Cumplimiento y calificación de una tarea completada: cuándo se cerró frente a su hora límite, la calificación con
 * su retroalimentación y, para quien puede calificar, el formulario. Quien hizo la tarea solo ve el resultado.
 */
export function TaskRatingPanel({ task, canRate, onSaved }: { task: RatableTask; canRate: boolean; onSaved?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(task.rating ?? 0);
  const [comment, setComment] = useState(task.ratingComment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (task.status !== 'COMPLETED') return null;

  const rated = typeof task.rating === 'number' && task.rating >= 1;
  const showForm = canRate && (editing || !rated);

  const save = async () => {
    const text = comment.trim();
    if (!rating) return setError('Elige una calificación de 1 a 5.');
    if (rating <= FEEDBACK_REQUIRED_AT_OR_BELOW && !text) return setError(`Con una calificación de ${FEEDBACK_REQUIRED_AT_OR_BELOW} o menos explica qué se debe mejorar.`);
    setError(''); setBusy(true);
    try {
      await tasksService.rate(task.id, { rating, comment: text || undefined });
      toast.success('Calificación guardada');
      setEditing(false);
      onSaved?.();
    } catch (e) {
      setError(errorMessage(e, 'No se pudo guardar la calificación'));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/[0.14] p-4" data-testid="task-rating-panel">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <PunctualityBadge task={task} />
        <span className="text-muted-foreground">
          {task.completedAt ? `Completada el ${when(task.completedAt)}` : 'Fecha de cierre no registrada (tarea anterior a este control)'}
        </span>
      </div>

      {rated && !showForm && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <RatingStars value={task.rating!} />
            <span className="text-[13px] font-bold">{task.rating}/5 · {RATING_LABEL[task.rating!]}</span>
          </div>
          {task.ratingComment && <p className="whitespace-pre-wrap break-words rounded-xl bg-background/70 p-3 text-[13px] leading-5">{task.ratingComment}</p>}
          <p className="text-[11px] text-muted-foreground">
            {task.ratedBy?.name ? `Calificada por ${task.ratedBy.name}` : 'Calificada'}{task.ratedAt ? ` el ${when(task.ratedAt)}` : ''}
          </p>
        </div>
      )}
      {!rated && !canRate && <p className="text-[12px] text-muted-foreground">Aún sin calificar.</p>}

      {canRate && rated && !editing && (
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>Cambiar calificación</Button>
      )}

      {showForm && (
        <div className="space-y-3">
          <p className="text-[12px] font-semibold">{rated ? 'Cambiar calificación' : 'Calificar esta tarea'}</p>
          <StarPicker value={rating} onChange={(n) => { setRating(n); setError(''); }} disabled={busy} />
          <div className="space-y-1.5">
            <label htmlFor={`rating-comment-${task.id}`} className="block text-[12px] font-semibold">
              Retroalimentación{rating > 0 && rating <= FEEDBACK_REQUIRED_AT_OR_BELOW ? <span aria-hidden="true"> *</span> : <span className="font-normal text-muted-foreground"> (opcional)</span>}
            </label>
            <Textarea
              id={`rating-comment-${task.id}`}
              value={comment}
              onChange={(e) => { setComment(e.target.value); setError(''); }}
              maxLength={MAX_FEEDBACK_LENGTH}
              rows={3}
              disabled={busy}
              placeholder="Qué salió bien y qué se puede mejorar. Quien hizo la tarea lo verá."
              aria-invalid={Boolean(error) && rating > 0 && rating <= FEEDBACK_REQUIRED_AT_OR_BELOW && !comment.trim()}
            />
            <p className="text-right text-[11px] text-muted-foreground">{comment.length}/{MAX_FEEDBACK_LENGTH}</p>
          </div>
          {error && <p role="alert" className="text-[12px] font-semibold text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Guardar calificación
            </Button>
            {editing && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setEditing(false); setRating(task.rating ?? 0); setComment(task.ratingComment ?? ''); setError(''); }}>Cancelar</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
