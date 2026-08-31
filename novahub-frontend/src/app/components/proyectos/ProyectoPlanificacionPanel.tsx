import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle2, ListTodo, Flag, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DateField } from '../ui/DateField';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { usersService } from '../../services/users.service';
import { projectsService, type ProjectMilestone, type ProjectTask } from '../../services/projects.service';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { TASK_STATUS_META, PRIORITY_META, TASK_STATUS_OPTIONS, PRIORITY_OPTIONS, formatDate, fromLocalDate, toLocalDate } from './shared';

interface ProyectoPlanificacionPanelProps {
  projectId: string;
}

export function ProyectoPlanificacionPanel({ projectId }: ProyectoPlanificacionPanelProps) {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; editing?: ProjectTask | null }>({ open: false, editing: null });
  const [milestoneDialog, setMilestoneDialog] = useState<{ open: boolean; editing?: ProjectMilestone | null }>({ open: false, editing: null });

  const tasksQuery = useTenantQuery<ProjectTask[]>(['projects', 'tasks', projectId], (s) => projectsService.tasks(projectId, s), { enabled: true });
  const milestonesQuery = useTenantQuery<ProjectMilestone[]>(['projects', 'milestones', projectId], (s) => projectsService.milestones(projectId, s), { enabled: true });
  const usersQuery = useTenantQuery<any[]>(['projects', 'users'], (s) => usersService.getAll({ signal: s } as any), { enabled: true });

  const tasks = asList(tasksQuery.data) as ProjectTask[];
  const milestones = asList(milestonesQuery.data) as ProjectMilestone[];
  const users = asList(usersQuery.data);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tenant-module', 'projects'] });

  const taskMutations = useMutation({
    mutationFn: (args: { type: 'create' | 'update' | 'complete' | 'delete'; id?: string; payload?: any }) => {
      if (args.type === 'create') return projectsService.createTask(projectId, args.payload);
      if (args.type === 'update') return projectsService.updateTask(projectId, args.id!, args.payload);
      if (args.type === 'complete') return projectsService.completeTask(projectId, args.id!);
      return projectsService.deleteTask(projectId, args.id!);
    },
    onSuccess: () => { invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Error al procesar la tarea'),
  });

  const milestoneMutations = useMutation({
    mutationFn: (args: { type: 'create' | 'update' | 'delete'; id?: string; payload?: any }) => {
      if (args.type === 'create') return projectsService.createMilestone(projectId, args.payload);
      if (args.type === 'update') return projectsService.updateMilestone(projectId, args.id!, args.payload);
      return projectsService.deleteMilestone(projectId, args.id!);
    },
    onSuccess: () => { invalidate(); },
    onError: (e: any) => toast.error(e?.message || 'Error al procesar el hito'),
  });

  const canEditTasks = canPerform('PROJECTS_TASKS', 'edit');
  const canCreateTasks = canPerform('PROJECTS_TASKS', 'create');
  const canDeleteTasks = canPerform('PROJECTS_TASKS', 'delete');

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><Flag className="size-4 text-primary" /> Hitos</CardTitle>
          {canCreateTasks && <Button size="sm" onClick={() => setMilestoneDialog({ open: true })} className="gap-1.5"><Plus className="size-4" /> Hito</Button>}
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay hitos definidos.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {milestones.map((m) => (
                <div key={m.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{m.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Vence {formatDate(m.dueDate)}</p>
                    </div>
                    <Badge variant="outline" className={cn('border', TASK_STATUS_META[m.status].badge)}>{TASK_STATUS_META[m.status].label}</Badge>
                  </div>
                  {m._count?.tasks != null && <p className="mt-2 text-xs text-muted-foreground">{m._count.tasks} tareas vinculadas</p>}
                  {canEditTasks && (
                    <div className="mt-3 flex gap-1">
                      {m.status !== 'COMPLETED' && <Button size="sm" variant="outline" onClick={() => milestoneMutations.mutate({ type: 'update', id: m.id, payload: { status: 'COMPLETED' } })}><CheckCircle2 className="size-3.5" /> Completar</Button>}
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => setMilestoneDialog({ open: true, editing: m })}><Pencil className="size-4" /></Button>
                      {canDeleteTasks && <Button size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => { if (window.confirm(`¿Eliminar el hito ${m.name}?`)) milestoneMutations.mutate({ type: 'delete', id: m.id }); }}><Trash2 className="size-4" /></Button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><ListTodo className="size-4 text-primary" /> Tareas</CardTitle>
          {canCreateTasks && <Button size="sm" onClick={() => setTaskDialog({ open: true })} className="gap-1.5"><Plus className="size-4" /> Nueva tarea</Button>}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Hito</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Avance</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No hay tareas. Crea la primera.</TableCell></TableRow>
                ) : tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className="font-bold">{t.title}</p>
                      {t.description && <p className="max-w-[280px] truncate text-xs text-muted-foreground">{t.description}</p>}
                    </TableCell>
                    <TableCell>{t.milestone?.name || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={cn('border', TASK_STATUS_META[t.status].badge)}>{TASK_STATUS_META[t.status].label}</Badge></TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-bold', PRIORITY_META[t.priority].badge)}>
                        <span className={cn('size-2 rounded-full', PRIORITY_META[t.priority].dot)} />{PRIORITY_META[t.priority].label}
                      </span>
                    </TableCell>
                    <TableCell>{t.assignedTo?.name || '—'}</TableCell>
                    <TableCell className="text-xs">{formatDate(t.dueDate)}</TableCell>
                    <TableCell className="min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <Progress value={Number(t.progress) || 0} className="h-1.5 w-16" />
                        <span className="text-xs font-bold">{Number(t.progress) || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {t.status !== 'COMPLETED' && canEditTasks && <Button size="icon" variant="ghost" className="size-8 text-emerald-600" title="Completar" onClick={() => taskMutations.mutate({ type: 'complete', id: t.id })}><CheckCircle2 className="size-4" /></Button>}
                        {canEditTasks && <Button size="icon" variant="ghost" className="size-8" onClick={() => setTaskDialog({ open: true, editing: t })}><Pencil className="size-4" /></Button>}
                        {canDeleteTasks && <Button size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => { if (window.confirm(`¿Eliminar la tarea ${t.title}?`)) taskMutations.mutate({ type: 'delete', id: t.id }); }}><Trash2 className="size-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Cronograma tasks={tasks} milestones={milestones} />

      {taskDialog.open && (
        <TaskFormDialog editing={taskDialog.editing} users={users} milestones={milestones} onClose={() => setTaskDialog({ open: false, editing: null })}
          onSubmit={(payload) => taskMutations.mutate(taskDialog.editing ? { type: 'update', id: taskDialog.editing.id, payload } : { type: 'create', payload })} />
      )}
      {milestoneDialog.open && (
        <MilestoneFormDialog editing={milestoneDialog.editing} onClose={() => setMilestoneDialog({ open: false, editing: null })}
          onSubmit={(payload) => milestoneMutations.mutate(milestoneDialog.editing ? { type: 'update', id: milestoneDialog.editing.id, payload } : { type: 'create', payload })} />
      )}
    </div>
  );
}

function Cronograma({ tasks, milestones }: { tasks: ProjectTask[]; milestones: ProjectMilestone[] }) {
  const active = useMemo(() => {
    const items = [
      ...tasks.map((t) => ({ id: t.id, kind: 'task' as const, label: t.title, start: t.startDate || t.dueDate, end: t.dueDate || t.startDate, status: t.status })),
      ...milestones.map((m) => ({ id: m.id, kind: 'milestone' as const, label: m.name, start: m.dueDate, end: m.dueDate, status: m.status })),
    ].filter((i) => Boolean(i.start));
    if (items.length === 0) return null;
    const dates = items.flatMap((i) => {
      const startTime = i.start ? new Date(i.start).getTime() : NaN;
      const endTime = i.end ? new Date(i.end).getTime() : startTime;
      return [startTime, endTime];
    }).filter((v) => !Number.isNaN(v));
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    const span = Math.max(max - min, 86400000);
    return { items, min, span };
  }, [tasks, milestones]);

  if (!active) return null;
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CalendarDays className="size-4 text-primary" /> Cronograma</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[560px] space-y-2">
          <div className="relative ml-36 h-6">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
          </div>
          {active.items.map((item) => {
            const startTime = item.start ? new Date(item.start).getTime() : active.min;
            const endTime = item.end ? new Date(item.end).getTime() : startTime;
            const start = (startTime - active.min) / active.span;
            const width = Math.max(((endTime - startTime) / active.span) * 100, item.kind === 'milestone' ? 2 : 6);
            const done = item.status === 'COMPLETED';
            return (
              <div key={item.id} className="flex items-center gap-2">
                <span className="w-32 shrink-0 truncate text-xs font-bold text-muted-foreground">{item.label}</span>
                <div className="relative h-6 flex-1">
                  <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border/50" />
                  <div
                    title={item.label}
                    className={cn('absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full',
                      item.kind === 'milestone' ? 'bg-amber-400' : done ? 'bg-emerald-500' : 'bg-primary/70')}
                    style={{ left: `${start * 100}%`, width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskFormDialog({ editing, users, milestones, onClose, onSubmit }: {
  editing?: ProjectTask | null;
  users: any[];
  milestones: ProjectMilestone[];
  onClose: () => void;
  onSubmit: (payload: any) => void;
}) {
  const [form, setForm] = useState<any>({
    title: editing?.title || '',
    description: editing?.description || '',
    status: editing?.status || 'PENDING',
    priority: editing?.priority || 'MEDIUM',
    dueDate: toLocalDate(editing?.dueDate) || '',
    startDate: toLocalDate(editing?.startDate) || '',
    milestoneId: editing?.milestoneId || '',
    assignedToId: editing?.assignedToId || '',
    progress: editing?.progress != null ? String(editing.progress) : '',
  });
  const valid = form.title?.trim();
  const submit = () => {
    if (!valid) return;
    onSubmit({
      title: form.title.trim(),
      description: form.description?.trim() || undefined,
      status: form.status,
      priority: form.priority,
      dueDate: fromLocalDate(form.dueDate),
      startDate: fromLocalDate(form.startDate),
      milestoneId: form.milestoneId || undefined,
      assignedToId: form.assignedToId || undefined,
      progress: form.progress === '' ? undefined : Number(form.progress),
    });
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{editing ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="Ej. Levantamiento de requerimientos" /></div>
          <div className="sm:col-span-2"><Label>Descripción</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
          <div><Label>Estado</Label><Select value={form.status} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TASK_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Prioridad</Label><Select value={form.priority} onValueChange={(v) => setForm((f: any) => ({ ...f, priority: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Responsable</Label><Select value={form.assignedToId || ''} onValueChange={(v) => setForm((f: any) => ({ ...f, assignedToId: v }))}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="">Sin asignar</SelectItem>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Hito</Label><Select value={form.milestoneId || ''} onValueChange={(v) => setForm((f: any) => ({ ...f, milestoneId: v }))}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="">Sin hito</SelectItem>{milestones.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Inicio</Label><DateField value={form.startDate || ''} onChange={(v) => setForm((f: any) => ({ ...f, startDate: v }))} /></div>
          <div><Label>Vence</Label><DateField value={form.dueDate || ''} onChange={(v) => setForm((f: any) => ({ ...f, dueDate: v }))} /></div>
          <div><Label>Avance (%)</Label><Input type="number" min={0} max={100} value={form.progress} onChange={(e) => setForm((f: any) => ({ ...f, progress: e.target.value }))} placeholder="0" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={!valid}>{editing ? 'Guardar' : 'Crear tarea'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MilestoneFormDialog({ editing, onClose, onSubmit }: { editing?: ProjectMilestone | null; onClose: () => void; onSubmit: (payload: any) => void }) {
  const [form, setForm] = useState<any>({ name: editing?.name || '', description: editing?.description || '', dueDate: toLocalDate(editing?.dueDate) || '' });
  const submit = () => {
    if (!form.name?.trim()) return;
    onSubmit({ name: form.name.trim(), description: form.description?.trim() || undefined, dueDate: fromLocalDate(form.dueDate) });
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{editing ? 'Editar hito' : 'Nuevo hito'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div><Label>Nombre *</Label><Input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Ej. Entrega de planos" /></div>
          <div><Label>Descripción</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
          <div><Label>Fecha límite</Label><DateField value={form.dueDate || ''} onChange={(v) => setForm((f: any) => ({ ...f, dueDate: v }))} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={!form.name?.trim()}>{editing ? 'Guardar' : 'Crear hito'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}