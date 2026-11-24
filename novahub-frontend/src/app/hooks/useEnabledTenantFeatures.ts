import { useTenantQuery } from './useTenantQuery';
import { tenantFeaturesService } from '../services/tenant-features.service';

/**
 * Funciones específicas que el superadmin habilitó para la empresa de la sesión (p. ej. FLEET_TRIP_COSTS).
 * Mientras carga o si falla la consulta, la lista es vacía: una función sensible nunca se muestra "por si acaso".
 */
export function useEnabledTenantFeatures(enabled = true) {
  const query = useTenantQuery<string[]>(['tenant-features', 'me'], (signal) => tenantFeaturesService.getMine(signal), { enabled, retry: 1 });
  const keys = Array.isArray(query.data) ? query.data : [];
  return { features: keys, has: (key: string) => keys.includes(key), isLoading: query.isLoading };
}
