// ============================================================
// Nova Hub ERP - Base API Service
// Configure BASE_URL to point to your NestJS backend
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
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

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('nh-auth-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeErrorMessage(message?: string, status?: number): string {
  const raw = (message || '').trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    if (status === 400) return 'Solicitud inválida.';
    if (status === 401) return 'No autorizado. Inicia sesión nuevamente.';
    if (status === 403) return 'No tienes permisos para realizar esta acción.';
    if (status === 404) return 'No se encontró el recurso solicitado.';
    if ((status || 0) >= 500) return 'Ocurrió un error interno del servidor.';
    return 'Ocurrió un error inesperado.';
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed')) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.';
  }
  if (lower.includes('forbidden')) return 'No tienes permisos para realizar esta acción.';
  if (lower.includes('unauthorized')) return 'No autorizado. Inicia sesión nuevamente.';
  if (lower.includes('not found')) return 'No se encontró el recurso solicitado.';
  if (lower.includes('internal server error')) return 'Ocurrió un error interno del servidor.';
  if (lower.includes('bad request')) return 'Solicitud inválida. Verifica la información enviada.';
  if (lower.includes('unique constraint failed') || lower.includes('already exists')) {
    return 'Ya existe un registro con esos datos.';
  }
  if (lower.startsWith('http error') && status) {
    return normalizeErrorMessage('', status);
  }

  return raw;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, headers = {} } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error: any) {
    throw new Error(normalizeErrorMessage(error?.message));
  }

  if (!response.ok) {
    let serverMessage = '';
    try {
      const error = await response.json();
      if (Array.isArray(error?.message)) {
        serverMessage = error.message.join(', ');
      } else {
        serverMessage = error?.message || error?.error || '';
      }
    } catch {
      serverMessage = '';
    }
    throw new Error(normalizeErrorMessage(serverMessage, response.status));
  }

  return response.json();
}

// Convenience methods
export const api = {
  get: <T>(path: string, options?: Record<string, any> | { params?: Record<string, any> }) => {
    const params = options?.params ?? options;
    return apiRequest<T>(path, { method: 'GET', params });
  },

  post: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'POST', body }),

  put: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PUT', body }),

  patch: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body }),

  delete: <T>(path: string) =>
    apiRequest<T>(path, { method: 'DELETE' }),
};
