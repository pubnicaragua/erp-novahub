import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';
import { AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  children,
}) => {
  const config = variantConfig[variant];

  const handleConfirm = async () => {
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Error handling is done by the caller
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-border/50 bg-background/95 backdrop-blur-xl">
        <div className="flex flex-col items-center text-center px-6 pt-8 pb-4">
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
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

        <DialogFooter className="px-6 pb-6 pt-2 flex gap-3 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading || disabled}
            className="flex-1 h-11 rounded-xl font-bold uppercase text-xs tracking-widest"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || disabled}
            className={`flex-1 h-11 rounded-xl font-bold uppercase text-xs tracking-widest ${config.buttonClass}`}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </div>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
