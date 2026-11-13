import { useEffect, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DateTimePickerField } from '../ui/DateTimePickerField';
import type { ActivityCategoryItem, Task } from '../../types';
import { assigneeNames } from './taskTrace';

const NO_CATEGORY = '__none__';

const PRIORITIES: Array<{ value: string; label: string }> = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

export interface TaskEditPatch {
  title?: string;
  description?: string;
  priority?: string;
  dueDate?: string;
  categoryId?: string | null;
}

interface TaskEditDialogProps {
  task: Task | null;
  categories: ActivityCategoryItem[];
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recibe solo lo que cambió. */
  onSave: (task: Task, patch: TaskEditPatch) => Promise<void> | void;
}

/** Editar el contenido de una tarea: título, descripción, prioridad, vencimiento y categoría. El responsable se cambia con «Reasignar». */
export function TaskEditDialog({ task, categories, open, saving, onOpenChange, onSave }: TaskEditDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState(NO_CATEGORY);

  useEffect(() => {
    if (!open || !task) return;
    setTitle(String(task.title || ''));
    setDescription(String(task.description || ''));
    setPriority(String(task.priority || 'MEDIUM').toUpperCase());
    setDueDate(task.dueDate ? String(task.dueDate) : '');
    setCategoryId(task.categoryId ? String(task.categoryId).toUpperCase() : NO_CATEGORY);
    // Solo al abrir o al cambiar de tarea; no queremos pisar lo que la persona está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  if (!task) return null;

  const ownKey = task.categoryId ? String(task.categoryId).toUpperCase() : null;
  // Una categoría archivada solo se ofrece si la tarea ya la tiene (no se puede asignar de nuevo).
  const options = categories.filter((category) => !category.isArchived || category.key.toUpperCase() === ownKey);
  const people = assigneeNames(task as never);

  const buildPatch = (): TaskEditPatch => {
    const patch: TaskEditPatch = {};
    const nextTitle = title.trim();
    if (nextTitle !== String(task.title || '').trim()) patch.title = nextTitle;
    if (description.trim() !== String(task.description || '').trim()) patch.description = description.trim();
    if (priority !== String(task.priority || 'MEDIUM').toUpperCase()) patch.priority = priority;
    const previousDue = task.dueDate ? new Date(task.dueDate).getTime() : null;
    const nextDue = dueDate ? new Date(dueDate).getTime() : null;
    if (nextDue !== null && nextDue !== previousDue && !Number.isNaN(nextDue)) patch.dueDate = new Date(dueDate).toISOString();
    const previousCategory = ownKey ?? NO_CATEGORY;
    if (categoryId !== previousCategory) patch.categoryId = categoryId === NO_CATEGORY ? null : categoryId;
    return patch;
  };

  const patch = buildPatch();
  const changed = Object.keys(patch).length > 0;
  const titleMissing = title.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto rounded-3xl border-border/60 bg-background p-0 shadow-2xl sm:max-w-xl" data-testid="activities-task-edit-dialog">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-primary/10 via-background to-background px-6 py-5 text-left sm:px-8">
          <div className="flex items-start gap-3 pr-6">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Pencil className="size-5" /></div>
            <div className="min-w-0">
              <DialogTitle className="font-black tracking-tight sm:text-lg">Editar tarea</DialogTitle>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                Responsable: {people.length > 0 ? people.join(', ') : 'sin asignar'}. Para cambiarlo usa «Reasignar».
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="grid gap-5 px-6 py-6 sm:px-8">
          <div className="space-y-2">
            <Label htmlFor="activities-task-edit-title" className="text-xs font-bold text-foreground">Título de la tarea</Label>
            <Input id="activities-task-edit-title" data-testid="activities-task-edit-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} className="h-11 rounded-xl" />
            {titleMissing && <p className="text-[11px] font-semibold text-destructive">El título no puede quedar vacío.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="activities-task-edit-description" className="text-xs font-bold text-foreground">Descripción</Label>
            <Textarea id="activities-task-edit-description" data-testid="activities-task-edit-description" value={description} maxLength={4000} onChange={(event) => setDescription(event.target.value)} className="min-h-28 rounded-xl text-sm" placeholder="Qué hay que hacer, con qué entregables." />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-11 w-full rounded-xl text-sm" data-testid="activities-task-edit-priority"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-11 w-full min-w-0 rounded-xl text-sm" data-testid="activities-task-edit-category"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                  {options.map((category) => <SelectItem key={category.key} value={category.key.toUpperCase()}>{category.isArchived ? `${category.name} (archivada)` : category.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">Vencimiento</Label>
            <DateTimePickerField value={dueDate} onChange={setDueDate} placeholder="Seleccionar fecha y hora" className="w-full" />
          </div>
        </div>
        <DialogFooter className="gap-2 border-t border-border/40 px-6 py-4 sm:px-8">
          <Button type="button" variant="outline" className="rounded-xl" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" className="rounded-xl font-black uppercase tracking-widest" disabled={saving || titleMissing || !changed} onClick={() => void onSave(task, patch)} data-testid="activities-task-edit-save">
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {saving ? 'Guardando…' : changed ? 'Guardar cambios' : 'Sin cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
