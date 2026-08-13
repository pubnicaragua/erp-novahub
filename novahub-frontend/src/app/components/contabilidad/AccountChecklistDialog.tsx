import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Loader2, Check, Settings2, Trash2, RotateCcw } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type?: string;
  isLeaf?: boolean;
  children?: ChartAccount[];
}

interface AccountChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título de la vista (se muestra como "Configuración · {viewLabel}"). */
  viewLabel: string;
  description: string;
  /** Clave de configuración donde se guardan los IDs (p.ej. trialBalanceAccountIds). */
  configKey: string;
  /** Tipos de cuenta permitidos (vacío = todos). */
  allowedTypes?: string[];
  onSaved?: () => void;
}

function flattenAccounts(accounts: ChartAccount[]): ChartAccount[] {
  const out: ChartAccount[] = [];
  const walk = (items: ChartAccount[]) => {
    for (const item of items || []) {
      const hasChildren = Array.isArray(item.children) && item.children.length > 0;
      out.push({ ...item, isLeaf: !hasChildren, children: undefined });
      if (hasChildren) walk(item.children as ChartAccount[]);
    }
  };
  walk(accounts || []);
  return out;
}

/**
 * Diálogo de configuración reutilizable: permite marcar con checks las
 * cuentas del catálogo completo que alimentan una vista (balance de
 * comprobación, etc.). Las cuentas sin marcar se ocultan de la vista.
 */
export function AccountChecklistDialog({
  open,
  onOpenChange,
  viewLabel,
  description,
  configKey,
  allowedTypes,
  onSaved,
}: AccountChecklistDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [hasSavedConfig, setHasSavedConfig] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  const accountsQuery = useAccountingQuery<ChartAccount[] | null>(
    ['chart-accounts-checklist', configKey],
    async (signal) => {
      const raw: any = await contabilidadService.getChartOfAccounts(true, signal);
      return Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    },
    { enabled: open },
  );

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setSearchTerm('');
    setHasSavedConfig(false);
    setConfigLoaded(false);
    (async () => {
      try {
        const cfg: any = await contabilidadService.getConfig();
        const saved = (cfg?.config?.[configKey] || []) as string[];
        if (Array.isArray(saved) && saved.length > 0) {
          setSelectedIds(new Set(saved));
          setHasSavedConfig(true);
        } else {
          // Sin configuración guardada: el reporte muestra TODAS las cuentas,
          // así que el diálogo arranca con todas marcadas (se poblan cuando
          // termina de cargar el catálogo).
          setSelectedIds(new Set());
          setHasSavedConfig(false);
        }
      } catch {
        setSelectedIds(new Set());
        setHasSavedConfig(false);
      } finally {
        setConfigLoaded(true);
      }
    })();
  }, [open, configKey]);

  const allAccounts = useMemo(() => {
    const raw = accountsQuery.data || [];
    return flattenAccounts(raw as ChartAccount[]);
  }, [accountsQuery.data]);

  const candidates = useMemo(() => {
    const types = allowedTypes?.length ? new Set(allowedTypes) : null;
    return allAccounts.filter((a) => a.isLeaf && (!types || types.has(String(a.type || '').toUpperCase())));
  }, [allAccounts, allowedTypes]);

  // Sin configuración guardada, el reporte muestra todas las cuentas: se
  // marcan todas cuando la configuración terminó de cargar y el catálogo está
  // listo, para que el usuario vea con check exactamente lo que ya aparece.
  // (El flag configLoaded evita el parpadeo "todas → guardadas" cuando la
  // consulta de configuración tarda más que el catálogo en caché.)
  useEffect(() => {
    if (!open || !configLoaded || hasSavedConfig || candidates.length === 0) return;
    if (selectedIds.size === 0) {
      setSelectedIds(new Set(candidates.map((a) => a.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, configLoaded, hasSavedConfig, candidates]);

  const visible = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return term
      ? candidates.filter((a) => a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term))
      : candidates;
  }, [candidates, searchTerm]);

  const toggle = (accountId: string) => {
    setTouched(true);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const selectAll = () => {
    setTouched(true);
    setSelectedIds(new Set(candidates.map((a) => a.id)));
  };

  const selectNone = () => {
    setTouched(true);
    setSelectedIds(new Set());
  };

  const save = async () => {
    setSaving(true);
    try {
      await contabilidadService.updateConfig({ [configKey]: Array.from(selectedIds) });
      toast.success(`Configuración de ${viewLabel} guardada`);
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] !max-w-[min(96vw,880px)] overflow-hidden rounded-3xl border-primary/20 bg-background/95 p-0 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-br from-primary/[0.10] via-background to-emerald-500/[0.06] px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-3 text-lg font-black uppercase tracking-tight">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Settings2 className="size-5" />
            </span>
            Configuración · {viewLabel}
          </DialogTitle>
          <DialogDescription className="mt-1 max-w-3xl text-xs leading-relaxed">{description}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(92vh-140px)] overflow-y-auto px-6 py-5">
          {accountsQuery.isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" /> Cargando catálogo de cuentas...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={`Buscar en ${candidates.length} cuentas por código o nombre...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black text-primary">
                  {selectedIds.size} de {candidates.length} cuentas
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" className="h-7 gap-1 text-[10px] font-black uppercase tracking-widest" onClick={selectAll}>
                  <Check className="size-3" /> Marcar todas
                </Button>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-600" onClick={selectNone}>
                  <Trash2 className="size-3" /> Quitar todas
                </Button>
              </div>
              <div className="grid max-h-[46vh] grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-border/50 p-2 pr-1 sm:grid-cols-2 lg:grid-cols-3">
                {visible.length === 0 ? (
                  <p className="col-span-full py-6 text-center text-xs italic text-muted-foreground/60">
                    Sin cuentas que coincidan con la búsqueda
                  </p>
                ) : (
                  visible.map((account) => {
                    const selected = selectedIds.has(account.id);
                    return (
                      <label
                        key={account.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                          selected ? 'border-primary/50 bg-primary/10' : 'border-border/50 hover:bg-muted/40',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-3.5 accent-primary"
                          checked={selected}
                          onChange={() => toggle(account.id)}
                        />
                        <span className="min-w-0">
                          <span className="block font-mono text-[10px] text-muted-foreground">{account.code}</span>
                          <span className="block truncate font-medium">{account.name}</span>
                        </span>
                        {selected && <Check className="ml-auto size-3.5 shrink-0 text-primary" />}
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-4">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Solo se muestran cuentas de detalle: las agrupadoras se omiten para no repetir movimientos.
              Una cuenta sin marcar se oculta del reporte.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  setSaving(true);
                  try {
                    await contabilidadService.updateConfig({ [configKey]: [] });
                    toast.success(`Modo automático restaurado: ${viewLabel} muestra todas las cuentas`);
                    onSaved?.();
                    onOpenChange(false);
                  } catch (e: any) {
                    toast.error(e?.message || 'No se pudo restablecer la configuración');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="gap-1.5 text-muted-foreground"
                title="Vuelve a mostrar todas las cuentas del catálogo en esta vista"
              >
                <RotateCcw className="size-3.5" /> Modo automático
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving || !touched} className="gap-1.5">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar configuración
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
