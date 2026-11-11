// ============================================================
// Nova Hub ERP - Base API Service
// Configure BASE_URL to point to your NestJS backend
// ============================================================

import { isSafeAuthToken } from './auth-token';
import { normalizeApiErrorBody, type ApiErrorBody } from './api-error';
import { notifyErpMutation } from '../utils/action-lock';
import { beginNotificationAction, completeNotificationAction } from './notification-action-coordinator';

const DEFAULT_API_URL = import.meta.env.PROD
  ? 'https://backenderpnh.onrender.com/api'
  : 'http://localhost:3000/api';
const BASE_URL = String(import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  rawBody?: BodyInit;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const idempotentInFlight = new Map<string, Promise<unknown>>();
// Deduplicate only simultaneous GETs. This is deliberately not a TTL cache:
// mutations keep their current semantics and no tenant data is retained after
// the request settles.
const getInFlight = new Map<string, Promise<unknown>>();

/** Clear promises that could otherwise be reused across an auth boundary. */
export function clearRequestCaches() {
  idempotentInFlight.clear();
  getInFlight.clear();
}

export function createIdempotencyKey(prefix = 'nh'): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function stableRequestKey(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableRequestKey).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableRequestKey((value as any)[key])}`).join(',')}}`;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly path?: string,
    public readonly code?: string,
    public readonly details?: string[],
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
}

export function getApiUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  return buildUrl(path, params);
}

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('nh-auth-token');
  if (!token) return {};
  if (!isSafeAuthToken(token)) {
    // Do not let a stale/oversized token reach the HTTP parser and become a
    // misleading CORS/431 error. AuthContext will require a fresh login.
    localStorage.removeItem('nh-auth-token');
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

function asTextList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function describeRequest(path: string, method: RequestOptions['method']) {
  const action = method || 'GET';
  const route = path.split('?')[0];

  if (route === '/caja/sessions/open') return 'abrir la caja';
  if (route.startsWith('/caja/sessions/active/')) return 'consultar la sesión activa de caja';
  if (route === '/caja/sessions/history') return 'cargar el historial de caja';
  if (route.includes('/caja/sessions/') && route.endsWith('/close')) return 'cerrar la caja';
  if (route.includes('/caja/sessions/') && route.endsWith('/count')) return 'guardar el arqueo de caja';
  if (route.includes('/caja/sessions/') && route.endsWith('/movement')) return 'registrar el movimiento de caja';
  if (route === '/caja/holds' && action === 'POST') return 'crear la venta suspendida';
  if (route === '/caja/holds' && action === 'GET') return 'cargar las ventas suspendidas';
  if (route.includes('/caja/holds/') && route.endsWith('/confirm')) return 'cobrar la venta suspendida';
  if (route.includes('/caja/holds/') && route.endsWith('/deliver')) return 'registrar la entrega de la venta suspendida';
  if (route.includes('/caja/holds/') && route.endsWith('/cancel')) return 'cancelar la venta suspendida';
  if (route.includes('/caja/products/') && route.endsWith('/availability')) return 'consultar la disponibilidad del producto';
  if (route === '/sucursales' && action === 'POST') return 'crear la sucursal';
  if (route.startsWith('/sucursales/') && action === 'PUT') return 'guardar la sucursal';
  if (route.startsWith('/sucursales/') && action === 'DELETE') return 'eliminar la sucursal';
  if (route === '/caja/registers' && action === 'POST') return 'crear la caja';
  if (route.startsWith('/caja/registers/') && route.endsWith('/access')) return 'guardar los accesos de caja';
  if (route.startsWith('/caja/registers/') && action === 'PUT') return 'guardar la caja';
  if (route === '/auth/login') return 'iniciar sesión';
  if (route === '/auth/switch-context') return 'restaurar el contexto de trabajo';

  const requestModule = [
    ['/hotel', 'Hotel'], ['/caja', 'Caja'], ['/sucursales', 'Sucursales'],
    ['/inventory', 'Inventario'], ['/inventario', 'Inventario'],
    ['/sales', 'Ventas'], ['/ventas', 'Ventas'], ['/purchases', 'Compras'], ['/compras', 'Compras'],
    ['/accounting', 'Contabilidad'], ['/financials', 'Finanzas'], ['/finanzas', 'Finanzas'],
    ['/hr', 'Recursos Humanos'], ['/force-sales', 'Fuerza Comercial'],
    ['/activities', 'Actividades'], ['/actividades', 'Actividades'],
    ['/admin', 'Administración'], ['/manager', 'Administración de sucursal'],
    ['/reports', 'Reportes'], ['/reportes', 'Reportes'], ['/projects', 'Proyectos'],
    ['/notifications', 'Notificaciones'], ['/audit', 'Auditoría'], ['/tickets', 'Tickets'],
    ['/intl-imports', 'Importaciones'], ['/subscriptions', 'Suscripciones'],
    ['/configuracion', 'Configuración'], ['/settings', 'Configuración'],
    ['/restaurants', 'Restaurante POS'], ['/restaurant', 'Restaurante POS'],
    ['/users', 'Usuarios'], ['/clients', 'Clientes'], ['/customers', 'Clientes'],
  ].find(([prefix]) => route === prefix || route.startsWith(`${prefix}/`))?.[1];

  if (requestModule) {
    if (action === 'GET') return `cargar la información de ${requestModule}`;
    if (action === 'POST') return `guardar información en ${requestModule}`;
    if (action === 'PUT' || action === 'PATCH') return `actualizar información de ${requestModule}`;
    if (action === 'DELETE') return `eliminar el registro de ${requestModule}`;
  }

  if (action === 'GET') return 'cargar la información';
  if (action === 'POST') return 'guardar la información';
  if (action === 'PUT' || action === 'PATCH') return 'actualizar la información';
  if (action === 'DELETE') return 'eliminar el registro';
  return 'procesar la solicitud';
}

const MODULE_LABELS: Record<string, string> = {
  INVENTORY_WAREHOUSES: 'Inventario/Sucursales',
  INVENTORY: 'Inventario',
  SALES: 'Ventas',
  PURCHASES: 'Compras',
  POS: 'Caja',
  REPORTS: 'Reportes',
  USERS: 'Usuarios',
  BRANCHES: 'Sucursales',
  SETTINGS: 'Configuracion',
  SUBSCRIPTIONS: 'Suscripciones',
};

const PERMISSION_LABELS: Record<string, string> = {
  read: 'lectura',
  write: 'escritura',
  create: 'crear',
  update: 'editar',
  delete: 'eliminar',
  approve: 'aprobar',
};

const GENERIC_HTTP_ERROR_STATUS: Record<string, number> = {
  'bad request': 400,
  unauthorized: 401,
  forbidden: 403,
  'not found': 404,
  conflict: 409,
  'payload too large': 413,
  'unsupported media type': 415,
  'unprocessable entity': 422,
  'too many requests': 429,
  'bad gateway': 502,
  'internal server error': 500,
  'error interno del servidor': 500,
  'service unavailable': 503,
  'gateway timeout': 504,
};
const GENERIC_HTTP_ERROR_LABELS = new Set(Object.keys(GENERIC_HTTP_ERROR_STATUS));

function humanize403Message(raw: string, context?: string): string {
  let msg = raw;

  if (/RETAIL_CASH_CONTROL/i.test(raw) && /(?:permiso|permission).*['"]?edit['"]?/i.test(raw)) {
    return 'No tienes permiso para editar esta vista.';
  }

  // Reemplazar permisos tecnicos (read, write, etc.)
  msg = msg.replace(/permiso\s+'(\w+)'/gi, (_, perm) => {
    const label = PERMISSION_LABELS[perm.toLowerCase()] || perm;
    return `permiso de ${label}`;
  });

  // Reemplazar codigos de modulo por nombres amigables
  msg = msg.replace(/\b(INVENTORY_WAREHOUSES|INVENTORY|SALES|PURCHASES|POS|REPORTS|USERS|BRANCHES|SETTINGS|SUBSCRIPTIONS)\b/g, (code) => {
    return MODULE_LABELS[code] || code;
  });

  const technical = /forbidden|insufficient|permission denied|not authorized|unauthorized|access denied|row-level security|violates? .*policy/i.test(msg);
  if (technical) {
    return context
      ? `No tienes acceso para ${context}. Solicita al administrador que habilite este permiso.`
      : 'No tienes acceso a este módulo o acción. Solicita al administrador que habilite este permiso.';
  }
  return msg;
}

function humanizeValidationMessage(raw: string): string {
  let match = raw.match(/^property ([\w.-]+) should not exist$/i);
  if (match) return `El campo «${match[1]}» no está permitido en esta solicitud.`;

  match = raw.match(/^([\w.-]+) should not be empty$/i);
  if (match) return `El campo «${match[1]}» es obligatorio.`;

  const rules: Array<[RegExp, string]> = [
    [/^([\w.-]+) must be an email$/i, 'El campo «$1» debe contener un correo válido.'],
    [/^([\w.-]+) must be a string$/i, 'El campo «$1» debe contener texto.'],
    [/^([\w.-]+) must be a number conforming to the specified constraints$/i, 'El campo «$1» debe contener un número válido.'],
    [/^([\w.-]+) must be an integer number$/i, 'El campo «$1» debe contener un número entero.'],
    [/^([\w.-]+) must be a UUID$/i, 'El campo «$1» no tiene un identificador válido.'],
    [/^([\w.-]+) must be a boolean value$/i, 'El campo «$1» debe ser verdadero o falso.'],
    [/^([\w.-]+) must be an array$/i, 'El campo «$1» debe contener una lista de valores.'],
    [/^([\w.-]+) must be longer than or equal to (\d+) characters$/i, 'El campo «$1» debe tener al menos $2 caracteres.'],
    [/^([\w.-]+) must be shorter than or equal to (\d+) characters$/i, 'El campo «$1» no puede superar $2 caracteres.'],
    [/^([\w.-]+) must not be less than (\d+)$/i, 'El campo «$1» debe ser igual o mayor que $2.'],
    [/^([\w.-]+) must not be greater than (\d+)$/i, 'El campo «$1» debe ser igual o menor que $2.'],
  ];
  for (const [pattern, replacement] of rules) {
    if (pattern.test(raw)) return raw.replace(pattern, replacement);
  }
  return raw;
}

function normalizeErrorMessage(message?: string, status?: number, context?: string, requestId?: string): string {
  const raw = (message || '').trim();
  const lower = raw.toLowerCase();
  const prefix = context ? `No se pudo ${context}. ` : '';

  // A duplicate hotel code is a direct notice to the user; do not frame it
  // as a failed save or expose the HTTP 409 wording around it.
  if (status === 409 && /^ya existe (?:una habitación|un tipo de habitación) con ese código\.?$/i.test(raw)) {
    return raw;
  }

  const normalizedHttpLabel = lower.replace(/[.!?]+$/, '');
  if (GENERIC_HTTP_ERROR_LABELS.has(normalizedHttpLabel)) {
    return normalizeErrorMessage('', status, context, requestId);
  }
  if (status !== undefined && status >= 500 && /^(?:internal server error|error interno del servidor)(?:\b|[.:])/i.test(raw)) {
    return normalizeErrorMessage('', status, context, requestId);
  }
  if (status === 400 && /^(?:bad request|bad request exception|invalid request)$/i.test(raw)) {
    return normalizeErrorMessage('', status, context, requestId);
  }
  if (status === 404 && /not found|cannot (?:get|post|put|patch|delete)\b/i.test(raw)) {
    return normalizeErrorMessage('', status, context, requestId);
  }
  if (status === 409 && /conflict|already exists|unique constraint/i.test(raw)) {
    return normalizeErrorMessage('', status, context, requestId);
  }
  if (status === 413 && /payload too large|entity too large|request entity too large/i.test(raw)) {
    return normalizeErrorMessage('', status, context, requestId);
  }
  if (status === 415 && /unsupported media type|unsupported file type/i.test(raw)) {
    return normalizeErrorMessage('', status, context, requestId);
  }
  if (status === 429 && /too many requests|rate limit/i.test(raw)) {
    return normalizeErrorMessage('', status, context, requestId);
  }

  if (status === 401 && /invalid credentials|bad credentials|credenciales? incorrectas?/i.test(raw)) {
    return 'No se pudo iniciar sesión porque el correo o la contraseña no coinciden. Revísalos e inténtalo de nuevo.';
  }
  if (status === 404 && /cannot (?:get|post|put|patch|delete)\b/i.test(raw)) {
    return normalizeErrorMessage('', status, context, requestId);
  }

  // Always prefer the backend's message when available
  if (raw) {
    // Only use custom replacements for known technical messages
    if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network error') || lower.includes('network request failed')) {
      return context
        ? `No se pudo ${context} porque no hay conexión con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.`
        : 'No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.';
    }
    if (lower.includes('column') && lower.includes('does not exist')) {
      return `${prefix}La base de datos no tiene una columna que esta operación necesita. Contacta al administrador para revisar la actualización del sistema.`;
    }
    if (lower.includes('relation') && lower.includes('does not exist') || lower.includes('table') && lower.includes('does not exist') || lower.includes('p2021')) {
      return `${prefix}La base de datos no tiene una tabla que esta operación necesita. Contacta al administrador para revisar la actualización del sistema.`;
    }
    if (lower.includes('unique constraint failed') || lower.includes('already exists')) {
      return `${prefix}Ya existe un registro con esos datos. Revisa el código o nombre e inténtalo nuevamente.`;
    }
    if (lower.startsWith('http error') && status) {
      return normalizeErrorMessage('', status, context, requestId);
    }
    // Para errores 403, traducir terminos tecnicos a mensajes amigables
    if (status === 403 && raw) return humanize403Message(raw, context);
    // Return the backend message as-is (with prefix for context)
    return prefix && !lower.startsWith('no se pudo') ? `${prefix}${raw}` : raw;
  }

  // Generic fallbacks when no backend message
  if (status === 400) return `${prefix}Los datos enviados no se pudieron aceptar. Revisa los campos obligatorios y que los valores tengan el formato correcto.`;
  if (status === 401) return 'Tu sesión expiró o ya no es válida. Inicia sesión nuevamente para continuar.';
  if (status === 403) return `${prefix}Tu usuario no tiene permiso para realizar esta acción. Pide que revisen los permisos asignados a tu perfil.`;
  if (status === 404) return `${prefix}No encontramos el registro solicitado. Puede haberse eliminado, cambiado de sucursal o ya no estar disponible.`;
  if (status === 409) return `${prefix}La operación entra en conflicto con los datos actuales. Revisa si el registro ya existe o fue actualizado y vuelve a cargar la información.`;
  if (status === 413) return `${prefix}El archivo o la cantidad de datos supera el tamaño permitido. Reduce el tamaño e inténtalo de nuevo.`;
  if (status === 415) return `${prefix}El archivo o formato enviado no es compatible. Usa un formato admitido e inténtalo de nuevo.`;
  if (status === 422) return `${prefix}Algunos datos no cumplen las reglas requeridas. Revisa los campos indicados y corrígelos.`;
  if (status === 429) return `${prefix}Se recibieron demasiadas solicitudes seguidas. Espera un momento e inténtalo de nuevo.`;
  if (status === 502 || status === 503) return `${prefix}El servicio que atiende esta operación no está disponible en este momento. Espera un momento e inténtalo de nuevo.`;
  if (status === 504) return `${prefix}La solicitud tardó demasiado en responder. Comprueba si se guardó antes de repetirla.`;
  if ((status || 0) >= 500) {
    const nextStep = requestId
      ? `Comparte el código de seguimiento ${requestId} con soporte para localizar el problema.`
      : 'Inténtalo de nuevo; si vuelve a ocurrir, contacta a soporte.';
    return `${prefix}El servidor no pudo completar la solicitud. ${nextStep}`;
  }
  return `${prefix}No se pudo completar la solicitud. Inténtalo de nuevo y, si continúa, contacta a soporte.`;
}

export { normalizeErrorMessage as normalizeApiErrorMessage };

function improveFallbackMessage(fallback: string): string {
  const message = fallback.trim();
  if (!message) return 'No se pudo completar la acción. No se recibió el motivo del problema; inténtalo de nuevo y, si continúa, contacta a soporte.';

  const errorAl = message.match(/^error al (.+)$/i);
  if (errorAl) {
    const action = errorAl[1].replace(/[.!?]+$/, '');
    return `No se pudo ${action}. La aplicación no recibió el motivo del problema; inténtalo de nuevo y, si continúa, contacta a soporte.`;
  }

  const errorDe = message.match(/^error de (.+)$/i);
  if (errorDe) {
    const action = errorDe[1].replace(/[.!?]+$/, '');
    return `No se pudo completar la operación de ${action}. La aplicación no recibió el motivo del problema; inténtalo de nuevo y, si continúa, contacta a soporte.`;
  }

  return message;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message) {
    const status = Number((error as any).status);
    if (status >= 400 && status <= 599) {
      return normalizeErrorMessage(error.message, status);
    }
    const genericStatus = GENERIC_HTTP_ERROR_STATUS[error.message.trim().toLowerCase().replace(/[.!?]+$/, '')];
    if (genericStatus) return normalizeErrorMessage('', genericStatus);
    if (/failed to fetch|networkerror|network error|network request failed/i.test(error.message)) {
      return normalizeErrorMessage(error.message);
    }
    return improveFallbackMessage(error.message);
  }
  return improveFallbackMessage(fallback);
}

function extractServerMessages(errorBody: ApiErrorBody | null) {
  if (!errorBody) return [];
  const nestedMessage = errorBody.message && typeof errorBody.message === 'object' && !Array.isArray(errorBody.message)
    ? (errorBody.message as any)
    : null;
  return [
    ...asTextList(Array.isArray(errorBody.message) ? errorBody.message : nestedMessage?.message || nestedMessage?.error || errorBody.message),
    ...asTextList(errorBody.details),
    ...asTextList(errorBody.error).filter((label) => !GENERIC_HTTP_ERROR_LABELS.has(label.trim().toLowerCase().replace(/[.!?]+$/, ''))),
  ];
}

async function apiRequestInternal<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, rawBody, params, headers = {}, signal } = options;
  const context = describeRequest(path, method);
  const auditTenantId = path.startsWith('/audit/v1/')
    ? localStorage.getItem('nova-audit-tenant-id') || ''
    : '';
  const auditEngagementId = path.startsWith('/audit/v1/')
    ? localStorage.getItem('nova-audit-engagement-id') || ''
    : '';
  const resolvedPath = auditEngagementId
    ? path.replace('/engagements/engagement-001', `/engagements/${encodeURIComponent(auditEngagementId)}`)
    : path;

  let response: Response;
  const requestInit: RequestInit = {
      method,
      headers: {
        ...(rawBody === undefined ? { 'Content-Type': 'application/json' } : {}),
        ...getAuthHeaders(),
        ...(auditTenantId ? { 'X-Nova-Audit-Tenant': auditTenantId } : {}),
        ...headers,
      },
      cache: 'no-store',
      body: rawBody ?? (body ? JSON.stringify(body) : undefined),
      signal,
  };
  try {
    response = await fetch(buildUrl(resolvedPath, params), requestInit);
  } catch (error: any) {
    // Una petición cancelada no es un error real: el usuario cambió de vista,
    // la query fue invalidada o el componente se desmontó. Se relanza como un
    // AbortError identificable para que los consumidores puedan filtrarla
    // (error.name === 'AbortError') y no se muestre como fallo.
    if (signal?.aborted || error?.name === 'AbortError') {
      throw new DOMException('La solicitud fue cancelada', 'AbortError');
    }
    // A lost connection can happen after the server committed the operation.
    // Retrying with the same key safely replays the original response.
    if (headers['Idempotency-Key']) {
      try {
        response = await fetch(buildUrl(resolvedPath, params), requestInit);
      } catch {
        throw new ApiRequestError(normalizeErrorMessage(error?.message, undefined, context), undefined, path);
      }
    } else {
      throw new ApiRequestError(normalizeErrorMessage(error?.message, undefined, context), undefined, path);
    }
  }

  if (!response.ok) {
    let errorBody: ApiErrorBody | null = null;
    try {
      errorBody = normalizeApiErrorBody(await response.json());
    } catch { /* keep the initialized null body */ }

    if (errorBody?.code === 'TRIAL_EXPIRED' || (errorBody?.message && typeof errorBody.message === 'object' && (errorBody.message as any)?.code === 'TRIAL_EXPIRED')) {
      const innerMsg = typeof errorBody.message === 'object' ? (errorBody.message as any)?.message : errorBody.message;
      // Dispatch with code at the top level for App.tsx listener
      const detail = { ...errorBody, code: 'TRIAL_EXPIRED', message: innerMsg };
      window.dispatchEvent(new CustomEvent('trial-expired', { detail }));
      const err = new Error(innerMsg || 'Tu período de prueba ha terminado. Actualiza tu plan para continuar.');
      err.name = 'TrialExpiredError';
      throw err;
    }

    // El backend devuelve SESSION_CLOSED anidado en `message` cuando el error
    // se lanza desde la estrategia de Passport, así que se revisan ambos niveles.
    const sessionClosed =
      errorBody?.error === 'SESSION_CLOSED' ||
      (errorBody?.message &&
        typeof errorBody.message === 'object' &&
        (errorBody.message as any)?.error === 'SESSION_CLOSED');
    if (response.status === 401 && sessionClosed) {
      localStorage.removeItem('nh-auth-token');
      const err = new Error('Tu sesión se cerró porque se inició sesión en otro dispositivo.');
      err.name = 'SessionClosedError';
      window.dispatchEvent(new CustomEvent('session-closed', { detail: { code: 'SESSION_CLOSED' } }));
      throw err;
    }

    // Un 401 en una ruta protegida significa que la sesión ya no es válida,
    // aunque el navegador todavía conserve la pantalla anterior. No dejar la
    // interfaz "operativa" ni confundirlo con un 403 de permisos.
    const authFlowPath =
      path === '/auth/login' ||
      path === '/auth/register' ||
      path === '/auth/register-tenant';
    if (response.status === 401 && !authFlowPath) {
      localStorage.removeItem('nh-auth-token');
      const authMessages = extractServerMessages(errorBody);
      const backendMessage = authMessages.find(Boolean)?.trim() || '';
      const isTechnicalAuthMessage = /no autorizado para acceder a nova hub|unauthorized|jwt expired|jwt malformed|invalid token|invalid signature/i.test(backendMessage);
      const message = backendMessage && !isTechnicalAuthMessage
        ? backendMessage
        : 'Tu sesión expiró o no es válida. Inicia sesión nuevamente.';
      const sessionCode = errorBody?.error === 'SESSION_EXPIRED' ||
        (errorBody?.message && typeof errorBody.message === 'object' && (errorBody.message as any)?.error === 'SESSION_EXPIRED')
        ? 'SESSION_EXPIRED'
        : 'SESSION_INVALID';
      const err = new Error(message);
      err.name = 'SessionClosedError';
      window.dispatchEvent(new CustomEvent('session-closed', { detail: { code: sessionCode, message } }));
      throw err;
    }

    // Handle nested message objects (e.g., ForbiddenException wrapping)
    const rawMessage = typeof errorBody?.message === 'object' && errorBody.message !== null
      ? (errorBody.message as any)?.message || (errorBody.message as any)?.error || ''
      : errorBody?.message || '';
    const messages = extractServerMessages(rawMessage ? { ...errorBody, message: rawMessage } : errorBody);
    throw new ApiRequestError(
      normalizeErrorMessage(
        messages.map(humanizeValidationMessage).join('. '),
        response.status,
        context,
        typeof errorBody?.requestId === 'string' ? errorBody.requestId : response.headers.get('X-Request-Id') || undefined,
      ),
      response.status,
      path,
      errorBody?.code,
      messages,
      errorBody
    );
  }

  const text = await response.text();
  try {
    return text ? JSON.parse(text) : (null as T);
  } catch {
    return text as T;
  }
}

/**
 * Announces mutation boundaries to the application shell. The UI uses this
 * only to keep the clicked action busy until the server operation settles;
 * request semantics and idempotency remain inside apiRequestInternal.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || 'GET';
  const isMutation = method !== 'GET';
  const notificationAction = isMutation ? beginNotificationAction() : null;
  if (isMutation) notifyErpMutation('start', method, path);

  try {
    return await apiRequestInternal<T>(path, options);
  } finally {
    if (isMutation) notifyErpMutation('end', method, path);
    completeNotificationAction(notificationAction);
  }
}

export const api = {
  get: <T>(path: string, options?: Record<string, any> | { params?: Record<string, any>; signal?: AbortSignal }) => {
    // Cuando se usa la forma { params, signal }, no confundas el objeto de
    // opciones con los query params si `params` viene vacío/undefined. Antes
    // eso podía serializar AbortSignal como `?signal=[object Object]`.
    const isRequestOptions = Boolean(options && ('params' in options || 'signal' in options));
    const params = isRequestOptions ? (options as any)?.params : options;
    const signal = isRequestOptions ? (options as any)?.signal : undefined;
    if (signal) return apiRequest<T>(path, { method: 'GET', params, signal });

    const token = localStorage.getItem('nh-auth-token') || '';
    const fingerprint = `GET:${buildUrl(path, params)}:${token}`;
    const previous = getInFlight.get(fingerprint) as Promise<T> | undefined;
    if (previous) return previous;

    const request = apiRequest<T>(path, { method: 'GET', params })
      .finally(() => getInFlight.delete(fingerprint));
    getInFlight.set(fingerprint, request);
    return request;
  },

  post: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'POST', body }),

  idempotentPost: <T>(path: string, body: unknown, key?: string) => {
    const requestKey = key || createIdempotencyKey('post');
    const fingerprint = `POST:${path}:${stableRequestKey(body)}`;
    const previous = idempotentInFlight.get(fingerprint) as Promise<T> | undefined;
    if (previous) return previous;
    const request = apiRequest<T>(path, {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': requestKey },
    }).finally(() => idempotentInFlight.delete(fingerprint));
    idempotentInFlight.set(fingerprint, request);
    return request;
  },

  put: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PUT', body }),

  patch: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body }),

  idempotentPatch: <T>(path: string, body: unknown, key?: string) => {
    const requestKey = key || createIdempotencyKey('patch');
    const fingerprint = `PATCH:${path}:${stableRequestKey(body)}`;
    const previous = idempotentInFlight.get(fingerprint) as Promise<T> | undefined;
    if (previous) return previous;
    const request = apiRequest<T>(path, {
      method: 'PATCH',
      body,
      headers: { 'Idempotency-Key': requestKey },
    }).finally(() => idempotentInFlight.delete(fingerprint));
    idempotentInFlight.set(fingerprint, request);
    return request;
  },

  delete: <T>(path: string) =>
    apiRequest<T>(path, { method: 'DELETE' }),
};
