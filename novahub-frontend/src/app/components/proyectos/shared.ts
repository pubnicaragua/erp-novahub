import type { Priority, ProjectCostSource, ProjectCostStatus, ProjectStatus, TaskStatus } from '../../services/projects.service';

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Borrador', badge: 'bg-slate-500/10 text-slate-600 border-slate-200' },
  PLANNED: { label: 'Planificado', badge: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  IN_PROGRESS: { label: 'En progreso', badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  PAUSED: { label: 'Pausado', badge: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  COMPLETED: { label: 'Completado', badge: 'bg-green-600/10 text-green-700 border-green-200' },
  CANCELLED: { label: 'Cancelado', badge: 'bg-rose-500/10 text-rose-600 border-rose-200' },
};

export const TASK_STATUS_META: Record<TaskStatus, { label: string; badge: string }> = {
  PENDING: { label: 'Pendiente', badge: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  IN_PROGRESS: { label: 'En progreso', badge: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  COMPLETED: { label: 'Completada', badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  CANCELLED: { label: 'Cancelada', badge: 'bg-rose-500/10 text-rose-600 border-rose-200' },
};

export const PRIORITY_META: Record<Priority, { label: string; badge: string; dot: string }> = {
  LOW: { label: 'Baja', badge: 'bg-slate-500/10 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  MEDIUM: { label: 'Media', badge: 'bg-blue-500/10 text-blue-600 border-blue-200', dot: 'bg-blue-500' },
  HIGH: { label: 'Alta', badge: 'bg-amber-500/10 text-amber-600 border-amber-200', dot: 'bg-amber-500' },
  URGENT: { label: 'Urgente', badge: 'bg-rose-500/10 text-rose-600 border-rose-200', dot: 'bg-rose-500' },
};

export const COST_SOURCE_LABEL: Record<ProjectCostSource, string> = {
  MANUAL: 'Manual',
  PURCHASE: 'Compra',
  INVENTORY: 'Inventario',
  PAYROLL: 'Nómina',
  ACTIVITY: 'Actividad',
  OTHER: 'Otro',
};

export const COST_STATUS_META: Record<ProjectCostStatus, { label: string; badge: string }> = {
  PENDING: { label: 'Pendiente', badge: 'bg-slate-500/10 text-slate-600 border-slate-200' },
  COMMITTED: { label: 'Comprometido', badge: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  EXECUTED: { label: 'Ejecutado', badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  CANCELLED: { label: 'Cancelado', badge: 'bg-rose-500/10 text-rose-600 border-rose-200' },
};

export const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'PLANNED', label: 'Planificado' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'PAUSED', label: 'Pausado' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'COMPLETED', label: 'Completada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

export const COST_SOURCE_OPTIONS: { value: ProjectCostSource; label: string }[] = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'PURCHASE', label: 'Compra' },
  { value: 'INVENTORY', label: 'Inventario' },
  { value: 'PAYROLL', label: 'Nómina' },
  { value: 'ACTIVITY', label: 'Actividad' },
  { value: 'OTHER', label: 'Otro' },
];

export const COST_STATUS_OPTIONS: { value: ProjectCostStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'COMMITTED', label: 'Comprometido' },
  { value: 'EXECUTED', label: 'Ejecutado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

export const money = (value?: number | string | null, currency = 'NIO'): string => {
  const n = Number(value || 0);
  const symbol = currency === 'USD' ? '$' : 'C$';
  return `${symbol}${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (value?: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fromLocalDate = (value: string | undefined | null): string | undefined => {
  if (!value) return undefined;
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
};

export const toLocalDate = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  COMMENT: 'Comentario',
  ACTIVITY: 'Actividad',
  STATUS_CHANGE: 'Cambio de estado',
  BUDGET_CHANGE: 'Cambio de presupuesto',
  COST_CHANGE: 'Cambio de costo',
  MEMBER_ADDED: 'Miembro agregado',
  MEMBER_REMOVED: 'Miembro removido',
  TASK_COMPLETED: 'Tarea completada',
  MILESTONE_COMPLETED: 'Hito completado',
};

export const statusTextColor = (status: ProjectStatus): string => {
  const map: Record<ProjectStatus, string> = {
    DRAFT: 'text-slate-600', PLANNED: 'text-blue-600', IN_PROGRESS: 'text-emerald-600',
    PAUSED: 'text-amber-600', COMPLETED: 'text-green-700', CANCELLED: 'text-rose-600',
  };
  return map[status];
};