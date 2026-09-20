import { api } from './api';

export type NovaPulseFrequency = 'DAILY' | 'WEEKDAYS' | 'CUSTOM';

export interface NovaPulseRecipient { id: string; name: string; phoneNumber: string; enabled: boolean; }
export interface NovaPulseDelivery { id: string; type: string; status: string; phoneNumber: string; sentAt?: string | null; createdAt: string; errorMessage?: string | null; recipient?: { name?: string } | null; }
export interface NovaPulseConfig {
  id: string; enabled: boolean; timezone: string; sendTime: string; frequency: NovaPulseFrequency; customDays: number[];
  includeSales: boolean; includeProfit: boolean; includeReceivables: boolean; includePayables: boolean; includeInventory: boolean;
  includeInactiveCustomers: boolean; includeCash: boolean; includeAlerts: boolean; includeNovaInsight: boolean;
  nextRunAt?: string | null; nextRunLabel?: string | null; lastRunAt?: string | null; lastRunLabel?: string | null;
  recipients: NovaPulseRecipient[]; deliveries: NovaPulseDelivery[];
  integration?: { configured: boolean; templateName: string; senderPhoneNumber?: string | null };
}

export const novaPulseService = {
  get: () => api.get<NovaPulseConfig>('/settings/nova-pulse'),
  update: (payload: Partial<NovaPulseConfig>) => api.patch<NovaPulseConfig>('/settings/nova-pulse', payload),
  addRecipient: (payload: { name: string; phoneNumber: string; enabled?: boolean }) => api.post<NovaPulseRecipient>('/settings/nova-pulse/recipients', payload),
  updateRecipient: (id: string, payload: Partial<NovaPulseRecipient>) => api.patch<NovaPulseRecipient>(`/settings/nova-pulse/recipients/${id}`, payload),
  deleteRecipient: (id: string) => api.delete<{ ok: boolean }>(`/settings/nova-pulse/recipients/${id}`),
  sendNow: () => api.post<{ total: number; sent: number; failed: number }>('/settings/nova-pulse/send-now', {}),
  sendTest: (recipientId: string) => api.post<{ total: number; sent: number; failed: number }>('/settings/nova-pulse/send-test', { recipientId }),
  deliveries: () => api.get<NovaPulseDelivery[]>('/settings/nova-pulse/deliveries'),
};
