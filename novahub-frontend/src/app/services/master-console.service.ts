import { api } from './api';

export const masterConsoleService = {
  getOverview: () => api.get<any>('/master-console/overview'),
  getClientDetail: (tenantId: string) => api.get<any>(`/master-console/client/${tenantId}`),

  // Acciones de Facturación
  generateAutoInvoice: (tenantId: string) =>
    api.post<any>(`/master-console/client/${tenantId}/generate-invoice`, {}),

  createManualInvoice: (tenantId: string, data: {
    items: { description: string; quantity: number; unitPrice: number }[];
    dueDate?: string;
  }) => api.post<any>(`/master-console/client/${tenantId}/create-invoice`, data),

  markInvoiceAsPaid: (invoiceId: string) =>
    api.patch<any>(`/master-console/invoice/${invoiceId}/pay`, {}),
};
