import { useState } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import { intlImportsService, type IntlImportContainer } from '../../../services/intl-imports.service';

interface CloseContainerModalProps {
  container: IntlImportContainer | null;
  totalExpenses: number;
  totalVolume: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CloseContainerModal({
  container,
  totalExpenses,
  totalVolume,
  open,
  onOpenChange,
  onSuccess,
}: CloseContainerModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  if (!container) return null;

  const costPerCbm = totalVolume > 0 ? totalExpenses / totalVolume : 0;

  const handleClose = async () => {
    if (confirmText.trim() !== 'CERRAR') {
      toast.error('Escribe la palabra CERRAR para confirmar');
      return;
    }

    try {
      setLoading(true);
      await intlImportsService.closeAndProrateContainer(container.id);
      toast.success(`Contenedor ${container.containerNumber} cerrado y prorrateado exitosamente`);
      onSuccess();
      onOpenChange(false);
      setConfirmText('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al cerrar el contenedor'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive font-semibold">
            <AlertTriangle className="size-5" />
            <DialogTitle>Cierre Definitivo de Contenedor</DialogTitle>
          </div>
          <DialogDescription>
            Esta acción calculará el costo por CBM definitivo y actualizará los costos prorrateados de todos sus paquetes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="bg-destructive/10 border border-destructive/30 text-destructive dark:text-red-400 p-3 rounded-lg space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="size-4 shrink-0" /> ¡Atención! Acción Irreversible
            </div>
            <p className="text-[11px] opacity-90">
              Una vez cerrado el contenedor <strong>{container.containerNumber}</strong>, no se podrán agregar más gastos ni modificar paquetes contenidos.
            </p>
          </div>

          <div className="bg-muted/40 p-3 rounded-lg border border-border/60 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-sans">Gastos Acumulados:</span>
              <span className="font-bold text-foreground">${totalExpenses.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-sans">Volumen Ocupado:</span>
              <span className="font-bold text-foreground">{totalVolume.toFixed(3)} CBM</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-border/40 font-sans">
              <span className="font-semibold text-foreground">Costo por CBM Líquido:</span>
              <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                ${costPerCbm.toFixed(2)} USD / CBM
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Para confirmar, escribe la palabra <strong className="text-foreground">CERRAR</strong> a continuación:
            </label>
            <Input
              placeholder="CERRAR"
              className="font-mono text-center font-bold tracking-widest uppercase"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleClose}
            disabled={loading || confirmText.trim() !== 'CERRAR'}
          >
            {loading ? 'Aplicando Prorrateo...' : 'Confirmar Cierre y Prorrateo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
