import { api } from './api';
import { resolveStorageReferences, storageService } from './storage.service';

export const MAX_EVIDENCE_FILES = 2;
export const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function validateEvidenceFile(file: File): void {
  if (!ALLOWED_EVIDENCE_TYPES.has(file.type)) {
    throw new Error(`No se puede adjuntar “${file.name}”: usa una imagen JPG, PNG, WEBP o GIF.`);
  }
  if (file.size > MAX_EVIDENCE_FILE_SIZE) {
    throw new Error(`No se puede adjuntar “${file.name}”: la imagen original no puede superar 10 MB.`);
  }
  if (file.size === 0) {
    throw new Error(`No se puede adjuntar “${file.name}”: el archivo está vacío.`);
  }
}

async function uploadEvidence(file: File, index: number): Promise<string> {
  validateEvidenceFile(file);
  const uploaded = await storageService.uploadFile('support-evidence', file, { folder: `evidencia-${index + 1}` });
  return uploaded.uri;
}

const hydrate = <T>(value: T) => resolveStorageReferences(value);

export const soporteTecnicoService = {
  // Tenant: mis tickets
  getMyTickets: async (signal?: AbortSignal) => hydrate(await api.get<any[]>('/support-tickets/my', { signal })),

  // Tenant: crear ticket (con evidencia como archivos)
  create: async (data: {
    subject: string;
    description: string;
    category: string;
    priority: string;
    evidenceFiles?: File[];
  }) => {
    let evidenceUrl1: string | null = null;
    let evidenceUrl2: string | null = null;

    const evidenceFiles = data.evidenceFiles || [];
    if (evidenceFiles.length > MAX_EVIDENCE_FILES) {
      throw new Error(`Solo puedes adjuntar hasta ${MAX_EVIDENCE_FILES} imágenes por ticket.`);
    }

    if (evidenceFiles.length > 0) {
      // No hay fallback base64: un fallo de Storage se informa y nunca se envía
      // silenciosamente un JSON demasiado grande al backend.
      const uploads = await Promise.all(evidenceFiles.map(uploadEvidence));
      evidenceUrl1 = uploads[0] || null;
      evidenceUrl2 = uploads[1] || null;
    }

    return api.post<any>('/support-tickets', {
      subject: data.subject,
      description: data.description,
      category: data.category,
      priority: data.priority,
      evidenceUrl1,
      evidenceUrl2,
    });
  },

  // SuperAdmin: todos los tickets
  getAll: async (signal?: AbortSignal) => hydrate(await api.get<any[]>('/support-tickets', { signal })),

  // SuperAdmin: stats
  getStats: (signal?: AbortSignal) => api.get<any>('/support-tickets/stats', { signal }),

  // Ver uno
  getOne: async (id: string, signal?: AbortSignal) => hydrate(await api.get<any>(`/support-tickets/${id}`, { signal })),

  // SuperAdmin: responder
  respond: (id: string, data: { status?: string; adminResponse?: string; priority?: string }) =>
    api.patch<any>(`/support-tickets/${id}`, data),

  // SuperAdmin: eliminar
  remove: (id: string) => api.delete<any>(`/support-tickets/${id}`),
};
