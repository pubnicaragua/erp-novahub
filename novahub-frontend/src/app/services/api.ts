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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, headers = {} } = options;

  const response = await fetch(buildUrl(path, params), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error de red' }));
    throw new Error(error.message || `HTTP Error ${response.status}`);
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
