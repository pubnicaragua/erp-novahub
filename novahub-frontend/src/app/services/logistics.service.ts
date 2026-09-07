import { api } from './api';

// ─────────────────────────── Tipos (Bloque 2) ───────────────────────────

export type LogisticsOwnerType = 'CUSTOMER' | 'AGENCY' | 'SUBAGENCY';
export type CustomFieldInputType = 'TEXT' | 'NUMBER' | 'SELECT' | 'DATE' | 'BOOLEAN' | 'TEXTAREA';
export type WarehouseStrategy = 'PROVIDER_ASSIGNED' | 'TRACKING_LAST_N' | 'INTERNAL_SEQUENCE' | 'MANUAL' | 'NONE';

export interface LogisticsSettings {
  id: string;
  tenantId: string;
  minimumBillableWeight: number;
  weightRoundingIncrement: number;
  defaultUnitOfMeasure: string;
  defaultCountry?: string;
  lastInternalSequence: number;
}

export interface LogisticsSubagency {
  id: string;
  tenantId: string;
  code?: string | null;
  name: string;
  isActive: boolean;
}

export interface LogisticsWarehouse {
  id: string;
  tenantId: string;
  country: string;
  name: string;
  provider?: string;
  unitOfMeasure: string;
  strategy: WarehouseStrategy;
  trackingLastN: number;
  isActive: boolean;
}

export const RECEIVED_PACKAGE_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Recibido',
  AVAILABLE: 'Disponible',
  BILLED: 'Facturado',
  DELIVERED: 'Entregado',
  ON_HOLD: 'En retención',
  RETURNED: 'Devuelto',
  LOST: 'Extraviado',
  CANCELLED: 'Cancelado',
};

export interface ShipmentMode {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface TrackingPrefix {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface CustomFieldDefinition {
  id: string;
  tenantId: string;
  context: string;
  label: string;
  key: string;
  inputType: CustomFieldInputType;
  required: boolean;
  options: string[];
  order: number;
  isActive: boolean;
}

export interface OwnerInfo {
  id?: string;
  name?: string;
}

// ─────────────────────── Paquetes recibidos ───────────────────────

export interface ReceivedPackage {
  id: string;
  tenantId: string;
  trackingCode: string;
  trackingSuffix?: string;
  prefixCode?: string;
  ticketNumber: string;
  shipmentModeCode: string;
  shipmentModeName: string;
  branchId?: string;
  branchName?: string;
  sku: string;
  skuName?: string;
  physicalWeight: number;
  supplierWeight?: number;
  billableWeight: number;
  weightUnit: string;
  purchasePrice?: number;
  salePrice?: number;
  warehouseStrategy: WarehouseStrategy;
  warehouseId?: string;
  warehouseName?: string;
  warehouseValue?: string;
  ownerType: LogisticsOwnerType;
  customerId?: string;
  customerName?: string;
  agencyId?: string;
  agencyName?: string;
  subagencyId?: string;
  subagencyName?: string;
  provider?: string;
  customFields?: Record<string, unknown>;
  status: string;
  purchaseStatus: string;
  saleStatus: string;
  receivedById?: string;
  receivedByName?: string;
  receivedAt: string;
  purchaseOrderId?: string;
  supplierInvoiceId?: string;
  costPrice?: number;
  saleInvoiceId?: string;
  saleInvoiceNumber?: string;
  saleInvoiceItemId?: string;
  saleRate?: number;
  saleAmount?: number;
  deliveredAt?: string;
  deliveredById?: string;
  deliveredByName?: string;
  deliveryNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceptionKpis {
  total: number;
  librasAereo: number;
  librasMaritimo: number;
  unidadesCustom: number;
  pendingPurchase: number;
  availableToInvoice: number;
}

export interface ReceivedPackageListResult {
  items: ReceivedPackage[];
  total: number;
  page: number;
  pageSize: number;
  kpis: ReceptionKpis;
}

export interface ReceptionCheck {
  trackingCode: string;
  alreadyReceived: boolean;
  receivedPackage: ReceivedPackage | null;
  inTransit: {
    trackingCode: string;
    status: string;
    shipmentType?: string;
    providerWeight?: number;
    weightUnit?: string;
    provider?: string;
    estimatedAt?: string;
    lastSyncAt?: string;
  } | null;
}

export interface CreateReceptionInput {
  trackingCode: string;
  prefixCode?: string;
  shipmentModeCode: string;
  branchId?: string;
  branchName?: string;
  sku: string;
  skuName?: string;
  physicalWeight: number;
  supplierWeight?: number;
  weightUnit?: string;
  warehouseStrategy: WarehouseStrategy;
  warehouseValue?: string;
  warehouseId?: string;
  warehouseName?: string;
  ownerType: LogisticsOwnerType;
  customer?: OwnerInfo;
  agency?: OwnerInfo;
  subagency?: OwnerInfo;
  provider?: string;
  customFields?: Record<string, unknown>;
}

// ─────────────────────── Importación masiva ───────────────────────

export interface ImportRowInput {
  sku?: string;
  weight: number;
  purchasePrice?: number;
  salePrice?: number;
  tracking: string;
  warehouse?: string;
  agencyCode?: string;
  subagencyCode?: string;
}

export interface ImportDefaults {
  sku?: string;
  branchId?: string;
  branchName?: string;
  shipmentModeCode?: string;
  shipmentModeName?: string;
  ownerType?: LogisticsOwnerType;
  customer?: OwnerInfo;
  agency?: OwnerInfo;
  subagency?: OwnerInfo;
  warehouseId?: string;
  warehouseValue?: string;
  weightUnit?: string;
  provider?: string;
}

export interface ImportRowResult {
  row: number;
  tracking: string;
  result: 'OK' | 'WARNING' | 'ERROR';
  observation: string;
}

export interface ImportResult {
  imported: number;
  skippedDuplicates: number;
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  rows: ImportRowResult[];
}

export const WAREHOUSE_STRATEGY_LABELS: Record<WarehouseStrategy, string> = {
  PROVIDER_ASSIGNED: 'Asignado por proveedor',
  TRACKING_LAST_N: 'Últimos N del tracking',
  INTERNAL_SEQUENCE: 'Secuencia interna',
  MANUAL: 'Manual',
  NONE: 'Sin warehouse',
};

export const OWNER_TYPE_LABELS: Record<LogisticsOwnerType, string> = {
  CUSTOMER: 'Cliente',
  AGENCY: 'Agencia',
  SUBAGENCY: 'Subagencia',
};

export const CUSTOM_FIELD_INPUT_LABELS: Record<CustomFieldInputType, string> = {
  TEXT: 'Texto',
  NUMBER: 'Número',
  SELECT: 'Selección',
  DATE: 'Fecha',
  BOOLEAN: 'Sí / No',
  TEXTAREA: 'Texto largo',
};

/**
 * Espejo de la regla del backend para previsualizar el peso facturable.
 * El cálculo autoritativo ocurre en el servidor al registrar.
 */
export function calculateBillableWeight(physicalWeight: number, settings: Pick<LogisticsSettings, 'minimumBillableWeight' | 'weightRoundingIncrement'>): number {
  const raw = Math.max(0, Number(physicalWeight) || 0);
  const min = Math.max(0, settings.minimumBillableWeight);
  const increment = Math.max(0.0001, settings.weightRoundingIncrement);
  if (raw < min) return Math.round((min + Number.EPSILON) * 100) / 100;
  const scaled = raw / increment;
  const roundedUp = Math.ceil(scaled - 1e-9);
  return Math.round((roundedUp * increment + Number.EPSILON) * 100) / 100;
}

export const logisticsService = {
  async getContext() {
    return api.get('/logistics/context') as Promise<{
      settings: LogisticsSettings;
      warehouses: LogisticsWarehouse[];
      shipmentModes: ShipmentMode[];
      trackingPrefixes: TrackingPrefix[];
      customFieldDefinitions: CustomFieldDefinition[];
  subagencies: LogisticsSubagency[];
    }>;
  },

  async getSettings() {
    return api.get('/logistics/settings') as Promise<LogisticsSettings>;
  },

  async updateSettings(data: Partial<LogisticsSettings>) {
    return api.put('/logistics/settings', data) as Promise<LogisticsSettings>;
  },

  // Bodegas
  async listSubagencies() {
    return api.get('/logistics/subagencies') as Promise<LogisticsSubagency[]>;
  },
  async createSubagency(data: Partial<LogisticsSubagency>) {
    return api.post('/logistics/subagencies', data) as Promise<LogisticsSubagency>;
  },
  async updateSubagency(id: string, data: Partial<LogisticsSubagency>) {
    return api.patch(`/logistics/subagencies/${id}`, data) as Promise<LogisticsSubagency>;
  },
  async deleteSubagency(id: string) {
    return api.delete(`/logistics/subagencies/${id}`) as Promise<{ deleted: boolean }>;
  },
  async listWarehouses() {
    return api.get('/logistics/warehouses') as Promise<LogisticsWarehouse[]>;
  },
  async createWarehouse(data: Partial<LogisticsWarehouse>) {
    return api.post('/logistics/warehouses', data) as Promise<LogisticsWarehouse>;
  },
  async updateWarehouse(id: string, data: Partial<LogisticsWarehouse>) {
    return api.patch(`/logistics/warehouses/${id}`, data) as Promise<LogisticsWarehouse>;
  },
  async deleteWarehouse(id: string) {
    return api.delete(`/logistics/warehouses/${id}`) as Promise<{ deleted: boolean }>;
  },

  // Tipos de envío
  async listShipmentModes() {
    return api.get('/logistics/shipment-modes') as Promise<ShipmentMode[]>;
  },
  async createShipmentMode(data: Partial<ShipmentMode>) {
    return api.post('/logistics/shipment-modes', data) as Promise<ShipmentMode>;
  },
  async updateShipmentMode(id: string, data: Partial<ShipmentMode>) {
    return api.patch(`/logistics/shipment-modes/${id}`, data) as Promise<ShipmentMode>;
  },
  async deleteShipmentMode(id: string) {
    return api.delete(`/logistics/shipment-modes/${id}`) as Promise<{ deleted: boolean }>;
  },

  // Prefijos
  async listTrackingPrefixes() {
    return api.get('/logistics/tracking-prefixes') as Promise<TrackingPrefix[]>;
  },
  async createTrackingPrefix(data: Partial<TrackingPrefix>) {
    return api.post('/logistics/tracking-prefixes', data) as Promise<TrackingPrefix>;
  },
  async updateTrackingPrefix(id: string, data: Partial<TrackingPrefix>) {
    return api.patch(`/logistics/tracking-prefixes/${id}`, data) as Promise<TrackingPrefix>;
  },
  async deleteTrackingPrefix(id: string) {
    return api.delete(`/logistics/tracking-prefixes/${id}`) as Promise<{ deleted: boolean }>;
  },

  // Campos personalizados
  async listCustomFieldDefinitions(context?: string) {
    return api.get('/logistics/custom-field-definitions', { params: context ? { context } : {} }) as Promise<CustomFieldDefinition[]>;
  },
  async createCustomFieldDefinition(data: Partial<CustomFieldDefinition>) {
    return api.post('/logistics/custom-field-definitions', data) as Promise<CustomFieldDefinition>;
  },
  async updateCustomFieldDefinition(id: string, data: Partial<CustomFieldDefinition>) {
    return api.patch(`/logistics/custom-field-definitions/${id}`, data) as Promise<CustomFieldDefinition>;
  },
  async deleteCustomFieldDefinition(id: string) {
    return api.delete(`/logistics/custom-field-definitions/${id}`) as Promise<{ deleted: boolean }>;
  },

  // Recepción individual
  async receptionCheck(trackingCode: string) {
    return api.get('/logistics/reception/check', { params: { trackingCode } }) as Promise<ReceptionCheck>;
  },
  async createReception(data: CreateReceptionInput) {
    return api.post('/logistics/reception', data) as Promise<ReceivedPackage>;
  },
  async getReceptionByTracking(trackingCode: string) {
    return api.get(`/logistics/reception/code/${encodeURIComponent(trackingCode)}`) as Promise<ReceivedPackage>;
  },

  // Listado / gestión (Bloque 3)
  async listReceivedPackages(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    userId?: string;
    shipmentModeCode?: string;
    status?: string;
    branchId?: string;
    warehouseId?: string;
    agencyName?: string;
    subagencyName?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    return api.get('/logistics/reception', { params }) as Promise<ReceivedPackageListResult>;
  },

  async previewImport(data: { rows: ImportRowInput[]; defaults?: ImportDefaults }) {
    return api.post('/logistics/reception/import/preview', data) as Promise<ImportResult>;
  },

  async importPackages(data: { rows: ImportRowInput[]; defaults?: ImportDefaults }) {
    return api.post('/logistics/reception/import', data) as Promise<ImportResult>;
  },

  async quickReception(data: { rows: ImportRowInput[]; defaults?: ImportDefaults }) {
    return api.post('/logistics/reception/quick', data) as Promise<ImportResult>;
  },

  // ─────────────────────── Conciliación (Bloque 4) ───────────────────────

  async reconciliationAvailable(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    warehouseId?: string;
    shipmentModeCode?: string;
    receptionBatchId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    return api.get('/logistics/reconciliation/available', { params }) as Promise<PaginatedSimple<ReceivedPackage>>;
  },

  async reconciliationPreview(data: ReconciliationConfirmInput) {
    return api.post('/logistics/reconciliation/preview', data) as Promise<ReconciliationPreviewResult>;
  },

  async reconciliationConfirm(data: ReconciliationConfirmInput) {
    return api.post('/logistics/reconciliation/confirm', data) as Promise<ReconciliationConfirmResult>;
  },

  async reconciliationByInvoice(invoiceId: string) {
    return api.get(`/logistics/reconciliation/invoice/${invoiceId}`) as Promise<{ invoice: SupplierInvoiceSummary; packages: ReceivedPackage[] }>;
  },

  async reconciliationByOrder(orderId: string) {
    return api.get(`/logistics/reconciliation/order/${orderId}`) as Promise<{ order: { id: string; number: string; status: string }; packages: ReceivedPackage[] }>;
  },

  // ─────────────────────── Referencias de recepción (lote) ───────────────────────

  async listBatches(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    warehouseId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    return api.get('/logistics/batches', { params }) as Promise<PaginatedSimple<ReceptionBatch>>;
  },

  async createBatch(data: { provider?: string; supplierId?: string; warehouseId?: string; date?: string; notes?: string }) {
    return api.post('/logistics/batches', data) as Promise<ReceptionBatch>;
  },

  async getBatch(id: string) {
    return api.get(`/logistics/batches/${id}`) as Promise<BatchDetail>;
  },

  async updateBatch(id: string, data: { provider?: string; supplierId?: string; warehouseId?: string; notes?: string }) {
    return api.patch(`/logistics/batches/${id}`, data) as Promise<ReceptionBatch>;
  },

  async deleteBatch(id: string) {
    return api.delete(`/logistics/batches/${id}`) as Promise<{ deleted: boolean; id: string }>;
  },

  async addBatchPackages(id: string, rows: BatchPackageRow[]) {
    return api.post(`/logistics/batches/${id}/packages`, { rows }) as Promise<BatchPackagesResult>;
  },

  async confirmBatch(id: string, data: { invoiceNumber?: string; date?: string; dueDate?: string; notes?: string }) {
    return api.post(`/logistics/batches/${id}/confirm`, data) as Promise<ConfirmBatchResult>;
  },

  async pdfPreview(fileName: string, dataBase64: string) {
    return api.post('/logistics/reception/pdf-preview', { fileName, dataBase64 }) as Promise<PdfPreviewResult>;
  },

  // ─────────────────────── Disponibles para facturar (Bloque 5) ───────────────────────

  async billingAvailable(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    warehouseId?: string;
    shipmentModeCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    return api.get('/logistics/billing/available', { params }) as Promise<BillingAvailableResult>;
  },

  async billingAlerts() {
    return api.get('/logistics/billing/alerts') as Promise<BillingAlertsResult>;
  },

  async billingPreview(data: BillingConfirmInput) {
    return api.post('/logistics/billing/preview', data) as Promise<BillingPreviewResult>;
  },

  async billingConfirm(data: BillingConfirmInput) {
    return api.post('/logistics/billing/confirm', data) as Promise<BillingConfirmResult>;
  },

  async deliverPackages(data: DeliverPackagesInput) {
    return api.post('/logistics/billing/deliver', data) as Promise<{ delivered: number }>;
  },

  async billingByInvoice(invoiceId: string) {
    return api.get(`/logistics/billing/invoice/${invoiceId}`) as Promise<{ invoiceId: string; packages: ReceivedPackage[] }>;
  },

  async billingByCustomer(customerName: string) {
    return api.get('/logistics/billing/customer', { params: { customerName } }) as Promise<{
      available: ReceivedPackage[];
      billed: ReceivedPackage[];
      delivered: ReceivedPackage[];
    }>;
  },

  // ─────────────────────── Bloque 6: reversión y nota de crédito ───────────────────────

  async billingReversalPreview(invoiceId: string) {
    return api.get(`/logistics/billing/invoice/${invoiceId}/reversal-preview`) as Promise<BillingReversalPreview>;
  },

  async billingCancel(data: BillingCancelInput) {
    return api.post('/logistics/billing/cancel', data) as Promise<BillingCancelResult>;
  },

  async billingReversalsByInvoice(invoiceId: string) {
    return api.get(`/logistics/billing/invoice/${invoiceId}/reversals`) as Promise<BillingReversalsResult>;
  },

  async billingReplacement(invoiceId: string) {
    return api.get(`/logistics/billing/invoice/${invoiceId}/replacement`) as Promise<BillingReplacementResult>;
  },

  async billingCreditNote(data: BillingCreditNoteInput) {
    return api.post('/logistics/billing/credit-note', data) as Promise<BillingCreditNoteResult>;
  },
};

export interface BillingReversalPreview {
  invoice: {
    id: string;
    number: string;
    status: string;
    total: number;
    amountPaid: number;
    balance: number;
    date?: string;
  };
  packages: Array<{
    id: string;
    trackingCode: string;
    customerName?: string;
    sku: string;
    warehouseValue?: string;
    billableWeight: number;
    saleRate?: number;
    saleAmount?: number;
    saleStatus: string;
  }>;
  packageCount: number;
  deliveredPackages: number;
  reversable: boolean;
  requiresAuthorizedFlow: boolean;
}

export interface BillingCancelInput {
  invoiceId: string;
  reason: string;
}

export interface BillingCancelResult {
  reversal: {
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    reversedAt: string;
    reversedBy?: string;
    reason: string;
    journalReversed: boolean;
    reversedJournalCount: number;
  };
  restoredPackages: number;
  packages: string[];
}

export interface BillingReversalsResult {
  reversals: Array<{
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    replacementInvoiceId?: string;
    replacementInvoiceNumber?: string;
    reason: string;
    reversedBy?: string;
    reversedAt: string;
    balanceBefore: number;
    balanceAfter: number;
    amountPaidBefore: number;
    amountPaidAfter: number;
    journalReversed: boolean;
    reversedJournalCount: number;
    packageTrackingCodes: string[];
  }>;
  history: Array<{
    id: string;
    packageId: string;
    trackingCode: string;
    fromStatus: string;
    toStatus: string;
    action: string;
    invoiceId?: string;
    invoiceNumber?: string;
    reversalId?: string;
    actorName?: string;
    note?: string;
    occurredAt: string;
  }>;
}

export interface BillingReplacementResult {
  originalInvoice: { id: string; number: string; total: number };
  customer: { id: string; name: string } | null;
  date?: string;
  dueDate?: string;
  packages: Array<{
    id: string;
    trackingCode: string;
    sku: string;
    customerName?: string;
    warehouseValue?: string;
    billableWeight: number;
    rate: number;
    amount: number;
  }>;
}

export interface BillingCreditNoteInput {
  invoiceId: string;
  reason?: string;
  date?: string;
}

export interface BillingCreditNoteResult {
  creditNote: { id: string; number: string; total: number; status: string };
  invoiceId: string;
  invoiceNumber: string;
  packages: string[];
}

export interface PaginatedSimple<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─────────────────────── Referencias de recepción (lote) ───────────────────────

export interface ReceptionBatch {
  id: string;
  tenantId: string;
  number: string;
  provider?: string | null;
  supplierId?: string | null;
  warehouseId?: string | null;
  warehouseName?: string | null;
  warehouseStrategy: WarehouseStrategy;
  warehouseLastN: number;
  date: string;
  notes?: string | null;
  status: 'OPEN' | 'CONFIRMED' | string;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  totalAmount: number;
  packageCount: number;
  createdById?: string | null;
  createdByName?: string | null;
  confirmedById?: string | null;
  confirmedByName?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchPackageRow {
  line?: number;
  trackingCode?: string;
  item?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
  physicalWeight?: number;
  weightUnit?: string;
  warehouseValue?: string;
  subagency?: OwnerInfo;
  customer?: OwnerInfo;
}

export interface PdfPreviewRow extends BatchPackageRow {
  id: string; // clave local para la grilla editable
}

export interface PdfPreviewResult {
  format: 'AWBOX' | 'OGLOBAL' | null;
  rows: BatchPackageRow[];
  warnings: string[];
  fileName: string;
}

export interface BatchPackagesResult {
  inserted: number;
  rows: Array<{ row: number; tracking: string; result: 'OK' | 'WARNING' | 'SKIPPED'; observation: string }>;
  batch: string;
}

export interface ConfirmBatchResult {
  batch: { id: string; number: string; status: string };
  invoice: SupplierInvoiceSummary | null;
  linkedPackages: number;
  invoiceSkipped: boolean;
}

export interface BatchDetail {
  batch: ReceptionBatch;
  packages: ReceivedPackage[];
  invoice: SupplierInvoiceSummary | null;
}

export interface SupplierInvoiceSummary {
  id: string;
  number: string;
  total: number;
  status: string;
  date?: string;
  dueDate?: string;
  supplier?: { id: string; name: string };
}

export interface ReconciliationConfirmInput {
  supplierId?: string;
  purchaseOrderId?: string;
  receptionBatchId?: string;
  number?: string;
  date: string;
  dueDate?: string;
  packageIds: string[];
  costPrices?: Record<string, number>;
  notes?: string;
}

export interface ReconciliationPreviewResult {
  supplierId?: string;
  purchaseOrderId?: string;
  receptionBatchId?: string;
  referenceNumber?: string;
  provider?: string;
  invoiceNumber: string;
  packageCount: number;
  weights: { supplierWeight: number; physicalWeight: number; billableWeight: number };
  totalAmount: number;
  packages: Array<{
    id: string;
    trackingCode: string;
    sku: string;
    warehouseValue?: string;
    supplierWeight?: number;
    physicalWeight: number;
    billableWeight: number;
    costPrice: number;
  }>;
}

export interface ReconciliationConfirmResult {
  invoice: SupplierInvoiceSummary | null;
  linkedPackages: number;
}

export interface BillingAvailableResult extends PaginatedSimple<ReceivedPackage> {
  summary: { packages: number; billableWeight: number };
}

export interface BillingAlertsResult {
  notifyUnbilledAfterDays: number;
  alerts: Array<{
    trackingCode: string;
    customerName?: string;
    daysPending: number;
    warehouseValue?: string;
    availableSince: string;
    billableWeight: number;
  }>;
}

export interface BillingConfirmInput {
  customerId?: string;
  customerName?: string;
  date: string;
  dueDate?: string;
  paymentMethod?: 'CREDIT' | 'CASH';
  packageIds: string[];
  rates?: Record<string, number>;
  replacesInvoiceId?: string;
}

export interface BillingPreviewResult {
  customer: { id: string; name: string };
  packageCount: number;
  billableWeight: number;
  totalAmount: number;
  lines: Array<{
    packageId: string;
    trackingCode: string;
    customerName?: string;
    warehouseValue?: string;
    warehouseName?: string;
    shipmentModeName?: string;
    physicalWeight: number;
    billableWeight: number;
    rate: number;
    amount: number;
  }>;
}

export interface BillingConfirmResult {
  invoice: { id: string; number: string; total: number };
  billedPackages: number;
}

export interface DeliverPackagesInput {
  packageIds: string[];
  note?: string;
}