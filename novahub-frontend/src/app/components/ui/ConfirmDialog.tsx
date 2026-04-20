import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
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
  children,
}) => {
  const config = variantConfig[variant];

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden border-border/50 bg-background/80 backdrop-blur-2xl shadow-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative"
        >
          <div className="flex flex-col items-center text-center px-6 pt-10 pb-4">
            <AnimatePresence mode="wait">
              {open && (
                <motion.div
                  key={variant}
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 45 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`p-4 rounded-full ${config.iconBg} mb-5 shadow-inner`}
                >
                  {variant === 'destructive' && <AlertTriangle className={`size-8 ${config.iconColor}`} />}
                  {variant === 'warning' && <AlertTriangle className={`size-8 ${config.iconColor}`} />}
                  {variant === 'default' && <Info className={`size-8 ${config.iconColor}`} />}
                </motion.div>
              )}
            </AnimatePresence>

            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none">
                {title}
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground max-w-[280px] mx-auto font-medium">
                {description}
              </DialogDescription>
            </DialogHeader>
          </div>

          {children && (
            <div className="px-6 pb-4">
              {children}
            </div>
          )}

          <DialogFooter className="px-6 pb-8 pt-4 flex gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest border-border/50 hover:bg-muted/50 transition-all"
            >
              {cancelLabel}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading}
              className={cn(
                "flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg active:scale-95",
                config.buttonClass
              )}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ...
                </div>
              ) : (
                confirmLabel
              )}
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};
