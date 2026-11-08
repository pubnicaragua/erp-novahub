interface OrderableEmployee { employeeNumber?: string | null; employmentStatus?: string | null; firstName?: string | null; lastName?: string | null }

/** 0 = trabaja en la empresa (activo o con permiso), 1 = inactivo, 2 = terminado. */
export function employeeStatusRank(status?: string | null): number {
  const value = String(status || '').toUpperCase();
  if (value === 'TERMINATED') return 2;
  if (value === 'INACTIVE') return 1;
  return 0;
}

export const EMPLOYEE_STATUS_SUFFIX: Record<string, string> = { INACTIVE: 'Inactivo', TERMINATED: 'Terminado' };

/** Orden de la lista de empleados: primero los activos, por código de empleado (123 antes que 1000); inactivos y terminados al final. */
export function compareEmployees(a: OrderableEmployee, b: OrderableEmployee): number {
  const rank = employeeStatusRank(a.employmentStatus) - employeeStatusRank(b.employmentStatus);
  if (rank) return rank;
  const byNumber = String(a.employeeNumber ?? '').localeCompare(String(b.employeeNumber ?? ''), 'es', { numeric: true, sensitivity: 'base' });
  if (byNumber) return byNumber;
  return `${a.firstName ?? ''} ${a.lastName ?? ''}`.localeCompare(`${b.firstName ?? ''} ${b.lastName ?? ''}`, 'es', { sensitivity: 'base' });
}

export const sortEmployees = <T extends OrderableEmployee>(employees: readonly T[] | null | undefined): T[] => [...(employees ?? [])].sort(compareEmployees);
