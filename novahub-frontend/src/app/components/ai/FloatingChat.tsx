import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { aiService, type ChatGuide } from '../../services/ai.service';
import { trainingService } from '../../services/training.service';
import { safeSetItem } from '../../services/safe-storage';

const HISTORY_KEY = 'erp-ai-chat-history';

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
}

const WELCOME_MESSAGE =
  '¡Hola! Soy tu asistente de capacitación. Pregúntame cómo hacer algo en NovaHub, por ejemplo: ¿cómo creo una factura? o ¿cómo configuro las cuentas contables?';

const SUGGESTIONS = [
  '¿Cómo emito una factura?',
  '¿Cómo cierro caja?',
  '¿Qué es el Balance General?',
];

function makeId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'bot'))
      .map((m) => ({ id: m.id || makeId(), role: m.role, content: m.content }));
  } catch {
    return [];
  }
}

function buildGuides(videos: any[]): ChatGuide[] {
  if (!Array.isArray(videos)) return [];
  return videos
    .filter((v) => v && v.title)
    .map((v) => ({
      title: String(v.title),
      module: v.module ? String(v.module) : 'General',
      description: v.description ? String(v.description) : '',
    }));
}

export function FloatingChat() {
  const { user } = useAuth();
  const userName = user?.name || user?.email || '';
  const greeting = userName
    ? `¡Hola, ${userName.split(' ')[0]}! Soy tu asistente de capacitación. Pregúntame cómo hacer algo en NovaHub, por ejemplo: ¿cómo creo una factura? o ¿cómo configuro las cuentas contables?`
    : WELCOME_MESSAGE;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const history = loadHistory();
    if (history.length > 0) return history;
    return [{ id: makeId(), role: 'bot', content: greeting }];
  });
  const [typing, setTyping] = useState(false);
  const [guidesLoaded, setGuidesLoaded] = useState(false);
  const guidesRef = useRef<ChatGuide[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persistir historial por sesión
  useEffect(() => {
    try {
      safeSetItem(HISTORY_KEY, JSON.stringify(messages.slice(-60)));
    } catch {
      // localStorage puede fallar en modos estrictos; el chat sigue funcionando.
    }
  }, [messages]);

  // Scroll automático al final
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, open]);

  // Cargar las guías de video del Centro de Capacitación como contexto
  const loadGuides = useCallback(async () => {
    if (guidesLoaded) return;
    try {
      const res = (await trainingService.getVideos(undefined, undefined)) as any;
      const videos = Array.isArray(res) ? res : res?.data;
      const built = buildGuides(videos);
      guidesRef.current = built;
    } catch {
      // Si no se pueden cargar las guías, el chat responde con la base de conocimientos.
    } finally {
      setGuidesLoaded(true);
    }
  }, [guidesLoaded]);

  const sendMessage = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || typing) return;

      const userMsg: ChatMessage = { id: makeId(), role: 'user', content };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setTyping(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await loadGuides();
        const currentGuides = guidesRef.current;
        const res = await aiService.chat(content, { guides: currentGuides.length ? currentGuides : undefined }, controller.signal);
        if (controller.signal.aborted) return;
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: 'bot', content: res.reply },
        ]);
      } catch (error: any) {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        const fallback = error?.message || 'Lo siento, tuve un problema al responder. Inténtalo de nuevo.';
        setMessages((prev) => [...prev, { id: makeId(), role: 'bot', content: fallback }]);
        toast.error('No se pudo conectar con el asistente');
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        if (!controller.signal.aborted) setTyping(false);
      }
    },
    [typing, loadGuides],
  );

  // Abrir el chat desde cualquier parte del ERP (evento global)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setOpen(true);
      if (detail?.message) {
        setInput(String(detail.message));
        window.setTimeout(() => {
          if (inputRef.current) inputRef.current.focus();
        }, 100);
      }
    };
    window.addEventListener('open-erp-chat', handler);
    return () => window.removeEventListener('open-erp-chat', handler);
  }, []);

  // Auto-focus al abrir
  useEffect(() => {
    if (open) {
      loadGuides();
      window.setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 120);
    }
  }, [open, loadGuides]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Botón flotante */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group fixed right-4 bottom-6 z-50 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-600 text-primary-foreground shadow-2xl shadow-primary/40 ring-4 ring-primary/15 transition-all hover:scale-110 hover:shadow-primary/60 active:scale-95"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente de capacitación'}
        title={open ? 'Cerrar asistente' : 'Asistente NovaHub'}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="size-6" />
            </motion.span>
          ) : (
            <motion.span
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle className="size-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Panel de chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed right-4 bottom-24 z-50 flex h-[70vh] max-h-[620px] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-border/60 bg-background shadow-2xl shadow-black/40"
          >
            {/* Header */}
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-primary via-primary to-emerald-600 p-4 text-primary-foreground">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_55%)]" />
              <div className="relative flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/25">
                  <Bot className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-black uppercase tracking-wider">Asistente NovaHub</h3>
                  <p className="truncate text-[11px] font-medium text-primary-foreground/75">
                    Basado en las guías del ERP
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-primary-foreground/90 transition-colors hover:bg-white/25"
                  aria-label="Cerrar chat"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Mensajes */}
            <div ref={scrollRef} className="scrollbar-overlay flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn('flex w-full', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                      msg.role === 'user'
                        ? 'rounded-br-md bg-primary text-primary-foreground'
                        : 'rounded-bl-md border border-border/50 bg-background text-foreground',
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {typing && (
                <div className="flex w-full justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border/50 bg-background px-4 py-3 shadow-sm">
                    <span className="size-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-primary/70" />
                  </div>
                </div>
              )}
            </div>

            {/* Sugerencias rápidas */}
            {messages.length <= 1 && !typing && (
              <div className="shrink-0 space-y-1.5 border-t border-border/40 px-3 pt-2.5 pb-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="flex w-full items-center gap-2 rounded-xl border border-border/40 bg-muted/40 px-3 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <Sparkles className="size-3.5 shrink-0 text-primary/70" />
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex shrink-0 items-center gap-2 border-t border-border/40 bg-background p-3">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu pregunta..."
                className="h-11 rounded-2xl border-border/50 bg-muted/30 focus:bg-background"
                disabled={typing}
              />
              <Button
                type="button"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || typing}
                className="size-11 shrink-0 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground shadow-lg shadow-primary/30 hover:from-primary/90 hover:to-emerald-600/90"
                aria-label="Enviar mensaje"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
