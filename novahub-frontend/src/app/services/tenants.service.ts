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
    password?: string;
  };
  adminEmail?: string;
  adminName?: string;
}

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: string;
  customRoleId?: string | null;
  customRole?: { id: string; name: string; allowedModules: string[] } | null;
  isActive: boolean;
  avatar?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

export const tenantsService = {
  getAll: () => api.get<any[]>('/tenants'),
  getOne: (id: string) => api.get<any>(`/tenants/${id}`),
  create: (data: CreateTenantDto) => api.post<any>('/tenants', data),
  update: (id: string, data: any) => api.patch<any>(`/tenants/${id}`, data),
  delete: (id: string) => api.delete(`/tenants/${id}`),
  
  // User management within a tenant
  getUsers: (tenantId: string) => api.get<TenantUser[]>(`/tenants/${tenantId}/users`),
  addUser: (data: { 
    clientTenantId: string; 
    name: string; 
    email: string; 
    password?: string;
    role?: string;
    avatar?: string | null;
  }) => api.post(`/tenants/${data.clientTenantId}/users`, data),
  updateUser: (tenantId: string, userId: string, data: {
    name?: string;
    email?: string;
    role?: string;
    customRoleId?: string | null;
    isActive?: boolean;
    password?: string;
  }) => api.patch(`/tenants/${tenantId}/users/${userId}`, data),
  deleteUser: (tenantId: string, userId: string) => api.delete(`/tenants/${tenantId}/users/${userId}`),
};
