import { createClient } from '@supabase/supabase-js';
import { api, apiRequest } from './api';

export type StoragePurpose =
  | 'tenant-branding'
  | 'user-avatar'
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

export const storageService = {
  async uploadFile(
    purpose: StoragePurpose,
    file: File,
    options: { folder?: string; scopeId?: string } = {},
  ): Promise<UploadedFile> {
    if (!supabase) throw new Error('El almacenamiento no está configurado. Contacta al administrador.');

    const prepared = await api.post<PreparedUpload>(`/storage/uploads/${purpose}`, {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      folder: options.folder,
      scopeId: options.scopeId,
    });
    const { error } = await supabase.storage
      .from(prepared.bucket)
      .uploadToSignedUrl(prepared.path, prepared.token, file, {
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      });

    if (error) throw new Error('No se pudo subir el archivo al almacenamiento.');
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
