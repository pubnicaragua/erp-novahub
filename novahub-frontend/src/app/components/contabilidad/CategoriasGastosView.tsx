import { useState, useEffect } from 'react';
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

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Activo' },
  { value: 'LIABILITY', label: 'Pasivo' },
  { value: 'EQUITY', label: 'Capital' },
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'EXPENSE', label: 'Gasto' },
];

export function CategoriasGastosView() {
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '', accountId: '', isActive: true });

  useEffect(() => { loadData(); }, [filterType]);

  async function loadData() {
    setLoading(true);
    try {
      const [cats, accts] = await Promise.all([
        contabilidadService.getExpenseCategories(filterType || undefined),
        contabilidadService.getChartOfAccounts(),
      ]);
      const flat: any[] = [];
      function flatten(nodes: any[]) {
        for (const n of nodes) {
          flat.push(n);
          if (n.children) flatten(n.children);
        }
      }
      flatten(accts);
      setCategories(cats);
      setAccounts(flat);
    } catch {
      toast.error('Error al cargar categorías');
    } finally { setLoading(false); }
  }

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
      loadData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al guardar');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta categoría? No se puede si tiene gastos asociados.')) return;
    try {
      await contabilidadService.deleteExpenseCategory(id);
      toast.success('Categoría eliminada');
      loadData();
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Tag className="size-5 text-primary" />
          <h2 className="text-xl font-black uppercase tracking-tight">Categorías de Gastos</h2>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black">{categories.length}</Badge>
        </div>
        <Button onClick={openCreate} className="gap-2 text-xs font-black uppercase tracking-widest rounded-xl">
          <Plus className="size-4" /> Nueva Categoría
        </Button>
      </div>

      <Separator />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar categoría..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-xl text-sm"
          />
        </div>
        <Select value={filterType} onValueChange={v => setFilterType(v)}>
          <SelectTrigger className="w-44 rounded-xl text-xs font-bold">
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

      <Card className="border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
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
            <div className="grid grid-cols-2 gap-4">
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
                  {accounts.filter(a => a.isActive).map(a => (
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
    </div>
  );
}
