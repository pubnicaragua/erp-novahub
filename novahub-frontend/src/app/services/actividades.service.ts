import { api } from './api';
import { resolveStorageReferences } from './storage.service';
import type { ActivitySubtask, ActivityTimeEntry, Task, Event, Reminder, ActivityLog } from '../types';

const createCrudService = <T>(endpoint: string) => ({
  getAll: async (signal?: AbortSignal, params?: Record<string, unknown>) => {
    const data = await api.get(endpoint, { signal, params }) as T[];
    return resolveStorageReferences(data);
  },
  getById: async (id: string, signal?: AbortSignal) => {
    const data = await api.get(`${endpoint}/${id}`, { signal }) as T;
    return resolveStorageReferences(data);
  },
  create: async (payload: Partial<T>) => {
    const data = await api.post(endpoint, payload) as T;
    return data;
  },
  update: async (id: string, payload: Partial<T>) => {
    const data = await api.patch(`${endpoint}/${id}`, payload) as T;
    return data;
  },
  delete: async (id: string) => {
    const data = await api.delete(`${endpoint}/${id}`);
    return data;
  }
});

export const tasksService = {
  ...createCrudService<Task>('/activities/tasks'),
  complete: async (id: string, evidenceData?: any) => {
    return await api.post(`/activities/tasks/${id}/complete`, evidenceData || {});
  },
  submitApproval: async (id: string, evidenceData?: any) => {
    return await api.post(`/activities/tasks/${id}/submit-approval`, evidenceData || {});
  },
  approve: async (id: string) => {
    return await api.post(`/activities/tasks/${id}/approve`, {});
  },
  reject: async (id: string, reason: string) => {
    return await api.post(`/activities/tasks/${id}/reject`, { reason });
  },
  // Subtasks
  getSubtasks: async (id: string) => {
    return await api.get(`/activities/tasks/${id}/subtasks`) as ActivitySubtask[];
  },
  addSubtask: async (id: string, data: { title: string }) => {
    return await api.post(`/activities/tasks/${id}/subtasks`, data) as ActivitySubtask;
  },
  updateSubtask: async (id: string, subtaskId: string, data: Partial<ActivitySubtask>) => {
    return await api.patch(`/activities/tasks/${id}/subtasks/${subtaskId}`, data) as ActivitySubtask;
  },
  deleteSubtask: async (id: string, subtaskId: string) => {
    return await api.delete(`/activities/tasks/${id}/subtasks/${subtaskId}`);
  },
  // Time Tracking
  getTimeEntries: async (id: string) => {
    return await api.get(`/activities/tasks/${id}/time-entries`) as ActivityTimeEntry[];
  },
  startTimeEntry: async (id: string, description?: string) => {
    return await api.post(`/activities/tasks/${id}/time-entries/start`, { description }) as ActivityTimeEntry;
  },
  stopTimeEntry: async (id: string, entryId: string) => {
    return await api.post(`/activities/tasks/${id}/time-entries/${entryId}/stop`, {}) as ActivityTimeEntry;
  },
  addManualTimeEntry: async (id: string, data: { durationSeconds: number; description?: string; startedAt?: string }) => {
    return await api.post(`/activities/tasks/${id}/time-entries/manual`, data) as ActivityTimeEntry;
  },
};

export const eventsService = {
  ...createCrudService<Event>('/activities/events'),
  sendInvitations: async (id: string) => {
    return await api.post(`/activities/events/${id}/invite`, {});
  },
  getIcsUrl: (id: string) => {
    return `${api.getBaseUrl ? api.getBaseUrl() : '/api'}/activities/events/${id}/ics`;
  },
  downloadIcs: async (id: string, eventTitle?: string) => {
    const res = await fetch(`/api/activities/events/${id}/ics`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
    });
    if (!res.ok) throw new Error('No se pudo descargar el archivo .ics');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${eventTitle ? eventTitle.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'evento'}.ics`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  scheduleMeeting: async (id: string, platform: 'GOOGLE_MEET' | 'TEAMS' | 'ZOOM') => {
    return await api.post(`/activities/events/${id}/schedule-meeting`, { platform }) as Event;
  },
};

export const remindersService = createCrudService<Reminder>('/activities/reminders');
export const activityLogsService = createCrudService<ActivityLog>('/activities/logs');
