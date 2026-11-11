import { useQueryClient } from '@tanstack/react-query';

/** Refresca todas las consultas de Flota después de guardar o borrar algo. */
export function useFleetRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ predicate: (query) => query.queryKey.includes('fleet') });
}

export function formatNumber(value: string | number | null | undefined, digits = 2) {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('es-NI', { minimumFractionDigits: 0, maximumFractionDigits: digits }) : '—';
}

export const VEHICLE_STATUS_LABEL: Record<string, string> = { ACTIVE: 'Activo', MAINTENANCE: 'En taller', INACTIVE: 'Inactivo' };
export const COST_KIND_LABEL: Record<string, string> = { AMOUNT: 'Monto', PERCENT: 'Porcentaje', FORMULA: 'Fórmula' };
