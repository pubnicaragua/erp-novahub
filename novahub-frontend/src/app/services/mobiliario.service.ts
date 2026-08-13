import { api } from './api';

// Mobiliario y Equipos: control operativo de los activos de la empresa
// (edificios, vehículos, mobiliario, equipos de cómputo, maquinaria).
// El costo, cuenta contable y depreciación los maneja Contabilidad → Activos Fijos.
export const mobiliarioService = {
  getAssets: (params?: { search?: string; category?: string; status?: string; branchId?: string; page?: number; pageSize?: number }, signal?: AbortSignal) =>
    api.get<any>('/company-assets', { params, signal }),
  getAsset: (id: string, signal?: AbortSignal) =>
    api.get<any>(`/company-assets/${id}`, { signal }),
  createAsset: (data: Record<string, any>) =>
    api.post<any>('/company-assets', data),
  updateAsset: (id: string, data: Record<string, any>) =>
    api.put<any>(`/company-assets/${id}`, data),
  deleteAsset: (id: string) =>
    api.delete<any>(`/company-assets/${id}`),
  importAssets: (items: Record<string, any>[]) =>
    api.post<any>('/company-assets/import', { items }),
  addAttachment: (id: string, data: { fileName: string; fileType: string; fileSize: number; fileUrl: string }) =>
    api.post<any>(`/company-assets/${id}/attachment`, data),
  removeAttachment: (id: string) =>
    api.delete<any>(`/company-assets/${id}/attachment`),
};
