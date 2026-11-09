import { useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, TrendingDown } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { getCashOutlook, type CashOutlookEvent } from '../../services/hr.service';
import { formatCurrencyAmount } from '../../utils/currency';

const KIND_LABEL: Record<CashOutlookEvent['kind'], string> = { PAYROLL: 'Nómina', PAYROLL_PROJECTED: 'Nómina por procesar', RECURRING: 'Gasto recurrente', SUPPLIER: 'Proveedor', RECEIVABLE: 'Cobro esperado' };
const STATUS = {
  COVERED: { icon: CheckCircle2, tone: 'is-covered', title: 'Pagos próximos cubiertos', text: 'El efectivo y los cobros esperados alcanzan para lo que vence.' },
  TIGHT: { icon: AlertTriangle, tone: 'is-tight', title: 'Cobertura ajustada', text: 'Se cubre solo si los cobros llegan al ritmo de los últimos 30 días.' },
  SHORT: { icon: TrendingDown, tone: 'is-short', title: 'Cobertura insuficiente', text: 'Habría que financiar la diferencia desde las cuentas de la empresa.' },
} as const;
const dayText = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('es-NI', { day: 'numeric', month: 'short' });

/** Cobertura de pagos: nómina, gastos recurrentes y proveedores de los próximos días frente al efectivo y lo que se espera cobrar. */
export function CashOutlookCard() {
  const { canPerform } = useAuth();
  const allowed = canPerform('HR_PAYROLL', 'view');
  const [days, setDays] = useState(15);
  const query = useTenantQuery(['dashboard', 'cash-outlook', days], (signal) => getCashOutlook(days, signal), { enabled: allowed, staleTime: 60_000, retry: 0 });
  if (!allowed || query.isError) return null;
  if (query.isLoading || !query.data) return <section className="executive-panel executive-outlook"><Skeleton className="m-5 h-40" aria-busy="true" /></section>;
  const data = query.data;
  if (data.outflow <= 0 && data.overdueOutflow <= 0) return null;
  const money = (amount: number) => formatCurrencyAmount(amount, data.currency);
  const status = STATUS[data.status];
  const Icon = status.icon;
  const rows = data.timeline.filter((event) => event.direction === 'OUT' || event.kind === 'RECEIVABLE').slice(0, 8);
  const parts = [
    { key: 'payroll', label: 'Nómina', value: data.breakdown.payroll },
    { key: 'recurring', label: 'Gastos recurrentes', value: data.breakdown.recurring },
    { key: 'suppliers', label: 'Proveedores', value: data.breakdown.suppliers },
  ];
  const total = parts.reduce((sum, part) => sum + part.value, 0);

  return (
    <section className="executive-panel executive-outlook" data-testid="cash-outlook" aria-label="Cobertura de pagos">
      <div className="executive-panel-heading">
        <div>
          <span className="executive-section-kicker">Finanzas · próximos {data.windowDays} días</span>
          <h2 className="executive-editorial-title">Cobertura de pagos</h2>
        </div>
        <div className="executive-outlook-range" role="group" aria-label="Plazo a revisar">
          {[7, 15, 30].map((value) => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>{value} días</button>)}
        </div>
      </div>

      <div className={cn('executive-outlook-status', status.tone)} role="status">
        <Icon aria-hidden="true" />
        <div>
          <strong>{status.title}</strong>
          <p>
            {status.text}{' '}
            {data.nextPayroll && <>Próxima nómina: <b>{money(data.nextPayroll.amount)}</b> el {dayText(data.nextPayroll.date)}. </>}
            {data.shortfall && <>El {dayText(data.shortfall.date)} faltarían <b>{money(data.shortfall.amount)}</b>. </>}
            {data.overdueOutflow > 0 && <>Hay <b>{money(data.overdueOutflow)}</b> atrasado por pagar.</>}
          </p>
        </div>
      </div>

      <div className="executive-outlook-kpis">
        {[
          ['Efectivo disponible', money(data.cash), null],
          ['Por pagar', money(data.outflow), 'out'],
          ['Por cobrar en el plazo', money(data.inflowDue), 'in'],
          ['Ritmo de cobro (30 días)', money(data.runRate), null],
        ].map(([label, value, dir]) => (
          <div key={label as string} className="executive-kpi executive-outlook-kpi">
            <span className="executive-kpi-label">{label}{dir === 'out' ? <ArrowDownRight aria-hidden="true" /> : dir === 'in' ? <ArrowUpRight aria-hidden="true" /> : null}</span>
            <span className="executive-kpi-value">{value}</span>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="executive-outlook-mix">
          <div className="executive-outlook-bar" role="img" aria-label={parts.map((part) => `${part.label} ${money(part.value)}`).join(', ')}>
            {parts.filter((part) => part.value > 0).map((part) => <i key={part.key} className={`is-${part.key}`} style={{ width: `${(part.value / total) * 100}%` }} />)}
          </div>
          <ul className="executive-legend">
            {parts.map((part) => <li key={part.key}><span className={cn('legend-dot', `outlook-${part.key}`)} />{part.label} <b>{money(part.value)}</b></li>)}
            {data.receivablesOverdue > 0 && <li className="executive-legend-note">Vencido por cobrar (no incluido): {money(data.receivablesOverdue)}</li>}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="executive-outlook-table">
          <table>
            <thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Saldo proyectado</th></tr></thead>
            <tbody>{rows.map((event, index) => (
              <tr key={`${event.date}-${index}`}>
                <td>{event.overdue ? <span className="is-overdue">Atrasado</span> : dayText(event.date)}</td>
                <td><small>{KIND_LABEL[event.kind]}</small>{event.label}</td>
                <td className={event.direction === 'IN' ? 'is-in' : undefined}>{event.direction === 'IN' ? '+' : '−'}{money(event.amount)}</td>
                <td className={event.balanceAfter < 0 ? 'is-negative' : undefined}>{money(event.balanceAfter)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="executive-panel-footer"><span>La nómina por procesar es una estimación (salario por pago, bonos e INSS laboral); el IR y otras retenciones se ajustan al procesarla.</span></div>
    </section>
  );
}
