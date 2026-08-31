import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'warning' | 'default';
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  closeOnConfirm?: boolean;
  contentClassName?: string;
  children?: React.ReactNode;
}

const variantConfig = {
  destructive: {
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-500',
    buttonClass: 'bg-rose-600 hover:bg-rose-700 text-white',
  },
  warning: {
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    buttonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  default: {
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
    buttonClass: 'bg-primary hover:bg-primary/90 text-primary-foreground',
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title = '¿Estás seguro?',
  description = 'Esta acción no se puede deshacer.',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'destructive',
  onConfirm,
  loading = false,
  disabled = false,
  closeOnConfirm = true,
  contentClassName,
  children,
}) => {
  const config = variantConfig[variant];

  const handleConfirm = async () => {
    try {
      await onConfirm();
      if (closeOnConfirm) onOpenChange(false);
    } catch {
      // Error handling is done by the caller
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('w-[calc(100%-2rem)] !max-w-[420px] p-0 overflow-hidden border-border/50 bg-background/95 backdrop-blur-xl', contentClassName)}>
        <div className="flex flex-col items-center text-center px-6 pt-8 pb-4">
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className={`p-4 rounded-full ${config.iconBg} mb-4`}
              >
                <AlertTriangle className={`size-8 ${config.iconColor}`} />
              </motion.div>
            )}
          </AnimatePresence>

          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground max-w-[300px] mx-auto">
              {description}
            </DialogDescription>
          </DialogHeader>
          {children && <div className="w-full px-2">{children}</div>}
        </div>

        <DialogFooter className="min-w-0 px-6 pb-6 pt-2 flex gap-3 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading || disabled}
            className="min-w-0 max-w-full flex-1 overflow-hidden h-11 rounded-xl font-bold uppercase text-xs tracking-widest"
          >
            <span className="min-w-0 max-w-full truncate">{cancelLabel}</span>
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || disabled}
            className={`min-w-0 max-w-full flex-1 overflow-hidden h-11 rounded-xl font-bold uppercase text-xs tracking-widest ${config.buttonClass}`}
          >
            {loading ? (
              <span className="inline-flex min-w-0 max-w-full items-center justify-center gap-2 overflow-hidden">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                <span className="min-w-0 truncate">Procesando…</span>
              </span>
            ) : (
              <span className="min-w-0 max-w-full truncate">{confirmLabel}</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
