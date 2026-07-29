import { api } from './api';

export interface PriceList {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  _count?: { items: number };
}

export interface PriceListItem {
  id: string;
  productId: string;
  price: number;
  currency: string;
  exchangeRate: number;
  basePrice: number;
  product?: any;
  priceList?: { code: string; name: string };
}

export const priceListsService = {
  getAll: () => api.get<PriceList[]>('/sales/price-lists'),
  getMatrix: () => api.get<{ lists: PriceList[]; products: any[]; items: PriceListItem[] }>('/sales/price-lists/matrix'),
  getItems: (id: string) => api.get<PriceListItem[]>(`/sales/price-lists/${id}/items`),
  create: (data: { name: string; code?: string; description?: string }) => api.post<PriceList>('/sales/price-lists', data),
  update: (id: string, data: Partial<Pick<PriceList, 'name' | 'description' | 'isActive'>>) => api.patch<PriceList>(`/sales/price-lists/${id}`, data),
  updateItem: (id: string, productId: string, data: { price: number; currency: string; exchangeRate?: number }) => api.patch<PriceListItem>(`/sales/price-lists/${id}/items/${productId}`, data),
  importMatrix: (data: { currency: string; exchangeRate?: number; listCodes: string[]; rows: Array<{ code: string; prices: Record<string, number | string | null> }>; confirmText: string }) => api.post<{ updated: number; unchanged: number; errors: string[] }>('/sales/price-lists/import', data),
};
