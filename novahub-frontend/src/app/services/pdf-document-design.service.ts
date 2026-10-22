import { api, getApiUrl, getAuthHeaders } from './api';
import type { PdfAppearanceProfile, PdfAppearanceProfilePatch, PdfCuratedTemplateSelection } from './pdf-appearance';

/** Identificador de una salida PDF. Puede ser legacy (Ventas) o module.subview. */
export type PdfDocumentType = string;

export interface PdfDocumentDesignRecord {
  id: string;
  /** ClientTenant activo; en NovaHub representa la sucursal operativa. */
  clientTenantId?: string;
  name: string;
  description?: string | null;
  templateKey?: string | null;
  documentTypes: PdfDocumentType[];
  folderId?: string | null;
  folder?: PdfDocumentDesignFolder | null;
  settings: Record<string, any>;
  sourceType: 'SYSTEM' | 'UPLOADED_PDF' | 'UPLOADED_HTML' | 'AI_ANALYZED';
  sourceFileUrl?: string | null;
  sourceFileName?: string | null;
  analysisStatus: string;
  layoutZones?: Record<string, any> | null;
  engine: string;
  isActive: boolean;
  updatedAt?: string;
}

export interface PdfDocumentDesignFolder {
  id: string;
  name: string;
  color?: string | null;
  _count?: { designs: number };
}

export interface PdfCompanyProfile {
  name: string;
  slogan: string;
  fiscalInfo: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo: string;
}

export interface PdfCuratedTemplateRevision {
  id: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  manifest: { name: string; description?: string; documentTypes: string[]; page: { size: 'LETTER'; orientation: 'portrait' | 'landscape' }; defaults: Record<string, unknown> };
  createdAt: string;
  publishedAt?: string | null;
}

export interface PdfCuratedTemplateRecord {
  id: string;
  name: string;
  description?: string | null;
  revisions: PdfCuratedTemplateRevision[];
}

export type PdfCuratedTemplateScope = 'branch' | 'document';

async function base64FromFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

async function fetchPdfBlob(path: string, body: unknown) {
  const response = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    cache: 'no-store',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = '';
    try {
      const error = await response.json();
      message = typeof error?.message === 'string' ? error.message : Array.isArray(error?.message) ? error.message.join(', ') : '';
    } catch { /* Se usa el error HTTP como reserva. */ }
    throw new Error(message || `No se pudo generar el PDF (HTTP ${response.status}).`);
  }
  return response.blob();
}

export type { PdfAppearanceOverrides, PdfAppearanceProfile } from './pdf-appearance';

export const pdfDocumentDesignService = {
  list: () => api.get<PdfDocumentDesignRecord[]>('/pdf-document-designs'),
  listFolders: () => api.get<PdfDocumentDesignFolder[]>('/pdf-document-designs/folders'),
  getCompanyProfile: () => api.get<PdfCompanyProfile | null>('/pdf-document-designs/company-profile'),
  updateCompanyProfile: (data: PdfCompanyProfile) => api.patch<PdfCompanyProfile>('/pdf-document-designs/company-profile', data),
  getAppearanceProfile: () => api.get<PdfAppearanceProfile>('/pdf-document-designs/appearance-profile'),
  updateAppearanceProfile: (patch: PdfAppearanceProfilePatch) => api.patch<PdfAppearanceProfile>('/pdf-document-designs/appearance-profile', patch),
  applyTemplate: (templateId: 'default-v1') => api.post<{ templateId: string; templateVersion: number; updatedDesignCount: number; alreadyApplied: boolean }>('/pdf-document-designs/apply-template', { templateId }),
  createFolder: (data: { name: string; color?: string }) => api.post<PdfDocumentDesignFolder>('/pdf-document-designs/folders', data),
  updateFolder: (id: string, data: { name?: string; color?: string }) => api.patch<PdfDocumentDesignFolder>(`/pdf-document-designs/folders/${id}`, data),
  removeFolder: (id: string) => api.delete(`/pdf-document-designs/folders/${id}`),
  active: (documentType: PdfDocumentType) => api.get<PdfDocumentDesignRecord | null>(`/pdf-document-designs/active/${encodeURIComponent(documentType)}`),
  activate: (id: string) => api.post<PdfDocumentDesignRecord>(`/pdf-document-designs/${encodeURIComponent(id)}/activate`, {}),
  resetActiveTarget: (documentType: PdfDocumentType) => api.post<{ documentType: string; deactivatedCount: number; defaultDesign: PdfDocumentDesignRecord }>(`/pdf-document-designs/active/${encodeURIComponent(documentType)}/reset`, {}),
  resetActiveLayouts: () => api.post<{ updatedCount: number }>('/pdf-document-designs/reset-active-layouts', {}),
  create: (data: Partial<PdfDocumentDesignRecord>) => api.post<PdfDocumentDesignRecord>('/pdf-document-designs', data),
  convertToHtml: (id: string) => api.post<PdfDocumentDesignRecord>(`/pdf-document-designs/${id}/convert-html`, {}),
  update: (id: string, data: Partial<PdfDocumentDesignRecord>) => api.patch<PdfDocumentDesignRecord>(`/pdf-document-designs/${id}`, data),
  remove: (id: string) => api.delete(`/pdf-document-designs/${id}`),
  listCuratedTemplates: () => api.get<PdfCuratedTemplateRecord[]>('/pdf-document-templates'),
  importCuratedTemplate: async (file: File, templateId?: string) => api.post<PdfCuratedTemplateRecord>('/pdf-document-templates/import-package', {
    fileName: file.name,
    packageBase64: await base64FromFile(file),
    ...(templateId ? { templateId } : {}),
  }),
  publishCuratedRevision: (templateId: string, revisionId: string) => api.post<{ id: string; status: string; publishedAt: string }>(`/pdf-document-templates/${encodeURIComponent(templateId)}/publish/${encodeURIComponent(revisionId)}`, {}),
  selectCuratedTemplate: (selection: { templateId: string; revisionId: string; targetKey: string; scope: PdfCuratedTemplateScope; overrides?: PdfCuratedTemplateSelection['overrides'] }) => api.post<PdfCuratedTemplateSelection & { targetKey: string; scope: PdfCuratedTemplateScope }>('/pdf-document-templates/selections', selection),
  clearCuratedSelection: (scope: PdfCuratedTemplateScope, targetKey: string) => api.delete(`/pdf-document-templates/selections/${encodeURIComponent(scope)}/${encodeURIComponent(targetKey)}`),
  previewCuratedTemplate: (templateId: string, body: { revisionId: string; targetKey: string; scope: PdfCuratedTemplateScope; overrides?: PdfCuratedTemplateSelection['overrides']; data: Record<string, unknown> }) => fetchPdfBlob(`/pdf-document-templates/${encodeURIComponent(templateId)}/preview`, body),
  renderSelectedCuratedTemplate: (targetKey: string, data: Record<string, unknown>) => fetchPdfBlob('/pdf-document-templates/render', { targetKey, data }),
  getCuratedSelections: () => api.get<{ branch: Record<string, PdfCuratedTemplateSelection>; document: Record<string, PdfCuratedTemplateSelection> }>('/pdf-document-templates/selections'),
};
