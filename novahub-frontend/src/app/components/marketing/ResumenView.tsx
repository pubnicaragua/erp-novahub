import { useMemo, useState } from 'react';
import { MARKETING_GUIDES } from './guides';
import { Activity, CalendarDays, CheckCircle2, FileCheck, Image as ImageIcon, Megaphone, Plus, TrendingUp, Upload, Users, Wallet } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { marketingApi } from '../../services/marketing.service';
import { EmptyState, ErrorState, PageTitle, Panel } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { APPROVAL_SUBJECT_LABEL, CAMPAIGN_STATUS_LABEL, CAMPAIGN_TYPE_LABEL, CONTENT_STATUS_LABEL, compact, fmtDate, money } from './marketing.constants';
import { Kpi, StatusBadge } from './MktBits';
import { useMktConfig } from './mkt.helpers';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function ResumenView({ go }: { go: (sub: string, create?: boolean) => void }) {
  const { canPerform } = useAuth();
  const [to, setTo] = useState(() => iso(new Date()));
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 30 * 86_400_000)));
  const config = useMktConfig();
  const currency = config.data?.currency ?? 'NIO';
  const range = useMemo(() => ({ from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59`).toISOString() }), [from, to]);
  const q = useTenantQuery(['marketing', 'overview', range.from, range.to], (signal) => marketingApi.overview(range, signal), { staleTime: 20_000 });
  const d = q.data;
  const maxSpend = Math.max(1, ...(d?.spendByChannel.map((c) => c.amount) ?? [0]));
  const totalSpend = d?.spendByChannel.reduce((s, c) => s + c.amount, 0) ?? 0;
  const manual = d?.kpis.bySource.MANUAL ?? 0;
  const verified = d?.kpis.bySource.VERIFIED ?? 0;

  const quick: Array<{ label: string; sub: string; icon: typeof Plus; module: string; primary?: boolean }> = [
    { label: 'Nueva campaña', sub: 'campanas', icon: Plus, module: 'MARKETING_CAMPAIGNS', primary: true },
    { label: 'Nuevo brief', sub: 'clientes', icon: FileCheck, module: 'MARKETING_CLIENTS' },
    { label: 'Nuevo contenido', sub: 'contenidos', icon: ImageIcon, module: 'MARKETING_CONTENT' },
    { label: 'Subir activo', sub: 'activos', icon: Upload, module: 'MARKETING_ASSETS' },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle guide={MARKETING_GUIDES.resumen} eyebrow="Marketing" title="Marketing" subtitle="Gestiona tus campañas, contenidos y presupuesto desde un solo lugar."
        actions={quick.filter((a) => canPerform(a.module, 'create')).map((a) => (
          <Button key={a.label} type="button" variant={a.primary ? 'default' : 'outline'} onClick={() => go(a.sub, a.sub !== 'activos')}><a.icon className="size-4" aria-hidden="true" />{a.label}</Button>
        ))} />

      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <label className="flex items-center gap-2 font-semibold">Desde<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2" /></label>
        <label className="flex items-center gap-2 font-semibold">Hasta<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2" /></label>
      </div>

      {q.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : q.isError || !d ? (
        <ErrorState message={errorMessage(q.error, 'No se pudo cargar el resumen')} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" data-tour="overview-kpis">
            <Kpi label="Campañas activas" value={d.kpis.activeCampaigns} icon={<Megaphone className="size-4" />} />
            <Kpi label="Piezas por aprobar" value={d.kpis.pendingApprovals} icon={<FileCheck className="size-4" />} />
            <Kpi label="Publicaciones programadas" value={d.kpis.scheduledContent} icon={<CalendarDays className="size-4" />} hint="Programada no es publicada" />
            <Kpi label="Alcance" value={compact(d.kpis.reach)} icon={<Users className="size-4" />} hint={verified ? `${verified} verificado(s) · ${manual} manual(es)` : 'Capturado manualmente'} />
            <Kpi label="Inversión" value={money(d.kpis.spend, currency)} icon={<Wallet className="size-4" />} hint={d.kpis.budget ? `Presupuesto ${money(d.kpis.budget, currency)}` : undefined} />
            <Kpi label="ROAS" value={d.kpis.roas === null ? '—' : `${d.kpis.roas.toFixed(2)}×`} icon={<TrendingUp className="size-4" />} hint="Ingresos ÷ inversión" />
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <Panel title={`Campañas activas (${d.kpis.activeCampaigns})`} icon={<Megaphone className="size-4" />} action={<Button type="button" size="sm" variant="ghost" onClick={() => go('campanas')}>Ver todas</Button>}>
              {d.activeCampaigns.length === 0 ? <EmptyState title="Sin campañas en ejecución" description="Las campañas aprobadas aparecerán aquí al iniciar su ejecución." /> : (
                <ul className="divide-y divide-border">
                  {d.activeCampaigns.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{c.name}</p><p className="truncate text-[11px] text-muted-foreground">{c.code} · {CAMPAIGN_TYPE_LABEL[c.type]}{c.channels.length ? ` · ${c.channels.slice(0, 2).join(', ')}` : ''}</p></div>
                      <div className="text-right text-[11px]"><StatusBadge status={c.status} label={CAMPAIGN_STATUS_LABEL[c.status]} /><p className="mt-1 text-muted-foreground">{money(c.spent, currency)} / {money(c.budget, currency)}</p></div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Calendario de contenidos" icon={<CalendarDays className="size-4" />} action={<Button type="button" size="sm" variant="ghost" onClick={() => go('contenidos')}>Ver calendario</Button>}>
              {d.calendar.length === 0 ? <EmptyState title="Nada programado" description="No hay contenidos con fecha en este periodo." /> : (
                <ul className="divide-y divide-border">
                  {d.calendar.slice(0, 6).map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-2">
                      <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{fmtDate(c.scheduledAt, true)}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{c.title}<span className="ml-1 text-[11px] font-normal text-muted-foreground">{c.channel}</span></span>
                      <StatusBadge status={c.status} label={CONTENT_STATUS_LABEL[c.status]} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={`Cola de aprobaciones (${d.kpis.pendingApprovals})`} icon={<FileCheck className="size-4" />} action={<Button type="button" size="sm" variant="ghost" onClick={() => go('aprobaciones')}>Ver todas</Button>}>
              {d.pendingApprovals.length === 0 ? <EmptyState title="Todo al día" description="No hay solicitudes pendientes." /> : (
                <ul className="divide-y divide-border">
                  {d.pendingApprovals.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{a.title}</p><p className="text-[11px] text-muted-foreground">{APPROVAL_SUBJECT_LABEL[a.subjectType]} · {a.requestedBy?.name ?? '—'}</p></div>
                      <StatusBadge status="PENDING" label="Por aprobar" />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <Panel title="Inversión por canal" icon={<Wallet className="size-4" />}>
              {d.spendByChannel.length === 0 ? <EmptyState title="Sin inversión registrada" description="Registra resultados de «Inversión» en Analítica para ver la distribución." /> : (
                <ul className="space-y-2.5">
                  {d.spendByChannel.map((c) => (
                    <li key={c.channel}>
                      <div className="flex justify-between text-[12px]"><span className="font-semibold">{c.channel}</span><span className="text-muted-foreground">{totalSpend ? ((c.amount / totalSpend) * 100).toFixed(1) : 0}% · {money(c.amount, currency)}</span></div>
                      <div className="mt-1 h-2 rounded-full bg-accent/15" role="img" aria-label={`${c.channel}: ${money(c.amount, currency)}`}><div className="h-2 rounded-full bg-primary" style={{ width: `${(c.amount / maxSpend) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Próximas actividades" icon={<CheckCircle2 className="size-4" />}>
              {d.upcomingTasks.length === 0 ? <EmptyState title="Sin tareas próximas" description="Las tareas creadas desde una campaña viven en Actividades y aparecen aquí." /> : (
                <ul className="divide-y divide-border">
                  {d.upcomingTasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 py-2.5"><span className="truncate text-[13px] font-semibold">{t.title}</span><span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(t.dueDate, true)}</span></li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Actividad reciente" icon={<Activity className="size-4" />}>
              {d.recentHistory.length === 0 ? <EmptyState title="Sin actividad" description="Los cambios relevantes quedan registrados aquí." /> : (
                <ul className="space-y-2">
                  {d.recentHistory.map((h) => (
                    <li key={h.id} className="text-[12px]"><span className="block">{h.summary}</span><span className="text-[11px] text-muted-foreground">{fmtDate(h.createdAt, true)}</span></li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
