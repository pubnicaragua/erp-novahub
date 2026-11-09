import { useState } from 'react';
import { CalendarCheck, Network, Plus, Search, Target } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Input } from '../../ui/input';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { HEALTH_LABEL, OPEN_STAGE_IDS, STAGES, businessLeadsService, formatMoney, formatMoneyMap, type LeadRow, type LeadStage } from '../../../services/business-leads.service';
import { LeadDialog } from './LeadDialog';
import { failure } from './leadUtils';
import { NetworkView } from './NetworkView';

type View = 'today' | 'pipeline' | 'network';
const dayLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-NI', { day: 'numeric', month: 'short' }) : 'Sin fecha');

function LeadCard({ lead, canEdit, onOpen, onMove, compact }: { lead: LeadRow; canEdit: boolean; onOpen: () => void; onMove?: (stage: LeadStage) => void; compact?: boolean }) {
  const health = HEALTH_LABEL[lead.health];
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-card p-3 text-left shadow-sm">
      <button type="button" onClick={onOpen} className="block w-full min-w-0 text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 break-words text-sm font-bold">{lead.company}</p>
          {health && <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase', health.tone)}>{health.label}</span>}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{[lead.businessLine, lead.contactName, lead.ownerName].filter(Boolean).join(' · ') || 'Sin detalles'}</p>
        {lead.estimatedValue !== null && <p className="mt-1 text-sm font-black tabular-nums">{formatMoney(lead.estimatedValue, lead.currency)}<span className="ml-1 text-[10px] font-semibold text-muted-foreground">· {lead.probability}%</span></p>}
        {!compact && (lead.nextAction || lead.nextActionAt) && <p className="mt-1 break-words text-[11px] text-muted-foreground">➜ {lead.nextAction || 'Seguimiento'} · {dayLabel(lead.nextActionAt)}</p>}
        {lead.introducedBy && <p className="mt-0.5 truncate text-[10px] text-primary">Lo acercó {lead.introducedBy.name}</p>}
      </button>
      {onMove && canEdit && (
        <select aria-label={`Mover ${lead.company} de etapa`} className="mt-2 h-7 w-full rounded-lg border border-border/60 bg-background px-1.5 text-[11px]" value={lead.stage} onChange={(e) => onMove(e.target.value as LeadStage)}>
          {STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
        </select>
      )}
    </div>
  );
}

/** Leads de la empresa: lo que toca atender hoy, el embudo con lo que podría representar cada uno y la red de contactos que nos acerca a nuevos clientes. */
export function LeadsPanel() {
  const client = useQueryClient();
  const { canPerform } = useAuth();
  const canCreate = canPerform('SALES_QUOTES', 'create');
  const canEdit = canPerform('SALES_QUOTES', 'edit');
  const [view, setView] = useState<View>('today');
  const [search, setSearch] = useState('');
  const [line, setLine] = useState('');
  const [mine, setMine] = useState(false);
  const [dialog, setDialog] = useState<{ id: string | null; stage?: LeadStage } | null>(null);
  const list = useTenantQuery(['sales', 'business-leads', search, line, mine], (signal) => businessLeadsService.list({ search: search || undefined, businessLine: line || undefined, owner: mine ? 'me' : undefined }, signal), { staleTime: 15_000 });
  const capabilities = useTenantQuery(['sales', 'business-leads-capabilities'], (signal) => businessLeadsService.getCapabilities(signal), { staleTime: 5 * 60_000 });
  const refresh = () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };
  const summary = list.data?.summary;
  const items = list.data?.items ?? [];
  const lines = summary?.businessLines.map((row) => row.name) ?? [];

  const move = async (lead: LeadRow, stage: LeadStage) => {
    if (stage === lead.stage) return;
    if (stage === 'LOST') { setDialog({ id: lead.id }); toast.info('Abre el lead y marca «Perdido» para contar por qué se perdió.'); return; }
    try { await businessLeadsService.changeStage(lead.id, { stage }); toast.success('Etapa actualizada'); refresh(); } catch (error) { toast.error(failure(error)); }
  };

  const groups: Array<{ key: string; title: string; tone: string; rows: LeadRow[] }> = [
    { key: 'OVERDUE', title: 'Atrasados', tone: 'text-red-700', rows: items.filter((l) => l.health === 'OVERDUE') },
    { key: 'DUE_TODAY', title: 'Para hoy', tone: 'text-amber-700', rows: items.filter((l) => l.health === 'DUE_TODAY') },
    { key: 'NO_ACTION', title: 'Sin siguiente paso', tone: 'text-orange-700', rows: items.filter((l) => l.health === 'NO_ACTION') },
    { key: 'STALE', title: 'Fríos: llevan más de una semana sin movimiento', tone: 'text-sky-700', rows: items.filter((l) => l.health === 'STALE') },
  ];
  const kpis = summary ? [
    { label: 'Leads abiertos', value: String(summary.open) },
    { label: 'Podrían representar', value: formatMoneyMap(summary.pipeline) },
    { label: 'Valor ponderado', value: formatMoneyMap(summary.weighted), hint: 'Valor × probabilidad' },
    { label: 'Ganado este mes', value: formatMoneyMap(summary.wonThisMonth), tone: 'text-emerald-700' },
    { label: 'Por atender', value: String(summary.followUps.overdue + summary.followUps.today), tone: summary.followUps.overdue ? 'text-red-700' : undefined, hint: `${summary.followUps.overdue} atrasados · ${summary.followUps.today} hoy` },
  ] : [];

  return (
    <div className="min-w-0 space-y-4" data-testid="business-leads">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="flex items-center gap-2 text-lg font-black"><Target className="size-5 text-primary" aria-hidden /> Leads y red de contactos</h2><p className="text-xs text-muted-foreground">Registra cada día a quién le podemos vender, cuánto podría representar y cómo entrarle.</p></div>
        {canCreate && <Button type="button" onClick={() => setDialog({ id: null })}><Plus className="mr-1.5 size-4" /> Nuevo lead</Button>}
      </div>

      {summary && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{kpis.map((card) => <div key={card.label} className="min-w-0 rounded-xl border border-border/60 bg-card p-3 shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{card.label}</p><p className={cn('mt-1 break-words text-xl font-black tabular-nums', card.tone)}>{card.value}</p>{card.hint && <p className="text-[10px] text-muted-foreground">{card.hint}</p>}</div>)}</div>}

      {summary?.team && summary.team.length > 0 && (
        <details className="rounded-xl border border-border/60 bg-card p-3 text-sm">
          <summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-muted-foreground">Actividad del equipo</summary>
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="py-1">Persona</th><th className="py-1 text-right">Hoy</th><th className="py-1 text-right">7 días</th><th className="py-1 text-right">Abiertos</th><th className="py-1 text-right">Atrasados</th></tr></thead>
            <tbody>{summary.team.map((row) => <tr key={row.userId} className="border-t border-border/40"><td className="py-1.5 font-semibold">{row.name}</td><td className="py-1.5 text-right tabular-nums">{row.addedToday}</td><td className="py-1.5 text-right tabular-nums">{row.added7d}</td><td className="py-1.5 text-right tabular-nums">{row.open}</td><td className={cn('py-1.5 text-right tabular-nums', row.overdue ? 'font-bold text-red-700' : '')}>{row.overdue}</td></tr>)}</tbody></table></div>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Vista de leads" className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
          {([['today', 'Hoy', CalendarCheck], ['pipeline', 'Embudo', Target], ['network', 'Red de contactos', Network]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold', view === id ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}><Icon className="size-3.5" aria-hidden />{label}</button>
          ))}
        </div>
        {view !== 'network' && (
          <>
            <div className="relative min-w-[180px] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input aria-label="Buscar lead" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Empresa, contacto o línea" /></div>
            {lines.length > 0 && <select aria-label="Línea de negocio" className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={line} onChange={(e) => setLine(e.target.value)}><option value="">Todas las líneas</option>{lines.map((name) => <option key={name} value={name}>{name}</option>)}</select>}
            {capabilities.data?.canManageAll && <label className="inline-flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Solo los míos</label>}
          </>
        )}
      </div>

      {view === 'network' ? <NetworkView onOpenLead={(id) => setDialog({ id })} />
        : list.isLoading ? <Skeleton className="h-48 w-full rounded-2xl" aria-busy="true" />
        : list.isError ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">No se pudieron cargar los leads.</p>
        : view === 'today' ? (
          <div className="space-y-5">
            {groups.every((group) => group.rows.length === 0) ? <Card className="rounded-2xl border-dashed p-8 text-center text-sm text-muted-foreground">{summary?.total ? 'Todo al día: no hay leads atrasados, para hoy ni sin siguiente paso.' : 'Todavía no hay leads. Registra el primero apenas encuentres a alguien a quien venderle.'}</Card>
              : groups.filter((group) => group.rows.length).map((group) => (
                <section key={group.key} aria-label={group.title}>
                  <h3 className={cn('mb-2 text-xs font-black uppercase tracking-widest', group.tone)}>{group.title} · {group.rows.length}</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group.rows.map((lead) => <LeadCard key={lead.id} lead={lead} canEdit={canEdit} onOpen={() => setDialog({ id: lead.id })} />)}</div>
                </section>
              ))}
          </div>
        ) : (
          <div className="grid min-w-0 gap-3 overflow-x-auto pb-2 lg:grid-flow-col lg:auto-cols-[minmax(230px,1fr)]" role="list" aria-label="Embudo de leads">
            {OPEN_STAGE_IDS.map((stageId) => {
              const stage = STAGES.find((s) => s.id === stageId)!;
              const rows = items.filter((lead) => lead.stage === stageId);
              return (
                <section key={stageId} role="listitem" className="min-w-0 space-y-2 rounded-2xl bg-muted/30 p-2" aria-label={stage.label}>
                  <header className="flex items-center justify-between gap-2 px-1"><div><p className="text-xs font-black uppercase tracking-widest">{stage.label}</p><p className="text-[10px] text-muted-foreground">{rows.length} · {formatMoneyMap(summary?.byStage[stageId]?.value)}</p></div>{canCreate && <button type="button" aria-label={`Agregar lead en ${stage.label}`} className="rounded-lg p-1 hover:bg-background" onClick={() => setDialog({ id: null, stage: stageId })}><Plus className="size-4" /></button>}</header>
                  {rows.length === 0 ? <p className="px-1 py-4 text-center text-[11px] text-muted-foreground">Vacío</p> : rows.map((lead) => <LeadCard key={lead.id} lead={lead} canEdit={canEdit} onOpen={() => setDialog({ id: lead.id })} onMove={(next) => void move(lead, next)} />)}
                </section>
              );
            })}
            <section className="min-w-0 space-y-2 rounded-2xl bg-muted/30 p-2" aria-label="Cerrados">
              <header className="px-1"><p className="text-xs font-black uppercase tracking-widest">Cerrados</p><p className="text-[10px] text-muted-foreground">{summary?.byStage.WON.count ?? 0} ganados · {summary?.byStage.LOST.count ?? 0} perdidos</p></header>
              {items.filter((lead) => lead.stage === 'WON' || lead.stage === 'LOST').slice(0, 20).map((lead) => <LeadCard key={lead.id} lead={lead} canEdit={false} compact onOpen={() => setDialog({ id: lead.id })} />)}
            </section>
          </div>
        )}

      {dialog && <LeadDialog key={`${dialog.id ?? 'new'}-${dialog.stage ?? ''}`} leadId={dialog.id} businessLines={lines} initial={dialog.stage ? { stage: dialog.stage } : undefined} onClose={() => setDialog(null)} />}
    </div>
  );
}
