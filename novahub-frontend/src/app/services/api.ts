// ============================================================
// Nova Hub ERP - Base API Service
// Configure BASE_URL to point to your NestJS backend
// ============================================================

import { isSafeAuthToken } from './auth-token';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
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

interface ApiErrorBody {
  message?: string | string[] | Record<string, any>;
  error?: string;
  details?: string | string[];
  code?: string;
  matches?: unknown[];
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

  if (route === '/caja/sessions/open') return 'aperturar la caja';
  if (route.startsWith('/caja/sessions/active/')) return 'consultar la sesion activa de caja';
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
  if (route === '/auth/login') return 'iniciar sesion';
  if (route === '/auth/switch-context') return 'restaurar el contexto de trabajo';
  if (action === 'GET') return 'cargar la informacion';
  if (action === 'POST') return 'guardar la informacion';
  if (action === 'PUT' || action === 'PATCH') return 'actualizar la informacion';
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

function humanize403Message(raw: string, context?: string): string {
  let msg = raw;

  // Reemplazar permisos tecnicos (read, write, etc.)
  msg = msg.replace(/permiso\s+'(\w+)'/gi, (_, perm) => {
    const label = PERMISSION_LABELS[perm.toLowerCase()] || perm;
    return `permiso de ${label}`;
  });

  // Reemplazar codigos de modulo por nombres amigables
  msg = msg.replace(/\b(INVENTORY_WAREHOUSES|INVENTORY|SALES|PURCHASES|POS|REPORTS|USERS|BRANCHES|SETTINGS|SUBSCRIPTIONS)\b/g, (code) => {
    return MODULE_LABELS[code] || code;
  });

  const technical = /forbidden|insufficient|permission denied|not authorized|unauthorized|access denied/i.test(msg);
  if (technical) {
    return context
      ? `No tienes acceso para ${context}. Solicita al administrador que habilite este permiso.`
      : 'No tienes acceso a este módulo o acción. Solicita al administrador que habilite este permiso.';
  }
  return msg;
}

function normalizeErrorMessage(message?: string, status?: number, context?: string): string {
  const raw = (message || '').trim();
  const lower = raw.toLowerCase();
  const prefix = context ? `No se pudo ${context}. ` : '';

  // Always prefer the backend's message when available
  if (raw) {
    // Only use custom replacements for known technical messages
    if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed')) {
      return 'No se pudo conectar con el servidor. Revisa tu conexion o confirma que el backend este encendido.';
    }
    if (lower.includes('column') && lower.includes('does not exist')) {
      return `${prefix}La base de datos no tiene una columna requerida por esta version del sistema. Aplica las migraciones pendientes.`;
    }
    if (lower.includes('unique constraint failed') || lower.includes('already exists')) {
      return `${prefix}Ya existe un registro con esos datos.`;
    }
    if (lower.startsWith('http error') && status) {
      return normalizeErrorMessage('', status, context);
    }
    // Para errores 403, traducir terminos tecnicos a mensajes amigables
    if (status === 403 && raw) return humanize403Message(raw, context);
    // Return the backend message as-is (with prefix for context)
    return prefix && !lower.startsWith('no se pudo') ? `${prefix}${raw}` : raw;
  }

  // Generic fallbacks when no backend message
  if (status === 400) return `${prefix}Revisa los datos enviados; hay informacion incompleta o invalida.`;
  if (status === 401) return 'Tu sesion expiro o no esta autorizada. Inicia sesion nuevamente.';
  if (status === 403) return `${prefix}Tu usuario no tiene permisos para realizar esta accion.`;
  if (status === 404) return `${prefix}No se encontro el registro solicitado o ya no esta disponible.`;
  if (status === 409) return `${prefix}Hay un conflicto con un registro existente.`;
  if (status === 422) return `${prefix}La informacion enviada no cumple las reglas de validacion.`;
  if ((status || 0) >= 500) {
    return `${prefix}El servidor encontro un problema interno (HTTP ${status}). Si el modulo fue actualizado recientemente, verifica que las migraciones de base de datos esten aplicadas.`;
  }
  return `${prefix}Ocurrio un error inesperado.`;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function extractServerMessages(errorBody: ApiErrorBody | null) {
  if (!errorBody) return [];
  return [
    ...asTextList(typeof errorBody.message === 'object' ? (errorBody.message as any)?.message || (errorBody.message as any)?.error : errorBody.message),
    ...asTextList(errorBody.details),
    ...asTextList(errorBody.error),
  ];
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, headers = {}, signal } = options;
  const context = describeRequest(path, method);

  let response: Response;
  const requestInit: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...headers,
      },
      cache: 'no-store',
      body: body ? JSON.stringify(body) : undefined,
      signal,
  };
  try {
    response = await fetch(buildUrl(path, params), requestInit);
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
        response = await fetch(buildUrl(path, params), requestInit);
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
      errorBody = await response.json();
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

    // Un 401 genérico con token presente significa que el token expiró o fue
    // revocado. No dejar la interfaz "operativa": se limpia el token y se fuerza
    // la expulsión a login. Se excluyen las rutas de arranque/login donde un 401
    // es un flujo normal (credenciales incorrectas o perfil aún sin restaurar).
    const authFlowPath =
      path === '/auth/login' ||
      path === '/auth/register' ||
      path === '/auth/register-tenant' ||
      path === '/auth/session-status' ||
      path === '/auth/me/branches' ||
      path === '/auth/switch-context';
    if (response.status === 401 && !authFlowPath && localStorage.getItem('nh-auth-token')) {
      localStorage.removeItem('nh-auth-token');
      const err = new Error('Tu sesión expiró. Inicia sesión nuevamente.');
      err.name = 'SessionClosedError';
      window.dispatchEvent(new CustomEvent('session-closed', { detail: { code: 'SESSION_CLOSED' } }));
      throw err;
    }

    // Handle nested message objects (e.g., ForbiddenException wrapping)
    const rawMessage = typeof errorBody?.message === 'object' && errorBody.message !== null
      ? (errorBody.message as any)?.message || (errorBody.message as any)?.error || ''
      : errorBody?.message || '';
    const messages = extractServerMessages(rawMessage ? { ...errorBody, message: rawMessage } : errorBody);
    throw new ApiRequestError(
      normalizeErrorMessage(messages.join('. '), response.status, context),
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
