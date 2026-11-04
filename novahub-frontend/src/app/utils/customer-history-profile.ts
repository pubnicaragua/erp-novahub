export type CustomerHistoryProfile = {
  activityType: string;
  recordCountLabel: string;
  measureLabel: string | null;
  measureUnit: string | null;
  configured: boolean;
};

export const DEFAULT_CUSTOMER_HISTORY_PROFILE: CustomerHistoryProfile = {
  activityType: 'Actividad histórica',
  recordCountLabel: 'Registros',
  measureLabel: null,
  measureUnit: null,
  configured: false,
};

export function normalizeCustomerHistoryProfile(value: unknown): CustomerHistoryProfile {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CUSTOMER_HISTORY_PROFILE };
  const profile = value as Record<string, unknown>;
  const activityType = String(profile.activityType ?? '').trim();
  const recordCountLabel = String(profile.recordCountLabel ?? '').trim();
  const measureLabel = String(profile.measureLabel ?? '').trim() || null;
  const measureUnit = String(profile.measureUnit ?? '').trim() || null;
  if (!activityType || !recordCountLabel || (measureUnit && !measureLabel)) {
    return { ...DEFAULT_CUSTOMER_HISTORY_PROFILE };
  }
  return {
    activityType,
    recordCountLabel,
    measureLabel,
    measureUnit,
    configured: profile.configured === true,
  };
}

export function buildCustomerHistoryTemplateHeaders(profile: CustomerHistoryProfile): string[] {
  return [
    'Nombre',
    'Identificación',
    'Total',
    profile.measureLabel || 'Medida',
    'Número de documento',
    'Moneda',
    'TipoActividad',
  ];
}
