import { api } from './api';

const env = (import.meta as any).env;

export const MAX_EVIDENCE_FILES = 2;
export const MAX_EVIDENCE_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function validateEvidenceFile(file: File): void {
  if (!ALLOWED_EVIDENCE_TYPES.has(file.type)) {
    throw new Error(`No se puede adjuntar “${file.name}”: usa una imagen JPG, PNG, WEBP o GIF.`);
  }
  if (file.size > MAX_EVIDENCE_FILE_SIZE) {
    throw new Error(`No se puede adjuntar “${file.name}”: el tamaño máximo es 5 MB.`);
  }
  if (file.size === 0) {
    throw new Error(`No se puede adjuntar “${file.name}”: el archivo está vacío.`);
  }
}

async function uploadEvidence(file: File, index: number): Promise<string> {
  validateEvidenceFile(file);

  const supabaseUrl = String(env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseAnonKey = String(env.VITE_SUPABASE_ANON_KEY || '');
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('No se pudo adjuntar la evidencia: el almacenamiento no está configurado. Contacta al administrador.');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePart = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const fileName = `${uniquePart}-${index}-${safeName}`;

  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl}/storage/v1/object/soporte_tecnico/${encodeURIComponent(fileName)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
          'Content-Type': file.type,
          'x-upsert': 'false',
        },
        body: file,
      },
    );
  } catch {
    throw new Error(`No se pudo adjuntar “${file.name}”: no hay conexión con el almacenamiento.`);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detail = errorBody?.message || errorBody?.error || `error HTTP ${response.status}`;
    throw new Error(`No se pudo adjuntar “${file.name}”: ${detail}.`);
  }

  return `${supabaseUrl}/storage/v1/object/public/soporte_tecnico/${encodeURIComponent(fileName)}`;
}

export const soporteTecnicoService = {
  // Tenant: mis tickets
  getMyTickets: () => api.get<any[]>('/support-tickets/my'),

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
  getAll: () => api.get<any[]>('/support-tickets'),

  // SuperAdmin: stats
  getStats: () => api.get<any>('/support-tickets/stats'),

  // Ver uno
  getOne: (id: string) => api.get<any>(`/support-tickets/${id}`),

  // SuperAdmin: responder
  respond: (id: string, data: { status?: string; adminResponse?: string; priority?: string }) =>
    api.patch<any>(`/support-tickets/${id}`, data),

  // SuperAdmin: eliminar
  remove: (id: string) => api.delete<any>(`/support-tickets/${id}`),
};
