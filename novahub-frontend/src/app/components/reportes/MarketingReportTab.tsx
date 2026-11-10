import { forwardRef, useImperativeHandle, useMemo } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { marketingApi } from '../../services/marketing.service';
import { toast } from '../../services/toast';
import { ErrorState, EmptyState, Panel } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { CAMPAIGN_STATUS_LABEL, compact, money } from '../marketing/marketing.constants';
import { Kpi, StatusBadge } from '../marketing/MktBits';
import { exportMarketingReportExcel, useMktConfig } from '../marketing/mkt.helpers';
import type { ReportExportRef, ReportProps } from './types';
import { getCurrencyDecimalPlaces } from '../../utils/currency';

const DAY = 86_400_000;
const SPAN_DAYS: Record<string, number> = { hoy: 0, 'ultima-semana': 7, 'ultimo-mes': 30, 'ultimo-trimestre': 90, 'ultimo-año': 365, todo: 1825 };

/** Reporte de Marketing dentro de Reportes: mismo endpoint y mismos permisos que Marketing › Analítica. */
export const MarketingReportTab = forwardRef<ReportExportRef, ReportProps>(function MarketingReportTab({ dateRange }, ref) {
  const config = useMktConfig();
  const currency = config.data?.currency ?? 'NIO';
  const { displayCurrency, displayMode, convertDisplayAmount } = useCurrency();
  const reportCurrency = displayMode === 'ORIGINAL' ? currency : displayCurrency;
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - (SPAN_DAYS[dateRange] ?? 30) * DAY);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [dateRange]);
  const q = useTenantQuery(['reportes', 'marketing', range.from.slice(0, 10), range.to.slice(0, 10)], (signal) => marketingApi.report(range, signal), { staleTime: 30_000 });
  const d = q.data;

  useImperativeHandle(ref, () => ({
    exportExcel: () => { if (d) void exportMarketingReportExcel(d, { from: range.from.slice(0, 10), to: range.to.slice(0, 10), currency, reportCurrency, convertAmount: (amount, source) => convertDisplayAmount(amount, source) }); else toast.info('El reporte aún se está cargando'); },
    exportPDF: () => { toast.info('El reporte de Marketing se exporta en Excel por ahora'); },
  }), [d, range, currency, reportCurrency, convertDisplayAmount]);

  if (q.isLoading) return <Skeleton className="h-64 w-full" aria-busy="true" />;
  if (q.isError || !d) return <ErrorState message={errorMessage(q.error, 'No se pudo cargar el reporte de Marketing')} onRetry={() => void q.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Inversión" value={money(d.totals.SPEND ?? 0, currency)} />
        <Kpi label="Alcance" value={compact(d.totals.REACH ?? 0)} />
        <Kpi label="Leads" value={compact(d.totals.LEADS ?? 0)} />
        <Kpi label="Conversiones" value={compact(d.totals.CONVERSIONS ?? 0)} />
        <Kpi label="ROAS" value={typeof d.totals.roas === 'number' ? `${d.totals.roas.toFixed(getCurrencyDecimalPlaces())}×` : '—'} hint="Ingresos ÷ inversión" />
      </div>
      <Panel title="Rendimiento por campaña">
        {d.campaigns.length === 0 ? <EmptyState title="Sin campañas" description="No hay campañas con actividad en este periodo." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead className="text-left text-[11px] uppercase text-muted-foreground"><tr><th className="py-1">Campaña</th><th>Estado</th><th className="text-right">Presupuesto</th><th className="text-right">Ejecutado</th><th className="text-right">ROAS</th></tr></thead>
              <tbody className="divide-y divide-border">
                {d.campaigns.map((c) => (
                  <tr key={c.id}><td className="py-2 font-semibold">{c.name}</td><td><StatusBadge status={c.status} label={CAMPAIGN_STATUS_LABEL[c.status]} /></td><td className="text-right">{money(c.budget, currency)}</td><td className="text-right">{money(c.spent, currency)}</td><td className="text-right">{c.roas === null ? '—' : `${c.roas.toFixed(2)}×`}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
});
