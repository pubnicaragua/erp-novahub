import type { Page, Request } from '@playwright/test';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface ApiCallRecord {
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  contentType?: string;
  idempotencyKey?: string;
  requestBody?: string | null;
}

export interface ApiValidationOptions {
  since?: number;
  methods?: readonly string[];
  urlIncludes?: string;
  requireIdempotencyKey?: boolean;
  requireJsonContentType?: boolean;
  validateRequestPayload?: boolean;
  maxLatencyMs?: number;
}

function isApiRequest(url: string): boolean {
  try {
    return new URL(url).pathname.includes('/api/');
  } catch {
    return url.includes('/api/');
  }
}

export class ApiInterceptor {
  private readonly calls: ApiCallRecord[] = [];
  private readonly startedAt = new WeakMap<Request, number>();

  constructor(page: Page) {
    page.on('request', (request) => {
      if (!isApiRequest(request.url())) return;
      this.startedAt.set(request, performance.now());
    });

    page.on('response', (response) => {
      if (!isApiRequest(response.url())) return;
      const request = response.request();
      const start = this.startedAt.get(request);
      const record: ApiCallRecord = {
        method: request.method(),
        url: response.url(),
        status: response.status(),
        durationMs: start === undefined ? undefined : Math.round(performance.now() - start),
        contentType: response.headers()['content-type'],
        idempotencyKey: request.headers()['idempotency-key'],
        requestBody: request.postData(),
      };
      this.calls.push(record);
    });
  }

  mark(): number {
    return this.calls.length;
  }

  records(options: ApiValidationOptions = {}): ApiCallRecord[] {
    const methods = options.methods?.map((method) => method.toUpperCase());
    return this.calls.slice(options.since ?? 0).filter((record) => {
      if (methods && !methods.includes(record.method.toUpperCase())) return false;
      if (options.urlIncludes && !record.url.includes(options.urlIncludes)) return false;
      return true;
    });
  }

  assertSuccessful(options: ApiValidationOptions = {}): ApiCallRecord[] {
    const records = this.records(options);
    if (records.length === 0) {
      throw new Error(`No se capturó una petición /api/* para ${options.urlIncludes || 'la acción esperada'}`);
    }

    const maxLatencyMs = options.maxLatencyMs ?? 5000;
    const failures = records.filter((record) => record.status === undefined || record.status >= 400);
    if (failures.length > 0) {
      throw new Error(`La API devolvió errores: ${JSON.stringify(failures)}`);
    }

    const slow = records.filter((record) => record.durationMs !== undefined && record.durationMs > maxLatencyMs);
    if (slow.length > 0) {
      throw new Error(`La API excedió ${maxLatencyMs} ms: ${JSON.stringify(slow)}`);
    }

    if (options.requireIdempotencyKey) {
      const missing = records.filter((record) => MUTATION_METHODS.has(record.method.toUpperCase()) && !record.idempotencyKey);
      if (missing.length > 0) {
        throw new Error(`Falta Idempotency-Key en mutaciones críticas: ${JSON.stringify(missing)}`);
      }
    }

    if (options.requireJsonContentType) {
      const nonJson = records.filter((record) => (
        record.status !== 204
        && !(record.contentType || '').toLowerCase().includes('application/json')
      ));
      if (nonJson.length > 0) {
        throw new Error(`La API crítica no devolvió JSON: ${JSON.stringify(nonJson)}`);
      }
    }

    if (options.validateRequestPayload) {
      const invalidPayloads = records.filter((record) => {
        if (!MUTATION_METHODS.has(record.method.toUpperCase()) || !record.requestBody) return false;
        try {
          JSON.parse(record.requestBody);
          return false;
        } catch {
          return true;
        }
      });
      if (invalidPayloads.length > 0) {
        throw new Error(`La mutación envió un payload que no es JSON válido: ${JSON.stringify(invalidPayloads)}`);
      }
    }
    return records;
  }

  assertNoServerErrors(): void {
    const failures = this.calls.filter((record) => record.status !== undefined && record.status >= 500);
    if (failures.length > 0) throw new Error(`Se capturaron respuestas 5xx: ${JSON.stringify(failures)}`);
  }
}
