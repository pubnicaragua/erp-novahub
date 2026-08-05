import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Pencil, Trash2, RefreshCw, Loader2, Tag
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { contabilidadService } from '../../services/contabilidad.service';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Activo' },
  { value: 'LIABILITY', label: 'Pasivo' },
  { value: 'EQUITY', label: 'Capital' },
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'EXPENSE', label: 'Gasto' },
];

export function CategoriasGastosView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', accountId: '', isActive: true });

  const categoriesQuery = useAccountingQuery<any[]>(['expense-categories', filterType], async (signal) => accountingList(await contabilidadService.getExpenseCategories(filterType || undefined, signal)));
  const accountsQuery = useAccountingQuery<any[]>(['accounts'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(false, signal)));
  const categories = categoriesQuery.data || [];
  const accounts = useMemo(() => {
    const flat: any[] = [];
    const flatten = (nodes: any[]) => nodes.forEach(n => { const { children, ...rest } = n; flat.push(rest); if (children) flatten(children); });
    flatten(accountsQuery.data || []);
    return flat;
  }, [accountsQuery.data]);
  const loading = categoriesQuery.isLoading || accountsQuery.isLoading;
  const loadData = () => { categoriesQuery.refetch(); accountsQuery.refetch(); };

  function openCreate() {
    setEditing(null);
    setForm({ code: '', name: '', description: '', accountId: '', isActive: true });
    setDialogOpen(true);
  }

  function openEdit(cat: any) {
    setEditing(cat);
    setForm({ code: cat.code, name: cat.name, description: cat.description || '', accountId: cat.accountId, isActive: cat.isActive });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.code || !form.name || !form.accountId) {
      toast.error('Código, nombre y cuenta son requeridos');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await contabilidadService.updateExpenseCategory(editing.id, form);
        toast.success('Categoría actualizada');
      } else {
        await contabilidadService.createExpenseCategory(form);
        toast.success('Categoría creada');
      }
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al guardar');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setPendingDeleteId(id);
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    try {
      await contabilidadService.deleteExpenseCategory(pendingDeleteId);
      toast.success('Categoría eliminada');
      setPendingDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al eliminar');
    }
  }

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Tag className="size-5 text-primary" />
          <h2 className="text-xl font-black uppercase tracking-tight">Categorías de Gastos</h2>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black">{categories.length}</Badge>
        </div>
        <Button onClick={openCreate} className="gap-2 text-xs font-black uppercase tracking-widest rounded-xl">
          <Plus className="size-4" /> Nueva Categoría
        </Button>
      </div>

      <Separator />

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
        <div className="relative col-span-2 min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar categoría..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-xl text-sm"
          />
        </div>
        <Select value={filterType} onValueChange={v => setFilterType(v)}>
          <SelectTrigger className="w-full rounded-xl text-xs font-bold sm:w-44">
            <SelectValue placeholder="Tipo de cuenta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todas</SelectItem>
            {ACCOUNT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="rounded-xl" onClick={loadData}>
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <Card className="overflow-hidden rounded-2xl border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Código</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuenta Contable</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción</th>
                <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Activo</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">Sin categorías</td>
                </tr>
              ) : filtered.map(cat => (
                <tr key={cat.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-bold">{cat.code}</td>
                  <td className="px-4 py-3 font-semibold">{cat.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-muted-foreground">
                      {cat.account?.code} - {cat.account?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{cat.description}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={cn(
                      'text-[10px] font-black uppercase tracking-widest',
                      cat.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    )}>
                      {cat.isActive ? 'Sí' : 'No'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={() => openEdit(cat)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg text-red-500 hover:text-red-600" onClick={() => handleDelete(cat.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div className="space-y-2 p-3 md:hidden">
            {filtered.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sin categorías</p> : filtered.map(cat => (
              <div key={cat.id} className="min-w-0 rounded-xl border border-border/30 bg-muted/20 p-3">
                <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-mono font-bold text-muted-foreground">{cat.code}</p><p className="break-words text-xs font-semibold">{cat.name}</p><p className="mt-1 break-words text-[10px] font-mono text-muted-foreground">{cat.account?.code} - {cat.account?.name}</p></div><Badge className="shrink-0 text-[9px]">{cat.isActive ? 'Activo' : 'Inactivo'}</Badge></div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/20 pt-2"><p className="min-w-0 break-words text-[10px] text-muted-foreground">{cat.description || 'Sin descripción'}</p><div className="shrink-0"><Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(cat)}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => handleDelete(cat.id)}><Trash2 className="size-3.5" /></Button></div></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              {editing ? 'Editar Categoría' : 'Nueva Categoría de Gasto'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vincula una categoría de gasto a una cuenta contable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Código *</Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                  placeholder="Ej: CAT-001"
                  className="rounded-xl text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Nombre *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ej: Viáticos"
                  className="rounded-xl text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Cuenta Contable *</Label>
              <Select value={form.accountId} onValueChange={v => setForm(p => ({ ...p, accountId: v }))}>
                <SelectTrigger className="rounded-xl text-sm">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.isActive !== false && a.acceptsPostings !== false).map(a => (
                    <SelectItem key={a.id} value={a.id} className="text-xs font-mono">
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Descripción</Label>
              <Input
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Descripción opcional"
                className="rounded-xl text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl text-xs font-bold">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl text-xs font-bold gap-2">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {editing ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        onOpenChange={open => { if (!open) setPendingDeleteId(null); }}
        title="¿Eliminar categoría?"
        description="No podrás eliminarla si tiene gastos asociados. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
