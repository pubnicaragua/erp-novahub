import { api } from './api';
import type { PdfAppearanceProfile, PdfAppearanceProfilePatch } from './pdf-appearance';

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
  resetActiveLayouts: () => api.post<{ updatedCount: number }>('/pdf-document-designs/reset-active-layouts', {}),
  create: (data: Partial<PdfDocumentDesignRecord>) => api.post<PdfDocumentDesignRecord>('/pdf-document-designs', data),
  convertToHtml: (id: string) => api.post<PdfDocumentDesignRecord>(`/pdf-document-designs/${id}/convert-html`, {}),
  update: (id: string, data: Partial<PdfDocumentDesignRecord>) => api.patch<PdfDocumentDesignRecord>(`/pdf-document-designs/${id}`, data),
  remove: (id: string) => api.delete(`/pdf-document-designs/${id}`),
};
