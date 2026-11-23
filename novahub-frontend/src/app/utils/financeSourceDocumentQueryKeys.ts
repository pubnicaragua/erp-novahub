export type FinanceSourceDocumentOrigin = 'SALES' | 'PURCHASES';

export const financeSourceDocumentQueryKeys = {
  summary: (origin: FinanceSourceDocumentOrigin, tenantKey: string) =>
    ['finance', 'source-document-summary', origin, tenantKey] as const,
  projection: (origin: FinanceSourceDocumentOrigin, tenantKey: string) =>
    ['finance', 'source-document-projection', origin, tenantKey] as const,
  lookup: (origin: FinanceSourceDocumentOrigin, tenantKey: string) =>
    ['finance', 'source-document-lookup', origin, tenantKey] as const,
};
