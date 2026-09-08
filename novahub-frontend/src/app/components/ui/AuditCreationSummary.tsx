import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, UserRound } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '../../services/api';
import { Card } from './card';
import { Skeleton } from './skeleton';

interface AuditCreationSummaryProps {
  entity: string;
  entityId: string;
  createdAt?: string | Date | null;
  logs?: any[];
}

const normalizeLogs = (value: any): any[] => {
  const candidate = value?.data?.data ?? value?.data ?? value;
  return Array.isArray(candidate) ? candidate : [];
};

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export function AuditCreationSummary({ entity, entityId, createdAt, logs: providedLogs }: AuditCreationSummaryProps) {
  const [logs, setLogs] = useState<any[]>(providedLogs || []);
  const [loading, setLoading] = useState(providedLogs === undefined);

  useEffect(() => {
    let cancelled = false;

    if (providedLogs !== undefined) {
      setLogs(normalizeLogs(providedLogs));
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    api.get<any[]>(`/audit/entity/${entity}/${entityId}`)
      .then((response) => {
        if (!cancelled) setLogs(normalizeLogs(response));
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [entity, entityId, providedLogs]);

  const creation = useMemo(() => logs
    .filter((log) => String(log?.action || '').toUpperCase() === 'CREATE')
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())[0], [logs]);

  const date = parseDate(creation?.createdAt || createdAt);
  const actor = creation
    ? (creation.user?.name || (creation.userId ? 'Usuario no disponible' : 'Sistema automático'))
    : 'Usuario no disponible';

  if (loading) {
    return <Card className="space-y-3 rounded-2xl border-border/50 p-4"><Skeleton className="h-3 w-32" /><Skeleton className="h-10 w-full" /></Card>;
  }

  return (
    <Card className="rounded-2xl border-border/50 bg-card/70 p-4">
      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Auditoría de creación</p>
      <div className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="flex min-w-0 items-start gap-2">
          <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0"><p className="text-[10px] text-muted-foreground">Creado por</p><p className="mt-1 break-words font-semibold">{actor}</p></div>
        </div>
        <div className="flex min-w-0 items-start gap-2">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0"><p className="text-[10px] text-muted-foreground">Fecha de creación</p><p className="mt-1 font-semibold">{date ? format(date, 'dd MMM yyyy', { locale: es }) : 'No disponible'}</p></div>
        </div>
        <div className="flex min-w-0 items-start gap-2">
          <Clock3 className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0"><p className="text-[10px] text-muted-foreground">Hora de creación</p><p className="mt-1 font-semibold">{date ? format(date, 'HH:mm:ss') : 'No disponible'}</p></div>
        </div>
      </div>
      {!creation && <p className="mt-3 text-xs text-muted-foreground">No existe un evento CREATE histórico para este registro; se muestra la fecha del registro cuando está disponible.</p>}
    </Card>
  );
}
