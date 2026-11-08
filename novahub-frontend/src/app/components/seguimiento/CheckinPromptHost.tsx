import { useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { performanceService } from '../../services/performance.service';
import { CheckinResponseForm } from './CheckinResponseForm';
import { useMinuteTicker } from './useMinuteTicker';
import { dueLabel } from './seguimiento.utils';

/** Cada cuánto se pregunta al servidor si hay una pregunta pendiente (solo con la pestaña a la vista). */
const POLL_MS = 60_000;

/**
 * Pregunta por hora pendiente, a la vista donde sea que esté la persona: abre un cuadro para responder y, si lo cierra, deja una
 * etiqueta flotante hasta que responda (las respuestas son obligatorias). También llega por notificación al celular.
 */
export function CheckinPromptHost() {
  const { user } = useAuth();
  const client = useQueryClient();
  const now = useMinuteTicker();
  const eligible = Boolean(user && user.userType !== 'customer_portal' && !user.isPlatformSupportAgent);
  const pending = useTenantQuery(['performance', 'checkins-pending'], (signal) => performanceService.getPendingCheckins(signal), {
    enabled: eligible, refetchInterval: POLL_MS, refetchIntervalInBackground: false, refetchOnWindowFocus: true, staleTime: 20_000, retry: false,
  });
  const first = pending.data?.prompts[0];
  // Una pregunta nueva abre el cuadro; si la persona lo cierra, esa pregunta queda como etiqueta flotante hasta que responda.
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const open = Boolean(first) && first?.id !== dismissedId;
  const setOpen = (value: boolean) => setDismissedId(value ? null : first?.id ?? null);

  if (!eligible || !first || !pending.data) return null;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const count = pending.data.prompts.length;
  const done = () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="fixed bottom-4 left-1/2 z-[8000] flex w-max max-w-[calc(100vw-5.5rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-primary/30 bg-background/95 px-4 py-2 text-left text-[12px] font-semibold shadow-2xl backdrop-blur-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:bottom-6"
        aria-label="Abrir la pregunta pendiente">
        <MessageSquareText className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0"><span className="block">{count === 1 ? 'Tienes una pregunta por responder' : `Tienes ${count} preguntas por responder`}</span><span className="block text-[11px] font-normal text-muted-foreground">{dueLabel(first, now)}</span></span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>¿En qué estás trabajando?</DialogTitle>
            <DialogDescription>Tu supervisor verá tu respuesta en la línea de tiempo del día. Es obligatoria y solo te toma unos segundos.</DialogDescription>
          </DialogHeader>
          <CheckinResponseForm key={first.id} prompt={first} tasks={pending.data.tasks} timeZone={timeZone} onDone={done} />
          {count > 1 && <p className="text-[11px] text-muted-foreground">Después de esta tienes {count - 1} pregunta{count - 1 === 1 ? '' : 's'} más.</p>}
          <div className="flex justify-start"><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Responder en un momento</Button></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
