import type { ReactNode } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

interface HRCreateViewShellProps {
  title: string;
  description: string;
  onBack: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Presentación común para altas de RR. HH. que necesitan una vista completa.
 * Mantiene la misma jerarquía que los editores de Ventas sin convertir el
 * formulario en una tarjeta comprimida dentro del listado.
 */
export function HRCreateViewShell({ title, description, onBack, children, className }: HRCreateViewShellProps) {
  return (
    <section className={cn('min-w-0 space-y-5', className)} aria-labelledby="hr-create-view-title">
      <div className="flex min-w-0 flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onBack}
            className="mt-0.5 size-9 shrink-0 rounded-xl"
            aria-label="Volver al listado de Recursos Humanos"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              <Plus className="size-3.5" /> Recursos Humanos
            </p>
            <h2 id="hr-create-view-title" className="truncate text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={onBack} className="h-10 shrink-0 rounded-xl">
          Cancelar
        </Button>
      </div>
      <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
        {children}
      </div>
    </section>
  );
}
