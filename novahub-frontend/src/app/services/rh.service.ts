import { api } from './api';
import type { Employee, Payroll, TimeOff, PaginatedResponse, ApiFilters } from '../types';

export const employeesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Employee>>('/hr/employees', filters as any),
  getById: (id: string) => api.get<Employee>(`/hr/employees/${id}`),
  create: (data: Partial<Employee>) => api.post<Employee>('/hr/employees', data),
  update: (id: string, data: Partial<Employee>) => api.put<Employee>(`/hr/employees/${id}`, data),
  terminate: (id: string, date: string) => api.patch<Employee>(`/hr/employees/${id}/terminate`, { date }),
};

export const payrollService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Payroll>>('/hr/payroll', filters as any),
  getById: (id: string) => api.get<Payroll>(`/hr/payroll/${id}`),
  create: (data: Partial<Payroll>) => api.post<Payroll>('/hr/payroll', data),
  approve: (id: string) => api.patch<Payroll>(`/hr/payroll/${id}/approve`, {}),
  process: (id: string) => api.patch<Payroll>(`/hr/payroll/${id}/process`, {}),
};

export const timeOffService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<TimeOff>>('/hr/leave/requests', filters as any),
  getById: (id: string) => api.get<TimeOff>(`/hr/time-off/${id}`),
  create: (data: Partial<TimeOff>) => api.post<TimeOff>('/hr/time-off', data),
  approve: (id: string) => api.patch<TimeOff>(`/hr/time-off/${id}/approve`, {}),
  reject: (id: string, reason: string) => api.patch<TimeOff>(`/hr/time-off/${id}/reject`, { reason }),
};
