import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Landmark, Plus, Search, ChevronLeft, CheckCircle2, RefreshCw, Eye, AlertTriangle, Loader2
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
import { DateField } from '../ui/DateField';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../ui/table';
import { Combobox } from '../ui/Combobox';
import { contabilidadService } from '../../services/contabilidad.service';
import { api } from '../../services/api';
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

const currentMonth = new Date().toISOString().slice(0, 7);

export function ConciliacionView({ onGoToConfig }: { onGoToConfig?: () => void }) {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [, setDetailLoading] = useState(false);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [onlyUnmatched, setOnlyUnmatched] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemLoading, setAddItemLoading] = useState(false);
  const [addItemForm, setAddItemForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', reference: '', amount: '', type: 'DEBIT' });
  const [form, setForm] = useState({ accountId: '', period: '', endBalance: '' });
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [bankEndInput, setBankEndInput] = useState('');

  const reconciliationsQuery = useAccountingQuery<any[]>(['reconciliations'], async (signal) => accountingList(await contabilidadService.getReconciliations(signal)));
  const accountsQuery = useAccountingQuery<any[]>(['accounts'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(false, signal)));
  const bankAccountsQuery = useAccountingQuery<any[]>(['bank-accounts'], async (signal) => accountingList(await api.get('/bank-accounts', { signal })));
  const reconciliations = reconciliationsQuery.data || [];
  const accounts = useMemo(() => {
    const result: any[] = [];
    const flatten = (items: any[]) => items.forEach(item => { const { children, ...rest } = item; result.push(rest); if (Array.isArray(children)) flatten(children); });
    flatten(accountsQuery.data || []);
    return result;
  }, [accountsQuery.data]);
  const loading = reconciliationsQuery.isLoading || accountsQuery.isLoading;

  // Solo cuentas bancarias activas con cuenta contable vinculada.
  const bankAccounts = (bankAccountsQuery.data || []).filter((bank: any) => bank.isActive !== false && bank.accountId);
  const bankOptions = useMemo(() => bankAccounts.map((bank: any) => {
    const account = accounts.find((entry) => entry.id === bank.accountId);
    return {
      value: bank.accountId,
      label: `${bank.bankName} · ${bank.accountNumber}${account ? ` · ${account.code} ${account.name}` : ''}`,
    };
  }), [bankAccounts, accounts]);

  const fetchReconciliations = () => reconciliationsQuery.refetch();

  const fetchDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      const res = await queryClient.fetchQuery({
        queryKey: ['accounting', 'reconciliation-detail', id],
        queryFn: ({ signal }) => contabilidadService.getReconciliation(id, signal),
      });
      setDetail(res);
      setSelectedId(id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al cargar detalle');
    } finally {
      setDetailLoading(false);
    }
  };

  // Los saldos se calculan en el servidor conforme se elige cuenta + mes.
  useEffect(() => {
    if (!form.accountId || !/^\d{4}-\d{2}$/.test(form.period)) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await contabilidadService.getReconciliationPreview(form.accountId, form.period);
        setPreview(res);
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [form.accountId, form.period]);

  // Sincroniza el campo editable del saldo del estado de cuenta.
  useEffect(() => {
    if (detail) setBankEndInput(detail.endBalance ?? '');
  }, [detail]);

  const filtered = reconciliations.filter((r) => {
    const q = searchTerm.toLowerCase();
    return (
      (r.account?.name || '').toLowerCase().includes(q) ||
      (r.account?.code || '').toLowerCase().includes(q) ||
      (r.bank?.bankName || '').toLowerCase().includes(q) ||
      (r.bank?.accountNumber || '').toLowerCase().includes(q) ||
      (r.period || '').toLowerCase().includes(q)
    );
  });

  const formatAmount = (value: any) => {
    const symbol = detail?.bank?.currency === 'USD' ? 'US$' : 'C$';
    return `${symbol} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  const handleCreate = async () => {
    if (!form.accountId) return void toast.error('Selecciona una cuenta bancaria');
    if (!/^\d{4}-\d{2}$/.test(form.period)) return void toast.error('Selecciona el mes de la conciliación');
    try {
      const res = await contabilidadService.createReconciliation({
        accountId: form.accountId,
        period: form.period,
        endBalance: form.endBalance !== '' ? Number(form.endBalance) : undefined,
      });
      toast.success('Conciliación creada. Los saldos del libro se calcularon automáticamente.');
      setShowCreate(false);
      setForm({ accountId: '', period: '', endBalance: '' });
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
      void fetchDetail(res.id);
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
      void fetchDetail(detail.id);
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
    void persistItem(itemId, { matched: checked });
  };

  const persistItem = async (itemId: string, patch: any) => {
    if (!detail) return;
    try {
      const updated = await contabilidadService.updateReconciliationItem(detail.id, itemId, patch);
      setDetail(updated);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar el movimiento');
      fetchDetail(detail.id);
    }
  };

  const handleBankAmountBlur = (item: any) => {
    const amount = Number(item.bankAmount);
    const next = Number.isFinite(amount) && amount > 0 ? amount : null;
    if (next === (item.bankAmount === null || item.bankAmount === undefined ? null : Number(item.bankAmount))) return;
    void persistItem(item.id, { bankAmount: next });
  };

  const handleEndBalanceBlur = async () => {
    if (!detail) return;
    const amount = Number(bankEndInput);
    const next = Number.isFinite(amount) ? amount : 0;
    if (next === Number(detail.endBalance || 0)) return;
    try {
      const updated = await contabilidadService.updateReconciliation(detail.id, { endBalance: next });
      setDetail(updated);
      toast.success('Saldo del estado de cuenta actualizado');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar el saldo del banco');
      fetchDetail(detail.id);
    }
  };

  const handleAddItem = async () => {
    if (!detail) return;
    if (!addItemForm.description.trim()) return void toast.error('Describe el movimiento del estado de cuenta');
    const amount = Number(addItemForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return void toast.error('El monto debe ser mayor que cero');
    try {
      setAddItemLoading(true);
      const updated = await contabilidadService.addReconciliationItem(detail.id, {
        date: addItemForm.date || new Date().toISOString().split('T')[0],
        description: addItemForm.description.trim(),
        reference: addItemForm.reference.trim() || undefined,
        amount,
        type: addItemForm.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      });
      setDetail(updated);
      setAddItemOpen(false);
      setAddItemForm({ date: new Date().toISOString().split('T')[0], description: '', reference: '', amount: '', type: 'DEBIT' });
      toast.success('Movimiento del estado de cuenta agregado');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al agregar el movimiento');
    } finally {
      setAddItemLoading(false);
    }
  };

  if (selectedId && detail) {
    const matchedNet = Number(detail.matchedDebits || 0) - Number(detail.matchedCredits || 0);
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
                {detail.account?.name}
                {detail.bank ? ` · ${detail.bank.bankName} ${detail.bank.accountNumber}` : ''} · {detail.period}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {detail.status !== 'COMPLETED' && canPerform('ACCOUNTING_RECONCILIATION', 'approve') && (
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
                  className="rounded-xl bg-emerald-700 shadow-xl shadow-emerald-700/20 text-white font-black uppercase text-[10px] tracking-widest px-6 hover:bg-emerald-800"
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
          {detail.journalNumber && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[10px] text-emerald-700 dark:text-emerald-300 md:col-span-2">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Contabilizada: asiento <strong className="font-black">{detail.journalNumber}</strong>
                {detail.journalDate ? ` del ${new Date(detail.journalDate).toLocaleDateString()}` : ''} generado con los movimientos del estado de cuenta.
                Verás el movimiento bancario en Libro Diario, Libro Mayor, Balance de Comprobación, Estado de Resultados, Balance General y Flujo de Efectivo.
              </span>
            </div>
          )}
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-[10px] text-muted-foreground">Cuenta</p><p className="text-xs font-black">{detail.account?.code} - {detail.account?.name}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Banco</p><p className="text-xs font-black">{detail.bank ? `${detail.bank.bankName} · ${detail.bank.accountNumber}` : 'No vinculado a una cuenta bancaria'}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Período</p><p className="text-xs font-black">{detail.period}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Rango</p><p className="text-xs font-black">{detail.startDate ? new Date(detail.startDate).toLocaleDateString() : 'N/A'} → {detail.endDate ? new Date(detail.endDate).toLocaleDateString() : 'N/A'}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Lógica de la conciliación</p>
              <div className="space-y-2 rounded-xl border border-border/40 bg-muted/10 p-3 text-[11px] leading-relaxed text-muted-foreground">
                <p><span className="font-black text-foreground">1.</span> Cada fila es un movimiento del libro contable de la cuenta.</p>
                <p><span className="font-black text-foreground">2.</span> Marca <span className="font-bold text-foreground">✓ Conciliado</span> los movimientos que el banco ya registró.</p>
                <p><span className="font-black text-foreground">3.</span> Saldo conciliado = saldo inicial (libros) + movimientos conciliados.</p>
                <p><span className="font-black text-foreground">4.</span> Cuadra cuando <span className="font-bold text-foreground">Saldo conciliado = Saldo final del estado de cuenta</span> (diferencia 0). La diferencia es lo que se concilia.</p>
                <p><span className="font-black text-foreground">5.</span> Al <span className="font-bold text-foreground">Completar</span>, los movimientos azules "Estado de cuenta" (comisiones, intereses) se contabilizan como asiento de conciliación y aparecen en Libro Diario, Libro Mayor, Comprobación, Resultados, Balance General y Flujo de Efectivo.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Estado del cuadre</p>
                <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest px-3 py-1', detail.isBalanced ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20')}>
                  {detail.isBalanced ? 'Cuadrada' : 'Sin cuadrar'}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                  <p className="text-[10px] text-muted-foreground">Saldo Inicial (libros)</p>
                  <p className="text-lg font-black tabular-nums">{formatAmount(detail.startBalance)}</p>
                  <p className="text-[9px] text-muted-foreground">Calculado por el sistema</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                  <p className="text-[10px] text-muted-foreground">Conciliados ({detail.matchedCount || 0}/{detail.totalCount || 0})</p>
                  <p className="text-lg font-black tabular-nums">{matchedNet >= 0 ? '+' : ''}{matchedNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <p className="text-[9px] text-muted-foreground">Neto marcado ✓</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-emerald-500/5 p-3">
                  <p className="text-[10px] text-emerald-600">Saldo Conciliado</p>
                  <p className="text-lg font-black tabular-nums text-emerald-600">{formatAmount(detail.expectedEndBalance)}</p>
                  <p className="text-[9px] text-muted-foreground">Inicial + conciliados</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                  <p className="text-[10px] text-muted-foreground">Saldo en libros al cierre</p>
                  <p className="text-lg font-black tabular-nums">{formatAmount(detail.closingBookBalance)}</p>
                  <p className="text-[9px] text-muted-foreground">Inicial + todos los movimientos del mes</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                  <p className="text-[10px] text-muted-foreground">Saldo Final del Banco (estado de cuenta)</p>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bankEndInput}
                    disabled={detail.status === 'COMPLETED' || !canPerform('ACCOUNTING_RECONCILIATION', 'edit')}
                    onChange={(e) => setBankEndInput(e.target.value)}
                    onBlur={handleEndBalanceBlur}
                    placeholder="0.00"
                    className="h-8 w-full text-sm font-black tabular-nums"
                  />
                  <p className="text-[9px] text-muted-foreground">Dato del estado de cuenta; se guarda al salir del campo</p>
                </div>
                <div className={cn('rounded-xl border p-3', detail.isBalanced ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5')}>
                  <p className={cn('text-[10px] font-black uppercase tracking-widest', detail.isBalanced ? 'text-emerald-600' : 'text-rose-600')}>Diferencia</p>
                  <p className={cn('mt-0.5 text-lg font-black tabular-nums', detail.isBalanced ? 'text-emerald-600' : 'text-rose-600')}>
                    {detail.isBalanced ? `${detail.bank?.currency === 'USD' ? 'US$' : 'C$'} 0.00 ✓` : formatAmount(detail.difference)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {detail.isBalanced
                      ? 'El saldo conciliado coincide con el estado de cuenta: la conciliación pasa.'
                      : 'No cuadra: revisa los movimientos marcados o el saldo del estado de cuenta.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Movimientos</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <Checkbox checked={onlyUnmatched} onCheckedChange={(c) => setOnlyUnmatched(!!c)} disabled={detail.status === 'COMPLETED'} />
                  Solo sin conciliar
                </label>
                {detail.status !== 'COMPLETED' && canPerform('ACCOUNTING_RECONCILIATION', 'edit') && (
                  <Button variant="outline" size="sm" className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest" onClick={() => setAddItemOpen(true)}>
                    <Plus className="mr-1.5 size-3" /> Movimiento del banco
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Descripción</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Referencia</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Débito</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Crédito</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Monto en el banco</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Conciliado</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detail.items || []).filter((item: any) => !onlyUnmatched || !item.matched).length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground/50 italic py-8">Sin movimientos registrados</TableCell></TableRow>
                  )}
                  {(detail.items || []).filter((item: any) => !onlyUnmatched || !item.matched).map((item: any) => (
                    <TableRow key={item.id} className={cn(item.matched && 'bg-emerald-500/5')}>
                      <TableCell className="text-xs font-mono">{item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}</TableCell>
                      <TableCell className="text-xs font-medium">{item.description || 'N/A'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.reference || 'N/A'}</TableCell>
                      <TableCell className="text-xs tabular-nums text-right">{Number(item.debit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-xs tabular-nums text-right">{Number(item.credit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.bankAmount ?? ''}
                          disabled={detail.status === 'COMPLETED' || !canPerform('ACCOUNTING_RECONCILIATION', 'edit')}
                          onChange={(e) => {
                            const updatedItems = (detail.items || []).map((i: any) => i.id === item.id ? { ...i, bankAmount: e.target.value === '' ? null : Number(e.target.value) } : i);
                            setDetail({ ...detail, items: updatedItems });
                          }}
                          onBlur={() => handleBankAmountBlur(item)}
                          placeholder="—"
                          className="ml-auto h-8 w-28 rounded-lg text-right text-xs tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={!!item.matched}
                          disabled={detail.status === 'COMPLETED' || !canPerform('ACCOUNTING_RECONCILIATION', 'edit')}
                          onCheckedChange={(c) => toggleMatched(item.id, !!c)}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {item.source === 'STATEMENT' && (
                          <Badge variant="outline" className="mr-1 mb-0.5 bg-blue-500/10 text-blue-600 border-blue-500/20 text-[8px] font-black uppercase tracking-widest">Estado de cuenta</Badge>
                        )}
                        {item.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-black uppercase tracking-tight">Movimiento del Estado de Cuenta</DialogTitle>
              <DialogDescription className="text-xs">Movimiento que el banco registró y el libro contable no (ej. comisión = Débito, interés a favor = Crédito). Entra al cuadre con su signo.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de movimiento</Label>
                <Select value={addItemForm.type} onValueChange={(v) => setAddItemForm({ ...addItemForm, type: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBIT" className="text-xs">Débito del banco (cargo / comisión)</SelectItem>
                    <SelectItem value="CREDIT" className="text-xs">Crédito del banco (abono / interés)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</Label>
                <DateField value={addItemForm.date} onChange={(v) => setAddItemForm({ ...addItemForm, date: v })} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto</Label>
                <Input type="number" min="0" step="0.01" value={addItemForm.amount} onChange={(e) => setAddItemForm({ ...addItemForm, amount: e.target.value })} placeholder="0.00" className="h-9 text-xs" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción</Label>
                <Input value={addItemForm.description} onChange={(e) => setAddItemForm({ ...addItemForm, description: e.target.value })} placeholder="Ej. Comisión bancaria de julio" className="h-9 text-xs" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Referencia (opcional)</Label>
                <Input value={addItemForm.reference} onChange={(e) => setAddItemForm({ ...addItemForm, reference: e.target.value })} placeholder="Ej. Nº de movimiento del banco" className="h-9 text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddItemOpen(false)} className="rounded-xl text-[10px] font-black uppercase tracking-widest">Cancelar</Button>
              <Button onClick={handleAddItem} disabled={addItemLoading} className="rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                <Plus className="size-3 mr-2" /> Agregar Movimiento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
      <div className="min-w-0 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Conciliación Bancaria</h2>
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
          {canPerform('ACCOUNTING_RECONCILIATION', 'create') && (
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
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Saldo Inicial (libros)</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Saldo Banco</TableHead>
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
                    {r.bank && <p className="text-[9px] text-muted-foreground/60">{r.bank.bankName} · {r.bank.accountNumber}</p>}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{r.period}</TableCell>
                  <TableCell className="text-xs tabular-nums text-right">{r.bank?.currency === 'USD' ? 'US$' : 'C$'} {Number(r.startBalance || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-xs tabular-nums text-right">{r.bank?.currency === 'USD' ? 'US$' : 'C$'} {Number(r.endBalance || 0).toLocaleString()}</TableCell>
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
                <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-black">{r.account?.code}</p><p className="break-words text-[10px] text-muted-foreground">{r.account?.name}</p>{r.bank && <p className="text-[9px] text-muted-foreground/60">{r.bank.bankName} · {r.bank.accountNumber}</p>}</div><Badge variant="outline" className={cn('shrink-0 text-[9px] font-black uppercase tracking-widest', statusStyles[r.status || 'PENDING'])}>{statusLabels[r.status || 'PENDING']}</Badge></div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/20 pt-2 text-[10px]"><div><span className="block text-muted-foreground">Período</span><span>{r.period}</span></div><div><span className="block text-muted-foreground">Fecha</span><span>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</span></div><div><span className="block text-muted-foreground">Saldo inicial (libros)</span><span>{r.bank?.currency === 'USD' ? 'US$' : 'C$'} {Number(r.startBalance || 0).toLocaleString()}</span></div><div><span className="block text-muted-foreground">Saldo banco</span><span className="font-bold">{r.bank?.currency === 'USD' ? 'US$' : 'C$'} {Number(r.endBalance || 0).toLocaleString()}</span></div></div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Nueva Conciliación Bancaria</DialogTitle>
            <DialogDescription className="text-xs">Elige la cuenta bancaria y el mes. Los saldos en libros se calculan automáticamente; solo necesitas el saldo final de tu estado de cuenta.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            <div className="col-span-2 space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuenta Bancaria</Label>
              {bankOptions.length === 0 ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10px] text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <div>
                    <p className="font-bold">No hay cuentas bancarias con cuenta contable vinculada.</p>
                    <p className="mt-1">Regístralas primero en Contabilidad → Configuración → Cuentas Bancarias para poder conciliar.</p>
                    {onGoToConfig && (
                      <Button type="button" size="sm" variant="outline" className="mt-2 h-7 rounded-lg text-[9px] font-black uppercase tracking-widest" onClick={onGoToConfig}>
                        <Landmark className="mr-1.5 size-3" /> Ir a Cuentas Bancarias
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <Combobox
                  options={bankOptions}
                  value={form.accountId || ''}
                  onChange={(value) => setForm({ ...form, accountId: value })}
                  placeholder="Seleccionar cuenta bancaria"
                  searchPlaceholder="Buscar banco, número o cuenta contable..."
                  maxVisibleOptions={100}
                  className="h-9 text-xs"
                  emptyMessage="No se encontraron cuentas bancarias."
                />
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mes de la conciliación</Label>
              <Input
                type="month"
                value={form.period}
                max={currentMonth}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo final del estado de cuenta (opcional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.endBalance}
                onChange={(e) => setForm({ ...form, endBalance: e.target.value })}
                placeholder="Lo puedes ajustar después"
                className="h-9 text-xs"
              />
            </div>
            <div className="col-span-2 space-y-2">
              {previewLoading ? (
                <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/10 p-3 text-[10px] text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Calculando saldos del libro para {form.period}...
                </div>
              ) : preview ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                      <p className="text-[9px] text-muted-foreground">Saldo inicial (libros)</p>
                      <p className="text-sm font-black tabular-nums">{preview.currency === 'USD' ? 'US$' : 'C$'} {Number(preview.startBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p className="text-[9px] text-muted-foreground">Calculado por el sistema</p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                      <p className="text-[9px] text-muted-foreground">Movimientos del mes</p>
                      <p className="text-sm font-black tabular-nums">{preview.movementCount ?? 0}</p>
                      <p className="text-[9px] text-muted-foreground">Se cargarán como filas</p>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                      <p className="text-[9px] text-muted-foreground">Saldo en libros al cierre</p>
                      <p className="text-sm font-black tabular-nums">{preview.currency === 'USD' ? 'US$' : 'C$'} {Number(preview.closingBookBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      <p className="text-[9px] text-muted-foreground">Inicial + movimientos</p>
                    </div>
                  </div>
                  {preview.existsCount > 0 && (
                    <div className={cn(
                      "flex items-start gap-2 rounded-xl border p-3 text-[10px]",
                      preview.canCreate
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
                    )}>
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span>
                        Ya existen {preview.existsCount} de {preview.maxPerMonth ?? 3} conciliaciones permitidas para esta cuenta y mes ({preview.exists?.map((e: any) => statusLabels[e.status] || e.status).join(' · ')}).
                        {preview.canCreate ? ' Puedes crear otra.' : ' Se alcanzó el máximo de 3.'}
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-xl text-[10px] font-black uppercase tracking-widest">Cancelar</Button>
            <Button onClick={handleCreate} disabled={bankOptions.length === 0 || (preview ? !preview.canCreate : false)} className="rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
              <Landmark className="size-3 mr-2" /> Crear Conciliación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
