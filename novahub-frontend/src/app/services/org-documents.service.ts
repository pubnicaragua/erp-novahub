import { api, ApiRequestError, getApiUrl, getAuthHeaders } from './api';

export type OrgDocKind = 'DOC' | 'SHEET';
export type OrgDocAudience = 'PRIVATE' | 'USERS' | 'DEPARTMENT' | 'TEAM';
export type OrgDocPermission = 'VIEW' | 'EDIT';

export interface OrgDocumentSummary {
  id: string;
  kind: OrgDocKind;
  title: string;
  audience: OrgDocAudience;
  audienceUserIds: string[];
  departmentId: string | null;
  permission: OrgDocPermission;
  ownerId: string;
  ownerName: string;
  version: number;
  byteSize: number;
  hasContent: boolean;
  archived: boolean;
  lastEditedByName: string | null;
  createdAt: string;
  updatedAt: string;
  mine: boolean;
  canEdit: boolean;
  canManage: boolean;
}

export interface OrgDocumentDetail extends OrgDocumentSummary {
  audienceUsers: Array<{ id: string; name: string }>;
}

export interface OrgDocumentPage {
  total: number;
  page: number;
  pageSize: number;
  items: OrgDocumentSummary[];
}

export interface OrgDocumentSharing {
  audience: OrgDocAudience;
  audienceUserIds: string[];
  departmentId: string | null;
  permission: OrgDocPermission;
}

export interface OrgDocumentVersionInfo {
  version: number;
  byteSize: number;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

/** Datos del aviso 409: alguien guardó después de que se abrió el documento. */
export interface VersionConflict {
  currentVersion: number;
  lastEditedByName: string | null;
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Convierte un Blob en base64 (sin el prefijo `data:`). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

/** Si el error es el aviso de versión (409), devuelve sus datos. */
export function asVersionConflict(error: unknown): VersionConflict | null {
  if (!(error instanceof ApiRequestError) || error.status !== 409) return null;
  const body = (error.data ?? {}) as { currentVersion?: number; lastEditedByName?: string | null };
  return { currentVersion: typeof body.currentVersion === 'number' ? body.currentVersion : 0, lastEditedByName: body.lastEditedByName ?? null };
}

export const orgDocumentsService = {
  list: (params: Record<string, string | number | undefined>, signal?: AbortSignal) => api.get<OrgDocumentPage>('/org-documents', { params, signal }),
  get: (id: string, signal?: AbortSignal) => api.get<OrgDocumentDetail>(`/org-documents/${id}`, { signal }),
  departments: (signal?: AbortSignal) => api.get<Array<{ id: string; name: string }>>('/org-documents/lookups/departments', { signal }),
  create: (data: { kind: OrgDocKind; title: string; contentBase64?: string; searchText?: string } & Partial<OrgDocumentSharing>) => api.post<OrgDocumentDetail>('/org-documents', data),
  saveContent: (id: string, data: { baseVersion: number; contentBase64: string; searchText?: string; overwrite?: boolean }) => api.post<OrgDocumentDetail>(`/org-documents/${id}/content`, data),
  update: (id: string, data: Partial<OrgDocumentSharing> & { title?: string }) => api.patch<OrgDocumentDetail>(`/org-documents/${id}`, data),
  duplicate: (id: string) => api.post<OrgDocumentDetail>(`/org-documents/${id}/duplicate`, {}),
  archive: (id: string) => api.post<OrgDocumentDetail>(`/org-documents/${id}/archive`, {}),
  restore: (id: string) => api.post<OrgDocumentDetail>(`/org-documents/${id}/restore`, {}),
  versions: (id: string, signal?: AbortSignal) => api.get<OrgDocumentVersionInfo[]>(`/org-documents/${id}/versions`, { signal }),
  restoreVersion: (id: string, version: number, baseVersion: number) => api.post<OrgDocumentDetail>(`/org-documents/${id}/restore-version`, { version, baseVersion }),

  /** Descarga el archivo (.docx/.xlsx) guardado; la autorización la da el propio documento. */
  async file(id: string, version?: number, signal?: AbortSignal): Promise<{ blob: Blob; version: number }> {
    const response = await fetch(getApiUrl(`/org-documents/${id}/file`, version ? { version } : undefined), { headers: getAuthHeaders(), signal });
    if (!response.ok) {
      let message = 'No se pudo abrir el archivo';
      try { const body = (await response.json()) as { message?: string }; if (body?.message) message = String(body.message); } catch { /* sin cuerpo */ }
      throw new Error(message);
    }
    return { blob: await response.blob(), version: Number(response.headers.get('X-Document-Version')) || version || 0 };
  },
};

/** Guarda un Blob en el equipo de quien lo pide. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
