import { api } from './api';

export interface Branding {
  logo: string | null;
  primaryColor: string;
  sidebarColor: string;
  accentColor: string;
  portalPrimaryColor: string;
  portalBackgroundColor: string;
  portalAccentColor: string;
  portalLightPrimaryColor: string;
  portalLightBackgroundColor: string;
  portalLightAccentColor: string;
  portalDefaultTheme: 'dark' | 'light';
  whiteLabel: boolean;
  companyName: string;
  industry?: string;
}

export const brandingService = {
  getCurrent: () => api.get<Branding>('/branding/current'),
  update: (data: Partial<Branding>) => api.post('/branding/update', data),
};
