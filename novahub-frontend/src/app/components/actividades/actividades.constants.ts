import type { ActivityCategory, ActivityCustomField } from '../../types';

export interface ActivityCategoryOption {
  value: ActivityCategory;
  label: string;
}

export interface CustomFieldPreset {
  key: string;
  label: string;
  placeholder: string;
}

/** Catálogo cerrado de categorías (§4). Mismos slugs que valida el backend. */
export const ACTIVITY_CATEGORIES: ActivityCategoryOption[] = [
  { value: 'INFRAESTRUCTURA', label: 'Infraestructura' },
  { value: 'SISTEMAS', label: 'Sistemas' },
  { value: 'OPERACIONES', label: 'Operaciones' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'RECURSOS_HUMANOS', label: 'Recursos Humanos' },
];

export const ACTIVITY_CATEGORY_VALUES: ActivityCategory[] = ACTIVITY_CATEGORIES.map((c) => c.value);

export const isActivityCategory = (value: unknown): value is ActivityCategory =>
  typeof value === 'string' && (ACTIVITY_CATEGORY_VALUES as string[]).includes(value);

export const getActivityCategoryLabel = (value?: string | null): string =>
  ACTIVITY_CATEGORIES.find((c) => c.value === String(value || '').toUpperCase())?.label ?? '—';

/** Campos sugeridos en el formulario de creación/edición. Editables por el usuario (§7). */
export const CUSTOM_FIELD_PRESETS: CustomFieldPreset[] = [
  { key: 'servicioAfectado', label: 'Servicio afectado', placeholder: 'Ej. CRM' },
  { key: 'ubicacionTrabajo', label: 'Ubicación de trabajo', placeholder: 'Ej. Sucursal Norte' },
  { key: 'codigoActivo', label: 'Código de activo', placeholder: 'Ej. ACT-0042' },
];

export const MAX_CUSTOM_FIELDS = 10;
export const MAX_CUSTOM_FIELD_LENGTH = 100;

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  return '';
};

const cleanField = (key: unknown, value: unknown): ActivityCustomField | null => {
  const cleanKey = toText(key).trim();
  if (!cleanKey) return null;
  return {
    key: cleanKey.slice(0, MAX_CUSTOM_FIELD_LENGTH),
    value: toText(value).trim().slice(0, MAX_CUSTOM_FIELD_LENGTH),
  };
};

/**
 * Normaliza `customFields` (Json de Prisma) a `ActivityCustomField[]` (§6).
 * Acepta objeto plano `Record<string, string>`, array `{ key, value }` o basura
 * (null, números, cadenas) sin lanzar. Claves vacías se descartan y se
 * deduplican por clave conservando la primera aparición.
 */
export const normalizeCustomFields = (input: unknown): ActivityCustomField[] => {
  if (!input) return [];

  const pairs: Array<[unknown, unknown]> = Array.isArray(input)
    ? input.map((entry) => {
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          return [record.key ?? record.name ?? record.label, record.value ?? record.val] as [unknown, unknown];
        }
        return [null, entry] as [unknown, unknown];
      })
    : typeof input === 'object'
      ? Object.entries(input as Record<string, unknown>)
      : [];

  const seen = new Set<string>();
  const result: ActivityCustomField[] = [];
  for (const [key, value] of pairs) {
    const field = cleanField(key, value);
    if (!field || seen.has(field.key)) continue;
    seen.add(field.key);
    result.push(field);
    if (result.length >= MAX_CUSTOM_FIELDS) break;
  }
  return result;
};

/** Inverso de `normalizeCustomFields` para enviar el `Json` plano de §7. */
export const toCustomFieldsRecord = (fields: ActivityCustomField[] | null | undefined): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const field of normalizeCustomFields(fields)) {
    result[field.key] = field.value;
  }
  return result;
};
