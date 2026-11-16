import { Fragment, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, Building2, ChevronDown, Gift, PiggyBank, TrendingUp, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '../ui/utils';
import { SalesKpiCard } from '../ventas/SalesKpiCard';
import { hrService } from '../../services/hr.service';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { useCurrency } from '../../contexts/CurrencyContext';
import { normalizeCurrency } from '../../utils/currency';
import { AguinaldoPayDateCard } from './AguinaldoPayDateCard';

interface Concepts {
  salaries: number; bonuses: number; inssPatronal: number; inatec: number;
  aguinaldoPayment: number; aguinaldoProvision: number; vacationProvision: number; severanceProvision: number;
}
interface ProjectionMonth extends Concepts { key: string; year: number; month: number; headcount: number; cashOut: number; companyCost: number; vacationAccrued: number; severanceAccrued: number }
interface ProjectionEmployee extends Concepts { employeeId: string; name: string; department: string | null; cashOut: number; companyCost: number; socialSecurity: boolean; provisions: boolean }
export interface PayrollProjection {
  currency: string;
  from: string;
  months: ProjectionMonth[];
  totals: Concepts & { cashOut: number; companyCost: number };
  employees: ProjectionEmployee[];
  aguinaldoDates: Array<{ year: number; payDate: string; isDefault: boolean }>;
  needsReview: Array<{ employeeId: string; name: string; reason: string }>;
  warnings: string[];
}

const HORIZONS = [1, 2, 3, 4, 5, 6, 9, 12, 18, 24];
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const monthLabel = (m: Pick<ProjectionMonth, 'year' | 'month'>) => `${MONTH_NAMES[m.month - 1]} ${String(m.year).slice(2)}`;
const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const startOptions = () => {
  const now = new Date();
  return Array.from({ length: 15 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}` };
  });
};

type RowKey = keyof Concepts | 'cashOut' | 'companyCost' | 'vacationAccrued' | 'severanceAccrued' | 'headcount';
interface RowDef { key: RowKey; label: string; hint?: string; strong?: boolean; group?: string; money?: boolean; noTotal?: boolean }

const ROWS: RowDef[] = [
  { key: 'salaries', label: 'Salarios', group: 'Lo que sale de caja en el mes', money: true },
  { key: 'bonuses', label: 'Bonos de empleados', money: true },
  { key: 'inssPatronal', label: 'INSS patronal', hint: 'Solo empleados que cotizan', money: true },
  { key: 'inatec', label: 'INATEC', hint: 'Solo empleados que cotizan', money: true },
  { key: 'aguinaldoPayment', label: 'Pago de aguinaldo', hint: 'En el mes de la fecha elegida', money: true },
  { key: 'cashOut', label: 'Total a pagar en el mes', strong: true, money: true },
  { key: 'aguinaldoProvision', label: 'Provisión de aguinaldo', group: 'Provisiones del mes (se reservan, no salen de caja)', money: true },
  { key: 'vacationProvision', label: 'Provisión de vacaciones', money: true },
  { key: 'severanceProvision', label: 'Provisión de indemnización', money: true },
  { key: 'companyCost', label: 'Costo total para la empresa', hint: 'Salarios, bonos, cargas patronales y provisiones', strong: true, money: true },
  { key: 'vacationAccrued', label: 'Vacaciones acumuladas', group: 'Acumulado desde el primer mes proyectado', money: true, noTotal: true },
  { key: 'severanceAccrued', label: 'Indemnización acumulada (liquidaciones)', money: true, noTotal: true },
  { key: 'headcount', label: 'Empleados en nómina', group: 'Personal' , noTotal: true },
];

/** Proyección mensual del gasto de nómina, con filtro de cuántos meses ver y desde qué mes. */
export function PayrollProjectionPanel() {
  const { formatExplicitAmount } = useCurrency();
  const [months, setMonths] = useState(12);
  const [from, setFrom] = useState(currentMonthKey);
  const [showEmployees, setShowEmployees] = useState(false);
  const query = useTenantQuery<PayrollProjection>(
    ['hr', 'payroll-projection', from, months],
    (signal) => hrService.getPayrollProjection({ months, from }, signal) as Promise<PayrollProjection>,
  );
  const data = query.data;
  const money = (amount: number) => formatExplicitAmount(amount, normalizeCurrency(data?.currency || 'NIO'));
  const options = useMemo(() => startOptions(), []);
  const last = data?.months[data.months.length - 1];
  // Solo los años cuyo aguinaldo se paga dentro del período (noviembre, diciembre o enero siguiente), para poder mover la fecha.
  const aguinaldoYears = useMemo(() => [...new Set((data?.months || []).filter((m) => m.month >= 11 || m.month === 1).map((m) => (m.month === 1 ? m.year - 1 : m.year)))], [data]);

  return (
    <div className="space-y-4" data-testid="hr-payroll-projection">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest"><TrendingUp className="size-4 text-primary" aria-hidden /> Proyección de gastos de nómina</h3>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Cuánto vas a pagar cada mes en salarios, bonos, cargas patronales y aguinaldo, y cuánto se provisiona. Respeta lo que cada empleado tiene habilitado en nómina (INSS y provisiones).
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
          <div className="min-w-0 space-y-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desde</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="h-9 w-full text-xs sm:w-[150px]" data-testid="hr-projection-from"><SelectValue /></SelectTrigger>
              <SelectContent>{options.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ver</Label>
            <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
              <SelectTrigger className="h-9 w-full text-xs sm:w-[130px]" data-testid="hr-projection-months"><SelectValue /></SelectTrigger>
              <SelectContent>{HORIZONS.map((n) => <SelectItem key={n} value={String(n)}>{n === 1 ? '1 mes' : `${n} meses`}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {query.isLoading && <p className="text-xs text-muted-foreground" role="status">Calculando proyección…</p>}
      {query.isError && <p className="text-xs text-destructive" role="alert">No se pudo calcular la proyección. Intenta de nuevo.</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SalesKpiCard title="Total a pagar" value={money(data.totals.cashOut)} icon={Banknote} sub={`${data.months.length === 1 ? '1 mes' : `${data.months.length} meses`} · salarios, bonos, cargas y aguinaldo`} />
            <SalesKpiCard title="Costo empresa" value={money(data.totals.companyCost)} icon={Building2} sub="Incluye provisiones" />
            <SalesKpiCard title="Aguinaldo a pagar" value={money(data.totals.aguinaldoPayment)} icon={Gift} sub={data.totals.aguinaldoPayment > 0 ? `En ${data.aguinaldoDates.filter((d) => data.months.some((m) => m.key === d.payDate.slice(0, 7))).map((d) => d.payDate.split('-').reverse().join('/')).join(', ') || 'el período'}` : 'No cae en estos meses'} />
            <SalesKpiCard title="Vacaciones acumuladas" value={money(last?.vacationAccrued ?? 0)} icon={PiggyBank} sub="Al final del período" />
            <SalesKpiCard title="Indemnización acumulada" value={money(last?.severanceAccrued ?? 0)} icon={Users} sub="Reserva para liquidaciones" />
          </div>

          {aguinaldoYears.map((year) => <AguinaldoPayDateCard key={year} year={year} />)}

          {(data.needsReview.length > 0 || data.warnings.length > 0) && (
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs" role="note">
              {data.warnings.map((w) => <p key={w} className="font-semibold text-warning">{w}</p>)}
              {data.needsReview.length > 0 && (
                <>
                  <p className="flex items-center gap-1.5 font-semibold text-warning"><AlertTriangle className="size-3.5" aria-hidden /> {data.needsReview.length === 1 ? '1 empleado no se incluye' : `${data.needsReview.length} empleados no se incluyen`}:</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {data.needsReview.slice(0, 8).map((row) => <li key={row.employeeId}><span className="font-semibold text-foreground">{row.name}</span>: {row.reason}</li>)}
                    {data.needsReview.length > 8 && <li>y {data.needsReview.length - 8} más.</li>}
                  </ul>
                </>
              )}
            </div>
          )}

          <Table containerClassName="max-h-none" className="min-w-[640px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 min-w-[200px] bg-card text-[10px] uppercase tracking-widest">Concepto</TableHead>
                {data.months.map((m) => (
                  <TableHead key={m.key} className={cn('whitespace-nowrap text-right text-[10px] uppercase tracking-widest', m.aguinaldoPayment > 0 && 'text-primary')}>
                    {monthLabel(m)}{m.aguinaldoPayment > 0 && <Gift className="ml-1 inline size-3" aria-label="Mes de pago del aguinaldo" />}
                  </TableHead>
                ))}
                {data.months.length > 1 && <TableHead className="whitespace-nowrap text-right text-[10px] uppercase tracking-widest">Total</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <Fragment key={row.key}>
                  {row.group && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={data.months.length + 2} className="sticky left-0 bg-muted/30 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{row.group}</TableCell>
                    </TableRow>
                  )}
                  <TableRow className={cn(row.strong && 'bg-primary/5 font-bold')}>
                    <TableCell className={cn('sticky left-0 z-10 bg-card', row.strong && 'bg-[color-mix(in_srgb,var(--primary)_5%,var(--card))]')}>
                      <div className={cn('text-xs', row.strong ? 'font-black' : 'font-semibold')}>{row.label}</div>
                      {row.hint && <div className="text-[10px] font-normal text-muted-foreground">{row.hint}</div>}
                    </TableCell>
                    {data.months.map((m) => {
                      const value = Number((m as unknown as Record<string, number>)[row.key] || 0);
                      return <TableCell key={m.key} className={cn('whitespace-nowrap text-right text-xs tabular-nums', value === 0 && 'text-muted-foreground/60')}>{row.money ? money(value) : value}</TableCell>;
                    })}
                    {data.months.length > 1 && (
                      <TableCell className="whitespace-nowrap text-right text-xs font-bold tabular-nums">
                        {row.noTotal ? '—' : money(Number((data.totals as unknown as Record<string, number>)[row.key] || 0))}
                      </TableCell>
                    )}
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
          </Table>

          <div className="rounded-xl border border-border/60">
            <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-bold" onClick={() => setShowEmployees((v) => !v)} aria-expanded={showEmployees}>
              <span>Detalle por empleado ({data.employees.length})</span>
              <ChevronDown className={cn('size-4 transition-transform', showEmployees && 'rotate-180')} aria-hidden />
            </button>
            {showEmployees && (
              <Table containerClassName="max-h-[480px] border-t border-border/60" className="min-w-[860px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {['Empleado', 'Salarios', 'Bonos', 'INSS patronal + INATEC', 'Aguinaldo', 'Provisiones', 'Total a pagar', 'Costo empresa'].map((h) => (
                      <TableHead key={h} className={cn('whitespace-nowrap text-[10px] uppercase tracking-widest', h !== 'Empleado' && 'text-right')}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.employees.map((e) => (
                    <TableRow key={e.employeeId}>
                      <TableCell>
                        <div className="text-xs font-bold">{e.name}</div>
                        <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                          {e.department && <span>{e.department}</span>}
                          {!e.socialSecurity && <Badge variant="outline" className="px-1 py-0 text-[9px]">Sin INSS</Badge>}
                          {!e.provisions && <Badge variant="outline" className="px-1 py-0 text-[9px]">Sin provisiones</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{money(e.salaries)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{money(e.bonuses)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{money(e.inssPatronal + e.inatec)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{money(e.aguinaldoPayment)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{money(e.aguinaldoProvision + e.vacationProvision + e.severanceProvision)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs font-bold tabular-nums">{money(e.cashOut)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">{money(e.companyCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Se calcula con el salario actual de cada empleado y sus bonos registrados; el mes de entrada o salida se prorratea con meses de 30 días. No incluye horas extra ni comisiones, que dependen de lo que pase en el mes. Los montos en otra moneda se convierten con la tasa del día.
          </p>
        </>
      )}
    </div>
  );
}
