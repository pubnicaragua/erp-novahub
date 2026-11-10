/** Etiquetas y colores de Marketing en un solo lugar (reutilizables por todas las vistas). */
import { getCurrencyDecimalPlaces } from '../../utils/currency';
export const CAMPAIGN_TYPE_LABEL: Record<string, string> = { DIGITAL: 'Digital', SPORTS: 'Deportivo', BTL: 'BTL', EVENT: 'Evento', INTERNAL: 'Interna' };
export const CAMPAIGN_STATUS_LABEL: Record<string, string> = { DRAFT: 'Borrador', PLANNING: 'Planificación', APPROVED: 'Aprobada', RUNNING: 'En ejecución', PAUSED: 'En pausa', COMPLETED: 'Completada', CANCELLED: 'Cancelada' };
export const CONTENT_STATUS_LABEL: Record<string, string> = { IDEA: 'Idea', DRAFT: 'Borrador', IN_REVIEW: 'En revisión', CHANGES_REQUESTED: 'Cambios solicitados', APPROVED: 'Aprobado', SCHEDULED: 'Programado', PUBLISHED: 'Publicado', REJECTED: 'Rechazado', ARCHIVED: 'Archivado' };
export const BRIEF_STATUS_LABEL: Record<string, string> = { DRAFT: 'Borrador', IN_DEVELOPMENT: 'En desarrollo', IN_REVIEW: 'En revisión', APPROVED: 'Estrategia aprobada', RUNNING: 'En ejecución', COMPLETED: 'Finalizado' };
export const ACCOUNT_STATUS_LABEL: Record<string, string> = { ACTIVE: 'Saludable', FOLLOW_UP: 'En seguimiento', RISK: 'Riesgo', INACTIVE: 'Inactiva' };
export const APPROVAL_STATUS_LABEL: Record<string, string> = { PENDING: 'Por aprobar', APPROVED: 'Aprobado', REJECTED: 'Rechazado', CHANGES_REQUESTED: 'Cambios solicitados', CANCELLED: 'Cancelado' };
export const APPROVAL_SUBJECT_LABEL: Record<string, string> = { CONTENT: 'Pieza', BUDGET: 'Presupuesto', STRATEGY: 'Estrategia' };
export const FORMAT_LABEL: Record<string, string> = { POST: 'Post', REEL: 'Reel', STORY: 'Historia', VIDEO: 'Video', CAROUSEL: 'Carrusel', ARTICLE: 'Artículo', EMAIL: 'Email', AD: 'Anuncio', POP: 'Material POP' };
export const RIGHTS_LABEL: Record<string, string> = { INTERNAL: 'Uso interno', COMMERCIAL: 'Uso comercial', UNLIMITED: 'Uso ilimitado', RESTRICTED: 'Restringido' };
export const METRIC_LABEL: Record<string, string> = { REACH: 'Alcance', IMPRESSIONS: 'Impresiones', CLICKS: 'Clics', CONVERSIONS: 'Conversiones', LEADS: 'Leads', SPEND: 'Inversión', REVENUE: 'Ingresos', ENGAGEMENT: 'Interacciones', ATTENDANCE: 'Asistencia' };
export const SOURCE_LABEL: Record<string, string> = { MANUAL: 'Manual', VERIFIED: 'Verificada' };

const GREEN = 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100';
const AMBER = 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100';
const ROSE = 'bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-100';
const VIOLET = 'bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-100';
const SLATE = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100';
const SKY = 'bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-100';

export const STATUS_CLASS: Record<string, string> = {
  RUNNING: GREEN, APPROVED: GREEN, PUBLISHED: GREEN, ACTIVE: GREEN, COMPLETED: SKY, SCHEDULED: VIOLET,
  PLANNING: AMBER, IN_REVIEW: AMBER, PENDING: AMBER, FOLLOW_UP: AMBER, CHANGES_REQUESTED: AMBER, IN_DEVELOPMENT: AMBER, PAUSED: AMBER,
  REJECTED: ROSE, RISK: ROSE, CANCELLED: ROSE,
  DRAFT: SLATE, IDEA: SLATE, ARCHIVED: SLATE, INACTIVE: SLATE,
};

/** Transiciones permitidas (espejo informativo del backend, que es la autoridad). */
export const CAMPAIGN_NEXT: Record<string, string[]> = {
  DRAFT: ['PLANNING', 'CANCELLED'], PLANNING: ['APPROVED', 'DRAFT', 'CANCELLED'], APPROVED: ['RUNNING', 'PLANNING', 'CANCELLED'],
  RUNNING: ['PAUSED', 'COMPLETED', 'CANCELLED'], PAUSED: ['RUNNING', 'COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [],
};

export const money = (value: unknown, currency = 'NIO') => {
  const n = Number(value ?? 0);
  return `${currency === 'NIO' ? 'C$' : currency} ${(Number.isFinite(n) ? n : 0).toLocaleString('es-NI', { minimumFractionDigits: getCurrencyDecimalPlaces(), maximumFractionDigits: getCurrencyDecimalPlaces() })}`;
};
export const compact = (value: unknown) => Number(value ?? 0).toLocaleString('es-NI', { notation: 'compact', maximumFractionDigits: 1 });
export const fmtDate = (value?: string | null, withTime = false) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-NI', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
};
export const toInputDate = (value?: string | null) => (value ? new Date(value).toISOString().slice(0, 10) : '');
export const toInputDateTime = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
