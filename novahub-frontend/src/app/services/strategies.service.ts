import { api } from './api';

export type StrategyKind = 'IDEA' | 'STRATEGY';
export type StrategyStatus = 'IDEA' | 'EVALUATING' | 'APPROVED' | 'DISCARDED';
export type StrategyAudience = 'PRIVATE' | 'USERS' | 'TEAM';
export type AttachmentKind = 'FILE' | 'PHOTO' | 'VOICE';

export interface StrategySummary {
  id: string;
  title: string;
  excerpt: string;
  kind: StrategyKind;
  status: StrategyStatus;
  tags: string[];
  audience: StrategyAudience;
  authorId: string;
  authorName: string;
  commentCount: number;
  voteCount: number;
  attachmentCount: number;
  myVote: boolean;
  notifyPush: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyAttachment {
  id: string;
  kind: AttachmentKind;
  uri: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  durationSeconds: number | null;
  createdAt: string;
}

export interface StrategyDetail extends StrategySummary {
  body: string;
  audienceUserIds: string[];
  audienceUsers: Array<{ id: string; name: string }>;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  convertedTaskId: string | null;
  comments: Array<{ id: string; authorId: string; authorName: string; body: string; createdAt: string }>;
  attachments: StrategyAttachment[];
  canEdit: boolean;
}

export interface StrategyPage {
  total: number;
  page: number;
  pageSize: number;
  items: StrategySummary[];
}

export interface StrategyInput {
  title: string;
  body: string;
  kind: StrategyKind;
  tags: string[];
  audience: StrategyAudience;
  audienceUserIds: string[];
  notifyPush: boolean;
  attachments?: Array<Omit<StrategyAttachment, 'id' | 'createdAt'>>;
}

export const strategiesService = {
  list: (params: Record<string, string | number | undefined>, signal?: AbortSignal) => api.get<StrategyPage>('/strategies', { params, signal }),
  get: (id: string, signal?: AbortSignal) => api.get<StrategyDetail>(`/strategies/${id}`, { signal }),
  create: (data: StrategyInput) => api.post<StrategyDetail>('/strategies', data),
  update: (id: string, data: Partial<StrategyInput>) => api.patch<StrategyDetail>(`/strategies/${id}`, data),
  setStatus: (id: string, status: StrategyStatus) => api.post<StrategyDetail>(`/strategies/${id}/status`, { status }),
  remove: (id: string) => api.delete<{ id: string }>(`/strategies/${id}`),
  addComment: (id: string, body: string) => api.post<{ id: string }>(`/strategies/${id}/comments`, { body }),
  removeComment: (id: string, commentId: string) => api.delete<{ id: string }>(`/strategies/${id}/comments/${commentId}`),
  toggleVote: (id: string) => api.post<{ myVote: boolean; voteCount: number }>(`/strategies/${id}/vote`, {}),
  addAttachment: (id: string, data: Omit<StrategyAttachment, 'id' | 'createdAt'>) => api.post<StrategyAttachment>(`/strategies/${id}/attachments`, data),
  attachmentUrl: (id: string, attachmentId: string) => api.get<{ url: string; expiresIn: number }>(`/strategies/${id}/attachments/${attachmentId}/url`),
  removeAttachment: (id: string, attachmentId: string) => api.delete<{ id: string }>(`/strategies/${id}/attachments/${attachmentId}`),
  convertToTask: (id: string, data: { assigneeId?: string; dueDate?: string }) => api.post<{ taskId: string }>(`/strategies/${id}/convert-to-task`, data),
};
