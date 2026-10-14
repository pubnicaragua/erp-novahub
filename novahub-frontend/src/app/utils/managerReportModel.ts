import type { PdfDownloadFormat } from './pdfDownloadFormats';

export type ManagerReportColumn = string | { key: string; label: string };

export type ManagerReportOptions = {
  title: string;
  fileBase?: string;
  tenantName?: string;
  tenantLogo?: string | null;
  primaryColor?: string | null;
  scopeSummary?: string;
  filterSummary?: string;
  dateFrom?: unknown;
  dateTo?: unknown;
  currency?: string;
  pdfFormat?: PdfDownloadFormat;
  metrics?: Record<string, unknown>;
  metricLabels?: Record<string, string>;
  columns?: ManagerReportColumn[];
  rows?: Array<Record<string, unknown>>;
  extraSheets?: Array<{ name: string; rows: Array<Record<string, unknown>> }>;
};

export type ManagerReportModel = {
  title: string;
  fileBase: string;
  tenantName: string;
  tenantLogo?: string | null;
  primaryColor?: string | null;
  scopeSummary: string;
  filterSummary: string;
  dateRange: string;
  currency: string;
  createdAt: Date;
  metrics: Array<{ label: string; value: string }>;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  extraSheets: Array<{ name: string; columns: Array<{ key: string; label: string }>; rows: Array<Record<string, unknown>> }>;
  emptyMessage?: string;
};

export const EMPTY_REPORT_MESSAGE = 'Sin registros para el alcance seleccionado';

export function buildManagerReportScopeSummary({
  groupName,
  branches,
  businessUnitId,
  branchId,
}: {
  groupName?: string;
  branches?: Array<{ id: string; name: string; businessUnitId?: string | null }>;
  businessUnitId?: string;
  branchId?: string;
}) {
  const groupLabel = String(groupName || 'Grupo empresarial').trim();
  const selectedBranch = branches?.find((branch) => branch.id === branchId);
  if (selectedBranch) return `${groupLabel} · Sucursal: ${selectedBranch.name}`;
  if (businessUnitId) {
    const unitBranches = (branches || []).filter((branch) => branch.businessUnitId === businessUnitId);
    return `${groupLabel} · Unidad de negocio seleccionada · ${unitBranches.length} sucursal(es)`;
  }
  return `${groupLabel} · ${branches?.length || 0} sucursal(es) autorizada(s)`;
}

export function buildManagerReportFilterSummary(filters: Record<string, unknown>, labels: Record<string, string> = {}) {
  const defaultLabels: Record<string, string> = {
    accountType: 'Tipo de cuenta', currency: 'Moneda', dateFrom: 'Desde', dateTo: 'Hasta', deliveryBranchId: 'Sucursal de entrega',
    method: 'Método de pago', movementType: 'Tipo de movimiento', priceListMode: 'Modo de lista', reason: 'Motivo',
    registerId: 'Caja', reportCurrency: 'Moneda de referencia', search: 'Búsqueda', status: 'Estado', supplierType: 'Tipo de proveedor',
    warehouseId: 'Bodega / almacén', warehouseType: 'Tipo de ubicación',
  };
  const omitted = new Set(['page', 'pageSize', 'report', 'export', 'view', 'module', 'businessUnitId', 'branchId']);
  const parts = Object.entries(filters)
    .filter(([key, value]) => !omitted.has(key) && value != null && String(value).trim() !== '')
    .map(([key, value]) => `${labels[key] || defaultLabels[key] || metricLabel(key, {})}: ${String(value)}`);
  return parts.join(' · ') || 'Sin filtros adicionales';
}

export function formatManagerReportValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) return value.toLocaleString('es-NI');
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === 'object') {
        return Object.entries(item as Record<string, unknown>)
          .filter(([, nested]) => nested == null || typeof nested !== 'object')
          .map(([key, nested]) => `${key}: ${formatManagerReportValue(nested)}`)
          .filter((part) => !part.endsWith(': '))
          .join(' · ');
      }
      return formatManagerReportValue(item);
    }).filter(Boolean).join(' | ');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested == null || typeof nested !== 'object')
      .map(([key, nested]) => `${key}: ${formatManagerReportValue(nested)}`)
      .filter((part) => !part.endsWith(': '))
      .join(' · ');
  }
  return String(value);
}

function metricLabel(key: string, labels: Record<string, string>) {
  if (labels[key]) return labels[key];
  const known: Record<string, string> = {
    amount: 'Monto', amountCurrency: 'Moneda del monto', assets: 'Activos fijos', audits: 'Auditorías', balance: 'Saldo', branchCount: 'Sucursales', branches: 'Sucursales',
    branchWarehouses: 'Almacenes de sucursal', cash: 'Efectivo', completed: 'Completadas', corporateWarehouses: 'Almacenes corporativos',
    branchName: 'Sucursal', code: 'Código', count: 'Cantidad', credit: 'Haber', currency: 'Moneda', customers: 'Clientes', debit: 'Debe', decreasedUnits: 'Unidades disminuidas', difference: 'Diferencia', employees: 'Empleados',
    entries: 'Entradas', expense: 'Gastos', expenses: 'Gastos', increasedUnits: 'Unidades aumentadas', income: 'Ingresos', inventoryLines: 'Líneas de inventario',
    inventoryUnits: 'Unidades en inventario', invoices: 'Facturas', journals: 'Asientos', losses: 'Pérdidas', movements: 'Movimientos', name: 'Nombre',
    net: 'Neto', orders: 'Órdenes', periods: 'Períodos', products: 'Productos', productsAffected: 'Productos afectados', providers: 'Proveedores',
    balanceOriginalCurrencyBreakdown: 'Saldo por moneda original', incomeOriginalCurrencyBreakdown: 'Ingresos por moneda original',
    expenseOriginalCurrencyBreakdown: 'Gastos por moneda original', netOriginalCurrencyBreakdown: 'Resultado por moneda original',
    inflowOriginalCurrencyBreakdown: 'Entradas por moneda original', outflowOriginalCurrencyBreakdown: 'Salidas por moneda original',
    orderedOriginalCurrencyBreakdown: 'Órdenes por moneda original', paidOriginalCurrencyBreakdown: 'Pagos por moneda original',
    pendingOriginalCurrencyBreakdown: 'Saldos pendientes por moneda original', originalCurrencyBreakdown: 'Desglose por moneda original',
    receivablesOriginalCurrencyBreakdown: 'Cuentas por cobrar por moneda original', payablesOriginalCurrencyBreakdown: 'Cuentas por pagar por moneda original',
    receivables: 'Cuentas por cobrar', registerCode: 'Código de caja', registerName: 'Caja', reservedUnits: 'Unidades reservadas', revenue: 'Ventas', sessions: 'Sesiones', serviceCount: 'Servicios',
    services: 'Servicios', suppliers: 'Proveedores', total: 'Total', transactions: 'Movimientos', transfers: 'Traslados', units: 'Unidades',
    unitsIn: 'Unidades ingresadas', unitsOut: 'Unidades retiradas', value: 'Valor', warehouses: 'Almacenes',
  };
  if (known[key]) return known[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase('es-NI'));
}

function normalizeColumns(rows: Array<Record<string, unknown>>, columns?: ManagerReportColumn[]) {
  if (columns?.length) return columns.map((column) => typeof column === 'string' ? { key: column, label: column } : column);
  return Object.keys(rows[0] || {}).map((key) => ({ key, label: key }));
}

function buildMetricBreakdownRows(metrics: Record<string, unknown>, metricLabels: Record<string, string> = {}) {
  const rows: Array<Record<string, unknown>> = [];
  Object.entries(metrics).forEach(([key, value]) => {
    if (!Array.isArray(value) || key === 'registerSummary') return;
    value.forEach((item) => {
      const source = item && typeof item === 'object' && !Array.isArray(item)
        ? item as Record<string, unknown>
        : { value: item };
      rows.push({
        Indicador: metricLabel(key, metricLabels),
        ...Object.fromEntries(Object.entries(source).map(([field, fieldValue]) => [metricLabel(field, {}), fieldValue])),
      });
    });
  });
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key] ?? '—'])));
}

function dateRangeLabel(dateFrom?: unknown, dateTo?: unknown) {
  const from = String(dateFrom || '').trim();
  const to = String(dateTo || '').trim();
  if (!from && !to) return 'Todo el período disponible';
  if (from && to) return from === to ? from : `${from} a ${to}`;
  return `${from || 'Inicio'} a ${to || 'Actualidad'}`;
}

export function buildManagerReportModel(options: ManagerReportOptions): ManagerReportModel {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const metrics = Object.entries(options.metrics || {})
    .filter(([, value]) => value == null || ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => ({ label: metricLabel(key, options.metricLabels || {}), value: formatManagerReportValue(value) }))
    .filter((entry) => entry.value !== '');
  const extraSheets = (options.extraSheets || []).filter((sheet) => sheet.rows.length).map((sheet) => ({
    name: sheet.name,
    columns: normalizeColumns(sheet.rows),
    rows: sheet.rows,
  }));
  const metricBreakdown = buildMetricBreakdownRows(options.metrics || {}, options.metricLabels);
  if (metricBreakdown.length) extraSheets.push({ name: 'Desglose de indicadores', columns: normalizeColumns(metricBreakdown), rows: metricBreakdown });
  return {
    title: options.title,
    fileBase: options.fileBase || options.title,
    tenantName: options.tenantName || 'NovaHub',
    tenantLogo: options.tenantLogo,
    primaryColor: options.primaryColor,
    scopeSummary: options.scopeSummary?.trim() || 'Alcance autorizado de Manager',
    filterSummary: options.filterSummary?.trim() || 'Sin filtros adicionales',
    dateRange: dateRangeLabel(options.dateFrom, options.dateTo),
    currency: options.currency || '',
    createdAt: new Date(),
    metrics,
    columns: normalizeColumns(rows, options.columns),
    rows,
    extraSheets,
    ...(rows.length || metrics.length || extraSheets.length ? {} : { emptyMessage: EMPTY_REPORT_MESSAGE }),
  };
}

function escapeCsv(value: unknown, delimiter: string) {
  const cell = value == null ? '' : String(value);
  return /["\r\n]/.test(cell) || cell.includes(delimiter)
    ? `"${cell.replace(/"/g, '""')}"`
    : cell;
}

export function buildManagerCsv(rows: Array<Record<string, unknown>>, delimiter = ',') {
  const safeDelimiter = delimiter && !/["\r\n]/.test(delimiter) ? delimiter : ',';
  const keys = rows.length ? Object.keys(rows[0]) : [];
  if (!keys.length) return '\uFEFF';
  const lines = [keys.map((key) => escapeCsv(key, safeDelimiter)).join(safeDelimiter)];
  rows.forEach((row) => lines.push(keys.map((key) => escapeCsv(row[key], safeDelimiter)).join(safeDelimiter)));
  return `\uFEFF${lines.join('\r\n')}`;
}
