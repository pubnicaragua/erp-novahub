import { useState } from 'react';
import { AlertTriangle, CalendarClock, Gift } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { DateField } from '../ui/DateField';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { hrService } from '../../services/hr.service';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { useCurrency } from '../../contexts/CurrencyContext';
import { normalizeCurrency } from '../../utils/currency';

interface AguinaldoRow {
  employeeId: string;
  employeeNumber: string;
  name: string;
  department: string | null;
  hireDate: string;
  monthlySalary: number;
  currency: string;
  daysAccrued: number;
  daysAtPeriodEnd: number;
  accruedToDate: number;
  payableAtDeadline: number;
  needsReview: boolean;
}

interface AguinaldoReport {
  asOf: string;
  periodStart: string;
  periodEnd: string;
  paymentDeadline: string;
  totals: Array<{ currency: string; accruedToDate: number; payableAtDeadline: number }>;
  data: AguinaldoRow[];
}

const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const longDate = (iso: string) => new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Aguinaldo (décimo tercer mes) de Nicaragua: acumulado a la fecha elegida y monto a pagar
 * a más tardar el 10 de diciembre, calculado con la fecha de contratación de cada empleado.
 */
export function AguinaldoPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const { formatExplicitAmount } = useCurrency();
  const [asOf, setAsOf] = useState(todayISO);
  const query = useTenantQuery<AguinaldoReport>(
    ['hr', 'aguinaldo', asOf],
    (signal) => hrService.getAguinaldo(asOf, signal) as Promise<AguinaldoReport>,
    { enabled: Boolean(asOf) },
  );
  const report = query.data;
  const money = (amount: number, currency: string) => formatExplicitAmount(amount, normalizeCurrency(currency));

  const shell = (children: React.ReactNode) => (embedded
    ? <div className="space-y-4" data-testid="hr-aguinaldo-panel">{children}</div>
    : <Card className="mb-4 rounded-2xl border-border/60 bg-card/80 shadow-sm" data-testid="hr-aguinaldo-panel"><CardContent className="space-y-4 p-3 sm:p-4">{children}</CardContent></Card>);

  return shell(
    <>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest"><Gift className="size-4 text-primary" aria-hidden /> Aguinaldo (décimo tercer mes)</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Un mes de salario por período completo (1 dic – 30 nov); si el empleado ingresó después, se paga la parte proporcional desde su fecha de contratación. Se paga a más tardar el 10 de diciembre.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Calcular a la fecha</Label>
            <DateField value={asOf} onChange={setAsOf} placeholder="Fecha" title="Fecha de cálculo del aguinaldo" className="h-10 w-full sm:w-[170px]" />
          </div>
        </div>

        {query.isLoading && <p className="text-xs text-muted-foreground" role="status">Calculando aguinaldo…</p>}
        {query.isError && <p className="text-xs text-destructive" role="alert">No se pudo calcular el aguinaldo. Intenta de nuevo.</p>}

        {report && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="size-4" aria-hidden />
              <span>Período {longDate(report.periodStart)} – {longDate(report.periodEnd)}</span>
              <Badge variant="outline" className="text-[10px] font-bold">Pago límite: {longDate(report.paymentDeadline)}</Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {report.totals.length === 0 && <p className="text-xs text-muted-foreground">No hay empleados activos para calcular.</p>}
              {report.totals.map((total) => (
                <div key={total.currency} className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 p-3 sm:col-span-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Acumulado al {longDate(report.asOf)} ({total.currency})</p>
                    <p className="mt-1 text-xl font-black tabular-nums">{money(total.accruedToDate, total.currency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">A pagar al {longDate(report.paymentDeadline)} ({total.currency})</p>
                    <p className="mt-1 text-xl font-black tabular-nums text-primary">{money(total.payableAtDeadline, total.currency)}</p>
                  </div>
                </div>
              ))}
            </div>

            {report.data.length > 0 && (
              <Table containerClassName="max-h-[420px]" className="min-w-[860px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {['Empleado', 'Contratación', 'Salario mensual', 'Días acumulados', 'Acumulado a la fecha', 'A pagar el 10 de dic.'].map((heading) => (
                      <TableHead key={heading} className="whitespace-nowrap text-[10px] uppercase tracking-widest">{heading}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.data.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell className="min-w-0">
                        <div className="font-bold">{row.name}</div>
                        <div className="text-[11px] text-muted-foreground">{row.employeeNumber}{row.department ? ` · ${row.department}` : ''}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{longDate(row.hireDate)}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{money(row.monthlySalary, row.currency)}</TableCell>
                      <TableCell className="tabular-nums">{row.daysAccrued} de {row.daysAtPeriodEnd}</TableCell>
                      <TableCell className="whitespace-nowrap font-bold tabular-nums">{money(row.accruedToDate, row.currency)}</TableCell>
                      <TableCell className="whitespace-nowrap font-bold tabular-nums text-primary">
                        {row.needsReview
                          ? <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="size-3.5" aria-hidden /> Revisar salario</span>
                          : money(row.payableAtDeadline, row.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="text-[11px] text-muted-foreground">
              Se calcula con el salario mensual actual de cada empleado y meses de 30 días (360 días al año). Los empleados dados de baja no se incluyen; su aguinaldo proporcional se liquida con la liquidación final.
            </p>
          </>
        )}
    </>,
  );
}
