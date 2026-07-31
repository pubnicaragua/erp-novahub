import type { KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, Filter } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { cn } from '../ui/utils';

interface SalesKpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
  onClick?: () => void;
  active?: boolean;
  kind?: 'filter' | 'indicator';
}

/** KPI consistente para Ventas: deja claro qué tarjetas filtran y cuáles solo informan. */
export function SalesKpiCard({ title, value, icon: Icon, color, bg, onClick, active = false, kind = onClick ? 'filter' : 'indicator' }: SalesKpiCardProps) {
  const interactive = Boolean(onClick);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (interactive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <Card
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? active : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative overflow-hidden rounded-2xl border-border/50 bg-card shadow-sm transition-all',
        interactive ? 'cursor-pointer hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md' : 'cursor-default',
        active && 'border-primary ring-2 ring-primary/20',
      )}
    >
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest',
            kind === 'filter' ? 'border-primary/20 bg-primary/5 text-primary' : 'border-border/60 bg-muted/30 text-muted-foreground',
          )}>
            {kind === 'filter' ? <Filter className="size-3" /> : <BarChart3 className="size-3" />}
            {kind === 'filter' ? 'Filtro' : 'Indicador'}
          </span>
          {active && <span className="text-[9px] font-black uppercase tracking-widest text-primary">Activo</span>}
        </div>
        <div className="flex items-center gap-4">
          <div className={cn('rounded-xl p-3 shadow-inner', bg, color)}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{title}</p>
            <p className="text-2xl font-black tracking-tighter text-foreground tabular-nums">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
