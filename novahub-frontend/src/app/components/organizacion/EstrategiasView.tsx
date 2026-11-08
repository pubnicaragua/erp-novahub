import { useEffect, useState } from 'react';
import { Bell, FileText, Image as ImageIcon, Lightbulb, Loader2, MessageSquare, Mic, Paperclip, Plus, Search, Square, ThumbsUp, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { organizacionService } from '../../services/organizacion.service';
import { storageService } from '../../services/storage.service';
import {
  strategiesService, type StrategyAttachment, type StrategyAudience, type StrategyDetail, type StrategyInput, type StrategyKind, type StrategyStatus, type StrategySummary,
} from '../../services/strategies.service';
import { toast } from '../../services/toast';
import { EmptyState, ErrorState, Field, NativeSelect, PageTitle, controlClass } from './OrgBits';
import { errorMessage } from './organizacion.utils';
import { useVoiceRecorder, type RecordedVoice } from './useVoiceRecorder';

const STATUS_LABEL: Record<StrategyStatus, string> = { IDEA: 'Nueva', EVALUATING: 'En evaluación', APPROVED: 'Aprobada', DISCARDED: 'Descartada' };
const STATUS_TONE: Record<StrategyStatus, string> = { IDEA: 'bg-slate-100 text-slate-800', EVALUATING: 'bg-amber-100 text-amber-900', APPROVED: 'bg-emerald-100 text-emerald-900', DISCARDED: 'bg-red-100 text-red-900' };
const AUDIENCE_LABEL: Record<StrategyAudience, string> = { PRIVATE: 'Solo yo', USERS: 'Personas elegidas', TEAM: 'Todo el equipo' };
const KIND_LABEL: Record<StrategyKind, string> = { IDEA: 'Idea', STRATEGY: 'Estrategia' };
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const when = (iso: string) => new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Estrategias: ideas y estrategias comerciales que se comparten con el equipo (texto, archivos, fotos, voz y comentarios). */
export function EstrategiasView() {
  const { canPerform } = useAuth();
  const canEdit = canPerform('ORGANIZATION_SHARED', 'edit');
  const client = useQueryClient();
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [tag, setTag] = useState('');
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<StrategyDetail | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 350); return () => window.clearTimeout(timer); }, [search]);
  const params = { status: status || undefined, kind: kind || undefined, tag: tag || undefined, q: query || undefined, mine: mine ? 'true' : undefined, pageSize: 40 };
  const list = useTenantQuery(['strategies', JSON.stringify(params)], (signal) => strategiesService.list(params, signal), { staleTime: 20_000, placeholderData: (previous) => previous });
  const users = useTenantQuery(['organizacion', 'users'], (signal) => organizacionService.getUsers(signal), { staleTime: 5 * 60_000 });
  const refresh = () => void client.invalidateQueries({ queryKey: ['tenant-module'] });
  const tags = [...new Set((list.data?.items ?? []).flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle eyebrow="Organización personal" title="Estrategias" subtitle="Comparte ideas y estrategias comerciales con el equipo: tú decides quién las ve, y pueden llevar texto, archivos, fotos y notas de voz."
        actions={canEdit ? <Button type="button" onClick={() => setEditing('new')}><Plus className="size-4" />Nueva idea</Button> : undefined} />

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Buscar" htmlFor="strategy-search" className="min-w-52 flex-1">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input id="strategy-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título o texto" className={cn(controlClass, 'pl-9')} /></div>
        </Field>
        <Field label="Estado" className="w-40"><NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option>{(Object.keys(STATUS_LABEL) as StrategyStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</NativeSelect></Field>
        <Field label="Tipo" className="w-36"><NativeSelect value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos</option><option value="IDEA">Ideas</option><option value="STRATEGY">Estrategias</option></NativeSelect></Field>
        <Field label="Etiqueta" className="w-40"><NativeSelect value={tag} onChange={(e) => setTag(e.target.value)}><option value="">Todas</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</NativeSelect></Field>
        <label className="flex items-center gap-2 pb-2 text-[13px] font-semibold"><Switch checked={mine} onCheckedChange={setMine} />Solo las mías</label>
      </div>

      {list.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-40" />)}</div>
        : list.isError ? <ErrorState message={errorMessage(list.error, 'No se pudieron cargar las ideas')} onRetry={() => void list.refetch()} />
        : !list.data?.items.length ? <EmptyState title="Aún no hay ideas" description="Escribe tu primera idea o estrategia y compártela con quien quieras." action={canEdit ? <Button type="button" className="mt-2" onClick={() => setEditing('new')}><Plus className="size-4" />Nueva idea</Button> : undefined} />
        : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.data.items.map((item) => <IdeaCard key={item.id} item={item} onOpen={() => setOpenId(item.id)} />)}
          </ul>
        )}

      {editing && <IdeaEditor idea={editing === 'new' ? null : editing} users={users.data ?? []} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); refresh(); setOpenId(id); }} />}
      {openId && !editing && <IdeaDetail id={openId} users={users.data ?? []} onClose={() => setOpenId(null)} onChanged={refresh} onEdit={(idea) => { setOpenId(null); setEditing(idea); }} />}
    </div>
  );
}

function IdeaCard({ item, onOpen }: { item: StrategySummary; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex h-full w-full min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          <span className={cn('rounded-full px-2 py-0.5', STATUS_TONE[item.status])}>{STATUS_LABEL[item.status]}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary dark:text-accent">{KIND_LABEL[item.kind]}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-800">{AUDIENCE_LABEL[item.audience]}</span>
        </div>
        <p className="break-words text-[14px] font-semibold">{item.title}</p>
        <p className="line-clamp-3 break-words text-[12px] text-muted-foreground">{item.excerpt}</p>
        {item.tags.length > 0 && <p className="flex flex-wrap gap-1">{item.tags.map((tag) => <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{tag}</span>)}</p>}
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{item.authorName}</span>
          <span className="flex items-center gap-1"><ThumbsUp className="size-3" aria-hidden="true" />{item.voteCount}</span>
          <span className="flex items-center gap-1"><MessageSquare className="size-3" aria-hidden="true" />{item.commentCount}</span>
          {item.attachmentCount > 0 && <span className="flex items-center gap-1"><Paperclip className="size-3" aria-hidden="true" />{item.attachmentCount}</span>}
          <span>{when(item.updatedAt)}</span>
        </p>
      </button>
    </li>
  );
}

// ───────────── Detalle ─────────────
function IdeaDetail({ id, users, onClose, onChanged, onEdit }: { id: string; users: Array<{ id: string; name: string }>; onClose: () => void; onChanged: () => void; onEdit: (idea: StrategyDetail) => void }) {
  const { user } = useAuth();
  const detail = useTenantQuery(['strategies', 'detail', id], (signal) => strategiesService.get(id, signal), { staleTime: 5_000 });
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const idea = detail.data;
  const reload = () => { void detail.refetch(); onChanged(); };
  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try { await action(); if (success) toast.success(success); reload(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        {detail.isLoading || detail.isError || !idea ? <DialogTitle className="sr-only">Idea</DialogTitle> : null}
        {detail.isLoading ? <Skeleton className="h-64 w-full" aria-busy="true" />
          : detail.isError || !idea ? <ErrorState message={errorMessage(detail.error, 'No se pudo abrir la idea')} onRetry={() => void detail.refetch()} />
          : (
            <>
              <DialogHeader>
                <DialogTitle className="break-words pr-6">{idea.title}</DialogTitle>
                <DialogDescription>{KIND_LABEL[idea.kind]} de {idea.authorName} · {when(idea.createdAt)} · {AUDIENCE_LABEL[idea.audience]}{idea.audience === 'USERS' ? `: ${idea.audienceUsers.map((u) => u.name).join(', ')}` : ''}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_TONE[idea.status])}>{STATUS_LABEL[idea.status]}</span>
                {idea.decidedByName && <span className="text-[11px] text-muted-foreground">Decidió {idea.decidedByName}</span>}
                {idea.tags.map((tag) => <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{tag}</span>)}
                {idea.notifyPush && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Bell className="size-3" aria-hidden="true" />Avisó por notificación</span>}
              </div>
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{idea.body}</p>

              {idea.attachments.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {idea.attachments.map((attachment) => <AttachmentItem key={attachment.id} attachment={attachment} canRemove={idea.canEdit} onRemove={() => void run(() => strategiesService.removeAttachment(id, attachment.id))} />)}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant={idea.myVote ? 'default' : 'outline'} disabled={busy} onClick={() => void run(() => strategiesService.toggleVote(id))}><ThumbsUp className="size-4" />{idea.voteCount} {idea.myVote ? 'Te gusta' : 'Me gusta'}</Button>
                {idea.canEdit && (
                  <>
                    <NativeSelect aria-label="Cambiar el estado" className="h-9 w-44" value={idea.status} disabled={busy} onChange={(e) => void run(() => strategiesService.setStatus(id, e.target.value as StrategyStatus), 'Estado actualizado')}>
                      {(Object.keys(STATUS_LABEL) as StrategyStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </NativeSelect>
                    <Button type="button" size="sm" variant="outline" onClick={() => onEdit(idea)}>Editar</Button>
                    {!idea.convertedTaskId && <Button type="button" size="sm" variant="outline" onClick={() => { setConverting((v) => !v); setAssignee(user?.id ?? ''); }}>Convertir en tarea</Button>}
                    <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => { if (window.confirm('¿Borrar esta idea con sus comentarios y archivos?')) void run(async () => { await strategiesService.remove(id); onClose(); }, 'Idea borrada'); }}><Trash2 className="size-4" />Borrar</Button>
                  </>
                )}
              </div>
              {idea.convertedTaskId && <p className="text-[12px] text-muted-foreground">Ya se convirtió en una tarea (Actividades, Tareas).</p>}
              {converting && (
                <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-3">
                  <Field label="Responsable" className="min-w-44"><NativeSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</NativeSelect></Field>
                  <Field label="Fecha límite (opcional)"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={cn(controlClass, 'w-40')} /></Field>
                  <Button type="button" disabled={busy || !assignee} onClick={() => void run(async () => { await strategiesService.convertToTask(id, { assigneeId: assignee, dueDate: dueDate ? `${dueDate}T23:59:00` : undefined }); setConverting(false); }, 'Tarea creada')}>Crear tarea</Button>
                </div>
              )}

              <section aria-labelledby="idea-comments" className="space-y-2">
                <h3 id="idea-comments" className="text-[13px] font-semibold">Comentarios ({idea.commentCount})</h3>
                <ul className="space-y-2">
                  {idea.comments.map((item) => (
                    <li key={item.id} className="rounded-lg border border-border p-2.5 text-[12px]">
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold">{item.authorName}</span><span className="text-muted-foreground">{when(item.createdAt)}</span></div>
                      <p className="mt-1 whitespace-pre-wrap break-words">{item.body}</p>
                      {(item.authorId === user?.id || idea.canEdit) && <button type="button" className="mt-1 text-[11px] text-muted-foreground underline" onClick={() => void run(() => strategiesService.removeComment(id, item.id))}>Borrar</button>}
                    </li>
                  ))}
                </ul>
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(async () => { await strategiesService.addComment(id, comment.trim()); setComment(''); }); }}>
                  <Textarea aria-label="Escribe un comentario" rows={2} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escribe un comentario" className="min-h-0 flex-1" />
                  <Button type="submit" disabled={busy || !comment.trim()} className="self-end">Comentar</Button>
                </form>
              </section>
            </>
          )}
      </DialogContent>
    </Dialog>
  );
}

function AttachmentItem({ attachment, canRemove, onRemove }: { attachment: StrategyAttachment; canRemove: boolean; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    storageService.resolveUrl(attachment.uri).then((value) => { if (active) setUrl(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attachment.uri]);
  return (
    <li className="min-w-0 rounded-xl border border-border p-2.5">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 break-words text-[12px] font-semibold">{attachment.kind === 'PHOTO' ? <ImageIcon className="size-3.5 shrink-0" aria-hidden="true" /> : attachment.kind === 'VOICE' ? <Mic className="size-3.5 shrink-0" aria-hidden="true" /> : <FileText className="size-3.5 shrink-0" aria-hidden="true" />}{attachment.kind === 'VOICE' ? `Nota de voz${attachment.durationSeconds ? ` · ${clock(attachment.durationSeconds)}` : ''}` : attachment.fileName}</p>
        {canRemove && <button type="button" aria-label={`Quitar ${attachment.fileName}`} onClick={onRemove} className="text-muted-foreground hover:text-destructive"><X className="size-4" /></button>}
      </div>
      {failed ? <p className="text-[11px] text-destructive">No se pudo abrir el archivo.</p>
        : !url ? <Skeleton className="h-16 w-full" aria-busy="true" />
        : attachment.kind === 'PHOTO' ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={attachment.fileName} loading="lazy" className="max-h-56 w-full rounded-lg object-contain" /></a>
        : attachment.kind === 'VOICE' ? <audio controls preload="none" src={url} className="w-full" aria-label="Reproducir la nota de voz" />
        : <a href={url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-primary underline dark:text-accent">Abrir archivo</a>}
    </li>
  );
}

// ───────────── Crear y editar ─────────────
interface PendingFile { key: string; file: File; kind: 'FILE' | 'PHOTO' | 'VOICE'; durationSeconds?: number }

function IdeaEditor({ idea, users, onClose, onSaved }: { idea: StrategyDetail | null; users: Array<{ id: string; name: string }>; onClose: () => void; onSaved: (id: string) => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(idea?.title ?? '');
  const [body, setBody] = useState(idea?.body ?? '');
  const [kind, setKind] = useState<StrategyKind>(idea?.kind ?? 'IDEA');
  const [audience, setAudience] = useState<StrategyAudience>(idea?.audience ?? 'PRIVATE');
  const [audienceUserIds, setAudienceUserIds] = useState<string[]>(idea?.audienceUserIds ?? []);
  const [tags, setTags] = useState((idea?.tags ?? []).join(', '));
  const [notifyPush, setNotifyPush] = useState(idea?.notifyPush ?? false);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);

  const addFiles = (list: FileList | null, kindOf: PendingFile['kind']) => {
    if (!list) return;
    const accepted: PendingFile[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) { toast.error(`«${file.name}» pesa más de 15 MB.`); continue; }
      accepted.push({ key: `${file.name}-${file.size}-${Date.now()}-${accepted.length}`, file, kind: kindOf });
    }
    setFiles((current) => [...current, ...accepted].slice(0, 20));
  };
  const addVoice = (recorded: RecordedVoice | null) => {
    if (!recorded) return;
    setFiles((current) => [...current, { key: `voz-${Date.now()}`, file: recorded.file, kind: 'VOICE' as const, durationSeconds: recorded.durationSeconds }].slice(0, 20));
  };
  const voice = useVoiceRecorder(addVoice);
  const toggleRecording = async () => { if (voice.recording) addVoice(await voice.stop()); else await voice.start(); };
  const toggleUser = (id: string) => setAudienceUserIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const valid = title.trim() && body.trim() && (audience !== 'USERS' || audienceUserIds.length > 0);

  const save = async () => {
    setBusy(true);
    try {
      const uploaded: NonNullable<StrategyInput['attachments']> = [];
      for (const item of files) {
        const result = await storageService.uploadFile('strategy-attachment', item.file);
        uploaded.push({ kind: item.kind, uri: result.uri, fileName: item.file.name, mimeType: item.file.type || 'application/octet-stream', byteSize: item.file.size, durationSeconds: item.durationSeconds ?? null });
      }
      const payload = { title: title.trim(), body: body.trim(), kind, audience, audienceUserIds: audience === 'USERS' ? audienceUserIds : [], tags: tags.split(',').map((t) => t.trim()).filter(Boolean), notifyPush };
      let id: string;
      if (idea) {
        await strategiesService.update(idea.id, payload);
        for (const attachment of uploaded) await strategiesService.addAttachment(idea.id, attachment);
        id = idea.id;
      } else id = (await strategiesService.create({ ...payload, attachments: uploaded })).id;
      toast.success(idea ? 'Idea actualizada' : 'Idea guardada');
      onSaved(id);
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{idea ? 'Editar idea' : 'Nueva idea'}</DialogTitle><DialogDescription>Escríbela como te salga: puedes pulirla después. Tú decides quién la ve.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título" htmlFor="idea-title" required className="sm:col-span-2"><input id="idea-title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} className={controlClass} placeholder="Webinar mensual para emprendedoras" /></Field>
          <Field label="Tipo" htmlFor="idea-kind"><NativeSelect id="idea-kind" value={kind} onChange={(e) => setKind(e.target.value as StrategyKind)}><option value="IDEA">Idea suelta</option><option value="STRATEGY">Estrategia</option></NativeSelect></Field>
          <Field label="Etiquetas (separadas por coma)" htmlFor="idea-tags"><input id="idea-tags" value={tags} onChange={(e) => setTags(e.target.value)} className={controlClass} placeholder="Ventas, Marketing" /></Field>
          <Field label="Texto" htmlFor="idea-body" required className="sm:col-span-2"><Textarea id="idea-body" rows={7} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        </div>

        <fieldset className="rounded-xl border border-border p-3">
          <legend className="px-1 text-[12px] font-semibold">¿Quién la ve?</legend>
          <div role="radiogroup" aria-label="Quién la ve" className="flex flex-wrap gap-2">
            {(Object.keys(AUDIENCE_LABEL) as StrategyAudience[]).map((value) => (
              <button key={value} type="button" role="radio" aria-checked={audience === value} onClick={() => setAudience(value)} className={cn('rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition', audience === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted/50')}>{AUDIENCE_LABEL[value]}</button>
            ))}
          </div>
          {audience === 'USERS' && (
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {users.filter((u) => u.id !== user?.id).map((u) => <li key={u.id}><label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[13px] hover:bg-muted/50"><input type="checkbox" checked={audienceUserIds.includes(u.id)} onChange={() => toggleUser(u.id)} />{u.name}</label></li>)}
            </ul>
          )}
          {audience !== 'PRIVATE' && <label className="mt-3 flex items-center gap-2 text-[13px]"><Switch checked={notifyPush} onCheckedChange={setNotifyPush} />Avisar por notificación a quienes la ven</label>}
        </fieldset>

        <fieldset className="rounded-xl border border-border p-3">
          <legend className="px-1 text-[12px] font-semibold">Archivos, fotos y voz</legend>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:bg-muted/50"><Paperclip className="size-4" aria-hidden="true" />Archivo<input type="file" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files, 'FILE'); e.target.value = ''; }} /></label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold hover:bg-muted/50"><ImageIcon className="size-4" aria-hidden="true" />Foto<input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files, 'PHOTO'); e.target.value = ''; }} /></label>
            {voice.supported && <Button type="button" size="sm" variant={voice.recording ? 'destructive' : 'outline'} onClick={() => void toggleRecording()}>{voice.recording ? <Square className="size-4" /> : <Mic className="size-4" />}{voice.recording ? `Detener (${clock(voice.seconds)})` : 'Nota de voz'}</Button>}
          </div>
          {voice.error && <p role="alert" className="mt-2 text-[12px] text-destructive">{voice.error}</p>}
          {idea && idea.attachments.length > 0 && <p className="mt-2 text-[11px] text-muted-foreground">Esta idea ya tiene {idea.attachments.length} adjunto{idea.attachments.length === 1 ? '' : 's'}; se quitan desde el detalle.</p>}
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((item) => <li key={item.key} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1 text-[12px]"><span className="min-w-0 break-words">{item.kind === 'VOICE' ? `Nota de voz (${clock(item.durationSeconds ?? 0)})` : item.file.name}</span><button type="button" aria-label={`Quitar ${item.file.name}`} onClick={() => setFiles((current) => current.filter((f) => f.key !== item.key))}><X className="size-4" /></button></li>)}
            </ul>
          )}
        </fieldset>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="button" onClick={() => void save()} disabled={busy || !valid || voice.recording}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Lightbulb className="size-4" />}{idea ? 'Guardar cambios' : 'Guardar idea'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
