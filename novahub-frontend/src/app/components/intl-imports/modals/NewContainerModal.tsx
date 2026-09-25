import React, { useState, useEffect } from 'react';
import { Boxes } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { DateField } from '../../ui/DateField';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import { intlImportsService, type IntlImportContainer } from '../../../services/intl-imports.service';

interface NewContainerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (created: IntlImportContainer) => void;
  defaultCbm?: number;
  defaultMaxKg?: number;
}

export function NewContainerModal({
  open,
  onOpenChange,
  onSuccess,
  defaultCbm = 20,
  defaultMaxKg = 5000,
}: NewContainerModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    containerNumber: '',
    origin: 'Bodega Origen',
    destination: 'Nicaragua',
    sealNumber: '',
    maxCapacityCbm: defaultCbm,
    maxWeightKg: defaultMaxKg,
    estimatedDeparture: '',
    estimatedArrival: '',
  });

  useEffect(() => {
    if (open) {
      setForm((prev) => ({
        ...prev,
        maxCapacityCbm: prev.maxCapacityCbm || defaultCbm,
        maxWeightKg: prev.maxWeightKg || defaultMaxKg,
      }));
    }
  }, [open, defaultCbm, defaultMaxKg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.containerNumber.trim()) {
      toast.error('El número de contenedor es obligatorio');
      return;
    }

    try {
      setLoading(true);
      const created = await intlImportsService.createContainer({
        containerNumber: form.containerNumber.trim().toUpperCase(),
        origin: form.origin.trim() || 'Bodega Origen',
        destination: form.destination.trim() || 'Nicaragua',
        sealNumber: form.sealNumber.trim() || undefined,
        maxCapacityCbm: form.maxCapacityCbm || defaultCbm,
        maxWeightKg: form.maxWeightKg || defaultMaxKg,
        estimatedDeparture: form.estimatedDeparture || undefined,
        estimatedArrival: form.estimatedArrival || undefined,
        status: 'OPEN',
      });

      toast.success(`Contenedor ${created.containerNumber} creado exitosamente`);
      onSuccess(created);
      onOpenChange(false);
      setForm({
        containerNumber: '',
        origin: 'Bodega Origen',
        destination: 'Nicaragua',
        sealNumber: '',
        maxCapacityCbm: defaultCbm,
        maxWeightKg: defaultMaxKg,
        estimatedDeparture: '',
        estimatedArrival: '',
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al crear contenedor'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Boxes className="size-5 text-sky-600 dark:text-sky-400" />
            <DialogTitle>Nuevo Contenedor / Consolidado</DialogTitle>
          </div>
          <DialogDescription>
            Abre un nuevo lote o contenedor para consolidación de paquetes de importación.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Identificador / Número de Contenedor *
            </label>
            <Input
              required
              placeholder="Ej. CONT-2026-001 o MSCU1234567"
              value={form.containerNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, containerNumber: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Origen
              </label>
              <Input
                placeholder="Ej. Bodega Origen / Panamá"
                value={form.origin}
                onChange={(e) => setForm((prev) => ({ ...prev, origin: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Destino
              </label>
              <Input
                placeholder="Ej. Nicaragua"
                value={form.destination}
                onChange={(e) => setForm((prev) => ({ ...prev, destination: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Número de Sello / Precinto (Opcional)
            </label>
            <Input
              placeholder="Ej. SEAL-88992"
              value={form.sealNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, sealNumber: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Capacidad CBM Máx *
              </label>
              <Input
                type="number"
                step="any"
                min="0"
                required
                value={form.maxCapacityCbm}
                onChange={(e) => setForm((prev) => ({ ...prev, maxCapacityCbm: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Peso Límite de Carga (kg) *
              </label>
              <Input
                type="number"
                step="any"
                min="0"
                required
                value={form.maxWeightKg}
                onChange={(e) => setForm((prev) => ({ ...prev, maxWeightKg: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                ETD Salida Estimada
              </label>
              <DateField
                value={form.estimatedDeparture}
                onChange={(v) => setForm((prev) => ({ ...prev, estimatedDeparture: v }))}
                placeholder="Seleccione ETD"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                ETA Llegada Estimada
              </label>
              <DateField
                value={form.estimatedArrival}
                onChange={(v) => setForm((prev) => ({ ...prev, estimatedArrival: v }))}
                placeholder="Seleccione ETA"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Contenedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
