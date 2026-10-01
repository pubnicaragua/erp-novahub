import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { evaluateActivitySla } from './actividades.sla';
import type { SlaStatus } from '../../types';

export interface SlaBadgeProps {
  /** Fecha de vencimiento del SLA (ISO). Sin ella no hay semáforo. */
  slaDueAt?: string | null;
  /** Estado de la actividad. COMPLETED/CANCELLED anula el semáforo. */
  status?: string | null;
  /** Muestra el texto del estado ("En tiempo", "Por vencer", "Vencida"). */
  showLabel?: boolean;
  /** Añade el tiempo restante legible ("2h 15m", "Vencida hace 3d"). */
  showRemaining?: boolean;
  className?: string;
  title?: string;
  /** Reloj controlado por el padre; por defecto se usa el reloj actual. */
  now?: Date;
}

const TONE_BY_STATUS: Record<SlaStatus, { dot: string; badge: string }> = {
  ON_TIME: { dot: 'bg-success', badge: 'border-success/30 bg-success/10 text-success' },
  AT_RISK: { dot: 'bg-amber-500', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  BREACHED: { dot: 'bg-destructive', badge: 'border-destructive/30 bg-destructive/10 text-destructive' },
  NONE: { dot: 'bg-muted-foreground/40', badge: 'border-border/50 bg-muted/40 text-muted-foreground' },
};

const FALLBACK_LABELS: Record<SlaStatus, string> = {
  ON_TIME: 'En tiempo',
  AT_RISK: 'Por vencer',
  BREACHED: 'Vencida',
  NONE: 'Sin SLA',
};

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** "2h 15m", "3d 4h", "45m", "menos de 1m" para duraciones. */
const formatDuration = (ms: number): string => {
  const total = Math.floor(Math.abs(ms));
  if (total < MINUTE) return 'menos de 1m';
  const days = Math.floor(total / DAY);
  const hours = Math.floor((total % DAY) / HOUR);
  const minutes = Math.floor((total % HOUR) / MINUTE);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
};

const formatRemaining = (status: SlaStatus, remainingMs: number | null): string => {
  if (remainingMs === null) return '';
  if (status === 'BREACHED') return `Vencida hace ${formatDuration(remainingMs)}`;
  return formatDuration(remainingMs);
};

export const SlaBadge: React.FC<SlaBadgeProps> = ({
  slaDueAt,
  status,
  showLabel = true,
  showRemaining = false,
  className,
  title,
  now,
}) => {
  const evaluation = evaluateActivitySla({ slaDueAt, status }, now);
  const slaStatus = evaluation?.status ?? 'NONE';

  // §5: sin SLA (o tarea completada/cancelada) no hay semáforo que mostrar.
  if (slaStatus === 'NONE') return null;

  const tone = TONE_BY_STATUS[slaStatus];
  const label = evaluation.label || FALLBACK_LABELS[slaStatus];
  const remaining = showRemaining ? formatRemaining(slaStatus, evaluation.remainingMs ?? null) : '';
  const dueLabel = evaluation.dueAt
    ? new Date(evaluation.dueAt).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  const accessibleTitle = [title || `SLA: ${label}`, remaining, dueLabel].filter(Boolean).join(' · ');

  return (
    <Badge
      variant="outline"
      data-testid={`sla-badge-${slaStatus.toLowerCase()}`}
      title={accessibleTitle}
      className={cn('min-w-0 max-w-full gap-1.5 px-2 py-0.5 text-[10px] font-black uppercase', tone.badge, className)}
    >
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', tone.dot)} />
      {showLabel && <span className="min-w-0 truncate">{label}</span>}
      {remaining && <span className="min-w-0 truncate font-bold normal-case tabular-nums">{remaining}</span>}
      <span className="sr-only">{accessibleTitle}</span>
    </Badge>
  );
};

export default SlaBadge;
