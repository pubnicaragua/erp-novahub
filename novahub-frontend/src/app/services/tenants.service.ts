import { api } from './api';

export interface CreateTenantDto {
  name: string;
  slug: string;
  plan?: string;
  industry?: string;
  logo?: string;
  adminUser?: {
    name: string;
    email: string;
    password: string;
  };
  adminEmail?: string;
  adminName?: string;
  adminPassword: string;
}

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: string;
  customRoleId?: string | null;
  customRole?: { id: string; name: string; permissions?: any; allowedModules: string[] } | null;
  departments?: Array<{ id: string; code?: string; name: string; isPrimary?: boolean }>;
  departmentMemberships?: Array<{ id: string; isPrimary: boolean; department: { id: string; name: string } }>;
  employeeDepartmentMemberships?: Array<{ isPrimary: boolean; department: { id: string; name: string } }>;
  employee?: { id: string; employeeNumber: string; firstName: string; lastName: string; isSeller: boolean; employmentStatus: string } | null;
  isActive: boolean;
  avatar?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

export const tenantsService = {
  getAll: (filters?: Record<string, any>, signal?: AbortSignal) => api.get<any[]>('/tenants', { params: filters, signal }),
  getOne: (id: string, signal?: AbortSignal) => api.get<any>(`/tenants/${id}`, { signal }),
  create: (data: CreateTenantDto) => api.post<any>('/tenants', data),
  update: (id: string, data: any) => api.patch<any>(`/tenants/${id}`, data),
  delete: (id: string) => api.delete(`/tenants/${id}`),
  
  // User management within a tenant
  getUsers: (tenantId: string, signal?: AbortSignal) => api.get<TenantUser[]>(`/tenants/${tenantId}/users`, { signal }),
  addUser: (data: { 
    clientTenantId: string; 
    name: string; 
    email: string; 
    password: string;
    role?: string;
    avatar?: string | null;
    departmentId?: string | null;
    employeeId?: string | null;
  }) => api.post(`/tenants/${data.clientTenantId}/users`, data),
  updateUser: (tenantId: string, userId: string, data: {
    name?: string;
    email?: string;
    role?: string;
    customRoleId?: string | null;
    isActive?: boolean;
    password?: string;
  }) => api.patch(`/tenants/${tenantId}/users/${userId}`, data),
  updateUserDepartments: (tenantId: string, userId: string, departmentIds: string[], primaryDepartmentId?: string | null) =>
    api.put(`/tenants/${tenantId}/users/${userId}/departments`, { departmentIds, primaryDepartmentId }),
  linkUserToEmployee: (tenantId: string, userId: string, employeeId: string) =>
    api.put(`/tenants/${tenantId}/users/${userId}/employee/${employeeId}`),
  unlinkUserFromEmployee: (tenantId: string, userId: string) =>
    api.delete(`/tenants/${tenantId}/users/${userId}/employee`),
  deleteUser: (tenantId: string, userId: string) => api.delete(`/tenants/${tenantId}/users/${userId}`),

  getUserAccess: (tenantId: string, userId: string) =>
    api.get<{ warehouseIds: string[]; cashRegisterIds: string[] }>(`/tenants/${tenantId}/users/${userId}/access`),
  updateUserAccess: (tenantId: string, userId: string, data: { warehouseIds: string[]; cashRegisterIds: string[] }) =>
    api.put<{ success: boolean }>(`/tenants/${tenantId}/users/${userId}/access`, data),
};
