import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  Loader2,
  MailPlus,
  MessageCircle,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ChatMessage, Message, MessageParticipant } from '../../types';
import { messagesService } from '../../services/notificaciones.service';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
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
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';

interface MensajesViewProps {
  data: Message[];
  loading: boolean;
  onRefresh: () => void | Promise<void>;
}

type MessageFilter = 'all' | 'unread' | 'direct';

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

export const MensajesView: React.FC<MensajesViewProps> = ({ data, loading, onRefresh }) => {
  const { canPerform } = useAuth();
  const { refresh: refreshInbox } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<MessageFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [composeError, setComposeError] = useState('');
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState('');
  const [replying, setReplying] = useState(false);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const recipientsQuery = useTenantQuery<MessageParticipant[]>(
    ['notifications', 'recipients'],
    signal => messagesService.getRecipients(signal),
    { enabled: composeOpen },
  );
  const recipients = asList(recipientsQuery.data) as MessageParticipant[];
  const recipientsLoading = recipientsQuery.isLoading || recipientsQuery.isFetching;

  useEffect(() => {
    if (composeOpen && recipientsQuery.isError) {
      setComposeError('No pudimos cargar las personas de tu empresa.');
    }
  }, [composeOpen, recipientsQuery.isError]);

  useEffect(() => {
    if (selectedId && !data.some((thread) => thread.id === selectedId)) {
      setSelectedId(null);
      setMobileThreadOpen(false);
    }
  }, [data, selectedId]);

  useEffect(() => {
    if (!selectedId && data.length > 0 && window.matchMedia('(min-width: 1024px)').matches) {
      setSelectedId(data[0].id);
    }
  }, [data, selectedId]);

  useEffect(() => {
    const visibleThread = data.find((thread) => thread.id === selectedId);
    if (!visibleThread || visibleThread.unreadCount === 0 || markingReadId === visibleThread.id) return;

    let active = true;
    setMarkingReadId(visibleThread.id);
    void messagesService.markRead(visibleThread.id)
      .then(async () => { await refreshInbox(); await onRefresh(); })
      .catch((e: any) => {
        if (active) toast.error(e?.response?.data?.message || 'No pudimos marcar la conversación como leída');
      })
      .finally(() => {
        if (active) setMarkingReadId(null);
      });

    return () => {
      active = false;
    };
  }, [data, selectedId]);

  const selected = data.find((thread) => thread.id === selectedId) || null;
  const unreadTotal = data.reduce((total, thread) => total + thread.unreadCount, 0);
  const directTotal = data.filter((thread) => thread.kind === 'DIRECT').length;

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return data.filter((thread) => {
      const matchesFilter = filter === 'all'
        || (filter === 'unread' && thread.unreadCount > 0)
        || (filter === 'direct' && thread.kind === 'DIRECT');
      const matchesSearch = !query || [thread.title, thread.preview, thread.participant?.name, thread.participant?.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [data, filter, searchTerm]);

  const refresh = async () => {
    await onRefresh();
  };

  const openThread = async (thread: Message) => {
    setSelectedId(thread.id);
    setMobileThreadOpen(true);
    setReplyError('');
    if (thread.unreadCount === 0 || markingReadId === thread.id) return;

    setMarkingReadId(thread.id);
    try {
      await messagesService.markRead(thread.id);
      await refreshInbox();
      await refresh();
    } catch {
      toast.error('No pudimos marcar la conversación como leída');
    } finally {
      setMarkingReadId(null);
    }
  };

  const openComposer = async () => {
    setComposeOpen(true);
    setComposeError('');
  };

  const resetComposer = () => {
    setRecipientId('');
    setSubject('');
    setContent('');
    setComposeError('');
  };

  const sendNewMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanSubject = subject.trim();
    const cleanContent = content.trim();
    if (!recipientId || !cleanSubject || !cleanContent) {
      setComposeError('Elegí un destinatario y completá el asunto y el mensaje.');
      return;
    }

    setSending(true);
    setComposeError('');
    try {
      const created = await messagesService.create({ recipientId, title: cleanSubject, content: cleanContent });
      setSelectedId(created.id);
      setMobileThreadOpen(true);
      setComposeOpen(false);
      resetComposer();
      await refresh();
      setSelectedId(created.id);
      setMobileThreadOpen(true);
      toast.success('Mensaje enviado');
    } catch (error: any) {
      setComposeError(error?.message || 'No pudimos enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const sendReply = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!selected || !reply.trim()) return;

    setReplying(true);
    setReplyError('');
    try {
      await messagesService.reply(selected.id, reply.trim());
      setReply('');
      await refresh();
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
        className="flex h-[calc(100dvh-13rem)] min-h-[520px] overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-sm"
        aria-label="Mensajería interna"
        data-testid="messages-workspace"
        data-tour="notificaciones-mensajes"
      >
        <aside className={cn('w-full flex-col border-r border-border/60 bg-background/45 lg:flex lg:w-[370px] lg:shrink-0', mobileThreadOpen ? 'hidden' : 'flex')}>
          <div className="border-b border-border/60 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Mensajes</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {data.length} conversaciones · {unreadTotal} sin leer
                </p>
              </div>
              {canPerform('NOTIFICATIONS_MESSAGES', 'create') && (
                <Button onClick={openComposer} size="sm" className="h-9 gap-2 rounded-lg px-3" data-testid="new-message-button">
                  <MailPlus className="size-4" />
                  <span>Nuevo</span>
                </Button>
              )}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar conversaciones"
                aria-label="Buscar conversaciones"
                className="h-10 rounded-lg bg-muted/30 pl-9"
              />
            </div>

            <div className="mt-3 flex gap-1" aria-label="Filtros de mensajes">
              {([
                ['all', 'Todos'],
                ['unread', `Sin leer${unreadTotal ? ` ${unreadTotal}` : ''}`],
                ['direct', `Personas${directTotal ? ` ${directTotal}` : ''}`],
              ] as Array<[MessageFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'min-h-8 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    filter === value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto" role="list" aria-label="Conversaciones">
            {loading ? (
              <div className="space-y-2 p-3" aria-label="Cargando conversaciones">
                {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-muted/40" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <MessageCircle className="mb-3 size-9 text-muted-foreground/40" />
                <p className="font-semibold">No hay conversaciones aquí</p>
                <p className="mt-1 text-sm text-muted-foreground">Probá otro filtro o iniciá un mensaje nuevo.</p>
              </div>
            ) : (
              filtered.map((thread) => {
                const active = selectedId === thread.id;
                const system = thread.kind === 'SYSTEM';
                return (
                  <button
                    key={thread.id}
                    type="button"
                    role="listitem"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => void openThread(thread)}
                    className={cn(
                      'group flex w-full gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      active ? 'bg-primary/8' : 'hover:bg-muted/35',
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
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <article className={cn('min-w-0 flex-1 flex-col bg-background/25 lg:flex', mobileThreadOpen ? 'flex' : 'hidden')}>
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="size-6" />
              </div>
              <h3 className="text-lg font-semibold">Elegí una conversación</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Leé mensajes de tu equipo o iniciá una conversación nueva.</p>
              {canPerform('NOTIFICATIONS_MESSAGES', 'create') && (
                <Button onClick={openComposer} variant="outline" className="mt-5 gap-2">
                  <MailPlus className="size-4" /> Nuevo mensaje
                </Button>
              )}
            </div>
          ) : (
            <>
              <header className="flex min-h-16 items-center gap-3 border-b border-border/60 px-3 py-2 sm:px-5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 lg:hidden"
                  aria-label="Volver a conversaciones"
                  onClick={() => setMobileThreadOpen(false)}
                >
                  <ArrowLeft className="size-5" />
                </Button>
                <ParticipantAvatar participant={selected.participant} system={selected.kind === 'SYSTEM'} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold sm:text-base">{selected.title}</h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {selected.kind === 'SYSTEM' ? 'Aviso automático de NovaHub' : participantName(selected.participant, 'Participante')}
                  </p>
                </div>
                {markingReadId === selected.id ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <CheckCheck className="size-4 text-muted-foreground/60" aria-label="Conversación leída" />}
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6" data-testid="message-thread-body" aria-live="polite">
                <div className="mx-auto flex max-w-3xl flex-col gap-3">
                  {(selected.messages || []).map((message) => {
                    const isSystem = selected.kind === 'SYSTEM';
                    const content = String(message.content || '');
                    const hasAction = isSystem && (content.startsWith('TAREA:') || content.startsWith('RECORDATORIO:'));
                    return (
                      <div key={message.id} className={cn('flex', message.mine ? 'justify-end' : 'justify-start')}>
                        <div className={cn(
                          'max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[72%]',
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
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{content}</p>
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
                      </div>
                    );
                  })}
                </div>
              </div>

              {selected.canReply ? (
                <form onSubmit={sendReply} className="border-t border-border/60 bg-background/70 p-3 sm:p-4">
                  <div className="mx-auto max-w-3xl">
                    <label htmlFor="message-reply" className="sr-only">Responder mensaje</label>
                    <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/20 p-2 focus-within:ring-2 focus-within:ring-ring/40">
                      <Textarea
                        id="message-reply"
                        value={reply}
                        onChange={(event) => setReply(event.target.value.slice(0, 4000))}
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void sendReply();
                        }}
                        placeholder="Escribí una respuesta…"
                        className="max-h-36 min-h-10 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
                        disabled={replying || !canPerform('NOTIFICATIONS_MESSAGES', 'create')}
                        data-testid="message-reply-input"
                      />
                      <Button
                        type="submit"
                        size="icon"
                        className="size-10 shrink-0 rounded-lg"
                        disabled={replying || !reply.trim() || !canPerform('NOTIFICATIONS_MESSAGES', 'create')}
                        aria-label="Enviar respuesta"
                        data-testid="send-reply-button"
                      >
                        {replying ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      </Button>
                    </div>
                    <div className="mt-1.5 flex justify-between gap-3 px-1 text-[11px]">
                      <span className="text-destructive" role={replyError ? 'alert' : undefined}>{replyError}</span>
                      <span className="ml-auto text-muted-foreground">Ctrl + Enter para enviar</span>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="border-t border-border/60 bg-muted/20 px-4 py-3 text-center text-xs text-muted-foreground">
                  Este aviso fue generado por el sistema y no admite respuestas.
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
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={sendNewMessage} className="space-y-5" data-testid="new-message-form">
            <DialogHeader>
              <DialogTitle>Nuevo mensaje</DialogTitle>
              <DialogDescription>Iniciá una conversación privada con alguien de tu empresa.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label htmlFor="message-recipient" className="text-sm font-medium">Para</label>
              <select
                id="message-recipient"
                value={recipientId}
                onChange={(event) => setRecipientId(event.target.value)}
                disabled={recipientsLoading || sending}
                className="flex h-11 w-full rounded-lg border border-input bg-input-background px-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                data-testid="message-recipient"
              >
                <option value="">{recipientsLoading ? 'Cargando personas…' : 'Seleccioná una persona'}</option>
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>{recipient.name} · {recipient.email}</option>
                ))}
              </select>
              {!recipientsLoading && recipients.length === 0 && !composeError && (
                <p className="text-xs text-muted-foreground">No hay otros usuarios activos en esta empresa.</p>
              )}
            </div>

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
                placeholder="Escribí el mensaje con el contexto necesario…"
                className="min-h-36"
                disabled={sending}
                data-testid="message-content"
              />
              <p className="text-right text-[11px] text-muted-foreground">{content.length}/4000</p>
            </div>

            {composeError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{composeError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setComposeOpen(false)} disabled={sending}>Cancelar</Button>
              <Button type="submit" disabled={sending || recipientsLoading || recipients.length === 0} className="gap-2" data-testid="send-new-message-button">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Enviar mensaje
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
