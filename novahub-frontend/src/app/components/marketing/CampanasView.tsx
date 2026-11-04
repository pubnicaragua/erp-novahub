import { useMemo, useState } from 'react';
import { MARKETING_GUIDES } from './guides';
import { Loader2, Pencil, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { marketingApi, mktResources, type MktCampaign } from '../../services/marketing.service';
import { toast } from '../../services/toast';
import { ErrorState, Field, NativeSelect, PageTitle, Panel } from '../organizacion/OrgBits';
import { errorMessage, serifStyle } from '../organizacion/organizacion.utils';
import {
  CAMPAIGN_NEXT, CAMPAIGN_STATUS_LABEL, CAMPAIGN_TYPE_LABEL, CONTENT_STATUS_LABEL, METRIC_LABEL, compact, fmtDate, money,
} from './marketing.constants';
import { FormSheet, ResourceTable, StatusBadge, type Column } from './MktBits';
import { options, toInitial, useMktConfig, useMktRefresh, useMktUsers, userName, userOptions, type FieldDef } from './mkt.helpers';

export function CampanasView() {
  const { canPerform } = useAuth();
  const refresh = useMktRefresh();
  const users = useMktUsers();
  const config = useMktConfig();
  const currency = config.data?.currency ?? 'NIO';
  const [form, setForm] = useState<{ row?: MktCampaign } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const canCreate = canPerform('MARKETING_CAMPAIGNS', 'create');
  const canEdit = canPerform('MARKETING_CAMPAIGNS', 'edit');

  const accounts = useTenantQuery(['marketing', 'accounts-all'], (s) => mktResources.accounts.list({ pageSize: 100 }, s), { staleTime: 60_000 });
  const briefs = useTenantQuery(['marketing', 'briefs-all'], (s) => mktResources.briefs.list({ pageSize: 100 }, s), { staleTime: 60_000 });

  const fields: FieldDef[] = useMemo(() => [
    { key: 'name', label: 'Nombre de la campaña', type: 'text', required: true, span: 2 },
    { key: 'type', label: 'Tipo', type: 'select', options: options(CAMPAIGN_TYPE_LABEL), placeholder: 'Digital (por defecto)' },
    { key: 'ownerUserId', label: 'Responsable', type: 'select', options: userOptions(users.data) },
    { key: 'accountId', label: 'Cliente / cuenta', type: 'select', options: (accounts.data?.data ?? []).map((a) => ({ value: a.id, label: a.name })) },
    { key: 'briefId', label: 'Brief', type: 'select', hint: 'Reutiliza un brief existente: no se duplica.', options: (briefs.data?.data ?? []).map((b) => ({ value: b.id, label: `${b.code} · ${b.title}` })) },
    { key: 'startDate', label: 'Inicio', type: 'date' },
    { key: 'endDate', label: 'Fin', type: 'date' },
    { key: 'budget', label: 'Presupuesto', type: 'number', hint: 'Cambiar el monto invalida la aprobación previa.' },
    { key: 'spent', label: 'Ejecutado', type: 'number' },
    { key: 'channels', label: 'Canales', type: 'tags', span: 2 },
    { key: 'objective', label: 'Objetivo', type: 'textarea' },
  ], [users.data, accounts.data, briefs.data]);

  const columns: Array<Column<MktCampaign>> = [
    { key: 'name', header: 'Campaña', render: (r) => <div><p className="font-semibold">{r.name}</p><p className="text-[11px] text-muted-foreground">{r.code} · {accounts.data?.data.find((a) => a.id === r.accountId)?.name ?? 'Sin cliente'}</p></div> },
    { key: 'type', header: 'Tipo', render: (r) => CAMPAIGN_TYPE_LABEL[r.type] },
    { key: 'status', header: 'Estado', render: (r) => <StatusBadge status={r.status} label={CAMPAIGN_STATUS_LABEL[r.status]} /> },
    { key: 'dates', header: 'Fechas', render: (r) => <span className="text-[12px]">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</span> },
    { key: 'owner', header: 'Responsable', render: (r) => userName(users.data, r.ownerUserId) },
    { key: 'budget', header: 'Presupuesto', className: 'text-right', render: (r) => <div className="text-right"><p>{money(r.budget, currency)}</p><p className="text-[11px] text-muted-foreground">{r.budgetApproved ? 'Aprobado' : Number(r.budget) > 0 ? 'Sin aprobar' : ''}</p></div> },
  ];

  const save = async (payload: Record<string, unknown>) => {
    const body = { ...payload, type: payload.type || undefined };
    await (form?.row ? mktResources.campaigns.update(form.row.id, body) : mktResources.campaigns.create(body));
    toast.success(form?.row ? 'Campaña actualizada' : 'Campaña creada');
    refresh();
  };

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle guide={MARKETING_GUIDES.campanas} eyebrow="Marketing" title="Campañas" subtitle="Planifica, ejecuta y mide campañas digitales, deportivas, BTL, de eventos e internas." />
      <ResourceTable<MktCampaign> id="campaigns" fetcher={mktResources.campaigns.list} columns={columns} searchPlaceholder="Buscar campaña o código…"
        filters={[{ key: 'status', label: 'Estado', options: options(CAMPAIGN_STATUS_LABEL) }, { key: 'type', label: 'Tipo', options: options(CAMPAIGN_TYPE_LABEL) }]}
        emptyTitle="Aún no hay campañas" emptyDescription="Crea una campaña vinculada a un cliente y un brief."
        onRowClick={(row) => setDetailId(row.id)}
        toolbar={canCreate ? <Button type="button" onClick={() => setForm({})}><Plus className="size-4" aria-hidden="true" />Nueva campaña</Button> : undefined} />

      <FormSheet key={form ? form.row?.id ?? 'new' : 'closed'} open={Boolean(form)} onOpenChange={(o) => { if (!o) setForm(null); }}
        title={form?.row ? 'Editar campaña' : 'Nueva campaña'} fields={fields} initial={toInitial(fields, form?.row)} onSubmit={save} />

      <CampaignDetail id={detailId} currency={currency} canEdit={canEdit} onClose={() => setDetailId(null)} onEdit={(row) => { setDetailId(null); setForm({ row }); }} />
    </div>
  );
}

function CampaignDetail({ id, currency, canEdit, onClose, onEdit }: { id: string | null; currency: string; canEdit: boolean; onClose: () => void; onEdit: (row: MktCampaign) => void }) {
  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {id ? <DetailBody key={id} id={id} currency={currency} canEdit={canEdit} onEdit={onEdit} /> : (
          <SheetHeader className="px-6 pt-6"><SheetTitle>Campaña</SheetTitle><SheetDescription>Selecciona una campaña.</SheetDescription></SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({ id, currency, canEdit, onEdit }: { id: string; currency: string; canEdit: boolean; onEdit: (row: MktCampaign) => void }) {
  const { canPerform } = useAuth();
  const refresh = useMktRefresh();
  const users = useMktUsers();
  const q = useTenantQuery(['marketing', 'campaign', id], (s) => marketingApi.campaign(id, s), { staleTime: 5_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskUser, setTaskUser] = useState('');
  const canSubmit = canPerform('MARKETING_CAMPAIGNS', 'submit');
  const canTasks = canEdit && canPerform('ACTIVITIES_TASKS', 'create');

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); refresh(); await q.refetch(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };

  const c = q.data;
  const budget = Number(c?.budget ?? 0);
  const spent = Number(c?.spent ?? 0);
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const kpis = (c?.kpis ?? {}) as Record<string, number | null | Record<string, number>>;

  return (
    <>
      <SheetHeader className="space-y-1 border-b border-border px-6 pb-4 pt-6 text-left">
        {c && <p className="text-[11px] font-semibold text-muted-foreground">{c.code} · {CAMPAIGN_TYPE_LABEL[c.type]}{c.account ? ` · ${c.account.name}` : ''}</p>}
        <SheetTitle className="text-3xl text-primary dark:text-foreground" style={serifStyle}>{c?.name ?? 'Campaña'}</SheetTitle>
        <SheetDescription>{c?.objective || 'Sin objetivo definido.'}</SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {q.isLoading ? <Skeleton className="h-64 w-full" /> : q.isError || !c ? <ErrorState message={errorMessage(q.error, 'No se pudo cargar la campaña')} onRetry={() => void q.refetch()} /> : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={c.status} label={CAMPAIGN_STATUS_LABEL[c.status]} />
              {c.brief && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px]">Brief {c.brief.code}</span>}
              <span className="text-[11px] text-muted-foreground">{fmtDate(c.startDate)} – {fmtDate(c.endDate)}</span>
              {canEdit && <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => onEdit(c)}><Pencil className="size-3.5" aria-hidden="true" />Editar</Button>}
            </div>

            {canEdit && CAMPAIGN_NEXT[c.status]?.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label="Cambiar estado">
                {CAMPAIGN_NEXT[c.status].map((next) => (
                  <Button key={next} type="button" size="sm" variant={next === 'CANCELLED' ? 'outline' : 'secondary'} disabled={busy !== null}
                    onClick={() => void run(next, () => marketingApi.setCampaignStatus(c.id, next), `Estado: ${CAMPAIGN_STATUS_LABEL[next]}`)}>
                    {busy === next && <Loader2 className="size-3.5 animate-spin" />}→ {CAMPAIGN_STATUS_LABEL[next]}
                  </Button>
                ))}
              </div>
            )}

            <Panel title="Presupuesto">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div><p className="text-2xl font-bold text-primary dark:text-foreground">{money(budget, currency)}</p><p className="text-[11px] text-muted-foreground">Ejecutado {money(spent, currency)} · Restante {money(Math.max(budget - spent, 0), currency)}</p></div>
                {budget > 0 && (c.budgetApproved
                  ? <StatusBadge status="APPROVED" label="Presupuesto aprobado" />
                  : canSubmit && (
                    <Button type="button" size="sm" disabled={busy !== null || c.pendingApprovals > 0} onClick={() => void run('budget', () => marketingApi.requestBudget(c.id, {}), 'Aprobación solicitada')}>
                      {busy === 'budget' ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" aria-hidden="true" />}Solicitar aprobación
                    </Button>
                  ))}
              </div>
              <div className="mt-2 h-2 rounded-full bg-accent/15" role="img" aria-label={`${pct.toFixed(0)}% ejecutado`}><div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
              {c.pendingApprovals > 0 && <p className="mt-2 text-[11px] text-amber-700">Hay {c.pendingApprovals} solicitud(es) pendiente(s) para esta campaña.</p>}
            </Panel>

            <Panel title="Contenido y resultados">
              <div className="flex flex-wrap gap-2 text-[11px]">
                {Object.entries(c.contentByStatus).map(([s, n]) => <span key={s} className="rounded-full bg-muted px-2.5 py-1 font-semibold">{CONTENT_STATUS_LABEL[s]}: {n}</span>)}
                {Object.keys(c.contentByStatus).length === 0 && <span className="text-muted-foreground">Sin piezas de contenido (no es obligatorio en campañas deportivas, BTL o de eventos).</span>}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-[12px]">
                {(['REACH', 'CLICKS', 'LEADS', 'SPEND'] as const).map((m) => <div key={m}><dt className="text-muted-foreground">{METRIC_LABEL[m]}</dt><dd className="text-[15px] font-bold">{m === 'SPEND' ? money(kpis[m] ?? 0, currency) : compact(kpis[m] ?? 0)}</dd></div>)}
                <div><dt className="text-muted-foreground">ROAS</dt><dd className="text-[15px] font-bold">{typeof kpis.roas === 'number' ? `${kpis.roas.toFixed(2)}×` : '—'}</dd></div>
              </dl>
              <p className="mt-2 text-[11px] text-muted-foreground">Métricas manuales: {(kpis.bySource as Record<string, number>)?.MANUAL ?? 0} · verificadas: {(kpis.bySource as Record<string, number>)?.VERIFIED ?? 0}.</p>
            </Panel>

            <Panel title={`Tareas en Actividades (${c.tasks.done}/${c.tasks.total})`}>
              <ul className="divide-y divide-border">
                {c.tasks.items.length === 0 && <li className="py-2 text-[12px] text-muted-foreground">Aún no hay tareas vinculadas. Se crean en Actividades y cada responsable las ve en su agenda.</li>}
                {c.tasks.items.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                    <span className={t.status === 'COMPLETED' ? 'text-muted-foreground line-through' : 'font-semibold'}>{t.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{t.assignments[0]?.user?.name ?? '—'} · {fmtDate(t.dueDate)}</span>
                  </li>
                ))}
              </ul>
              {canTasks && (
                <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_150px_150px_auto]" onSubmit={(e) => {
                  e.preventDefault();
                  if (!taskTitle.trim()) return;
                  void run('task', async () => { await marketingApi.createCampaignTask(c.id, { title: taskTitle.trim(), dueDate: taskDue ? new Date(`${taskDue}T17:00:00`).toISOString() : undefined, assignedTo: taskUser ? [taskUser] : undefined }); setTaskTitle(''); setTaskDue(''); }, 'Tarea creada en Actividades');
                }}>
                  <Field label="Nueva tarea" htmlFor="mk-task"><Input id="mk-task" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Ej. Aprobar pauta en Meta" /></Field>
                  <Field label="Vence" htmlFor="mk-task-due"><input id="mk-task-due" type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-2 text-[13px]" /></Field>
                  <Field label="Responsable" htmlFor="mk-task-user"><NativeSelect id="mk-task-user" value={taskUser} onChange={(e) => setTaskUser(e.target.value)}><option value="">Yo</option>{userOptions(users.data).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></Field>
                  <Button type="submit" className="self-end" disabled={busy !== null || !taskTitle.trim()}>{busy === 'task' ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" aria-hidden="true" />}Crear</Button>
                </form>
              )}
            </Panel>

            <Panel title="Historial">
              <ul className="space-y-2">
                {c.history.length === 0 && <li className="text-[12px] text-muted-foreground">Sin movimientos.</li>}
                {c.history.map((h) => <li key={h.id} className="text-[12px]"><span className="block">{h.summary}</span><span className="text-[11px] text-muted-foreground">{fmtDate(h.createdAt, true)}</span></li>)}
              </ul>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
