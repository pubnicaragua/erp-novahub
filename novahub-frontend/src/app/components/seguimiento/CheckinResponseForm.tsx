import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { performanceService, type PendingCheckin, type PendingCheckinsResponse } from '../../services/performance.service';
import { toast } from '../../services/toast';
import { Field, controlClass } from '../organizacion/OrgBits';
import { errorMessage, formatMinutes } from '../organizacion/organizacion.utils';
import { useMinuteTicker } from './useMinuteTicker';
import { REMAINING_CHOICES, clockLabel, dueLabel, minutesUntil } from './seguimiento.utils';

/** Formulario de «¿En qué estás trabajando?»: tareas en curso, qué tanto falta y si hay algún bloqueo. */
export function CheckinResponseForm({ prompt, tasks, timeZone, onDone }: { prompt: PendingCheckin; tasks: PendingCheckinsResponse['tasks']; timeZone: string; onDone: () => void }) {
  const now = useMinuteTicker();
  const [workingOn, setWorkingOn] = useState('');
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [blockers, setBlockers] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleTask = (task: PendingCheckinsResponse['tasks'][number]) => {
    const selected = activityIds.includes(task.id);
    setActivityIds(selected ? activityIds.filter((id) => id !== task.id) : [...activityIds, task.id].slice(0, 10));
    // Un atajo: al elegir tareas por primera vez, el texto parte con sus nombres.
    if (!selected && !workingOn.trim()) setWorkingOn(task.title);
  };
  const remainingMinutes = custom.trim() !== '' ? Number(custom) : remaining;
  const validRemaining = remainingMinutes === null || (Number.isInteger(remainingMinutes) && remainingMinutes >= 0 && remainingMinutes <= 1440);

  const submit = async () => {
    setBusy(true);
    try {
      await performanceService.respondCheckin(prompt.id, { workingOn: workingOn.trim(), activityIds, remainingMinutes, blockers: blockers.trim() || null });
      toast.success('Respuesta enviada');
      onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <p className={cn('text-[12px] font-semibold', prompt.noDeadline || minutesUntil(prompt.dueAt, now) > 0 ? 'text-muted-foreground' : 'text-red-700')} role="status">
        Pregunta de las {clockLabel(prompt.scheduledFor, timeZone)}. {dueLabel(prompt, now)}.
      </p>
      {tasks.length > 0 && (
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-[12px] font-semibold">¿En cuáles de tus tareas avanzas? (opcional)</legend>
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {tasks.map((task) => (
              <li key={task.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[13px] hover:bg-muted/50">
                  <input type="checkbox" checked={activityIds.includes(task.id)} onChange={() => toggleTask(task)} />
                  <span className="min-w-0 break-words">{task.title}{task.estimatedMinutes ? <span className="text-[11px] text-muted-foreground"> · estimada {formatMinutes(task.estimatedMinutes)}</span> : null}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <Field label="¿En qué estás trabajando?" htmlFor="checkin-working-on" required>
        <Textarea id="checkin-working-on" value={workingOn} onChange={(e) => setWorkingOn(e.target.value)} rows={3} maxLength={1000} placeholder="Por ejemplo: armando la propuesta para el cliente nuevo" autoFocus />
      </Field>
      <div className="space-y-1.5">
        <span id="checkin-remaining" className="block text-[12px] font-semibold">¿Cuánto tiempo te falta?</span>
        <div role="radiogroup" aria-labelledby="checkin-remaining" className="flex flex-wrap items-center gap-2">
          {REMAINING_CHOICES.map((choice) => (
            <button key={choice.minutes} type="button" role="radio" aria-checked={custom === '' && remaining === choice.minutes} onClick={() => { setRemaining(choice.minutes); setCustom(''); }}
              className={cn('rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition', custom === '' && remaining === choice.minutes ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted/50')}>{choice.label}</button>
          ))}
          <input type="number" min={0} max={1440} value={custom} onChange={(e) => { setCustom(e.target.value); setRemaining(null); }} placeholder="Otro (min)" aria-label="Otro tiempo en minutos" className={cn(controlClass, 'w-28')} />
        </div>
      </div>
      <Field label="¿Algo te frena? (opcional)" htmlFor="checkin-blockers">
        <Textarea id="checkin-blockers" value={blockers} onChange={(e) => setBlockers(e.target.value)} rows={2} maxLength={1000} placeholder="Falta información, espero una aprobación…" />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy || !workingOn.trim() || !validRemaining}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}Enviar respuesta</Button>
      </div>
    </form>
  );
}
