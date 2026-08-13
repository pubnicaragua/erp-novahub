import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Share2, ArrowRight, Network } from 'lucide-react';
import { cn } from '../ui/utils';

export interface ViewConnection {
  id: string;
  label: string;
  description: string;
  /**
   * Cómo se conecta esta vista con la actual (p.ej. "Alimenta", "Se alimenta de", "Valida").
   */
  relation: string;
  /**
   * Tipo de relación, para el color del badge.
   */
  direction?: 'feeds' | 'fed-by' | 'validates' | 'links';
}

interface ViewConnectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewLabel: string;
  description: string;
  connections: ViewConnection[];
  onGoTo: (sectionId: string) => void;
}

const DIRECTION_STYLES: Record<NonNullable<ViewConnection['direction']>, string> = {
  feeds: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'fed-by': 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  validates: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  links: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
};

/**
 * Diálogo que muestra a qué vistas contables está conectada la vista actual
 * (qué alimenta, de qué se alimenta, qué valida) y permite navegar a ellas.
 */
export function ViewConnectionsDialog({ open, onOpenChange, viewLabel, description, connections, onGoTo }: ViewConnectionsDialogProps) {
  const [visited, setVisited] = useState<Set<string>>(new Set());

  const handleGo = (connection: ViewConnection) => {
    setVisited((current) => new Set(current).add(connection.id));
    onGoTo(connection.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] !max-w-[min(96vw,720px)] overflow-hidden rounded-3xl border-primary/20 bg-background/95 p-0 shadow-2xl backdrop-blur-xl">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-br from-primary/[0.10] via-background to-indigo-500/[0.06] px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-3 text-lg font-black uppercase tracking-tight">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Network className="size-5" />
            </span>
            Conexiones · {viewLabel}
          </DialogTitle>
          <DialogDescription className="mt-1 max-w-3xl text-xs leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(92vh-140px)] space-y-2.5 overflow-y-auto px-6 py-5">
          {connections.length === 0 ? (
            <p className="py-8 text-center text-xs italic text-muted-foreground/60">
              Esta vista aún no tiene conexiones registradas con otras vistas.
            </p>
          ) : (
            connections.map((connection) => {
              const isVisited = visited.has(connection.id);
              return (
                <div
                  key={connection.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card/50 p-3.5 shadow-sm transition-colors hover:border-primary/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60">
                    <Share2 className="size-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black">{connection.label}</p>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', DIRECTION_STYLES[connection.direction || 'links'])}>
                        {connection.relation}
                      </span>
                      {isVisited && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary">Vista visitada</span>}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{connection.description}</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-xs" onClick={() => handleGo(connection)}>
                    Abrir vista <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border/60 bg-muted/20 px-6 py-4">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Estas son las vistas contables conectadas. Al abrir una conexión navegarás directo a esa vista
              con el filtro/contexto correspondiente.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="shrink-0">
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
