import { purchaseOrdersService, supplierInvoicesService, expensesService, recurringExpensesService } from '../services/compras.service';

export interface SupplierHistoryItem {
  date: string;
  rawDate: Date;
  type: string;
  docNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  currency: string;
  exchangeRate?: number;
  code?: string | null;
  productCode?: string | null;
  variantId?: string | null;
  variantSku?: string | null;
  variantName?: string | null;
  variantAttributes?: unknown;
  variant?: Record<string, unknown> | null;
}

const unwrapList = (response: any): any[] => {
  const candidates = [response?.data?.data, response?.data, response];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (Array.isArray(candidate?.data)) return candidate.data;
    if (Array.isArray(candidate?.items)) return candidate.items;
  }
  return [];
};

const getTotalPages = (response: any) => Number(
  response?.meta?.totalPages
  ?? response?.data?.meta?.totalPages
  ?? response?.data?.data?.meta?.totalPages
  ?? 1,
);

const fetchAllSupplierRecords = async (
  fetcher: (filters: any, signal?: AbortSignal) => Promise<any>,
  supplierId: string,
  signal?: AbortSignal,
) => {
  const rows: any[] = [];
  let page = 1;
  while (page <= 1000) {
    const response = await fetcher({ supplierId, page, pageSize: 5000, report: true }, signal);
    rows.push(...unwrapList(response));
    const totalPages = Math.max(1, getTotalPages(response));
    if (page >= totalPages) break;
    page += 1;
  }
  return rows;
};

export async function fetchSupplierHistoryItems(supplierId: string, signal?: AbortSignal): Promise<SupplierHistoryItem[]> {
  const results = await Promise.allSettled([
    fetchAllSupplierRecords((filters, requestSignal) => purchaseOrdersService.getAll(filters, requestSignal), supplierId, signal),
    fetchAllSupplierRecords((filters, requestSignal) => supplierInvoicesService.getAll(filters, requestSignal), supplierId, signal),
    fetchAllSupplierRecords((filters, requestSignal) => expensesService.getAll(filters, requestSignal), supplierId, signal),
    fetchAllSupplierRecords((filters, requestSignal) => recurringExpensesService.getAll(filters, requestSignal), supplierId, signal),
  ]);

  const [ordersResult, invoicesResult, expensesResult, recurringResult] = results;
  const rawOrders = ordersResult.status === 'fulfilled' ? ordersResult.value : [];
  const rawInvoices = invoicesResult.status === 'fulfilled' ? invoicesResult.value : [];
  const rawExpenses = expensesResult.status === 'fulfilled' ? expensesResult.value : [];
  const rawRecurring = recurringResult.status === 'fulfilled' ? recurringResult.value : [];
  const historyItems: SupplierHistoryItem[] = [];

  rawOrders.filter((order: any) => order.supplierId === supplierId).forEach((order: any) => {
    (order.items || []).forEach((item: any) => {
      historyItems.push({
        date: new Date(order.date).toLocaleDateString(),
        rawDate: new Date(order.date),
        type: 'Orden',
        docNumber: order.number,
        description: item.description || 'Producto sin nombre',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        currency: order.currency || 'NIO',
        exchangeRate: order.exchangeRate,
        code: item.code || item.product?.code || null,
        productCode: item.productCode || item.product?.code || null,
        variantId: item.variantId || null,
        variantSku: item.variantSku || item.variant?.sku || null,
        variantName: item.variantName || item.variant?.name || null,
        variantAttributes: item.variantAttributes ?? item.variant?.attributes,
        variant: item.variant || null,
      });
    });
  });

  rawInvoices.filter((invoice: any) => invoice.supplierId === supplierId).forEach((invoice: any) => {
    (invoice.items || []).forEach((item: any) => {
      historyItems.push({
        date: new Date(invoice.date).toLocaleDateString(),
        rawDate: new Date(invoice.date),
        type: 'Factura',
        docNumber: invoice.number,
        description: item.description || 'Producto sin nombre',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        currency: invoice.currency || 'NIO',
        exchangeRate: invoice.exchangeRate,
        code: item.code || item.product?.code || null,
        productCode: item.productCode || item.product?.code || null,
        variantId: item.variantId || null,
        variantSku: item.variantSku || item.variant?.sku || null,
        variantName: item.variantName || item.variant?.name || null,
        variantAttributes: item.variantAttributes ?? item.variant?.attributes,
        variant: item.variant || null,
      });
    });
  });

  rawExpenses.filter((expense: any) => expense.supplierId === supplierId).forEach((expense: any) => {
    historyItems.push({
      date: new Date(expense.date).toLocaleDateString(),
      rawDate: new Date(expense.date),
      type: 'Gasto',
      docNumber: expense.number || '-',
      description: expense.description || expense.category || 'Gasto',
      quantity: 1,
      unitPrice: expense.amount,
      total: expense.amount,
      currency: expense.currency || 'NIO',
      exchangeRate: expense.exchangeRate,
    });
  });

  rawRecurring.filter((expense: any) => expense.supplierId === supplierId).forEach((expense: any) => {
    historyItems.push({
      date: new Date(expense.startDate).toLocaleDateString(),
      rawDate: new Date(expense.startDate),
      type: 'Gasto Recurrente',
      docNumber: `REC-${expense.id ? expense.id.slice(0, 6).toUpperCase() : ''}`,
      description: expense.description || expense.category || 'Gasto recurrente',
      quantity: 1,
      unitPrice: expense.amount,
      total: expense.amount,
      currency: expense.currency || 'NIO',
      exchangeRate: expense.exchangeRate,
    });
  });

  return historyItems.sort((left, right) => right.rawDate.getTime() - left.rawDate.getTime());
}
