/**
 * La bitácora mezcla dos cosas: lo que una persona anota a mano (notas, acuerdos, archivos) y lo que el sistema deja
 * solo (tarea reasignada o tomada, plazo vencido). Estas funciones las distinguen y traducen el detalle técnico
 * a una frase que se pueda leer.
 */
export interface BitacoraLogLike {
  action?: string | null;
  entity?: string | null;
  details?: unknown;
  activity?: { title?: string | null; type?: string | null } | null;
}

/** Entidades que escribe el formulario «Nuevo registro»: todo lo demás lo deja el sistema. */
const MANUAL_ENTITIES = new Set(['TAREA', 'EVENTO', 'REGISTRO LIBRE']);

export type LogOrigin = 'MANUAL' | 'SYSTEM';

export function getLogOrigin(log: BitacoraLogLike): LogOrigin {
  return MANUAL_ENTITIES.has(String(log.entity || '').trim().toUpperCase()) ? 'MANUAL' : 'SYSTEM';
}

const ACTION_LABELS: Record<string, string> = {
  UPDATE: 'Nota',
  CREATE: 'Alta',
  DELETE: 'Eliminación',
  UPLOAD: 'Archivo cargado',
  TASK_REASSIGNED: 'Tarea reasignada',
  TASK_CLAIMED: 'Tarea tomada',
  SLA_BREACHED: 'Plazo (SLA) vencido',
};

export function getLogActionLabel(action: unknown, origin: LogOrigin = 'MANUAL'): string {
  const key = String(action || '').trim().toUpperCase();
  if (ACTION_LABELS[key]) return ACTION_LABELS[key];
  if (!key) return origin === 'MANUAL' ? 'Nota' : 'Registro del sistema';
  return key.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '');

/** Frase legible del detalle: nunca muestra JSON ni identificadores internos. */
export function describeLogDetails(log: BitacoraLogLike): string {
  const origin = getLogOrigin(log);
  const object = asObject(log.details);
  if (!object) {
    const plain = text(log.details);
    if (plain) return plain;
    return origin === 'MANUAL' ? 'Sin comentarios.' : getLogActionLabel(log.action, origin);
  }
  const action = String(log.action || '').toUpperCase();
  if (action === 'TASK_REASSIGNED' || action === 'TASK_CLAIMED') {
    const from = text(object.fromUserName) || 'Sin asignar';
    const to = text(object.toUserName);
    const reason = text(object.reason);
    const by = text(object.actorName);
    const move = to ? `${from} → ${to}` : text(object.message);
    return [move, reason && reason !== 'Auto-asignación' ? `Motivo: ${reason}` : reason, by ? `Por ${by}` : ''].filter(Boolean).join(' · ');
  }
  const message = text(object.message);
  if (message) return message;
  return getLogActionLabel(log.action, origin);
}

export type LogOriginFilter = 'ALL' | LogOrigin;

export function matchesLogSearch(log: BitacoraLogLike & { fileName?: string | null }, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return [log.entity, getLogActionLabel(log.action, getLogOrigin(log)), describeLogDetails(log), log.activity?.title, log.fileName]
    .some((value) => String(value || '').toLowerCase().includes(needle));
}
