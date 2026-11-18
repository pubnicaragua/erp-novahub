import { useState } from 'react';
import { CircleDollarSign } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useSalesIntegrationPolicy } from '../../hooks/useSalesIntegrationPolicy';
import { creditNotesService, customerLoansService } from '../../services/ventas.service';
import { createIdempotencyKey } from '../../services/api';
import { isBankPaymentMethod, requiresPaymentReference } from '../../utils/paymentMethods';
import { formatCurrencyAmount, normalizeCurrency } from '../../utils/currency';
import { toast } from '@/app/services/toast';

export type CustomerPaymentTarget = {
  id: string;
  kind: 'CREDIT_NOTE' | 'CUSTOMER_LOAN';
  number?: string;
  total?: number | string;
  balance?: number | string;
  amountPaid?: number | string;
  currency?: string;
  exchangeRate?: number | string;
  customerId?: string | null;
  customer?: { name?: string } | null;
  invoice?: { balance?: number | string; number?: string } | null;
  planEnabled?: boolean;
  nextInstallment?: { remainingAmount?: number | string; installmentNumber?: number; dueDate?: string } | null;
};

function CustomerCreditPaymentDialogForm({ target, open, onOpenChange, onPaid }: {
  target: CustomerPaymentTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid?: () => void;
}) {
  const { canPerform } = useAuth();
  const { baseCurrency, exchangeRate: globalRate } = useCurrency();
  const integration = useSalesIntegrationPolicy();
  const accountingRequired = integration.data?.accountingRequired ?? true;
  const financeEnabled = integration.data?.financeEnabled ?? true;
  const currency = normalizeCurrency(target?.currency, baseCurrency);
  const paymentExchangeRate = currency === baseCurrency ? 1 : Number(globalRate || target?.exchangeRate || 1);
  const balance = Math.max(0, Number(target?.balance ?? target?.invoice?.balance ?? Number(target?.total || 0) - Number(target?.amountPaid || 0)));
  const installmentBalance = Number(target?.nextInstallment?.remainingAmount || 0);
  const initialAmount = target?.planEnabled && installmentBalance > 0 ? Math.min(balance, installmentBalance) : balance;
  const [method, setMethod] = useState<'CASH' | 'TRANSFER' | 'CARD' | 'CHECK'>('CASH');
  const [amount, setAmount] = useState(initialAmount.toFixed(2));
  const [reference, setReference] = useState(String(target?.number || target?.invoice?.number || ''));
  const [bankAccountId, setBankAccountId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const isBankMethod = isBankPaymentMethod(method, true);
  const hasReference = requiresPaymentReference(method);

  const submit = async () => {
    if (!target) return;
    if (!canPerform('SALES_CREDIT_NOTES', 'pay')) return void toast.error('No tienes permiso para registrar este pago.');
    const numericAmount = Number(String(amount || '').replace(/,/g, ''));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > balance + 0.01) return void toast.error('Ingresa un monto mayor que cero y no superior al saldo.');
    if (hasReference && !reference.trim()) return void toast.error('La referencia es obligatoria para este método de pago.');
    if (accountingRequired && isBankMethod && !bankAccountId) return void toast.error('Selecciona el banco global donde se recibió el pago.');
    const payment = {
      method,
      amount: numericAmount,
      currency,
      exchangeRate: paymentExchangeRate,
      bankAccountId: (accountingRequired || financeEnabled) && isBankMethod ? bankAccountId : undefined,
      reference: hasReference ? reference.trim() : undefined,
    };
    setSaving(true);
    try {
      if (target.kind === 'CUSTOMER_LOAN') {
        await customerLoansService.applyPayment(target.id, { amount: numericAmount, currency, paymentMethod: method, bankAccountId: payment.bankAccountId, reference: payment.reference, payments: [payment] }, createIdempotencyKey('customer-loan-payment'));
      } else {
        await creditNotesService.apply(target.id, { amount: numericAmount, currency, paymentMethod: method, bankAccountId: payment.bankAccountId, reference: payment.reference, payments: [payment] }, createIdempotencyKey('credit-note-payment'));
      }
      toast.success(target.kind === 'CUSTOMER_LOAN' ? 'Abono registrado y enviado a Pagos Recibidos.' : 'Pago registrado y enviado a Pagos Recibidos.');
      onOpenChange(false);
      onPaid?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo registrar el pago.');
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl sm:max-w-xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><CircleDollarSign className="size-5 text-primary" /> {target?.kind === 'CUSTOMER_LOAN' ? 'Registrar abono del préstamo' : 'Registrar pago del crédito'}</DialogTitle><DialogDescription>El registro conserva el flujo contable y el historial del contrato.</DialogDescription></DialogHeader>
      {target && <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="min-w-0"><p className="break-words text-xs font-bold text-muted-foreground">{target.number || target.invoice?.number || 'Contrato'} · {target.customer?.name || 'Cliente'}</p><p className="mt-1 text-xl font-black text-primary">Saldo {formatCurrencyAmount(balance, currency)}</p>{target.nextInstallment && <p className="mt-1 text-xs text-muted-foreground">Próxima cuota #{target.nextInstallment.installmentNumber || '—'} · {formatCurrencyAmount(installmentBalance, currency)}</p>}</div><Badge variant="outline">{target.kind === 'CUSTOMER_LOAN' ? 'Préstamo' : 'Crédito'}</Badge></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="visit-payment-method">Método de pago</Label><Select value={method} onValueChange={(value) => { setMethod(value as typeof method); setBankAccountId(undefined); }}><SelectTrigger id="visit-payment-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Efectivo</SelectItem><SelectItem value="TRANSFER">Transferencia</SelectItem><SelectItem value="CARD">Tarjeta</SelectItem><SelectItem value="CHECK">Cheque</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="visit-payment-amount">Monto ({currency})</Label><Input id="visit-payment-amount" type="number" min="0.01" max={balance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
        </div>
        {(accountingRequired || financeEnabled) && isBankMethod && <BankAccountSelect currency={currency} allowUnlinked={!accountingRequired && financeEnabled} required={accountingRequired} endpoint="/bank-accounts/payment-options" value={bankAccountId} onChange={setBankAccountId} label={accountingRequired ? 'Banco global de destino' : 'Banco de destino (opcional)'} />}
        {hasReference && <div className="space-y-1.5"><Label htmlFor="visit-payment-reference" required>Referencia</Label><Input id="visit-payment-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transferencia, voucher o cheque" /></div>}
      </div>}
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button><Button type="button" onClick={() => void submit()} disabled={saving || !target || (accountingRequired && isBankMethod && !bankAccountId) || (hasReference && !reference.trim())}>{saving ? 'Registrando…' : 'Confirmar abono'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function CustomerCreditPaymentDialog(props: {
  target: CustomerPaymentTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaid?: () => void;
}) {
  return <CustomerCreditPaymentDialogForm key={`${props.open ? 'open' : 'closed'}:${props.target?.id || 'none'}`} {...props} />;
}
