export type DocumentOriginBadge = {
  label: string;
  className: string;
};

const ORIGIN_BADGE_COLORS = {
  cashSale: 'bg-cyan-500/10 text-cyan-500',
  estimate: 'bg-violet-500/10 text-violet-500',
  salesOrder: 'bg-orange-500/10 text-orange-500',
  recurring: 'bg-purple-500/10 text-purple-500',
  purchaseRequest: 'bg-orange-500/10 text-orange-500',
  purchaseOrder: 'bg-blue-500/10 text-blue-500',
} as const;

type InvoiceOriginRecord = {
  sourceType?: unknown;
  registerId?: unknown;
  sessionId?: unknown;
  salesOrderId?: unknown;
  number?: unknown;
  notes?: unknown;
};

export function getSalesInvoiceOriginBadge(invoice: InvoiceOriginRecord | null | undefined): DocumentOriginBadge | null {
  const sourceType = String(invoice?.sourceType || '').toUpperCase();
  if (sourceType === 'CASH_SALE' || invoice?.registerId || invoice?.sessionId) {
    return { label: 'Desde Facturación por Caja', className: ORIGIN_BADGE_COLORS.cashSale };
  }
  if (sourceType === 'ESTIMATE') {
    return { label: 'Desde Cotización', className: ORIGIN_BADGE_COLORS.estimate };
  }
  if (sourceType === 'SALES_ORDER' || invoice?.salesOrderId) {
    return { label: 'Desde Orden de Venta', className: ORIGIN_BADGE_COLORS.salesOrder };
  }
  if (
    sourceType === 'RECURRING' ||
    String(invoice?.number || '').toUpperCase().startsWith('FAC-REC-') ||
    String(invoice?.notes || '').toLowerCase().includes('desde recurrente')
  ) {
    return { label: 'Desde Facturas Recurrentes', className: ORIGIN_BADGE_COLORS.recurring };
  }
  return null;
}

export function getSalesOrderOriginBadge(order: { estimateId?: unknown } | null | undefined): DocumentOriginBadge | null {
  return order?.estimateId
    ? { label: 'Desde Cotización', className: ORIGIN_BADGE_COLORS.estimate }
    : null;
}

type PurchaseOriginRecord = {
  originType?: unknown;
  purchaseRequestId?: unknown;
  purchaseRequestNumber?: unknown;
  purchaseOrderId?: unknown;
};

export function getPurchaseOrderOriginBadge(order: PurchaseOriginRecord | null | undefined): DocumentOriginBadge | null {
  return order?.purchaseRequestId || order?.purchaseRequestNumber
    ? { label: 'Desde solicitud', className: ORIGIN_BADGE_COLORS.purchaseRequest }
    : null;
}

export function getPurchaseInvoiceOriginBadge(invoice: PurchaseOriginRecord | null | undefined): DocumentOriginBadge | null {
  const originType = String(invoice?.originType || '').toUpperCase();
  if (originType === 'PURCHASE_REQUEST') {
    return { label: 'Desde solicitud de compra', className: ORIGIN_BADGE_COLORS.purchaseRequest };
  }
  if (originType === 'PURCHASE_ORDER' || invoice?.purchaseOrderId) {
    return { label: 'Desde orden de compra', className: ORIGIN_BADGE_COLORS.purchaseOrder };
  }
  return null;
}
