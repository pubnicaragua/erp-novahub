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
import { todayIso } from '../../utils/dateFormat';
import { useAuth } from '../../contexts/AuthContext';
import { beginNotificationAction, completeNotificationAction, failNotificationAction } from '../../services/notification-action-coordinator';

export interface AdjustableAccount { id: string; code: string; name: string; type: string; currency?: string }

interface Props {
  account: AdjustableAccount | null;
  /** Cuentas que pueden ser contrapartida (activas, posteables y sin subcuentas). */
  counterOptions: AdjustableAccount[];
  onClose: () => void;
  onDone: () => void;
}

const DEFAULT_CONCEPT = 'Diferencia cambiaria';

/** La contrapartida más probable: una cuenta cuyo nombre habla de diferencial o diferencia cambiaria. */
export function suggestCounterAccountId(options: AdjustableAccount[], accountId: string): string {
  const match = options.find((item) => item.id !== accountId && /cambiari/i.test(item.name));
  return match?.id ?? '';
}

export function AccountBalanceAdjustDialog({ account, counterOptions, onClose, onDone }: Props) {
  const { user } = useAuth();
  const timeZone = user?.clientTenant?.timeZone;
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState(DEFAULT_CONCEPT);
  const [date, setDate] = useState(() => todayIso(timeZone));
  const [counterId, setCounterId] = useState('');
  const [saving, setSaving] = useState(false);
  // Un mismo envío repetido (doble clic) no duplica el asiento: el servidor reconoce este identificador.
  // Se crea al primer intento de guardar y se reutiliza en los reintentos de este mismo diálogo.
  const requestId = useRef('');
  const suggested = useMemo(() => (account ? suggestCounterAccountId(counterOptions, account.id) : ''), [account, counterOptions]);
  const effectiveCounter = counterId || suggested;
  const options = useMemo(
    () => counterOptions.filter((item) => item.id !== account?.id).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })),
    [counterOptions, account?.id],
  );
  const numericAmount = Number(amount);
  const valid = Number.isFinite(numericAmount) && numericAmount > 0 && Boolean(effectiveCounter) && Boolean(concept.trim()) && Boolean(date);

  const save = async () => {
    if (!account || !valid || saving) return;
    if (!requestId.current) {
      requestId.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    }
    const token = beginNotificationAction();
    setSaving(true);
    try {
      const result: any = await contabilidadService.adjustAccountBalance(account.id, {
        amount: numericAmount, direction, concept: concept.trim(), date, counterAccountId: effectiveCounter, requestId: requestId.current,
      });
      toast.success(`Ajuste registrado${result?.number ? ` (${result.number})` : ''}`);
      completeNotificationAction(token);
      onDone();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo registrar el ajuste');
      failNotificationAction(token);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={account !== null} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-md" data-testid="accounting-balance-adjust-dialog">
        <DialogHeader>
          <DialogTitle>Ajustar saldo</DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">{account?.code} · {account?.name}</span>. Se registra un asiento ya publicado, sin documento de soporte.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4 py-2" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Efecto del ajuste">
            {([['INCREASE', 'Aumentar saldo'], ['DECREASE', 'Disminuir saldo']] as const).map(([value, label]) => (
              <Button
                key={value} type="button" role="radio" aria-checked={direction === value}
                variant={direction === value ? 'default' : 'outline'} className="h-11" onClick={() => setDirection(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjust-amount" className="text-base">Monto del ajuste{account?.currency ? ` (${account.currency})` : ''}</Label>
            <Input
              id="adjust-amount" data-testid="accounting-adjust-amount" type="number" inputMode="decimal" min="0" step="0.01" autoFocus
              className="h-11 text-base" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjust-concept">Concepto</Label>
            <Input id="adjust-concept" data-testid="accounting-adjust-concept" maxLength={200} value={concept} onChange={(event) => setConcept(event.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adjust-date">Fecha</Label>
              <DateField id="adjust-date" value={date} onChange={setDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-counter">Contra la cuenta</Label>
              <Combobox
                id="adjust-counter" options={options} value={effectiveCounter} onChange={setCounterId} className="h-9"
                placeholder="Elige la cuenta" searchPlaceholder="Buscar por nombre o código..." emptyMessage="Sin cuentas coincidentes"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            La otra mitad del asiento va a la cuenta que elijas (por ejemplo, ingreso o gasto por diferencial cambiario). El saldo sube o baja exactamente el monto indicado.
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" data-testid="accounting-adjust-save" disabled={!valid || saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Registrar ajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
