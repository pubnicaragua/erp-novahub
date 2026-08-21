import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from './badge';

export const importPreviewFieldClass = 'h-9 w-full min-w-0 rounded-lg border-border/70 bg-background/70 text-xs';

export function ImportPreviewField({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`min-w-0 space-y-1 ${className}`}>
      <span className="block truncate text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function ImportPreviewMobileCard({
  index,
  title,
  error,
  warning,
  children,
}: {
  index: number;
  title: string;
  error?: string;
  warning?: string;
  children: ReactNode;
}) {
  const status = error ? 'Error' : warning ? 'Aviso' : 'Correcto';
  const statusClass = error ? 'text-rose-600' : warning ? 'text-amber-600' : 'text-emerald-600';

  return (
    <article className={`min-w-0 rounded-2xl border p-3 shadow-sm ${error ? 'border-rose-500/35 bg-rose-500/[0.03]' : warning ? 'border-amber-500/35 bg-amber-500/[0.03]' : 'border-border/60 bg-card'}`}>
      <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex min-w-0 items-start gap-2">
          {error ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" aria-hidden="true" /> : warning ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />}
          <div className="min-w-0">
            <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Registro {index + 1}</p>
            <p className="mt-0.5 break-words text-sm font-black text-foreground">{title || 'Registro sin nombre'}</p>
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 border-none text-[9px] font-black uppercase ${statusClass}`}>{status}</Badge>
      </div>

      {children}

      <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-medium ${error ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300' : warning ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'}`}>
        <span className="mr-1 text-[9px] font-black uppercase tracking-[0.14em]">Validación:</span>{error || warning || 'Correcto'}
      </div>
    </article>
  );
}
