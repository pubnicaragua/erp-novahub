import { useMemo, useState } from 'react';
import { MARKETING_GUIDES } from './guides';
import { addDays, format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Archive, ChevronLeft, ChevronRight, Loader2, Plus, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Skeleton } from '../ui/skeleton';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { marketingApi, mktResources, type MktContent } from '../../services/marketing.service';
import { toast } from '../../services/toast';
import { EmptyState, ErrorState, Field, NativeSelect, PageTitle, Panel, controlClass } from '../organizacion/OrgBits';
import { errorMessage, serifStyle } from '../organizacion/organizacion.utils';
import { APPROVAL_STATUS_LABEL, CONTENT_STATUS_LABEL, FORMAT_LABEL, fmtDate, toInputDateTime } from './marketing.constants';
import { FormSheet, ResourceTable, StatusBadge, type Column } from './MktBits';
import { options, useMktConfig, useMktRefresh, useMktUsers, userName, userOptions, type FieldDef } from './mkt.helpers';

type Mode = 'calendar' | 'list' | 'kanban';
const KANBAN: string[] = ['IDEA', 'DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SCHEDULED', 'PUBLISHED'];

export function ContenidosView() {
  const { canPerform } = useAuth();
  const refresh = useMktRefresh();
  const users = useMktUsers();
  const config = useMktConfig();
  const [mode, setMode] = useState<Mode>('calendar');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const canCreate = canPerform('MARKETING_CONTENT', 'create');
  const channels = useMemo(() => config.data?.channels ?? [], [config.data]);
  const campaigns = useTenantQuery(['marketing', 'campaigns-all'], (s) => mktResources.campaigns.list({ pageSize: 100 }, s), { staleTime: 60_000 });

  const range = useMemo(() => ({ from: weekStart.toISOString(), to: addDays(weekStart, 7).toISOString() }), [weekStart]);
  const week = useTenantQuery(['marketing', 'content-week', range.from], (s) => mktResources.content.list({ ...range, pageSize: 100 }, s), { enabled: mode === 'calendar', staleTime: 15_000 });
  const all = useTenantQuery(['marketing', 'content-board'], (s) => mktResources.content.list({ pageSize: 100 }, s), { enabled: mode === 'kanban', staleTime: 15_000 });

  const createFields: FieldDef[] = useMemo(() => [
    { key: 'title', label: 'Título', type: 'text', required: true, span: 2 },
    { key: 'channel', label: 'Canal', type: 'select', required: true, options: channels.map((c) => ({ value: c, label: c })) },
    { key: 'format', label: 'Formato', type: 'select', options: options(FORMAT_LABEL), placeholder: 'Post (por defecto)' },
    { key: 'campaignId', label: 'Campaña', type: 'select', hint: 'Opcional: puedes crear piezas sin campaña.', options: (campaigns.data?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` })) },
    { key: 'assigneeId', label: 'Responsable', type: 'select', options: userOptions(users.data) },
    { key: 'scheduledAt', label: 'Fecha objetivo', type: 'datetime' },
    { key: 'status', label: 'Estado inicial', type: 'select', options: [{ value: 'IDEA', label: 'Idea' }, { value: 'DRAFT', label: 'Borrador' }], placeholder: 'Borrador (por defecto)' },
    { key: 'copy', label: 'Copy / texto de publicación', type: 'textarea' },
  ], [channels, campaigns.data, users.data]);

  const columns: Array<Column<MktContent>> = [
    { key: 'title', header: 'Pieza', render: (r) => <div><p className="font-semibold">{r.title}</p><p className="text-[11px] text-muted-foreground">v{r.currentVersion}{r.approvedVersion ? ` · aprobada v${r.approvedVersion}` : ''}</p></div> },
    { key: 'channel', header: 'Canal', render: (r) => `${r.channel} · ${FORMAT_LABEL[r.format] ?? r.format}` },
    { key: 'status', header: 'Estado', render: (r) => <StatusBadge status={r.status} label={CONTENT_STATUS_LABEL[r.status]} /> },
    { key: 'date', header: 'Fecha', render: (r) => fmtDate(r.scheduledAt, true) },
    { key: 'owner', header: 'Responsable', render: (r) => userName(users.data, r.assigneeId) },
  ];

  const chip = (item: MktContent) => (
    <button key={item.id} type="button" onClick={() => setDetailId(item.id)}
      className="w-full min-w-0 rounded-lg border border-border bg-card px-2 py-1.5 text-left text-[11px] shadow-sm transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
      <span className="block truncate font-semibold">{item.title}</span>
      <span className="mt-0.5 flex items-center justify-between gap-1 text-muted-foreground">{item.scheduledAt ? format(new Date(item.scheduledAt), 'HH:mm') : ''}<StatusBadge status={item.status} label={CONTENT_STATUS_LABEL[item.status]} /></span>
    </button>
  );

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekItems = week.data?.data ?? [];
  const rows = [...new Set([...channels, ...weekItems.map((i) => i.channel)])].filter((ch) => channels.includes(ch) || weekItems.some((i) => i.channel === ch));

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle guide={MARKETING_GUIDES.contenidos} eyebrow="Marketing" title="Contenidos" subtitle="Planifica, redacta, aprueba y programa piezas por canal. Aprobar no es publicar."
        actions={canCreate ? <Button type="button" onClick={() => setCreateOpen(true)}><Plus className="size-4" aria-hidden="true" />Crear contenido</Button> : undefined} />

      <div role="tablist" aria-label="Vista de contenidos" className="flex gap-2">
        {([['calendar', 'Calendario'], ['list', 'Lista'], ['kanban', 'Kanban']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
            className={cn('rounded-lg border px-4 py-2 text-[13px] font-semibold', mode === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/50')}>{label}</button>
        ))}
      </div>

      {mode === 'calendar' && (
        <section className="min-w-0 rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="icon" variant="outline" aria-label="Semana anterior" onClick={() => setWeekStart((d) => addDays(d, -7))}><ChevronLeft className="size-4" /></Button>
            <Button type="button" size="icon" variant="outline" aria-label="Semana siguiente" onClick={() => setWeekStart((d) => addDays(d, 7))}><ChevronRight className="size-4" /></Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Hoy</Button>
            <h2 className="text-[14px] font-semibold capitalize">Semana del {format(weekStart, 'd', { locale: es })} – {format(addDays(weekStart, 6), "d 'de' MMMM yyyy", { locale: es })}</h2>
          </div>
          {week.isLoading ? <Skeleton className="h-64 w-full" /> : week.isError ? <ErrorState message={errorMessage(week.error)} onRetry={() => void week.refetch()} /> : rows.length === 0 ? (
            <EmptyState title="Sin canales configurados" description="Define los canales en Configuración para ver la parrilla." />
          ) : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[820px]" style={{ gridTemplateColumns: '120px repeat(7, minmax(0, 1fr))' }} role="grid" aria-label="Parrilla semanal de contenidos">
                <div />
                {days.map((d) => <div key={d.toISOString()} className="border-b border-border px-2 py-2 text-center text-[12px] font-semibold capitalize">{format(d, 'EEE dd', { locale: es })}</div>)}
                {rows.map((ch) => (
                  <div key={ch} className="contents">
                    <div className="border-b border-border px-2 py-3 text-[12px] font-semibold">{ch}</div>
                    {days.map((d) => {
                      const cell = weekItems.filter((i) => i.channel === ch && i.scheduledAt && format(new Date(i.scheduledAt), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd'));
                      return <div key={d.toISOString() + ch} className="min-h-16 space-y-1 border-b border-l border-border p-1">{cell.map(chip)}</div>;
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {mode === 'list' && (
        <ResourceTable<MktContent> id="content" fetcher={mktResources.content.list} columns={columns} searchPlaceholder="Buscar pieza o copy…" onRowClick={(r) => setDetailId(r.id)}
          filters={[{ key: 'status', label: 'Estado', options: options(CONTENT_STATUS_LABEL) }, { key: 'channel', label: 'Canal', options: channels.map((c) => ({ value: c, label: c })) }]}
          emptyTitle="Aún no hay contenidos" emptyDescription="Crea la primera pieza desde «Crear contenido»." />
      )}

      {mode === 'kanban' && (
        all.isLoading ? <Skeleton className="h-64 w-full" /> : all.isError ? <ErrorState message={errorMessage(all.error)} onRetry={() => void all.refetch()} /> : (
          <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-4 xl:grid-cols-7">
            {KANBAN.map((s) => {
              const items = (all.data?.data ?? []).filter((i) => i.status === s);
              return (
                <section key={s} aria-label={CONTENT_STATUS_LABEL[s]} className="min-w-[170px] rounded-xl border border-border bg-muted/20 p-2">
                  <h3 className="mb-2 flex items-center justify-between text-[12px] font-semibold">{CONTENT_STATUS_LABEL[s]}<span className="rounded-full bg-muted px-2 text-[11px]">{items.length}</span></h3>
                  <div className="space-y-1.5">{items.map(chip)}</div>
                </section>
              );
            })}
          </div>
        )
      )}

      <FormSheet key={createOpen ? 'open' : 'closed'} open={createOpen} onOpenChange={setCreateOpen} title="Crear contenido" description="La pieza nace como idea o borrador y avanza con el flujo de revisión."
        fields={createFields} initial={{ status: 'DRAFT' }}
        onSubmit={async (p) => { await mktResources.content.create({ ...p, format: p.format || undefined, status: p.status || undefined }); toast.success('Contenido creado'); refresh(); }} />

      <ContentDetail id={detailId} channels={channels} onClose={() => setDetailId(null)} />
    </div>
  );
}

function ContentDetail({ id, channels, onClose }: { id: string | null; channels: string[]; onClose: () => void }) {
  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {id ? <ContentBody key={id} id={id} channels={channels} /> : <SheetHeader className="px-6 pt-6"><SheetTitle>Contenido</SheetTitle><SheetDescription>Selecciona una pieza.</SheetDescription></SheetHeader>}
      </SheetContent>
    </Sheet>
  );
}

function ContentBody({ id, channels }: { id: string; channels: string[] }) {
  const { canPerform } = useAuth();
  const refresh = useMktRefresh();
  const users = useMktUsers();
  const q = useTenantQuery(['marketing', 'content', id], (s) => marketingApi.contentDetail(id, s), { staleTime: 5_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [edits, setEdits] = useState<{ title?: string; copy?: string; channel?: string; scheduledAt?: string; assigneeId?: string }>({});
  const [publishUrl, setPublishUrl] = useState('');
  const [publishNote, setPublishNote] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const c = q.data;
  const canEdit = canPerform('MARKETING_CONTENT', 'edit');
  const canSubmit = canPerform('MARKETING_CONTENT', 'submit');
  const canPublish = canPerform('MARKETING_CONTENT', 'authorize');
  const editable = Boolean(c) && canEdit && !['IN_REVIEW', 'PUBLISHED', 'ARCHIVED'].includes(c!.status);
  const dirty = Object.keys(edits).length > 0;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key); setError('');
    try { await fn(); toast.success(ok); setEdits({}); refresh(); await q.refetch(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };
  const val = <K extends keyof typeof edits>(k: K, fallback: string) => (edits[k] ?? fallback) as string;
  const save = () => run('save', () => marketingApi.updateContent(id, {
    ...(edits.title !== undefined ? { title: edits.title } : {}), ...(edits.copy !== undefined ? { copy: edits.copy } : {}),
    ...(edits.channel !== undefined ? { channel: edits.channel } : {}), ...(edits.assigneeId !== undefined ? { assigneeId: edits.assigneeId || null } : {}),
    ...(edits.scheduledAt !== undefined ? { scheduledAt: edits.scheduledAt ? new Date(edits.scheduledAt).toISOString() : null } : {}),
  }), 'Cambios guardados');

  const toggleCheck = (index: number) => {
    const list = [...(c?.checklist ?? [])];
    list[index] = { ...list[index], done: !list[index].done };
    void run('check', () => marketingApi.updateContent(id, { checklist: list }), 'Checklist actualizado');
  };

  return (
    <>
      <SheetHeader className="space-y-1 border-b border-border px-6 pb-4 pt-6 text-left">
        {c && <div className="flex flex-wrap items-center gap-2"><StatusBadge status={c.status} label={CONTENT_STATUS_LABEL[c.status]} /><span className="text-[11px] text-muted-foreground">v{c.currentVersion}{c.approvedVersion ? ` · aprobada v${c.approvedVersion}` : ''}</span></div>}
        <SheetTitle className="text-3xl text-primary dark:text-foreground" style={serifStyle}>{c?.title ?? 'Contenido'}</SheetTitle>
        <SheetDescription>{c ? `${c.channel} · ${FORMAT_LABEL[c.format] ?? c.format}` : ''}</SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {q.isLoading ? <Skeleton className="h-64 w-full" /> : q.isError || !c ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} /> : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Título" htmlFor="ct-title" className="sm:col-span-2"><Input id="ct-title" disabled={!editable} value={val('title', c.title)} onChange={(e) => setEdits((s) => ({ ...s, title: e.target.value }))} /></Field>
              <Field label="Canal" htmlFor="ct-channel"><NativeSelect id="ct-channel" disabled={!editable} value={val('channel', c.channel)} onChange={(e) => setEdits((s) => ({ ...s, channel: e.target.value }))}>{[...new Set([c.channel, ...channels])].map((ch) => <option key={ch} value={ch}>{ch}</option>)}</NativeSelect></Field>
              <Field label="Responsable" htmlFor="ct-owner"><NativeSelect id="ct-owner" disabled={!editable} value={val('assigneeId', c.assigneeId ?? '')} onChange={(e) => setEdits((s) => ({ ...s, assigneeId: e.target.value }))}><option value="">Sin asignar</option>{userOptions(users.data).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</NativeSelect></Field>
              <Field label="Fecha objetivo" htmlFor="ct-date" className="sm:col-span-2"><input id="ct-date" type="datetime-local" className={controlClass} disabled={!editable} value={val('scheduledAt', toInputDateTime(c.scheduledAt))} onChange={(e) => setEdits((s) => ({ ...s, scheduledAt: e.target.value }))} /></Field>
              <Field label="Copy" htmlFor="ct-copy" className="sm:col-span-2" hint={editable && ['APPROVED', 'SCHEDULED'].includes(c.status) ? 'Editar el copy creará una nueva versión y requerirá una nueva revisión.' : undefined}>
                <Textarea id="ct-copy" rows={5} disabled={!editable} value={val('copy', c.copy ?? '')} onChange={(e) => setEdits((s) => ({ ...s, copy: e.target.value }))} />
              </Field>
            </div>
            {dirty && editable && <Button type="button" onClick={() => void save()} disabled={busy !== null}>{busy === 'save' && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Guardar cambios</Button>}
            {!editable && c.status === 'IN_REVIEW' && <p className="rounded-lg bg-amber-50 p-3 text-[12px] text-amber-900">La pieza está en revisión y no puede editarse hasta que se resuelva la solicitud.</p>}

            {(c.checklist?.length ?? 0) > 0 && (
              <Panel title={`Checklist (${c.checklist!.filter((i) => i.done).length}/${c.checklist!.length})`}>
                <ul className="space-y-1.5">{c.checklist!.map((item, i) => (
                  <li key={i}><label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="size-4 accent-[#01422C]" checked={item.done} disabled={!canEdit || busy !== null} onChange={() => toggleCheck(i)} />{item.label}</label></li>
                ))}</ul>
              </Panel>
            )}

            <Panel title="Acciones del flujo">
              <div className="flex flex-wrap gap-2">
                {canEdit && ['IDEA', 'REJECTED'].includes(c.status) && <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run('draft', () => marketingApi.toDraft(id), 'Pasó a borrador')}>Pasar a borrador</Button>}
                {canSubmit && ['DRAFT', 'CHANGES_REQUESTED'].includes(c.status) && (
                  <Button type="button" disabled={busy !== null || dirty} title={dirty ? 'Guarda los cambios antes de enviar' : undefined} onClick={() => void run('submit', () => marketingApi.submitReview(id), 'Enviado a aprobación')}>
                    {busy === 'submit' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" aria-hidden="true" />}Enviar a aprobación
                  </Button>
                )}
                {canEdit && !['PUBLISHED', 'ARCHIVED', 'IN_REVIEW'].includes(c.status) && <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run('archive', () => marketingApi.archive(id), 'Archivado')}><Archive className="size-4" aria-hidden="true" />Archivar</Button>}
                {c.status === 'PUBLISHED' && canEdit && <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run('archive', () => marketingApi.archive(id), 'Archivado')}><Archive className="size-4" aria-hidden="true" />Archivar</Button>}
                {c.status === 'IN_REVIEW' && <p className="text-[12px] text-muted-foreground">Esperando la decisión de un aprobador en la bandeja de Aprobaciones.</p>}
              </div>

              {canEdit && ['APPROVED', 'SCHEDULED'].includes(c.status) && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Field label="Programar para" htmlFor="ct-sched"><input id="ct-sched" type="datetime-local" className={controlClass} value={scheduleAt || toInputDateTime(c.scheduledAt)} onChange={(e) => setScheduleAt(e.target.value)} /></Field>
                  <Button type="button" variant="outline" disabled={busy !== null || !(scheduleAt || c.scheduledAt)} onClick={() => void run('schedule', () => marketingApi.schedule(id, new Date(scheduleAt || c.scheduledAt!).toISOString()), 'Contenido programado (aún no publicado)')}>Programar</Button>
                </div>
              )}
              {canPublish && ['APPROVED', 'SCHEDULED'].includes(c.status) && (
                <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-[12px] font-semibold">Registrar publicación manual</p>
                  <p className="text-[11px] text-muted-foreground">NovaHub no está conectado a las redes sociales: registra aquí cuando la pieza ya salió. No se publica automáticamente.</p>
                  <Input value={publishUrl} onChange={(e) => setPublishUrl(e.target.value)} placeholder="Enlace de la publicación (opcional)" aria-label="Enlace de la publicación" />
                  <Input value={publishNote} onChange={(e) => setPublishNote(e.target.value)} placeholder="Nota o evidencia (opcional)" aria-label="Nota de publicación" />
                  <Button type="button" disabled={busy !== null} onClick={() => void run('publish', () => marketingApi.publish(id, { publishedUrl: publishUrl || undefined, note: publishNote || undefined }), 'Publicación registrada')}>Registrar como publicada</Button>
                </div>
              )}
              {c.status === 'PUBLISHED' && <p className="mt-2 text-[12px] text-muted-foreground">Publicada el {fmtDate(c.publishedAt, true)} · registro {c.publishInfo?.source === 'MANUAL' ? 'manual' : ''}{c.publishInfo?.url ? <> · <a className="underline" href={c.publishInfo.url} target="_blank" rel="noreferrer">ver publicación</a></> : null}</p>}
            </Panel>

            <Panel title="Versiones y aprobaciones">
              <ul className="space-y-2 text-[12px]">
                {c.approvals.map((a) => (
                  <li key={a.id} className="rounded-lg border border-border p-2"><div className="flex items-center justify-between gap-2"><span className="font-semibold">v{a.version} · {APPROVAL_STATUS_LABEL[a.status]}</span><span className="text-muted-foreground">{fmtDate(a.decidedAt ?? a.createdAt, true)}</span></div>
                    <p className="text-muted-foreground">Solicitó {a.requestedBy?.name ?? '—'}{a.decidedBy ? ` · decidió ${a.decidedBy.name}` : ''}</p>{a.comment && <p className="mt-1">“{a.comment}”</p>}</li>
                ))}
                {c.versions.map((v) => <li key={v.id} className="text-muted-foreground">Versión v{v.version} enviada a revisión el {fmtDate(v.createdAt, true)}{v.version === c.approvedVersion ? ' · aprobada' : ''}</li>)}
                {c.approvals.length === 0 && c.versions.length === 0 && <li className="text-muted-foreground">Aún no se ha enviado a revisión.</li>}
              </ul>
            </Panel>
            {c.assets.length > 0 && <Panel title={`Activos vinculados (${c.assets.length})`}><ul className="text-[12px]">{c.assets.map((a) => <li key={a.id}>{a.name}</li>)}</ul></Panel>}
            {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[12px] text-destructive">{error}</p>}
          </>
        )}
      </div>
    </>
  );
}
