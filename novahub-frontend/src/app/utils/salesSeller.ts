type SellerSessionUser = {
  clientTenantId?: string | null;
  tenantId?: string | null;
  employee?: {
    id?: string | null;
    isSeller?: boolean;
    employmentStatus?: string | null;
    clientTenantId?: string | null;
  } | null;
} | null | undefined;

/**
 * Devuelve el empleado vendedor vinculado al usuario de la sesión.
 *
 * `isSeller` es una propiedad derivada de Recursos Humanos. No se infiere a
 * partir del rol del usuario: una persona puede tener acceso al ERP sin ser
 * vendedor.
 */
export function getLoggedInSellerEmployeeId(user: SellerSessionUser): string {
  const employee = user?.employee;
  if (!employee?.id || employee.isSeller !== true) return '';

  const employmentStatus = String(employee.employmentStatus || '').toUpperCase();
  if (employmentStatus && employmentStatus !== 'ACTIVE') return '';

  const currentTenantId = String(user?.clientTenantId || user?.tenantId || '').trim();
  const employeeTenantId = String(employee.clientTenantId || '').trim();
  if (currentTenantId && employeeTenantId && currentTenantId !== employeeTenantId) return '';

  return employee.id;
}

export function isLoggedInSeller(user: SellerSessionUser): boolean {
  return Boolean(getLoggedInSellerEmployeeId(user));
}
