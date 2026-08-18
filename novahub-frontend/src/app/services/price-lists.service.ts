import { api } from './api';
import type { ProductVariant } from '../types/variants';

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
  priceListId: string;
  productId: string;
  variantId?: string | null;
  price: number;
  currency: string;
  exchangeRate: number;
  basePrice: number;
  product?: any;
  variant?: ProductVariant | null;
  priceList?: { code: string; name: string };
}

export interface PriceListItemVariant {
  id: string;
  priceListId: string;
  productId: string;
  variantId: string;
  price: number;
  currency: string;
  exchangeRate: number;
  basePrice: number;
  variant?: ProductVariant;
  priceList?: { code: string; name: string };
}

export interface PriceListMatrixProduct {
  id: string;
  code: string;
  name: string;
  salePrice: number;
  costPrice: number;
  itemType?: string;
  category?: { id: string; name: string };
  isVariable?: boolean;
  variants?: ProductVariant[];
}

export interface PriceListMatrix {
  lists: PriceList[];
  products: PriceListMatrixProduct[];
  items: PriceListItem[];
}

export const priceListsService = {
  getAll: (signal?: AbortSignal) => api.get<PriceList[]>('/sales/price-lists', { signal }),

  getMatrix: (signal?: AbortSignal) =>
    api.get<PriceListMatrix>('/sales/price-lists/matrix', { signal }),

  getItems: (id: string, signal?: AbortSignal) =>
    api.get<PriceListItem[]>(`/sales/price-lists/${id}/items`, { signal }),

  getVariantItems: (listId: string, productId: string, signal?: AbortSignal) =>
    api.get<PriceListItemVariant[]>(`/sales/price-lists/${listId}/items/${productId}/variants`, { signal }),

  create: (data: { name: string; code?: string; description?: string }) =>
    api.post<PriceList>('/sales/price-lists', data),

  update: (id: string, data: Partial<Pick<PriceList, 'name' | 'description' | 'isActive'>>) =>
    api.patch<PriceList>(`/sales/price-lists/${id}`, data),

  updateItem: (id: string, productId: string, data: {
    price: number;
    currency: string;
    exchangeRate?: number;
    variantId?: string | null;
  }) => api.patch<PriceListItem>(`/sales/price-lists/${id}/items/${productId}`, data),

  updateVariantItem: (listId: string, productId: string, variantId: string, data: {
    price: number;
    currency: string;
    exchangeRate?: number;
  }) => api.patch<PriceListItemVariant>(`/sales/price-lists/${listId}/items/${productId}/variants/${variantId}`, data),

  importMatrix: (data: {
    currency: string;
    exchangeRate?: number;
    listCodes: string[];
    rows: Array<{
      code: string;
      variantId?: string;
      prices: Record<string, number | string | null>;
    }>;
    confirmText: string;
  }) => api.post<{ updated: number; unchanged: number; errors: string[] }>('/sales/price-lists/import', data),
};
