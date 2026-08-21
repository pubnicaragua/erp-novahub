import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Loader2, Landmark, AlertTriangle, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Combobox } from '../ui/Combobox';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { contabilidadService } from '../../services/contabilidad.service';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../ui/utils';
import { paymentMethodLabel } from '../../utils/paymentMethods';

const ACCOUNT_TYPES = [
  { value: 'CHECKING', label: 'Cuenta Corriente' },
  { value: 'SAVINGS', label: 'Cuenta de Ahorro' },
];

const CURRENCIES = ['NIO', 'USD'];

const SUBTYPE_LABELS: Record<string, string> = {
  MAIN_GROUP: 'Grupo principal',
  GROUP: 'Grupo',
  DETAIL_ACCOUNT: 'Cuenta de detalle',
  SUBACCOUNT: 'Subcuenta',
};

export function BankAccountsView() {
  const { canPerform } = useAuth();
  const canCreateBankAccount = canPerform('ACCOUNTING', 'create');
  const canEditBankAccount = canPerform('ACCOUNTING', 'edit');
  const canDeactivateBankAccount = canPerform('ACCOUNTING', 'deactivate');
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [detailAccount, setDetailAccount] = useState<any>(null);
  const [form, setForm] = useState({ bankName: '', accountNumber: '', accountType: 'CHECKING', currency: 'NIO', notes: '', accountId: '', cardCommissionPercent: 0, cardCommissionAccountId: '' });

  const accountsQuery = useAccountingQuery<any[]>(['bank-accounts'], async (signal) => accountingList(await api.get('/bank-accounts', { signal })));
  const accounts = accountsQuery.data || [];
  const loading = accountsQuery.isLoading || accountsQuery.isFetching;
  const movementQuery = useAccountingQuery<any>(
    ['bank-account-movements', detailAccount?.id || 'none'],
    async (signal) => contabilidadService.getBankAccountMovements(detailAccount.id, { page: 1, pageSize: 100 }, signal),
    { enabled: Boolean(detailAccount?.id) },
  );
  const movementPayload = movementQuery.data || {};
  const movements = Array.isArray(movementPayload.data) ? movementPayload.data : [];

  // Plan de cuentas del tenant: solo cuentas de activo, de detalle/subcuenta
  // (hojas), activas y posteables. Se priorizan las de la misma moneda que el
  // banco (C$ para NIO, US$ para USD) y se muestra la jerarquía código + nombre.
  // Las cuentas contables contienen IDs propios del tenant. Solicitar una
  // lectura fresca evita que el formulario conserve un accountId de otra
  // empresa después de cambiar de sesión/tenant.
  const chartQuery = useAccountingQuery<any[]>(['accounts'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(true, signal)));
  const chartAccounts = useMemo(() => {
    const flat: any[] = [];
    const flatten = (items: any[]) => items.forEach((item: any) => {
      flat.push({
        id: item.id, code: item.code, name: item.name, type: item.type,
        subtype: item.subtype, currency: item.currency || 'NIO',
        parentId: item.parentId, parentCode: item.parentCode || item.parent?.code || null,
        isLeaf: !(Array.isArray(item.children) && item.children.length > 0),
        isActive: item.isActive !== false,
        acceptsPostings: item.acceptsPostings !== false,
      });
      if (Array.isArray(item.children)) flatten(item.children);
    });
    flatten(chartQuery.data || []);
    return flat;
  }, [chartQuery.data]);

  const accountOptions = useMemo(() => {
    const options = chartAccounts
      .filter((a) => String(a.type || '').toUpperCase() === 'ASSET' && a.isLeaf && a.isActive && a.acceptsPostings)
      .map((a) => ({
        value: a.id,
        code: a.code,
        name: a.name,
        currency: a.currency,
        subtype: a.subtype,
        parentCode: a.parentCode,
      }))
      .sort((x, y) => {
        const mx = x.currency === form.currency ? 0 : 1;
        const my = y.currency === form.currency ? 0 : 1;
        return mx - my || x.code.localeCompare(y.code);
      });
    return options.map((a) => ({
      value: a.value,
      label: `${a.code} · ${a.name}`,
      description: `${a.currency}${a.parentCode ? ` · Hijo de ${a.parentCode}` : ''} · ${SUBTYPE_LABELS[a.subtype] || 'Cuenta de detalle'}${a.currency === form.currency ? ' · Coincide con la moneda del banco' : ''}`,
    }));
  }, [chartAccounts, form.currency]);

  const selectedChartAccount = useMemo(() => {
    if (!form.accountId) return null;
    return chartAccounts.find((a) => a.id === form.accountId) || null;
  }, [form.accountId, chartAccounts]);

  const openCreate = () => {
    if (!canCreateBankAccount) return;
    setEditing(null);
    setForm({ bankName: '', accountNumber: '', accountType: 'CHECKING', currency: 'NIO', notes: '', accountId: '', cardCommissionPercent: 0, cardCommissionAccountId: '' });
    setFormOpen(true);
  };

  const openEdit = (a: any) => {
    if (!canEditBankAccount) return;
    setEditing(a);
    setForm({ bankName: a.bankName, accountNumber: a.accountNumber, accountType: a.accountType, currency: a.currency, notes: a.notes || '', accountId: a.accountId || '', cardCommissionPercent: Number(a.cardCommissionPercent || 0), cardCommissionAccountId: a.cardCommissionAccountId || '' });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (editing ? !canEditBankAccount : !canCreateBankAccount) return;
    if (!form.bankName || !form.accountNumber) { toast.error('Banco y número de cuenta son requeridos'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/bank-accounts/${editing.id}`, form);
        toast.success('Cuenta bancaria actualizada');
      } else {
        await api.post('/bank-accounts', form);
        toast.success('Cuenta bancaria creada');
      }
      setFormOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canDeactivateBankAccount) return;
    try {
      await api.delete(`/bank-accounts/${id}`);
      toast.success('Cuenta bancaria eliminada');
      await queryClient.invalidateQueries({ queryKey: ['accounting'] });
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Error al eliminar'));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 px-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Landmark className="size-4 text-primary" />
            <CardTitle className="text-sm font-black uppercase tracking-tight">Cuentas Bancarias</CardTitle>
          </div>
          {canCreateBankAccount && <Button size="sm" onClick={openCreate} className="rounded-xl gap-1 font-bold text-xs uppercase tracking-widest h-8">
            <Plus className="size-3.5" /> Agregar
          </Button>}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div className="space-y-2">
        <div className="hidden overflow-x-auto rounded-xl border border-border/30 md:block">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-[10px] font-bold">Banco</TableHead>
                <TableHead className="text-[10px] font-bold">Número de Cuenta</TableHead>
                <TableHead className="text-[10px] font-bold">Tipo</TableHead>
                <TableHead className="text-[10px] font-bold">Moneda</TableHead>
                <TableHead className="text-[10px] font-bold">Comisión Tarjeta</TableHead>
                <TableHead className="text-[10px] font-bold">Cuenta Contable</TableHead>
                <TableHead className="text-[10px] font-bold">Estado</TableHead>
                <TableHead className="text-[10px] font-bold text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="size-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : accounts.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">Sin cuentas bancarias registradas</TableCell></TableRow>
              ) : accounts.map(a => {
                const linked = chartAccounts.find((acc) => acc.id === a.accountId);
                return (
                <TableRow key={a.id}>
                  <TableCell className="text-xs font-medium">{a.bankName}</TableCell>
                  <TableCell className="text-xs font-mono">{a.accountNumber}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[9px]">{ACCOUNT_TYPES.find(t => t.value === a.accountType)?.label || a.accountType}</Badge></TableCell>
                  <TableCell className="text-xs">{a.currency}</TableCell>
                  <TableCell className="text-xs font-mono">{Number(a.cardCommissionPercent || 0).toFixed(2)}%</TableCell>
                  <TableCell className="text-xs">
                    {linked ? (
                      <>
                        <span className="font-mono font-bold">{linked.code}</span>
                        <span className="text-muted-foreground"> · {linked.name}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/60">Sin vincular</span>
                    )}
                  </TableCell>
                  <TableCell><Badge variant={a.isActive ? 'default' : 'secondary'} className="text-[9px]">{a.isActive ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="size-7 text-primary" title="Ver movimientos del banco" aria-label={`Ver movimientos de ${a.bankName}`} onClick={() => setDetailAccount(a)}><Eye className="size-3.5" /></Button>
                    {canEditBankAccount && <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(a)}><Edit2 className="size-3.5" /></Button>}
                    {canDeactivateBankAccount && <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => handleDelete(a.id)}><Trash2 className="size-3.5" /></Button>}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="space-y-2 md:hidden">
          {accounts.map(a => (
            <div key={a.id} className="min-w-0 rounded-xl border border-border/30 bg-muted/20 p-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-xs font-bold">{a.bankName}</p>
                  <p className="mt-1 break-all text-[10px] font-mono text-muted-foreground">{a.accountNumber}</p>
                </div>
                <Badge variant={a.isActive ? 'default' : 'secondary'} className="shrink-0 text-[9px]">{a.isActive ? 'Activo' : 'Inactivo'}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/20 pt-2 text-[10px] text-muted-foreground">
                <span>{ACCOUNT_TYPES.find(t => t.value === a.accountType)?.label || a.accountType} · {a.currency}</span>
                <span className="text-muted-foreground">Comisión: {Number(a.cardCommissionPercent || 0).toFixed(2)}%</span>
                <span className="shrink-0">
                  <Button variant="ghost" size="icon" className="size-7 text-primary" title="Ver movimientos del banco" aria-label={`Ver movimientos de ${a.bankName}`} onClick={() => setDetailAccount(a)}><Eye className="size-3.5" /></Button>
                  {canEditBankAccount && <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(a)}><Edit2 className="size-3.5" /></Button>}
                  {canDeactivateBankAccount && <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => handleDelete(a.id)}><Trash2 className="size-3.5" /></Button>}
                </span>
              </div>
              <div className="mt-2 border-t border-border/20 pt-2 text-[10px] text-muted-foreground">
                <span className="block text-muted-foreground">Cuenta contable</span>
                {(() => {
                  const linked = chartAccounts.find((acc) => acc.id === a.accountId);
                  return linked
                    ? <span className="font-mono font-bold text-foreground">{linked.code} · {linked.name}</span>
                    : <span className="text-muted-foreground/60">Sin vincular</span>;
                })()}
              </div>
            </div>
          ))}
        </div>
        </div>
      </CardContent>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar' : 'Nueva'} Cuenta Bancaria</DialogTitle>
            <DialogDescription>Registra una cuenta bancaria de la empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Banco</label>
                <Input value={form.bankName} onChange={e => setForm({...form, bankName: e.target.value})} placeholder="BAC, Lafise, etc." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Número de Cuenta</label>
                <Input value={form.accountNumber} onChange={e => setForm({...form, accountNumber: e.target.value})} placeholder="000-000-000" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Tipo</label>
                <Select value={form.accountType} onValueChange={v => setForm({...form, accountType: v})}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Moneda</label>
                <Select value={form.currency} onValueChange={v => setForm({...form, currency: v})}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold">Comisión por tarjeta (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.cardCommissionPercent || ''}
                onChange={e => {
                  const val = e.target.value;
                  const num = val === '' ? 0 : Number(val);
                  if (num >= 0 && num <= 100) setForm({...form, cardCommissionPercent: num});
                }}
                placeholder="0.00"
                className="h-9 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Porcentaje que cobra el banco/procesador por pagos con tarjeta. Opcional.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold">Cuenta contable de comisiones bancarias</label>
              <Combobox
                options={chartAccounts
                  .filter((a) => String(a.type || '').toUpperCase() === 'EXPENSE' && a.isLeaf && a.isActive && a.acceptsPostings)
                  .map((a) => ({
                    value: a.id,
                    label: `${a.code} · ${a.name}`,
                    description: `${a.currency}${a.parentCode ? ` · Hijo de ${a.parentCode}` : ''} · ${SUBTYPE_LABELS[a.subtype] || 'Cuenta de detalle'}`,
                  }))}
                value={form.cardCommissionAccountId || ''}
                onChange={(v) => setForm({ ...form, cardCommissionAccountId: v })}
                placeholder="Seleccionar cuenta de gastos (ej. 5300-003 Comisiones bancarias)"
                searchPlaceholder="Buscar por código o nombre..."
                maxVisibleOptions={200}
                className="h-9 text-xs"
                emptyMessage="No hay cuentas de gastos disponibles. Crea la cuenta en el Plan de Cuentas."
              />
              <p className="text-[10px] text-muted-foreground">Cuenta donde se registrará el gasto por comisión de tarjeta. Si está vacía, se usará la cuenta global de gastos bancarios.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold">Cuenta Contable Hija (movimientos y conciliaciones)</label>
              <Combobox
                options={accountOptions}
                value={form.accountId || ''}
                onChange={(v) => setForm({ ...form, accountId: v })}
                placeholder="Seleccionar cuenta hija (ej. 1101-001-001 LAFISE)"
                searchPlaceholder="Buscar por código o nombre..."
                maxVisibleOptions={200}
                className="h-9 text-xs"
                emptyMessage="No hay cuentas de activo de detalle disponibles. Crea la cuenta en el Plan de Cuentas."
              />
              {selectedChartAccount && (
                <div className="flex items-start gap-1.5 rounded-lg border border-border/40 bg-muted/10 p-2 text-[10px]">
                  {selectedChartAccount.currency === form.currency ? (
                    <span className="text-emerald-600">✓ {selectedChartAccount.code} · {selectedChartAccount.name} · Moneda {selectedChartAccount.currency} coincide con el banco.</span>
                  ) : (
                    <span className="flex items-start gap-1.5 text-amber-600">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      {selectedChartAccount.code} · {selectedChartAccount.name} es de moneda {selectedChartAccount.currency}, pero el banco es {form.currency}. Si el plan separa cuentas por moneda (ej. Cuentas Córdobas vs Cuentas Dólares), vincula la correcta.
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold">Notas</label>
              <textarea className="w-full min-h-[50px] rounded-lg border border-input bg-background p-2 text-sm" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            {(editing ? canEditBankAccount : canCreateBankAccount) && <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="size-3.5 mr-1 animate-spin" />}Guardar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailAccount)} onOpenChange={(open) => !open && setDetailAccount(null)}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-4xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight"><Landmark className="size-4 text-primary" /> Movimientos de la cuenta bancaria</DialogTitle>
            <DialogDescription>
              {detailAccount ? `${detailAccount.bankName} · ${detailAccount.accountNumber} · ${detailAccount.currency || 'NIO'}` : ''}. Los ingresos y egresos se vinculan con la cuenta hija; su saldo se consolida en la cuenta mayor configurada. Esta vista no crea un asiento adicional.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo neto vinculado (base NIO)</p>
              <p className={cn('mt-1 text-xl font-black', Number(movementPayload.totalBaseAmount || 0) < 0 ? 'text-rose-600' : 'text-primary')}>C$ {Number(movementPayload.totalBaseAmount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Entradas vinculadas (base NIO)</p>
              <p className="mt-1 text-xl font-black text-emerald-600">C$ {Number(movementPayload.incomingBaseAmount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Salidas vinculadas (base NIO)</p>
              <p className="mt-1 text-xl font-black text-rose-600">C$ {Number(movementPayload.outgoingBaseAmount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Movimientos consultados</p>
              <p className="mt-1 text-xl font-black">{movementPayload.total || 0}</p>
            </div>
          </div>
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-border/40">
            <Table>
              <TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-bold">Fecha</TableHead><TableHead className="text-[10px] font-bold">Origen</TableHead><TableHead className="text-[10px] font-bold">Método</TableHead><TableHead className="text-[10px] font-bold">Referencia</TableHead><TableHead className="text-right text-[10px] font-bold">Monto base</TableHead><TableHead className="text-[10px] font-bold">Estado</TableHead></TableRow></TableHeader>
              <TableBody>
                {movementQuery.isLoading ? <TableRow><TableCell colSpan={6} className="py-8 text-center"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow>
                  : movements.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">Aún no hay pagos vinculados a esta cuenta bancaria.</TableCell></TableRow>
                    : movements.map((movement: any) => <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap text-xs">{movement.date ? new Date(movement.date).toLocaleDateString('es-NI') : '—'}</TableCell>
                      <TableCell className="text-xs font-medium">{movement.sourceNumber || movement.paymentReceived?.number || movement.paymentMade?.number || movement.sourceType || '—'}</TableCell>
                      <TableCell className="text-xs">{paymentMethodLabel(movement.method)}</TableCell>
                      <TableCell className="max-w-40 truncate text-xs text-muted-foreground">{movement.reference || '—'}</TableCell>
                      <TableCell className={cn('text-right text-xs font-black', movement.direction === 'OUT' ? 'text-rose-600' : 'text-emerald-600')}>{movement.direction === 'OUT' ? '-' : '+'}C$ {Number(movement.baseAmount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge variant={movement.status === 'POSTED' ? 'default' : 'secondary'} className="text-[9px]">{movement.status === 'POSTED' ? 'Activo' : 'Cancelado'}</Badge></TableCell>
                    </TableRow>)}
              </TableBody>
            </Table>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDetailAccount(null)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
