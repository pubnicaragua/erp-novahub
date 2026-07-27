import { api } from './api';
import type { Product, Warehouse, PaginatedResponse, ApiFilters } from '../types';
import { resolveStorageReferences } from './storage.service';

export const inventoryService = {
  // ==================== PRODUCTS ====================
  getProducts: async (filters?: ApiFilters) => {
    const products = await api.get<PaginatedResponse<Product>>('/inventory/products', filters as any);
    return resolveStorageReferences(products);
  },
  getProduct: async (id: string) => {
    const product = await api.get<Product>(`/inventory/products/${id}`);
    return resolveStorageReferences(product);
  },
  createProduct: (data: Partial<Product> & { initialStock?: number }) => api.post<Product>('/inventory/products', data),
  duplicateProduct: (id: string) => api.post<Product>(`/inventory/products/${id}/duplicate`, {}),
  updateProduct: (id: string, data: Partial<Product>) => api.patch<Product>(`/inventory/products/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/inventory/products/${id}`),
  checkProductCode: (code: string, excludeId?: string) => 
    api.get<{ exists: boolean }>('/inventory/products/check-code', { code, excludeId } as any),

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
  getReplenishmentReport: (period: 'weekly' | 'biweekly' | 'monthly' = 'weekly') =>
    api.get<any>('/inventory/stock/replenishment-report', { period } as any),

  // ==================== BULK IMPORT ====================
  bulkCreateProducts: async (items: Array<Partial<Product> & { initialStock?: number }>, onProgress?: (done: number, total: number) => void) => {
    const results: { success: number; skipped: number; failed: number; errors: string[] } = { success: 0, skipped: 0, failed: 0, errors: [] };
    const total = items.length;
    let progressTick: ReturnType<typeof setInterval> | null = null;
    if (onProgress) {
      let pct = 5;
      progressTick = setInterval(() => {
        pct = Math.min(pct + 3, 92);
        onProgress?.(Math.round(pct * total / 100), total);
        if (pct >= 92) clearInterval(progressTick!);
      }, 80);
    }
    try {
      const data = await api.post<{ success: number; skipped: number; errors: string[] }>('/inventory/products/batch', { items });
      results.success += data.success || 0;
      results.skipped += data.skipped || 0;
      if (data.errors) results.errors.push(...data.errors);
    } catch (e: any) {
      results.errors.push(`Error: ${e?.message || 'Error de red'}`);
    } finally {
      if (progressTick) clearInterval(progressTick);
      results.failed = results.errors.length;
      onProgress?.(total, total);
    }
    return results;
  },
  deleteProducts: (ids: string[]) => api.post<{ deleted: number }>('/inventory/products/batch-delete', { ids }),
};
