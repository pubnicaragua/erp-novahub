import { ChevronDown, History } from 'lucide-react';
import { AuditCreationSummary } from './AuditCreationSummary';

interface AuditHistoryDisclosureProps {
  entity: string;
  entityId: string;
  createdAt?: string | Date | null;
  logs?: any[];
}

/**
 * Trazabilidad secundaria para paneles que no tienen una pestaña de historial.
 * Permanece cerrada para que la auditoría no compita con la información principal.
 */
export function AuditHistoryDisclosure({ entity, entityId, createdAt, logs }: AuditHistoryDisclosureProps) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-border/50 bg-card/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <History className="size-4 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block text-xs font-black uppercase tracking-widest text-muted-foreground">Historial del registro</span>
            <span className="mt-1 block text-[11px] text-muted-foreground">Consulta quién lo creó y cuándo se registró.</span>
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/40 p-4">
        <AuditCreationSummary entity={entity} entityId={entityId} createdAt={createdAt} logs={logs} />
      </div>
    </details>
  );
}
