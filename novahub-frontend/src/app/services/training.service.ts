import { api } from './api';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

// Inicializar cliente de Supabase de forma segura
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

export const trainingService = {
  getVideos: (filters?: any) => api.get('/training-videos', { params: filters }),
  getVideo: (id: string) => api.get(`/training-videos/${id}`),
  createVideo: (data: any) => api.post('/training-videos', data),
  updateVideo: (id: string, data: any) => api.patch(`/training-videos/${id}`, data),
  deleteVideo: (id: string) => api.delete(`/training-videos/${id}`),
  
  getPublicUrl: (path: string) => {
    if (!supabase) return '';
    const { data } = supabase.storage.from('erp_capacitacion').getPublicUrl(path);
    return data.publicUrl;
  },
  
  uploadVideo: async (file: File, folder: string) => {
    if (!supabase) {
      throw new Error('Credenciales de Supabase no configuradas');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('erp_capacitacion')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase Storage Error:', error);
      throw new Error(error.message);
    }

    const { data: publicData } = supabase.storage.from('erp_capacitacion').getPublicUrl(fileName);

    return {
      data: {
        url: publicData.publicUrl,
        path: fileName
      }
    };
  }
};
