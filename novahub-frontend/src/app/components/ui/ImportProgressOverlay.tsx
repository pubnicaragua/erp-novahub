import { Loader2 } from 'lucide-react';

interface ImportProgressOverlayProps {
  open: boolean;
  progress: number;
  title: string;
  description: string;
}

export function ImportProgressOverlay({ open, progress, title, description }: ImportProgressOverlayProps) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));

  if (!open) return null;

  return (
    <div className="nh-modal-root fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-label={title} aria-busy="true">
      <div className="nh-modal-surface w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative flex size-24 items-center justify-center rounded-full border-4 border-primary/25 bg-primary/5 shadow-inner">
            <div className="absolute inset-1 animate-spin rounded-full border-4 border-transparent border-t-primary" />
            <span className="relative z-10 inline-flex min-w-[4.5rem] items-center justify-center rounded-full border border-border/80 bg-background px-2.5 py-2 text-xl font-black tabular-nums text-primary shadow-md ring-4 ring-background/80">
              {safeProgress}%
            </span>
          </div>
          <div>
            <h2 className="flex items-center justify-center gap-2 text-xl font-semibold leading-none tracking-tight">
              <Loader2 className="size-4 animate-spin text-primary" />
              {title}
            </h2>
            <p className="mt-2 text-sm text-foreground/70">{description}</p>
          </div>
          <div className="w-full space-y-2">
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(safeProgress, 3)}%` }} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">No cierres esta ventana</p>
          </div>
        </div>
      </div>
    </div>
  );
}
