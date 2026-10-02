import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  intlImportsService,
  type IntlImportContainer,
  type MoveSimulationResult,
} from '../../../services/intl-imports.service';

interface MovePackagesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contenedor origen: solo se ofrecen como destino los distintos de este. */
  sourceContainer: IntlImportContainer | null;
  packageIds: string[];
  onSuccess: () => void;
}

export function MovePackagesModal({
  open,
  onOpenChange,
  sourceContainer,
  packageIds,
  onSuccess,
}: MovePackagesModalProps) {
  const [containers, setContainers] = useState<IntlImportContainer[]>([]);
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [simulation, setSimulation] = useState<MoveSimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    // El reset ocurre en handleOpenChange al abrir; aqui solo se carga el catalogo.
    intlImportsService
      .listContainers()
      .then((list) => setContainers((list || []).filter((c) => c.id !== sourceContainer?.id && !c.isClosed)))
      .catch((err) => toast.error(getApiErrorMessage(err, 'Error al cargar los contenedores disponibles')));
  }, [open, sourceContainer?.id]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        setTargetId('');
        setReason('');
        setSimulation(null);
        setError('');
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const handleSimulate = useCallback(async () => {
    if (!targetId) {
      setError('Seleccione el contenedor de destino');
      return;
    }
    setSimulating(true);
    setError('');
    try {
      setSimulation(await intlImportsService.simulateMove({ targetContainerId: targetId, packageIds, reason }));
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'No se pudo simular el movimiento'));
    } finally {
      setSimulating(false);
    }
  }, [targetId, packageIds, reason]);

  const handleConfirm = useCallback(async () => {
    if (!simulation) return;
    setSaving(true);
    try {
      const res = await intlImportsService.movePackages({
        targetContainerId: targetId,
        packageIds,
        reason,
      });
      toast.success(`${res.moved} paquete(s) movido(s) a ${simulation.target.containerNumber}`);
      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'No se pudo mover los paquetes'));
    } finally {
      setSaving(false);
    }
  }, [simulation, targetId, packageIds, reason, onSuccess, handleOpenChange]);

  const target = containers.find((c) => c.id === targetId);
  // `allowed` es la decision del servidor; no se re-deriva aqui.
  const blocked = !!simulation && !simulation.allowed;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="size-4" />
            Mover paquetes
          </DialogTitle>
          <DialogDescription>
            {packageIds.length} paquete(s) desde {sourceContainer?.containerNumber ?? 'el contenedor origen'}.
            La simulación no escribe nada; el backend valida capacidad y estado del destino.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Contenedor de destino
            </label>
            <select
              value={targetId}
              onChange={(e) => {
                setTargetId(e.target.value);
                setSimulation(null);
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">Seleccione un contenedor abierto</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.containerNumber} · {c.totalBillableCbm?.toFixed(2) ?? 0}/{c.capacityCbm || c.maxCapacityCbm} CBM
                </option>
              ))}
            </select>
            {containers.length === 0 && (
              <span className="text-[11px] text-muted-foreground block mt-1">
                No hay otros contenedores abiertos disponibles.
              </span>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Motivo del movimiento
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Corrección de consolidado"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleSimulate} disabled={!targetId || simulating}>
              {simulating ? 'Simulando...' : 'Simular movimiento'}
            </Button>
            {simulation && !blocked && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="size-3.5" />
                Sin violaciones
              </span>
            )}
          </div>

          {error && <div className="text-[11px] text-destructive">{error}</div>}

          {simulation && (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-muted-foreground">Contenedor destino</span>
                <span>{simulation.target.containerNumber}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-muted-foreground">Paquetes</span>
                <span>
                  {simulation.target.packagesMovingIn} entran
                  {simulation.target.packagesMovingOut > 0 && `, ${simulation.target.packagesMovingOut} salen`}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-muted-foreground">CBM facturables</span>
                <span>
                  {simulation.target.currentBillableCbm.toFixed(2)} →{' '}
                  {simulation.target.projectedBillableCbm.toFixed(2)}
                  {simulation.target.capacityCbm != null && ` / ${simulation.target.capacityCbm}`}
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-muted-foreground">Peso real</span>
                <span>
                  {simulation.target.currentWeightKg.toFixed(1)} → {simulation.target.projectedWeightKg.toFixed(1)} kg
                </span>
              </div>

              {simulation.violations.map((v) => (
                <div key={v} className="text-destructive flex items-start gap-1.5">
                  <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                  {v}
                </div>
              ))}

              <div className="pt-1 border-t border-border/50 space-y-1">
                {simulation.packages.map((p) => (
                  <div key={p.id} className="flex justify-between font-mono text-[11px]">
                    <span>{p.trackingCode}</span>
                    <span className="text-muted-foreground">{p.billableCbm.toFixed(4)} CBM fact.</span>
                  </div>
                ))}
              </div>

              {target && (
                <Badge variant="secondary">
                  Destino {simulation.target.containerNumber} ({target.status})
                </Badge>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!simulation || blocked || saving}>
            {saving ? 'Moviendo...' : 'Confirmar movimiento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
