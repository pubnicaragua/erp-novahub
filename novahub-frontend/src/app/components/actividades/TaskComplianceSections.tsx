import { useState, type ReactNode } from 'react';
import { Check, Loader2, PauseCircle, X } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';
import { tasksService } from '../../services/actividades.service';
import type { ActivityPause, ActivityRebound, Task } from '../../types';
import {
  PAUSE_APPROVAL_LABEL, REBOUND_CATEGORY_LABEL, REBOUND_CATEGORY_OPTIONS, openPauseOf, pauseSummary,
} from './taskCompliance';
import { shortDateTime } from './taskTrace';

const errorText = (error: unknown, fallback: string) => {
  const e = error as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
};

function PauseDecision({ taskId, pause, onChanged }: { taskId: string; pause: ActivityPause; onChanged: () => void }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState<'yes' | 'no' | null>(null);
  const decide = async (approve: boolean) => {
    try {
      setSaving(approve ? 'yes' : 'no');
      await tasksService.reviewPause(taskId, pause.id, { approve, note: note.trim() || undefined });
      toast.success(approve ? 'Pausa aprobada: el plazo se detiene' : 'El plazo sigue corriendo');
      onChanged();
    } catch (error) {
      toast.error(errorText(error, 'No se pudo guardar la decisión'));
    } finally {
      setSaving(null);
    }
  };
  return (
    <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
      <p className="text-xs font-bold text-foreground">¿Detener el plazo mientras dure esta pausa?</p>
      <Input value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Comentario (opcional)" className="h-9 rounded-xl text-xs" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="h-8 rounded-xl text-xs font-bold" disabled={saving !== null} onClick={() => void decide(true)} data-testid="activities-pause-approve">
          {saving === 'yes' ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Check className="mr-1.5 size-3.5" />}Sí, detener el plazo
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl text-xs font-bold" disabled={saving !== null} onClick={() => void decide(false)} data-testid="activities-pause-decline">
          {saving === 'no' ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <X className="mr-1.5 size-3.5" />}No, sigue corriendo
        </Button>
      </div>
    </div>
  );
}

/** Aviso arriba del detalle cuando la tarea está detenida: por qué, desde cuándo y si el plazo corre. */
export function PauseBanner({ task, canReview, onChanged }: { task: Task; canReview: boolean; onChanged: () => void }) {
  const pause = openPauseOf(task) as ActivityPause | null;
  if (!pause) return null;
  return (
    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/[0.07] p-4" data-testid="activities-pause-banner">
      <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-300">
        <PauseCircle className="size-4" aria-hidden="true" /> En pausa desde {shortDateTime(pause.pausedAt)}
      </p>
      <p className="mt-1.5 break-words text-sm font-semibold text-foreground">{pauseSummary(pause)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {pause.pausedBy?.name ? `La pausó ${pause.pausedBy.name}. ` : ''}{PAUSE_APPROVAL_LABEL[pause.approval]}.
        {pause.reviewedBy?.name ? ` Decidió ${pause.reviewedBy.name}${pause.reviewNote ? `: «${pause.reviewNote}»` : ''}.` : ''}
      </p>
      {pause.approval === 'PENDING' && canReview && <PauseDecision taskId={String(task.id)} pause={pause} onChanged={onChanged} />}
    </div>
  );
}

const formatDays = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round((minutes / 1440) * 10) / 10} días`;
};

/** Pausas anteriores (la vigente se muestra arriba). Las pendientes de decisión se pueden resolver aquí. */
export function PauseHistory({ task, canReview, onChanged, wrap }: { task: Task; canReview: boolean; onChanged: () => void; wrap: (children: ReactNode) => ReactNode }) {
  const past = (task.pauses ?? []).filter((pause) => pause.resumedAt);
  if (!past.length) return null;
  return <>{wrap(
    <ol className="space-y-2.5" data-testid="activities-pause-history">
      {past.map((pause) => (
        <li key={pause.id} className="rounded-xl border border-border/40 bg-muted/[0.14] p-3">
          <p className="break-words text-sm font-semibold text-foreground">{pauseSummary(pause)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {shortDateTime(pause.pausedAt)} → {shortDateTime(pause.resumedAt)}
            {pause.pausedBy?.name ? ` · pausó ${pause.pausedBy.name}` : ''}{pause.resumedBy?.name ? ` · reanudó ${pause.resumedBy.name}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pause.approval === 'APPROVED'
              ? pause.dueDateAfter && pause.extendedMinutes != null
                ? `Aprobada: el plazo se corrió ${formatDays(pause.extendedMinutes)}, de ${shortDateTime(pause.dueDateBefore)} a ${shortDateTime(pause.dueDateAfter)}.`
                : 'Aprobada (la tarea no tenía un plazo que mover).'
              : pause.approval === 'REJECTED' ? 'No se aprobó detener el plazo.' : 'Sin decidir: el plazo no se movió.'}
          </p>
          {pause.approval === 'PENDING' && canReview && <PauseDecision taskId={String(task.id)} pause={pause} onChanged={onChanged} />}
        </li>
      ))}
    </ol>,
  )}</>;
}

function ReboundRow({ taskId, rebound, canReview, onChanged }: { taskId: string; rebound: ActivityRebound; canReview: boolean; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const classify = async (category: string) => {
    try {
      setSaving(true);
      await tasksService.classifyRebound(taskId, rebound.id, category);
      toast.success(category === 'ERROR' ? 'Marcado como error: cuenta en el cumplimiento' : 'Actualizado: no afecta el cumplimiento');
      onChanged();
    } catch (error) {
      toast.error(errorText(error, 'No se pudo cambiar el motivo'));
    } finally {
      setSaving(false);
    }
  };
  const counts = rebound.category === 'ERROR';
  return (
    <li className="rounded-xl border border-border/40 bg-muted/[0.14] p-3">
      <p className="break-words text-sm font-semibold text-foreground">{rebound.reason}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {shortDateTime(rebound.rejectedAt)}{rebound.rejectedBy?.name ? ` · la devolvió ${rebound.rejectedBy.name}` : ''}
        {rebound.source === 'HISTORY' ? ' · registro anterior' : ''}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', counts ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground')}>
          {counts ? 'Cuenta en el cumplimiento' : 'No cuenta'}
        </span>
        {canReview ? (
          <Select value={rebound.category === 'UNCLASSIFIED' ? '' : rebound.category} onValueChange={(value) => void classify(value)} disabled={saving}>
            <SelectTrigger className="h-8 w-auto min-w-[15rem] rounded-lg text-xs" aria-label="Motivo del rebote" data-testid="activities-rebound-category">
              <SelectValue placeholder="Sin clasificar: elige el motivo" />
            </SelectTrigger>
            <SelectContent>{REBOUND_CATEGORY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">{REBOUND_CATEGORY_LABEL[rebound.category]}</span>
        )}
        {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
      </div>
    </li>
  );
}

/** Cada vez que la tarea se devolvió. Quien aprueba puede cambiar el motivo; solo «error» baja el cumplimiento. */
export function ReboundHistory({ task, canReview, onChanged, wrap }: { task: Task; canReview: boolean; onChanged: () => void; wrap: (children: ReactNode) => ReactNode }) {
  const rebounds = task.rebounds ?? [];
  if (!rebounds.length) return null;
  const errors = rebounds.filter((rebound) => rebound.category === 'ERROR').length;
  return <>{wrap(
    <div className="space-y-2.5" data-testid="activities-rebound-history">
      <p className="text-xs text-muted-foreground">
        Devuelta {rebounds.length} {rebounds.length === 1 ? 'vez' : 'veces'}; {errors} {errors === 1 ? 'cuenta' : 'cuentan'} en el cumplimiento (solo los errores o entregas incompletas).
      </p>
      <ol className="space-y-2.5">
        {rebounds.map((rebound) => <ReboundRow key={rebound.id} taskId={String(task.id)} rebound={rebound} canReview={canReview} onChanged={onChanged} />)}
      </ol>
    </div>,
  )}</>;
}
