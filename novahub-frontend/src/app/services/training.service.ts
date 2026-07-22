import { api } from './api';
import { storageService } from './storage.service';

export const trainingService = {
  getVideos: (filters?: any) => api.get('/training-videos', { params: filters }),
  getVideo: (id: string) => api.get(`/training-videos/${id}`),
  createVideo: (data: any) => api.post('/training-videos', data),
  updateVideo: (id: string, data: any) => api.patch(`/training-videos/${id}`, data),
  deleteVideo: (id: string) => api.delete(`/training-videos/${id}`),
  getPublicUrl: (path: string) => storageService.getPublicUrl(path),
  uploadVideo: async (file: File, folder: string) => {
    const uploaded = await storageService.uploadFile('training', file, { folder });
    return { data: { url: uploaded.url, path: uploaded.path } };
  },
};
