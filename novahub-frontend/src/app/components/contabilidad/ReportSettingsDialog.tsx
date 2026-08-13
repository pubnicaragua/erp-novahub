import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Settings2, Loader2, Check } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Combobox } from '../ui/Combobox';
import { toast } from 'sonner';
import { contabilidadService } from '../../services/contabilidad.service';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';

export interface ConfigField {
  moduleKey: string;
  fieldKey: string;
  label: string;
  hint?: string;
}

interface ReportSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  fields: ConfigField[];
}

/**
 * Diálogo de configuración contable accesible desde cada vista de reporte:
 * permite ver y corregir la cuenta contable vinculada a cada concepto sin
 * salir de la vista. Los cambios se guardan en la Configuración Contable
 * global (GET/PUT /accounting/config).
 */
export function ReportSettingsDialog({ open, onOpenChange, title, description, fields }: ReportSettingsDialogProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const configQuery = useAccountingQuery<any>(['config'], async (signal) => contabilidadService.getConfig(signal), { enabled: open });
  const accountsQuery = useAccountingQuery<any[]>(['accounts'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(false, signal)), { enabled: open });

  const flatAccounts = useMemo(() => {
    const result: any[] = [];
    const flatten = (items: any[]) => items.forEach(item => {
      const { children, ...rest } = item;
      result.push(rest);
      if (Array.isArray(children)) flatten(children);
    });
    flatten(accountsQuery.data || []);
    return result;
  }, [accountsQuery.data]);

  const accountOptions = useMemo(() => flatAccounts.map(a => ({
    label: `${a.code} · ${a.name}`,
    value: a.id,
    description: a.type,
  })), [flatAccounts]);

  const resolveCode = (code?: string) => {
    if (!code) return '';
    const account = flatAccounts.find(a => String(a.code).toUpperCase() === String(code).toUpperCase());
    return account?.id || '';
  };

  if (open && !loaded && configQuery.data) {
    const mappings = (configQuery.data as any)?.config?.accountMappings || {};
    const next: Record<string, string> = {};
    for (const field of fields) {
      next[`${field.moduleKey}.${field.fieldKey}`] = resolveCode(mappings?.[field.moduleKey]?.[field.fieldKey]);
    }
    setDraft(next);
    setLoaded(true);
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) { setLoaded(false); setDraft({}); }
    onOpenChange(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const accountMappings: Record<string, Record<string, string>> = {};
      for (const field of fields) {
        const account = flatAccounts.find(a => a.id === draft[`${field.moduleKey}.${field.fieldKey}`]);
        const key = `${field.moduleKey}.${field.fieldKey}`;
        if (!accountMappings[field.moduleKey]) accountMappings[field.moduleKey] = {};
        accountMappings[field.moduleKey][field.fieldKey] = account?.code || draft[key] || '';
      }
      await contabilidadService.updateConfig({ config: { accountMappings } });
      toast.success('Configuración contable guardada');
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
      handleOpenChange(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
            <Settings2 className="size-5 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {!loaded && (configQuery.isLoading || accountsQuery.isLoading) && (
            <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando configuración contable...
            </div>
          )}
          {loaded && fields.map(field => {
            const key = `${field.moduleKey}.${field.fieldKey}`;
            const value = draft[key] || '';
            const account = flatAccounts.find(a => a.id === value);
            return (
              <div key={key} className="rounded-xl border border-border/40 bg-muted/10 p-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{field.label}</Label>
                {field.hint && <p className="mb-1 text-[9px] text-muted-foreground/70">{field.hint}</p>}
                <div className="mt-1.5">
                  <Combobox
                    options={accountOptions}
                    value={value}
                    onChange={(v) => setDraft(prev => ({ ...prev, [key]: v }))}
                    placeholder="Seleccionar cuenta contable"
                    searchPlaceholder="Buscar por código o nombre..."
                    maxVisibleOptions={100}
                    className="h-9 text-xs"
                    emptyMessage="No se encontraron cuentas."
                  />
                </div>
                {account && (
                  <p className="mt-1 text-[9px] text-emerald-600">{account.code} · {account.name}</p>
                )}
              </div>
            );
          })}
          {loaded && fields.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">No hay conceptos configurables en esta vista.</p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="rounded-xl text-[10px] font-black uppercase tracking-widest">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !loaded} className="rounded-xl font-black uppercase text-[10px] tracking-widest">
            {saving ? <><Loader2 className="size-3 mr-1 animate-spin" /> Guardando...</> : <><Check className="size-3 mr-1" /> Guardar configuración</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
