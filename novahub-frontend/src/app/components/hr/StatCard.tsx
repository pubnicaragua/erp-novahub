import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { SalesKpiCard } from '../ventas/SalesKpiCard';

export type StatTone = 'primary' | 'blue' | 'green' | 'orange' | 'red' | 'amber' | 'gray';

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

/** RR. HH. usa la misma tarjeta que el resto del sistema; el tono solo marca alertas reales (rojo/ámbar). */
export function StatCard({ label, value, icon, tone = 'primary', active, onClick, sub, className, title }: StatCardProps) {
  const kpiTone = tone === 'red' ? 'bad' : tone === 'amber' || tone === 'orange' ? 'warn' : 'default';
  return <SalesKpiCard title={label} value={value} icon={icon} tone={kpiTone} active={active} onClick={onClick} sub={sub} hint={title} className={className} />;
}
