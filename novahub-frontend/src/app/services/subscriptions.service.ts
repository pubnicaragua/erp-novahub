import { api } from './api';
import type { ApiFilters } from '../types';

export interface SubscriptionRequest {
  id: string;
  clientTenantId: string;
  requestedModule: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  customPrice?: number;
  notes?: string;
  partnerId: string;
  createdAt: string;
  updatedAt: string;
  clientTenant?: {
    name: string;
    slug: string;
  };
  partner?: {
    name: string;
  };
}

export interface CreateSubscriptionRequestDto {
  clientTenantId: string;
  requestedModule: string;
  customPrice?: number;
  notes?: string;
}

export interface UpdateSubscriptionStatusDto {
  status: 'APPROVED' | 'REJECTED';
}

export interface ToggleModuleStatusDto {
  clientTenantId: string;
  module: string;
  isActive: boolean;
  notes?: string;
}

export const subscriptionsService = {
  createRequest: (data: CreateSubscriptionRequestDto) => 
    api.post<SubscriptionRequest>('/subscriptions/request', data),
    
  getAllRequests: (filters?: ApiFilters, signal?: AbortSignal) =>
    api.get<SubscriptionRequest[]>('/subscriptions/requests', { params: filters as any, signal }),
    
  getPartnerRequests: (filters?: ApiFilters, signal?: AbortSignal) =>
    api.get<SubscriptionRequest[]>('/subscriptions/requests/partner', { params: filters as any, signal }),
    
  updateRequestStatus: (id: string, data: UpdateSubscriptionStatusDto) => 
    api.patch<SubscriptionRequest>(`/subscriptions/requests/${id}/status`, data),

  toggleModuleStatus: (data: ToggleModuleStatusDto) =>
    api.patch('/subscriptions/module-status', data),
    
  getEnabledModules: (clientTenantId: string, filters?: ApiFilters, signal?: AbortSignal) =>
    api.get<string[]>(`/subscriptions/enabled/${clientTenantId}`, { params: filters as any, signal }),
};
