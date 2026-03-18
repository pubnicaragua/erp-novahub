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

export const tenantsService = {
  getAll: () => api.get<any[]>('/tenants'),
  getOne: (id: string) => api.get<any>(`/tenants/${id}`),
  create: (data: CreateTenantDto) => api.post<any>('/tenants', data),
  update: (id: string, data: any) => api.patch<any>(`/tenants/${id}`, data),
  delete: (id: string) => api.delete(`/tenants/${id}`),
  addUser: (data: { 
    clientTenantId: string; 
    name: string; 
    email: string; 
    password?: string;
    role?: string;
    avatar?: string | null;
  }) => api.post(`/tenants/${data.clientTenantId}/users`, data),
};
