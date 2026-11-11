import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  CircleHelp,
  LifeBuoy,
  Loader2,
  MailPlus,
  MapPin,
  MessageCircle,
  Search,
  Send,
  Upload,
  Users,
} from 'lucide-react';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ChatMessage, Message, MessageAttachment, MessageParticipant } from '../../types';
import { createIdempotencyKey } from '../../services/api';
import { messagesService } from '../../services/notificaciones.service';
import { supportConversationsService, type SupportConversation } from '../../services/support-conversations.service';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { toast } from '@/app/services/toast';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { updateMessageThread, upsertMessageThread } from './message-thread-cache';
import {
  allowMessageAttachmentDrop,
  dropMessageAttachmentFiles,
  hasMessageAttachmentFiles,
  pasteMessageAttachmentFiles,
} from './message-attachment-input';
import {
  MessageAttachmentComposer,
  type MessageAttachmentComposerHandle,
} from './MessageAttachmentComposer';
import { MessageAttachments } from './MessageAttachments';
import { MessageText } from './MessageText';

interface MensajesViewProps {
  data: Message[];
  loading: boolean;
  onHelp: () => void;
}

type MessageFilter = 'all' | 'unread' | 'direct' | 'support';
type ComposeMode = 'DIRECT' | 'SUPPORT';
type AttachmentComposerState = { attachments: MessageAttachment[]; uploading: boolean; hasError: boolean };
const EMPTY_ATTACHMENT_STATE: AttachmentComposerState = { attachments: [], uploading: false, hasError: false };

const initials = (name?: string) =>
  String(name || 'Sistema')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const threadTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return isToday(date)
    ? format(date, 'HH:mm', { locale: es })
    : format(date, 'd MMM', { locale: es });
};

const messageTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, "d MMM, HH:mm", { locale: es });
};

const participantName = (value?: Partial<MessageParticipant> | null, fallback = 'Sistema') =>
  String(value?.name || fallback);

const ParticipantAvatar = ({ participant, system = false }: { participant?: MessageParticipant | null; system?: boolean }) => (
  <Avatar className="size-10 rounded-xl">
    {participant?.avatar && <AvatarImage src={participant.avatar} alt="" />}
    <AvatarFallback className={cn('rounded-xl text-xs font-bold', system ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary')}>
      {system ? <Bot className="size-4" /> : initials(participantName(participant, 'Usuario'))}
    </AvatarFallback>
  </Avatar>
);

export const MensajesView: React.FC<MensajesViewProps> = ({ data, loading, onHelp }) => {
  const { canPerform, user } = useAuth();
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();
  const { refresh: refreshInbox } = useNotifications();
  const authUser = user as (typeof user & { clientTenantId?: string; tenantId?: string }) | null;
  const tenantKey = authUser?.clientTenantId || authUser?.tenantId || 'current';
  const userKey = user?.id || 'current';
  const directMessagesCacheKey = useMemo(() => ['tenant-module', tenantKey, 'notifications', userKey, 'messages'] as const, [tenantKey, userKey]);
  const supportConversationsCacheKey = useMemo(() => ['tenant-module', tenantKey, 'support-conversations', userKey, 'branch-inbox'] as const, [tenantKey, userKey]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<MessageFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>('DIRECT');
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [composeAttachmentState, setComposeAttachmentState] = useState<AttachmentComposerState>(EMPTY_ATTACHMENT_STATE);
  const [composeAttachmentResetKey, setComposeAttachmentResetKey] = useState(0);
  const [composeError, setComposeError] = useState('');
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState('');
  const [replyAttachmentState, setReplyAttachmentState] = useState<AttachmentComposerState>(EMPTY_ATTACHMENT_STATE);
  const [replyAttachmentResetKey, setReplyAttachmentResetKey] = useState(0);
  const [replyError, setReplyError] = useState('');
  const [replying, setReplying] = useState(false);
  const [historyDropActive, setHistoryDropActive] = useState(false);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const onReplyAttachmentsChange = useCallback((state: AttachmentComposerState) => setReplyAttachmentState(state), []);
  const onComposeAttachmentsChange = useCallback((state: AttachmentComposerState) => setComposeAttachmentState(state), []);
  const messageBodyRef = useRef<HTMLDivElement>(null);
  const historyDropDepthRef = useRef(0);
  const replyAttachmentComposerRef = useRef<MessageAttachmentComposerHandle>(null);
  const composeAttachmentComposerRef = useRef<MessageAttachmentComposerHandle>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastSelectedIdRef = useRef<string | null>(null);
  const supportCreateAttemptRef = useRef<{ signature: string; key: string } | null>(null);
  const supportConversationsQuery = useTenantQuery<SupportConversation[]>(
    ['support-conversations', user?.id || 'current', 'branch-inbox'],
    signal => supportConversationsService.getConversations(signal),
    {
      enabled: Boolean(user?.id && user?.clientTenantId && !user.isPlatformSupportAgent && canPerform('NOTIFICATIONS_MESSAGES', 'view')),
      refetchOnMount: 'always',
    },
  );
  const supportThreads = asList(supportConversationsQuery.data) as SupportConversation[];
  const threads = useMemo(() => [...data, ...supportThreads].sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()), [data, supportThreads]);
  const recipientsQuery = useTenantQuery<MessageParticipant[]>(
    ['notifications', 'recipients'],
    signal => messagesService.getRecipients(signal),
    { enabled: composeOpen && composeMode === 'DIRECT' && canPerform('NOTIFICATIONS_MESSAGES', 'create') },
  );
  const recipients = asList(recipientsQuery.data) as MessageParticipant[];
  const recipientsLoading = recipientsQuery.isLoading || recipientsQuery.isFetching;
  const composeFeedbackError = composeError || (composeOpen && composeMode === 'DIRECT' && recipientsQuery.isError ? 'No pudimos cargar las personas de tu empresa.' : '');
  const canCreateSupportConversation = Boolean(!user?.isPlatformSupportAgent && canPerform('NOTIFICATIONS_MESSAGES', 'create'));

  useEffect(() => {
    if (selectedId && !threads.some((thread) => thread.id === selectedId)) {
      Promise.resolve().then(() => {
        setSelectedId(null);
        setMobileThreadOpen(false);
      });
    }
  }, [threads, selectedId]);

  useEffect(() => {
    if (!selectedId && threads.length > 0 && window.matchMedia('(min-width: 1024px)').matches) {
      Promise.resolve().then(() => setSelectedId(threads[0].id));
    }
  }, [threads, selectedId]);

  useEffect(() => {
    const visibleThread = threads.find((thread) => thread.id === selectedId);
    if (!visibleThread || visibleThread.unreadCount === 0 || markingReadId === visibleThread.id) return;

    let active = true;
    Promise.resolve().then(() => setMarkingReadId(visibleThread.id));
    const markRead = visibleThread.kind === 'SUPPORT'
      ? supportConversationsService.markRead(visibleThread.id)
      : messagesService.markRead(visibleThread.id);
    void markRead
      .then(async () => {
        const cacheKey = visibleThread.kind === 'SUPPORT' ? supportConversationsCacheKey : directMessagesCacheKey;
        queryClient.setQueryData<Message[]>(cacheKey, (current) => updateMessageThread(current, visibleThread.id, (thread) => ({
          ...thread,
          unreadCount: 0,
          messages: thread.messages.map((message) => ({ ...message, isRead: true })),
        })));
        await refreshInbox();
      })
      .catch((e: any) => {
        if (active) toast.error(e?.response?.data?.message || 'No pudimos marcar la conversación como leída');
      })
      .finally(() => {
        if (active) setMarkingReadId(null);
      });

    return () => {
      active = false;
    };
  }, [threads, selectedId, markingReadId, queryClient, directMessagesCacheKey, supportConversationsCacheKey, refreshInbox]);

  const selected = threads.find((thread) => thread.id === selectedId) || null;
  const selectedOrigin = selected?.kind === 'SUPPORT' && user?.isPlatformSupportAgent
    ? participantName(selected.participant, 'Sucursal')
    : user?.tenantName || user?.sessionBranding?.name || 'Sucursal actual';
  const searchFiltered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return threads.filter((thread) => {
      const matchesSearch = !query || [thread.title, thread.preview, thread.participant?.name, thread.participant?.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return matchesSearch;
    });
  }, [threads, searchTerm]);
  const summaryThreads = loading ? [] : searchFiltered;
  const unreadTotal = summaryThreads.reduce((total, thread) => total + thread.unreadCount, 0);
  const directTotal = summaryThreads.filter((thread) => thread.kind === 'DIRECT').length;
  const supportTotal = summaryThreads.filter((thread) => thread.kind === 'SUPPORT').length;
  const filtered = useMemo(() => searchFiltered.filter((thread) => filter === 'all'
    || (filter === 'unread' && thread.unreadCount > 0)
    || (filter === 'direct' && thread.kind === 'DIRECT')
    || (filter === 'support' && thread.kind === 'SUPPORT')),
  [searchFiltered, filter]);

  const handleHistoryDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasMessageAttachmentFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (!selected?.canReply || !canPerform('NOTIFICATIONS_MESSAGES', 'create')) return;
    historyDropDepthRef.current += 1;
    setHistoryDropActive(true);
  };

  const handleHistoryDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasMessageAttachmentFiles(event.dataTransfer) || !selected?.canReply) return;
    event.preventDefault();
    historyDropDepthRef.current = Math.max(0, historyDropDepthRef.current - 1);
    if (historyDropDepthRef.current === 0) setHistoryDropActive(false);
  };

  const handleHistoryDrop = (event: React.DragEvent<HTMLDivElement>) => {
    historyDropDepthRef.current = 0;
    setHistoryDropActive(false);
    if (!selected?.canReply || !canPerform('NOTIFICATIONS_MESSAGES', 'create')) {
      if (hasMessageAttachmentFiles(event.dataTransfer)) event.preventDefault();
      return;
    }
    dropMessageAttachmentFiles(event, (files) => replyAttachmentComposerRef.current?.addFiles(files));
  };

  useEffect(() => {
    if (lastSelectedIdRef.current !== selectedId) {
      shouldAutoScrollRef.current = true;
      lastSelectedIdRef.current = selectedId;
    }
    if (!shouldAutoScrollRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const messageBody = messageBodyRef.current;
      if (messageBody) {
        messageBody.scrollTo({
          top: messageBody.scrollHeight,
          behavior: shouldReduceMotion ? 'auto' : 'smooth',
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedId, selected?.messages.length, shouldReduceMotion]);

  const openThread = (thread: Message) => {
    historyDropDepthRef.current = 0;
    setHistoryDropActive(false);
    setReplyAttachmentState(EMPTY_ATTACHMENT_STATE);
    setReplyAttachmentResetKey((current) => current + 1);
    setSelectedId(thread.id);
    setMobileThreadOpen(true);
    setReplyError('');
  };

  const openComposer = (mode: ComposeMode = 'DIRECT') => {
    setComposeAttachmentState(EMPTY_ATTACHMENT_STATE);
    setComposeAttachmentResetKey((current) => current + 1);
    setComposeMode(mode);
    setRecipientId('');
    setComposeOpen(true);
    setComposeError('');
  };

  const resetComposer = () => {
    setRecipientId('');
    setSubject('');
    setContent('');
    setComposeAttachmentState(EMPTY_ATTACHMENT_STATE);
    setComposeAttachmentResetKey((current) => current + 1);
    setComposeError('');
    setComposeMode('DIRECT');
    supportCreateAttemptRef.current = null;
  };

  const sendNewMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanSubject = subject.trim();
    const cleanContent = content.trim();
    if ((composeMode === 'DIRECT' && !recipientId) || !cleanSubject || (!cleanContent && !composeAttachmentState.attachments.length)) {
      setComposeError(composeMode === 'SUPPORT'
        ? 'Completá el asunto y escribe un mensaje o adjunta un archivo.'
        : 'Elegí un destinatario, completá el asunto y escribe un mensaje o adjunta un archivo.');
      return;
    }
    if (composeAttachmentState.uploading || composeAttachmentState.hasError) return;

    setSending(true);
    setComposeError('');
    try {
      const attachmentUploadIds = composeAttachmentState.attachments.map((attachment) => attachment.id);
      const created = composeMode === 'SUPPORT'
        ? await (() => {
          const payload = { title: cleanSubject, content: cleanContent, attachmentUploadIds };
          const signature = JSON.stringify(payload);
          if (!supportCreateAttemptRef.current || supportCreateAttemptRef.current.signature !== signature) {
            supportCreateAttemptRef.current = {
              signature,
              key: createIdempotencyKey('branch-support'),
            };
          }
          return supportConversationsService.createConversation(payload, supportCreateAttemptRef.current.key);
        })()
        : await messagesService.create({
          recipientId,
          title: cleanSubject,
          content: cleanContent,
          attachmentUploadIds,
        });
      const cacheKey = composeMode === 'SUPPORT' ? supportConversationsCacheKey : directMessagesCacheKey;
      queryClient.setQueryData<Message[]>(cacheKey, (current) => upsertMessageThread(current, created));
      setSelectedId(created.id);
      setMobileThreadOpen(true);
      setComposeOpen(false);
      resetComposer();
      toast.success(composeMode === 'SUPPORT' ? 'Mensaje enviado a Soporte Técnico' : 'Mensaje enviado');
    } catch (error: any) {
      setComposeError(error?.message || 'No pudimos enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const sendReply = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const attachments = selected && selected.kind !== 'SYSTEM' ? replyAttachmentState.attachments : [];
    if (!selected || (!reply.trim() && !attachments.length) || (selected.kind !== 'SYSTEM' && (replyAttachmentState.uploading || replyAttachmentState.hasError))) return;

    setReplying(true);
    setReplyError('');
    try {
      const updated = selected.kind === 'SUPPORT'
        ? await supportConversationsService.reply(selected.id, reply.trim(), attachments.map((attachment) => attachment.id))
        : await messagesService.reply(selected.id, reply.trim(), attachments.map((attachment) => attachment.id));
      const cacheKey = selected.kind === 'SUPPORT' ? supportConversationsCacheKey : directMessagesCacheKey;
      queryClient.setQueryData<Message[]>(cacheKey, (current) => upsertMessageThread(current, updated));
      setReply('');
      if (selected.kind !== 'SYSTEM') {
        setReplyAttachmentState(EMPTY_ATTACHMENT_STATE);
        setReplyAttachmentResetKey((current) => current + 1);
      }
    } catch (error: any) {
      setReplyError(error?.message || 'No pudimos enviar la respuesta.');
    } finally {
      setReplying(false);
    }
  };

  const navigateFromSystemMessage = (message: ChatMessage) => {
    if (message.content.startsWith('TAREA:')) {
      window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'actividades', subModule: 'tareas' } }));
    } else if (message.content.startsWith('RECORDATORIO:')) {
      window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'actividades', subModule: 'recordatorios' } }));
    }
  };

  return (
    <>
      <section
        className="grid h-full min-h-0 min-w-0 flex-1 grid-cols-1 [grid-template-rows:minmax(0,1fr)] gap-1 overflow-hidden p-1 lg:grid-cols-[340px_minmax(0,1fr)]"
        aria-label="Mensajería interna"
        data-testid="messages-workspace"
        data-tour="notificaciones-mensajes"
      >
        <aside className={cn('flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm', mobileThreadOpen && 'hidden lg:flex')}>
          <div className="shrink-0 border-b border-border/60 p-2">
            <div className="mb-2 flex min-w-0 flex-col gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-black">Mensajes</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {loading ? 'Calculando conversaciones…' : `${searchFiltered.length} conversaciones · ${unreadTotal} sin leer`}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 self-end">
                {canPerform('NOTIFICATIONS_MESSAGES', 'create') && (
                  <Button onClick={() => openComposer('DIRECT')} size="sm" className="h-8 gap-2 rounded-lg px-3" data-testid="new-message-button">
                    <MailPlus className="size-4" />
                    <span>Nuevo</span>
                  </Button>
                )}
                {canCreateSupportConversation && (
                  <Button onClick={() => openComposer('SUPPORT')} size="sm" variant="outline" className="h-8 gap-2 rounded-lg px-3" aria-label="Nuevo mensaje a soporte técnico" title="Nuevo mensaje a soporte técnico" data-testid="new-support-message-button">
                    <LifeBuoy className="size-4" />
                    <span>Soporte</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar conversaciones"
                  aria-label="Buscar conversaciones"
                  className="h-9 rounded-lg bg-muted/30 pl-9"
                />
              </div>
              <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-muted-foreground" onClick={onHelp} aria-label="Cómo usar Notificaciones" title="Cómo usar Notificaciones">
                <CircleHelp className="size-4" />
              </Button>
            </div>

            <div className="-mx-1 mt-1.5 flex min-w-0 gap-1 overflow-x-auto px-1 scrollbar-overlay" aria-label="Filtros de mensajes">
              {([
                ['all', 'Todos'],
                ['unread', `Sin leer${unreadTotal ? ` ${unreadTotal}` : ''}`],
                ['direct', `Personas${directTotal ? ` ${directTotal}` : ''}`],
                ['support', `Soporte${supportTotal ? ` ${supportTotal}` : ''}`],
              ] as Array<[MessageFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'min-h-8 shrink-0 rounded-lg px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    filter === value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 scrollbar-overlay" role="list" aria-label="Conversaciones" data-testid="message-inbox-list" tabIndex={0}>
            {loading || supportConversationsQuery.isLoading ? (
              <div className="space-y-2 p-2" aria-label="Cargando conversaciones">
                {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-muted/40" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <MessageCircle className="mb-3 size-9 text-muted-foreground/40" />
                <p className="font-semibold">No hay conversaciones aquí</p>
                <p className="mt-1 text-sm text-muted-foreground">Probá otro filtro o iniciá un mensaje nuevo.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
              {filtered.map((thread) => {
                const active = selectedId === thread.id;
                const system = thread.kind === 'SYSTEM';
                const support = thread.kind === 'SUPPORT';
                return (
                  <motion.button
                    key={thread.id}
                    type="button"
                    role="listitem"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => openThread(thread)}
                    layout={!shouldReduceMotion}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
                    className={cn(
                      'group mb-1 flex w-full min-w-0 gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      active ? 'border-primary/15 bg-primary/10' : 'hover:bg-muted/60',
                    )}
                    data-testid={`message-thread-${thread.id}`}
                  >
                    <ParticipantAvatar participant={thread.participant} system={system} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm', thread.unreadCount > 0 ? 'font-bold' : 'font-semibold')}>
                          {participantName(thread.participant)}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{threadTime(thread.lastMessageAt)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="truncate text-xs font-medium text-foreground/80">{thread.title}</span>
                        {system && <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">Sistema</span>}
                        {support && <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">Soporte</span>}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="truncate text-xs text-muted-foreground">{thread.preview || 'Sin contenido'}</span>
                        {thread.unreadCount > 0 && (
                          <span className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </motion.button>
                );
              })}
              </AnimatePresence>
            )}
          </div>
        </aside>

        <article className={cn('h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm lg:flex', mobileThreadOpen ? 'flex' : 'hidden')}>
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="size-6" />
              </div>
              <h3 className="text-lg font-semibold">Elegí una conversación</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Leé mensajes de tu equipo o iniciá una conversación nueva.</p>
              {canPerform('NOTIFICATIONS_MESSAGES', 'create') && (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => openComposer('DIRECT')} variant="outline" className="gap-2">
                    <MailPlus className="size-4" /> Nuevo mensaje
                  </Button>
                  {canCreateSupportConversation && (
                    <Button onClick={() => openComposer('SUPPORT')} variant="outline" className="gap-2">
                      <LifeBuoy className="size-4" /> Mensaje a soporte
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-card px-2 py-1.5 sm:px-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 lg:hidden"
                  aria-label="Volver a conversaciones"
                  onClick={() => setMobileThreadOpen(false)}
                >
                  <ArrowLeft className="size-5" />
                </Button>
                <ParticipantAvatar participant={selected.participant} system={selected.kind === 'SYSTEM'} />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-sm font-black sm:text-base">{participantName(selected.participant, selected.kind === 'SUPPORT' ? 'Soporte técnico' : 'Participante')}</h3>
                  <p className="flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground" data-testid="message-thread-context">
                    <span className="truncate">{selected.title}</span>
                    <span className="shrink-0">·</span>
                    <MapPin className="size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">Origen: {selectedOrigin}</span>
                  </p>
                </div>
                <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">{selected.kind === 'SUPPORT' ? 'Soporte técnico' : selected.kind === 'DIRECT' ? 'Equipo' : 'Sistema'}</Badge>
                {markingReadId === selected.id ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <CheckCheck className="size-4 text-muted-foreground/60" aria-label="Conversación leída" />}
              </header>

              <div className="relative min-h-0 min-w-0 flex-1">
                <div
                  ref={messageBodyRef}
                  onDragEnter={handleHistoryDragEnter}
                  onDragLeave={handleHistoryDragLeave}
                  onDragOver={(event) => {
                    if (!hasMessageAttachmentFiles(event.dataTransfer)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = selected.canReply && canPerform('NOTIFICATIONS_MESSAGES', 'create') ? 'copy' : 'none';
                  }}
                  onDrop={handleHistoryDrop}
                  onScroll={(event) => {
                    const element = event.currentTarget;
                    shouldAutoScrollRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 140;
                  }}
                  className="min-h-0 h-full space-y-3 overflow-y-auto overscroll-contain p-2 scrollbar-overlay"
                  data-testid="message-thread-body"
                  aria-live="polite"
                  aria-label="Historial de mensajes"
                  tabIndex={0}
                >
                  <AnimatePresence initial={false}>
                  {(selected.messages || []).map((message) => {
                    const isSystem = selected.kind === 'SYSTEM';
                    const content = String(message.content || '');
                    const hasAction = isSystem && (content.startsWith('TAREA:') || content.startsWith('RECORDATORIO:'));
                    return (
                      <motion.div
                        key={message.id}
                        className={cn('flex', message.mine ? 'justify-end' : 'justify-start')}
                        layout={!shouldReduceMotion}
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 9, scale: 0.985 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={shouldReduceMotion ? undefined : { opacity: 0, y: -3 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
                      >
                        <div className={cn(
                          'max-w-[90%] rounded-2xl px-3 py-2.5 sm:max-w-[72%]',
                          message.mine
                            ? 'rounded-br-md bg-primary text-primary-foreground'
                            : isSystem
                              ? 'rounded-bl-md border border-amber-500/20 bg-amber-500/5'
                              : 'rounded-bl-md bg-muted/70 text-foreground',
                        )}>
                          {!message.mine && (
                            <p className={cn('mb-1 text-[11px] font-semibold', isSystem ? 'text-amber-600' : 'text-muted-foreground')}>
                              {participantName(message.sender, isSystem ? 'Sistema' : participantName(selected.participant, 'Participante'))}
                            </p>
                          )}
                          {content && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed"><MessageText content={content} mine={message.mine} /></p>}
                          {(selected.kind === 'SUPPORT' || selected.kind === 'DIRECT') && (
                            <MessageAttachments
                              threadId={selected.id}
                              kind={selected.kind}
                              attachments={message.attachments}
                              mine={message.mine}
                            />
                          )}
                          {hasAction && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-3 h-8 bg-background/60 text-xs"
                              onClick={() => navigateFromSystemMessage(message)}
                            >
                              Abrir {content.startsWith('TAREA:') ? 'tarea' : 'recordatorio'}
                            </Button>
                          )}
                          <p className={cn('mt-1.5 text-right text-[10px] tabular-nums', message.mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                            {messageTime(message.createdAt)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                </div>
                {historyDropActive && <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/80 p-4 text-center text-sm font-bold text-primary shadow-sm backdrop-blur-[2px]" role="status" aria-live="polite"><span className="flex items-center gap-2"><Upload className="size-4 shrink-0" /> Suelta los archivos para adjuntarlos al borrador</span></div>}
              </div>

              {selected.canReply ? (
                <form onSubmit={sendReply} className="shrink-0 border-t border-border/60 px-1 py-1" data-testid="message-reply-form">
                  <div className="w-full min-w-0">
                    <label htmlFor="message-reply" className="sr-only">Responder mensaje</label>
                    <p id="message-reply-help" className="sr-only">Enter envía la respuesta y Shift más Enter agrega una nueva línea.</p>
                    <MessageAttachmentComposer
                      ref={replyAttachmentComposerRef}
                      key={`branch-reply-${selected.id}-${replyAttachmentResetKey}`}
                      conversationId={selected.id}
                      kind={selected.kind === 'SUPPORT' ? 'SUPPORT' : 'DIRECT'}
                      density="compact"
                      disabled={replying || !canPerform('NOTIFICATIONS_MESSAGES', 'create')}
                      onChange={onReplyAttachmentsChange}
                    >
                      <Textarea
                        id="message-reply"
                        rows={1}
                        value={reply}
                        onChange={(event) => setReply(event.target.value.slice(0, 4000))}
                        onPaste={(event) => pasteMessageAttachmentFiles(event, (files) => replyAttachmentComposerRef.current?.addFiles(files))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            void sendReply();
                          }
                        }}
                        placeholder="Escribí una respuesta…"
                        aria-describedby="message-reply-help"
                        className="field-sizing-content min-h-9 max-h-28 min-w-0 flex-1 resize-none overflow-y-auto rounded-full border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
                        disabled={replying || !canPerform('NOTIFICATIONS_MESSAGES', 'create')}
                        data-testid="message-reply-input"
                      />
                      <Button
                        type="submit"
                        size="icon"
                        className="size-9 shrink-0 rounded-full"
                        disabled={replying || !canPerform('NOTIFICATIONS_MESSAGES', 'create') || replyAttachmentState.uploading || replyAttachmentState.hasError || (!reply.trim() && !replyAttachmentState.attachments.length)}
                        aria-label="Enviar respuesta"
                        data-testid="send-reply-button"
                      >
                        {replying ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      </Button>
                    </MessageAttachmentComposer>
                    {replyError && <div className="mt-1 flex justify-between gap-3 px-2 text-[11px]"><span className="text-destructive" role="alert">{replyError}</span></div>}
                  </div>
                </form>
              ) : (
                <div className="border-t border-border/60 bg-muted/20 px-4 py-3 text-center text-xs text-muted-foreground">
                  {selected.kind === 'SUPPORT' ? 'Tu perfil puede consultar esta conversación, pero no responder.' : 'Este aviso fue generado por el sistema y no admite respuestas.'}
                </div>
              )}
            </>
          )}
        </article>
      </section>

      <Dialog
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open);
          if (!open && !sending) resetComposer();
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <form onSubmit={sendNewMessage} className="space-y-5" data-testid="new-message-form">
            <DialogHeader>
              <DialogTitle>{composeMode === 'SUPPORT' ? 'Nuevo mensaje a Soporte Técnico' : 'Nuevo mensaje'}</DialogTitle>
              <DialogDescription>
                {composeMode === 'SUPPORT'
                  ? 'Iniciá una conversación privada que recibirán los agentes asignados a esta sucursal.'
                  : 'Iniciá una conversación privada con alguien de tu empresa.'}
              </DialogDescription>
            </DialogHeader>

            {composeMode === 'SUPPORT' ? (
              <div className="flex min-w-0 items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><LifeBuoy className="size-5" /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Soporte Técnico</span>
                  <span className="block text-xs text-muted-foreground">Agentes con acceso asignado a esta sucursal</span>
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="message-recipient" className="text-sm font-medium">Para</label>
                <select
                  id="message-recipient"
                  value={recipientId}
                  onChange={(event) => setRecipientId(event.target.value)}
                  disabled={recipientsLoading || sending}
                  className="flex h-11 w-full max-w-full rounded-lg border border-input bg-input-background px-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                  data-testid="message-recipient"
                >
                  <option value="">{recipientsLoading ? 'Cargando personas…' : 'Seleccioná una persona'}</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>{recipient.name} · {recipient.email}</option>
                  ))}
                </select>
                {!recipientsLoading && recipients.length === 0 && !composeFeedbackError && (
                  <p className="text-xs text-muted-foreground">No hay otros usuarios activos en esta empresa.</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="message-subject" className="text-sm font-medium">Asunto</label>
              <Input
                id="message-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value.slice(0, 140))}
                placeholder="¿Sobre qué querés conversar?"
                disabled={sending}
                data-testid="message-subject"
              />
              <p className="text-right text-[11px] text-muted-foreground">{subject.length}/140</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="message-content" className="text-sm font-medium">Mensaje</label>
              <Textarea
                id="message-content"
                value={content}
                onChange={(event) => setContent(event.target.value.slice(0, 4000))}
                onPaste={(event) => pasteMessageAttachmentFiles(event, (files) => composeAttachmentComposerRef.current?.addFiles(files))}
                onDragOver={allowMessageAttachmentDrop}
                onDrop={(event) => dropMessageAttachmentFiles(event, (files) => composeAttachmentComposerRef.current?.addFiles(files))}
                placeholder={composeMode === 'SUPPORT' ? 'Describe el problema o la ayuda que necesitas…' : 'Escribí el mensaje con el contexto necesario…'}
                className="min-h-36"
                disabled={sending}
                data-testid="message-content"
              />
              <p className="text-right text-[11px] text-muted-foreground">{content.length}/4000</p>
            </div>

            <MessageAttachmentComposer
              ref={composeAttachmentComposerRef}
              key={`new-message-${composeMode}-${composeAttachmentResetKey}`}
              kind={composeMode === 'SUPPORT' ? 'SUPPORT' : 'DIRECT'}
              disabled={sending}
              onChange={onComposeAttachmentsChange}
            />

            {composeFeedbackError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{composeFeedbackError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setComposeOpen(false)} disabled={sending}>Cancelar</Button>
              <Button
                type="submit"
                disabled={sending || (composeMode === 'DIRECT' && (recipientsLoading || recipients.length === 0)) || composeAttachmentState.uploading || composeAttachmentState.hasError || (!content.trim() && !composeAttachmentState.attachments.length)}
                className="gap-2"
                data-testid="send-new-message-button"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {composeMode === 'SUPPORT' ? 'Enviar a soporte' : 'Enviar mensaje'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
