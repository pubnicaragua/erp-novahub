import { api } from './api';
import type { PaginatedResponse, ApiFilters } from '../types';

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

export const subscriptionsService = {
  createRequest: (data: CreateSubscriptionRequestDto) => 
    api.post<SubscriptionRequest>('/subscriptions/request', data),
    
  getAllRequests: () => 
    api.get<SubscriptionRequest[]>('/subscriptions/requests'),
    
  getPartnerRequests: () => 
    api.get<SubscriptionRequest[]>('/subscriptions/requests/partner'),
    
  updateRequestStatus: (id: string, data: UpdateSubscriptionStatusDto) => 
    api.patch<SubscriptionRequest>(`/subscriptions/requests/${id}/status`, data),
    
  getEnabledModules: (clientTenantId: string) => 
    api.get<string[]>(`/subscriptions/enabled/${clientTenantId}`),
};
