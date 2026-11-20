import { api } from './api';

export interface SalesSeller {
  id: string;
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
}

export interface SalesSellerGoal {
  id: string;
  sellerId: string;
  title: string;
  targetAmount: number;
  rewardAmount: number;
  minimumAmount?: number | null;
  minimumReward?: number | null;
  stretchAmount?: number | null;
  stretchReward?: number | null;
  currency: string;
  periodStart: string;
  periodEnd: string;
  periodStartDate?: string;
  periodEndDate?: string;
  status: string;
  achievedAmount: number;
  award?: { id: string; amount: number; currency: string; level: string; status: string } | null;
  seller: Pick<SalesSeller, 'id' | 'code' | 'name'>;
}

export interface SalesSellerCommission {
  id: string;
  sellerId: string;
  amount: number;
  currency: string;
  rate: number;
  status: string;
  earnedAt?: string | null;
  invoice?: { number: string; date?: string } | null;
  creditNote?: { number: string; date?: string } | null;
  seller: Pick<SalesSeller, 'id' | 'code' | 'name'>;
}

export interface SalesSellerAward {
  id: string;
  amount: number;
  currency: string;
  level: string;
  status: string;
  goal: SalesSellerGoal;
}

export interface SalesSellerCommissionRule {
  minAmount: number;
  maxAmount: number | null;
  rate: number;
}

export const salesSellersService = {
  list: (search?: string, signal?: AbortSignal) => api.get<{ data: SalesSeller[] }>('/sales/sellers', { params: { search }, signal }),
  create: (data: Pick<SalesSeller, 'code' | 'name'> & Partial<Pick<SalesSeller, 'email' | 'phone'>>) => api.post<SalesSeller>('/sales/sellers', data),
  update: (id: string, data: Partial<Pick<SalesSeller, 'code' | 'name' | 'email' | 'phone' | 'isActive'>>) => api.patch<SalesSeller>(`/sales/sellers/${id}`, data),
  getCommissionConfiguration: (signal?: AbortSignal) => api.get<any>('/sales/sellers/commission-configuration', { signal }),
  saveCommissionPlan: (data: { sellerId: string; currency: string; calculationBasis: 'PER_SALE' | 'MONTHLY_TOTAL'; rules: SalesSellerCommissionRule[] }) => api.put<any>('/sales/sellers/commission-configuration', data),
  resetCommissionPlan: (sellerId: string) => api.delete(`/sales/sellers/${sellerId}/commission-configuration`),
  getIntegrationPolicy: (signal?: AbortSignal) => api.get<{ financeEnabled: boolean; accountingEnabled: boolean }>('/sales/integration-policy', { signal }),
  listGoals: (sellerId?: string, signal?: AbortSignal) => api.get<SalesSellerGoal[]>('/sales/sellers/goals', { params: { sellerId }, signal }),
  createGoal: (data: Record<string, unknown>) => api.post<SalesSellerGoal>('/sales/sellers/goals', data),
  evaluateGoals: () => api.post<{ evaluated: number; awardsCreated: number }>('/sales/sellers/goals/evaluate'),
  approveAward: (id: string, approve: boolean) => api.post(`/sales/sellers/goals/awards/${id}/approve`, { approve }),
  listPayable: (sellerId?: string, signal?: AbortSignal) => api.get<{ commissions: SalesSellerCommission[]; awards: SalesSellerAward[] }>('/sales/sellers/payable', { params: { sellerId }, signal }),
  listPayouts: (sellerId?: string, signal?: AbortSignal) => api.get<any[]>('/sales/sellers/payouts', { params: { sellerId }, signal }),
  listCommissions: (sellerId?: string, signal?: AbortSignal) => api.get<SalesSellerCommission[]>('/sales/sellers/commissions', { params: { sellerId }, signal }),
  pay: (data: { sellerId: string; commissionIds: string[]; awardIds: string[]; currency: string; method: string; reference?: string; paidAt?: string; bankAccountId?: string; exchangeRate?: number }) => api.post('/sales/sellers/payouts', data),
  reversePayout: (id: string, reason: string) => api.post(`/sales/sellers/payouts/${id}/reverse`, { reason }),
};
