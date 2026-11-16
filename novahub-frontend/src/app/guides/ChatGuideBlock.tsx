import { ChevronRight, Lightbulb, MapPin } from 'lucide-react';
import { findGuide } from './catalog';
import type { ErpGuide } from './types';

interface ChatGuideBlockProps {
  guideIds: string[];
  mode: 'answer' | 'options' | 'related';
  hasAccess: (module: string) => boolean;
  onRun: (guide: ErpGuide) => void;
  onShow: (guide: ErpGuide) => void;
}

/** Respuesta de Nova cuando la pregunta es «cómo se hace»: pasos numerados y botón para guiar en pantalla. */
export function ChatGuideBlock({ guideIds, mode, hasAccess, onRun, onShow }: ChatGuideBlockProps) {
  const guides = guideIds.map((id) => findGuide(id)).filter((guide): guide is ErpGuide => Boolean(guide));
  if (!guides.length) return null;

  if (mode === 'options') {
    return (
      <div className="mt-2 space-y-1.5" data-testid="nova-guide-options">
        {guides.map((guide) => (
          <button key={guide.id} type="button" onClick={() => onShow(guide)} className="flex w-full items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-primary/10">
            <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{guide.area}</span>{guide.title}</span>
            <ChevronRight className="size-4 shrink-0 text-primary" />
          </button>
        ))}
      </div>
    );
  }

  if (mode === 'related') {
    return (
      <div className="mt-3 space-y-1.5 border-t border-border/50 pt-2.5" data-testid="nova-guide-related">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Guías paso a paso</p>
        {guides.filter((guide) => hasAccess(guide.module)).map((guide) => (
          <button key={guide.id} type="button" onClick={() => onRun(guide)} className="flex w-full items-center gap-2 rounded-lg border border-primary/25 px-2.5 py-1.5 text-left text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
            <MapPin className="size-3.5 shrink-0" /> <span className="min-w-0 flex-1">Guíame: {guide.title}</span>
          </button>
        ))}
      </div>
    );
  }

  const guide = guides[0];
  const allowed = hasAccess(guide.module);
  return (
    <div className="space-y-2.5" data-testid="nova-guide-answer">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{guide.area}</p>
        <p className="font-bold leading-snug">{guide.title}</p>
      </div>
      {guide.requires && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs leading-5 text-amber-800 dark:text-amber-200">{guide.requires}</p>}
      <ol className="space-y-2">
        {guide.steps.map((step, index) => (
          <li key={index} className="flex gap-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
            <span className="min-w-0 pt-0.5">
              {step.text}
              {step.tip && <span className="mt-1 flex gap-1.5 text-xs text-muted-foreground"><Lightbulb className="mt-0.5 size-3 shrink-0 text-amber-500" />{step.tip}</span>}
            </span>
          </li>
        ))}
      </ol>
      {allowed ? (
        <button type="button" onClick={() => onRun(guide)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          <MapPin className="size-4" /> Guíame en pantalla
        </button>
      ) : (
        <p className="rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">Tu usuario no tiene acceso a {guide.area}. Pide al administrador que te dé permiso.</p>
      )}
    </div>
  );
}
