import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from '@/app/services/toast';
import { useAuth } from '../../contexts/AuthContext';
import { getApiErrorMessage } from '../../services/api';
import { loanInstallmentsService } from '../../services/finanzas.service';
import { getCurrencyDecimalPlaces } from '../../utils/currency';

interface InstallmentRow { id: string; sequence: number; dueDate: string; principal: number | string; interest: number | string; total: number; status: string; paidAt?: string | null }

const money = (value: unknown) => Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: getCurrencyDecimalPlaces(), maximumFractionDigits: getCurrencyDecimalPlaces() });
const shortDate = (value: unknown) => (value ? new Date(String(value)).toLocaleDateString('es-NI', { timeZone: 'UTC' }) : '—');
const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendiente', PAID: 'Pagada', CANCELLED: 'Cancelada' };

/** Tabla de pagos de un préstamo o financiamiento recibido, con registro de pago (capital + intereses). */
export function LoanInstallmentsPanel({ incomeId, currency, canPay }: { incomeId: string; currency?: string; canPay: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const tenantKey = user?.clientTenantId || user?.tenantId || 'current';
  const [payingId, setPayingId] = useState<string | null>(null);
  const [method, setMethod] = useState<'CASH' | 'TRANSFER' | 'CHECK'>('CASH');
  const [bankAccountId, setBankAccountId] = useState('');
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ['finance', 'loan-installments', tenantKey, incomeId],
    queryFn: () => loanInstallmentsService.getAll({ incomeId }),
  });
  const rows: InstallmentRow[] = Array.isArray(query.data) ? (query.data as InstallmentRow[]) : [];

  const pay = async (id: string) => {
    if (busy) return;
    if (method !== 'CASH' && !bankAccountId) return toast.error('Selecciona el banco de donde sale el pago');
    setBusy(true);
    try {
      await loanInstallmentsService.pay(id, { paymentMethod: method, bankAccountId: method === 'CASH' ? undefined : bankAccountId });
      toast.success('Cuota pagada');
      setPayingId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['finance', 'loan-installments'] }),
        queryClient.invalidateQueries({ queryKey: ['finance', 'income'] }),
      ]);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo pagar la cuota'));
    } finally {
      setBusy(false);
    }
  };

  if (query.isLoading) return <p className="text-xs text-muted-foreground">Cargando tabla de pagos…</p>;
  if (query.isError) return <p className="text-xs text-destructive">No se pudo cargar la tabla de pagos.</p>;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">Este movimiento no tiene tabla de pagos.</p>;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tabla de pagos ({currency || 'NIO'})</p>
      <div className="max-h-64 overflow-auto rounded-lg border border-border/60">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-muted text-left">
            <tr><th className="p-2">#</th><th className="p-2">Vence</th><th className="p-2 text-right">Capital</th><th className="p-2 text-right">Interés</th><th className="p-2 text-right">Cuota</th><th className="p-2">Estado</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border/40">
                <td className="p-2">{row.sequence}</td>
                <td className="p-2">{shortDate(row.dueDate)}</td>
                <td className="p-2 text-right">{money(row.principal)}</td>
                <td className="p-2 text-right">{money(row.interest)}</td>
                <td className="p-2 text-right font-bold">{money(row.total)}</td>
                <td className="p-2">{STATUS_LABEL[row.status] || row.status}{row.paidAt ? ` · ${shortDate(row.paidAt)}` : ''}</td>
                <td className="p-2 text-right">
                  {canPay && row.status === 'PENDING' && (
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setPayingId(payingId === row.id ? null : row.id)}>Pagar</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payingId && (
        <div className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sale de</p>
            <Select value={method} onValueChange={(value) => setMethod(value as 'CASH' | 'TRANSFER' | 'CHECK')}>
              <SelectTrigger aria-label="Forma de pago" className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Caja (efectivo)</SelectItem>
                <SelectItem value="TRANSFER">Banco (transferencia)</SelectItem>
                <SelectItem value="CHECK">Banco (cheque)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {method !== 'CASH' && <BankAccountSelect value={bankAccountId} onChange={setBankAccountId} currency={currency} label="Banco" />}
          <div className="flex items-end">
            <Button size="sm" className="h-8 text-xs" disabled={busy} onClick={() => pay(payingId)}>{busy ? 'Pagando…' : 'Confirmar pago'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
