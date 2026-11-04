export type AuditOperationMethod = 'MANUAL' | 'IMPORT' | 'SYSTEM';

type AuditRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is AuditRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseRecord = (value: unknown): AuditRecord | null => {
  if (isRecord(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export function getAuditOperationMethod(log: unknown): AuditOperationMethod | null {
  if (!isRecord(log)) return null;

  const metadata = parseRecord(log.metadata);
  const details = parseRecord(log.details);
  const methodValues = [log.operationMethod, metadata?.operationMethod, details?.operationMethod];
  for (const value of methodValues) {
    const method = String(value || '').trim().toUpperCase();
    if (method === 'MANUAL' || method === 'IMPORT' || method === 'SYSTEM') return method;
  }

  const sourceValues = [log.source, metadata?.source, details?.source];
  if (sourceValues.some((source) => String(source || '').trim().toUpperCase() === 'BULK_IMPORT')) return 'IMPORT';

  const actionValues = [log.action, log.actionType];
  if (actionValues.some((action) => String(action || '').trim().toUpperCase() === 'IMPORT')) return 'IMPORT';

  return null;
}

export function auditOperationMethodLabel(method: AuditOperationMethod | null): string {
  switch (method) {
    case 'MANUAL': return 'Registro manual en el sistema';
    case 'IMPORT': return 'Importación';
    case 'SYSTEM': return 'Proceso automático';
    default: return 'Método no registrado';
  }
}

export function getAuditOperationMethodLabel(log: unknown): string {
  return auditOperationMethodLabel(getAuditOperationMethod(log));
}
