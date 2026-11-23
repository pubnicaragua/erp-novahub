type TenantAdminApiUser = {
  clientTenantId?: unknown;
  isTenantAdmin?: unknown;
};

type TenantAdminIdentity = {
  role: string;
  userType: string;
  isPlatformAdmin: boolean;
  isPlatformSupportAgent: boolean;
};

/** Uses the backend's authoritative classification when present and keeps old session payloads compatible. */
export function resolveTenantAdminIdentity(apiUser: TenantAdminApiUser, identity: TenantAdminIdentity): boolean {
  const hasTenant = Boolean(apiUser.clientTenantId);
  const isExcludedIdentity = identity.isPlatformAdmin
    || identity.isPlatformSupportAgent
    || identity.userType === 'manager'
    || identity.userType === 'customer_portal';
  if (!hasTenant || isExcludedIdentity) return false;
  if (typeof apiUser.isTenantAdmin === 'boolean') return apiUser.isTenantAdmin;
  return identity.userType === 'admin' || identity.role === 'admin';
}
