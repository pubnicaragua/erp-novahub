import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { safeSetItem } from '../../services/safe-storage';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Plus, RefreshCw, Pencil, Sparkles, Search, X } from 'lucide-react';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { accountsService } from '../../services/finanzas.service';
import { AccountingAccountSelect } from '../ui/AccountingAccountSelect';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { toast } from 'sonner';



const isDefaultCategoryCode = (code: string) => {
  if (!code) return false;
  const normalized = code.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const keywords = ['EDIFICIO', 'VEHICULO', 'MAQUINARIA', 'COMPUTO', 'MUEBLE', 'MOBILIARIO', 'TERRENO', 'HERRAMIENTA', 'EQUIPO', 'MEJORAS', 'OTROS', 'OTRO'];
  return keywords.some(k => normalized.includes(k)) || /^CAT-\d+$/.test(normalized);
};

export const getCategoryCode = (cat: any) => {
  if (!cat) return '';
  const override = typeof window !== 'undefined' ? localStorage.getItem(`cat_code_override_${cat.id}`) : null;
  return override || cat.code;
};

export const isCodeEditable = (editing: Category | null) => {
  if (!editing) return true;
  const hasOverride = typeof window !== 'undefined' && !!localStorage.getItem(`cat_code_override_${editing.id}`);
  return isDefaultCategoryCode(editing.code) && !hasOverride;
};

interface Category {
  id: string;
  code: string;
  name: string;
  usefulLifeMonths: number;
  annualRate: number;
  monthlyRate: number;
  method: string;
  depreciable: boolean;
  residualValuePct: number | null;
  assetAccountId: string | null;
  accumDepreciationAccountId: string | null;
  depreciationExpenseAccountId: string | null;
  isActive: boolean;
  _count?: { fixedAssets: number };
}

interface CategoryForm {
  code: string;
  name: string;
  usefulLifeMonths: number;
  annualRate: number;
  monthlyRate: number;
  method: string;
  depreciable: boolean;
  residualValuePct: number | null;
  assetAccountId: string;
  accumDepreciationAccountId: string;
  depreciationExpenseAccountId: string;
  isActive: boolean;
}

function emptyForm(): CategoryForm {
  return {
    code: '',
    name: '',
    usefulLifeMonths: 60,
    annualRate: 0.2,
    monthlyRate: 0.016666667,
    method: 'STRAIGHT_LINE',
    depreciable: true,
    residualValuePct: null,
    assetAccountId: '',
    accumDepreciationAccountId: '',
    depreciationExpenseAccountId: '',
    isActive: true,
  };
}

export function ActivosFijosCategoriesTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CategoryForm>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const categoriesQuery = useAccountingQuery<Category[]>(['fixed-asset-categories'], async (signal) =>
    accountingList(await contabilidadService.getFixedAssetCategories(signal)) as Category[],
  );
  const categories = categoriesQuery.data || [];
  const loading = categoriesQuery.isLoading || categoriesQuery.isFetching;
  const refresh = () => categoriesQuery.refetch();

  const filteredCategories = categories.filter((c) =>
    !searchTerm ||
    getCategoryCode(c)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    const codeA = getCategoryCode(a) || '';
    const codeB = getCategoryCode(b) || '';
    return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['accounting'] });
    queryClient.invalidateQueries({ queryKey: ['fixed-asset-categories'] });
  };

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const accountsQuery = useAccountingQuery<any[]>(['financial-accounts'], async (signal) => {
    const res: any = await accountsService.getAll({ page: 1, pageSize: 500 }, signal);
    return (res?.data ?? res?.items ?? res ?? []) as any[];
  }, { enabled: !!selectedCategoryId });
  const accountsList = accountsQuery.data || [];

  const [accountLabels, setAccountLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedCategory) return;
    const ids = [
      selectedCategory.assetAccountId,
      selectedCategory.accumDepreciationAccountId,
      selectedCategory.depreciationExpenseAccountId
    ].filter(Boolean) as string[];

    ids.forEach(async (id) => {
      if (accountLabels[id]) return;
      const acc = accountsList.find((a) => a.id === id);
      if (acc) {
        setAccountLabels((prev) => ({ ...prev, [id]: `${acc.code} · ${acc.name}` }));
        return;
      }
      try {
        const res: any = await accountsService.getById(id);
        const data = res?.data ?? res;
        if (data && data.code) {
          setAccountLabels((prev) => ({ ...prev, [id]: `${data.code} · ${data.name}` }));
        }
      } catch {
        setAccountLabels((prev) => ({ ...prev, [id]: id }));
      }
    });
  }, [selectedCategory, accountsList, accountLabels]);

  const getAccountLabel = (id: string | null) => {
    if (!id) return '—';
    return accountLabels[id] || id;
  };



  function openCreate() {
    setEditing(null);
    let maxNum = 0;
    categories.forEach((cat) => {
      const code = getCategoryCode(cat);
      const match = code.match(/^CAT-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    });
    const nextCode = `CAT-${String(maxNum + 1).padStart(3, '0')}`;
    setForm({
      ...emptyForm(),
      code: nextCode
    });
    setCreateOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setForm({
      code: getCategoryCode(category),
      name: category.name,
      usefulLifeMonths: category.usefulLifeMonths,
      annualRate: category.annualRate,
      monthlyRate: category.monthlyRate,
      method: category.method || 'STRAIGHT_LINE',
      depreciable: category.depreciable,
      residualValuePct: category.residualValuePct,
      assetAccountId: category.assetAccountId || '',
      accumDepreciationAccountId: category.accumDepreciationAccountId || '',
      depreciationExpenseAccountId: category.depreciationExpenseAccountId || '',
      isActive: category.isActive,
    });
    setCreateOpen(true);
  }

  function setField(field: keyof CategoryForm, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSeed() {
    if (seeding) return;
    setSeeding(true);
    try {
      const res = await contabilidadService.seedFixedAssetCategories();
      toast.success(`Categorías por defecto cargadas (${res?.created?.length ?? 0})`);
      await invalidate();
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar categorías por defecto');
    } finally {
      setSeeding(false);
    }
  }

  async function handleSave() {
    if (!form.code.trim()) { toast.error('El código es obligatorio'); return; }
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (form.depreciable && form.usefulLifeMonths <= 0) { toast.error('La vida útil debe ser mayor a cero'); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      if (editing) {
        const sendCode = isDefaultCategoryCode(editing.code);
        if (sendCode && form.code !== editing.code) {
          safeSetItem(`cat_code_override_${editing.id}`, form.code);
        }
        await contabilidadService.updateFixedAssetCategory(editing.id, { ...form, code: undefined });
        toast.success('Categoría actualizada');
      } else {
        await contabilidadService.createFixedAssetCategory(form);
        toast.success('Categoría creada');
      }
      setCreateOpen(false);
      await invalidate();
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar categoría');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={cn("grid grid-cols-1 gap-6 items-start", selectedCategoryId ? "lg:grid-cols-[1.2fr_0.8fr]" : "lg:grid-cols-1")}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-lg font-bold">
              <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="font-black tracking-tight uppercase italic">Categorías y Parámetros de Depreciación</span>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 w-full pl-9 text-xs sm:w-[200px]"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding} className="h-8">
                  <Sparkles className={seeding ? 'size-3.5 animate-pulse' : 'size-3.5'} />
                  Cargar categorías por defecto
                </Button>
                <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="h-8">
                  <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
                </Button>
                <Button size="sm" onClick={openCreate} className="h-8 gap-1.5">
                  <Plus className="size-3.5" /> Nueva categoría
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredCategories.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Search className="size-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">No se encontraron categorías</p>
                <p className="text-xs mt-1">Intenta con otro término de búsqueda o registra una nueva</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Código</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Nombre</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Vida útil</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Tasa anual</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Tasa mensual</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Depreciable</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                      <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCategories.map((category) => {
                      const isSelected = selectedCategoryId === category.id;
                      return (
                        <TableRow
                          key={category.id}
                          onClick={() => setSelectedCategoryId(isSelected ? null : category.id)}
                          className={cn(
                            "hover:bg-muted/30 border-border/30 cursor-pointer transition-colors",
                            isSelected && "bg-muted/50 hover:bg-muted/50 font-semibold"
                          )}
                        >
                          <TableCell className="font-mono text-xs">{getCategoryCode(category)}</TableCell>
                          <TableCell className="font-medium text-xs">{category.name}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{category.usefulLifeMonths} m</TableCell>
                          <TableCell className="text-right font-mono text-xs">{(category.annualRate * 100).toFixed(2)}%</TableCell>
                          <TableCell className="text-right font-mono text-xs">{(category.monthlyRate * 100).toFixed(4)}%</TableCell>
                          <TableCell>
                            <Badge variant={category.depreciable ? 'default' : 'secondary'} className="text-[10px]">
                              {category.depreciable ? 'Sí' : 'No'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={category.isActive ? 'default' : 'secondary'} className="text-[10px]">
                              {category.isActive ? 'Activa' : 'Inactiva'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); openEdit(category); }}>
                              <Pencil className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedCategoryId && (
          <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start space-y-4">
            <Card className="overflow-hidden border-border/40 shadow-lg">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-black uppercase tracking-widest text-primary">Categoría Seleccionada · {getCategoryCode(selectedCategory) || '—'}</p>
                    <h3 className="mt-1 truncate text-lg font-black tracking-tight uppercase italic" title={selectedCategory?.name}>{selectedCategory?.name || 'Cargando...'}</h3>
                    {selectedCategory && (
                      <Badge variant={selectedCategory.isActive ? 'default' : 'secondary'} className="mt-1.5 text-[10px] font-bold">
                        {selectedCategory.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="icon" className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setSelectedCategoryId(null)} aria-label="Cerrar detalle de categoría" title="Cerrar">
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="min-w-0 max-h-[calc(100dvh-12rem)] space-y-5 overflow-y-auto p-4">
                {selectedCategory && (
                  <>
                    {/* Parámetros de Depreciación */}
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Parámetros de Depreciación</p>
                      <div className="grid grid-cols-2 gap-2 text-xs rounded-xl border border-border/30 bg-muted/10 p-3">
                        <div><span className="block text-[10px] text-muted-foreground font-semibold">Vida Útil</span><span className="font-medium">{selectedCategory.usefulLifeMonths} meses</span></div>
                        <div><span className="block text-[10px] text-muted-foreground font-semibold">Depreciable</span><span className="font-medium">{selectedCategory.depreciable ? 'Sí' : 'No'}</span></div>
                        <div><span className="block text-[10px] text-muted-foreground font-semibold">Tasa Anual</span><span className="font-medium">{(selectedCategory.annualRate * 100).toFixed(2)}%</span></div>
                        <div><span className="block text-[10px] text-muted-foreground font-semibold">Tasa Mensual</span><span className="font-medium">{(selectedCategory.monthlyRate * 100).toFixed(4)}%</span></div>
                        {selectedCategory.residualValuePct != null && (
                          <div className="col-span-2 border-t border-border/20 pt-1.5 mt-0.5">
                            <span className="block text-[10px] text-muted-foreground font-semibold">Valor Residual</span><span className="font-medium">{selectedCategory.residualValuePct}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cuentas Contables */}
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuentas Contables</p>
                      {accountsQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
                          <RefreshCw className="size-3.5 animate-spin text-primary" /> Cargando cuentas...
                        </div>
                      ) : (
                        <div className="space-y-2 text-xs rounded-xl border border-border/30 bg-muted/10 p-3">
                          <div>
                            <span className="block text-[10px] text-muted-foreground font-semibold">Cuenta del Activo</span>
                            <span className="font-medium break-all">{getAccountLabel(selectedCategory.assetAccountId)}</span>
                          </div>
                          <div className="border-t border-border/20 pt-1.5 mt-1.5">
                            <span className="block text-[10px] text-muted-foreground font-semibold">Depreciación Acumulada</span>
                            <span className="font-medium break-all">{getAccountLabel(selectedCategory.accumDepreciationAccountId)}</span>
                          </div>
                          <div className="border-t border-border/20 pt-1.5 mt-1.5">
                            <span className="block text-[10px] text-muted-foreground font-semibold">Gasto por Depreciación</span>
                            <span className="font-medium break-all">{getAccountLabel(selectedCategory.depreciationExpenseAccountId)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar categoría: ${editing.name}` : 'Nueva categoría'}</DialogTitle>
            <DialogDescription>Configura la vida útil y las cuentas contables de depreciación</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cat-code">Código *</Label>
                <Input id="cat-code" value={form.code} onChange={(e) => setField('code', e.target.value.toUpperCase())} placeholder="Ej: COMPUTO" disabled={!!editing && !isCodeEditable(editing)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-name">Nombre *</Label>
                <Input id="cat-name" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Ej: Equipo de Cómputo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-life">Vida útil (meses)</Label>
                <Input id="cat-life" type="number" min="0" value={form.usefulLifeMonths || ''} onChange={(e) => setField('usefulLifeMonths', e.target.value === '' ? 0 : Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-annual">Tasa anual (%)</Label>
                <Input id="cat-annual" type="number" step="0.0001" value={form.annualRate ? (form.annualRate * 100).toFixed(2) : ''} onChange={(e) => setField('annualRate', e.target.value === '' ? 0 : Number(e.target.value) / 100)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-monthly">Tasa mensual (%)</Label>
                <Input id="cat-monthly" type="number" step="0.0001" value={form.monthlyRate ? (form.monthlyRate * 100).toFixed(4) : ''} onChange={(e) => setField('monthlyRate', e.target.value === '' ? 0 : Number(e.target.value) / 100)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-residual">Valor residual (%)</Label>
                <Input id="cat-residual" type="number" step="0.01" value={form.residualValuePct != null ? form.residualValuePct : ''} onChange={(e) => setField('residualValuePct', e.target.value === '' ? null : Number(e.target.value))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="cat-dep" checked={form.depreciable} onCheckedChange={(v) => setField('depreciable', !!v)} />
              <Label htmlFor="cat-dep" className="text-sm">Esta categoría se deprecia (desmarcar para terrenos)</Label>
            </div>
            <AccountingAccountSelect label="Cuenta del activo" value={form.assetAccountId} onChange={(v) => setField('assetAccountId', v)} required={false} />
            <AccountingAccountSelect label="Cuenta de depreciación acumulada" value={form.accumDepreciationAccountId} onChange={(v) => setField('accumDepreciationAccountId', v)} required={false} />
            <AccountingAccountSelect label="Cuenta de gasto por depreciación" value={form.depreciationExpenseAccountId} onChange={(v) => setField('depreciationExpenseAccountId', v)} required={false} />
            <div className="flex items-center gap-2">
              <Checkbox id="cat-active" checked={form.isActive} onCheckedChange={(v) => setField('isActive', !!v)} />
              <Label htmlFor="cat-active" className="text-sm">Categoría activa</Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button onClick={handleSave} disabled={submitting}>{submitting ? 'Guardando...' : 'Guardar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
