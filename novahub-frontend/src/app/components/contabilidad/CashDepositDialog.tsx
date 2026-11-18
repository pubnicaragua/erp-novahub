import { useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Combobox } from '../ui/Combobox';
import { DateField } from '../ui/DateField';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from '@/app/services/toast';
import { contabilidadService } from '../../services/contabilidad.service';
import { useAccountingQuery } from '../../hooks/useAccountingQuery';
import { todayIso } from '../../utils/dateFormat';
import { useAuth } from '../../contexts/AuthContext';
import { beginNotificationAction, completeNotificationAction, failNotificationAction } from '../../services/notification-action-coordinator';

interface Props {
  open: boolean;
  /** Banco que ya está elegido en el libro; se sugiere como destino. */
  suggestedBankId?: string;
  onClose: () => void;
  onDone: () => void;
}

const money = (value: number) => value.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Depositar el efectivo que entró a Caja a un banco, en cualquier momento (no solo al cerrar una caja).
 * Débito al banco elegido y crédito a la caja; el asiento queda publicado y se ve en el Libro Diario y en el de Bancos.
 */
export function CashDepositDialog({ open, suggestedBankId, onClose, onDone }: Props) {
  const { user } = useAuth();
  const timeZone = user?.clientTenant?.timeZone;
  const context = useAccountingQuery(['cash-deposit-context'], (signal) => contabilidadService.getCashDepositContext(signal), { enabled: open });
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(() => todayIso(timeZone));
  const [saving, setSaving] = useState(false);
  // Un doble clic no duplica el asiento: el servidor reconoce este identificador y se reutiliza en los reintentos.
  const requestId = useRef('');

  const banks = useMemo(() => context.data?.banks || [], [context.data]);
  const options = useMemo(
    () => banks.map((bank) => ({
      label: `${bank.label} (${bank.currency})${bank.depositable ? '' : ' — otra moneda'}`,
      value: bank.id,
      disabled: !bank.depositable,
    })),
    [banks],
  );
  const effectiveBank = bankId || (banks.find((bank) => bank.id === suggestedBankId && bank.depositable)?.id ?? '');
  const source = context.data?.sourceAccount || null;
  const numericAmount = Number(amount);
  const valid = Number.isFinite(numericAmount) && numericAmount > 0 && Boolean(effectiveBank) && Boolean(date);
  const exceeds = Boolean(source) && valid && numericAmount > (source?.balance ?? 0) + 0.005;

  const save = async () => {
    if (!valid || saving) return;
    if (!requestId.current) {
      requestId.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    }
    const token = beginNotificationAction();
    setSaving(true);
    try {
      const result = await contabilidadService.depositCashToBank({
        bankAccountId: effectiveBank, amount: numericAmount, date, reference: reference.trim() || undefined, requestId: requestId.current,
      });
      toast.success(`Depósito registrado${result?.number ? ` (${result.number})` : ''}`);
      completeNotificationAction(token);
      requestId.current = '';
      setAmount(''); setReference('');
      onDone();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo registrar el depósito');
      failNotificationAction(token);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-md" data-testid="accounting-cash-deposit-dialog">
        <DialogHeader>
          <DialogTitle>Depositar efectivo a un banco</DialogTitle>
          <DialogDescription>
            Elige a cuál banco va el efectivo que está en caja. Se registra un asiento publicado: débito al banco, crédito a la caja.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4 py-2" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            {context.isLoading && <span className="text-muted-foreground">Cargando la caja…</span>}
            {!context.isLoading && source && <span>Sale de <strong>{source.code} · {source.name}</strong> — saldo actual {money(source.balance)}</span>}
            {!context.isLoading && !source && <span className="text-muted-foreground">No encontré la cuenta de caja configurada; se usará la cuenta de efectivo de Configuración contable.</span>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="deposit-bank">Banco al que va el efectivo</Label>
            <Combobox
              id="deposit-bank" options={options} value={effectiveBank} onChange={setBankId} className="h-9"
              placeholder="Elige el banco" searchPlaceholder="Buscar banco..." emptyMessage="No hay bancos con cuenta contable vinculada"
            />
            {!context.isLoading && banks.length === 0 && (
              <p className="text-xs text-destructive">No hay bancos activos con cuenta contable. Créalos o vincúlalos en Contabilidad › Cuentas bancarias.</p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="deposit-amount">Monto ({context.data?.baseCurrency || 'NIO'})</Label>
              <Input id="deposit-amount" data-testid="accounting-deposit-amount" type="number" inputMode="decimal" min="0" step="0.01" autoFocus
                className="h-11 text-base" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deposit-date">Fecha</Label>
              <DateField id="deposit-date" value={date} onChange={setDate} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deposit-reference">Referencia (opcional)</Label>
            <Input id="deposit-reference" maxLength={200} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Número de boleta o nota" />
          </div>
          {exceeds && <p className="text-xs font-medium text-amber-600" role="status">El monto es mayor que el saldo de la caja ({money(source!.balance)}). Revisa que todo el efectivo ya esté registrado.</p>}
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" data-testid="accounting-deposit-save" disabled={!valid || saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Depositar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
