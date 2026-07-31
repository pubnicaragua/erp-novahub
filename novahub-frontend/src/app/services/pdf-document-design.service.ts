import { api } from './api';

/** Identificador de una salida PDF. Puede ser legacy (Ventas) o module.subview. */
export type PdfDocumentType = string;

export interface PdfDocumentDesignRecord {
  id: string;
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

export const pdfDocumentDesignService = {
  list: () => api.get<PdfDocumentDesignRecord[]>('/pdf-document-designs'),
  listFolders: () => api.get<PdfDocumentDesignFolder[]>('/pdf-document-designs/folders'),
  createFolder: (data: { name: string; color?: string }) => api.post<PdfDocumentDesignFolder>('/pdf-document-designs/folders', data),
  updateFolder: (id: string, data: { name?: string; color?: string }) => api.patch<PdfDocumentDesignFolder>(`/pdf-document-designs/folders/${id}`, data),
  removeFolder: (id: string) => api.delete(`/pdf-document-designs/folders/${id}`),
  active: (documentType: PdfDocumentType) => api.get<PdfDocumentDesignRecord | null>(`/pdf-document-designs/active/${encodeURIComponent(documentType)}`),
  create: (data: Partial<PdfDocumentDesignRecord>) => api.post<PdfDocumentDesignRecord>('/pdf-document-designs', data),
  convertToHtml: (id: string) => api.post<PdfDocumentDesignRecord>(`/pdf-document-designs/${id}/convert-html`, {}),
  update: (id: string, data: Partial<PdfDocumentDesignRecord>) => api.patch<PdfDocumentDesignRecord>(`/pdf-document-designs/${id}`, data),
  remove: (id: string) => api.delete(`/pdf-document-designs/${id}`),
};
