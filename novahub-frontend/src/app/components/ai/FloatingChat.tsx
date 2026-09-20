import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Send, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import { NovaHubLogo } from '../NovaHubLogo';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { aiService, type ChatGuide } from '../../services/ai.service';
import { trainingService } from '../../services/training.service';
import { safeGetItem, safeSetItem } from '../../services/safe-storage';

const HISTORY_KEY = 'erp-nova-ai-chat-history';
const CONVERSATION_KEY = 'erp-nova-ai-conversation';

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
}

interface DashboardContext {
  source?: string;
  periodFrom?: string;
  periodTo?: string;
}

const WELCOME_MESSAGE = 'Hola. Soy Nova AI, tu asistente empresarial. Puedo revisar ventas, inventario, cartera, caja, clientes y cotizaciones con los datos autorizados de tu empresa.';
const SUGGESTIONS = [
  '¿Cómo va mi negocio hoy?',
  '¿Qué necesita mi atención?',
  '¿Qué productos debería revisar?',
  '¿Quién me debe?',
  '¿Qué clientes dejaron de comprar?',
  '¿Qué producto genera más utilidad?',
];
const ACTIVITY_STEPS = ['Consultando tus datos…', 'Revisando ventas e inventario…', 'Preparando el resumen…'];

function makeId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function scopedKey(base: string, userId?: string, tenantId?: string) {
  return `${base}.${tenantId || 'current'}.${userId || 'user'}`;
}

function loadHistory(key: string): ChatMessage[] {
  try {
    const raw = safeGetItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((message) => message && typeof message.content === 'string' && (message.role === 'user' || message.role === 'bot')).map((message) => ({ id: message.id || makeId(), role: message.role, content: message.content }));
  } catch { return []; }
}

function buildGuides(videos: any[]): ChatGuide[] {
  if (!Array.isArray(videos)) return [];
  return videos.filter((video) => video && video.title).slice(0, 8).map((video) => ({ title: String(video.title), module: video.module ? String(video.module) : 'General', description: video.description ? String(video.description).slice(0, 180) : '' }));
}

function needsGuidesFor(content: string) {
  return /(cómo|como|dónde|donde|configur|registr|usar|módulo|modulo|manual|ayuda)/i.test(content);
}

export function FloatingChat() {
  const { user } = useAuth();
  const userId = user?.id || user?.email;
  const tenantId = user?.clientTenantId || user?.tenantId;
  const historyKey = useMemo(() => scopedKey(HISTORY_KEY, userId, tenantId), [tenantId, userId]);
  const conversationStorageKey = useMemo(() => scopedKey(CONVERSATION_KEY, userId, tenantId), [tenantId, userId]);
  const userName = user?.name || user?.email || '';
  const greeting = userName ? `Hola, ${userName.split(' ')[0]}. Soy Nova AI, tu asistente empresarial. Puedo revisar los datos autorizados de tu empresa y ayudarte a decidir qué atender primero.` : WELCOME_MESSAGE;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const history = loadHistory(historyKey);
    return history.length ? history : [{ id: makeId(), role: 'bot', content: greeting }];
  });
  const [typing, setTyping] = useState(false);
  const [activityIndex, setActivityIndex] = useState(0);
  const [guidesLoaded, setGuidesLoaded] = useState(false);
  const [conversationId, setConversationId] = useState(() => safeGetItem(conversationStorageKey) || undefined);
  const [dashboardContext, setDashboardContext] = useState<DashboardContext | undefined>();
  const guidesRef = useRef<ChatGuide[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const history = loadHistory(historyKey);
      setMessages(history.length ? history : [{ id: makeId(), role: 'bot', content: greeting }]);
      setConversationId(safeGetItem(conversationStorageKey) || undefined);
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [conversationStorageKey, greeting, historyKey]);
  useEffect(() => { try { safeSetItem(historyKey, JSON.stringify(messages.slice(-60))); } catch { /* el chat sigue funcionando */ } }, [historyKey, messages]);
  useEffect(() => { if (!typing) return undefined; const timer = window.setInterval(() => setActivityIndex((current) => (current + 1) % ACTIVITY_STEPS.length), 1300); return () => window.clearInterval(timer); }, [typing]);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, typing, open]);

  const loadGuides = useCallback(async () => {
    if (guidesLoaded) return;
    try {
      const res = (await trainingService.getVideos(undefined, undefined)) as any;
      guidesRef.current = buildGuides(Array.isArray(res) ? res : res?.data);
    } catch { /* las herramientas de negocio no dependen de las guías */ } finally { setGuidesLoaded(true); }
  }, [guidesLoaded]);

  const sendMessage = useCallback(async (raw: string) => {
    const content = raw.trim();
    if (!content || typing) return;
    const contextForMessage = dashboardContext;
    const userMessage: ChatMessage = { id: makeId(), role: 'user', content };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setDashboardContext(undefined);
    setTyping(true);
    setActivityIndex(0);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (needsGuidesFor(content)) await loadGuides();
      const response = await aiService.chat(content, { conversationId, dashboardContext: contextForMessage, guides: needsGuidesFor(content) && guidesRef.current.length ? guidesRef.current : undefined }, controller.signal);
      if (controller.signal.aborted) return;
      if (response.conversationId) { setConversationId(response.conversationId); safeSetItem(conversationStorageKey, response.conversationId); }
      setMessages((current) => [...current, { id: makeId(), role: 'bot', content: response.reply }]);
    } catch (error: any) {
      if (controller.signal.aborted || error?.name === 'AbortError') return;
      const fallback = error?.message || 'No pude consultar Nova AI en este momento. Inténtalo de nuevo.';
      setMessages((current) => [...current, { id: makeId(), role: 'bot', content: fallback }]);
      toast.error('No se pudo completar la consulta');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (!controller.signal.aborted) setTyping(false);
    }
  }, [conversationId, conversationStorageKey, dashboardContext, loadGuides, typing]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setOpen(true);
      if (detail?.context) setDashboardContext(detail.context as DashboardContext);
      if (detail?.message) { setInput(String(detail.message)); window.setTimeout(() => inputRef.current?.focus(), 100); }
    };
    window.addEventListener('open-erp-chat', handler);
    return () => window.removeEventListener('open-erp-chat', handler);
  }, []);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 120); }, [open]);

  return <>
    <motion.button type="button" onClick={() => setOpen((value) => !value)} className="group fixed bottom-4 right-3 z-50 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-600 text-primary-foreground shadow-2xl shadow-primary/40 ring-4 ring-primary/15 transition-[transform,box-shadow] hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-95 sm:bottom-6 sm:right-4 sm:size-12" initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} aria-label={open ? 'Cerrar Nova AI' : 'Abrir Nova AI'} title="Preguntar a Nova">
      <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-background bg-emerald-300" />
      <AnimatePresence mode="wait" initial={false}>{open ? <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X className="size-4.5 sm:size-5" /></motion.span> : <motion.span key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><NovaHubLogo size={25} className="rounded-full bg-white p-1" /></motion.span>}</AnimatePresence>
    </motion.button>
    <AnimatePresence>{open && <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} className="fixed right-4 bottom-24 z-50 flex h-[70vh] max-h-[640px] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-border/60 bg-background shadow-2xl shadow-black/40">
      <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-primary via-primary to-emerald-600 p-4 text-primary-foreground"><div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_55%)]" /><div className="relative flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-white p-1.5 ring-1 ring-white/40"><NovaHubLogo size={28} className="rounded-full" /></div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black uppercase tracking-wider">Nova AI</h3><p className="truncate text-[11px] font-medium text-primary-foreground/75">Asistente empresarial con tus datos</p></div><button type="button" onClick={() => setOpen(false)} className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-primary-foreground/90 transition-colors hover:bg-white/25" aria-label="Cerrar chat"><X className="size-4" /></button></div></div>
      <div ref={scrollRef} className="scrollbar-overlay flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">{messages.map((message) => <div key={message.id} className={cn('flex w-full', message.role === 'user' ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm', message.role === 'user' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border border-border/50 bg-background text-foreground')}>{message.content}</div></div>)}{typing && <div className="flex w-full justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border/50 bg-background px-4 py-3 text-xs text-muted-foreground shadow-sm"><span className="size-1.5 animate-pulse rounded-full bg-primary" /><span>{ACTIVITY_STEPS[activityIndex]}</span></div></div>}</div>
      {messages.length <= 1 && !typing && <div className="shrink-0 space-y-1.5 border-t border-border/40 px-3 pt-2.5 pb-1.5"><p className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pregúntale a Nova</p>{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => void sendMessage(suggestion)} className="flex w-full items-center gap-2 rounded-xl border border-border/40 bg-muted/40 px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"><NovaHubLogo size={14} className="shrink-0 rounded-full" />{suggestion}</button>)}</div>}
      <div className="flex shrink-0 items-center gap-2 border-t border-border/40 bg-background p-3"><Input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void sendMessage(input); } }} placeholder="Pregunta por tus datos…" className="h-11 rounded-2xl border-border/50 bg-muted/30 focus:bg-background" disabled={typing} /><Button type="button" onClick={() => void sendMessage(input)} disabled={!input.trim() || typing} className="size-11 shrink-0 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground shadow-lg shadow-primary/30" aria-label="Enviar pregunta"><Send className="size-4" /></Button></div>
    </motion.div>}</AnimatePresence>
  </>;
}
