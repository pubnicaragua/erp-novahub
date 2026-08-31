import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Pencil, Trash2, RefreshCw, Loader2, Wallet
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';

const PERIODS = [
  { label: 'Este Mes', value: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` },
  { label: 'Este Año', value: `${new Date().getFullYear()}` },
];

export function BudgetItemsView() {
  const { canPerform } = useAuth();
  const canCreate = canPerform('ACCOUNTING', 'create');
  const canEdit = canPerform('ACCOUNTING', 'edit');
  const canDeactivate = canPerform('ACCOUNTING', 'deactivate');
  const { baseCurrency, formatConvertedAmount } = useCurrency();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterPeriod, setFilterPeriod] = useState(PERIODS[0].value);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', assignedAmount: 0, accountId: '', costCenterId: '', period: PERIODS[0].value, status: 'ACTIVE' });

  const itemsQuery = useAccountingQuery<any[]>(['budget-items', filterPeriod], async (signal) => accountingList(await contabilidadService.getBudgetItems(filterPeriod, signal)));
  const accountsQuery = useAccountingQuery<any[]>(['accounts'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(false, signal)));
  const items = itemsQuery.data || [];
  const accounts = useMemo(() => {
    const flat: any[] = [];
    const flatten = (nodes: any[]) => nodes.forEach(n => { const { children, ...rest } = n; flat.push(rest); if (children) flatten(children); });
    flatten(accountsQuery.data || []);
    return flat;
  }, [accountsQuery.data]);
  const loading = itemsQuery.isLoading || accountsQuery.isLoading;
  const loadData = () => { itemsQuery.refetch(); accountsQuery.refetch(); };

  function openCreate() {
    if (!canCreate) return;
    setEditing(null);
    setForm({ code: '', name: '', assignedAmount: 0, accountId: '', costCenterId: '', period: filterPeriod, status: 'ACTIVE' });
    setDialogOpen(true);
  }

  function openEdit(item: any) {
    if (!canEdit) return;
    setEditing(item);
    setForm({
      code: item.code, name: item.name, assignedAmount: Number(item.assignedAmount),
      accountId: item.accountId, costCenterId: item.costCenterId || '', period: item.period, status: item.status,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (editing ? !canEdit : !canCreate) return;
    if (!form.code || !form.name || !form.accountId) {
      toast.error('Código, nombre y cuenta son requeridos');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await contabilidadService.updateBudgetItem(editing.id, form);
        toast.success('Partida actualizada');
      } else {
        await contabilidadService.createBudgetItem(form);
        toast.success('Partida creada');
      }
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al guardar');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!canDeactivate) return;
    setPendingDeleteId(id);
  }

  async function confirmDelete() {
    if (!pendingDeleteId || !canDeactivate) return;
    try {
      await contabilidadService.deleteBudgetItem(pendingDeleteId);
      toast.success('Partida eliminada');
      setPendingDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Error'); }
  }

  function format(n: number) {
    return formatConvertedAmount(n, baseCurrency);
  }

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Wallet className="size-5 text-primary" />
          <h2 className="text-xl font-black uppercase tracking-tight">Partidas Presupuestarias</h2>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black">{items.length}</Badge>
        </div>
        {canCreate && <Button onClick={openCreate} className="gap-2 text-xs font-black uppercase tracking-widest rounded-xl">
          <Plus className="size-4" /> Nueva Partida
        </Button>}
      </div>

      <Separator />

      <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
        <div className="relative col-span-2 min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl text-sm" />
        </div>
        <Select value={filterPeriod} onValueChange={v => setFilterPeriod(v)}>
          <SelectTrigger className="w-full rounded-xl text-xs font-bold sm:w-36">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos</SelectItem>
            {PERIODS.map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
            <Input type="month" className="text-xs mt-1" placeholder="Otro..." onChange={e => { if (e.target.value) setFilterPeriod(e.target.value); }} />
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="rounded-xl" onClick={loadData}><RefreshCw className="size-4" /></Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Asignado</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-black">{format(items.reduce((s, i) => s + Number(i.assignedAmount), 0))}</p></CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Ejecutado</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-black text-primary">{format(items.reduce((s, i) => s + Number(i.executedAmount), 0))}</p></CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Disponible</CardTitle></CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-black', items.reduce((s, i) => s + (Number(i.availableAmount ?? Number(i.assignedAmount) - Number(i.executedAmount))), 0) >= 0 ? 'text-emerald-500' : 'text-red-500')}>
              {format(items.reduce((s, i) => s + (Number(i.availableAmount ?? Number(i.assignedAmount) - Number(i.executedAmount))), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Código</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Asignado</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ejecutado</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ejecución</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Disponible</th>
                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</th>
                <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">Sin partidas presupuestarias</td></tr>
              ) : filtered.map(item => {
                const assigned = Number(item.assignedAmount);
                const executed = Number(item.executedAmount);
                const available = Number(item.availableAmount ?? assigned - executed);
                const pct = assigned > 0 ? Math.min(100, (executed / assigned) * 100) : 0;
                const overBudget = available < 0;
                return (
                  <tr key={item.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold">{item.code}</td>
                    <td className="px-4 py-3 font-semibold">
                      <div className="text-xs text-muted-foreground">{item.account?.code} - {item.account?.name}</div>
                      <div className="text-xs text-muted-foreground/70">{item.name}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm font-bold">{format(assigned)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{format(executed)}</td>
                    <td className="px-4 py-3 min-w-36">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 min-w-20 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", overBudget ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={cn("w-12 shrink-0 text-right font-mono text-[10px] font-bold", overBudget ? "text-red-500" : "text-muted-foreground")}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={cn('font-bold', available >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                        {format(available)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn(
                        'text-[10px] font-black uppercase tracking-widest',
                        item.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        item.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      )}>{item.status === 'ACTIVE' ? 'Activo' : item.status === 'SUSPENDED' ? 'Suspendido' : 'Cerrado'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && <Button variant="ghost" size="icon" aria-label="Editar partida" className="size-8 rounded-lg" onClick={() => openEdit(item)}><Pencil className="size-3.5" /></Button>}
                        {canDeactivate && <Button variant="ghost" size="icon" aria-label="Desactivar partida" className="size-8 rounded-lg text-red-500 hover:text-red-600" onClick={() => handleDelete(item.id)}><Trash2 className="size-3.5" /></Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <div className="space-y-2 p-3 md:hidden">
            {filtered.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Sin partidas presupuestarias</p> : filtered.map(item => {
              const assigned = Number(item.assignedAmount); const executed = Number(item.executedAmount); const available = Number(item.availableAmount ?? assigned - executed);
              const pct = assigned > 0 ? Math.min(100, (executed / assigned) * 100) : 0;
              return <div key={item.id} className="min-w-0 rounded-xl border border-border/30 bg-muted/20 p-3">
                <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-mono font-bold text-muted-foreground">{item.code}</p><p className="break-words text-xs font-semibold">{item.name}</p><p className="break-words text-[10px] text-muted-foreground">{item.account?.code} - {item.account?.name}</p></div><Badge className="shrink-0 text-[9px]">{item.status === 'ACTIVE' ? 'Activo' : item.status === 'SUSPENDED' ? 'Suspendido' : 'Cerrado'}</Badge></div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 min-w-20 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", available < 0 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={cn("shrink-0 font-mono text-[10px] font-bold", available < 0 ? "text-red-500" : "text-muted-foreground")}>{pct.toFixed(0)}%</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/20 pt-2 text-[10px]"><div><span className="block text-muted-foreground">Asignado</span><span className="font-bold">{format(assigned)}</span></div><div><span className="block text-muted-foreground">Ejecutado</span><span>{format(executed)}</span></div><div><span className="block text-muted-foreground">Disponible</span><span className={cn('font-bold', available >= 0 ? 'text-emerald-500' : 'text-red-500')}>{format(available)}</span></div><div className="flex justify-end gap-1">{canEdit && <Button variant="ghost" size="icon" aria-label="Editar partida" className="size-7" onClick={() => openEdit(item)}><Pencil className="size-3.5" /></Button>}{canDeactivate && <Button variant="ghost" size="icon" aria-label="Desactivar partida" className="size-7 text-red-500" onClick={() => handleDelete(item.id)}><Trash2 className="size-3.5" /></Button>}</div></div>
              </div>
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              {editing ? 'Editar Partida' : 'Nueva Partida Presupuestaria'}
            </DialogTitle>
            <DialogDescription className="text-xs">Define una partida presupuestaria vinculada a una cuenta contable.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Código *</Label>
                <Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="Ej: PRE-001" className="rounded-xl text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Nombre *</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Presupuesto Viáticos" className="rounded-xl text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Cuenta Contable *</Label>
              <Select value={form.accountId} onValueChange={v => setForm(p => ({ ...p, accountId: v }))}>
                <SelectTrigger className="rounded-xl text-sm"><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.isActive !== false && a.acceptsPostings !== false).map(a => (
                    <SelectItem key={a.id} value={a.id} className="text-xs font-mono">{a.code} - {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Monto Asignado</Label>
                <Input type="number" step="0.01" value={form.assignedAmount} onChange={e => setForm(p => ({ ...p, assignedAmount: Number(e.target.value) }))} className="rounded-xl text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Período</Label>
                <Input value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} placeholder="2026-01" className="rounded-xl text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Estado</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Activo</SelectItem>
                  <SelectItem value="SUSPENDED">Suspendido</SelectItem>
                  <SelectItem value="CLOSED">Cerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="rounded-xl text-xs font-bold">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || (editing ? !canEdit : !canCreate)} className="rounded-xl text-xs font-bold gap-2">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {editing ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        onOpenChange={open => { if (!open) setPendingDeleteId(null); }}
        title="¿Eliminar partida presupuestaria?"
        description="La partida se eliminará y esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
