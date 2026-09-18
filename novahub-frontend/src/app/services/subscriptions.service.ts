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
  requestedPlan?: string;
}

export interface UpdateSubscriptionStatusDto {
  status: 'APPROVED' | 'REJECTED';
}

export interface ToggleModuleStatusDto {
  clientTenantId: string;
  module: string;
  isActive: boolean;
  notes?: string;
  price?: number;
}

export type ModuleQuoteRequestTargetType = 'MODULE' | 'VIEW';
export type ModuleQuoteRequestStatus = 'PENDING' | 'IN_REVIEW' | 'QUOTED' | 'ATTENDED' | 'REJECTED';

export interface ModuleQuoteRequest {
  id: string;
  clientTenantId: string;
  targetType: ModuleQuoteRequestTargetType;
  targetId: string;
  parentModuleId: string;
  targetLabel: string;
  parentModuleLabel: string;
  comment?: string | null;
  status: ModuleQuoteRequestStatus;
  reviewNote?: string | null;
  platformQuoteId?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  updatedAt: string;
  clientTenant?: { id: string; name: string; slug: string } | null;
  requestedBy?: { id: string; name: string; email?: string | null } | null;
  reviewedBy?: { id: string; name: string; email?: string | null } | null;
  platformQuote?: { id: string; number: string; status: string } | null;
}

export interface ModuleQuoteCatalogView {
  id: string;
  label: string;
  status: 'ACTIVE' | 'INACTIVE';
  activationSource: 'DIRECT' | 'INHERITED' | 'MIXED' | 'NONE';
  openRequest?: ModuleQuoteRequest | null;
}

export interface ModuleQuoteCatalogModule {
  id: string;
  label: string;
  status: 'ACTIVE' | 'PARTIAL' | 'INACTIVE';
  activationSource: 'DIRECT' | 'INHERITED' | 'MIXED' | 'NONE';
  views: ModuleQuoteCatalogView[];
  openRequest?: ModuleQuoteRequest | null;
}

export interface ModuleQuoteCatalogResponse {
  tenant: { id: string; name: string };
  modules: ModuleQuoteCatalogModule[];
  generatedAt: string;
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

  getCatalog: (signal?: AbortSignal) =>
    api.get<ModuleQuoteCatalogResponse>('/subscriptions/catalog', { signal }),

  getModuleQuoteRequests: (filters?: ApiFilters, signal?: AbortSignal) =>
    api.get<ModuleQuoteRequest[]>('/subscriptions/module-quote-requests', { params: filters as any, signal }),

  createModuleQuoteRequest: (data: { targetType: ModuleQuoteRequestTargetType; targetId: string; comment?: string }) =>
    api.post<ModuleQuoteRequest>('/subscriptions/module-quote-requests', data),

  updateModuleQuoteRequestStatus: (id: string, data: { status: ModuleQuoteRequestStatus; reviewNote?: string }) =>
    api.patch<ModuleQuoteRequest>(`/subscriptions/module-quote-requests/${id}/status`, data),

  convertModuleQuoteRequest: (id: string) =>
    api.post<{ request: ModuleQuoteRequest; quote: any }>(`/subscriptions/module-quote-requests/${id}/convert-to-platform-quote`, {}),
};
