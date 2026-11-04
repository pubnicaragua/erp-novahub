import { useQueryClient } from '@tanstack/react-query';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { marketingApi } from '../../services/marketing.service';
import { toInputDate, toInputDateTime } from './marketing.constants';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'tags';
export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  hint?: string;
  span?: 1 | 2;
  placeholder?: string;
};
export type FormValues = Record<string, string>;

const CONVERTERS: Record<FieldType, (v: string) => unknown> = {
  text: (v) => v.trim(), textarea: (v) => v.trim(), select: (v) => v,
  number: (v) => (v === '' ? null : Number(v)),
  date: (v) => (v ? new Date(`${v}T12:00:00`).toISOString() : null),
  datetime: (v) => (v ? new Date(v).toISOString() : null),
  tags: (v) => v.split(',').map((t) => t.trim()).filter(Boolean),
};

/** Valores del formulario → payload de la API. */
export function toPayload(fields: FieldDef[], values: FormValues) {
  const out: Record<string, unknown> = {};
  for (const f of fields) out[f.key] = CONVERTERS[f.type](values[f.key] ?? '');
  return out;
}

/** Registro de la API → valores iniciales del formulario. */
export function toInitial(fields: FieldDef[], row?: object | null): FormValues {
  const source = (row ?? {}) as Record<string, unknown>;
  return Object.fromEntries(fields.map((f) => {
    const v = source[f.key];
    if (v === null || v === undefined) return [f.key, ''];
    if (f.type === 'date') return [f.key, toInputDate(String(v))];
    if (f.type === 'datetime') return [f.key, toInputDateTime(String(v))];
    if (f.type === 'tags') return [f.key, Array.isArray(v) ? v.join(', ') : String(v)];
    return [f.key, String(v)];
  }));
}

export const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));
export const userOptions = (users?: Array<{ id: string; name: string }>) => (users ?? []).map((u) => ({ value: u.id, label: u.name }));
export const userName = (users: Array<{ id: string; name: string }> | undefined, id?: string | null) => (id && users?.find((u) => u.id === id)?.name) || '—';

/** Invalida las consultas de módulo del tenant (los datos de Marketing viven bajo `tenant-module`). */
export function useMktRefresh() {
  const client = useQueryClient();
  return () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };
}

export function useMktUsers() {
  return useTenantQuery(['marketing', 'users'], (signal) => marketingApi.users(signal), { staleTime: 5 * 60_000 });
}

export function useMktConfig() {
  return useTenantQuery(['marketing', 'settings'], (signal) => marketingApi.settings(signal), { staleTime: 60_000 });
}
