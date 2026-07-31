import { createClient } from '@supabase/supabase-js';
import { api, apiRequest } from './api';

export type StoragePurpose =
  | 'tenant-branding'
  | 'user-avatar'
  | 'product-image'
  | 'training'
  | 'support-evidence'
  | 'purchase-evidence'
  | 'documents'
  | 'hr-documents'
  | 'legal-documents'
  | 'financing-documents'
  | 'activity-log'
  | 'task-evidence';

interface PreparedUpload {
  bucket: string;
  path: string;
  token: string;
  signedUrl?: string;
  uri: string;
  publicUrl: string | null;
}

export interface UploadedFile {
  uri: string;
  url: string;
  bucket: string;
  path: string;
}

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '');
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function getUploadMimeType(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'html' || extension === 'htm') return 'text/html';
  return file.type || 'application/octet-stream';
}

export const storageService = {
  async uploadFile(
    purpose: StoragePurpose,
    file: File,
    options: { folder?: string; scopeId?: string } = {},
  ): Promise<UploadedFile> {
    const mimeType = getUploadMimeType(file);
    const uploadFile = file.type === mimeType
      ? file
      : new File([file], file.name, { type: mimeType });
    const prepared = await api.post<PreparedUpload>(`/storage/uploads/${purpose}`, {
      fileName: file.name,
      mimeType,
      size: file.size,
      folder: options.folder,
      scopeId: options.scopeId,
    });

    // The backend creates the signed URL with its service-role client. Uploading
    // to that exact URL avoids rebuilding it with the browser Supabase client,
    // which can point to a different project when environments drift.
    if (prepared.signedUrl) {
      const body = new FormData();
      body.append('cacheControl', '3600');
      body.append('', uploadFile);

      const response = await fetch(prepared.signedUrl, {
        method: 'PUT',
        headers: { 'x-upsert': 'false' },
        body,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        let message = detail;
        try {
          const parsed = JSON.parse(detail) as { message?: string; error?: string };
          message = parsed.message || parsed.error || detail;
        } catch {
          // Keep the raw response when Storage does not return JSON.
        }
        throw new Error(
          `No se pudo subir el archivo al almacenamiento (${response.status}).${message ? ` ${message}` : ''}`,
        );
      }
    } else {
      // Compatibility fallback for an older backend response.
      if (!supabase) throw new Error('El almacenamiento no está configurado. Contacta al administrador.');
      const { error } = await supabase.storage
        .from(prepared.bucket)
        .uploadToSignedUrl(prepared.path, prepared.token, uploadFile, {
          contentType: mimeType,
          cacheControl: '3600',
        });
      if (error) {
        throw new Error(`No se pudo subir el archivo al almacenamiento. ${error.message}`);
      }
    }

    const url = prepared.publicUrl || (await this.resolveUrl(prepared.uri));
    return { uri: prepared.uri, url, bucket: prepared.bucket, path: prepared.path };
  },

  async uploadTenantLogo(file: File, tenantId: string): Promise<string> {
    const uploaded = await this.uploadFile('tenant-branding', file, { folder: 'logos', scopeId: tenantId });
    return uploaded.url;
  },

  async uploadUserAvatar(file: File, userId: string): Promise<string> {
    const uploaded = await this.uploadFile('user-avatar', file, { folder: userId });
    return uploaded.url;
  },

  async resolveUrl(uri?: string | null): Promise<string> {
    if (!uri || !uri.startsWith('storage://')) return uri || '';
    const result = await api.post<{ url: string }>('/storage/resolve', { uri });
    return result.url;
  },

  async deleteFile(uri: string): Promise<void> {
    if (!uri?.startsWith('storage://')) return;
    await apiRequest('/storage/files', { method: 'DELETE', body: { uri } });
  },

  getPublicUrl(filePath: string): string {
    return filePath;
  },
};

export async function resolveStorageReferences<T>(value: T): Promise<T> {
  if (typeof value === 'string') {
    return (value.startsWith('storage://') ? await storageService.resolveUrl(value) : value) as T;
  }
  if (Array.isArray(value)) {
    return (await Promise.all(value.map(item => resolveStorageReferences(item)))) as T;
  }
  if (value && typeof value === 'object') {
    const entries: [string, unknown][] = [];
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (typeof item === 'string' && item.startsWith('storage://')) entries.push([`${key}StorageUri`, item]);
      entries.push([key, await resolveStorageReferences(item)]);
    }
    return Object.fromEntries(entries) as T;
  }
  return value;
}
