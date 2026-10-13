import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, Building2, ChevronRight, CircleHelp, Loader2, LogOut, MailPlus, MessageSquare, Search, Send, ShieldCheck, Users } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { supportConversationsService, subscribeToSupportEvents, type SupportConversation, type SupportConversationAttachment, type SupportScope, type SupportTargets, type SupportTargetOptionGroup } from '../../services/support-conversations.service';
import type { ChatMessage } from '../../types';
import { updateMessageThread, upsertMessageThread } from '../notificaciones/message-thread-cache';
import { SupportAttachmentComposer } from '../notificaciones/SupportAttachmentComposer';
import { SupportMessageAttachments } from '../notificaciones/SupportMessageAttachments';
import { toast } from '@/app/services/toast';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import {
  isSupportTargetChecked,
  isSupportTargetInherited,
  isSupportTargetPartiallySelected,
  toggleSupportTargetSelection,
} from './support-target-selection';

const formatThreadDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return isToday(date) ? format(date, 'HH:mm', { locale: es }) : format(date, 'd MMM', { locale: es });
};
const formatMessageDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : format(date, "d MMM, HH:mm", { locale: es });
};
const createRequestKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
type AttachmentComposerState = { attachments: SupportConversationAttachment[]; uploading: boolean; hasError: boolean };
const emptyAttachmentState: AttachmentComposerState = { attachments: [], uploading: false, hasError: false };

export function PlatformSupportWorkspace() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();
  const identity = user?.id || 'support-agent';
  const tenantKey = user?.clientTenantId || user?.tenantId || 'current';
  const queryKey = useMemo(() => ['support-conversations', identity] as const, [identity]);
  const conversationCacheKey = useMemo(() => ['tenant-module', tenantKey, ...queryKey] as const, [tenantKey, queryKey]);
  const conversationsQuery = useTenantQuery<SupportConversation[]>(queryKey, (signal) => supportConversationsService.getConversations(signal), {
    enabled: Boolean(user?.isPlatformSupportAgent),
    refetchOnMount: 'always',
  });
  const targetsQuery = useTenantQuery<SupportTargets>(['support-conversations', identity, 'targets'], (signal) => supportConversationsService.getTargets(signal), {
    enabled: Boolean(user?.isPlatformSupportAgent),
  });
  const conversations = asList(conversationsQuery.data) as SupportConversation[];
  const targets = targetsQuery.data || { groups: [], businessUnits: [], branches: [] };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTitle, setComposeTitle] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [composeAttachmentState, setComposeAttachmentState] = useState<AttachmentComposerState>(emptyAttachmentState);
  const [composeAttachmentResetKey, setComposeAttachmentResetKey] = useState(0);
  const [selectedTargets, setSelectedTargets] = useState<SupportScope[]>([]);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [reply, setReply] = useState('');
  const [replyAttachmentState, setReplyAttachmentState] = useState<AttachmentComposerState>(emptyAttachmentState);
  const [replyAttachmentResetKey, setReplyAttachmentResetKey] = useState(0);
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState('');
  const markingReadIds = useRef(new Set<string>());
  const broadcastAttempt = useRef<{ signature: string; key: string } | null>(null);
  const messageBodyRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastSelectedIdRef = useRef<string | null>(null);
  const refetchConversations = conversationsQuery.refetch;
  const onComposeAttachmentsChange = useCallback((state: AttachmentComposerState) => setComposeAttachmentState(state), [setComposeAttachmentState]);
  const onReplyAttachmentsChange = useCallback((state: AttachmentComposerState) => setReplyAttachmentState(state), [setReplyAttachmentState]);

  useEffect(() => subscribeToSupportEvents((event) => {
    if (event.type === 'support-conversations-resync') {
      void refetchConversations();
      return;
    }
    void supportConversationsService.getConversation(event.conversationId)
      .then((conversation) => queryClient.setQueryData<SupportConversation[]>(conversationCacheKey, (current) =>
        upsertMessageThread(current, conversation),
      ))
      .catch(() => { void refetchConversations(); });
  }), [queryClient, conversationCacheKey, refetchConversations]);

  const selected = conversations.find((conversation) => conversation.id === selectedId) || null;
  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return conversations.filter((conversation) => !normalized || [conversation.title, conversation.preview, conversation.participant.name].some((value) => String(value || '').toLocaleLowerCase().includes(normalized)));
  }, [conversations, search]);
  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);

  useEffect(() => {
    if (lastSelectedIdRef.current !== selectedId) {
      shouldAutoScrollRef.current = true;
      lastSelectedIdRef.current = selectedId;
    }
    if (!shouldAutoScrollRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'end' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, selected?.messages.length, shouldReduceMotion]);

  useEffect(() => {
    if (!selected || selected.unreadCount === 0 || markingReadIds.current.has(selected.id)) return;
    const conversationId = selected.id;
    markingReadIds.current.add(conversationId);
    void supportConversationsService.markRead(selected.id)
      .then(() => queryClient.setQueryData<SupportConversation[]>(conversationCacheKey, (current) => updateMessageThread(
        current,
        conversationId,
        (conversation) => ({
          ...conversation,
          unreadCount: 0,
          messages: conversation.messages.map((message) => ({ ...message, isRead: true })),
        }),
      )))
      .catch((error: any) => toast.error(error?.response?.data?.message || 'No pudimos marcar la conversación como leída'))
      .finally(() => markingReadIds.current.delete(conversationId));
  }, [selected, queryClient, conversationCacheKey]);

  const toggleTarget = (scope: SupportScope) => {
    setSelectedTargets((current) => toggleSupportTargetSelection(current, scope, targets.groups));
  };

  const submitBroadcast = async () => {
    const title = composeTitle.trim();
    const content = composeContent.trim();
    const attachments = composeAttachmentState.attachments;
    if (!title || (!content && !attachments.length) || !selectedTargets.length || sendingBroadcast || composeAttachmentState.uploading || composeAttachmentState.hasError) return;
    const payload = { title, content, targets: selectedTargets, attachmentUploadIds: attachments.map((attachment) => attachment.id) };
    const signature = JSON.stringify(payload);
    if (!broadcastAttempt.current || broadcastAttempt.current.signature !== signature) {
      broadcastAttempt.current = { signature, key: createRequestKey() };
    }
    setSendingBroadcast(true);
    try {
      const result = await supportConversationsService.broadcast(payload, broadcastAttempt.current.key);
      const newConversations: SupportConversation[] = result.conversations.map((item) => {
        const id = `support:${item.id}`;
        const sender = { id: user?.id || 'support-agent', name: user?.name || 'Soporte técnico', email: user?.email };
        const branch = { id: item.branchId, name: item.branchName };
        const firstMessage: ChatMessage = {
          id: `${id}:initial`,
          content,
          attachments: item.attachments || [],
          createdAt: result.createdAt,
          isRead: true,
          mine: true,
          sender,
          recipient: branch,
          link: null,
        };
        return {
          id,
          supportConversationId: item.id,
          title: result.title,
          kind: 'SUPPORT',
          participant: branch,
          preview: content || (item.attachments?.length === 1 ? `📎 ${item.attachments[0].fileName}` : `📎 ${item.attachments?.length || 0} archivos adjuntos`),
          lastMessageAt: result.createdAt,
          unreadCount: 0,
          canReply: true,
          messages: [firstMessage],
        };
      });
      queryClient.setQueryData<SupportConversation[]>(conversationCacheKey, (current) =>
        newConversations.reduce((threads, conversation) => upsertMessageThread(threads, conversation), current || []),
      );
      const firstConversation = newConversations[0];
      if (firstConversation) {
        setSelectedId(firstConversation.id);
        setMobileThreadOpen(true);
      }
      toast.success(`Mensaje enviado a ${result.branchCount} sucursal${result.branchCount === 1 ? '' : 'es'}`);
      broadcastAttempt.current = null;
      setComposeOpen(false);
      setComposeTitle('');
      setComposeContent('');
      setSelectedTargets([]);
      setComposeAttachmentState(emptyAttachmentState);
      setComposeAttachmentResetKey((current) => current + 1);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No pudimos enviar el mensaje. Puedes reintentar con el mismo contenido.');
    } finally { setSendingBroadcast(false); }
  };

  const submitReply = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const attachments = replyAttachmentState.attachments;
    if (!selected || (!reply.trim() && !attachments.length) || replying || replyAttachmentState.uploading || replyAttachmentState.hasError) return;
    setReplying(true);
    setReplyError('');
    try {
      const updated = await supportConversationsService.reply(selected.id, reply.trim(), attachments.map((attachment) => attachment.id));
      queryClient.setQueryData<SupportConversation[]>(conversationCacheKey, (current) => upsertMessageThread(current, updated));
      setReply('');
      setReplyAttachmentState(emptyAttachmentState);
      setReplyAttachmentResetKey((current) => current + 1);
    } catch (error: any) {
      setReplyError(error?.response?.data?.message || 'No pudimos enviar la respuesta');
    } finally { setReplying(false); }
  };

  const openConversation = (conversation: SupportConversation) => {
    setSelectedId(conversation.id);
    setMobileThreadOpen(true);
  };

  const openComposer = () => {
    setComposeOpen(true);
    setSelectedTargets([]);
    setComposeAttachmentState(emptyAttachmentState);
    setComposeAttachmentResetKey((current) => current + 1);
  };

  const closeComposer = (open: boolean) => {
    if (sendingBroadcast) return;
    setComposeOpen(open);
    if (!open) {
      setComposeTitle('');
      setComposeContent('');
      setSelectedTargets([]);
      setComposeAttachmentState(emptyAttachmentState);
      setComposeAttachmentResetKey((current) => current + 1);
      broadcastAttempt.current = null;
    }
  };

  return (
    <main className="min-h-screen min-w-0 overflow-x-hidden bg-background text-foreground">
      <header className="flex flex-col gap-4 border-b border-border/70 bg-card/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div>
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">NovaHub · Soporte externo</p><h1 className="truncate text-xl font-black sm:text-2xl">Bandeja de soporte</h1><p className="text-xs text-muted-foreground">{conversations.length} conversaciones · {unreadTotal} sin leer</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openComposer} className="h-10 gap-2 rounded-xl"><MailPlus className="size-4" /> Nuevo envío</Button>
          <Button variant="ghost" onClick={logout} className="h-10 gap-2 rounded-xl text-muted-foreground"><LogOut className="size-4" /> Salir</Button>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-[1700px] min-w-0 grid-cols-1 gap-4 p-3 sm:p-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:p-8">
        <Card className={cn('min-w-0 overflow-hidden rounded-2xl border-border/70 shadow-sm', mobileThreadOpen && 'hidden lg:block')}>
          <div className="border-b border-border/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-black">Conversaciones</h2><p className="text-xs text-muted-foreground">Cada hilo corresponde a una sucursal.</p></div><Badge variant="secondary">{conversations.length}</Badge></div>
            <label className="relative block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar conversaciones" className="h-10 rounded-xl pl-9" /></label>
          </div>
          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-2">
            {conversationsQuery.isLoading ? <div className="flex justify-center p-12"><Loader2 className="size-5 animate-spin text-primary" /></div>
              : conversationsQuery.isError ? <div className="p-6 text-center text-sm text-destructive">No pudimos cargar la bandeja. Revisa tu conexión y vuelve a intentar.</div>
                : filtered.length === 0 ? <div className="px-5 py-14 text-center"><MessageSquare className="mx-auto size-8 text-muted-foreground/60" /><p className="mt-3 text-sm font-bold">{conversations.length ? 'Sin coincidencias' : 'Aún no hay conversaciones'}</p><p className="mt-1 text-xs text-muted-foreground">{conversations.length ? 'Prueba con otro texto.' : 'Envía un mensaje para iniciar un hilo por sucursal.'}</p></div>
                  : <AnimatePresence initial={false}>{filtered.map((conversation) => (
                    <motion.button key={conversation.id} type="button" onClick={() => openConversation(conversation)} layout={!shouldReduceMotion} initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }} transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }} className={cn('mb-1 flex w-full min-w-0 items-start gap-3 rounded-xl p-3 text-left transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selectedId === conversation.id && 'bg-primary/10')}>
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-4" /></div>
                      <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold">{conversation.participant.name}</span><span className="shrink-0 text-[10px] text-muted-foreground">{formatThreadDate(conversation.lastMessageAt)}</span></span><span className="mt-0.5 block truncate text-xs font-semibold text-foreground/80">{conversation.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{conversation.preview}</span></span>
                      {conversation.unreadCount > 0 && <Badge className="shrink-0 rounded-full px-2">{conversation.unreadCount}</Badge>}
                    </motion.button>
                  ))}</AnimatePresence>}
          </div>
        </Card>

        <Card className={cn('flex min-h-[68vh] min-w-0 flex-col overflow-hidden rounded-2xl border-border/70 shadow-sm', !mobileThreadOpen && 'hidden lg:flex')}>
          {selected ? <>
            <div className="flex min-w-0 items-center gap-3 border-b border-border/60 px-4 py-3 sm:px-6">
              <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={() => setMobileThreadOpen(false)} aria-label="Volver a conversaciones"><ArrowLeft className="size-4" /></Button>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-4" /></div>
              <div className="min-w-0 flex-1"><h2 className="truncate font-black">{selected.participant.name}</h2><p className="truncate text-xs text-muted-foreground">{selected.title}</p></div>
              <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">Sucursal</Badge>
            </div>
            <div
              ref={messageBodyRef}
              onScroll={(event) => {
                const element = event.currentTarget;
                shouldAutoScrollRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 140;
              }}
              className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"
              aria-live="polite"
            >
              <AnimatePresence initial={false}>
                {selected.messages.map((message: ChatMessage) => <motion.div key={message.id} className={cn('flex', message.mine ? 'justify-end' : 'justify-start')} layout={!shouldReduceMotion} initial={shouldReduceMotion ? false : { opacity: 0, y: 9, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={shouldReduceMotion ? undefined : { opacity: 0, y: -3 }} transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}><div className={cn('max-w-[90%] rounded-2xl px-4 py-3 sm:max-w-[72%]', message.mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted/70 text-foreground')}>
                  {!message.mine && <p className="mb-1 text-[11px] font-bold text-muted-foreground">{message.sender.name}</p>}{message.content && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>}<SupportMessageAttachments conversationId={selected.id} attachments={message.attachments} mine={message.mine} /><p className={cn('mt-1.5 text-right text-[10px]', message.mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{formatMessageDate(message.createdAt)}</p>
                </div></motion.div>)}
              </AnimatePresence>
              <div ref={messageEndRef} aria-hidden="true" />
            </div>
            <form onSubmit={submitReply} className="border-t border-border/60 p-3 sm:p-4"><div className="mx-auto max-w-3xl"><label htmlFor="support-agent-reply" className="sr-only">Responder a la sucursal</label><div className="flex items-end gap-2 rounded-xl border border-border bg-muted/20 p-2 focus-within:ring-2 focus-within:ring-ring/40"><Textarea id="support-agent-reply" value={reply} onChange={(event) => setReply(event.target.value.slice(0, 4000))} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void submitReply(); }} placeholder="Escribe una respuesta…" className="max-h-36 min-h-10 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0" disabled={replying} /><Button type="submit" size="icon" className="size-10 shrink-0 rounded-lg" disabled={replying || replyAttachmentState.uploading || replyAttachmentState.hasError || (!reply.trim() && !replyAttachmentState.attachments.length)} aria-label="Enviar respuesta">{replying ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</Button></div><div className="mt-2"><SupportAttachmentComposer key={`reply-${selected.id}-${replyAttachmentResetKey}`} conversationId={selected.id} disabled={replying} onChange={onReplyAttachmentsChange} /></div><div className="mt-1.5 flex justify-between gap-3 px-1 text-[11px]"><span className="text-destructive" role={replyError ? 'alert' : undefined}>{replyError}</span><span className="ml-auto text-muted-foreground">Ctrl + Enter para enviar</span></div></div></form>
          </> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><CircleHelp className="size-6" /></div><h2 className="mt-4 font-black">Selecciona una conversación</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">Los mensajes enviados a varias sucursales se separan en hilos privados.</p></div>}
        </Card>
      </div>

      <Dialog open={composeOpen} onOpenChange={closeComposer}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-black"><MailPlus className="size-5 text-primary" /> Nuevo mensaje de soporte</DialogTitle><DialogDescription>Selecciona un grupo completo, rubros o sucursales concretas. Marcar un nivel superior incluye sus descendientes; desmárcalo para limitar el envío. Se abrirá un hilo privado por sucursal con usuarios autorizados.</DialogDescription></DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-xs font-bold">Asunto <span className="text-muted-foreground">({composeTitle.length}/140)</span><Input value={composeTitle} maxLength={140} onChange={(event) => setComposeTitle(event.target.value)} className="mt-1.5 rounded-xl" placeholder="Actualización de soporte" /></label><div className="flex items-end text-xs text-muted-foreground"><Users className="mr-2 size-4 shrink-0" />El destino se resolverá a sucursales activas.</div></div>
            <label className="block text-xs font-bold">Mensaje <span className="text-muted-foreground">({composeContent.length}/4000)</span><Textarea value={composeContent} maxLength={4000} onChange={(event) => setComposeContent(event.target.value)} className="mt-1.5 min-h-28 rounded-xl" placeholder="Escribe el mensaje para las sucursales…" /></label>
            <SupportAttachmentComposer key={`broadcast-${composeAttachmentResetKey}`} disabled={sendingBroadcast} onChange={onComposeAttachmentsChange} />
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 sm:p-4"><div className="mb-3"><h3 className="text-sm font-black">Destinos seleccionados</h3><p className="text-xs text-muted-foreground">{targetsLoading(targetsQuery.isLoading, targetsQuery.isFetching) ? 'Cargando alcances…' : `${selectedTargets.length} destino${selectedTargets.length === 1 ? '' : 's'} seleccionado${selectedTargets.length === 1 ? '' : 's'}`}</p></div>
              {targetsQuery.isError ? <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">No pudimos cargar tus alcances.</p> : targetsLoading(targetsQuery.isLoading, targetsQuery.isFetching) ? <div className="flex justify-center p-6"><Loader2 className="size-5 animate-spin" /></div> : <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {targets.groups.map((group) => <SupportTargetGroup key={group.id} group={group} selected={selectedTargets} onChange={toggleTarget} />)}
                {!targets.groups.length && <p className="py-5 text-center text-sm text-muted-foreground">SuperAdmin todavía no asigna destinos a tu cuenta.</p>}
              </div>}
              <p className="mt-3 rounded-xl bg-background/60 px-3 py-2 text-xs text-muted-foreground">Se creará un hilo por sucursal. Las sucursales sin usuarios autorizados se omitirán automáticamente.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="outline" onClick={() => closeComposer(false)} disabled={sendingBroadcast}>Cancelar</Button><Button type="button" onClick={() => void submitBroadcast()} disabled={sendingBroadcast || composeAttachmentState.uploading || composeAttachmentState.hasError || !selectedTargets.length || !composeTitle.trim() || (!composeContent.trim() && !composeAttachmentState.attachments.length)}>{(sendingBroadcast || composeAttachmentState.uploading) && <Loader2 className="mr-2 size-4 animate-spin" />}Enviar a sucursales <ChevronRight className="ml-1 size-4" /></Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SupportTargetGroup({ group, selected, onChange }: { group: SupportTargetOptionGroup; selected: SupportScope[]; onChange: (scope: SupportScope) => void }) {
  const groupScope = { type: 'GROUP', id: group.id } as const;
  return <div className="space-y-1 rounded-xl border border-border/50 p-2">
    <TargetCheckbox scope={groupScope} checked={isSupportTargetChecked(selected, groupScope, [group])} indeterminate={isSupportTargetPartiallySelected(selected, groupScope, [group])} inherited={isSupportTargetInherited(selected, groupScope, [group])} selectable={group.selectable} label={group.name} description={group.selectable ? 'Grupo empresarial · todas sus sucursales activas' : 'Grupo empresarial · contexto del alcance asignado'} onChange={onChange} />
    {(group.businessUnits.length > 0 || group.branches.length > 0) && <div className="ml-3 space-y-1 border-l border-border/70 pl-2 sm:ml-5 sm:pl-3">
      {group.businessUnits.map((unit) => {
        const unitScope = { type: 'BUSINESS_UNIT', id: unit.id } as const;
        const unitTree = [{ ...group, businessUnits: [unit], branches: [] }];
        return <div key={unit.id}>
          <TargetCheckbox scope={unitScope} checked={isSupportTargetChecked(selected, unitScope, unitTree)} indeterminate={isSupportTargetPartiallySelected(selected, unitScope, unitTree)} inherited={isSupportTargetInherited(selected, unitScope, unitTree)} selectable={unit.selectable} label={unit.name} description={unit.selectable ? 'Rubro · sucursales activas actuales' : 'Rubro · contexto del alcance asignado'} onChange={onChange} />
          {unit.branches.length > 0 && <div className="ml-3 space-y-1 border-l border-border/60 pl-2 sm:ml-5 sm:pl-3">{unit.branches.map((branch) => {
            const scope = { type: 'BRANCH', id: branch.id } as const;
            const branchTree = [{ ...group, businessUnits: [{ ...unit, branches: [branch] }], branches: [] }];
            return <TargetCheckbox key={branch.id} scope={scope} checked={isSupportTargetChecked(selected, scope, branchTree)} indeterminate={false} inherited={isSupportTargetInherited(selected, scope, branchTree)} selectable={branch.selectable} label={branch.name} description={branch.selectable ? 'Sucursal · envío solo a esta sucursal' : 'Sucursal fuera del alcance seleccionable'} onChange={onChange} />;
          })}</div>}
        </div>;
      })}
      {group.branches.map((branch) => {
        const scope = { type: 'BRANCH', id: branch.id } as const;
        const branchTree = [{ ...group, businessUnits: [], branches: [branch] }];
        return <TargetCheckbox key={branch.id} scope={scope} checked={isSupportTargetChecked(selected, scope, branchTree)} indeterminate={false} inherited={isSupportTargetInherited(selected, scope, branchTree)} selectable={branch.selectable} label={branch.name} description="Sucursal · envío solo a esta sucursal" onChange={onChange} />;
      })}
    </div>}
  </div>;
}

function TargetCheckbox({ scope, checked, indeterminate, inherited, selectable, onChange, label, description }: { scope: SupportScope; checked: boolean; indeterminate: boolean; inherited: boolean; selectable: boolean; onChange: (scope: SupportScope) => void; label: string; description: string }) {
  const id = `support-target-${scope.type}-${scope.id}`;
  const disabled = !selectable || inherited;
  return <label htmlFor={id} className={cn('flex items-start gap-3 rounded-xl border border-transparent px-3 py-2.5', disabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:border-border/70 hover:bg-background/70')}>
    <input id={id} type="checkbox" checked={checked} disabled={disabled} aria-checked={indeterminate ? 'mixed' : checked} onChange={() => onChange(scope)} ref={(element) => { if (element) element.indeterminate = indeterminate; }} className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:[color-scheme:dark]" />
    <span className="min-w-0"><span className="block break-words text-sm font-bold">{label}</span><span className="block break-words text-xs text-muted-foreground">{description}{inherited ? ' · incluido por el destino superior' : ''}</span></span>
  </label>;
}

function targetsLoading(loading: boolean, fetching: boolean) { return loading || fetching; }
