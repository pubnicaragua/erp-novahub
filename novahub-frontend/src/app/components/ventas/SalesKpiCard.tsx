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
export function SalesKpiCard({ title, value, icon: Icon, onClick, active = false }: SalesKpiCardProps) {
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
        'relative overflow-hidden rounded-[13px] border-border/60 bg-card shadow-[0_8px_25px_color-mix(in_srgb,var(--foreground)_3%,transparent)] transition-[border-color,box-shadow,transform] duration-200',
        interactive ? 'cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_13px_30px_color-mix(in_srgb,var(--primary)_8%,transparent)]' : 'cursor-default',
        active && 'border-primary ring-2 ring-primary/20',
      )}
    >
      <CardContent className="p-3.5">
        <div className="flex items-center gap-3">
          {/* Misma identidad que el dashboard («Resumen de gestión»): mosaico verde Nova intenso, ícono verde bosque y cifra en verde Nova, sin importar el color que pida cada vista. */}
          <div className="shrink-0 rounded-[10px] bg-[color-mix(in_srgb,var(--accent)_82%,var(--card))] p-2.5 text-primary">
            <Icon className="size-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="break-words text-[13px] font-semibold italic leading-tight text-muted-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{title}</p>
            <p className="text-xl font-extrabold tracking-tight text-accent tabular-nums">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
