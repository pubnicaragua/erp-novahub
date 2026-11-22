import { createContext, useContext } from 'react';
import { AlertTriangle, Check, CheckCheck, Clock3 } from 'lucide-react';
import type { WaMessageStatus, WaRealtimeEvent } from '../../../services/whatsapp.service';

export const FALLBACK_LINE_COLOR = '#16a34a';

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '#';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });
}

/** Hora si es de hoy, "Ayer", o fecha corta. */
export function formatListTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startToday) return formatClock(iso);
  if (date.getTime() >= startToday - 86_400_000) return 'Ayer';
  return date.toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (startDate === startToday) return 'Hoy';
  if (startDate === startToday - 86_400_000) return 'Ayer';
  return date.toLocaleDateString('es-NI', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = seconds / 3600;
  return hours < 24 ? `${hours.toFixed(1)} h` : `${(hours / 24).toFixed(1)} d`;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('505')) return `+505 ${d.slice(3, 7)}-${d.slice(7)}`;
  return `+${d}`;
}

export const PROVIDER_LABEL: Record<string, string> = {
  META_CLOUD: 'API oficial de Meta',
  SIMULATED: 'Línea de prueba',
  QR: 'Vinculación QR',
};

export const STATUS_LABEL: Record<string, { label: string; dot: string; text: string }> = {
  CONNECTED: { label: 'Conectado', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  PENDING: { label: 'Pendiente', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  DISCONNECTED: { label: 'Desconectado', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
  ERROR: { label: 'Con error', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
};

export function LineChip({ name, color, className = '' }: { name: string; color: string | null; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/40 bg-muted/40 px-2 py-0.5 text-[10px] font-bold text-muted-foreground ${className}`}>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color || FALLBACK_LINE_COLOR }} />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function MessageTicks({ status }: { status: WaMessageStatus }) {
  if (status === 'QUEUED') return <Clock3 className="size-3 text-muted-foreground" aria-label="Enviando" />;
  if (status === 'FAILED') return <AlertTriangle className="size-3 text-rose-500" aria-label="No se envió" />;
  if (status === 'SENT') return <Check className="size-3.5 text-muted-foreground" aria-label="Enviado" />;
  if (status === 'DELIVERED') return <CheckCheck className="size-3.5 text-muted-foreground" aria-label="Entregado" />;
  if (status === 'READ') return <CheckCheck className="size-3.5 text-sky-500" aria-label="Leído" />;
  return null;
}

/** Un solo canal de tiempo real para toda la pantalla de WhatsApp; cada vista se suscribe sin abrir otra conexión. */
export interface WhatsAppEventsApi {
  subscribe: (listener: (event: WaRealtimeEvent) => void) => () => void;
  online: boolean;
}

export const WhatsAppEventsContext = createContext<WhatsAppEventsApi>({ subscribe: () => () => undefined, online: false });
export const useWhatsAppEvents = () => useContext(WhatsAppEventsContext);
