import { useState } from 'react';
import { Banknote, Download, Landmark, Loader2, Plus, Star } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Skeleton } from '../../ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import {
  ACCOUNT_TYPE_LABEL, PAYMENT_KIND_LABEL, employeeProfileService, type PaymentAccount, type PaymentKind,
} from '../../../services/employee-profile.service';

const select = 'h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';
const fmt = (value: number, currency: string) => `${currency} ${new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2 }).format(value)}`;
const failure = (error: unknown) => (error as any)?.response?.data?.message?.toString?.() || (error as Error)?.message || 'No se pudo guardar.';
const today = () => new Date().toISOString().slice(0, 10);

function AccountDialog({ employeeId, account, onClose, onSaved }: { employeeId: string; account: PaymentAccount | null; onClose: () => void; onSaved: () => void }) {
  const [bankName, setBankName] = useState(account?.bankName ?? '');
  const [accountType, setAccountType] = useState(account?.accountType ?? 'SAVINGS');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency] = useState(account?.currency ?? 'NIO');
  const [holderName, setHolderName] = useState(account?.holderName ?? '');
  const [isPrimary, setIsPrimary] = useState(account?.isPrimary ?? false);
  const [busy, setBusy] = useState(false);
  const valid = bankName.trim() && (account ? true : accountNumber.replace(/\s+/g, '').length >= 6);

  const save = async () => {
    setBusy(true);
    try {
      const data = { bankName: bankName.trim(), accountType, currency, holderName: holderName.trim() || undefined, isPrimary, ...(accountNumber.trim() ? { accountNumber: accountNumber.trim() } : {}) };
      if (account) await employeeProfileService.updateAccount(employeeId, account.id, data);
      else await employeeProfileService.createAccount(employeeId, data as any);
      toast.success('Cuenta guardada');
      onSaved();
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{account ? 'Editar cuenta de pago' : 'Nueva cuenta de pago'}</DialogTitle><DialogDescription>Cuenta a la que se le paga a este empleado. Puede tener varias; la principal es la que se usa por defecto.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="acc-bank">Banco</Label><Input id="acc-bank" value={bankName} maxLength={80} onChange={(e) => setBankName(e.target.value)} placeholder="BAC, Banpro, Lafise…" /></div>
          <div className="space-y-1.5"><Label htmlFor="acc-type">Tipo de cuenta</Label><select id="acc-type" className={select} value={accountType} onChange={(e) => setAccountType(e.target.value)}>{Object.entries(ACCOUNT_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="acc-number">Número de cuenta{account ? ' (déjalo vacío para no cambiarlo)' : ''}</Label><Input id="acc-number" inputMode="numeric" autoComplete="off" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder={account ? account.accountNumber : '3010 2030 4050'} /></div>
          <div className="space-y-1.5"><Label htmlFor="acc-cur">Moneda</Label><select id="acc-cur" className={select} value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="NIO">Córdobas (NIO)</option><option value="USD">Dólares (USD)</option></select></div>
          <div className="space-y-1.5"><Label htmlFor="acc-holder">Titular (si no es el empleado)</Label><Input id="acc-holder" value={holderName} maxLength={120} onChange={(e) => setHolderName(e.target.value)} /></div>
          <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} /> Usar como cuenta principal</label>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="button" onClick={() => void save()} disabled={busy || !valid}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Guardar</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ employeeId, accounts, onClose, onSaved }: { employeeId: string; accounts: PaymentAccount[]; onClose: () => void; onSaved: () => void }) {
  const primary = accounts.find((account) => account.isPrimary && account.isActive);
  const [kind, setKind] = useState<PaymentKind>('BONUS');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(primary?.currency ?? 'NIO');
  const [paidAt, setPaidAt] = useState(today());
  const [accountId, setAccountId] = useState(primary?.id ?? '');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await employeeProfileService.recordPayment(employeeId, { kind, amount: Number(amount), currency, paidAt, accountId: accountId || undefined, reference: reference.trim() || undefined, notes: notes.trim() || undefined });
      toast.success('Pago registrado');
      onSaved();
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Registrar un pago</DialogTitle><DialogDescription>Para pagos hechos fuera de la nómina (bono, comisión, aguinaldo, liquidación u otros). Los pagos de nómina se registran solos.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="pay-kind">Tipo</Label><select id="pay-kind" className={select} value={kind} onChange={(e) => setKind(e.target.value as PaymentKind)}>{Object.entries(PAYMENT_KIND_LABEL).filter(([value]) => value !== 'PAYROLL').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="pay-date">Fecha de pago</Label><Input id="pay-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="pay-amount">Monto</Label><Input id="pay-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="pay-cur">Moneda</Label><select id="pay-cur" className={select} value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="NIO">NIO</option><option value="USD">USD</option></select></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pay-acc">Cuenta donde se pagó</Label><select id="pay-acc" className={select} value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="">Sin cuenta (efectivo u otra)</option>{accounts.filter((account) => account.isActive).map((account) => <option key={account.id} value={account.id}>{account.bankName} · ****{account.last4} ({account.currency})</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="pay-ref">Referencia</Label><Input id="pay-ref" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder="N.º de transferencia" /></div>
          <div className="space-y-1.5"><Label htmlFor="pay-notes">Notas</Label><Input id="pay-notes" value={notes} maxLength={400} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="button" onClick={() => void save()} disabled={busy || !(Number(amount) > 0)}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Registrar</Button></div>
      </DialogContent>
    </Dialog>
  );
}

/** Pestaña «Pagos»: cuentas bancarias del empleado e historial de todo lo que se le ha pagado. */
export function EmployeePaymentsPanel({ employeeId, canEditAccounts, canRecordPayments, canSeePayments, employeeName }: { employeeId: string; canEditAccounts: boolean; canRecordPayments: boolean; canSeePayments: boolean; employeeName: string }) {
  const client = useQueryClient();
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PaymentAccount | 'new' | null>(null);
  const [recording, setRecording] = useState(false);
  const accounts = useTenantQuery(['hr', 'employee-accounts', employeeId], (signal) => employeeProfileService.getAccounts(employeeId, signal), { staleTime: 15_000 });
  const history = useTenantQuery(['hr', 'employee-payments', employeeId, kind, page], (signal) => employeeProfileService.getPayments(employeeId, { kind: kind || undefined, page }, signal), { enabled: canSeePayments, staleTime: 15_000 });
  const refresh = () => void client.invalidateQueries({ queryKey: ['tenant-module'] });

  const exportCsv = async () => {
    try {
      const rows: string[][] = [['Fecha', 'Tipo', 'Monto', 'Moneda', 'Banco', 'Cuenta', 'Referencia', 'Notas']];
      for (let current = 1; current <= 40; current += 1) {
        const result = await employeeProfileService.getPayments(employeeId, { kind: kind || undefined, page: current });
        for (const item of result.items) rows.push([item.paidAt.slice(0, 10), PAYMENT_KIND_LABEL[item.kind] ?? item.kind, String(item.amount), item.currency, item.bankName ?? '', item.accountLast4 ? `****${item.accountLast4}` : '', item.reference ?? '', item.notes ?? '']);
        if (current * result.pageSize >= result.total) break;
      }
      const csv = String.fromCharCode(0xFEFF) + `${rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n')}`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      link.download = `pagos-${employeeName.replace(/\s+/g, '-').toLowerCase()}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) { toast.error(failure(error)); }
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><Landmark className="size-4 text-primary" /> Cuentas de pago</h3>
          {canEditAccounts && <Button type="button" size="sm" variant="outline" onClick={() => setEditing('new')}><Plus className="mr-1.5 size-4" /> Agregar cuenta</Button>}
        </div>
        {accounts.isLoading ? <Skeleton className="h-20 w-full" aria-busy="true" />
          : accounts.isError ? <p className="text-sm text-destructive" role="alert">No se pudieron cargar las cuentas.</p>
          : !accounts.data?.length ? <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Este empleado no tiene cuentas de pago registradas.</p>
          : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {accounts.data.map((account) => (
                <li key={account.id} className={`min-w-0 rounded-xl border p-3 ${account.isActive ? 'border-border/60' : 'border-dashed border-border/40 opacity-60'}`}>
                  <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{account.bankName}</span>{account.isPrimary && <Badge className="gap-1 text-[10px]"><Star className="size-3" aria-hidden /> Principal</Badge>}{!account.isActive && <Badge variant="outline" className="text-[10px]">Inactiva</Badge>}</div>
                  <p className="mt-1 font-mono text-sm tabular-nums">{account.accountNumber}</p>
                  <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType} · {account.currency}{account.holderName ? ` · Titular: ${account.holderName}` : ''}</p>
                  {canEditAccounts && (
                    <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                      <button type="button" className="text-primary underline dark:text-accent" onClick={() => setEditing(account)}>Editar</button>
                      {account.isActive && !account.isPrimary && <button type="button" className="text-primary underline dark:text-accent" onClick={() => void employeeProfileService.updateAccount(employeeId, account.id, { isPrimary: true }).then(refresh).catch((error) => toast.error(failure(error)))}>Hacer principal</button>}
                      <button type="button" className="text-muted-foreground underline" onClick={() => void employeeProfileService.updateAccount(employeeId, account.id, { isActive: !account.isActive }).then(refresh).catch((error) => toast.error(failure(error)))}>{account.isActive ? 'Desactivar' : 'Activar'}</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        {accounts.data?.some((account) => account.masked) && <p className="text-[11px] text-muted-foreground">Por seguridad solo se muestran los últimos 4 dígitos. El número completo lo ve quien puede editar expedientes.</p>}
      </Card>

      {canSeePayments && (
        <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><Banknote className="size-4 text-primary" /> Historial de pagos</h3>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Filtrar por tipo" className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}><option value="">Todos los tipos</option>{Object.entries(PAYMENT_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <Button type="button" size="sm" variant="outline" onClick={() => void exportCsv()} disabled={!history.data?.total}><Download className="mr-1.5 size-4" /> Exportar</Button>
              {canRecordPayments && <Button type="button" size="sm" onClick={() => setRecording(true)}><Plus className="mr-1.5 size-4" /> Registrar pago</Button>}
            </div>
          </div>
          {history.isLoading ? <Skeleton className="h-24 w-full" aria-busy="true" />
            : history.isError ? <p className="text-sm text-destructive" role="alert">No se pudo cargar el historial.</p>
            : !history.data?.items.length ? <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
            : (
              <>
                <div className="flex flex-wrap gap-2">{history.data.totals.map((total) => <Badge key={total.currency} variant="outline" className="text-xs font-bold">Total {fmt(total.amount, total.currency)}</Badge>)}</div>
                <div className="overflow-x-auto rounded-xl border border-border/50">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-muted/40 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2 text-right">Monto</th><th className="px-3 py-2">Cuenta</th><th className="px-3 py-2">Referencia</th></tr></thead>
                    <tbody>{history.data.items.map((item) => (
                      <tr key={item.id} className="border-t border-border/40"><td className="whitespace-nowrap px-3 py-2">{new Date(item.paidAt).toLocaleDateString('es-NI', { dateStyle: 'medium' })}</td><td className="px-3 py-2">{PAYMENT_KIND_LABEL[item.kind] ?? item.kind}</td><td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums">{fmt(item.amount, item.currency)}</td><td className="px-3 py-2">{item.bankName ? `${item.bankName} ****${item.accountLast4}` : 'Sin cuenta'}</td><td className="px-3 py-2 text-muted-foreground">{item.reference ?? '—'}{item.notes ? ` · ${item.notes}` : ''}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
                {history.data.total > history.data.pageSize && (
                  <div className="flex items-center justify-end gap-2 text-xs"><Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {page}</span><Button type="button" size="sm" variant="outline" disabled={page * history.data.pageSize >= history.data.total} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
                )}
              </>
            )}
        </Card>
      )}

      {editing && <AccountDialog employeeId={employeeId} account={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {recording && <PaymentDialog employeeId={employeeId} accounts={accounts.data ?? []} onClose={() => setRecording(false)} onSaved={() => { setRecording(false); refresh(); }} />}
    </div>
  );
}
