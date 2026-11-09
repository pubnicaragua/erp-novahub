import { useState } from 'react';
import { AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { getCashOutlook, type CashOutlookEvent } from '../../services/hr.service';

const KIND_LABEL: Record<CashOutlookEvent['kind'], string> = { PAYROLL: 'Nómina', PAYROLL_PROJECTED: 'Nómina por procesar', RECURRING: 'Gasto recurrente', SUPPLIER: 'Proveedor', RECEIVABLE: 'Por cobrar' };
const dayText = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('es-NI', { day: 'numeric', month: 'short' });
const STYLE = {
  COVERED: { icon: CheckCircle2, tone: 'border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100', title: 'Tienes cubiertos los próximos pagos' },
  TIGHT: { icon: AlertTriangle, tone: 'border-amber-300/60 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100', title: 'Cubres los pagos solo si cobras al ritmo habitual' },
  SHORT: { icon: TrendingDown, tone: 'border-red-300/60 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100', title: 'No alcanza: habría que financiar desde las cuentas de la empresa' },
} as const;

/** «¿Me alcanza?»: nómina, gastos recurrentes y proveedores de los próximos días frente al efectivo y lo que se espera cobrar. */
export function CashOutlookCard() {
  const { canPerform } = useAuth();
  const allowed = canPerform('HR_PAYROLL', 'view');
  const [days, setDays] = useState(15);
  const query = useTenantQuery(['dashboard', 'cash-outlook', days], (signal) => getCashOutlook(days, signal), { enabled: allowed, staleTime: 60_000, retry: 0 });
  if (!allowed || query.isError) return null;
  if (query.isLoading || !query.data) return <Skeleton className="h-40 w-full rounded-2xl" aria-busy="true" />;
  const data = query.data;
  const money = (amount: number) => `${data.currency} ${new Intl.NumberFormat('es-NI', { maximumFractionDigits: 0 }).format(amount)}`;
  const style = STYLE[data.status];
  const Icon = style.icon;
  const hasObligations = data.outflow > 0;
  if (!hasObligations && data.overdueOutflow === 0) return null;
  const rows = data.timeline.filter((event) => event.direction === 'OUT' || event.kind === 'RECEIVABLE').slice(0, 10);

  return (
    <Card className="min-w-0 space-y-4 rounded-2xl p-4" data-testid="cash-outlook">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-widest">¿Me alcanza para lo que viene?</h2>
        <div role="group" aria-label="Ventana de tiempo" className="flex gap-1">
          {[7, 15, 30].map((value) => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)} className={cn('rounded-lg border px-2.5 py-1 text-[11px] font-bold', days === value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50')}>{value} días</button>)}
        </div>
      </div>

      <div className={cn('flex items-start gap-3 rounded-xl border p-3', style.tone)} role="status">
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-black">{style.title}</p>
          <p className="mt-0.5">
            {data.nextPayroll ? <>Próxima nómina: <b>{money(data.nextPayroll.amount)}</b> el {dayText(data.nextPayroll.date)}. </> : null}
            {data.shortfall ? <>El {dayText(data.shortfall.date)} faltarían <b>{money(data.shortfall.amount)}</b>{data.status === 'TIGHT' ? ', pero al ritmo de cobro de los últimos 30 días se cubre' : ''}. </> : <>El saldo no baja de <b>{money(data.minBalance)}</b> en los próximos {data.windowDays} días. </>}
            {data.overdueOutflow > 0 && <>Tienes <b>{money(data.overdueOutflow)}</b> ya atrasado por pagar.</>}
          </p>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Efectivo en cuentas', money(data.cash)],
          [`Por pagar en ${data.windowDays} días`, money(data.outflow)],
          ['Por cobrar en el plazo', money(data.inflowDue)],
          ['Ritmo de cobro (30 días)', `${money(data.runRate)} en ${data.windowDays} d`],
        ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl bg-muted/30 p-3"><dt className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-lg font-black tabular-nums">{value}</dd></div>)}
      </dl>
      <p className="text-xs text-muted-foreground">De lo que sale: nómina {money(data.breakdown.payroll)} · gastos recurrentes {money(data.breakdown.recurring)} · proveedores {money(data.breakdown.suppliers)}.{data.receivablesOverdue > 0 ? ` Además tienes ${money(data.receivablesOverdue)} vencido por cobrar que no se cuenta como seguro.` : ''}</p>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-muted/40 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Concepto</th><th className="px-3 py-2 text-right">Monto</th><th className="px-3 py-2 text-right">Saldo después</th></tr></thead>
            <tbody>{rows.map((event, index) => (
              <tr key={`${event.date}-${index}`} className="border-t border-border/40">
                <td className="whitespace-nowrap px-3 py-1.5">{event.overdue ? <span className="font-bold text-red-700">Atrasado</span> : dayText(event.date)}</td>
                <td className="px-3 py-1.5"><span className="text-[10px] font-black uppercase text-muted-foreground">{KIND_LABEL[event.kind]}</span> · {event.label}</td>
                <td className={cn('whitespace-nowrap px-3 py-1.5 text-right tabular-nums', event.direction === 'IN' ? 'text-emerald-700' : '')}>{event.direction === 'IN' ? '+' : '−'}{money(event.amount)}</td>
                <td className={cn('whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums', event.balanceAfter < 0 ? 'text-red-700' : '')}>{money(event.balanceAfter)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
