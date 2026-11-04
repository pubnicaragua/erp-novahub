import { api } from './api';

export type Paginated<T> = { data: T[]; total: number; page: number; pageSize: number };
export type Params = Record<string, string | number | undefined>;
export type MetricSource = 'MANUAL' | 'VERIFIED';

export interface MktAccount { id: string; name: string; industry?: string | null; tier: string; status: string; contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null; website?: string | null; serviceLines: string[]; ownerUserId?: string | null; customerId?: string | null; notes?: string | null; updatedAt: string }
export interface MktBrief { id: string; code: string; title: string; status: string; accountId?: string | null; strategy?: Record<string, string> | null; budgetTotal?: string | number | null; dueDate?: string | null; ownerUserId?: string | null }
export interface MktCampaign { id: string; code: string; name: string; type: string; status: string; objective?: string | null; accountId?: string | null; briefId?: string | null; startDate?: string | null; endDate?: string | null; budget: string | number; spent: string | number; budgetApproved: boolean; channels: string[]; ownerUserId?: string | null }
export interface MktContent { id: string; title: string; channel: string; format: string; status: string; copy?: string | null; campaignId?: string | null; scheduledAt?: string | null; publishedAt?: string | null; assigneeId?: string | null; currentVersion: number; approvedVersion?: number | null; checklist?: Array<{ label: string; done: boolean }> | null; publishInfo?: { url?: string | null; note?: string | null; source: string } | null }
export interface MktAsset { id: string; name: string; folder: string; fileUri: string; mimeType?: string | null; sizeBytes: number; tags: string[]; rights: string; campaignId?: string | null; contentId?: string | null; description?: string | null; createdAt: string }
export interface MktCompetitor { id: string; name: string; category?: string | null; marketShare?: string | number | null; channels: string[]; notes?: string | null }
export interface MktStudy { id: string; title: string; scope?: string | null; status: string; findings?: string | null; studyDate?: string | null }
export interface MktKpi { id: string; campaignId?: string | null; channel?: string | null; metric: string; value: string | number; source: MetricSource; periodDate: string }
export interface MktUser { id: string; name: string; email: string }
export interface MktApproval { id: string; subjectType: 'CONTENT' | 'BUDGET' | 'STRATEGY'; subjectId: string; campaignId?: string | null; version?: number | null; title: string; amount?: string | number | null; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'CANCELLED'; comment?: string | null; createdAt: string; decidedAt?: string | null; requestedBy?: MktUser | null; decidedBy?: MktUser | null }
export interface MktHistory { id: string; entityType: string; entityId: string; action: string; summary: string; createdAt: string }
export interface MktConfig { channels: string[]; approverUserIds: string[]; allowSelfApproval: boolean; currency: string }
export type KpiSums = Record<string, number | null | Record<string, number>>;

export interface MktOverview {
  range: { from: string; to: string };
  kpis: { activeCampaigns: number; pendingApprovals: number; scheduledContent: number; budget: number; spent: number; reach: number; spend: number; roas: number | null; bySource: Record<string, number> };
  activeCampaigns: Array<Pick<MktCampaign, 'id' | 'code' | 'name' | 'type' | 'status' | 'budget' | 'spent' | 'channels'>>;
  pendingApprovals: MktApproval[];
  calendar: Array<Pick<MktContent, 'id' | 'title' | 'channel' | 'format' | 'status' | 'scheduledAt'>>;
  spendByChannel: Array<{ channel: string; amount: number }>;
  upcomingTasks: Array<{ id: string; title: string; dueDate: string | null; status: string }>;
  recentHistory: MktHistory[];
}

export interface MktCampaignDetail extends MktCampaign {
  account: { id: string; name: string } | null;
  brief: { id: string; code: string; title: string } | null;
  pendingApprovals: number;
  history: MktHistory[];
  contentByStatus: Record<string, number>;
  tasks: { total: number; done: number; items: Array<{ id: string; title: string; status: string; dueDate: string | null; assignments: Array<{ user: MktUser | null }> }> };
  kpis: KpiSums;
}

export interface MktContentDetail extends MktContent {
  versions: Array<{ id: string; version: number; title: string; copy?: string | null; createdAt: string }>;
  assets: MktAsset[];
  approvals: MktApproval[];
}

export interface MktReport {
  range: { from: string; to: string };
  totals: KpiSums;
  campaigns: Array<{ id: string; code: string; name: string; type: string; status: string; budget: number; spent: number; metrics: Record<string, number>; roas: number | null; cpl: number | null; ctr: number | null }>;
  channels: Array<{ channel: string; metrics: Record<string, number>; roas: number | null }>;
  contentByStatus: Record<string, number>;
  approvalsByStatus: Record<string, number>;
  history: MktHistory[];
}

/** CRUD genérico: un recurso del backend = una llamada a `resource(path)`. */
export function resource<T>(path: string) {
  const base = `/marketing/${path}`;
  return {
    list: (params?: Params, signal?: AbortSignal) => api.get<Paginated<T>>(base, { params, signal }),
    get: (id: string) => api.get<T>(`${base}/${id}`),
    create: (data: Record<string, unknown>) => api.post<T>(base, data),
    update: (id: string, data: Record<string, unknown>) => api.patch<T>(`${base}/${id}`, data),
    remove: (id: string) => api.delete<{ success: boolean }>(`${base}/${id}`),
  };
}

export const mktResources = {
  accounts: resource<MktAccount>('accounts'),
  briefs: resource<MktBrief>('briefs'),
  campaigns: resource<MktCampaign>('campaigns'),
  content: resource<MktContent>('content'),
  assets: resource<MktAsset>('assets'),
  competitors: resource<MktCompetitor>('competitors'),
  studies: resource<MktStudy>('studies'),
  kpis: resource<MktKpi>('kpis'),
};

export const marketingApi = {
  overview: (params: Params, signal?: AbortSignal) => api.get<MktOverview>('/marketing/overview', { params, signal }),
  history: (params: Params, signal?: AbortSignal) => api.get<MktHistory[]>('/marketing/history', { params, signal }),
  users: (signal?: AbortSignal) => api.get<MktUser[]>('/marketing/users', { signal }),
  settings: (signal?: AbortSignal) => api.get<MktConfig>('/marketing/settings', { signal }),
  saveSettings: (data: Partial<MktConfig>) => api.patch<MktConfig>('/marketing/settings', data),
  report: (params: Params, signal?: AbortSignal) => api.get<MktReport>('/marketing/reports/summary', { params, signal }),
  campaign: (id: string, signal?: AbortSignal) => api.get<MktCampaignDetail>(`/marketing/campaigns/${id}`, { signal }),
  setCampaignStatus: (id: string, status: string) => api.post<MktCampaign>(`/marketing/campaigns/${id}/status`, { status }),
  requestBudget: (id: string, data: { amount?: number; reason?: string }) => api.post<MktApproval>(`/marketing/campaigns/${id}/request-budget`, data),
  createCampaignTask: (id: string, data: { title: string; dueDate?: string; priority?: string; assignedTo?: string[] }) => api.post(`/marketing/campaigns/${id}/tasks`, data),
  requestStrategy: (briefId: string) => api.post<MktApproval>(`/marketing/briefs/${briefId}/request-approval`, {}),
  contentDetail: (id: string, signal?: AbortSignal) => api.get<MktContentDetail>(`/marketing/content/${id}`, { signal }),
  updateContent: (id: string, data: Record<string, unknown>) => api.patch<MktContent>(`/marketing/content/${id}`, data),
  submitReview: (id: string) => api.post<MktApproval>(`/marketing/content/${id}/submit-review`, {}),
  toDraft: (id: string) => api.post<MktContent>(`/marketing/content/${id}/draft`, {}),
  schedule: (id: string, scheduledAt: string) => api.post<MktContent>(`/marketing/content/${id}/schedule`, { scheduledAt }),
  publish: (id: string, data: { publishedUrl?: string; note?: string }) => api.post<MktContent>(`/marketing/content/${id}/publish`, data),
  archive: (id: string) => api.post<MktContent>(`/marketing/content/${id}/archive`, {}),
  approvals: (params: Params, signal?: AbortSignal) => api.get<Paginated<MktApproval>>('/marketing/approvals', { params, signal }),
  decide: (id: string, decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED', comment?: string) => api.post<MktApproval>(`/marketing/approvals/${id}/decide`, { decision, comment }),
};
