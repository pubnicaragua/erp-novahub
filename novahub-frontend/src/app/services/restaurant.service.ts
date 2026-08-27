import { api } from './api';

export interface RestaurantTable {
  id: string;
  code: string;
  name: string;
  zone?: string | null;
  seats: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'INACTIVE';
  publicToken: string;
  branchId: string;
}

export interface RestaurantMenuItem {
  id: string;
  categoryId: string;
  productId?: string | null;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  taxRate: number;
  prepStation: string;
  isAvailable: boolean;
  isFeatured: boolean;
}

export interface RestaurantMenuCategory {
  id: string;
  name: string;
  description?: string | null;
  items: RestaurantMenuItem[];
}

export interface RestaurantOrder {
  id: string;
  number: string;
  type: string;
  status: string;
  table?: { id: string; code: string; name: string } | null;
  total: number;
  currency: string;
  items: Array<{ id: string; description: string; quantity: number; total: number; status: string; productId?: string | null }>;
}

export interface RestaurantKitchenTicket {
  id: string;
  station: string;
  status: string;
  sentAt: string;
  order: { id: string; number: string; table?: { code: string; name: string } | null };
  items: Array<{ item: { description: string; quantity: number; notes?: string | null } }>;
}

export interface RestaurantSummary {
  orders: number;
  subtotal: number;
  tax: number;
  total: number;
  byType: Array<{ type: string; status: string; _count: { _all: number }; _sum: { total: number | null } }>;
  topItems: Array<{ description: string; _sum: { quantity: number | null; total: number | null } }>;
}

export interface RestaurantPublicBranding {
  name: string;
  logo: string | null;
  primaryColor: string;
  accentColor: string;
  theme: 'modern' | 'classic' | 'elegant' | 'rustic';
  showImages: boolean;
  whiteLabel: boolean;
}

export interface RestaurantMenuSettings {
  theme: 'modern' | 'classic' | 'elegant' | 'rustic';
  showImages: boolean;
}

export const restaurantService = {
  getPublicMenu: (tableToken: string, signal?: AbortSignal) =>
    api.get<{ table: { name: string; code: string }; categories: RestaurantMenuCategory[]; branding: RestaurantPublicBranding }>(`/restaurant/public/${encodeURIComponent(tableToken)}/menu`, { signal }),
  createPublicOrder: (tableToken: string, body: { items: Array<{ menuItemId: string; quantity: number }>; customerName?: string; customerPhone?: string; notes?: string }) =>
    api.idempotentPost<RestaurantOrder>(`/restaurant/public/${encodeURIComponent(tableToken)}/orders`, body),
  listTables: (branchId?: string, signal?: AbortSignal) =>
    api.get<RestaurantTable[]>('/restaurant/tables', { params: { branchId }, signal }),
  createTable: (body: { branchId: string; code: string; name: string; zone?: string; seats?: number }) =>
    api.post<RestaurantTable>('/restaurant/tables', body),
  updateTable: (id: string, body: Partial<RestaurantTable>) =>
    api.patch<RestaurantTable>(`/restaurant/tables/${id}`, body),
  getMenu: (signal?: AbortSignal) => api.get<RestaurantMenuCategory[]>('/restaurant/menu', { signal }),
  getMenuSettings: (signal?: AbortSignal) => api.get<RestaurantMenuSettings>('/restaurant/settings', { signal }),
  updateMenuSettings: (body: Partial<RestaurantMenuSettings>) =>
    api.patch<RestaurantMenuSettings>('/restaurant/settings', body),
  createCategory: (body: { name: string; description?: string }) =>
    api.post<RestaurantMenuCategory>('/restaurant/menu/categories', body),
  createMenuItem: (body: {
    categoryId: string;
    productId?: string | null;
    name: string;
    description?: string | null;
    price: number;
    currency?: string;
    taxRate?: number;
    prepStation?: string;
    imageUrl?: string | null;
    accountingKey?: string;
    options?: unknown;
    sortOrder?: number;
    isFeatured?: boolean;
  }) => api.post<RestaurantMenuItem>('/restaurant/menu/items', body),
  updateMenuItem: (id: string, body: Partial<{
    name: string;
    description: string | null;
    imageUrl: string | null;
    price: number;
    taxRate: number;
    productId: string | null;
    accountingKey: string;
    prepStation: string;
    isAvailable: boolean;
    isFeatured: boolean;
  }>) => api.patch<RestaurantMenuItem>(`/restaurant/menu/items/${id}`, body),
  listOrders: (branchId?: string, signal?: AbortSignal) =>
    api.get<RestaurantOrder[]>('/restaurant/orders', { params: { branchId }, signal }),
  createOrder: (body: { tableId: string; items: Array<{ menuItemId: string; quantity: number; notes?: string }>; notes?: string }) =>
    api.idempotentPost<RestaurantOrder>('/restaurant/orders', body),
  updateOrderStatus: (id: string, status: string) =>
    api.patch<RestaurantOrder>(`/restaurant/orders/${id}/status`, { status }),
  sendToKitchen: (id: string) => api.idempotentPost(`/restaurant/orders/${id}/send-to-kitchen`, {}),
  listKitchenTickets: (branchId?: string, signal?: AbortSignal) =>
    api.get<RestaurantKitchenTicket[]>('/restaurant/kitchen/tickets', { params: { branchId }, signal }),
  updateKitchenTicket: (id: string, status: string) =>
    api.patch<RestaurantKitchenTicket>(`/restaurant/kitchen/tickets/${id}/status`, { status }),
  checkout: (id: string, body: { registerId: string; sessionId: string; payments: Array<{ method: string; amount: number; currency: string }> }) =>
    api.idempotentPost<RestaurantOrder>(`/restaurant/orders/${id}/checkout`, body),
  getSummary: (params?: { branchId?: string; dateFrom?: string; dateTo?: string }, signal?: AbortSignal) =>
    api.get<RestaurantSummary>('/restaurant/reports/summary', { params, signal }),
};
