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
  triggerBilling: (id: string) => api.post(`/tenants/${id}/trigger-billing`, {}),
  markInvoiceAsPaid: (invoiceId: string) => api.patch(`/tenants/invoice/${invoiceId}/pay`, {}),
  
  // User management within a tenant
  getUsers: async (tenantId: string) => {
    try {
      return await api.get<TenantUser[]>(`/tenants/${tenantId}/users`);
    } catch (primaryError) {
      try {
        return await api.get<TenantUser[]>('/tenant/users', { tenantId });
      } catch {
        throw primaryError;
      }
    }
  },
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
  
  getBillingHistory: (tenantId: string) => api.get<any>(`/tenants/${tenantId}/billing`),
  getDocuments: (tenantId: string) => api.get<any[]>(`/tenants/${tenantId}/documents`),
  createDocument: (tenantId: string, data: { title: string; type: string; url: string }) =>
    api.post(`/tenants/${tenantId}/documents`, data),
  deleteDocument: (tenantId: string, docId: string) =>
    api.delete(`/tenants/${tenantId}/documents/${docId}`),
};
