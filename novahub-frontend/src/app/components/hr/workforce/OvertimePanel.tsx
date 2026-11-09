import { useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { formatCurrencyAmount } from '../../../utils/currency';
import { VERDICT_LABEL, WEEKDAY_NAMES, workforceService, type OvertimeResult } from '../../../services/workforce.service';
import { failure } from './workforceUtils';
import type { EmployeeOption } from './ScheduleEditor';

const field = 'h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';
const HOURS_SHOWN = Array.from({ length: 17 }, (_, i) => i + 6); // 6:00 a 22:00

/** Mapa de calor día × hora: dónde se concentran las ventas. */
function Heatmap({ heatmap, currency }: { heatmap: number[][]; currency: string }) {
  const max = Math.max(1, ...heatmap.flat());
  return (
    <div className="overflow-x-auto" role="img" aria-label="Ventas promedio por día de la semana y hora">
      <table className="w-full min-w-[640px] border-separate border-spacing-0.5 text-[10px]">
        <thead><tr><th />{HOURS_SHOWN.map((hour) => <th key={hour} className="font-semibold text-muted-foreground">{hour}h</th>)}</tr></thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
            <tr key={weekday}>
              <th className="pr-2 text-right font-semibold text-muted-foreground">{WEEKDAY_NAMES[weekday].slice(0, 3)}</th>
              {HOURS_SHOWN.map((hour) => {
                const value = heatmap[weekday - 1]?.[hour] ?? 0;
                return <td key={hour} title={`${WEEKDAY_NAMES[weekday]} ${hour}:00 · ${formatCurrencyAmount(value, currency)}`} className="h-6 rounded" style={{ background: value > 0 ? `color-mix(in srgb, var(--primary) ${Math.round(12 + (value / max) * 78)}%, transparent)` : 'var(--muted)' }} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CostsEditor() {
  const client = useQueryClient();
  const { canPerform } = useAuth();
  const canEdit = canPerform('HR_PAYROLL', 'edit');
  const costs = useTenantQuery(['workforce', 'costs'], (signal) => workforceService.getCosts(signal), { staleTime: 10_000 });
  const [label, setLabel] = useState('Luz');
  const [kind, setKind] = useState('ELECTRICITY');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>, message?: string) => {
    setBusy(true);
    try { await action(); if (message) toast.success(message); void client.invalidateQueries({ queryKey: ['tenant-module'] }); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const data = costs.data;
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 p-4">
      <div><h4 className="text-sm font-black">Costos mensuales que se prorratean por hora</h4><p className="text-xs text-muted-foreground">Escribe lo que pagas al mes (por ejemplo la factura de luz). Se reparte entre las horas de operación del horario para saber cuánto cuesta abrir una hora más.</p></div>
      {costs.isLoading ? <Skeleton className="h-16 w-full" aria-busy="true" /> : data && (
        <>
          <ul className="space-y-1">
            {data.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-1.5 text-sm">
                <span>{item.label} · {formatCurrencyAmount(item.monthlyAmount, item.currency)} al mes</span>
                <span className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={item.includeInHourly} disabled={!canEdit || busy} onChange={(e) => void run(() => workforceService.saveCost({ label: item.label, kind: item.kind, monthlyAmount: item.monthlyAmount, currency: item.currency, includeInHourly: e.target.checked }, item.id))} />Entra en el costo por hora</label>
                  {canEdit && <button type="button" aria-label={`Quitar ${item.label}`} disabled={busy} onClick={() => void run(() => workforceService.removeCost(item.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{data.operatingHoursPerMonth.toLocaleString('es-NI', { maximumFractionDigits: 0 })} horas de operación al mes → <b className="text-foreground">{formatCurrencyAmount(data.hourlyCost, data.currency)}</b> por hora de operación.</p>
          {canEdit && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><Label htmlFor="oc-kind">Tipo</Label><select id="oc-kind" className={`${field} w-40`} value={kind} onChange={(e) => { setKind(e.target.value); setLabel({ ELECTRICITY: 'Luz', WATER: 'Agua', INTERNET: 'Internet', RENT: 'Alquiler', OTHER: '' }[e.target.value] ?? ''); }}><option value="ELECTRICITY">Luz</option><option value="WATER">Agua</option><option value="INTERNET">Internet</option><option value="RENT">Alquiler</option><option value="OTHER">Otro</option></select></div>
              <div className="space-y-1"><Label htmlFor="oc-label">Nombre</Label><Input id="oc-label" className="w-40" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="oc-amount">Monto mensual</Label><Input id="oc-amount" className="w-36" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <Button type="button" disabled={busy || !label.trim() || amount === ''} onClick={() => void run(async () => { await workforceService.saveCost({ label: label.trim(), kind, monthlyAmount: Number(amount), currency: data.currency }); setAmount(''); }, 'Costo agregado')}>Agregar</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** ¿Vale la pena habilitar horas extra o abrir un feriado? Costo total (pago, luz, cena, transporte) frente a lo que se vende en esa franja. */
export function OvertimePanel({ employees }: { employees: EmployeeOption[] }) {
  const [scenario, setScenario] = useState<'OVERTIME' | 'HOLIDAY'>('OVERTIME');
  const [date, setDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [hours, setHours] = useState('3');
  const [startTime, setStartTime] = useState('18:00');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [transport, setTransport] = useState('');
  const [meal, setMeal] = useState('');
  const [other, setOther] = useState('');
  const [margin, setMargin] = useState('100');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<OvertimeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const pattern = useTenantQuery(['workforce', 'sales-pattern', 8], (signal) => workforceService.getSalesPattern(8, signal), { staleTime: 60_000 });
  const active = useMemo(() => employees.filter((employee) => (employee.employmentStatus || 'ACTIVE') === 'ACTIVE'), [employees]);
  const shown = active.filter((employee) => `${employee.employeeNumber ?? ''} ${employee.firstName ?? ''} ${employee.lastName ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const money = (value: number) => formatCurrencyAmount(value, result?.currency ?? pattern.data?.currency ?? 'NIO');

  const simulate = async () => {
    setBusy(true);
    try {
      setResult(await workforceService.simulateOvertime({
        scenario, date, ...(scenario === 'OVERTIME' ? { hours: Number(hours), startTime } : {}), employeeIds: [...selected],
        transport: Number(transport) || 0, meal: Number(meal) || 0, other: Number(other) || 0, marginPct: Number(margin) || 100,
      }));
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const verdict = result ? VERDICT_LABEL[result.verdict] : null;

  return (
    <section className="space-y-5" aria-label="Horas extra">
      <div><h3 className="text-base font-black">¿Vale la pena habilitar horas extra o abrir un feriado?</h3><p className="text-xs text-muted-foreground">Suma el pago de las horas, la luz y los demás costos por hora, la cena y el transporte, y lo compara con lo que normalmente se vende en esa franja (o con lo que se vendió, si la fecha ya pasó).</p></div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3 rounded-2xl border border-border/60 p-4">
          <div role="tablist" aria-label="Escenario" className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
            {([['OVERTIME', 'Horas extra'], ['HOLIDAY', 'Abrir un feriado']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={scenario === id} onClick={() => { setScenario(id); setResult(null); }} className={cn('flex-1 rounded-lg px-3 py-1.5 text-xs font-bold', scenario === id ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground')}>{label}</button>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="ot-date">Fecha</Label><Input id="ot-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            {scenario === 'OVERTIME' && <><div className="space-y-1.5"><Label htmlFor="ot-start">Desde las</Label><Input id="ot-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="ot-hours">Horas</Label><Input id="ot-hours" type="number" min="1" max="12" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} /></div></>}
            <div className="space-y-1.5"><Label htmlFor="ot-transport">Transporte</Label><Input id="ot-transport" type="number" min="0" step="0.01" value={transport} onChange={(e) => setTransport(e.target.value)} placeholder="0" /></div>
            <div className="space-y-1.5"><Label htmlFor="ot-meal">Cena o comida</Label><Input id="ot-meal" type="number" min="0" step="0.01" value={meal} onChange={(e) => setMeal(e.target.value)} placeholder="0" /></div>
            <div className="space-y-1.5"><Label htmlFor="ot-other">Otros</Label><Input id="ot-other" type="number" min="0" step="0.01" value={other} onChange={(e) => setOther(e.target.value)} placeholder="0" /></div>
            <div className="space-y-1.5"><Label htmlFor="ot-margin">Margen sobre la venta (%)</Label><Input id="ot-margin" type="number" min="1" max="100" value={margin} onChange={(e) => setMargin(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2"><Label>¿A quiénes? ({selected.size})</Label><span className="flex gap-2 text-xs"><button type="button" className="text-primary underline" onClick={() => setSelected(new Set(shown.map((e) => e.id)))}>Todos</button><button type="button" className="text-primary underline" onClick={() => setSelected(new Set())}>Ninguno</button></span></div>
            <Input aria-label="Buscar empleado" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" />
            <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-border/50 p-1">
              {shown.map((employee) => <li key={employee.id}><label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-muted/50"><input type="checkbox" checked={selected.has(employee.id)} onChange={() => toggle(employee.id)} />{[employee.employeeNumber, `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim()].filter(Boolean).join(' · ')}</label></li>)}
            </ul>
          </div>
          <Button type="button" className="w-full" disabled={busy || selected.size === 0 || !date} onClick={() => void simulate()}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Calcular si conviene</Button>
        </div>

        <div className="space-y-3">
          {result && verdict ? (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4" role="status" data-testid="overtime-result">
              <div className={cn('rounded-xl border-l-4 border border-border/60 px-3 py-2', verdict.tone === 'is-covered' ? 'border-l-emerald-600 bg-emerald-50 text-emerald-900' : verdict.tone === 'is-short' ? 'border-l-red-600 bg-red-50 text-red-900' : 'border-l-amber-500 bg-amber-50 text-amber-900')}>
                <strong className="block text-sm font-black">{verdict.label}</strong><p className="text-xs">{verdict.text}{result.holiday ? ` (${result.holiday.name})` : ''}</p>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {[
                  [`Pago a ${result.cost.people.length} persona${result.cost.people.length === 1 ? '' : 's'} (×${result.multiplier})`, result.cost.payTotal],
                  [`Luz y costos por hora (${result.hours} h)`, result.cost.operating], ['Transporte', result.cost.transport], ['Cena o comida', result.cost.meal], ['Otros', result.cost.other],
                ].map(([label, value]) => <div key={label as string} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="text-right tabular-nums">{money(value as number)}</dd></div>)}
                <dt className="border-t border-border pt-2 font-black">Costo total</dt><dd className="border-t border-border pt-2 text-right text-lg font-black tabular-nums">{money(result.cost.total)}</dd>
                <dt className="text-muted-foreground">{result.salesBasis === 'ACTUAL' ? 'Se vendió en esa franja' : 'Se espera vender (promedio de 8 semanas)'}</dt><dd className="text-right tabular-nums">{result.expectedSales === null ? '—' : money(result.expectedSales)}</dd>
                {result.net !== null && <><dt className="font-black">Resultado</dt><dd className={cn('text-right text-lg font-black tabular-nums', result.net < 0 ? 'text-red-700' : 'text-emerald-700')}>{money(result.net)}</dd></>}
                {result.breakEvenSales !== null && <><dt className="text-muted-foreground">Para no perder habría que vender</dt><dd className="text-right tabular-nums">{money(result.breakEvenSales)}</dd></>}
              </dl>
              <details className="text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold">Pago por persona</summary><ul className="mt-1 space-y-0.5">{result.cost.people.map((person) => <li key={person.id} className="flex justify-between"><span>{person.name} ({money(person.hourlyRate)} la hora)</span><span className="tabular-nums">{money(person.pay)}</span></li>)}</ul></details>
            </div>
          ) : <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">Elige la fecha, a quiénes y los costos, y calcula. Aquí verás el costo total frente a lo que se vende.</p>}
        </div>
      </div>

      <CostsEditor />

      <div className="space-y-3 rounded-2xl border border-border/60 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-sm font-black">Días y horas con más ventas</h4>{pattern.data && <span className="text-xs text-muted-foreground">Últimas {pattern.data.weeks} semanas · {pattern.data.invoices} facturas</span>}</div>
        {pattern.isLoading ? <Skeleton className="h-40 w-full" aria-busy="true" /> : pattern.data && pattern.data.invoices > 0 ? (
          <>
            <p className="text-sm">El mejor día es <b>{pattern.data.bestDay ? WEEKDAY_NAMES[pattern.data.bestDay] : '—'}</b>{pattern.data.peakHours.length > 0 && <> y las horas pico son <b>{pattern.data.peakHours.map((hour) => `${hour}:00`).join(', ')}</b></>}.</p>
            <Heatmap heatmap={pattern.data.heatmap} currency={pattern.data.currency} />
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {pattern.data.byWeekday.map((day) => <div key={day.weekday} className="rounded-lg bg-muted/30 p-2"><p className="font-semibold">{WEEKDAY_NAMES[day.weekday].slice(0, 3)}</p><p className="tabular-nums">{formatCurrencyAmount(day.avgSales, pattern.data?.currency)}</p></div>)}
            </div>
          </>
        ) : <p className="text-sm text-muted-foreground">Aún no hay facturas suficientes para ver el patrón de ventas.</p>}
      </div>
    </section>
  );
}
