import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, FileText, Info, Loader2, Mic, Paperclip, RotateCcw, Send, Square, Users, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { useVoiceRecorder } from '../../organizacion/useVoiceRecorder';
import {
  fetchWhatsAppMediaUrl, whatsappService, type WaConversation, type WaMessage, type WaOverview,
} from '../../../services/whatsapp.service';
import {
  FALLBACK_LINE_COLOR, LineChip, MessageTicks, dayKey, formatClock, formatDayLabel, formatDuration, formatPhone, initials, useWhatsAppEvents,
} from './whatsappUi';

const MAX_FILE_BYTES = 16 * 1024 * 1024;

export function useWaTenantKey() {
  const { user } = useAuth();
  const authUser = user as (typeof user & { clientTenantId?: string }) | null | undefined;
  const tenantKey = authUser?.clientTenantId || authUser?.tenantId || 'current';
  return useCallback((...parts: unknown[]) => ['tenant-module', tenantKey, 'wa', ...parts], [tenantKey]);
}

function MediaView({ message }: { message: WaMessage }) {
  const query = useQuery({
    queryKey: ['wa-media', message.id],
    queryFn: ({ signal }) => fetchWhatsAppMediaUrl(message.id, signal),
    enabled: message.hasMedia,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
  });
  if (!message.hasMedia) {
    return <div className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-xs"><FileText className="size-4" />{message.mediaName || 'Archivo enviado'}</div>;
  }
  if (query.isLoading) return <div className="flex h-24 w-40 items-center justify-center rounded-lg bg-black/5"><Loader2 className="size-4 animate-spin" /></div>;
  if (query.isError || !query.data) return <div className="rounded-lg bg-black/5 px-3 py-2 text-xs text-muted-foreground">El archivo ya no está disponible en WhatsApp.</div>;
  if (message.type === 'image' || message.type === 'sticker') return <a href={query.data} target="_blank" rel="noreferrer"><img src={query.data} alt={message.mediaName || 'Imagen'} className="max-h-64 max-w-full rounded-lg object-cover" loading="lazy" /></a>;
  if (message.type === 'audio') return <audio controls preload="none" src={query.data} className="h-10 w-56 max-w-full" />;
  if (message.type === 'video') return <video controls preload="none" src={query.data} className="max-h-64 max-w-full rounded-lg" />;
  return <a href={query.data} download={message.mediaName || 'archivo'} className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-xs font-bold underline-offset-2 hover:underline"><FileText className="size-4" />{message.mediaName || 'Descargar archivo'}</a>;
}

function Bubble({ message, onRetry }: { message: WaMessage; onRetry: (message: WaMessage) => void }) {
  const mine = message.direction === 'OUT';
  const failed = message.status === 'FAILED';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] shadow-sm sm:max-w-[70%] ${mine ? 'rounded-br-md bg-emerald-100 text-emerald-950 dark:bg-emerald-900/40 dark:text-emerald-50' : 'rounded-bl-md border border-border/40 bg-card'} ${failed ? 'ring-1 ring-rose-400' : ''}`}>
        {!mine && (message.participantName || message.participantPhone) && <p className="mb-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">{message.participantName || formatPhone(message.participantPhone)}</p>}
        {mine && message.senderName && <p className="mb-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{message.senderName}</p>}
        {mine && message.fromPhone && <p className="mb-0.5 text-[10px] font-bold text-muted-foreground">Enviado desde el teléfono</p>}
        {['image', 'audio', 'video', 'document', 'sticker'].includes(message.type) && <div className="mb-1"><MediaView message={message} /></div>}
        {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
        {!message.body && message.type === 'unknown' && <p className="italic text-muted-foreground">Mensaje no compatible</p>}
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          <span>{formatClock(message.timestamp)}</span>
          {mine && <MessageTicks status={message.status} />}
        </div>
        {failed && (
          <div className="mt-1 flex items-start gap-2 border-t border-rose-300/50 pt-1 text-[11px] text-rose-700 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            <span className="flex-1">{message.error || 'No se pudo enviar.'}</span>
            <button type="button" onClick={() => onRetry(message)} className="inline-flex items-center gap-1 font-bold underline"><RotateCcw className="size-3" />Reintentar</button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatProps {
  conversationId: string;
  overview: WaOverview;
  onBack: () => void;
  onChanged: () => void;
}

export function WhatsAppChat({ conversationId, overview, onBack, onChanged }: ChatProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = useWaTenantKey();
  const events = useWhatsAppEvents();
  const [draft, setDraft] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [older, setOlder] = useState<{ id: string; items: WaMessage[]; before: string | null } | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const stickToBottom = useRef(true);
  const userId = (user as any)?.id as string | undefined;

  const conversation = useQuery({ queryKey: key('conversation', conversationId), queryFn: ({ signal }) => whatsappService.conversation(conversationId, signal), staleTime: 10_000 });
  const messages = useTenantQuery(['wa', 'messages', conversationId], (signal) => whatsappService.messages(conversationId, { limit: 50 }, signal), { staleTime: 5_000 });
  const c: WaConversation | undefined = conversation.data;
  const line = overview.lines.find((l) => l.id === c?.lineId);
  const canReply = Boolean(overview.isAdmin || line?.members.some((m) => m.userId === userId && m.canReply));

  const olderBefore = older && older.id === conversationId ? older.before : undefined;
  const nextBefore = olderBefore === undefined ? messages.data?.nextBefore ?? null : olderBefore;
  const latestData = messages.data;
  const all = useMemo(() => {
    const olderItems = older && older.id === conversationId ? older.items : [];
    const seen = new Set(olderItems.map((m) => m.id));
    return [...olderItems, ...(latestData?.items || []).filter((m) => !seen.has(m.id))];
  }, [older, latestData, conversationId]);

  // Marca como leída al abrir y cuando llegan mensajes nuevos mientras está abierta.
  const markReadRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    markReadRef.current = () => { void whatsappService.markRead(conversationId).then(() => onChanged()).catch(() => undefined); };
  });
  useEffect(() => {
    markReadRef.current();
    return events.subscribe((event) => {
      if (event.conversationId !== conversationId) return;
      void qc.invalidateQueries({ queryKey: key('messages', conversationId) });
      void qc.invalidateQueries({ queryKey: key('conversation', conversationId) });
      if (event.type === 'message') markReadRef.current();
    });
  }, [conversationId, events, qc, key]);

  // Mantiene el final visible, salvo que la persona haya subido a leer mensajes anteriores.
  const lastId = all[all.length - 1]?.id;
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastId, conversationId]);

  const patchMessages = (fn: (items: WaMessage[]) => WaMessage[]) => {
    qc.setQueryData(key('messages', conversationId), (old: any) => (old ? { ...old, items: fn(old.items) } : old));
  };

  const doSend = async (text: string, clientRef: string = crypto.randomUUID()) => {
    const optimistic: WaMessage = {
      id: `tmp-${clientRef}`, direction: 'OUT', status: 'QUEUED', type: 'text', body: text, mediaMime: null, mediaName: null, hasMedia: false,
      error: null, timestamp: new Date().toISOString(), clientRef, senderName: user?.name || null, fromPhone: false,
    };
    stickToBottom.current = true;
    patchMessages((items) => [...items.filter((m) => m.clientRef !== clientRef), optimistic]);
    try {
      const saved = await whatsappService.sendText(conversationId, text, clientRef);
      patchMessages((items) => items.map((m) => (m.clientRef === clientRef ? { ...saved, senderName: saved.senderName || user?.name || null } : m)));
    } catch (error) {
      const message = getApiErrorMessage(error, 'No se pudo enviar el mensaje.');
      patchMessages((items) => items.map((m) => (m.clientRef === clientRef ? { ...m, status: 'FAILED', error: message } : m)));
    } finally {
      void qc.invalidateQueries({ queryKey: key('conversations') });
      void qc.invalidateQueries({ queryKey: key('conversation', conversationId) });
    }
  };

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void doSend(text);
  };

  const sendFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) { toast.error('El archivo supera 16 MB.'); return; }
    const clientRef = crypto.randomUUID();
    const toastId = toast.loading('Enviando archivo…');
    try {
      await whatsappService.sendMedia(conversationId, file, '', clientRef);
      toast.dismiss(toastId);
      void qc.invalidateQueries({ queryKey: key('messages', conversationId) });
      void qc.invalidateQueries({ queryKey: key('conversations') });
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(getApiErrorMessage(error, 'No se pudo enviar el archivo.'));
    }
  };

  const voice = useVoiceRecorder((v) => { void sendFile(v.file); });
  const toggleVoice = async () => {
    if (voice.recording) {
      const recorded = await voice.stop();
      if (recorded) await sendFile(recorded.file);
    } else {
      await voice.start();
    }
  };

  const retry = async (message: WaMessage) => {
    if (message.id.startsWith('tmp-')) {
      if (message.body) void doSend(message.body, message.clientRef || undefined);
      return;
    }
    try {
      await whatsappService.retry(message.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo reintentar.'));
    } finally {
      void qc.invalidateQueries({ queryKey: key('messages', conversationId) });
    }
  };

  const loadOlder = async () => {
    if (!nextBefore || loadingOlder) return;
    setLoadingOlder(true);
    stickToBottom.current = false;
    try {
      const page = await whatsappService.messages(conversationId, { before: nextBefore, limit: 50 });
      setOlder((prev) => ({ id: conversationId, items: [...page.items, ...(prev && prev.id === conversationId ? prev.items : [])], before: page.nextBefore }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los mensajes anteriores.'));
    } finally {
      setLoadingOlder(false);
    }
  };

  const act = async (fn: () => Promise<unknown>, fallback: string) => {
    try {
      await fn();
      void qc.invalidateQueries({ queryKey: key('conversation', conversationId) });
      onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, fallback));
    }
  };

  if (conversation.isLoading || !c) {
    return <div className="flex flex-1 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  const lineDown = line && line.status !== 'CONNECTED';
  const blocked = !canReply ? 'Solo puedes ver esta conversación; no tienes permiso para responder en este número.'
    : lineDown ? 'Este número está desconectado. Pide al administrador que lo vuelva a conectar.'
    : !c.windowOpen ? 'Pasaron más de 24 horas desde el último mensaje del cliente. Responde desde la app WhatsApp Business de tu teléfono (se verá aquí) o espera a que te escriba.'
    : '';
  const mine = c.assigneeId === userId;
  const firstResponse = c.firstIncomingAt && c.firstResponseAt ? (new Date(c.firstResponseAt).getTime() - new Date(c.firstIncomingAt).getTime()) / 1000 : null;
  let lastDay = '';

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 bg-card px-3 py-2.5">
          <Button type="button" variant="ghost" size="icon" className="size-8 md:hidden" onClick={onBack} aria-label="Volver"><ArrowLeft className="size-4" /></Button>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ backgroundColor: c.line.color || FALLBACK_LINE_COLOR }}>{c.contact.isGroup ? <Users className="size-4" /> : initials(c.contact.name)}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{c.contact.name}</p>
            <p className="flex items-center gap-2 truncate text-[11px] text-muted-foreground">{c.contact.isGroup ? 'Grupo' : formatPhone(c.contact.phone)} <LineChip name={c.line.name} color={c.line.color} /></p>
          </div>
          {overview.isAdmin ? (
            <Select value={c.assigneeId || 'none'} onValueChange={(value) => void act(() => whatsappService.assign(c.id, value === 'none' ? null : value), 'No se pudo asignar.')}>
              <SelectTrigger className="h-8 w-40 rounded-lg text-xs" aria-label="Asignado a"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {(line?.members || []).map((m) => <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : !c.assigneeId ? (
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => userId && void act(() => whatsappService.assign(c.id, userId), 'No se pudo tomar la conversación.')}>Tomar</Button>
          ) : mine ? (
            <Button type="button" size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => void act(() => whatsappService.assign(c.id, null), 'No se pudo soltar.')}>Soltar</Button>
          ) : <span className="text-[11px] font-bold text-muted-foreground">Atiende {c.assigneeName}</span>}
          {c.status === 'RESOLVED' ? (
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => void act(() => whatsappService.setStatus(c.id, 'OPEN'), 'No se pudo reabrir.')}>Reabrir</Button>
          ) : (
            <Button type="button" size="sm" className="h-8 gap-1 rounded-lg text-xs" onClick={() => void act(() => whatsappService.setStatus(c.id, 'RESOLVED'), 'No se pudo resolver.')}><CheckCircle2 className="size-3.5" />Resolver</Button>
          )}
          <Button type="button" variant="ghost" size="icon" className="hidden size-8 lg:inline-flex" onClick={() => setShowInfo((v) => !v)} aria-label="Datos del contacto"><Info className="size-4" /></Button>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,hsl(var(--muted-foreground)/0.08)_1px,transparent_0)] [background-size:18px_18px] px-3 py-4"
          onScroll={(e) => { const el = e.currentTarget; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }}
        >
          {nextBefore && (
            <div className="flex justify-center">
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1 rounded-full text-[11px]" onClick={() => void loadOlder()} disabled={loadingOlder}>
                {loadingOlder ? <Loader2 className="size-3 animate-spin" /> : <ChevronDown className="size-3 rotate-180" />}Ver mensajes anteriores
              </Button>
            </div>
          )}
          {messages.isLoading && <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-primary" /></div>}
          {all.map((m) => {
            const dk = dayKey(m.timestamp);
            const header = dk !== lastDay ? formatDayLabel(m.timestamp) : null;
            lastDay = dk;
            return (
              <div key={m.id} className="space-y-2">
                {header && <div className="flex justify-center"><span className="rounded-full bg-muted px-3 py-0.5 text-[10px] font-bold capitalize text-muted-foreground">{header}</span></div>}
                <Bubble message={m} onRetry={(msg) => void retry(msg)} />
              </div>
            );
          })}
          {!messages.isLoading && all.length === 0 && <p className="py-10 text-center text-xs text-muted-foreground">Aún no hay mensajes.</p>}
        </div>

        {blocked ? (
          <div className="flex items-start gap-2 border-t border-amber-300/40 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{blocked}</div>
        ) : (
          <div className="border-t border-border/40 bg-card p-2.5">
            {voice.error && <p className="px-2 pb-1 text-[11px] text-rose-600">{voice.error}</p>}
            {voice.recording ? (
              <div className="flex items-center gap-3 rounded-xl border border-rose-300/50 bg-rose-50 px-3 py-2 dark:bg-rose-950/30">
                <span className="size-2.5 animate-pulse rounded-full bg-rose-500" />
                <span className="flex-1 text-xs font-bold tabular-nums">Grabando… {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}</span>
                <Button type="button" size="sm" className="h-8 gap-1 rounded-lg text-xs" onClick={() => void toggleVoice()}><Square className="size-3" />Enviar</Button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void sendFile(f); }} />
                <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0 rounded-xl" onClick={() => fileRef.current?.click()} aria-label="Adjuntar archivo"><Paperclip className="size-4" /></Button>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
                  rows={1}
                  placeholder="Escribe un mensaje"
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                {draft.trim() ? (
                  <Button type="button" size="icon" className="size-10 shrink-0 rounded-xl" onClick={submit} aria-label="Enviar"><Send className="size-4" /></Button>
                ) : (
                  <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0 rounded-xl" onClick={() => void toggleVoice()} disabled={!voice.supported} aria-label="Grabar nota de voz"><Mic className="size-4" /></Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showInfo && (
        <aside className="hidden w-72 shrink-0 space-y-4 overflow-y-auto border-l border-border/40 bg-muted/10 p-4 lg:block">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Contacto</p>
            <button type="button" onClick={() => setShowInfo(false)} aria-label="Cerrar"><X className="size-4 text-muted-foreground" /></button>
          </div>
          <div className="text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full text-lg font-black text-white" style={{ backgroundColor: c.line.color || FALLBACK_LINE_COLOR }}>{c.contact.isGroup ? <Users className="size-7" /> : initials(c.contact.name)}</div>
            <p className="mt-2 text-sm font-black">{c.contact.name}</p>
            <p className="text-xs text-muted-foreground">{c.contact.isGroup ? 'Grupo de WhatsApp' : formatPhone(c.contact.phone)}</p>
          </div>
          <dl className="space-y-3 text-xs">
            <div><dt className="font-bold text-muted-foreground">Número que atiende</dt><dd className="mt-1"><LineChip name={c.line.name} color={c.line.color} /></dd></div>
            <div><dt className="font-bold text-muted-foreground">Responsable</dt><dd className="mt-1">{c.assigneeName || 'Sin asignar'}</dd></div>
            <div><dt className="font-bold text-muted-foreground">Primer mensaje</dt><dd className="mt-1">{c.firstIncomingAt ? new Date(c.firstIncomingAt).toLocaleString('es-NI') : '—'}</dd></div>
            <div><dt className="font-bold text-muted-foreground">Tiempo de primera respuesta</dt><dd className="mt-1">{formatDuration(firstResponse)}</dd></div>
            {line?.capabilities?.serviceWindow && <div><dt className="font-bold text-muted-foreground">Ventana de respuesta</dt><dd className="mt-1">{c.windowOpen && c.windowExpiresAt ? `Abierta hasta ${new Date(c.windowExpiresAt).toLocaleString('es-NI')}` : 'Cerrada'}</dd></div>}
          </dl>
        </aside>
      )}
    </div>
  );
}
