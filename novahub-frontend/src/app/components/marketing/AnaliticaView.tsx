import { useMemo, useState } from 'react';
import { MARKETING_GUIDES } from './guides';
import { Download, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { marketingApi, mktResources, type MktCompetitor, type MktKpi, type MktStudy } from '../../services/marketing.service';
import { toast } from '../../services/toast';
import { EmptyState, ErrorState, Heading, PageTitle, Panel } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { CAMPAIGN_STATUS_LABEL, METRIC_LABEL, SOURCE_LABEL, compact, fmtDate, money } from './marketing.constants';
import { FormSheet, Kpi, ResourceTable, StatusBadge, type Column } from './MktBits';
import { exportMarketingReportExcel, options, toInitial, useMktConfig, useMktRefresh, type FieldDef } from './mkt.helpers';
import { useCurrency } from '../../contexts/CurrencyContext';
import { getCurrencyDecimalPlaces } from '../../utils/currency';

type Tab = 'kpi' | 'competition' | 'reports';
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function AnaliticaView() {
  const [tab, setTab] = useState<Tab>('kpi');
  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle guide={MARKETING_GUIDES.analitica} eyebrow="Marketing" title="Analítica" subtitle="Presupuestos y resultados, competencia y mercado, y reportes exportables." />
      <div role="tablist" aria-label="Secciones de analítica" className="flex flex-wrap gap-2">
        {([['kpi', 'Presupuestos y KPI'], ['competition', 'Competencia y mercado'], ['reports', 'Reportes']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cn('rounded-lg border px-4 py-2 text-[13px] font-semibold', tab === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/50')}>{label}</button>
        ))}
      </div>
      {tab === 'kpi' && <KpiTab />}
      {tab === 'competition' && <CompetitionTab />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  );
}

function KpiTab() {
  const { canPerform } = useAuth();
  const refresh = useMktRefresh();
  const config = useMktConfig();
  const currency = config.data?.currency ?? 'NIO';
  const [open, setOpen] = useState(false);
  const canCreate = canPerform('MARKETING_ANALYTICS', 'create');
  const campaigns = useTenantQuery(['marketing', 'campaigns-all'], (s) => mktResources.campaigns.list({ pageSize: 100 }, s), { staleTime: 60_000 });
  const [range] = useState(() => ({ from: new Date(Date.now() - 90 * 86_400_000).toISOString(), to: new Date().toISOString() }));
  const report = useTenantQuery(['marketing', 'report-kpi'], (s) => marketingApi.report(range, s), { staleTime: 30_000 });

  const fields: FieldDef[] = [
    { key: 'campaignId', label: 'Campaña', type: 'select', options: (campaigns.data?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` })), placeholder: 'Sin campaña' },
    { key: 'channel', label: 'Canal', type: 'select', options: (config.data?.channels ?? []).map((c) => ({ value: c, label: c })) },
    { key: 'metric', label: 'Métrica', type: 'select', required: true, options: options(METRIC_LABEL) },
    { key: 'value', label: 'Valor', type: 'number', required: true, hint: 'Se guarda como métrica manual. Solo una integración autorizada puede marcarla como verificada.' },
    { key: 'periodDate', label: 'Fecha del resultado', type: 'date', required: true },
  ];
  const t = report.data?.totals as Record<string, number | null | Record<string, number>> | undefined;
  const num = (k: string) => (typeof t?.[k] === 'number' ? (t[k] as number) : 0);
  const columns: Array<Column<MktKpi>> = [
    { key: 'metric', header: 'Métrica', render: (r) => <span className="font-semibold">{METRIC_LABEL[r.metric] ?? r.metric}</span> },
    { key: 'value', header: 'Valor', className: 'text-right', render: (r) => (r.metric === 'SPEND' || r.metric === 'REVENUE' ? money(r.value, currency) : Number(r.value).toLocaleString('es-NI')) },
    { key: 'channel', header: 'Canal', render: (r) => r.channel || '—' },
    { key: 'campaign', header: 'Campaña', render: (r) => campaigns.data?.data.find((c) => c.id === r.campaignId)?.name ?? '—' },
    { key: 'date', header: 'Fecha', render: (r) => fmtDate(r.periodDate) },
    { key: 'source', header: 'Origen', render: (r) => <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', r.source === 'VERIFIED' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-800')}>{SOURCE_LABEL[r.source]}</span> },
  ];

  return (
    <div className="space-y-4">
      {report.isLoading ? <Skeleton className="h-24 w-full" /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi label="Inversión (90 días)" value={money(num('SPEND'), currency)} />
          <Kpi label="Ingresos atribuidos" value={money(num('REVENUE'), currency)} />
          <Kpi label="Leads" value={compact(num('LEADS'))} hint={typeof t?.cpl === 'number' ? `CPL ${money(t.cpl, currency)}` : undefined} />
          <Kpi label="Conversiones" value={compact(num('CONVERSIONS'))} />
          <Kpi label="ROAS" value={typeof t?.roas === 'number' ? `${t.roas.toFixed(2)}×` : '—'} hint="Ingresos ÷ inversión" />
        </div>
      )}
      <Panel title="Presupuesto por campaña">
        {(report.data?.campaigns.length ?? 0) === 0 ? <EmptyState title="Sin campañas" description="Las campañas con presupuesto aparecerán aquí." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-[13px]">
            <thead className="text-left text-[11px] uppercase text-muted-foreground"><tr><th className="py-1">Campaña</th><th>Estado</th><th className="text-right">Presupuesto</th><th className="text-right">Ejecutado</th><th className="text-right">ROAS</th></tr></thead>
            <tbody className="divide-y divide-border">{report.data!.campaigns.map((c) => (
              <tr key={c.id}><td className="py-2 font-semibold">{c.name}</td><td><StatusBadge status={c.status} label={CAMPAIGN_STATUS_LABEL[c.status]} /></td><td className="text-right">{money(c.budget, currency)}</td><td className="text-right">{money(c.spent, currency)}</td><td className="text-right">{c.roas === null ? '—' : `${c.roas.toFixed(2)}×`}</td></tr>
            ))}</tbody></table></div>
        )}
      </Panel>
      <ResourceTable<MktKpi> id="kpis" fetcher={mktResources.kpis.list} columns={columns} searchPlaceholder="Buscar por canal o métrica…" emptyTitle="Sin resultados registrados" emptyDescription="Registra manualmente inversión, alcance, leads o ingresos por campaña y canal."
        toolbar={canCreate ? <Button type="button" onClick={() => setOpen(true)}><Plus className="size-4" aria-hidden="true" />Registrar resultado</Button> : undefined} />
      <FormSheet key={open ? 'o' : 'c'} open={open} onOpenChange={setOpen} title="Registrar resultado" fields={fields} initial={{ periodDate: iso(new Date()) }}
        onSubmit={async (p) => { await mktResources.kpis.create({ ...p, campaignId: p.campaignId || undefined, channel: p.channel || undefined }); toast.success('Resultado registrado'); refresh(); }} />
    </div>
  );
}

function CompetitionTab() {
  const { canPerform } = useAuth();
  const refresh = useMktRefresh();
  const canCreate = canPerform('MARKETING_ANALYTICS', 'create');
  const canEdit = canPerform('MARKETING_ANALYTICS', 'edit');
  const [form, setForm] = useState<{ kind: 'competitors' | 'studies'; row?: MktCompetitor | MktStudy } | null>(null);

  const competitorFields: FieldDef[] = [
    { key: 'name', label: 'Competidor', type: 'text', required: true }, { key: 'category', label: 'Categoría', type: 'text' },
    { key: 'marketShare', label: 'Participación de mercado (%)', type: 'number' }, { key: 'channels', label: 'Canales', type: 'tags' }, { key: 'notes', label: 'Notas', type: 'textarea' },
  ];
  const studyFields: FieldDef[] = [
    { key: 'title', label: 'Estudio', type: 'text', required: true, span: 2 }, { key: 'scope', label: 'Alcance', type: 'text' },
    { key: 'status', label: 'Estado', type: 'select', options: [{ value: 'IN_PROGRESS', label: 'En curso' }, { value: 'COMPLETED', label: 'Completado' }] },
    { key: 'studyDate', label: 'Fecha', type: 'date' }, { key: 'findings', label: 'Hallazgos', type: 'textarea' },
  ];
  const fields = form?.kind === 'studies' ? studyFields : competitorFields;
  const compColumns: Array<Column<MktCompetitor>> = [
    { key: 'name', header: 'Competidor', render: (r) => <span className="font-semibold">{r.name}</span> }, { key: 'category', header: 'Categoría', render: (r) => r.category || '—' },
    { key: 'share', header: 'Participación', render: (r) => (r.marketShare ? `${Number(r.marketShare).toFixed(1)}%` : '—') }, { key: 'channels', header: 'Canales', render: (r) => r.channels.join(', ') || '—' },
  ];
  const studyColumns: Array<Column<MktStudy>> = [
    { key: 'title', header: 'Estudio', render: (r) => <span className="font-semibold">{r.title}</span> }, { key: 'scope', header: 'Alcance', render: (r) => r.scope || '—' },
    { key: 'date', header: 'Fecha', render: (r) => fmtDate(r.studyDate) }, { key: 'status', header: 'Estado', render: (r) => <StatusBadge status={r.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING'} label={r.status === 'COMPLETED' ? 'Completado' : 'En curso'} /> },
  ];
  const save = async (payload: Record<string, unknown>) => {
    if (!form) return;
    const api = mktResources[form.kind] as { create: (d: Record<string, unknown>) => Promise<unknown>; update: (id: string, d: Record<string, unknown>) => Promise<unknown> };
    await (form.row ? api.update(form.row.id, payload) : api.create(payload));
    toast.success('Guardado'); refresh();
  };

  return (
    <div className="space-y-6">
      <section aria-label="Competidores" className="space-y-2">
        <Heading className="text-[15px] font-semibold">Competidores monitoreados</Heading>
        <ResourceTable<MktCompetitor> id="competitors" fetcher={mktResources.competitors.list} columns={compColumns} searchPlaceholder="Buscar competidor…" emptyTitle="Sin competidores" emptyDescription="Registra a tus competidores para compararte con el mercado."
          onRowClick={canEdit ? (row) => setForm({ kind: 'competitors', row }) : undefined}
          toolbar={canCreate ? <Button type="button" onClick={() => setForm({ kind: 'competitors' })}><Plus className="size-4" aria-hidden="true" />Registrar competidor</Button> : undefined} />
      </section>
      <section aria-label="Estudios" className="space-y-2">
        <Heading className="text-[15px] font-semibold">Estudios de mercado</Heading>
        <ResourceTable<MktStudy> id="studies" fetcher={mktResources.studies.list} columns={studyColumns} searchPlaceholder="Buscar estudio…" emptyTitle="Sin estudios" emptyDescription="Documenta investigaciones y hallazgos relevantes."
          onRowClick={canEdit ? (row) => setForm({ kind: 'studies', row }) : undefined}
          toolbar={canCreate ? <Button type="button" onClick={() => setForm({ kind: 'studies' })}><Plus className="size-4" aria-hidden="true" />Nuevo estudio</Button> : undefined} />
      </section>
      <FormSheet key={form ? `${form.kind}-${form.row?.id ?? 'n'}` : 'c'} open={Boolean(form)} onOpenChange={(o) => { if (!o) setForm(null); }}
        title={form?.kind === 'studies' ? 'Estudio de mercado' : 'Competidor'} fields={fields} initial={toInitial(fields, form?.row)} onSubmit={save} />
    </div>
  );
}

function ReportsTab() {
  const config = useMktConfig();
  const currency = config.data?.currency ?? 'NIO';
  const { displayCurrency, displayMode, convertDisplayAmount } = useCurrency();
  const reportCurrency = displayMode === 'ORIGINAL' ? currency : displayCurrency;
  const [to, setTo] = useState(() => iso(new Date()));
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 30 * 86_400_000)));
  const range = useMemo(() => ({ from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59`).toISOString() }), [from, to]);
  const q = useTenantQuery(['marketing', 'report', range.from, range.to], (s) => marketingApi.report(range, s), { staleTime: 30_000 });
  const d = q.data;

  const exportExcel = () => { if (d) void exportMarketingReportExcel(d, { from, to, currency, reportCurrency, convertAmount: (amount, source) => convertDisplayAmount(amount, source) }); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 text-[12px]">
        <label className="font-semibold">Desde<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="ml-2 h-9 rounded-lg border border-border bg-background px-2" /></label>
        <label className="font-semibold">Hasta<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="ml-2 h-9 rounded-lg border border-border bg-background px-2" /></label>
        <Button type="button" variant="outline" disabled={!d} onClick={exportExcel}><Download className="size-4" aria-hidden="true" />Exportar Excel</Button>
      </div>
      {q.isLoading ? <Skeleton className="h-64 w-full" /> : q.isError || !d ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi label="Inversión" value={money(d.totals.SPEND ?? 0, currency)} />
            <Kpi label="Alcance" value={compact(d.totals.REACH ?? 0)} />
            <Kpi label="Clics" value={compact(d.totals.CLICKS ?? 0)} hint={typeof d.totals.ctr === 'number' ? `CTR ${d.totals.ctr.toFixed(getCurrencyDecimalPlaces())}%` : undefined} />
            <Kpi label="Conversiones" value={compact(d.totals.CONVERSIONS ?? 0)} />
            <Kpi label="ROAS" value={typeof d.totals.roas === 'number' ? `${d.totals.roas.toFixed(getCurrencyDecimalPlaces())}×` : '—'} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Estado de contenidos"><ul className="space-y-1 text-[13px]">{Object.entries(d.contentByStatus).map(([s, n]) => <li key={s} className="flex justify-between"><span>{s}</span><strong>{n}</strong></li>)}{Object.keys(d.contentByStatus).length === 0 && <li className="text-muted-foreground">Sin contenidos.</li>}</ul></Panel>
            <Panel title="Aprobaciones del periodo"><ul className="space-y-1 text-[13px]">{Object.entries(d.approvalsByStatus).map(([s, n]) => <li key={s} className="flex justify-between"><span>{s}</span><strong>{n}</strong></li>)}{Object.keys(d.approvalsByStatus).length === 0 && <li className="text-muted-foreground">Sin solicitudes.</li>}</ul></Panel>
          </div>
          <Panel title="Historial reciente">
            <ul className="space-y-2">{d.history.slice(0, 15).map((h) => <li key={h.id} className="text-[12px]"><span className="block">{h.summary}</span><span className="text-[11px] text-muted-foreground">{fmtDate(h.createdAt, true)}</span></li>)}{d.history.length === 0 && <li className="text-[12px] text-muted-foreground">Sin movimientos.</li>}</ul>
          </Panel>
        </>
      )}
    </div>
  );
}
