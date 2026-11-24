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
  invoice?: { id: string; number: string; date?: string } | null;
  creditNote?: { id: string; number: string; date?: string } | null;
  seller: Pick<SalesSeller, 'id' | 'code' | 'name'>;
}

export interface SalesSellerSale {
  id: string;
  number: string;
  date: string;
  status: string;
  total: number | string;
  amountPaid: number | string;
  balance: number | string;
  currency: string;
  customer?: { id: string; code?: string | null; name: string } | null;
  customCustomerName?: string | null;
  items: Array<{ id: string; description: string; quantity: number | string; unitPrice: number | string; discount: number | string; total: number | string }>;
  payments: Array<{ id: string; number: string; date: string; amount: number | string; currency: string; method: string; reference?: string | null }>;
}

export interface SalesSellerPayoutLine {
  id: string;
  amount: number | string;
  currency: string;
  commission?: {
    rate?: number | string;
    invoice?: { id: string; number: string; date: string; total: number | string; currency: string } | null;
    creditNote?: { id: string; number: string; date: string; total: number | string; currency: string } | null;
  } | null;
  goalAward?: { level?: string; goal?: { title: string; targetAmount: number | string; currency: string } | null } | null;
}

export interface SalesSellerPayout {
  id: string;
  amount: number | string;
  currency: string;
  paidAt: string;
  method: string;
  reference?: string | null;
  status: string;
  reversalReason?: string | null;
  seller?: Pick<SalesSeller, 'id' | 'code' | 'name'> | null;
  lines?: SalesSellerPayoutLine[];
}

export interface SalesSellerCommissionDetails {
  id: string;
  amount: number | string;
  currency: string;
  rate: number | string;
  status: string;
  seller?: Pick<SalesSeller, 'id' | 'code' | 'name'> | null;
  employee?: { id: string; employeeNumber: string; firstName: string; lastName: string } | null;
  invoice?: SalesSellerSale | null;
  creditNote?: { id: string; number: string; date: string; status: string; total: number | string; amountPaid: number | string; balance: number | string; currency: string; reason: string } | null;
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
  listSales: (sellerId: string, from?: string, to?: string, signal?: AbortSignal) => api.get<SalesSellerSale[]>(`/sales/sellers/${sellerId}/sales`, { params: { from, to }, signal }),
  create: (data: Pick<SalesSeller, 'name'> & Partial<Pick<SalesSeller, 'email' | 'phone'>>) => api.post<SalesSeller>('/sales/sellers', data),
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
  listPayouts: (sellerId?: string, signal?: AbortSignal) => api.get<SalesSellerPayout[]>('/sales/sellers/payouts', { params: { sellerId }, signal }),
  listCommissions: (sellerId?: string, signal?: AbortSignal) => api.get<SalesSellerCommission[]>('/sales/sellers/commissions', { params: { sellerId }, signal }),
  getCommissionDetails: (commissionId: string, signal?: AbortSignal) => api.get<SalesSellerCommissionDetails>(`/sales/sellers/commissions/${commissionId}/details`, { signal }),
  pay: (data: { sellerId: string; commissionIds: string[]; awardIds: string[]; currency: string; method: string; reference?: string; paidAt?: string; bankAccountId?: string; exchangeRate?: number }) => api.post('/sales/sellers/payouts', data),
  reversePayout: (id: string, reason: string) => api.post(`/sales/sellers/payouts/${id}/reverse`, { reason }),
};
