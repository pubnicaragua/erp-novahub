import { api } from './api';
import type { Product, Warehouse, PaginatedResponse, ApiFilters } from '../types';

export const inventoryService = {
  // ==================== PRODUCTS ====================
  getProducts: (filters?: ApiFilters) => api.get<PaginatedResponse<Product>>('/inventory/products', filters as any),
  getProduct: (id: string) => api.get<Product>(`/inventory/products/${id}`),
  createProduct: (data: Partial<Product> & { initialStock?: number }) => api.post<Product>('/inventory/products', data),
  updateProduct: (id: string, data: Partial<Product>) => api.patch<Product>(`/inventory/products/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/inventory/products/${id}`),

  // ==================== CATEGORIES ====================
  getCategories: () => api.get<any[]>('/inventory/categories'),
  createCategory: (data: { name: string; description?: string }) => api.post<any>('/inventory/categories', data),
  updateCategory: (id: string, data: { name: string; description?: string }) => api.patch<any>(`/inventory/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/inventory/categories/${id}`),

  // ==================== WAREHOUSES ====================
  getWarehouses: () => api.get<Warehouse[]>('/inventory/warehouses'),
  getWarehouse: (id: string) => api.get<Warehouse>(`/inventory/warehouses/${id}`),
  createWarehouse: (data: Partial<Warehouse>) => api.post<Warehouse>('/inventory/warehouses', data),
  updateWarehouse: (id: string, data: Partial<Warehouse>) => api.patch<Warehouse>(`/inventory/warehouses/${id}`, data),
  deleteWarehouse: (id: string) => api.delete(`/inventory/warehouses/${id}`),

  // ==================== STOCK LEVELS ====================
  getAllStock: () => api.get<any[]>('/inventory/stock'),
  getStockByWarehouse: (warehouseId: string) => api.get<any>(`/inventory/stock/${warehouseId}`),
  updateStockLevel: (data: { productId: string; warehouseId: string; variantId: string; quantity: number; minStock?: number; maxStock?: number }) => 
    api.post<any>('/inventory/stock/update', data),

  // ==================== LOTS ====================
  getLots: () => api.get<any[]>('/inventory/lots'),
  createLot: (data: { productId: string; number: string; expirationDate?: Date }) => api.post<any>('/inventory/lots', data),
  deleteLot: (id: string) => api.delete(`/inventory/lots/${id}`),

  // ==================== SERIES ====================
  getSeries: () => api.get<any[]>('/inventory/series'),
  createSeries: (data: { productId: string; number: string }) => api.post<any>('/inventory/series', data),
  deleteSeries: (id: string) => api.delete(`/inventory/series/${id}`),

  // ==================== ADJUSTMENTS ====================
  getAdjustments: () => api.get<any[]>('/inventory/adjustments'),
  getAdjustment: (id: string) => api.get<any>(`/inventory/adjustments/${id}`),
  createAdjustment: (data: { warehouseId: string; reason: string; notes?: string; items: any[] }) => 
    api.post<any>('/inventory/adjustments', data),
  approveAdjustment: (id: string) => api.patch<any>(`/inventory/adjustments/${id}/approve`, {}),

  // ==================== TRANSFERS ====================
  getTransfers: () => api.get<any[]>('/inventory/transfers'),
  getTransfer: (id: string) => api.get<any>(`/inventory/transfers/${id}`),
  createTransfer: (data: { fromId: string; toId: string; carrier?: string; items: { variantId: string; quantity: number }[] }) => 
    api.post<any>('/inventory/transfers', data),
  updateTransferStatus: (id: string, status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED') => 
    api.patch<any>(`/inventory/transfers/${id}/status`, { status }),

  // ==================== MOVEMENTS ====================
  getMovements: (filters?: { type?: string; warehouseId?: string; limit?: number }) => 
    api.get<any[]>('/inventory/movements', filters as any),
  createMovement: (data: { productId: string; warehouseId: string; variantId?: string; type: string; quantity: number; reference?: string }) => 
    api.post<any>('/inventory/movements', data),

  // ==================== DASHBOARD ====================
  getDashboardStats: () => api.get<any>('/inventory/dashboard/stats'),
  getLowStockProducts: () => api.get<any[]>('/inventory/dashboard/low-stock'),

  // ==================== BULK IMPORT ====================
  bulkCreateProducts: async (items: Array<Partial<Product> & { initialStock?: number }>) => {
    const results: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] };
    for (let i = 0; i < items.length; i++) {
      try {
        await api.post<Product>('/inventory/products', items[i]);
        results.success++;
      } catch (e: any) {
        results.failed++;
        results.errors.push(`Fila ${i + 1} (${items[i].code || items[i].name || '?'}): ${e?.message || 'Error desconocido'}`);
      }
    }
    return results;
  },
};
