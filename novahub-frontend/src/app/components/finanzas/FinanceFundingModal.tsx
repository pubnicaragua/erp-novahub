import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { DateField } from '../ui/DateField';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from '@/app/services/toast';
import { useAuth } from '../../contexts/AuthContext';
import { getApiErrorMessage } from '../../services/api';
import { accountsService, incomeService } from '../../services/finanzas.service';
import { storageService } from '../../services/storage.service';
import { INCOME_KIND_OPTIONS, isLoanKind, previewLoanSchedule, type IncomeKind } from './incomeKinds';
import { getCurrencyDecimalPlaces } from '../../utils/currency';

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fieldLabel = 'mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground';

interface AccountRow { id: string; code: string; name: string; type?: string; isActive?: boolean; acceptsPostings?: boolean }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se invoca tras guardar para refrescar listados. */
  onSaved: () => void | Promise<void>;
  exchangeRate?: number;
}

/** El formulario solo se monta con el diálogo abierto, así cada apertura empieza con valores limpios. */
export function FinanceFundingModal({ open, onOpenChange, onSaved, exchangeRate }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {open && <FundingForm onClose={() => onOpenChange(false)} onSaved={onSaved} exchangeRate={exchangeRate} />}
      </DialogContent>
    </Dialog>
  );
}

function FundingForm({ onClose, onSaved, exchangeRate }: { onClose: () => void; onSaved: Props['onSaved']; exchangeRate?: number }) {
  const { user } = useAuth();
  const tenantKey = user?.clientTenantId || user?.tenantId || 'current';
  const [kind, setKind] = useState<IncomeKind>('PARTNER_CONTRIBUTION');
  const [accountOverride, setAccountOverride] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'NIO' | 'USD'>('NIO');
  const [date, setDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'CHECK'>('CASH');
  const [bankAccountId, setBankAccountId] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [withSchedule, setWithSchedule] = useState(true);
  const [interestRate, setInterestRate] = useState('0');
  const [termMonths, setTermMonths] = useState('12');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [scheduleMethod, setScheduleMethod] = useState<'FRENCH' | 'EQUAL_PRINCIPAL'>('FRENCH');
  const [saving, setSaving] = useState(false);

  const option = INCOME_KIND_OPTIONS.find((item) => item.value === kind)!;
  const loan = isLoanKind(kind);

  const accountsQuery = useQuery({
    queryKey: ['finance', 'accounts', tenantKey, 'funding-modal'],
    queryFn: ({ signal }) => accountsService.getAll({ page: 1, pageSize: 500 }, signal),
    staleTime: 60_000,
  });
  const accounts = useMemo<AccountRow[]>(() => {
    const response = accountsQuery.data as unknown;
    const rows = Array.isArray(response) ? response : (response as { data?: unknown } | undefined)?.data;
    const list: AccountRow[] = Array.isArray(rows) ? rows : [];
    return list.filter((account) => account.isActive !== false && account.acceptsPostings !== false
      && String(account.type || '').toUpperCase() === option.accountType);
  }, [accountsQuery.data, option.accountType]);

  // La cuenta contable se sugiere según el tipo (3000 Capital social, 2600/2610 pasivos) y siempre es editable.
  const suggestedAccount = accounts.find((account) => account.code === option.defaultCode) || accounts[0];
  const accountId = accounts.some((account) => account.id === accountOverride) ? accountOverride : (suggestedAccount?.id || '');

  const amountNumber = Number(amount);
  const preview = useMemo(
    () => (loan && withSchedule
      ? previewLoanSchedule(amountNumber, Number(interestRate) || 0, Math.trunc(Number(termMonths)), firstDueDate || nextMonth(date), scheduleMethod)
      : []),
    [loan, withSchedule, amountNumber, interestRate, termMonths, firstDueDate, date, scheduleMethod],
  );
  const totalInterest = preview.reduce((sum, row) => sum + row.interest, 0);

  const save = async () => {
    if (saving) return;
    if (!(amountNumber > 0)) return toast.error('Ingresa un monto mayor a cero');
    if (!accountId) return toast.error('Selecciona la cuenta contable');
    if (kind !== 'OPERATING' && !counterparty.trim()) return toast.error(`Indica ${option.counterpartyLabel.toLowerCase()}`);
    if (kind !== 'OPERATING' && paymentMethod !== 'CASH' && !bankAccountId) return toast.error('Selecciona el banco destino');
    if (loan && withSchedule && (!Number.isInteger(Number(termMonths)) || Number(termMonths) < 1)) return toast.error('El plazo debe ser de al menos 1 mes');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        kind,
        accountId,
        amount: amountNumber,
        currency,
        exchangeRate: currency === 'NIO' ? 1 : exchangeRate,
        date,
        description: description.trim() || option.label,
        source: kind === 'OPERATING' ? 'Manual' : option.label,
        category: kind === 'OPERATING' ? 'OTROS' : kind,
        notes: notes.trim() || undefined,
      };
      if (kind !== 'OPERATING') {
        Object.assign(payload, { counterpartyName: counterparty.trim(), paymentMethod, bankAccountId: paymentMethod === 'CASH' ? undefined : bankAccountId });
        if (evidence) {
          if (evidence.size > MAX_EVIDENCE_BYTES) { setSaving(false); return toast.error('El soporte es muy pesado. Máximo 10 MB'); }
          try {
            const uploaded = await storageService.uploadFile('purchase-evidence', evidence, { folder: 'financiamiento' });
            Object.assign(payload, { evidenceFileUrl: uploaded.uri, evidenceFileName: evidence.name, evidenceFileType: evidence.type, evidenceFileSize: evidence.size });
          } catch {
            setSaving(false);
            return toast.error('No se pudo procesar el archivo adjunto');
          }
        }
        if (loan) {
          Object.assign(payload, { interestRate: Number(interestRate) || 0 });
          if (withSchedule) Object.assign(payload, { termMonths: Math.trunc(Number(termMonths)), firstDueDate: firstDueDate || nextMonth(date), scheduleMethod });
        }
      }
      await incomeService.create(payload as Parameters<typeof incomeService.create>[0]);
      toast.success(`${option.label} registrado`);
      await onSaved();
      onClose();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo guardar el movimiento'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
        <DialogHeader>
          <DialogTitle>Nuevo movimiento de entrada de dinero</DialogTitle>
          <DialogDescription>{option.help}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className={fieldLabel}>Tipo de movimiento *</p>
            <Select value={kind} onValueChange={(value) => { setKind(value as IncomeKind); setAccountOverride(''); }}>
              <SelectTrigger aria-label="Tipo de movimiento" className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INCOME_KIND_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className={fieldLabel}>Cuenta contable ({option.accountType === 'EQUITY' ? 'Patrimonio' : option.accountType === 'LIABILITY' ? 'Pasivo' : 'Ingreso'}) *</p>
            <Select value={accountId} onValueChange={setAccountOverride}>
              <SelectTrigger aria-label="Cuenta contable" className="h-8 text-xs"><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
              <SelectContent>
                {accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code} · {account.name}</SelectItem>)}
                {accounts.length === 0 && <SelectItem value="__none__" disabled>No hay cuentas de este tipo</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className={fieldLabel}>Monto *</p>
            <Input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} aria-label="Monto" className="h-8 text-xs" currencyPrecision />
          </div>
          <div>
            <p className={fieldLabel}>Moneda</p>
            <Select value={currency} onValueChange={(value) => setCurrency(value as 'NIO' | 'USD')}>
              <SelectTrigger aria-label="Moneda" className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="NIO">Córdobas (NIO)</SelectItem><SelectItem value="USD">Dólares (USD)</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <p className={fieldLabel}>Fecha *</p>
            <DateField value={date} onChange={setDate} />
          </div>
          {kind !== 'OPERATING' && (
            <>
              <div>
                <p className={fieldLabel}>Entra a *</p>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'CASH' | 'TRANSFER' | 'CHECK')}>
                  <SelectTrigger aria-label="Forma de ingreso" className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Caja (efectivo)</SelectItem>
                    <SelectItem value="TRANSFER">Banco (transferencia)</SelectItem>
                    <SelectItem value="CHECK">Banco (cheque)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod !== 'CASH' && (
                <BankAccountSelect value={bankAccountId} onChange={setBankAccountId} currency={currency} label="Banco destino" />
              )}
              <div>
                <p className={fieldLabel}>{option.counterpartyLabel} *</p>
                <Input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} aria-label={option.counterpartyLabel} className="h-8 text-xs" />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <p className={fieldLabel}>Descripción</p>
            <Input value={description} onChange={(event) => setDescription(event.target.value)} aria-label="Descripción" className="h-8 text-xs" />
          </div>
          {kind !== 'OPERATING' && (
            <div className="sm:col-span-2">
              <p className={fieldLabel}>Soporte adjunto (contrato, comprobante, acta)</p>
              <Input type="file" accept="image/*,application/pdf" aria-label="Soporte adjunto" className="h-9 text-xs" onChange={(event) => setEvidence(event.target.files?.[0] || null)} />
            </div>
          )}
        </div>

        {loan && (
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <label className="flex items-center gap-2 text-xs font-bold">
              <input type="checkbox" checked={withSchedule} onChange={(event) => setWithSchedule(event.target.checked)} />
              Generar tabla de pagos (capital e intereses) como cuentas por pagar
            </label>
            <div className="grid gap-3 sm:grid-cols-4">
              <div><p className={fieldLabel}>Tasa anual %</p><Input type="number" min="0" step="0.01" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} aria-label="Tasa anual" className="h-8 text-xs" /></div>
              {withSchedule && (
                <>
                  <div><p className={fieldLabel}>Plazo (meses)</p><Input type="number" min="1" max="600" step="1" value={termMonths} onChange={(event) => setTermMonths(event.target.value)} aria-label="Plazo en meses" className="h-8 text-xs" /></div>
                  <div><p className={fieldLabel}>Primera cuota</p><DateField value={firstDueDate || nextMonth(date)} onChange={setFirstDueDate} /></div>
                  <div>
                    <p className={fieldLabel}>Método</p>
                    <Select value={scheduleMethod} onValueChange={(value) => setScheduleMethod(value as 'FRENCH' | 'EQUAL_PRINCIPAL')}>
                      <SelectTrigger aria-label="Método de cuota" className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="FRENCH">Cuota nivelada</SelectItem><SelectItem value="EQUAL_PRINCIPAL">Capital fijo</SelectItem></SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            {preview.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-lg border border-border/60">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted text-left"><tr><th className="p-2">#</th><th className="p-2">Vence</th><th className="p-2 text-right">Capital</th><th className="p-2 text-right">Interés</th><th className="p-2 text-right">Cuota</th></tr></thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr key={row.sequence} className="border-t border-border/40">
                        <td className="p-2">{row.sequence}</td><td className="p-2">{row.dueDate}</td>
                        <td className="p-2 text-right">{row.principal.toFixed(getCurrencyDecimalPlaces())}</td><td className="p-2 text-right">{row.interest.toFixed(getCurrencyDecimalPlaces())}</td>
                        <td className="p-2 text-right font-bold">{(row.principal + row.interest).toFixed(getCurrencyDecimalPlaces())}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {preview.length > 0 && <p className="text-[11px] text-muted-foreground">Intereses totales estimados: {totalInterest.toFixed(getCurrencyDecimalPlaces())} {currency}. El interés se registra como gasto financiero al pagar cada cuota.</p>}
          </div>
        )}

        <div>
          <p className={fieldLabel}>Notas</p>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} aria-label="Notas" className="min-h-16 text-xs" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
    </>
  );
}

function nextMonth(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year) return '';
  const target = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
