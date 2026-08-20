import { api } from './api';
import type { Employee, Payroll, TimeOff, PaginatedResponse, ApiFilters } from '../types';

export const employeesService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<Employee>>('/hr/employees', { params: filters as any, signal }),
  getById: (id: string) => api.get<Employee>(`/hr/employees/${id}`),
  create: (data: Partial<Employee>) => api.post<Employee>('/hr/employees', data),
  update: (id: string, data: Partial<Employee>) => api.patch<Employee>(`/hr/employees/${id}`, data),
  terminate: (id: string) => api.delete<Employee>(`/hr/employees/${id}`),
};

export const payrollService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<Payroll>>('/hr/payroll', { params: filters as any, signal }),
  getById: (id: string) => api.get<Payroll>(`/hr/payroll/${id}`),
  create: (data: Partial<Payroll>) => api.post<Payroll>('/hr/payroll', data),
  approve: (id: string) => api.patch<Payroll>(`/hr/payroll/${id}/approve`, {}),
  process: (id: string) => api.patch<Payroll>(`/hr/payroll/${id}/process`, {}),
};

export const timeOffService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<TimeOff>>('/hr/leave/requests', { params: filters as any, signal }),
  getById: (id: string) => api.get<TimeOff>(`/hr/time-off/${id}`),
  create: (data: Partial<TimeOff>) => api.post<TimeOff>('/hr/leave/requests', data),
  approve: (id: string, approvedBy: string) => api.put<TimeOff>(`/hr/leave/requests/${id}/approve`, { approvedBy }),
  reject: (id: string, reason: string) => api.put<TimeOff>(`/hr/leave/requests/${id}/reject`, { rejectionReason: reason }),
  delete: (id: string) => api.delete<void>(`/hr/leave/requests/${id}`),
};
