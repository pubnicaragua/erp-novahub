import { api } from './api';

export type PortfolioCustomer = {
  assignmentId: string;
  assignmentStatus: 'ACTIVE' | 'TRANSFERRED' | 'PORTFOLIO_CLOSED';
  assignedAt: string;
  endedAt?: string | null;
  mapPointId?: string | null;
  hasMapLocation?: boolean;
  customer: {
    id: string;
    code?: string | null;
    name: string;
    address?: string | null;
    city?: string | null;
    department?: string | null;
    phone?: string | null;
    status?: string;
    balance?: number | string;
  };
};

export type ForceSalesPortfolio = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'CLOSED';
  assignedTo: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  sourceFileName?: string | null;
  createdAt: string;
  closedAt?: string | null;
  memberCount: number;
  customers: PortfolioCustomer[];
};

export type ForceSalesPortfolioImportResult = {
  total: number;
  created: number;
  skipped: number;
  errors: string[];
  warnings: string[];
  idempotentReplay?: boolean;
  portfolios?: Array<{ id: string; name: string; assignedToId: string | null; assignedToName: string | null; memberCount: number }>;
};

export type AvailablePortfolioCustomer = {
  id: string;
  code: string;
  name: string;
  companyName?: string | null;
  taxId?: string | null;
  ruc?: string | null;
  address?: string | null;
  city?: string | null;
};

export type AvailablePortfolioCustomersPage = {
  items: AvailablePortfolioCustomer[];
  total: number;
  skip: number;
  take: number;
};

export type UnlinkedForceSalesProspect = {
  id: string;
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  assignedToId?: string | null;
};

export const forceSalesPortfoliosService = {
  list: (includeHistory = true) => api.get<ForceSalesPortfolio[]>('/force-sales/portfolios', { params: { includeHistory } }),
  assignees: () => api.get<Array<{ id: string; name: string; activeRouteCount: number }>>('/force-sales/assignees'),
  availableCustomers: (search = '', skip = 0, take = 50) => api.get<AvailablePortfolioCustomersPage>('/force-sales/portfolios/available-customers', { params: { search, skip, take } }),
  create: (data: { name: string; assignedToId: string; customerIds: string[] }) => api.post<{ id: string; name: string; status: 'ACTIVE'; assignedToId: string; createdAt: string; memberCount: number }>('/force-sales/portfolios', data),
  unlinkedProspects: () => api.get<UnlinkedForceSalesProspect[]>('/force-sales/portfolios/unlinked-prospects'),
  import: (data: {
    rows: Array<Record<string, unknown>>;
    sourceFileName: string;
    batchId: string;
    portfolioName: string;
    portfolioNamesByAssignee: Record<string, string>;
    openingBalanceCurrency: 'NIO' | 'USD';
    openingBalanceDate: string;
  }) => api.post<ForceSalesPortfolioImportResult>('/force-sales/portfolios/import', data),
  close: (portfolioId: string) => api.post(`/force-sales/portfolios/${encodeURIComponent(portfolioId)}/close`, {}),
  transfer: (customerId: string, portfolioId: string) => api.post(`/force-sales/portfolios/customers/${encodeURIComponent(customerId)}/transfer`, { portfolioId }),
  linkToProspect: (portfolioId: string, customerId: string, prospectId: string) => api.post(
    `/force-sales/portfolios/${encodeURIComponent(portfolioId)}/customers/${encodeURIComponent(customerId)}/link`,
    { prospectId },
  ),
  saveLocation: (portfolioId: string, customerId: string, lat: number, lng: number) => api.post<{ id: string; customerId: string; lat: number; lng: number }>(
    `/force-sales/portfolios/${encodeURIComponent(portfolioId)}/customers/${encodeURIComponent(customerId)}/location`,
    { lat, lng },
  ),
};
