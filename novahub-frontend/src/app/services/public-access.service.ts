import { apiRequest } from './api';

export type PublicLinkResponse = { id: string; token: string; path: string; expiresAt?: string | null };

export const publicAccessService = {
  createDocumentLink(input: { customerId: string; documentType: string; documentId: string; allowPrint?: boolean; allowDownload?: boolean; allowRelated?: boolean; expiresAt?: string | null }) {
    return apiRequest<PublicLinkResponse>('/public-access/links', { method: 'POST', body: { accessType: 'DOCUMENT', replaceExisting: true, allowView: true, ...input } });
  },
  createPortalLink(input: { customerId: string; expiresAt?: string | null; allowBalance?: boolean; allowRelated?: boolean }) {
    return apiRequest<PublicLinkResponse>('/public-access/links', { method: 'POST', body: { accessType: 'PORTAL', replaceExisting: true, allowView: true, allowBalance: true, allowRelated: true, ...input } });
  },
  list(customerId?: string) { return apiRequest<any[]>('/public-access/links', { params: { customerId } }); },
  revoke(id: string) { return apiRequest<{ success: boolean }>(`/public-access/links/${id}/revoke`, { method: 'POST' }); },
};

export function publicLinkUrl(path: string) {
  const baseUrl = String(import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
  return `${baseUrl}${path}`;
}
