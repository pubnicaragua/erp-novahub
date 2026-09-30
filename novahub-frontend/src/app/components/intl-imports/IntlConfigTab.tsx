import React, { useState, useEffect } from 'react';
import { Settings2, Save, Calculator, Ship } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { intlImportsService, type IntlImportConfig } from '../../services/intl-imports.service';

interface IntlConfigTabProps {
  canEdit?: boolean;
}

export function IntlConfigTab({ canEdit = true }: IntlConfigTabProps) {
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
    trackingPrefix: 'CC-',
  });

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
            trackingPrefix: cfg.trackingPrefix || 'CC-',
          });
        }
      })
      .catch((err) => {
        toast.error(getApiErrorMessage(err, 'Error al cargar configuración de importaciones'));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload: IntlImportConfig = {
        volumetricFactorKgPerCbm: parseFloat(formState.volumetricFactorKgPerCbm) || 167,
        defaultContainerCbm: parseFloat(formState.defaultContainerCbm) || 20,
        defaultContainerMaxKg: parseFloat(formState.defaultContainerMaxKg) || 5000,
        trackingPrefix: formState.trackingPrefix.trim() || 'CC-',
      };
      const updated = await intlImportsService.updateConfig(payload);
      setConfig(updated);
      setFormState({
        volumetricFactorKgPerCbm: String(updated.volumetricFactorKgPerCbm),
        defaultContainerCbm: String(updated.defaultContainerCbm),
        defaultContainerMaxKg: String(updated.defaultContainerMaxKg),
        trackingPrefix: updated.trackingPrefix,
      });
      toast.success('Configuración de importaciones internacionales guardada');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al guardar la configuración'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground text-xs">Cargando configuración...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card className="p-6 border-border/70 space-y-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Settings2 className="size-5 text-primary" />
          <div>
            <h3 className="text-base font-bold text-foreground">Parámetros Operativos de Importación</h3>
            <p className="text-xs text-muted-foreground">
              Define los factores de cubicaje, prefijos de tracking y capacidades estándar de contenedores.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Regla de Cubicaje */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="size-4 text-emerald-600 dark:text-emerald-400" />
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
                className="max-w-xs font-mono"
              />
              <span className="text-[11px] text-muted-foreground block mt-1">
                Estándar internacional: 167 kg por metro cúbico (CBM). Factor activo configurado:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className="max-w-xs font-mono font-bold uppercase"
              />
              <span className="text-[11px] text-muted-foreground block mt-1">
                Los paquetes ingresados en bodega origen generarán códigos formateados como: <strong>{formState.trackingPrefix}2026-0001</strong>
              </span>
            </div>
          </div>

          {canEdit && (
            <div className="pt-3 border-t border-border flex justify-end">
              <Button type="submit" disabled={saving}>
                <Save className="size-4 mr-1.5" />
                {saving ? 'Guardando...' : 'Guardar Configuración'}
              </Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
