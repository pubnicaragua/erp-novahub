import { api } from './api';

export interface RestaurantTable {
  id: string;
  code: string;
  name: string;
  zone?: string | null;
  seats: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'INACTIVE';
  publicToken?: string;
  branchId: string;
  isActive?: boolean;
}

export interface RestaurantMenuOptionChoice {
  id: string;
  name: string;
  priceAdjustment: number;
}

export interface RestaurantMenuOptionGroup {
  id: string;
  name: string;
  required?: boolean;
  multiple?: boolean;
  choices: RestaurantMenuOptionChoice[];
}

export type RestaurantInventoryMode = 'FINISHED_PRODUCT' | 'RECIPE' | 'COMPONENTS' | 'ASSEMBLED' | 'NONE';

export interface RestaurantMenuMetadata {
  nameEn?: string;
  descriptionEn?: string;
  dishType?: 'DRINK' | 'STARTER' | 'MAIN' | 'DESSERT';
  prepMinutes?: number;
  shortDescription?: string;
  tags?: string[];
  allergens?: string[];
  dietary?: string[];
  gallery?: string[];
  inventoryMode?: RestaurantInventoryMode;
  inventoryConfig?: {
    deductWhen?: 'ORDER_CREATED' | 'SENT_TO_KITCHEN' | 'PAID' | 'DELIVERED';
    shortageBehavior?: 'WARN' | 'BLOCK' | 'ALLOW';
    allowSubstitutions?: boolean;
    variantId?: string | null;
    recipeLines?: Array<{ id?: string; productId?: string; variantId?: string | null; warehouseId?: string | null; name: string; quantity: number; unit: string; unitCost?: number; wastePercent?: number }>;
  };
  availability?: {
    state?: 'AVAILABLE' | 'SOLD_OUT' | 'HIDDEN';
    channels?: Record<string, boolean>;
    schedule?: Array<{ day: number; enabled: boolean; from?: string; to?: string }>;
    temporaryPause?: boolean;
    featured?: boolean;
  };
}

export interface RestaurantMenuItem {
  id: string;
  categoryId: string;
  productId?: string | null;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  currency: string;
  taxRate: number;
  prepStation: string;
  isAvailable: boolean;
  isFeatured: boolean;
  metadata?: RestaurantMenuMetadata | null;
  options?: RestaurantMenuOptionGroup[] | null;
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
  lifecycle?: 'OPEN' | 'CLOSED' | 'CANCELLED' | string;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID' | 'REFUNDED' | string;
  preparationStatus?: 'NOT_REQUIRED' | 'QUEUED' | 'IN_PROGRESS' | 'PARTIALLY_READY' | 'READY' | string;
  fulfillmentStatus?: 'NOT_REQUIRED' | 'PENDING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | string;
  tableState?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | string | null;
  invoiceId?: string | null;
  table?: { id: string; code: string; name: string } | null;
  hotelReservation?: { reservationNumber: string; guestName: string; room: { code: string; name: string } } | null;
  total: number;
  version?: number;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  customerName?: string | null;
  customerPhone?: string | null;
  paymentMethod?: string | null;
  splitRequested?: boolean;
  deliveryAddress?: string | null;
  deliveryReference?: string | null;
  deliveryFee?: number;
  deliveryStatus?: 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | null;
  assignedRiderName?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  currency: string;
  notes?: string | null;
  createdAt?: string;
  sentAt?: string | null;
  items: Array<{ id: string; description: string; quantity: number; total: number; status: string; productId?: string | null; notes?: string | null; options?: Array<{ groupId: string; groupName: string; choiceId: string; choiceName: string; priceAdjustment: number }> | null }>;
  events?: Array<{ id: string; type: string; message?: string | null; createdAt: string; actorId?: string | null }>;
}

export interface RestaurantKitchenTicket {
  id: string;
  station: string;
  status: string;
  sentAt: string;
  order: { id: string; number: string; table?: { code: string; name: string } | null; hotelReservation?: { reservationNumber: string; guestName: string; room: { code: string; name: string } } | null };
  items: Array<{ item: { description: string; quantity: number; notes?: string | null; options?: Array<{ groupId: string; groupName: string; choiceId: string; choiceName: string; priceAdjustment: number }> | null } }>;
}

export interface RestaurantSummary {
  orders: number;
  subtotal: number;
  tax: number;
  total: number;
  byType: Array<{ type: string; status: string; _count: { _all: number }; _sum: { total: number | null } }>;
  topItems: Array<{ description: string; _sum: { quantity: number | null; total: number | null } }>;
  hourlySales?: Array<{ hour: number; total: number; orders: number }>;
  byChannel?: Array<{ type: string; orders: number; total: number }>;
  averagePrepMinutes?: number | null;
  discounts?: number;
  waiters?: Array<{ name: string; userId: string; orders: number; total: number }>;
  marginEstimated?: number | null;
  marginNote?: string;
}

export interface RestaurantPublicBranding {
  name: string;
  logo: string | null;
  coverImage: string | null;
  primaryColor: string;
  accentColor: string;
  theme: 'modern' | 'classic' | 'elegant' | 'rustic' | 'neon' | 'tropical' | 'editorial' | 'retro';
  showImages: boolean;
  showDescriptions?: boolean;
  showPrices?: boolean;
  showAllergens?: boolean;
  showFooter?: boolean;
  language?: 'ES' | 'EN' | 'BOTH';
  whiteLabel: boolean;
}

export interface RestaurantMenuSettings {
  theme: 'modern' | 'classic' | 'elegant' | 'rustic' | 'neon' | 'tropical' | 'editorial' | 'retro';
  showImages: boolean;
  showDescriptions?: boolean;
  showPrices?: boolean;
  showAllergens?: boolean;
  showFooter?: boolean;
  language?: 'ES' | 'EN' | 'BOTH';
}

export type RestaurantBusinessType = 'RESTAURANT' | 'CAFE' | 'FAST_FOOD' | 'BAR' | 'FOOD_COURT' | 'HOTEL_RESORT';
export type RestaurantConfiguration = {
  version: number;
  businessType: RestaurantBusinessType;
  channels: Record<'DINE_IN' | 'COUNTER' | 'QR' | 'DELIVERY' | 'TAKEAWAY' | 'ROOM_SERVICE', boolean>;
  languages: { ES: boolean; EN: boolean; PT: boolean };
  hours: Record<string, { enabled: boolean; from: string; to: string }>;
  specialDates: Array<{ date: string; label: string; closed?: boolean; from?: string; to?: string }>;
  integrations: { INVENTORY: boolean; CRM: boolean; REPORTS: boolean; ACCOUNTING: boolean };
  inventory: {
    defaultMode: RestaurantInventoryMode | 'NONE';
    deductWhen: 'ORDER_CREATED' | 'SENT_TO_KITCHEN' | 'PAID' | 'DELIVERED';
    preventNegative: boolean;
    showLowStockAlert: boolean;
    returnOnCancel: boolean;
    warehouseId?: string | null;
    useStationWarehouses: boolean;
    units: Array<{ name: string; abbreviation: string }>;
    waste: Array<{ name: string; percent: number; description?: string }>;
  };
  kitchen: {
    enabled: boolean;
    stations: Array<{ id: string; name: string; description?: string }>;
    sendMode: 'AUTO' | 'MANUAL';
    multipleRounds: boolean;
    modificationsAfterSend: boolean;
    cancellationAppearance: 'STRIKE' | 'REMOVE';
    channels: Record<'DINE_IN' | 'COUNTER' | 'QR' | 'DELIVERY' | 'TAKEAWAY' | 'ROOM_SERVICE', boolean>;
    kds: boolean;
    printing: boolean;
    soundAlerts: boolean;
    showPrepTimes: boolean;
  };
  cash: {
    methods: Record<'CASH' | 'CARD' | 'TRANSFER' | 'QR' | 'VOUCHER' | 'MIXED', boolean>;
    tips: { enabled: boolean; suggested: number[]; base: 'BEFORE_TAX' | 'AFTER_TAX' };
    rules: { manualCashConfirmation: boolean; partialPayments: boolean; autoClose: boolean; reopen: boolean; transfer: boolean };
    splitModes: string[];
    roomServiceMode: 'DIRECT' | 'ROOM_CHARGE' | 'PENDING_FOLIO';
    accountingEnabled: boolean;
    operatorPermissions: Record<string, string[]>;
  };
  profile?: Record<string, unknown>;
};

export interface RestaurantConfigurationResponse {
  branch?: { id: string; name: string; code: string } | null;
  profile: {
    name: string;
    logo?: string | null;
    description?: string | null;
    businessType?: RestaurantBusinessType | string | null;
    primaryColor?: string | null;
    accentColor?: string | null;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    coverImage?: string | null;
    social?: Record<string, string>;
  };
  configuration: RestaurantConfiguration;
}

export interface RestaurantCapabilitiesResponse {
  branch: { id: string; name: string; code: string } | null;
  version: number;
  businessType: RestaurantBusinessType;
  configuration: RestaurantConfiguration;
  capabilities: {
    channels: RestaurantConfiguration['channels'];
    kitchen: { enabled: boolean; kds: boolean; stations: RestaurantConfiguration['kitchen']['stations'] };
    tableService: boolean;
    publicQr: boolean;
    delivery: boolean;
    takeaway: boolean;
    roomService: boolean;
    pmsConnectedEffective?: boolean;
    roomServiceMode?: 'DIRECT' | 'ROOM_CHARGE' | 'PENDING_FOLIO';
    inventory: { enabled: boolean; mode: RestaurantInventoryMode | string; warehouseConfigured: boolean; deductWhen: string };
    accounting: { enabled: boolean; optional: boolean };
    cash: { methods: RestaurantConfiguration['cash']['methods']; mixedPayments: boolean; partialPayments: boolean; openRegisters: number };
  };
}

export type RestaurantOrderType = 'DINE_IN' | 'COUNTER' | 'TAKEAWAY' | 'DELIVERY' | 'QR' | 'ROOM_SERVICE';

export const restaurantService = {
  getPublicMenu: (tableToken: string, signal?: AbortSignal) =>
    api.get<{ table: { name: string; code: string }; categories: RestaurantMenuCategory[]; branding: RestaurantPublicBranding }>(`/restaurant/public/${encodeURIComponent(tableToken)}/menu`, { signal }),
  createPublicOrder: (tableToken: string, body: { items: Array<{ menuItemId: string; quantity: number; selectedOptions?: Record<string, string | string[]> }>; customerName?: string; customerPhone?: string; notes?: string; paymentMethod?: 'CASH' | 'CARD'; splitRequested?: boolean }) =>
    api.idempotentPost<RestaurantOrder>(`/restaurant/public/${encodeURIComponent(tableToken)}/orders`, body),
  getPublicOrder: (tableToken: string, id: string, signal?: AbortSignal) =>
    api.get<RestaurantOrder>(`/restaurant/public/${encodeURIComponent(tableToken)}/orders/${encodeURIComponent(id)}`, { signal }),
  listTables: (branchId?: string, signal?: AbortSignal, includeInactive = false) =>
    api.get<RestaurantTable[]>('/restaurant/tables', { params: { branchId, ...(includeInactive ? { includeInactive: 'true' } : {}) }, signal }),
  createTable: (body: { branchId: string; code: string; name: string; zone?: string; seats?: number }, key?: string) =>
    api.idempotentPost<RestaurantTable>('/restaurant/tables', body, key),
  updateTable: (id: string, body: Partial<RestaurantTable>) =>
    api.patch<RestaurantTable>(`/restaurant/tables/${id}`, body),
  rotateTableQr: (id: string) => api.post<RestaurantTable>(`/restaurant/tables/${id}/qr/rotate`),
  getMenu: (signal?: AbortSignal) => api.get<RestaurantMenuCategory[]>('/restaurant/menu', { signal }),
  getConfiguration: (branchIdOrSignal?: string | AbortSignal, signal?: AbortSignal) => {
    const branchId = typeof branchIdOrSignal === 'string' ? branchIdOrSignal : undefined;
    const requestSignal = typeof branchIdOrSignal === 'string' ? signal : branchIdOrSignal;
    return api.get<RestaurantConfigurationResponse>('/restaurant/configuration', { params: { branchId }, signal: requestSignal });
  },
  getCapabilities: (branchId?: string, signal?: AbortSignal) => api.get<RestaurantCapabilitiesResponse>('/restaurant/capabilities', { params: { branchId }, signal }),
  updateConfiguration: (body: Partial<RestaurantConfigurationResponse> & { branchId?: string; configuration?: Partial<RestaurantConfiguration>; expectedVersion?: number }) => api.patch<RestaurantConfigurationResponse>('/restaurant/configuration', body),
  getMenuSettings: (signal?: AbortSignal) => api.get<RestaurantMenuSettings>('/restaurant/settings', { signal }),
  updateMenuSettings: (body: Partial<RestaurantMenuSettings>) =>
    api.patch<RestaurantMenuSettings>('/restaurant/settings', body),
  createCategory: (body: { name: string; description?: string }) =>
    api.post<RestaurantMenuCategory>('/restaurant/menu/categories', body),
  updateCategory: (id: string, body: { name?: string; description?: string | null; sortOrder?: number; isActive?: boolean }) =>
    api.patch<RestaurantMenuCategory>(`/restaurant/menu/categories/${id}`, body),
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
    options?: RestaurantMenuOptionGroup[];
    sortOrder?: number;
    isFeatured?: boolean;
    metadata?: RestaurantMenuMetadata;
  }) => api.post<RestaurantMenuItem>('/restaurant/menu/items', body),
  updateMenuItem: (id: string, body: Partial<{
    categoryId: string;
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
    metadata: RestaurantMenuMetadata;
    options: RestaurantMenuOptionGroup[];
  }>) => api.patch<RestaurantMenuItem>(`/restaurant/menu/items/${id}`, body),
  getMenuItemRecipe: (id: string, signal?: AbortSignal) => api.get<{ menuItemId: string; inventoryMode: RestaurantInventoryMode | string; productId?: string | null; variantId?: string | null; warehouseId?: string | null; lines: Array<{ id?: string; productId: string; variantId?: string | null; warehouseId?: string | null; name: string; quantity: number; unit: string; unitCost?: number; wastePercent?: number }> }>(`/restaurant/menu/items/${id}/recipe`, { signal }),
  updateMenuItemRecipe: (id: string, body: { inventoryMode: RestaurantInventoryMode | string; productId?: string | null; variantId?: string | null; lines?: Array<{ id?: string; productId: string; variantId?: string | null; warehouseId?: string | null; name?: string; quantity: number; unit: string; unitCost?: number; wastePercent?: number }> }) => api.put(`/restaurant/menu/items/${id}/recipe`, body),
  getMenuItemCost: (id: string, signal?: AbortSignal) => api.get<{ menuItemId: string; currency: string; totalCost: number; lines: Array<{ productId: string; productName: string; quantity: number; unit: string; unitCost: number; totalCost: number }> }>(`/restaurant/menu/items/${id}/cost`, { signal }),
  listOrders: (branchId?: string, signal?: AbortSignal, type?: RestaurantOrderType) =>
    api.get<RestaurantOrder[]>('/restaurant/orders', { params: { branchId, type }, signal }),
  createOrder: (body: { tableId?: string; branchId?: string; type?: RestaurantOrderType; sendToKitchen?: boolean; items: Array<{ menuItemId: string; quantity: number; notes?: string; variantId?: string; warehouseId?: string; selectedOptions?: Record<string, string | string[]> }>; notes?: string; deliveryAddress?: string; deliveryReference?: string; deliveryFee?: number }, key?: string) =>
    api.idempotentPost<RestaurantOrder>('/restaurant/orders', body, key),
  getOrder: (id: string, signal?: AbortSignal) =>
    api.get<RestaurantOrder>(`/restaurant/orders/${id}`, { signal }),
  addItems: (id: string, body: { expectedVersion?: number; sendToKitchen?: boolean; items: Array<{ menuItemId: string; quantity: number; notes?: string; variantId?: string; warehouseId?: string; selectedOptions?: Record<string, string | string[]> }> }, key?: string) =>
    api.idempotentPost<RestaurantOrder>(`/restaurant/orders/${id}/items`, body, key),
  updateOrderStatus: (id: string, status: string, expectedVersion?: number, key?: string) =>
    api.idempotentPatch<RestaurantOrder>(`/restaurant/orders/${id}/status`, { status, ...(expectedVersion === undefined ? {} : { expectedVersion }) }, key),
  updateDelivery: (id: string, body: { expectedVersion?: number; status?: RestaurantOrder['deliveryStatus']; address?: string; reference?: string; riderName?: string }, key?: string) =>
    api.idempotentPatch<RestaurantOrder>(`/restaurant/orders/${id}/delivery`, body, key),
  sendToKitchen: (id: string, key?: string) => api.idempotentPost(`/restaurant/orders/${id}/send-to-kitchen`, {}, key),
  listKitchenTickets: (branchId?: string, signal?: AbortSignal) =>
    api.get<RestaurantKitchenTicket[]>('/restaurant/kitchen/tickets', { params: { branchId }, signal }),
  updateKitchenTicket: (id: string, status: string, key?: string) =>
    api.idempotentPatch<RestaurantKitchenTicket>(`/restaurant/kitchen/tickets/${id}/status`, { status }, key),
  listOrderPayments: (id: string, signal?: AbortSignal) => api.get<{ orderId: string; total: number; amountPaid: number; balance: number; status?: string; customerId?: string | null; dueDate?: string | null; payments: Array<{ id: string; number: string; amount: number; currency: string; method: string; reference?: string | null; date: string }> }>(`/restaurant/orders/${id}/payments`, { signal }),
  addOrderPayment: (id: string, body: { expectedVersion?: number; registerId: string; sessionId: string; customerId?: string; dueDate?: string; payments: Array<{ method: 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' | 'QR' | 'VOUCHER'; amount: number; currency: string; reference?: string }> }) =>
    api.idempotentPost<{ order: RestaurantOrder; payment: unknown }>(`/restaurant/orders/${id}/payments`, body),
  checkout: (id: string, body: { expectedVersion?: number; registerId: string; sessionId: string; customerId?: string; dueDate?: string; payments: Array<{ method: 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' | 'QR' | 'VOUCHER'; amount: number; currency: string; reference?: string }> }) =>
    api.idempotentPost<RestaurantOrder>(`/restaurant/orders/${id}/checkout`, body),
  listFulfillments: (params?: { branchId?: string; status?: string }, signal?: AbortSignal) => api.get<RestaurantOrder[]>('/restaurant/fulfillments', { params, signal }),
  getSummary: (params?: { branchId?: string; dateFrom?: string; dateTo?: string }, signal?: AbortSignal) =>
    api.get<RestaurantSummary>('/restaurant/reports/summary', { params, signal }),
};
