import type { KeyboardEvent, ReactNode } from 'react';
import { Activity, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { cn } from '../ui/utils';

export interface SalesKpiCardProps {
  title: string;
  value: ReactNode;
  icon?: LucideIcon;
  /** Se conservan por compatibilidad: la identidad visual es única y no depende del color que pida cada vista. */
  color?: string;
  bg?: string;
  onClick?: () => void;
  active?: boolean;
  kind?: 'filter' | 'indicator';
  /** Texto de apoyo bajo la cifra (rango, comparación, aclaración). */
  sub?: ReactNode;
  /** Solo para alertas reales: cifra en rojo (negativo) o ámbar (atención). Por defecto, verde Nova. */
  tone?: 'default' | 'good' | 'bad' | 'warn';
  hint?: string;
  className?: string;
}

/**
 * Tarjeta KPI única del sistema (Ventas, Compras, Inventario, RR. HH., Finanzas, Proyectos, Leads…).
 * Misma identidad que el «Resumen de gestión» del dashboard: mosaico verde Nova, etiqueta en Playfair cursiva
 * y cifra en verde Nova. Deja claro qué tarjetas filtran (clic) y cuáles solo informan.
 */
export function SalesKpiCard({ title, value, icon: Icon = Activity, onClick, active = false, sub, tone = 'default', hint, className }: SalesKpiCardProps) {
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
      title={hint}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative min-w-0 overflow-hidden rounded-[13px] border-border/60 bg-card shadow-[0_8px_25px_color-mix(in_srgb,var(--foreground)_3%,transparent)] transition-[border-color,box-shadow,transform] duration-200',
        interactive ? 'cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_13px_30px_color-mix(in_srgb,var(--primary)_8%,transparent)]' : 'cursor-default',
        active && 'border-primary ring-2 ring-primary/20',
        className,
      )}
    >
      <CardContent className="p-3.5">
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-[10px] bg-[color-mix(in_srgb,var(--accent)_82%,var(--card))] p-2.5 text-primary">
            <Icon className="size-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="break-words text-[13px] font-semibold italic leading-tight text-muted-foreground" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{title}</p>
            <div className={cn('break-words text-xl font-extrabold tracking-tight tabular-nums', tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-warning' : 'text-accent')}>{value}</div>
            {sub && <p className="text-[11px] font-medium text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
