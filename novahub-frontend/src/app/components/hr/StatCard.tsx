import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../ui/utils';

export type StatTone = 'primary' | 'blue' | 'green' | 'orange' | 'red' | 'amber' | 'gray';

const TONE_STYLES: Record<StatTone, { chip: string; value: string; active: string }> = {
  primary: {
    chip: 'bg-primary/10 text-primary',
    value: 'text-primary',
    active: 'border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20',
  },
  blue: {
    chip: 'bg-info/10 text-info',
    value: 'text-info dark:text-info',
    active: 'border-info/50 bg-info/[0.03] ring-1 ring-info/20',
  },
  green: {
    chip: 'bg-success/10 text-success',
    value: 'text-success dark:text-success',
    active: 'border-success/50 bg-success/[0.03] ring-1 ring-success/20',
  },
  orange: {
    chip: 'bg-warning/10 text-warning',
    value: 'text-warning dark:text-warning',
    active: 'border-warning/50 bg-warning/[0.03] ring-1 ring-warning/20',
  },
  red: {
    chip: 'bg-destructive/10 text-destructive',
    value: 'text-destructive dark:text-destructive',
    active: 'border-destructive/50 bg-destructive/[0.03] ring-1 ring-destructive/20',
  },
  amber: {
    chip: 'bg-warning/10 text-warning',
    value: 'text-warning dark:text-warning',
    active: 'border-warning/50 bg-warning/[0.03] ring-1 ring-warning/20',
  },
  gray: {
    chip: 'bg-muted text-muted-foreground',
    value: 'text-foreground',
    active: 'border-foreground/40 bg-muted/20 ring-1 ring-foreground/10',
  },
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
  active?: boolean;
  onClick?: () => void;
  sub?: string;
  valueClassName?: string;
  className?: string;
  title?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  active,
  onClick,
  sub,
  valueClassName,
  className,
  title,
}: StatCardProps) {
  const styles = TONE_STYLES[tone];
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'group relative rounded-2xl border bg-card p-5 text-left shadow-sm transition-all',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        onClick && !active && 'hover:border-foreground/20',
        active ? styles.active : 'border-border/50',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn('p-3 rounded-xl shrink-0 transition-transform group-hover:scale-105', styles.chip)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
          <div className={cn('text-2xl font-black tabular-nums leading-tight truncate', styles.value, valueClassName)}>
            {value}
          </div>
          {sub && <p className="mt-0.5 text-[11px] font-medium text-muted-foreground truncate">{sub}</p>}
        </div>
      </div>
    </button>
  );
}
