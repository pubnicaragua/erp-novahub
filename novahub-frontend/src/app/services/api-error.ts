export interface ApiErrorBody {
  message?: string | string[] | Record<string, unknown>;
  error?: string;
  details?: string | string[];
  code?: string;
  matches?: unknown[];
  [key: string]: unknown;
}

export function normalizeApiErrorBody(body: unknown): ApiErrorBody | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const outer = body as ApiErrorBody;
  const nestedMessage = outer.message;
  if (!nestedMessage || typeof nestedMessage !== 'object' || Array.isArray(nestedMessage)) return outer;

  const nested = nestedMessage as ApiErrorBody;
  return {
    ...outer,
    ...nested,
    message: nested.message ?? '',
  };
}
