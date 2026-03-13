import { api } from './api';

export interface Branding {
  logo: string | null;
  primaryColor: string;
  sidebarColor: string;
  accentColor: string;
  whiteLabel: boolean;
  companyName: string;
}

export const brandingService = {
  getCurrent: () => api.get<Branding>('/branding/current'),
  update: (data: Partial<Branding>) => api.post('/branding/update', data),
};
