import { api } from './api';

export type ContractStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'SUSPENDED' | 'COMPLETED' | 'CANCELLED';
export type ContractHealth = 'OK' | 'EXPIRING' | 'EXPIRED' | 'MILESTONE_OVERDUE' | 'NONE';
export type BillingFrequency = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'MILESTONES';

export interface ContractMilestone {
  id: string; title: string; description: string | null; dueDate: string | null; amount: number | null; status: 'PENDING' | 'DONE' | 'CANCELLED'; completedAt: string | null;
}
export interface ContractEvent { id: string; kind: string; message: string; createdAt: string; userName: string }
export interface ContractRow {
  id: string; number: string; quoteId: string | null; clientName: string; contactName: string | null; contactEmail: string | null; contactPhone: string | null;
  title: string; description: string | null; status: ContractStatus; statusLabel: string; amount: number; currency: string; billingFrequency: BillingFrequency; paymentTerms: string | null;
  startDate: string | null; endDate: string | null; autoRenew: boolean; renewalNoticeDays: number; ownerUserId: string | null; signedAt: string | null; signedByClient: string | null;
  signedFileName: string | null; signedFileUri?: string | null; health: ContractHealth; milestoneProgress: { total: number; done: number }; updatedAt: string; createdAt: string;
}
export interface ContractDetail extends ContractRow { body: string; milestones: ContractMilestone[]; events: ContractEvent[] }
export interface ContractList {
  summary: { total: number; byStatus: Record<ContractStatus, number>; expiring: number; expired: number; overdueMilestones: number; activeAmount: Array<{ currency: string; amount: number }> };
  items: ContractRow[];
}
export interface AvailableQuote { id: string; number: string; prospectCompany: string; prospectName: string; total: number; currency: string }
export interface ContractInput {
  clientName?: string; contactName?: string; contactEmail?: string; contactPhone?: string; title?: string; description?: string; body?: string; amount?: number; currency?: string;
  billingFrequency?: BillingFrequency; paymentTerms?: string; startDate?: string | null; endDate?: string | null; autoRenew?: boolean; renewalNoticeDays?: number; ownerUserId?: string | null;
}

export const clientContractsService = {
  getCapabilities: (signal?: AbortSignal) => api.get<{ enabled: boolean; canManageAll: boolean }>('/sales/contracts/capabilities', { signal }),
  list: (params: { status?: string; search?: string; health?: string } = {}, signal?: AbortSignal) => api.get<ContractList>('/sales/contracts', { params, signal }),
  availableQuotes: (signal?: AbortSignal) => api.get<AvailableQuote[]>('/sales/contracts/available-quotes', { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<ContractDetail>(`/sales/contracts/${id}`, { signal }),
  create: (data: ContractInput) => api.post<ContractDetail>('/sales/contracts', data),
  createFromQuote: (quoteId: string, data: ContractInput) => api.post<ContractDetail>(`/sales/contracts/from-quote/${quoteId}`, data),
  update: (id: string, data: ContractInput) => api.patch<ContractDetail>(`/sales/contracts/${id}`, data),
  transition: (id: string, data: { status: ContractStatus; note?: string; signedByClient?: string; signedAt?: string; startDate?: string; signedFileUri?: string; signedFileName?: string }) => api.post<ContractDetail>(`/sales/contracts/${id}/status`, data),
  renew: (id: string, data: { endDate: string; note?: string }) => api.post<ContractDetail>(`/sales/contracts/${id}/renew`, data),
  addMilestone: (id: string, data: { title: string; description?: string; dueDate?: string | null; amount?: number | null }) => api.post<ContractMilestone>(`/sales/contracts/${id}/milestones`, data),
  updateMilestone: (id: string, milestoneId: string, data: Partial<{ title: string; dueDate: string | null; amount: number | null; status: string }>) => api.patch<ContractMilestone>(`/sales/contracts/${id}/milestones/${milestoneId}`, data),
  removeMilestone: (id: string, milestoneId: string) => api.delete<{ id: string }>(`/sales/contracts/${id}/milestones/${milestoneId}`),
  addNote: (id: string, message: string) => api.post<{ ok: boolean }>(`/sales/contracts/${id}/notes`, { message }),
  signedFileUrl: (id: string) => api.get<{ url: string; fileName: string | null }>(`/sales/contracts/${id}/signed-file`),
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, { label: string; tone: string }> = {
  DRAFT: { label: 'Borrador', tone: 'bg-slate-100 text-slate-800' }, PENDING_SIGNATURE: { label: 'Por firmar', tone: 'bg-amber-100 text-amber-900' },
  ACTIVE: { label: 'Vigente', tone: 'bg-emerald-100 text-emerald-900' }, SUSPENDED: { label: 'Suspendido', tone: 'bg-orange-100 text-orange-900' },
  COMPLETED: { label: 'Completado', tone: 'bg-sky-100 text-sky-900' }, CANCELLED: { label: 'Cancelado', tone: 'bg-slate-200 text-slate-600' },
};
export const CONTRACT_HEALTH_LABEL: Record<ContractHealth, { label: string; tone: string } | null> = {
  OK: null, NONE: null, EXPIRING: { label: 'Por vencer', tone: 'bg-amber-100 text-amber-900' }, EXPIRED: { label: 'Vencido', tone: 'bg-red-100 text-red-900' },
  MILESTONE_OVERDUE: { label: 'Hito atrasado', tone: 'bg-red-100 text-red-900' },
};
export const BILLING_LABEL: Record<BillingFrequency, string> = { ONE_TIME: 'Un solo pago', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', ANNUAL: 'Anual', MILESTONES: 'Por hitos' };
