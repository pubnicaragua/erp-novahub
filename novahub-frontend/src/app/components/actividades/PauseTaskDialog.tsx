import { useEffect, useState } from 'react';
import { Loader2, PauseCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../ui/utils';
import type { Task } from '../../types';
import { PAUSE_REASON_OPTIONS, type PauseReason } from './taskCompliance';
import { truncateText } from './taskTrace';

const NONE = '__none__';

export interface PausePayload {
  reason: PauseReason;
  note?: string;
  displacedByActivityId?: string;
}

interface PauseTaskDialogProps {
  task: Task | null;
  /** Tareas abiertas que pueden haber tomado la prioridad. */
  openTasks: Task[];
  saving: boolean;
  onClose: () => void;
  onConfirm: (task: Task, payload: PausePayload) => void;
}

/** Pone una tarea en pausa con su motivo, para que quien la vea detenida sepa por qué. */
export function PauseTaskDialog({ task, openTasks, saving, onClose, onConfirm }: PauseTaskDialogProps) {
  const [reason, setReason] = useState<PauseReason | ''>('');
  const [note, setNote] = useState('');
  const [displacedBy, setDisplacedBy] = useState(NONE);

  useEffect(() => {
    setReason('');
    setNote('');
    setDisplacedBy(NONE);
  }, [task?.id]);

  if (!task) return null;
  const option = PAUSE_REASON_OPTIONS.find((item) => item.value === reason);
  const candidates = openTasks.filter((other) => String(other.id) !== String(task.id));
  const hasDetail = reason === 'PRIORITY' ? displacedBy !== NONE || note.trim().length > 0 : note.trim().length > 0;
  const ready = Boolean(reason) && hasDetail;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto rounded-3xl border-border/60 bg-background p-0 shadow-2xl sm:max-w-lg" data-testid="activities-pause-dialog">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-violet-500/10 via-background to-background px-6 py-5 text-left sm:px-8">
          <div className="flex items-start gap-3 pr-6">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600"><PauseCircle className="size-5" /></div>
            <div className="min-w-0">
              <DialogTitle className="font-black tracking-tight sm:text-lg">Poner en pausa</DialogTitle>
              <p className="mt-1 break-words text-xs text-muted-foreground">{truncateText(task.title, 110)}</p>
            </div>
          </div>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-5 sm:px-8">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-xs font-bold text-foreground">¿Por qué se detiene?</legend>
            {PAUSE_REASON_OPTIONS.map((item) => (
              <label key={item.value} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold', reason === item.value ? 'border-violet-500/60 bg-violet-500/[0.07]' : 'border-border/60 hover:bg-muted/40')}>
                <input type="radio" name="pause-reason" className="size-4 accent-violet-600" checked={reason === item.value} onChange={() => setReason(item.value)} data-testid={`activities-pause-reason-${item.value}`} />
                {item.label}
              </label>
            ))}
          </fieldset>
          {reason === 'PRIORITY' && (
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">¿Qué tarea tomó la prioridad?</Label>
              <Select value={displacedBy} onValueChange={setDisplacedBy}>
                <SelectTrigger className="h-11 w-full min-w-0 rounded-xl text-sm" data-testid="activities-pause-displaced"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>No está en la lista (lo explico abajo)</SelectItem>
                  {candidates.map((other) => <SelectItem key={other.id} value={String(other.id)}>{truncateText(other.title, 70)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {option && (
            <div className="space-y-2">
              <Label htmlFor="activities-pause-note" className="text-xs font-bold text-foreground">{option.noteLabel}</Label>
              <Textarea id="activities-pause-note" data-testid="activities-pause-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} className="min-h-20 rounded-xl text-sm" />
            </div>
          )}
          <p className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-[11px] leading-4 text-muted-foreground">
            La pausa se ve de inmediato. El plazo solo se detiene si quien aprueba la acepta; mientras tanto sigue corriendo. Los cronómetros de esta tarea se detienen.
          </p>
        </div>
        <DialogFooter className="gap-2 border-t border-border/40 px-6 py-4 sm:px-8">
          <Button type="button" variant="outline" className="rounded-xl" disabled={saving} onClick={onClose}>Cancelar</Button>
          <Button
            type="button"
            className="rounded-xl font-black uppercase tracking-widest"
            disabled={!ready || saving}
            data-testid="activities-pause-confirm"
            onClick={() => reason && onConfirm(task, {
              reason,
              note: note.trim() || undefined,
              displacedByActivityId: reason === 'PRIORITY' && displacedBy !== NONE ? displacedBy : undefined,
            })}
          >
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Poner en pausa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
