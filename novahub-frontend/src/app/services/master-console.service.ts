import { api } from './api';

export const masterConsoleService = {
  getOverview: () => api.get<any>('/master-console/overview'),
  getClientDetail: (tenantId: string) => api.get<any>(`/master-console/client/${tenantId}`),
};
