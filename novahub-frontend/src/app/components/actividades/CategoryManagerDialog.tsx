import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { invalidateTenantQueries } from '../../hooks/useTenantQuery';
import { activityCategoriesService } from '../../services/actividades.service';
import type { ActivityCategoryItem } from '../../types';
import { CATEGORY_COLOR_KEYS, CATEGORY_ICON_OPTIONS, getCategoryColor, getCategoryIcon } from './categoryStyle';

interface CategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ActivityCategoryItem[];
  /** Cuántas tareas (abiertas o no) usa cada categoría, para avisar antes de archivar. */
  taskCounts: Map<string, number>;
  onChanged?: () => void;
}

interface Draft {
  name: string;
  description: string;
  icon: string;
  color: string;
}

const EMPTY_DRAFT: Draft = { name: '', description: '', icon: 'folder', color: 'blue' };

function messageOf(error: unknown, fallback: string): string {
  const failure = error as { response?: { data?: { message?: string | string[] } }; message?: string } | null;
  const message = failure?.response?.data?.message;
  return (Array.isArray(message) ? message.join(' ') : message) || failure?.message || fallback;
}

function IconColorPicker({ draft, onChange }: { draft: Draft; onChange: (next: Draft) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Icono</Label>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icono de la categoría">
          {CATEGORY_ICON_OPTIONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={draft.icon === key}
              aria-label={label}
              title={label}
              onClick={() => onChange({ ...draft, icon: key })}
              className={cn(
                'flex size-9 items-center justify-center rounded-lg border transition-colors',
                draft.icon === key ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Color</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color de la categoría">
          {CATEGORY_COLOR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={draft.color === key}
              aria-label={key}
              title={key}
              onClick={() => onChange({ ...draft, color: key })}
              className={cn('flex size-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110', getCategoryColor(key).dot, draft.color === key ? 'border-foreground' : 'border-transparent')}
            >
              {draft.color === key && <Check className="size-3.5 text-white" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DraftForm({ draft, onChange, onSubmit, onCancel, saving, submitLabel }: {
  draft: Draft; onChange: (next: Draft) => void; onSubmit: () => void; onCancel?: () => void; saving: boolean; submitLabel: string;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/20 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="activity-category-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre</Label>
        <Input
          id="activity-category-name"
          data-testid="activity-category-name"
          value={draft.name}
          maxLength={60}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onSubmit(); } }}
          placeholder="Ej. Redes y presencia digital"
          className="h-10 rounded-xl bg-background"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="activity-category-description" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción (opcional)</Label>
        <Textarea
          id="activity-category-description"
          value={draft.description}
          maxLength={200}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          placeholder="Para qué se usa esta categoría"
          className="min-h-14 rounded-xl bg-background text-sm"
        />
      </div>
      <IconColorPicker draft={draft} onChange={onChange} />
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" size="sm" className="h-9 rounded-xl text-xs" onClick={onCancel} disabled={saving}><X className="mr-1.5 size-3.5" />Cancelar</Button>}
        <Button type="button" size="sm" className="h-9 rounded-xl px-4 text-xs font-black uppercase tracking-widest" onClick={onSubmit} disabled={saving || !draft.name.trim()} data-testid="activity-category-save">
          {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Check className="mr-1.5 size-3.5" />}{submitLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Administra las categorías de tareas de la empresa: crear, renombrar, elegir icono y color, ordenar y archivar.
 * No hay borrado: una categoría archivada deja de ofrecerse, pero las tareas que la tenían la conservan.
 */
export function CategoryManagerDialog({ open, onOpenChange, categories, taskCounts, onChanged }: CategoryManagerDialogProps) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!open) {
      setCreating(false);
      setEditingId(null);
      setNewDraft(EMPTY_DRAFT);
      setShowArchived(false);
    }
  }, [open]);

  const active = categories.filter((category) => !category.isArchived);
  const archived = categories.filter((category) => category.isArchived);

  const refresh = () => {
    void invalidateTenantQueries(queryClient);
    onChanged?.();
  };

  const run = async (id: string, action: () => Promise<unknown>, success: string) => {
    try {
      setBusyId(id);
      await action();
      toast.success(success);
      refresh();
      return true;
    } catch (error) {
      toast.error(messageOf(error, 'No se pudo guardar el cambio'));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const create = async () => {
    const ok = await run('new', () => activityCategoriesService.create({
      name: newDraft.name, description: newDraft.description || null, icon: newDraft.icon, color: newDraft.color,
    }), 'Categoría creada');
    if (ok) {
      setNewDraft(EMPTY_DRAFT);
      setCreating(false);
    }
  };

  const startEdit = (category: ActivityCategoryItem) => {
    setEditingId(category.id);
    setEditDraft({ name: category.name, description: category.description || '', icon: category.icon || 'folder', color: category.color || 'blue' });
  };

  const saveEdit = async (category: ActivityCategoryItem) => {
    const ok = await run(category.id, () => activityCategoriesService.update(category.id, {
      name: editDraft.name, description: editDraft.description || null, icon: editDraft.icon, color: editDraft.color,
    }), 'Categoría actualizada');
    if (ok) setEditingId(null);
  };

  const move = async (category: ActivityCategoryItem, direction: -1 | 1) => {
    const ids = active.map((item) => item.id);
    const index = ids.indexOf(category.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await run(category.id, () => activityCategoriesService.reorder([...ids, ...archived.map((item) => item.id)]), 'Orden guardado');
  };

  const setArchived = (category: ActivityCategoryItem, isArchived: boolean) =>
    run(category.id, () => activityCategoriesService.update(category.id, { isArchived }), isArchived ? 'Categoría archivada' : 'Categoría reactivada');

  const renderRow = (category: ActivityCategoryItem, position?: { index: number; total: number }) => {
    const Icon = getCategoryIcon(category.icon);
    const color = getCategoryColor(category.color);
    const used = taskCounts.get(category.key) || 0;
    if (editingId === category.id) {
      return (
        <li key={category.id}>
          <DraftForm draft={editDraft} onChange={setEditDraft} onSubmit={() => void saveEdit(category)} onCancel={() => setEditingId(null)} saving={busyId === category.id} submitLabel="Guardar" />
        </li>
      );
    }
    return (
      <li key={category.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/50 bg-card p-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', color.chip)}><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{category.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {used === 0 ? 'Sin tareas' : used === 1 ? '1 tarea' : `${used} tareas`}
            {category.description ? ` · ${category.description}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {position && (
            <>
              <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={`Subir ${category.name}`} title="Subir" disabled={busyId !== null || position.index === 0} onClick={() => void move(category, -1)}><ArrowUp className="size-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={`Bajar ${category.name}`} title="Bajar" disabled={busyId !== null || position.index === position.total - 1} onClick={() => void move(category, 1)}><ArrowDown className="size-4" /></Button>
            </>
          )}
          <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={`Editar ${category.name}`} title="Editar" disabled={busyId !== null} onClick={() => startEdit(category)}><Pencil className="size-4" /></Button>
          {category.isArchived ? (
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={`Reactivar ${category.name}`} title="Reactivar" disabled={busyId !== null} onClick={() => void setArchived(category, false)}>
              {busyId === category.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg text-amber-600 hover:bg-amber-500/10 dark:text-amber-400" aria-label={`Archivar ${category.name}`} title="Archivar: deja de ofrecerse, sus tareas la conservan" disabled={busyId !== null} onClick={() => void setArchived(category, true)}>
              {busyId === category.id ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
            </Button>
          )}
        </div>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <DialogHeader className="border-b border-border/50 px-6 py-5 text-left">
          <DialogTitle className="text-lg font-black">Categorías de tareas</DialogTitle>
          <DialogDescription className="text-xs">
            Crea las categorías que usa tu empresa. Archivar no borra nada: las tareas conservan su categoría.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {creating ? (
            <DraftForm draft={newDraft} onChange={setNewDraft} onSubmit={() => void create()} onCancel={() => { setCreating(false); setNewDraft(EMPTY_DRAFT); }} saving={busyId === 'new'} submitLabel="Crear categoría" />
          ) : (
            <Button type="button" className="h-10 rounded-xl px-4 text-xs font-black uppercase tracking-widest" onClick={() => setCreating(true)} data-testid="activity-category-new">
              <Plus className="mr-1.5 size-4" /> Nueva categoría
            </Button>
          )}
          <ul className="space-y-2" aria-label="Categorías activas">
            {active.map((category, index) => renderRow(category, { index, total: active.length }))}
            {active.length === 0 && <li className="text-sm text-muted-foreground">No hay categorías activas.</li>}
          </ul>
          {archived.length > 0 && (
            <div className="space-y-2">
              <button type="button" className="text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground" onClick={() => setShowArchived((value) => !value)} aria-expanded={showArchived}>
                {showArchived ? 'Ocultar' : 'Ver'} archivadas ({archived.length})
              </button>
              {showArchived && <ul className="space-y-2" aria-label="Categorías archivadas">{archived.map((category) => renderRow(category))}</ul>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
