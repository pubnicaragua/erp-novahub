import { useState } from 'react';
import { CheckCircle2, ListChecks, Loader2, Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { cn } from '../ui/utils';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { toast } from '../../services/toast';
import { performanceService, type Goal } from '../../services/performance.service';

const failure = (error: unknown) => (error as any)?.response?.data?.message?.toString?.() || (error as Error)?.message || 'No se pudo completar la acción.';
const STATUS: Record<string, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En curso', COMPLETED: 'Terminada', CANCELLED: 'Cancelada', BLOCKED: 'Bloqueada' };

/** Tareas de una meta: se crean con responsable y fecha, y el avance de la meta puede salir de ellas. */
export function GoalTasksDialog({ goal, people, canEdit, onClose, onChanged }: { goal: Goal; people: Array<{ id: string; name: string }>; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const client = useQueryClient();
  const query = useTenantQuery(['performance', 'goal-tasks', goal.id], (signal) => performanceService.getGoalTasks(goal.id, signal), { staleTime: 0 });
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState(goal.userId ?? '');
  const [dueDate, setDueDate] = useState('');
  const [weight, setWeight] = useState('1');
  const [busy, setBusy] = useState(false);

  const refresh = async () => { await query.refetch(); void client.invalidateQueries({ queryKey: ['tenant-module'] }); onChanged(); };
  const add = async () => {
    setBusy(true);
    try {
      await performanceService.addGoalTask(goal.id, { title: title.trim(), assigneeId: assigneeId || undefined, dueDate: dueDate || undefined, weight: Number(weight) });
      setTitle(''); setDueDate('');
      toast.success('Tarea agregada y avisada a su responsable');
      await refresh();
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const remove = async (activityId: string) => {
    try { await performanceService.removeGoalTask(goal.id, activityId); await refresh(); } catch (error) { toast.error(failure(error)); }
  };
  const summary = query.data?.summary;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ListChecks className="size-5" aria-hidden /> Tareas de la meta</DialogTitle><DialogDescription>{goal.title}</DialogDescription></DialogHeader>

        {goal.metric !== 'LINKED_TASKS' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Esta meta mide «{goal.metricLabel}». Las tareas sirven de plan de trabajo; para que el avance de la meta salga de ellas, edita la meta y elige «Avance de las tareas de la meta».</p>}
        {summary && <p className="text-sm"><strong>{summary.done}</strong> de {summary.total} tarea(s) terminada(s) · avance ponderado <strong>{summary.percent} %</strong></p>}

        {query.isLoading ? <Skeleton className="h-24 w-full" aria-busy="true" />
          : query.isError ? <p className="text-sm text-destructive" role="alert">No se pudieron cargar las tareas.</p>
          : !query.data?.items.length ? <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">La meta todavía no tiene tareas. Agrega la primera abajo.</p>
          : (
            <ul className="space-y-2">
              {query.data.items.map((item) => (
                <li key={item.activityId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 break-words font-semibold">{item.status === 'COMPLETED' && <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />}{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.assigneeName ?? 'Sin responsable'} · peso {item.weight}{item.dueDate ? ` · vence ${new Date(item.dueDate).toLocaleDateString('es-NI', { dateStyle: 'medium', timeZone: 'UTC' })}` : ''}{item.rating ? ` · calificación ${item.rating}/5` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2"><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', item.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-900' : item.overdue ? 'bg-red-100 text-red-900' : 'bg-slate-100 text-slate-800')}>{item.overdue ? 'Vencida' : STATUS[item.status] ?? item.status}</span>{canEdit && <button type="button" aria-label={`Quitar ${item.title} de la meta`} className="text-muted-foreground hover:text-destructive" onClick={() => void remove(item.activityId)}><Trash2 className="size-4" /></button>}</div>
                </li>
              ))}
            </ul>
          )}

        {canEdit && (
          <div className="grid gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-6">
            <div className="space-y-1.5 sm:col-span-6"><Label htmlFor="gt-title">Nueva tarea</Label><Input id="gt-title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Qué hay que hacer" /></div>
            <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="gt-who">Responsable</Label><select id="gt-who" className="h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">Elegir…</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="gt-due">Fecha límite</Label><Input id="gt-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="gt-w">Peso</Label><Input id="gt-w" type="number" min="1" max="10" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
            <div className="flex justify-end sm:col-span-6"><Button type="button" onClick={() => void add()} disabled={busy || !title.trim() || !assigneeId}>{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}Agregar tarea</Button></div>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Cada tarea aparece en Actividades del responsable, con su fecha límite, tiempo y calificación; el peso indica cuánto vale dentro de la meta.</p>
      </DialogContent>
    </Dialog>
  );
}
