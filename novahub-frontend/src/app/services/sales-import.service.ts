import { api, apiRequest } from "./api";

export type SalesImportKind = "INVOICE" | "POS";

export interface SalesImportDocument {
  reference: string;
  sourceRowNumber: number;
  blockNumber: number;
  lineCount: number;
  status: "READY" | "BLOCKED" | "CONFIRMED" | "FAILED" | string;
  invoiceId?: string | null;
  error?: string | null;
  result?: {
    invoiceNumber?: string;
    status?: string;
    total?: number;
    currency?: string;
    warning?: string;
    postCommitWarning?: string | null;
  } | null;
  preview?: {
    customerName?: string | null;
    date?: string;
    currency?: string;
    totals?: {
      subtotal?: number;
      discountAmount?: number;
      taxAmount?: number;
      total?: number;
    };
    items?: Array<{
      sourceRowNumber?: number;
      productCode?: string;
      description?: string;
      quantity?: number;
      unitPrice?: number;
      taxRate?: number;
      discount?: number;
      warehouseName?: string | null;
      availableStock?: number | null;
    }>;
    errors?: Array<{ rowNumber?: number; field?: string; message: string }>;
    warnings?: Array<{
      rowNumber?: number;
      field?: string;
      message: string;
      matches?: Array<{
        number: string;
        total: number;
        currency: string;
        matchedCriteria?: string[];
      }>;
    }>;
  } | null;
}

export interface SalesImportBatch {
  batchId: string;
  kind: SalesImportKind;
  status: string;
  context?: { registerId?: string | null; sessionId?: string | null };
  globalErrors?: Array<{ rowNumber?: number; message: string }>;
  summary: {
    total: number;
    ready: number;
    blocked: number;
    completed: number;
    failed: number;
    postCommitFailed?: number;
    postCommitRetryable?: number;
    postCommitProcessing?: number;
    blocks: Array<{
      blockNumber: number;
      total: number;
      ready: number;
      blocked: number;
      confirmed: number;
      failed: number;
      postCommitFailed?: number;
      postCommitRetryable?: number;
      postCommitProcessing?: number;
    }>;
  };
  page: { page: number; pageSize: number; total: number };
  documents: SalesImportDocument[];
}

export interface SalesImportPreviewResponse {
  requiresDuplicateConfirmation?: boolean;
  existingBatchId?: string;
  message?: string;
  batchId?: string;
  kind?: SalesImportKind;
  status?: string;
  summary?: SalesImportBatch["summary"];
  page?: SalesImportBatch["page"];
  documents?: SalesImportDocument[];
  [key: string]: unknown;
}

const basePath = (kind: SalesImportKind) =>
  kind === "POS" ? "/caja/invoices/import" : "/sales/invoices/import";

export const salesImportService = {
  preview: (
    kind: SalesImportKind,
    file: File,
    context: {
      registerId?: string;
      sessionId?: string;
      allowDuplicateContent?: boolean;
    },
  ) => {
    const form = new FormData();
    form.append("file", file);
    if (context.registerId) form.append("registerId", context.registerId);
    if (context.sessionId) form.append("sessionId", context.sessionId);
    if (context.allowDuplicateContent)
      form.append("allowDuplicateContent", "true");
    return apiRequest<SalesImportPreviewResponse>(`${basePath(kind)}/preview`, {
      method: "POST",
      rawBody: form,
    });
  },
  getBatch: (kind: SalesImportKind, batchId: string, page = 1) =>
    api.get<SalesImportBatch>(
      `${basePath(kind)}/batches/${encodeURIComponent(batchId)}`,
      { params: { page, pageSize: 50 } },
    ),
  confirmBlock: (kind: SalesImportKind, batchId: string, blockNumber: number) =>
    api.post<{
      batch: SalesImportBatch;
      documents: Array<{
        reference: string;
        status: string;
        error?: string | null;
      }>;
    }>(
      `${basePath(kind)}/batches/${encodeURIComponent(batchId)}/blocks/${blockNumber}/confirm`,
      {},
    ),
};
