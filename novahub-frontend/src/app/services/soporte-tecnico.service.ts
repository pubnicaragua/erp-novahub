import { api } from './api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('nh-auth-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
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

    // Upload evidence images to Supabase bucket soporte_tecnico
    if (data.evidenceFiles && data.evidenceFiles.length > 0) {
      const uploads = await Promise.all(
        data.evidenceFiles.slice(0, 2).map(async (file, idx) => {
          const fileName = `${Date.now()}_${idx}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const formData = new FormData();
          formData.append('file', file);

          // Direct upload to Supabase Storage public bucket
          const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
          const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

          if (SUPABASE_URL && SUPABASE_ANON_KEY) {
            try {
              const res = await fetch(
                `${SUPABASE_URL}/storage/v1/object/soporte_tecnico/${fileName}`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'x-upsert': 'true',
                  },
                  body: file,
                }
              );
              if (res.ok) {
                return `${SUPABASE_URL}/storage/v1/object/public/soporte_tecnico/${fileName}`;
              }
            } catch (e) {
              console.error('Error uploading evidence:', e);
            }
          }

          // Fallback: base64
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        })
      );
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
