import { useMemo, useState } from 'react';
import { Loader2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { tasksService } from '../../services/actividades.service';
import { usersService } from '../../services/users.service';
import type { Task } from '../../types';

/** Mismo umbral que valida el backend (§2.1). */
export const REASSIGN_REASON_MIN_LENGTH = 5;

export interface ReassignUserOption {
  id: string;
  name?: string | null;
  email?: string | null;
  department?: { id: string; name: string } | null;
  isActive?: boolean;
}

export interface ReassignTaskModalProps {
  open: boolean;
  task: Task | null;
  /** Usuarios del tenant. Si se omite, el modal los carga con `usersService`. */
  users?: ReassignUserOption[];
  onOpenChange: (open: boolean) => void;
  /** Se dispara con la tarea completa devuelta por el backend. */
  onReassigned?: (task: Task) => void;
}

const getUserLabel = (user: ReassignUserOption): string =>
  user.name?.trim() || user.email?.trim() || 'Usuario sin nombre';

const getErrorMessage = (error: unknown): string => {
  const payload = (error as { response?: { data?: { message?: unknown; error?: unknown } } } | null)?.response?.data;
  const raw = payload?.message ?? payload?.error ?? (error as { message?: unknown } | null)?.message;
  if (Array.isArray(raw)) return raw.map((item: unknown) => String(item)).join('. ');
  if (typeof raw === 'string' && raw.trim()) return raw;
  return 'No se pudo reasignar la tarea';
};

const ReassignForm: React.FC<Omit<ReassignTaskModalProps, 'open'>> = ({
  task,
  users,
  onOpenChange,
  onReassigned,
}) => {
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const usersQuery = useTenantQuery<ReassignUserOption[]>(
    ['activities', 'reassign-users'],
    (signal) => usersService.getLookup(undefined, signal),
    { enabled: users === undefined }
  );

  const catalog = useMemo<ReassignUserOption[]>(
    () => (users ?? asList(usersQuery.data)).filter((user) => user && user.id),
    [users, usersQuery.data]
  );
  const options = useMemo(() => catalog.filter((user) => user.isActive !== false), [catalog]);
  const isLoadingUsers = users === undefined && usersQuery.isLoading;

  const currentAssigneeId = task?.assignments?.[0]?.userId || task?.assignedToId || null;
  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length >= REASSIGN_REASON_MIN_LENGTH;
  const isSameAssignee = Boolean(newAssigneeId) && newAssigneeId === currentAssigneeId;
  const canSubmit = Boolean(task?.id) && Boolean(newAssigneeId) && isReasonValid && !isSameAssignee && !isSaving;

  const handleSubmit = async () => {
    if (!task?.id) return;
    if (!newAssigneeId) {
      setError('Selecciona el nuevo responsable.');
      return;
    }
    if (!isReasonValid) {
      setError(`El motivo debe tener al menos ${REASSIGN_REASON_MIN_LENGTH} caracteres.`);
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const updated = await tasksService.reassign(task.id, { newAssigneeId, reason: trimmedReason });
      const target = options.find((user) => user.id === newAssigneeId);
      toast.success(`Tarea reasignada a ${target ? getUserLabel(target) : 'otro responsable'}`);
      onReassigned?.(updated as Task);
      onOpenChange(false);
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-primary/10 via-background to-background px-6 py-5 sm:px-8">
        <div className="flex items-start gap-3 pr-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserCog className="size-5" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="font-black tracking-tight sm:text-lg">Reasignar tarea</DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              El cambio queda registrado en el historial junto con tu motivo.
            </p>
          </div>
        </div>
      </DialogHeader>

      <div className="grid min-w-0 gap-4 px-6 py-6 sm:px-8">
        {task?.title && (
          <div className="min-w-0 rounded-2xl border border-border/50 bg-muted/[0.12] p-3.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tarea</p>
            <p className="mt-1 break-words text-sm font-semibold">{task.title}</p>
          </div>
        )}

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="reassign-new-assignee" className="text-xs font-bold text-foreground">
            Nuevo responsable <span className="text-destructive">*</span>
          </Label>
          <Select
            value={newAssigneeId}
            onValueChange={(value) => {
              setNewAssigneeId(value);
              setError('');
            }}
            disabled={isSaving}
          >
            <SelectTrigger id="reassign-new-assignee" data-testid="reassign-assignee" className="h-11 w-full text-sm">
              <SelectValue placeholder="Selecciona un responsable" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingUsers && <div className="px-2 py-1.5 text-xs text-muted-foreground">Cargando usuarios...</div>}
              {!isLoadingUsers && options.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">No hay usuarios disponibles</div>
              )}
              {options.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {getUserLabel(user)}
                  {user.department?.name ? ` · ${user.department.name}` : ''}
                  {user.id === currentAssigneeId ? ' (actual)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSameAssignee && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Ese usuario ya es el responsable actual de la tarea.
            </p>
          )}
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="reassign-reason" className="text-xs font-bold text-foreground">
            Motivo de la reasignación <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="reassign-reason"
            data-testid="reassign-reason"
            autoFocus
            placeholder="Explica por qué cambia el responsable..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            disabled={isSaving}
            className="min-h-24 rounded-xl bg-background text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Mínimo {REASSIGN_REASON_MIN_LENGTH} caracteres. {trimmedReason.length}/{REASSIGN_REASON_MIN_LENGTH}
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
          >
            {error}
          </p>
        )}
      </div>

      <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8">
        <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={isSaving}>
          Cancelar
        </Button>
        <Button data-testid="reassign-submit" onClick={handleSubmit} disabled={!canSubmit} className="rounded-xl px-5">
          {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserCog className="mr-1.5 size-4" />}
          Reasignar
        </Button>
      </DialogFooter>
    </>
  );
};

export const ReassignTaskModal: React.FC<ReassignTaskModalProps> = ({
  open,
  task,
  users,
  onOpenChange,
  onReassigned,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl sm:max-w-[480px]">
      {open && (
        <ReassignForm
          key={task?.id ?? 'sin-tarea'}
          task={task}
          users={users}
          onOpenChange={onOpenChange}
          onReassigned={onReassigned}
        />
      )}
    </DialogContent>
  </Dialog>
);

export default ReassignTaskModal;
