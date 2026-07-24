import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, MessageSquare, Send, Search, Phone, Mail,
  Globe, Facebook, Instagram, Hash, User,
  Paperclip, Smile, ArrowLeft, FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import {
  novachatService,
  type ChatChannel,
  type ChatConversation,
  type ChatMessage,
} from '../../services/novachat.service';

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  WHATSAPP: Phone,
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  WEB: Globe,
  EMAIL: Mail,
};

const CHANNEL_COLORS: Record<string, string> = {
  WHATSAPP: 'text-emerald-500',
  FACEBOOK: 'text-blue-500',
  INSTAGRAM: 'text-pink-500',
  WEB: 'text-cyan-500',
  EMAIL: 'text-amber-500',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Abierta', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  PENDING: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  RESOLVED: { label: 'Resuelta', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  CLOSED: { label: 'Cerrada', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days}d`;
}

export function NovaChatView() {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let [chans, convs] = await Promise.all([
        novachatService.getChannels(),
        novachatService.getConversations(),
      ]);
      if (!chans || chans.length === 0) {
        await novachatService.seedDemo();
        [chans, convs] = await Promise.all([
          novachatService.getChannels(),
          novachatService.getConversations(),
        ]);
      }
      setChannels(chans);
      setConversations(convs);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al cargar datos de NovaChat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedConversation) {
      novachatService.getMessages(selectedConversation.id).then(setMessages).catch(() => {});
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredConversations = conversations.filter((c) => {
    if (filterChannel !== 'all' && c.channel.id !== filterChannel) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.contact?.name?.toLowerCase().includes(q) ||
        c.subject?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    setSending(true);
    try {
      const msg = await novachatService.sendMessage({
        conversationId: selectedConversation.id,
        content: newMessage.trim(),
      });
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al enviar mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (convId: string, status: string) => {
    try {
      await novachatService.updateConversationStatus(convId, status);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, status } : c)),
      );
      if (selectedConversation?.id === convId) {
        setSelectedConversation((prev) => (prev ? { ...prev, status } : null));
      }
      toast.success('Estado actualizado');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar estado');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-2xl border border-border/50 overflow-hidden bg-card">
      <div className="w-64 border-r border-border/30 flex flex-col bg-muted/10 shrink-0">
        <div className="p-4 border-b border-border/30">
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">Bandejas de Entrada</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre..."
              className="pl-8 h-9 rounded-lg text-xs"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button
            onClick={() => setFilterChannel('all')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
              filterChannel === 'all' ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-muted-foreground'
            }`}
          >
            <MessageSquare className="size-4" />
            <span>Todas las conversaciones</span>
            <Badge className="ml-auto bg-primary/20 text-primary text-[9px]">{conversations.length}</Badge>
          </button>
          {channels.map((ch) => {
            const Icon = CHANNEL_ICONS[ch.type] || Hash;
            const color = CHANNEL_COLORS[ch.type] || 'text-gray-500';
            const count = conversations.filter((c) => c.channel.id === ch.id).length;
            return (
              <button
                key={ch.id}
                onClick={() => setFilterChannel(ch.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  filterChannel === ch.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                <Icon className={`size-4 ${color}`} />
                <span className="truncate">{ch.name}</span>
                {count > 0 && (
                  <Badge className="ml-auto bg-muted text-muted-foreground text-[9px]">{count}</Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`w-80 border-r border-border/30 flex flex-col shrink-0 ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-3 border-b border-border/30 flex items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 rounded-lg text-xs flex-1">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="OPEN">Abiertas</SelectItem>
              <SelectItem value="PENDING">Pendientes</SelectItem>
              <SelectItem value="RESOLVED">Resueltas</SelectItem>
              <SelectItem value="CLOSED">Cerradas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs">
              No hay conversaciones
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const lastMsg = conv.messages?.[0];
              const isActive = selectedConversation?.id === conv.id;
              const ChanIcon = CHANNEL_ICONS[conv.channel?.type] || Hash;
              return (
                <button
                  key={conv.id}
                  onClick={() => { setSelectedConversation(conv); setShowMobileChat(true); }}
                  className={`w-full text-left px-4 py-3 border-b border-border/20 transition-colors hover:bg-muted/30 ${
                    isActive ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="size-5 text-primary" />
                      </div>
                      <ChanIcon className={`size-3 absolute -bottom-0.5 -right-0.5 ${CHANNEL_COLORS[conv.channel?.type] || 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate">{conv.contact?.name || 'Sin nombre'}</span>
                        <Badge className={`text-[8px] px-1.5 py-0 ${STATUS_LABELS[conv.status]?.color || ''}`}>
                          {STATUS_LABELS[conv.status]?.label || conv.status}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        #{conv.id.slice(0, 4)} &middot; {conv.channel?.name}
                      </p>
                      {lastMsg && (
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">
                          {lastMsg.content}
                        </p>
                      )}
                      {conv.lastMessageAt && (
                        <p className="text-[9px] text-muted-foreground mt-1">
                          {formatRelativeTime(conv.lastMessageAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col ${showMobileChat ? 'flex' : 'hidden md:flex'}`}>
        {!selectedConversation ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="size-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-bold">Seleccioná una conversación</p>
              <p className="text-xs mt-1">para empezar a chatear</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border/30 flex items-center gap-3 bg-muted/10">
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden"
                onClick={() => setShowMobileChat(false)}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="size-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{selectedConversation.contact?.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {selectedConversation.channel?.name} &middot; En línea
                </p>
              </div>
              <Select
                value={selectedConversation.status}
                onValueChange={(val) => handleStatusChange(selectedConversation.id, val)}
              >
                <SelectTrigger className="h-8 w-32 rounded-lg text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Abierta</SelectItem>
                  <SelectItem value="PENDING">Pendiente</SelectItem>
                  <SelectItem value="RESOLVED">Resuelta</SelectItem>
                  <SelectItem value="CLOSED">Cerrada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => {
                const isOutgoing = msg.direction === 'OUTGOING';
                return (
                  <div key={msg.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        isOutgoing
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted/50 text-foreground rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      {msg.messageType !== 'text' && msg.metadata?.fileName && (
                        <div className={`mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 ${
                          isOutgoing
                            ? 'border-primary-foreground/20 bg-primary-foreground/10'
                            : 'border-border/40 bg-background/60'
                        }`}>
                          <FileText className="size-4 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold truncate">{msg.metadata.fileName}</p>
                            {msg.metadata.fileSize && (
                              <p className="text-[9px] opacity-70">{msg.metadata.fileSize}</p>
                            )}
                          </div>
                        </div>
                      )}
                      <p className={`text-[9px] mt-1 ${isOutgoing ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                        {formatTime(msg.sentAt)}
                        {msg.agentName && ` · ${msg.agentName}`}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-border/30 bg-muted/10">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="shrink-0">
                  <Paperclip className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" className="shrink-0">
                  <Smile className="size-4" />
                </Button>
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                  placeholder="Escribí tu respuesta aquí... (Presioná Enter para enviar)"
                  className="flex-1 h-10 rounded-xl text-sm"
                  disabled={sending}
                />
                <Button
                  onClick={() => void handleSend()}
                  disabled={!newMessage.trim() || sending}
                  className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white font-bold gap-2 rounded-xl px-5"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <>Enviar <Send className="size-3.5" /></>}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={`w-72 border-l border-border/30 flex-col bg-muted/10 shrink-0 ${selectedConversation ? 'hidden lg:flex' : 'hidden'}`}>
        {selectedConversation && (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <User className="size-8 text-primary" />
              </div>
              <h4 className="text-sm font-black mt-3">{selectedConversation.contact?.name}</h4>
              {selectedConversation.contact?.phone && (
                <p className="text-xs text-primary mt-1">{selectedConversation.contact.phone}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                ID Cliente: #{selectedConversation.contact?.id?.slice(0, 4)}
              </p>
            </div>

            <div className="space-y-2">
              <Button variant="outline" className="w-full h-9 rounded-xl text-xs font-bold gap-2">
                <User className="size-3.5" /> Ver Perfil Completo
              </Button>
            </div>

            <div>
              <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Estado de Vinculación</h5>
              <div className="rounded-xl border border-border/30 p-3">
                <p className="text-xs font-bold">Vinculado a Inbox Central</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Todas las conversaciones de este contacto están unificadas.
                </p>
              </div>
            </div>

            <div>
              <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Funnel Conversacional</h5>
              <div className="rounded-xl border border-border/30 p-3">
                <p className="text-xs font-bold text-primary">Etapa: En Negociación</p>
              </div>
            </div>

            <div>
              <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Canal</h5>
              <div className="rounded-xl border border-border/30 p-3 flex items-center gap-2">
                {(() => {
                  const Icon = CHANNEL_ICONS[selectedConversation.channel?.type] || Hash;
                  const color = CHANNEL_COLORS[selectedConversation.channel?.type] || 'text-gray-500';
                  return <Icon className={`size-4 ${color}`} />;
                })()}
                <span className="text-xs font-bold">{selectedConversation.channel?.name}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
