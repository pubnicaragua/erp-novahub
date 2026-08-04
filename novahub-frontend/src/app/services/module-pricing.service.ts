import { api } from './api';

export interface ModulePriceItem {
  id: string;
  module: string;
  price: number;
}

export const modulePricingService = {
  getAll: (signal?: AbortSignal) => api.get<ModulePriceItem[]>('/module-pricing', { signal }),
  upsert: (module: string, price: number) => api.post('/module-pricing/upsert', { module, price }),
  bulkUpsert: (prices: { module: string; price: number }[]) => api.post('/module-pricing/bulk', { prices }),
};
