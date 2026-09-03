import type { CSSProperties } from 'react';

/** Shared SVG/chart styles. CSS variables make the charts follow light/dark mode. */
export const FINANCE_AXIS_TICK = {
  fontSize: 11,
  fill: 'var(--muted-foreground)',
  fontWeight: 500,
};

export const FINANCE_GRID = 'var(--border)';

export const FINANCE_TOOLTIP_WRAPPER: CSSProperties = {
  zIndex: 30,
  pointerEvents: 'none',
};

const FINANCE_CATEGORY_LABELS: Record<string, string> = {
  MARKETING: 'Marketing',
  RENT: 'Alquiler',
  UTILITIES: 'Servicios públicos',
  SALARY: 'Salarios',
  SALARIES: 'Salarios',
  HARDWARE: 'Equipo y hardware',
  MAINTENANCE: 'Mantenimiento',
  OFFICE: 'Oficina',
  TRAINING: 'Capacitación',
  SUPPLIES: 'Suministros',
  TRAVEL: 'Viajes',
  EVENTS: 'Eventos',
  SERVICES: 'Servicios',
  FOOD: 'Alimentos',
  ADVERTISING: 'Publicidad',
  FUEL: 'Combustible',
  TAXES: 'Impuestos',
  INSURANCE: 'Seguros',
  COMMISSIONS: 'Comisiones',
  SOFTWARE: 'Software',
  OTHER: 'Otro',
  OTROS: 'Otros',
};

/** Translates the technical category codes that can arrive from the API. */
export function financeCategoryLabel(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Sin categoría';
  const normalized = raw.toUpperCase().replace(/[\s-]+/g, '_');
  return FINANCE_CATEGORY_LABELS[normalized] || raw;
}

interface FinanceTooltipCardProps {
  active?: boolean;
  payload?: Array<any>;
  label?: string | number;
  formatter?: (value: any, name?: string, entry?: any) => any;
}

export function FinanceTooltipCard({ active, payload, label, formatter }: FinanceTooltipCardProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      role="status"
      style={{
        minWidth: 150,
        maxWidth: 260,
        background: 'var(--popover)',
        color: 'var(--popover-foreground)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 12px',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.18)',
      }}
    >
      <p style={{ fontWeight: 700, fontSize: 12, margin: '0 0 8px', color: 'var(--popover-foreground)' }}>
        {label}
      </p>
      <div style={{ display: 'grid', gap: 5 }}>
        {payload.map((entry: any, index: number) => (
          <div key={`${entry.name ?? 'serie'}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontSize: 11 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--popover-foreground)' }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: entry.color || 'var(--primary)', flex: '0 0 auto' }} />
              {entry.name || 'Valor'}
            </span>
            <strong style={{ color: entry.color || 'var(--popover-foreground)', whiteSpace: 'nowrap' }}>
              {formatter ? formatter(entry.value, entry.name, entry) : entry.value}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
