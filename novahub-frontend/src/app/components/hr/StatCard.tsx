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
    chip: 'bg-blue-500/10 text-blue-500',
    value: 'text-blue-600 dark:text-blue-400',
    active: 'border-blue-500/50 bg-blue-500/[0.03] ring-1 ring-blue-500/20',
  },
  green: {
    chip: 'bg-emerald-500/10 text-emerald-500',
    value: 'text-emerald-600 dark:text-emerald-400',
    active: 'border-emerald-500/50 bg-emerald-500/[0.03] ring-1 ring-emerald-500/20',
  },
  orange: {
    chip: 'bg-orange-500/10 text-orange-500',
    value: 'text-orange-600 dark:text-orange-400',
    active: 'border-orange-500/50 bg-orange-500/[0.03] ring-1 ring-orange-500/20',
  },
  red: {
    chip: 'bg-rose-500/10 text-rose-500',
    value: 'text-rose-600 dark:text-rose-400',
    active: 'border-rose-500/50 bg-rose-500/[0.03] ring-1 ring-rose-500/20',
  },
  amber: {
    chip: 'bg-amber-500/10 text-amber-500',
    value: 'text-amber-600 dark:text-amber-400',
    active: 'border-amber-500/50 bg-amber-500/[0.03] ring-1 ring-amber-500/20',
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
