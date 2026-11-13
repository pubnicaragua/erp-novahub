import { api } from './api';

export interface TenantFeatureBranch {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  requiredModuleActive: boolean;
  available: boolean;
}

export interface TenantFeatureCandidate extends Omit<TenantFeatureBranch, 'available'> {
  eligible: boolean;
}

export interface TenantFeatureDefinition {
  key: string;
  label: string;
  description: string;
  disabledDescription?: string;
  requiredModule?: string;
  enabledCount: number;
  branches: TenantFeatureBranch[];
}

export function canManageTenantFeatures(role?: string | null) {
  const normalizedRole = String(role || '').toUpperCase().replace(/[-\s]/g, '_');
  return ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPERADMIN'].includes(normalizedRole);
}

export const tenantFeaturesService = {
  getCatalog: (signal?: AbortSignal) =>
    api.get<TenantFeatureDefinition[]>('/tenant-features/platform/catalog', { signal }),

  searchBranches: (featureKey: string, search: string, signal?: AbortSignal) =>
    api.get<TenantFeatureCandidate[]>(`/tenant-features/platform/catalog/${encodeURIComponent(featureKey)}/branches`, {
      params: { search: search || undefined },
      signal,
    }),

  setAssignment: (featureKey: string, clientTenantId: string, enabled: boolean) =>
    api.patch(`/tenant-features/platform/assignments/${encodeURIComponent(featureKey)}/${encodeURIComponent(clientTenantId)}`, { enabled }),
};
