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
  userTheme?: {
    colors?: Partial<Record<'primary' | 'primaryForeground' | 'accent' | 'accentForeground' | 'sidebar' | 'sidebarForeground' | 'sidebarPrimary' | 'sidebarAccent', string>>;
  } | null;
}

/**
 * Branding can arrive directly or wrapped by API adapters/interceptors.
 * Keep the shape normalization in one place so every screen applies the
 * same tenant branding instead of falling back to the default palette.
 */
export function normalizeBrandingResponse(payload: unknown): Branding | null {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const candidate = record.data && typeof record.data === 'object'
    ? record.data
    : record.branding && typeof record.branding === 'object'
      ? record.branding
      : payload;

  return candidate && typeof candidate === 'object' ? candidate as Branding : null;
}

export const brandingService = {
  getCurrent: async (signal?: AbortSignal) => {
    const response = await api.get<unknown>('/branding/current', { signal });
    return normalizeBrandingResponse(response);
  },
  update: (data: Partial<Branding> & { userTheme?: Branding['userTheme'] }) => api.post('/branding/update', data),
};
