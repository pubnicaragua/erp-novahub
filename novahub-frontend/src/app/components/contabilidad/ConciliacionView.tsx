import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Landmark, Plus, Search, ChevronLeft, CheckCircle2, RefreshCw, Eye
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../ui/table';
import { contabilidadService } from '../../services/contabilidad.service';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';

const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En Progreso',
  COMPLETED: 'Completada',
};

export function ConciliacionView() {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [, setDetailLoading] = useState(false);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [form, setForm] = useState({
    accountId: '', period: '', startDate: '', endDate: '', startBalance: '', endBalance: '',
  });

  const reconciliationsQuery = useAccountingQuery<any[]>(['reconciliations'], async (signal) => accountingList(await contabilidadService.getReconciliations(signal)));
  const accountsQuery = useAccountingQuery<any[]>(['accounts'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(false, signal)));
  const reconciliations = reconciliationsQuery.data || [];
  const accounts = (() => {
    const result: any[] = [];
    const flatten = (items: any[]) => items.forEach(item => { const { children, ...rest } = item; result.push(rest); if (Array.isArray(children)) flatten(children); });
    flatten(accountsQuery.data || []);
    return result;
  })();
  const loading = reconciliationsQuery.isLoading || accountsQuery.isLoading;
  const fetchReconciliations = () => reconciliationsQuery.refetch();

  const fetchDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      const res = await queryClient.fetchQuery({
        queryKey: ['accounting', 'reconciliation-detail', id],
        queryFn: ({ signal }) => contabilidadService.getReconciliation(id, signal),
        staleTime: 5 * 60_000,
      });
      setDetail(res);
      setSelectedId(id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al cargar detalle');
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = reconciliations.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      (r.account?.name || '').toLowerCase().includes(q) ||
      (r.account?.code || '').toLowerCase().includes(q) ||
      (r.period || '').toLowerCase().includes(q)
    );
  });

  const handleCreate = async () => {
    if (!form.accountId || !form.period) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    try {
      await contabilidadService.createReconciliation({
        accountId: form.accountId,
        period: form.period,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        startBalance: form.startBalance ? Number(form.startBalance) : 0,
        endBalance: form.endBalance ? Number(form.endBalance) : 0,
      });
      toast.success('Conciliación creada');
      setShowCreate(false);
      setForm({ accountId: '', period: '', startDate: '', endDate: '', startBalance: '', endBalance: '' });
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al crear');
    }
  };

  const handleAutoMatch = async () => {
    if (!detail?.id) return;
    try {
      setAutoMatchLoading(true);
      const res = await contabilidadService.autoMatchReconciliation(detail.id);
      setDetail(res);
      toast.success('Coincidencias automáticas aplicadas');
      fetchReconciliations();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al aplicar coincidencias');
    } finally {
      setAutoMatchLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!detail?.id) return;
    try {
      setCompleteLoading(true);
      const res = await contabilidadService.completeReconciliation(detail.id);
      setDetail(res);
      toast.success('Conciliación completada');
      fetchReconciliations();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al completar');
    } finally {
      setCompleteLoading(false);
    }
  };

  const toggleMatched = (itemId: string, checked: boolean) => {
    if (!detail) return;
    const updatedItems = (detail.items || []).map((item: any) =>
      item.id === itemId ? { ...item, matched: checked } : item
    );
    setDetail({ ...detail, items: updatedItems });
  };

  if (selectedId && detail) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedId(null); setDetail(null); }} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Conciliación {detail.account?.code || ''}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                {detail.account?.name} · {detail.period}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {detail.status !== 'COMPLETED' && canPerform('ACCOUNTING_RECONCILIATIONS', 'edit') && (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl border-border/50 font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={handleAutoMatch}
                  disabled={autoMatchLoading}
                >
                  <RefreshCw className={cn('size-3 mr-2', autoMatchLoading && 'animate-spin')} />
                  Auto-Match
                </Button>
                <Button
                  className="rounded-xl bg-emerald-600 shadow-xl shadow-emerald-500/20 text-white font-black uppercase text-[10px] tracking-widest px-6 hover:bg-emerald-700"
                  onClick={handleComplete}
                  disabled={completeLoading}
                >
                  <CheckCircle2 className="size-3 mr-2" />
                  Completar
                </Button>
              </>
            )}
            <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest px-3 py-1', statusStyles[detail.status || 'PENDING'])}>
              {statusLabels[detail.status || 'PENDING']}
            </Badge>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-[10px] text-muted-foreground">Cuenta</p><p className="text-xs font-black">{detail.account?.code} - {detail.account?.name}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Período</p><p className="text-xs font-black">{detail.period}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Fecha Inicio</p><p className="text-xs font-black">{detail.startDate ? new Date(detail.startDate).toLocaleDateString() : 'N/A'}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Fecha Fin</p><p className="text-xs font-black">{detail.endDate ? new Date(detail.endDate).toLocaleDateString() : 'N/A'}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Saldos</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-[10px] text-muted-foreground">Saldo Inicial</p><p className="text-xl font-black tabular-nums">C$ {Number(detail.startBalance || 0).toLocaleString()}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Saldo Final</p><p className="text-xl font-black tabular-nums">C$ {Number(detail.endBalance || 0).toLocaleString()}</p></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Movimientos</p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Descripción</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Referencia</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Débito</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Crédito</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Monto Bancario</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Match</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detail.items || []).length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground/50 italic py-8">Sin movimientos registrados</TableCell></TableRow>
                  )}
                  {(detail.items || []).map((item: any) => (
                    <TableRow key={item.id} className={cn(item.matched && 'bg-emerald-500/5')}>
                      <TableCell className="text-xs font-mono">{item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}</TableCell>
                      <TableCell className="text-xs font-medium">{item.description || 'N/A'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.reference || 'N/A'}</TableCell>
                      <TableCell className="text-xs tabular-nums text-right">{Number(item.debit || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-xs tabular-nums text-right">{Number(item.credit || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-xs tabular-nums text-right">{Number(item.bankAmount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={!!item.matched}
                          disabled={!canPerform('ACCOUNTING_RECONCILIATIONS', 'edit')}
                          onCheckedChange={(c) => toggleMatched(item.id, !!c)}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{item.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
      <div className="min-w-0 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Conciliación Bancaria</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">
            {reconciliations.length} conciliación(es) registrada(s)
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-3">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
            <Input
              placeholder="Buscar conciliación..."
              className="h-10 w-full bg-background/50 pl-9 border-border/50 rounded-xl text-xs font-bold tracking-widest sm:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {canPerform('ACCOUNTING_RECONCILIATIONS', 'create') && (
              <Button
              onClick={() => setShowCreate(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20"
            >
                <Plus className="size-4" /> <span className="hidden sm:inline">Nueva Conciliación</span><span className="sm:hidden">Nueva</span>
            </Button>
          )}
        </div>
      </div>

      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Cuenta</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Período</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Saldo Inicial</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Saldo Final</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground/50 italic py-12">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground/50 italic py-12">No hay conciliaciones registradas</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/30" onClick={() => fetchDetail(r.id)}>
                  <TableCell>
                    <span className="text-xs font-black">{r.account?.code}</span>
                    <p className="text-[10px] text-muted-foreground">{r.account?.name}</p>
                  </TableCell>
                  <TableCell className="text-xs font-medium">{r.period}</TableCell>
                  <TableCell className="text-xs tabular-nums text-right">C$ {Number(r.startBalance || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-xs tabular-nums text-right">C$ {Number(r.endBalance || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5', statusStyles[r.status || 'PENDING'])}>
                      {statusLabels[r.status || 'PENDING']}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); fetchDetail(r.id); }}>
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          <div className="space-y-2 p-3 md:hidden">
            {loading ? <p className="py-8 text-center text-xs text-muted-foreground">Cargando...</p> : filtered.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">No hay conciliaciones registradas</p> : filtered.map((r) => (
              <button key={r.id} type="button" className="block w-full min-w-0 rounded-xl border border-border/30 bg-muted/20 p-3 text-left hover:bg-muted/40" onClick={() => fetchDetail(r.id)}>
                <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black">{r.account?.code}</p><p className="break-words text-[10px] text-muted-foreground">{r.account?.name}</p></div><Badge variant="outline" className={cn('shrink-0 text-[9px] font-black uppercase tracking-widest', statusStyles[r.status || 'PENDING'])}>{statusLabels[r.status || 'PENDING']}</Badge></div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/20 pt-2 text-[10px]"><div><span className="block text-muted-foreground">Período</span><span>{r.period}</span></div><div><span className="block text-muted-foreground">Fecha</span><span>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</span></div><div><span className="block text-muted-foreground">Saldo inicial</span><span>C$ {Number(r.startBalance || 0).toLocaleString()}</span></div><div><span className="block text-muted-foreground">Saldo final</span><span className="font-bold">C$ {Number(r.endBalance || 0).toLocaleString()}</span></div></div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Nueva Conciliación Bancaria</DialogTitle>
            <DialogDescription className="text-xs">Completa los datos para iniciar una conciliación</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <div className="col-span-2 space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuenta Bancaria</Label>
              <Select value={form.accountId} onValueChange={(v) => setForm({ ...form, accountId: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-xs">{a.code} - {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período</Label>
              <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="Ej: 2026-07" className="h-9 text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha Inicio</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-9 text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha Fin</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="h-9 text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo Inicial</Label>
              <Input type="number" value={form.startBalance} onChange={(e) => setForm({ ...form, startBalance: e.target.value })} className="h-9 text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo Final</Label>
              <Input type="number" value={form.endBalance} onChange={(e) => setForm({ ...form, endBalance: e.target.value })} className="h-9 text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-xl text-[10px] font-black uppercase tracking-widest">Cancelar</Button>
            <Button onClick={handleCreate} className="rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
              <Landmark className="size-3 mr-2" /> Crear Conciliación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
