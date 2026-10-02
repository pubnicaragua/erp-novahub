import React, { useState, useEffect, useCallback } from 'react';
import { Settings2, Save, Calculator, Ship, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  intlImportsService,
  type IntlImportConfig,
  type IntlVolumetricFactor,
} from '../../services/intl-imports.service';

interface IntlConfigTabProps {
  canEdit?: boolean;
  canCreate?: boolean;
  canDelete?: boolean;
}

const EMPTY_FACTOR = {
  label: '',
  originCountry: '',
  transportMode: '',
  carrier: '',
  factorKgPerCbm: '',
  priority: '0',
};

export function IntlConfigTab({ canEdit = true, canCreate = false, canDelete = false }: IntlConfigTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<IntlImportConfig>({
    volumetricFactorKgPerCbm: 167,
    defaultContainerCbm: 20,
    defaultContainerMaxKg: 5000,
    trackingPrefix: 'CC-',
  });
  const [formState, setFormState] = useState({
    volumetricFactorKgPerCbm: '167',
    defaultContainerCbm: '20',
    defaultContainerMaxKg: '5000',
    minCloseCbm: '',
    minCloseWeightKg: '',
    closureRule: 'ANY',
    trackingPrefix: 'CC-',
  });

  // Reglas de factor volumetrico
  const [factors, setFactors] = useState<IntlVolumetricFactor[]>([]);
  const [factorForm, setFactorForm] = useState(EMPTY_FACTOR);
  const [factorSaving, setFactorSaving] = useState(false);
  const [editingFactorId, setEditingFactorId] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    try {
      setFactors(await intlImportsService.listVolumetricFactors(true));
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Error al cargar las reglas volumétricas'));
    }
  }, []);

  useEffect(() => {
    intlImportsService
      .getConfig()
      .then((cfg) => {
        if (cfg) {
          setConfig(cfg);
          setFormState({
            volumetricFactorKgPerCbm: String(cfg.volumetricFactorKgPerCbm ?? 167),
            defaultContainerCbm: String(cfg.defaultContainerCbm ?? 20),
            defaultContainerMaxKg: String(cfg.defaultContainerMaxKg ?? 5000),
            minCloseCbm: cfg.minCloseCbm != null ? String(cfg.minCloseCbm) : '',
            minCloseWeightKg: cfg.minCloseWeightKg != null ? String(cfg.minCloseWeightKg) : '',
            closureRule: cfg.closureRule === 'BOTH' ? 'BOTH' : 'ANY',
            trackingPrefix: cfg.trackingPrefix || 'CC-',
          });
        }
      })
      .catch((err) => {
        toast.error(getApiErrorMessage(err, 'Error al cargar configuración de importaciones'));
      })
      .finally(() => setLoading(false));

    // Las reglas volumetricas son parte de la misma pantalla de configuracion.
    intlImportsService
      .listVolumetricFactors(true)
      .then((list) => setFactors(list || []))
      .catch((err) => toast.error(getApiErrorMessage(err, 'Error al cargar las reglas volumétricas')));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const parsedMinCbm = formState.minCloseCbm.trim() !== '' ? parseFloat(formState.minCloseCbm) : undefined;
      const parsedMinKg = formState.minCloseWeightKg.trim() !== '' ? parseFloat(formState.minCloseWeightKg) : undefined;
      const payload: IntlImportConfig = {
        volumetricFactorKgPerCbm: parseFloat(formState.volumetricFactorKgPerCbm) || 167,
        defaultContainerCbm: parseFloat(formState.defaultContainerCbm) || 20,
        defaultContainerMaxKg: parseFloat(formState.defaultContainerMaxKg) || 5000,
        minCloseCbm: Number.isFinite(parsedMinCbm) ? parsedMinCbm : undefined,
        minCloseWeightKg: Number.isFinite(parsedMinKg) ? parsedMinKg : undefined,
        closureRule: formState.closureRule === 'BOTH' ? 'BOTH' : 'ANY',
        trackingPrefix: formState.trackingPrefix.trim() || 'CC-',
      };
      const updated = await intlImportsService.updateConfig(payload);
      setConfig(updated);
      setFormState({
        volumetricFactorKgPerCbm: String(updated.volumetricFactorKgPerCbm),
        defaultContainerCbm: String(updated.defaultContainerCbm),
        defaultContainerMaxKg: String(updated.defaultContainerMaxKg),
        minCloseCbm: updated.minCloseCbm != null ? String(updated.minCloseCbm) : '',
        minCloseWeightKg: updated.minCloseWeightKg != null ? String(updated.minCloseWeightKg) : '',
        closureRule: updated.closureRule === 'BOTH' ? 'BOTH' : 'ANY',
        trackingPrefix: updated.trackingPrefix,
      });
      toast.success('Configuración de importaciones internacionales guardada');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al guardar la configuración'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    const factor = parseFloat(factorForm.factorKgPerCbm);
    if (!factorForm.label.trim()) {
      toast.error('Indique un nombre para la regla');
      return;
    }
    if (!Number.isFinite(factor) || factor <= 0) {
      toast.error('El factor debe ser mayor a 0 kg/CBM');
      return;
    }

    const payload = {
      label: factorForm.label.trim(),
      originCountry: factorForm.originCountry.trim().toUpperCase() || undefined,
      transportMode: factorForm.transportMode || undefined,
      carrier: factorForm.carrier.trim().toUpperCase() || undefined,
      factorKgPerCbm: factor,
      priority: parseInt(factorForm.priority, 10) || 0,
    };

    try {
      setFactorSaving(true);
      if (editingFactorId) {
        await intlImportsService.updateVolumetricFactor(editingFactorId, payload);
        toast.success('Regla volumétrica actualizada');
      } else {
        await intlImportsService.createVolumetricFactor(payload);
        toast.success('Regla volumétrica creada');
      }
      setFactorForm(EMPTY_FACTOR);
      setEditingFactorId(null);
      await loadFactors();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al guardar la regla volumétrica'));
    } finally {
      setFactorSaving(false);
    }
  };

  const handleEditFactor = (factor: IntlVolumetricFactor) => {
    setEditingFactorId(factor.id);
    setFactorForm({
      label: factor.label,
      originCountry: factor.originCountry || '',
      transportMode: factor.transportMode || '',
      carrier: factor.carrier || '',
      factorKgPerCbm: String(factor.factorKgPerCbm),
      priority: String(factor.priority ?? 0),
    });
  };

  const handleDeleteFactor = async (factor: IntlVolumetricFactor) => {
    try {
      const res = await intlImportsService.deleteVolumetricFactor(factor.id);
      toast.success(
        res.deactivated
          ? 'La regla se desactivó: ya tiene paquetes facturados y no se puede eliminar.'
          : 'Regla volumétrica eliminada',
      );
      await loadFactors();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al eliminar la regla volumétrica'));
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground text-xs">Cargando configuración...</div>;
  }

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-6">
      <Card className="p-4 sm:p-6 border-border/70 space-y-5 sm:space-y-6">
        <div className="flex items-start sm:items-center gap-2.5 border-b border-border pb-3">
          <Settings2 className="size-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">Parámetros Operativos de Importación</h3>
            <p className="text-xs text-muted-foreground">
              Define los factores de cubicaje, prefijos de tracking y capacidades estándar de contenedores.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Regla de Cubicaje */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="size-4 text-primary" />
              Factor Volumétrico IATA / Marítimo
            </h4>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Factor de conversión (kg / CBM)
              </label>
              <Input
                type="text"
                inputMode="numeric"
                disabled={!canEdit}
                value={formState.volumetricFactorKgPerCbm}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    volumetricFactorKgPerCbm: e.target.value,
                  }))
                }
                className="w-full sm:max-w-xs font-mono"
              />
              <span className="text-[11px] text-muted-foreground block mt-1">
                Estándar internacional: 167 kg por metro cúbico (CBM). Factor activo configurado:{' '}
                <strong className="text-primary font-mono">
                  {config.volumetricFactorKgPerCbm} kg/CBM
                </strong>. Usado para calcular el Peso Cobrable.
              </span>
            </div>
          </div>

          {/* Capacidades Estándar de Contenedor */}
          <div className="space-y-3 border-t border-border/50 pt-4">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Ship className="size-4 text-primary" />
              Límites Estándar por Contenedor
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Capacidad Volumétrica Predeterminada (CBM)
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  disabled={!canEdit}
                  value={formState.defaultContainerCbm}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      defaultContainerCbm: e.target.value,
                    }))
                  }
                  className="font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Límite Máximo de Carga (kg)
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  disabled={!canEdit}
                  value={formState.defaultContainerMaxKg}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      defaultContainerMaxKg: e.target.value,
                    }))
                  }
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  CBM Mínimo para Cerrar
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  disabled={!canEdit}
                  value={formState.minCloseCbm}
                  placeholder="Sin mínimo"
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, minCloseCbm: e.target.value }))
                  }
                  className="font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Peso Mínimo para Cerrar (kg)
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  disabled={!canEdit}
                  value={formState.minCloseWeightKg}
                  placeholder="Sin mínimo"
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, minCloseWeightKg: e.target.value }))
                  }
                  className="font-mono"
                />
              </div>
            </div>
            <span className="text-[11px] text-muted-foreground block">
              Si no se define ningún mínimo, el contenedor puede cerrarse con cualquier cantidad
              consolidada. La regla de cierre se compara con los{' '}
              <strong className="font-mono">CBM facturables</strong>, no con el volumen físico.
            </span>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Regla de Cierre
              </label>
              <select
                disabled={!canEdit}
                value={formState.closureRule}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, closureRule: e.target.value }))
                }
                className="w-full sm:max-w-sm h-9 rounded-md border border-input bg-background px-3 text-xs sm:text-sm text-foreground disabled:opacity-50"
              >
                <option value="ANY">Cualquiera de los criterios se cumple (CBM o Peso)</option>
                <option value="BOTH">Ambos criterios deben cumplirse (CBM y Peso)</option>
              </select>
            </div>
          </div>

          {/* Identificadores */}
          <div className="space-y-3 border-t border-border/50 pt-4">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Prefijos de Código de Tracking</h4>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Prefijo Identificador de Importación Internacional
              </label>
              <Input
                disabled={!canEdit}
                value={formState.trackingPrefix}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    trackingPrefix: e.target.value,
                  }))
                }
                className="w-full sm:max-w-xs font-mono font-bold uppercase"
              />
              <span className="text-[11px] text-muted-foreground block mt-1">
                Los paquetes ingresados en bodega origen generarán códigos formateados como: <strong>{formState.trackingPrefix}2026-0001</strong>
              </span>
            </div>
          </div>

          {canEdit && (
            <div className="pt-3 border-t border-border flex justify-end">
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                <Save className="size-4 mr-1.5" />
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </Button>
            </div>
          )}
        </form>
      </Card>

      <Card className="p-4 sm:p-6 border-border/70 space-y-4 sm:space-y-5">
        <div className="flex items-start sm:items-center gap-2.5 border-b border-border pb-3">
          <Calculator className="size-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">Reglas de Factor Volumétrico</h3>
            <p className="text-xs text-muted-foreground">
              El backend resuelve el factor por especificidad (país + transporte + transportista) y,
              a igualdad, por mayor prioridad. Si ninguna regla aplica usa el factor global de
              configuración.
            </p>
          </div>
        </div>

        {(canCreate || canEdit) && (
          <form onSubmit={handleSaveFactor} className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="size-3.5" />
              {editingFactorId ? 'Editar regla' : 'Nueva regla'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">Nombre</label>
                <Input
                  value={factorForm.label}
                  onChange={(e) => setFactorForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder="Ej. Marítimo Panamá"
                  className="h-9 sm:h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Factor (kg/CBM)
                </label>
                <Input
                  value={factorForm.factorKgPerCbm}
                  onChange={(e) => setFactorForm((p) => ({ ...p, factorKgPerCbm: e.target.value }))}
                  placeholder="167"
                  className="h-9 sm:h-8 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">Prioridad</label>
                <Input
                  value={factorForm.priority}
                  onChange={(e) => setFactorForm((p) => ({ ...p, priority: e.target.value }))}
                  placeholder="0"
                  className="h-9 sm:h-8 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  País de origen
                </label>
                <Input
                  value={factorForm.originCountry}
                  onChange={(e) => setFactorForm((p) => ({ ...p, originCountry: e.target.value }))}
                  placeholder="Ej. PANAMA o US (opcional)"
                  className="h-9 sm:h-8 font-mono text-xs uppercase"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Modo de transporte
                </label>
                <select
                  value={factorForm.transportMode}
                  onChange={(e) => setFactorForm((p) => ({ ...p, transportMode: e.target.value }))}
                  className="h-9 sm:h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground"
                >
                  <option value="">Todos (opcional)</option>
                  <option value="MARITIMO">Marítimo (MARITIMO)</option>
                  <option value="AEREO">Aéreo (AEREO)</option>
                  <option value="TERRESTRE">Terrestre (TERRESTRE)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Transportista
                </label>
                <Input
                  value={factorForm.carrier}
                  onChange={(e) => setFactorForm((p) => ({ ...p, carrier: e.target.value }))}
                  placeholder="Ej. MAEU (opcional)"
                  className="h-9 sm:h-8 font-mono text-xs uppercase"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              {editingFactorId && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setEditingFactorId(null);
                    setFactorForm(EMPTY_FACTOR);
                  }}
                >
                  Cancelar
                </Button>
              )}
              <Button type="submit" size="sm" disabled={factorSaving} className="w-full sm:w-auto">
                {factorSaving ? 'Guardando...' : editingFactorId ? 'Actualizar regla' : 'Crear regla'}
              </Button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {factors.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              No hay reglas registradas. Se usará el factor global de configuración.
            </div>
          ) : (
            factors.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5 text-xs"
              >
                <span className="font-semibold text-foreground">{f.label}</span>
                <span className="font-mono font-bold text-primary">
                  {f.factorKgPerCbm} kg/CBM
                </span>
                <span className="text-muted-foreground">prio {f.priority}</span>
                {f.originCountry && <Badge variant="outline">{f.originCountry}</Badge>}
                {f.transportMode && <Badge variant="outline">{f.transportMode}</Badge>}
                {f.carrier && <Badge variant="outline">{f.carrier}</Badge>}
                {!f.isActive && <Badge variant="secondary">Inactiva</Badge>}
                <span className="flex-1" />
                <div className="flex items-center gap-1 ml-auto">
                  {canEdit && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleEditFactor(f)}>
                      Editar
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteFactor(f)}
                      title="Si la regla ya tiene paquetes facturados se desactivará en lugar de eliminarse"
                      aria-label={`Eliminar regla ${f.label}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
