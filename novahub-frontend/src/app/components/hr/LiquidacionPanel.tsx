import { useMemo, useState } from 'react';
import { AlertTriangle, Calculator, Copy } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { DateField } from '../ui/DateField';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from '@/app/services/toast';
import { hrService } from '../../services/hr.service';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { useCurrency } from '../../contexts/CurrencyContext';
import { normalizeCurrency } from '../../utils/currency';

interface EmployeeOption { id: string; firstName?: string; lastName?: string; employeeNumber?: string }

interface SettlementLine { key: string; label: string; detail: string; amount: number }
interface SettlementResponse {
  employee: { id: string; employeeNumber: string; name: string; hireDate: string };
  terminationDate: string;
  reasonLabel: string;
  includeSeverance: boolean;
  monthlySalary: number;
  currency: string;
  vacation: { year: number; accruedInYear: number; takenInYear: number; suggestedDays: number; usedDays: number; manual: boolean };
  yearsOfService: number;
  dayValue: number;
  lines: SettlementLine[];
  total: number;
  assumptions: string[];
}

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'RENUNCIA', label: 'Renuncia' },
  { value: 'DESPIDO_SIN_CAUSA', label: 'Despido sin causa justificada' },
  { value: 'DESPIDO_CON_CAUSA', label: 'Despido con causa justificada' },
  { value: 'MUTUO_ACUERDO', label: 'Mutuo acuerdo' },
  { value: 'FIN_CONTRATO', label: 'Fin de contrato' },
];

const longDate = (iso: string) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });

const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * Liquidación final de un empleado: salario pendiente, vacaciones, aguinaldo proporcional e indemnización.
 * Es un cálculo de referencia (no registra nada): los supuestos se muestran junto al resultado.
 */
export function LiquidacionPanel({ employees }: { employees: EmployeeOption[] }) {
  const { formatExplicitAmount } = useCurrency();
  const [employeeId, setEmployeeId] = useState('');
  const [terminationDate, setTerminationDate] = useState(todayISO);
  const [reason, setReason] = useState('RENUNCIA');
  const [severance, setSeverance] = useState<'auto' | 'yes' | 'no'>('auto');
  const [unpaidDays, setUnpaidDays] = useState('');
  const [vacationDays, setVacationDays] = useState('');
  const [submitted, setSubmitted] = useState<null | Record<string, string | undefined>>(null);

  const options = useMemo(() => [...employees]
    .map((employee) => ({ id: employee.id, label: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.employeeNumber || employee.id, number: employee.employeeNumber }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es')), [employees]);

  const query = useTenantQuery<SettlementResponse>(
    ['hr', 'settlement', JSON.stringify(submitted)],
    (signal) => hrService.getEmployeeSettlement(submitted!.employeeId as string, {
      terminationDate: submitted!.terminationDate,
      reason: submitted!.reason,
      includeSeverance: submitted!.includeSeverance,
      unpaidSalaryDays: submitted!.unpaidSalaryDays,
      vacationDays: submitted!.vacationDays,
    }, signal) as Promise<SettlementResponse>,
    { enabled: Boolean(submitted), retry: false, staleTime: 0 },
  );
  const result = query.data;
  const failure = query.error as { response?: { data?: { message?: string } }; message?: string } | null;
  const errorMessage = failure?.response?.data?.message || failure?.message;
  const money = (amount: number, currency = 'NIO') => formatExplicitAmount(amount, normalizeCurrency(currency));

  const calculate = () => {
    if (!employeeId) { toast.error('Elige un empleado.'); return; }
    setSubmitted({
      employeeId,
      terminationDate,
      reason,
      includeSeverance: severance === 'auto' ? undefined : severance === 'yes' ? 'true' : 'false',
      unpaidSalaryDays: unpaidDays || undefined,
      vacationDays: vacationDays || undefined,
    });
  };

  const copySummary = async () => {
    if (!result) return;
    const text = [
      `Liquidación de ${result.employee.name} (${result.employee.employeeNumber}) — ${result.reasonLabel}`,
      `Fecha de salida: ${longDate(result.terminationDate)} · Años de servicio: ${result.yearsOfService.toFixed(2)} · Salario mensual: ${money(result.monthlySalary, result.currency)}`,
      ...result.lines.map((line) => `${line.label}: ${money(line.amount, result.currency)} (${line.detail})`),
      `TOTAL: ${money(result.total, result.currency)}`,
      '',
      ...result.assumptions.map((item) => `- ${item}`),
    ].join('\n');
    try { await navigator.clipboard.writeText(text); toast.success('Resumen copiado.'); } catch { toast.error('No se pudo copiar el resumen.'); }
  };

  return (
    <div className="space-y-4" data-testid="hr-liquidacion-panel">
      <p className="text-xs text-muted-foreground">
        Calcula cuánto corresponde pagar a un empleado que sale: salario pendiente, vacaciones, aguinaldo proporcional e indemnización. No registra nada en nómina ni contabilidad.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="liq-employee" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empleado</Label>
          <select id="liq-employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Selecciona un empleado</option>
            {options.map((option) => <option key={option.id} value={option.id}>{option.label}{option.number ? ` · ${option.number}` : ''}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha de salida</Label>
          <DateField value={terminationDate} onChange={setTerminationDate} placeholder="Fecha" title="Fecha de salida" className="h-10 w-full" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="liq-reason" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Motivo</Label>
          <select id="liq-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
            {REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="liq-severance" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Indemnización</Label>
          <select id="liq-severance" value={severance} onChange={(event) => setSeverance(event.target.value as 'auto' | 'yes' | 'no')} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="auto">Según el motivo</option>
            <option value="yes">Incluir</option>
            <option value="no">No incluir</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="liq-unpaid" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Días de salario sin pagar</Label>
          <Input id="liq-unpaid" type="number" min={0} value={unpaidDays} onChange={(event) => setUnpaidDays(event.target.value)} placeholder="0" className="h-10 tabular-nums" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="liq-vacation" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Días de vacaciones pendientes</Label>
          <Input id="liq-vacation" type="number" min={0} value={vacationDays} onChange={(event) => setVacationDays(event.target.value)} placeholder={result ? `Sugerido: ${result.vacation.suggestedDays}` : 'Automático'} className="h-10 tabular-nums" />
        </div>
        <div className="flex items-end">
          <Button type="button" className="h-10 w-full" onClick={calculate} disabled={query.isFetching}><Calculator className="mr-2 size-4" aria-hidden /> {query.isFetching ? 'Calculando…' : 'Calcular liquidación'}</Button>
        </div>
      </div>

      {query.isError && <p className="flex items-start gap-2 text-xs text-destructive" role="alert"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {errorMessage || 'No se pudo calcular la liquidación.'}</p>}

      {result && (
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black">{result.employee.name} <span className="font-normal text-muted-foreground">· {result.employee.employeeNumber}</span></p>
                <p className="text-xs text-muted-foreground">{result.reasonLabel} · salida el {longDate(result.terminationDate)} · {result.yearsOfService.toFixed(2)} año(s) de servicio · salario mensual {money(result.monthlySalary, result.currency)}</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => void copySummary()}><Copy className="mr-1.5 size-4" aria-hidden /> Copiar resumen</Button>
            </div>
            <Table containerClassName="max-h-[320px]" className="min-w-[560px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['Concepto', 'Detalle', 'Monto'].map((heading) => <TableHead key={heading} className="text-[10px] uppercase tracking-widest">{heading}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.lines.map((line) => (
                  <TableRow key={line.key}>
                    <TableCell className="font-bold">{line.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{line.detail}</TableCell>
                    <TableCell className="whitespace-nowrap font-bold tabular-nums">{money(line.amount, result.currency)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-primary/5 hover:bg-primary/5">
                  <TableCell className="font-black uppercase" colSpan={2}>Total a pagar</TableCell>
                  <TableCell className="whitespace-nowrap text-base font-black tabular-nums text-primary">{money(result.total, result.currency)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="text-[11px] text-muted-foreground">
              Vacaciones: {result.vacation.accruedInYear} día(s) devengados en {result.vacation.year}, {result.vacation.takenInYear} ya tomados o solicitados; se usan {result.vacation.usedDays}{result.vacation.manual ? ' (indicados a mano)' : ''}. Si el empleado tiene días acumulados de años anteriores, indícalos en «Días de vacaciones pendientes».
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
              {result.assumptions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
