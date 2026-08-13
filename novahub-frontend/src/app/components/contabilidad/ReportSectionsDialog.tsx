import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Plus, Trash2, Loader2, Settings2, Check, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';

export interface ReportSection {
  id: string;
  label: string;
  sign: string;
  accountIds: string[];
}

export interface ReportSign {
  value: string;
  label: string;
  accountTypes: string[];
}

interface ReportSectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  /** Clave de configuración donde se guardan las secciones. */
  configKey?: string;
  /** Título del reporte (se muestra como "Configuración · {title}"). */
  title?: string;
  /** Tipos de sección permitidos (signs). */
  signs?: ReportSign[];
  /** Secciones por defecto cuando no hay configuración guardada. */
  defaultSections?: ReportSection[];
  /** Descripción del diálogo. */
  description?: string;
}

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type?: string;
  isLeaf?: boolean;
  children?: ChartAccount[];
}

const DEFAULT_SECTIONS: ReportSection[] = [
  { id: 'ingresos-ventas', label: 'Ingresos por ventas', sign: 'INCOME', accountIds: [] },
  { id: 'costo-ventas', label: 'Costo de ventas', sign: 'EXPENSE', accountIds: [] },
  { id: 'gastos-administracion', label: 'Gastos de administración', sign: 'EXPENSE', accountIds: [] },
  { id: 'gastos-venta', label: 'Gastos de venta', sign: 'EXPENSE', accountIds: [] },
  { id: 'gastos-financieros', label: 'Gastos financieros', sign: 'EXPENSE', accountIds: [] },
  { id: 'otros-ingresos', label: 'Otros ingresos', sign: 'INCOME', accountIds: [] },
  { id: 'otros-gastos', label: 'Otros gastos', sign: 'EXPENSE', accountIds: [] },
];

const DEFAULT_SIGNS: ReportSign[] = [
  { value: 'INCOME', label: 'Ingresos', accountTypes: ['INCOME'] },
  { value: 'EXPENSE', label: 'Gastos', accountTypes: ['EXPENSE'] },
];

const SIGN_BADGE_STYLES: Record<string, string> = {
  INCOME: 'border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  EXPENSE: 'border-rose-300 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  ASSET: 'border-sky-300 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  LIABILITY: 'border-amber-300 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  EQUITY: 'border-indigo-300 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
};

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

export function ReportSectionsDialog({ open, onOpenChange, onSaved, configKey = 'profitLossSections', title = 'Estado de Resultados', signs = DEFAULT_SIGNS, defaultSections = DEFAULT_SECTIONS, description }: ReportSectionsDialogProps) {
  const [sections, setSections] = useState<ReportSection[]>(defaultSections);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  // Refs para leer las props sin disparar el efecto de carga en cada render
  // del padre (defaultSections/signs pueden ser literales nuevas).
  const defaultSectionsRef = useRef(defaultSections);
  const signsRef = useRef(signs);
  useEffect(() => { defaultSectionsRef.current = defaultSections; });
  useEffect(() => { signsRef.current = signs; });

  const accountsQuery = useAccountingQuery<ChartAccount[] | null>(
    ['chart-accounts-for-sections', configKey],
    async (signal) => {
      const raw: any = await contabilidadService.getChartOfAccounts(true, signal);
      return Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    },
    { enabled: open },
  );

  const allAccounts = useMemo(() => {
    const raw = accountsQuery.data || [];
    return flattenAccounts(raw as ChartAccount[]);
  }, [accountsQuery.data]);

  const candidatesBySign = useMemo(() => {
    const bySign: Record<string, ChartAccount[]> = {};
    for (const sign of signs) {
      const types = new Set(sign.accountTypes);
      bySign[sign.value] = allAccounts.filter((a) => a.isLeaf && types.has(String(a.type || '').toUpperCase()));
    }
    return bySign;
  }, [allAccounts, signs]);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setConfigLoaded(false);
    const defaults = defaultSectionsRef.current;
    const availableSigns = signsRef.current;
    (async () => {
      try {
        const cfg: any = await contabilidadService.getConfig();
        const saved = (cfg?.config?.[configKey] || []) as ReportSection[];
        if (Array.isArray(saved) && saved.length > 0 && saved.some((s) => Array.isArray(s.accountIds) && s.accountIds.length > 0)) {
          setSections(saved.map((s) => ({
            id: s.id || `section-${Math.random().toString(36).slice(2, 8)}`,
            label: s.label || 'Sección',
            sign: availableSigns.some((sg) => sg.value === String(s.sign || '').toUpperCase()) ? String(s.sign || '').toUpperCase() : availableSigns[0]?.value,
            accountIds: Array.isArray(s.accountIds) ? s.accountIds : [],
          })));
        } else {
          // Sin secciones guardadas el reporte muestra TODAS las cuentas del
          // catálogo: las secciones por defecto arrancan con todas marcadas
          // para reflejar exactamente lo que ya aparece.
          setSections(defaults.map((s) => ({ ...s, accountIds: [] })));
        }
      } catch {
        setSections(defaults.map((s) => ({ ...s, accountIds: [] })));
      } finally {
        setConfigLoaded(true);
      }
    })();
  }, [open, configKey]);

  // Cuando no hay configuración guardada, se marcan todas las cuentas del
  // catálogo en cuanto este termina de cargar (lo que ya muestra el reporte).
  // El flag configLoaded evita el parpadeo "todas → guardadas" y que el
  // efecto sobreescriba secciones a medio marcar cuando el padre re-renderiza.
  useEffect(() => {
    if (!open || !configLoaded || !accountsQuery.data) return;
    setSections((current) => {
      if (current.some((s) => s.accountIds.length > 0)) return current;
      return current.map((s) => ({
        ...s,
        accountIds: (candidatesBySign[s.sign] || []).map((a) => a.id),
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, configLoaded, accountsQuery.data, candidatesBySign]);

  const updateSection = (index: number, patch: Partial<ReportSection>) => {
    setTouched(true);
    setSections((current) => current.map((section, i) => i === index ? { ...section, ...patch } : section));
  };

  const toggleAccount = (index: number, accountId: string) => {
    setTouched(true);
    setSections((current) => current.map((section, i) => {
      if (i !== index) return section;
      const selected = section.accountIds.includes(accountId);
      return {
        ...section,
        accountIds: selected
          ? section.accountIds.filter((id) => id !== accountId)
          : [...section.accountIds, accountId],
      };
    }));
  };

  const addSection = () => {
    setTouched(true);
    setSections((current) => [
      ...current,
      { id: `section-${Date.now()}`, label: 'Nueva sección', sign: signs[0]?.value || 'INCOME', accountIds: [] },
    ]);
  };

  const removeSection = (index: number) => {
    setTouched(true);
    setSections((current) => current.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    try {
      await contabilidadService.updateConfig({ [configKey]: sections });
      toast.success(`Configuración de ${title} guardada`);
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = (section: ReportSection) => section.accountIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] !max-w-[min(96vw,1100px)] overflow-hidden rounded-3xl border-primary/20 bg-background/95 p-0 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-br from-primary/[0.10] via-background to-emerald-500/[0.06] px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-3 text-lg font-black uppercase tracking-tight">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Settings2 className="size-5" />
            </span>
            Configuración · {title}
          </DialogTitle>
          <DialogDescription className="mt-1 max-w-3xl text-xs leading-relaxed">
            {description || `Define cómo se compone el reporte: cada sección agrupa las cuentas que elijas del catálogo completo
            de la empresa (${signs.map((s) => s.label.toLowerCase()).join(', ')} disponibles). Las cuentas sin marcar no aparecen
            en el reporte. También puedes agregar o renombrar secciones.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(92vh-140px)] overflow-y-auto px-6 py-5">
          {accountsQuery.isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin mr-2" /> Cargando catálogo de cuentas...
            </div>
          ) : (
            <div className="space-y-5">
              {sections.map((section, index) => {
                const candidates = candidatesBySign[section.sign];
                const term = (searchTerms[section.id] || '').trim().toLowerCase();
                const visible = term
                  ? candidates.filter((a) =>
                      a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term))
                  : candidates;
                const isCollapsed = collapsed[section.id];
                return (
                  <div key={section.id} className="rounded-2xl border border-border/60 bg-card/50 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 border-b border-border/40 p-3">
                      <button
                        type="button"
                        onClick={() => setCollapsed((c) => ({ ...c, [section.id]: !c[section.id] }))}
                        className="flex size-7 items-center justify-center rounded-lg hover:bg-muted"
                        aria-label={isCollapsed ? 'Expandir sección' : 'Contraer sección'}
                      >
                        {isCollapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                      </button>
                      <Input
                        value={section.label}
                        onChange={(e) => updateSection(index, { label: e.target.value })}
                        className="h-8 w-52 text-sm font-bold"
                        placeholder="Nombre de la sección"
                      />
                      <select
                        value={section.sign}
                        onChange={(e) => updateSection(index, { sign: e.target.value })}
                        className={cn(
                          "h-8 rounded-lg border px-2 text-xs font-black uppercase tracking-widest focus:outline-none",
                          SIGN_BADGE_STYLES[section.sign] || "border-border bg-muted text-muted-foreground",
                        )}
                      >
                        {signs.map((sign) => (
                          <option key={sign.value} value={sign.value}>{sign.label}</option>
                        ))}
                      </select>
                      <span className={cn(
                        "ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-black",
                        selectedCount(section) > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}>
                        {selectedCount(section)} cuentas
                      </span>
                      <Button variant="ghost" size="icon" className="size-8 text-rose-500 hover:bg-rose-500/10" onClick={() => removeSection(index)} aria-label="Eliminar sección">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    {!isCollapsed && (
                      <div className="p-3">
                        <div className="relative mb-2">
                          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder={`Buscar en ${candidates.length} cuentas...`}
                            value={searchTerms[section.id] || ''}
                            onChange={(e) => setSearchTerms((s) => ({ ...s, [section.id]: e.target.value }))}
                            className="h-8 pl-8 text-xs"
                          />
                        </div>
                        <div className="grid max-h-52 grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                          {visible.length === 0 ? (
                            <p className="col-span-full py-4 text-center text-xs italic text-muted-foreground/60">
                              Sin cuentas que coincidan con la búsqueda
                            </p>
                          ) : (
                            visible.map((account) => {
                              const selected = section.accountIds.includes(account.id);
                              return (
                                <label
                                  key={account.id}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                                    selected
                                      ? "border-primary/50 bg-primary/10"
                                      : "border-border/50 hover:bg-muted/40",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="size-3.5 accent-primary"
                                    checked={selected}
                                    onChange={() => toggleAccount(index, account.id)}
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
                );
              })}

              <Button variant="outline" size="sm" className="gap-1.5" onClick={addSection}>
                <Plus className="size-3.5" /> Agregar sección
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-4">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {allAccounts.length > 0
                ? signs.map((sign, idx) => `${candidatesBySign[sign.value]?.length || 0} cuentas de ${sign.label.toLowerCase()}${idx < signs.length - 1 ? ' y ' : ''}`).join('') + 'disponibles en el catálogo.'
                : 'Catálogo no disponible.'}{' '}
              Una cuenta no marcada en ninguna sección se oculta del reporte.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  setSaving(true);
                  try {
                    await contabilidadService.updateConfig({ [configKey]: [] });
                    toast.success(`Modo automático restaurado: ${title} muestra todas las cuentas`);
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
                title="Vuelve a mostrar todas las cuentas del catálogo en este reporte"
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
