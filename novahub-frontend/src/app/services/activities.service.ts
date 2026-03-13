import { api } from './api';
import type { Activity, PaginatedResponse, ApiFilters } from '../types';

export const activitiesService = {
  getAll: (filters?: ApiFilters) => 
    api.get<PaginatedResponse<Activity>>('/tools/activities', filters as any),
  
  getById: (id: string) => 
    api.get<Activity>(`/tools/activities/${id}`),
  
  create: (data: Partial<Activity>) => 
    api.post<Activity>('/tools/activities', data),
  
  update: (id: string, data: Partial<Activity>) => 
    api.patch<Activity>(`/tools/activities/${id}`, data),
  
  delete: (id: string) => 
    api.delete(`/tools/activities/${id}`),
};
