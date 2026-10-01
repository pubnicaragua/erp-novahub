import { api } from './api';

export type PoketPayLinkStatus = 'CREATED' | 'IN_PROGRESS' | 'RESOLVED' | 'EXPIRED' | 'CANCELLED' | 'FAILED';
export type PoketPayLinkAttemptStatus = 'AUTHORIZED' | 'FAILED';
export type PoketAppTransactionStatus = 'CREATED' | 'IN_PROGRESS' | 'RESOLVED' | 'EXPIRED' | 'CANCELLED' | 'FAILED';

export interface PoketPayLink {
  id: string;
  invoiceId: string;
  provider?: string;
  providerPaylinkId?: string | null;
  permanentLink: string;
  amount: number | string;
  currency: string;
  description: string;
  status: PoketPayLinkStatus;
  lastAttemptStatus?: PoketPayLinkAttemptStatus | null;
  expirationDate: string;
  paymentCount?: number | null;
  lastTryId?: string | null;
  authorizationCode?: string | null;
  providerReference?: string | null;
  cardLast4?: string | null;
  cardBrand?: string | null;
  errorCode?: string | null;
  errorReason?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PoketConfig {
  id: string | null;
  merchantId: string;
  terminalId: string;
  active: boolean;
  currency: 'NIO' | 'USD';
  bankAccountId: string | null;
  patMasked: string;
  hasPat: boolean;
  signaturePatMasked: string;
  hasSignaturePat: boolean;
}

export interface PoketAppTransaction {
  id: string;
  invoiceId: string;
  transactionId: string;
  externalTransactionId?: string | null;
  amount: number | string;
  taxAmount: number | string;
  currency: string;
  description: string;
  status: PoketAppTransactionStatus;
  deepLink?: string | null;
  providerReference?: string | null;
  authorizationCode?: string | null;
  cardLast4?: string | null;
  cardBrand?: string | null;
  errorCode?: string | null;
  errorReason?: string | null;
  paidAt?: string | null;
  signatureTimestamp?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PoketReceiptInvoice {
  [key: string]: unknown;
  number: string;
  balance: number | string;
  currency: string;
  exchangeRate?: number | string;
  customer?: Record<string, unknown> | null;
}

export interface PoketReceiptPayment {
  [key: string]: unknown;
  amount: number | string;
  date: string;
  currency?: string;
  method?: string;
  number?: string;
  reference?: string;
  notes?: string;
  customer?: Record<string, unknown> | null;
}

export interface PoketPublicReceipt {
  company: { name: string; logo?: string | null };
  invoice: PoketReceiptInvoice;
  payment: PoketReceiptPayment;
}

export const poketPayLinkService = {
  getConfig: () => api.get<PoketConfig>('/integrations/poket/config'),
  saveConfig: (data: { merchantId: string; terminalId: string; pat?: string; signaturePat?: string; active: boolean; currency: 'NIO' | 'USD'; bankAccountId?: string | null }) =>
    api.put<PoketConfig>('/integrations/poket/config', data),
  testConnection: () => api.post<{ ok: boolean; message: string }>('/integrations/poket/config/test', {}),
  listForInvoice: (invoiceId: string) => api.get<PoketPayLink[]>(`/integrations/poket/invoices/${invoiceId}/payment-links`),
  createForInvoice: (invoiceId: string, data: { amount: number; currency: string; description: string; expirationDate: string }) =>
    api.post<{ existing: boolean; link: PoketPayLink }>(`/integrations/poket/invoices/${invoiceId}/payment-links`, data),
  reconcile: (id: string) => api.post<{ link: PoketPayLink; provider: unknown }>(`/integrations/poket/payment-links/${id}/reconcile`, {}),
  cancel: (id: string) => api.delete<PoketPayLink>(`/integrations/poket/payment-links/${id}`),
  publicReconcile: (id: string) => api.post<PoketPayLink>(`/integrations/poket/public/payment-links/${id}/reconcile`, {}),
  publicStatus: (id: string) => api.get<Pick<PoketPayLink, 'id' | 'status' | 'amount' | 'currency' | 'expirationDate' | 'paidAt' | 'errorReason'>>(`/integrations/poket/public/payment-links/${id}`),
  publicReceipt: (id: string) => api.get<PoketPublicReceipt>(`/integrations/poket/public/payment-links/${id}/receipt`),
  listAppToApp: (invoiceId: string) => api.get<PoketAppTransaction[]>(`/integrations/poket/invoices/${invoiceId}/app-to-app/transactions`),
  createAppToApp: (invoiceId: string, data: { amount: number; taxAmount?: number; currency: string; description: string }) =>
    api.post<{ existing: boolean; transaction: PoketAppTransaction }>(`/integrations/poket/invoices/${invoiceId}/app-to-app/transactions`, data),
  reconcileAppToApp: (id: string) => api.post<{ transaction: PoketAppTransaction; provider: unknown; duplicate?: boolean }>(`/integrations/poket/app-to-app/transactions/${id}/reconcile`, {}),
};
