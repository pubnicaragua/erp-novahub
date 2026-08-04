import { api } from './api';

export interface Branding {
  logo: string | null;
  primaryColor: string;
  sidebarColor: string;
  accentColor: string;
  portalPrimaryColor: string;
  portalAccentColor: string;
  whiteLabel: boolean;
  companyName: string;
  industry?: string;
}

export const brandingService = {
  getCurrent: (signal?: AbortSignal) => api.get<Branding>('/branding/current', { signal }),
  update: (data: Partial<Branding>) => api.post('/branding/update', data),
};
