import type { KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
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
export function SalesKpiCard({ title, value, icon: Icon, color, bg, onClick, active = false }: SalesKpiCardProps) {
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
        'relative overflow-hidden rounded-lg border-border/60 bg-card shadow-none transition-[border-color,background-color,transform]',
        interactive ? 'cursor-pointer hover:border-primary/50 hover:bg-muted/20' : 'cursor-default',
        active && 'border-primary ring-2 ring-primary/20',
      )}
    >
      <CardContent className="p-3.5">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-md p-2', bg, color)}>
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
