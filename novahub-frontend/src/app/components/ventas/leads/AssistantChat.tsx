import { useEffect, useRef, useState } from 'react';
import { Bot, Copy, Send, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { businessLeadsService, type AssistantMessage } from '../../../services/business-leads.service';
import { failure } from './leadUtils';

const LEAD_SUGGESTIONS = ['¿Qué le ofrezco?', 'Redáctame un mensaje de WhatsApp para este cliente', '¿Qué pregunta le hago para saber su presupuesto?', 'Dijo que no: ¿cómo le vuelvo a escribir?'];
const GENERAL_SUGGESTIONS = ['¿Por dónde empiezo hoy?', 'Dame 5 ideas de a quién escribirle esta semana', 'Redáctame un primer mensaje para un negocio sin página web', '¿Cómo le hablo a un cliente que ya tiene sistema?'];

const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); toast.success('Copiado'); } catch { toast.error('El navegador no permitió copiar el texto. Selecciónalo y cópialo manualmente.'); } };

/** Chat con el asistente de prospección. Con `leadId` conoce el lead (presupuesto, ofertas, bitácora); sin él, ayuda a planear el día. Recuerda lo conversado. */
export function AssistantChat({ leadId, className }: { leadId?: string | null; className?: string }) {
  const client = useQueryClient();
  const history = useTenantQuery(['sales', 'business-leads-assistant', leadId ?? 'general'], (signal) => businessLeadsService.assistantHistory(leadId, signal), { staleTime: 0 });
  const [local, setLocal] = useState<AssistantMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement | null>(null);
  const localId = useRef(0);
  const messages = [...(history.data ?? []), ...local.filter((item) => !(history.data ?? []).some((saved) => saved.id === item.id))];
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [messages.length, busy]);

  const send = async (value: string) => {
    const message = value.trim();
    if (!message || busy) return;
    setBusy(true); setText('');
    localId.current += 1;
    const mine: AssistantMessage = { id: `local-${localId.current}`, role: 'USER', content: message, createdAt: '' };
    setLocal((current) => [...current, mine]);
    try {
      const answer = await businessLeadsService.assistantChat(message, leadId);
      setLocal([]);
      await client.invalidateQueries({ queryKey: ['tenant-module'] });
      void answer;
    } catch (error) { toast.error(failure(error)); setLocal((current) => current.filter((item) => item.id !== mine.id)); setText(message); } finally { setBusy(false); }
  };
  const clear = async () => {
    try { await businessLeadsService.assistantClear(leadId); setLocal([]); await client.invalidateQueries({ queryKey: ['tenant-module'] }); toast.success('Conversación borrada'); } catch (error) { toast.error(failure(error)); }
  };

  return (
    <section className={cn('space-y-3', className)} aria-label="Asistente de prospección">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 nh-section-title"><Bot className="size-4 text-primary" aria-hidden /> {leadId ? 'Pregúntale al asistente sobre este lead' : 'Asistente de prospección'}</h3>
        {messages.length > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => void clear()}><Trash2 className="mr-1 size-3.5" />Borrar conversación</Button>}
      </div>
      <p className="text-xs text-muted-foreground">{leadId ? 'Conoce el presupuesto, lo que ya se le ofreció y la bitácora de este lead.' : 'Conoce tu catálogo, tu meta de hoy y tu cliente ideal.'} No inventa datos; si algo le falta, te lo pregunta. Recuerda lo que conversaron.</p>
      <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3" role="log" aria-live="polite" aria-label="Conversación">
        {history.isLoading ? <Skeleton className="h-16 w-full" aria-busy="true" />
          : messages.length === 0 ? <p className="text-xs text-muted-foreground">Aún no hay conversación. Elige una pregunta o escribe la tuya.</p>
          : messages.map((message) => (
            <div key={message.id} className={cn('flex', message.role === 'USER' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm', message.role === 'USER' ? 'bg-primary text-primary-foreground' : 'border border-border/60 bg-card')}>
                {message.content}
                {message.role === 'ASSISTANT' && <button type="button" className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-primary underline" onClick={() => void copy(message.content)}><Copy className="size-3" aria-hidden />Copiar</button>}
              </div>
            </div>
          ))}
        {busy && <p className="text-xs text-muted-foreground" aria-busy="true">Pensando…</p>}
        <div ref={end} />
      </div>
      <div className="flex flex-wrap gap-1.5">{(leadId ? LEAD_SUGGESTIONS : GENERAL_SUGGESTIONS).map((suggestion) => <button key={suggestion} type="button" disabled={busy} onClick={() => void send(suggestion)} className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50">{suggestion}</button>)}</div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <textarea aria-label="Tu pregunta" rows={2} maxLength={2000} className="min-h-[44px] flex-1 resize-y rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text); } }} placeholder="Escribe tu pregunta (Enter para enviar)" />
        <Button type="submit" disabled={busy || !text.trim()} aria-label="Enviar"><Send className="size-4" /></Button>
      </form>
    </section>
  );
}
