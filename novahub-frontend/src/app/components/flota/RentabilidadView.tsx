import { useMemo, useState } from 'react';
import { Download, Gauge, Receipt, TrendingUp, Truck, Wallet } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { flotaService } from '../../services/flota.service';
import { SalesKpiCard } from '../ventas/SalesKpiCard';
import { DateField } from '../ui/DateField';
import { ErrorState, Field, NativeSelect, PageTitle } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { createReportWorkbook } from '../../utils/reportWorkbook';
import { buildDatedDownloadFileName } from '../../utils/exportFileNames';
import { formatNumber } from './flota.helpers';

const GROUPS: Array<{ value: string; label: string }> = [
  { value: 'vehicle', label: 'Por vehículo' },
  { value: 'destination', label: 'Por destino' },
  { value: 'route', label: 'Por ruta (origen → destino)' },
  { value: 'driver', label: 'Por conductor' },
  { value: 'month', label: 'Por mes' },
];
const LINE_LABEL: Record<string, string> = {
  DIESEL: 'Diésel', COMISION: 'Comisión', VIATICO: 'Viático', PAGO_CONDUCTOR: 'Pago conductor', DEPRECIACION: 'Depreciación', OTROS: 'Otros', PARADA_EXTRA: 'Parada extra',
};
const isoDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Rentabilidad de flota: ingreso, costo y ganancia de los viajes registrados, por vehículo, destino, ruta, conductor o mes. */
export function RentabilidadView() {
  const today = new Date();
  const [from, setFrom] = useState(isoDay(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(isoDay(today));
  const [groupBy, setGroupBy] = useState('vehicle');
  const report = useTenantQuery(['fleet', 'profitability', from, to, groupBy], (signal) => flotaService.profitability({ from, to, groupBy }, signal));

  const lineCodes = useMemo(() => {
    const codes = new Set<string>();
    (report.data?.rows || []).forEach((row) => Object.keys(row.lines).forEach((code) => codes.add(code)));
    return [...codes];
  }, [report.data]);

  const exportExcel = () => {
    if (!report.data) return;
    const rows = report.data.rows.map((row) => ({
      [GROUPS.find((group) => group.value === groupBy)?.label || 'Grupo']: row.label,
      Viajes: row.trips, Ingreso: row.revenue, Costo: row.cost, Ganancia: row.profit, 'Margen %': row.marginPercent, Km: row.km,
      ...Object.fromEntries(lineCodes.map((code) => [LINE_LABEL[code] || code, row.lines[code] ?? 0])),
    }));
    createReportWorkbook({
      fileName: buildDatedDownloadFileName(['rentabilidad_flota'], 'xlsx'),
      sheets: [{ name: 'Rentabilidad', rows }],
      filters: { Desde: from, Hasta: to, Agrupación: GROUPS.find((group) => group.value === groupBy)?.label || groupBy },
    });
  };

  const totals = report.data?.totals;
  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle eyebrow="Flota y fletes" title="Rentabilidad" subtitle="Ingreso, costo y ganancia de los viajes con costo registrado en facturas, órdenes y cotizaciones." />

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Desde" htmlFor="rent-from"><DateField value={from} onChange={setFrom} maxDate={to || undefined} className="h-10 w-[170px]" placeholder="Desde" title="Desde" /></Field>
        <Field label="Hasta" htmlFor="rent-to"><DateField value={to} onChange={setTo} minDate={from || undefined} className="h-10 w-[170px]" placeholder="Hasta" title="Hasta" /></Field>
        <Field label="Agrupar" htmlFor="rent-group">
          <NativeSelect id="rent-group" value={groupBy} onChange={(event) => setGroupBy(event.target.value)} className="w-56">
            {GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
          </NativeSelect>
        </Field>
        <Button type="button" variant="outline" onClick={exportExcel} disabled={!report.data?.rows.length} className="ml-auto"><Download className="size-4" aria-hidden="true" />Exportar Excel</Button>
      </div>

      {report.isLoading && <Skeleton className="h-72 w-full" aria-busy="true" />}
      {report.isError && <ErrorState message={errorMessage(report.error)} onRetry={() => void report.refetch()} />}
      {totals && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SalesKpiCard title="Viajes" value={formatNumber(totals.trips, 0)} icon={Truck} />
            <SalesKpiCard title="Ingreso" value={`C$ ${formatNumber(totals.revenue, 2)}`} icon={Receipt} />
            <SalesKpiCard title="Costo" value={`C$ ${formatNumber(totals.cost, 2)}`} icon={Wallet} />
            <SalesKpiCard title="Ganancia" value={`C$ ${formatNumber(totals.profit, 2)}`} icon={TrendingUp} tone={totals.profit < 0 ? 'bad' : 'default'} />
            <SalesKpiCard title="Margen" value={`${formatNumber(totals.marginPercent, 1)} %`} icon={Gauge} tone={totals.marginPercent < 0 ? 'bad' : 'default'} />
          </div>
          {report.data?.truncated && <p className="text-[12px] text-destructive" role="alert">Hay más de 20 000 viajes en el rango: acorta las fechas para ver el total completo.</p>}
          {(report.data?.rows.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-[13px] text-muted-foreground">No hay viajes con costo registrado en este rango. El costo se registra en el bloque «Costo interno del viaje» de cada factura, orden o cotización.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[720px] text-[13px]">
                <caption className="sr-only">Rentabilidad de flota</caption>
                <thead className="bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">{GROUPS.find((group) => group.value === groupBy)?.label.replace('Por ', '') || 'Grupo'}</th>
                    <th className="px-3 py-2 text-right">Viajes</th><th className="px-3 py-2 text-right">Ingreso</th><th className="px-3 py-2 text-right">Costo</th>
                    <th className="px-3 py-2 text-right">Ganancia</th><th className="px-3 py-2 text-right">Margen</th>
                    {lineCodes.map((code) => <th key={code} className="px-3 py-2 text-right">{LINE_LABEL[code] || code}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(report.data?.rows ?? []).map((row) => (
                    <tr key={row.key} className="border-t">
                      <td className="px-3 py-2 font-medium">{row.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.trips, 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.revenue, 2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.cost, 2)}</td>
                      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${row.profit < 0 ? 'text-destructive' : ''}`}>{formatNumber(row.profit, 2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.marginPercent, 1)} %</td>
                      {lineCodes.map((code) => <td key={code} className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatNumber(row.lines[code] ?? 0, 2)}</td>)}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/20 font-semibold">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totals.trips, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totals.revenue, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totals.cost, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totals.profit, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totals.marginPercent, 1)} %</td>
                    {lineCodes.map((code) => <td key={code} className="px-3 py-2 text-right tabular-nums">{formatNumber(totals.lines[code] ?? 0, 2)}</td>)}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
