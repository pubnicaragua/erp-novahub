import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Loader2, MessageSquare } from 'lucide-react';

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
  loading?: boolean;
  onConfirm: (value: string) => void | Promise<void>;
}

export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label = 'Motivo',
  placeholder,
  initialValue = '',
  confirmLabel = 'Continuar',
  cancelLabel = 'Cancelar',
  required = true,
  loading = false,
  onConfirm,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);

  const [prevDialogState, setPrevDialogState] = useState({ open, initialValue });
  if (open !== prevDialogState.open || initialValue !== prevDialogState.initialValue) {
    setPrevDialogState({ open, initialValue });
    if (open) setValue(initialValue);
  }

  const submit = async () => {
    if (required && !value.trim()) return;
    await onConfirm(value.trim());
  };

  return (
    <Dialog open={open} onOpenChange={openState => { if (!loading) onOpenChange(openState); }}>
      <DialogContent className="sm:max-w-[440px] overflow-hidden border-border/50 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageSquare className="size-4" />
            </span>
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="system-prompt-value">{label}</Label>
          <Input
            id="system-prompt-value"
            value={value}
            onChange={event => setValue(event.target.value)}
            placeholder={placeholder}
            autoFocus
            onKeyDown={event => { if (event.key === 'Enter' && (!required || value.trim())) void submit(); }}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="min-w-0 max-w-full cursor-pointer overflow-hidden" onClick={() => onOpenChange(false)} disabled={loading}>
            <span className="min-w-0 truncate">{cancelLabel}</span>
          </Button>
          <Button type="button" className="min-w-0 max-w-full cursor-pointer overflow-hidden" onClick={() => void submit()} disabled={loading || (required && !value.trim())}>
            {loading ? <><Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" /><span className="min-w-0 truncate">Procesando…</span></> : <span className="min-w-0 truncate">{confirmLabel}</span>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
