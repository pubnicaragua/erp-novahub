import type { ReactNode, SelectHTMLAttributes } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { serifStyle } from './organizacion.utils';

export const controlClass = 'h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60';

export function Field({ label, htmlFor, required, hint, children, className }: {
  label: string; htmlFor?: string; required?: boolean; hint?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-[12px] font-semibold text-foreground">
        {label}{required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function NativeSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, 'appearance-auto pr-2', className)}>{children}</select>;
}

export function PageTitle({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-accent-foreground/80"><span className="text-primary">{eyebrow}</span></p>
        <h1 className="mt-1 text-4xl leading-tight text-primary dark:text-foreground" style={serifStyle}>{title}</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}><RefreshCw className="size-3.5" />Reintentar</Button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <p className="text-[14px] font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-[12px] text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function Panel({ title, icon, children, className, action }: { title: string; icon?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn('min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm', className)}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-foreground">
          {icon && <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-primary dark:text-accent">{icon}</span>}
          <span className="truncate">{title}</span>
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
