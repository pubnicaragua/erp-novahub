import { api } from './api';

export type IntlImportPackageStatus =
  | 'RECEIVED_AT_WAREHOUSE'
  | 'CONSOLIDATED'
  | 'IN_TRANSIT'
  | 'CUSTOMS_CLEARANCE'
  | 'AVAILABLE'
  | 'DELIVERED'
  | 'CANCELLED';

export type IntlImportContainerStatus =
  | 'OPEN'
  | 'CONSOLIDATED'
  | 'IN_TRANSIT'
  | 'CUSTOMS_CLEARANCE'
  | 'COMPLETED'
  | 'CANCELLED';

export const INTL_PACKAGE_STATUS_LABELS: Record<IntlImportPackageStatus, string> = {
  RECEIVED_AT_WAREHOUSE: 'Recibido en Bodega Origen',
  CONSOLIDATED: 'Consolidado en Contenedor',
  IN_TRANSIT: 'En Tránsito',
  CUSTOMS_CLEARANCE: 'En Proceso Aduanal',
  AVAILABLE: 'Disponible para Retiro',
  DELIVERED: 'Entregado al Cliente',
  CANCELLED: 'Cancelado',
};

export const INTL_CONTAINER_STATUS_LABELS: Record<IntlImportContainerStatus, string> = {
  OPEN: 'Abierto / En Consolidación',
  CONSOLIDATED: 'Consolidado / Sellado',
  IN_TRANSIT: 'En Tránsito',
  CUSTOMS_CLEARANCE: 'Aduana y Prorrateo',
  COMPLETED: 'Liquidado / Completado',
  CANCELLED: 'Cancelado',
};

export const canEditPackage = (pkg?: IntlImportPackage | null): boolean => {
  if (!pkg) return false;
  if (pkg.status === 'DELIVERED') return false;
  if (pkg.container?.isClosed || pkg.container?.status === 'COMPLETED') return false;
  return true;
};

/** Base sobre la que el backend resuelve el factor volumetrico. */
export type IntlChargeableBasis = 'PHYSICAL' | 'WEIGHT_BASED';

export type IntlClosureRule = 'ANY' | 'BOTH';

export type IntlClosureType = 'STANDARD' | 'EXCEPTION' | 'REOPEN';

/**
 * Campos que SOLO calcula el backend. La UI nunca debe recalcularlos: si lo
 * hace, la cifra mostrada puede diferir de la persistida y del prorrateo.
 */
export interface IntlChargeableFields {
  billableCbm?: number;
  chargeableEquivalentCbm?: number;
  volumetricFactorKgPerCbm?: number;
  chargeableBasis?: IntlChargeableBasis;
  volumetricRuleId?: string | null;
  factorOverrideReason?: string | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  originCountry?: string | null;
  transportMode?: string | null;
  carrier?: string | null;
}

/** Regla que el backend efectivamente aplico al calcular el preview. */
export interface AppliedVolumetricRule {
  id: string | null;
  label: string;
  source: 'rule' | 'tenantSetting';
}

/**
 * Snapshot de la regla persistida. El backend lo devuelve como `null` cuando
 * ninguna regla encaja y cae al parametro del tenant, y con la forma
 * `{ manual: true, ... }` cuando el factor viene forzado por el cliente.
 */
export type VolumetricRuleSnapshot =
  | {
      id: string;
      label: string;
      originCountry?: string | null;
      transportMode?: string | null;
      carrier?: string | null;
      factorKgPerCbm: number;
      priority?: number;
    }
  | { manual: true; baseRuleId?: string | null; baseFactorKgPerCbm?: number }
  | null;

/**
 * Respuesta de `POST /intl-imports/chargeable/preview`. Refleja exactamente lo
 * que devuelve `buildChargeable()` en el backend: no existe un objeto `rule`.
 */
export interface ChargeablePreviewResult extends IntlChargeableFields {
  actualWeightKg: number;
  volumeCbm: number;
  chargeableWeight: number;
  chargeableEquivalentCbm: number;
  billableCbm: number;
  volumetricFactorKgPerCbm: number;
  chargeableBasis: IntlChargeableBasis;
  volumetricRuleId: string | null;
  volumetricRuleSnapshot: VolumetricRuleSnapshot;
  physicalCbmDerivedFromDimensions: number;
  appliedRule: AppliedVolumetricRule;
}

export interface IntlVolumetricFactor {
  id: string;
  label: string;
  originCountry?: string | null;
  transportMode?: string | null;
  carrier?: string | null;
  factorKgPerCbm: number;
  priority: number;
  isActive: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContainerBalanceCheck {
  code: string;
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * Contrato de `GET /intl-imports/containers/:id/balance`.
 *
 * Refleja la forma anidada real del backend (`totals` / `limits` / `usage` /
 * `checks`). `canClose`, `violations` y `warnings` los calcula el servidor con
 * la MISMA funcion que valida el cierre: el frontend no re-deriva las reglas
 * ANY/BOTH, solo las muestra.
 */
export interface ContainerBalance {
  containerId: string;
  containerNumber: string;
  status: string;
  isClosed: boolean;
  closedAt: string | null;
  closedById: string | null;
  closeReason: string | null;
  closedByException: boolean;
  reopenCount: number;
  version: number;
  packagesCount: number;
  canClose: boolean;
  violations: string[];
  warnings: string[];
  totals: {
    physicalCbm: number;
    billableCbm: number;
    actualWeightKg: number;
    chargeableWeight: number;
    expenses: number;
  };
  limits: {
    capacityCbm: number | null;
    maxWeightKg: number | null;
    minCloseCbm: number | null;
    minCloseWeightKg: number | null;
    closureRule: IntlClosureRule;
  };
  usage: {
    capacityPct: number | null;
    maxWeightPct: number | null;
    minCbmPct: number | null;
    minWeightPct: number | null;
  };
  checks: ContainerBalanceCheck[];
}

export interface ContainerClosure {
  id: string;
  type: IntlClosureType;
  reason: string;
  snapshotCbm: number;
  snapshotWeightKg: number;
  packagesCount: number;
  actorId?: string | null;
  occurredAt: string;
}

export interface PackageMovement {
  id: string;
  packageId: string;
  fromContainerId?: string | null;
  fromContainerNumber?: string | null;
  toContainerId?: string | null;
  toContainerNumber?: string | null;
  reason?: string | null;
  actorId?: string | null;
  billableCbmBefore?: number | null;
  billableCbmAfter?: number | null;
  occurredAt: string;
}

/**
 * Contrato de `POST /intl-imports/move-packages/simulate`.
 * Los motivos llegan como texto ya redactado por el servidor, no como codigos:
 * la UI los muestra tal cual para no duplicar las reglas de validacion.
 */
export interface MoveSimulationResult {
  allowed: boolean;
  simulationOnly: true;
  violations: string[];
  target: {
    id: string;
    containerNumber: string;
    isClosed: boolean;
    currentBillableCbm: number;
    currentWeightKg: number;
    projectedBillableCbm: number;
    projectedWeightKg: number;
    capacityCbm: number | null;
    maxWeightKg: number | null;
    packagesMovingIn: number;
    packagesMovingOut: number;
  };
  packages: Array<{
    id: string;
    trackingCode: string;
    status: string;
    fromContainerId: string | null;
    volumeCbm: number;
    actualWeightKg: number;
    billableCbm: number;
  }>;
}

export interface IntlImportPackageEvent {
  id: string;
  packageId: string;
  status: IntlImportPackageStatus;
  label: string;
  description?: string;
  location?: string;
  occurredAt: string;
}

export interface IntlImportPackage extends IntlChargeableFields {
  id: string;
  trackingCode: string;
  originalTrackingNumber?: string;
  customerId: string;
  customerName?: string;
  customer?: { id: string; name: string; code?: string };
  supplierId?: string;
  supplierName?: string;
  supplier?: { id: string; name: string };
  senderName?: string;
  description?: string;
  actualWeightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  volumeCbm: number;
  chargeableWeightKg: number;
  chargeableWeight?: number;
  declaredValueUsd?: number;
  proratedCost?: number;
  status: IntlImportPackageStatus;
  containerId?: string;
  containerNumber?: string;
  container?: { id: string; containerNumber: string; status: IntlImportContainerStatus; isClosed?: boolean };
  events?: IntlImportPackageEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface IntlImportExpense {
  id: string;
  containerId: string;
  expenseType: string;
  description?: string;
  amount: number;
  currency: string;
  createdAt: string;
}

export interface IntlImportContainer {
  id: string;
  containerNumber: string;
  sealNumber?: string;
  capacityCbm?: number;
  maxCapacityCbm: number;
  maxWeightKg: number;
  minCloseCbm?: number | null;
  minCloseWeightKg?: number | null;
  closureRule?: IntlClosureRule | null;
  isClosed: boolean;
  closedAt?: string | null;
  closeReason?: string | null;
  closedByException?: boolean | null;
  reopenedAt?: string | null;
  reopenCount?: number;
  version?: number;
  status: IntlImportContainerStatus;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualArrival?: string;
  packagesCount?: number;
  totalVolumeCbm?: number;
  /** CBM facturable: es la base de capacidad, minimos y prorrateo. */
  totalBillableCbm?: number;
  totalActualWeightKg?: number;
  totalExpensesUsd?: number;
  capacityUsagePct?: number | null;
  expenses?: IntlImportExpense[];
  packages?: IntlImportPackage[];
  createdAt: string;
  updatedAt: string;
}

export interface IntlImportConfig {
  volumetricFactorKgPerCbm: number;
  defaultContainerCbm: number;
  defaultContainerMaxKg: number;
  minCloseCbm?: number;
  minCloseWeightKg?: number;
  closureRule?: IntlClosureRule;
  trackingPrefix: string;
}

export interface PackageQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: IntlImportPackageStatus;
  containerId?: string;
  customerId?: string;
  unassignedOnly?: boolean;
}

export interface ProrationPackageItem {
  packageId: string;
  trackingCode: string;
  description?: string;
  volumeCbm: number;
  /** CBM facturable del paquete: la magnitud que reparte los gastos. */
  billableCbm: number;
  percentage: number;
  proratedCost: number;
  volumeRatioPercentage?: string;
}

export interface ProrationPreviewResult {
  containerId: string;
  containerNumber: string;
  totalVolumeCbm: number;
  /** Total facturable del contenedor; base del prorrateo. */
  totalBillableCbm: number;
  totalExpensesUsd: number;
  totalExpenses?: number;
  costPerCbm: number;
  packages: ProrationPackageItem[];
  proratedPackages?: ProrationPackageItem[];
}

type RawContainer = Partial<IntlImportContainer> & {
  capacityCbm?: number;
  totalExpenses?: number;
  packageCount?: number;
  packages?: IntlImportPackage[];
  expenses?: IntlImportExpense[];
};

type RawProrationItem = Partial<ProrationPackageItem> & {
  id?: string;
  volumeRatioPercentage?: string;
};

type RawProrationPreview = Partial<ProrationPreviewResult> & {
  proratedPackages?: RawProrationItem[];
};

function normalizeContainer(raw: RawContainer): IntlImportContainer {
  if (!raw) return raw as unknown as IntlImportContainer;
  const packages = Array.isArray(raw.packages) ? raw.packages : [];
  const expenses = Array.isArray(raw.expenses) ? raw.expenses : [];
  const totalVolumeCbm = raw.totalVolumeCbm ?? Number((packages.reduce((sum, p) => sum + (Number(p.volumeCbm) || 0), 0)).toFixed(4));
  const totalActualWeightKg = raw.totalActualWeightKg ?? Number((packages.reduce((sum, p) => sum + (Number(p.actualWeightKg) || 0), 0)).toFixed(2));
  const totalExpensesUsd = raw.totalExpensesUsd ?? raw.totalExpenses ?? Number((expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)).toFixed(2));
  const maxCapacityCbm = raw.capacityCbm ?? raw.maxCapacityCbm ?? 20;
  const maxWeightKg = raw.maxWeightKg ?? 5000;
  const packagesCount = raw.packagesCount ?? raw.packageCount ?? packages.length;

  return {
    ...(raw as IntlImportContainer),
    capacityCbm: maxCapacityCbm,
    maxCapacityCbm,
    maxWeightKg,
    totalVolumeCbm,
    totalActualWeightKg,
    totalExpensesUsd,
    packagesCount,
    packages,
    expenses,
  };
}

function normalizeProrationPreview(raw: RawProrationPreview): ProrationPreviewResult {
  if (!raw) {
    return {
      containerId: '',
      containerNumber: '',
      totalVolumeCbm: 0,
      totalBillableCbm: 0,
      totalExpensesUsd: 0,
      costPerCbm: 0,
      packages: [],
    };
  }
  const rawList = Array.isArray(raw.packages) ? raw.packages : Array.isArray(raw.proratedPackages) ? raw.proratedPackages : [];
  const totalExpensesUsd = raw.totalExpensesUsd ?? raw.totalExpenses ?? 0;
  const totalVolumeCbm = raw.totalVolumeCbm ?? 0;
  // El prorrateo se reparte por CBM FACTURABLE, no por volumen fisico. Si se
  // pierde este campo, la tabla muestra el fisico junto a un porcentaje que en
  // realidad viene del facturable (p. ej. 0.004 CBM fisicos con 0.41% porque su
  // facturable es 0.08).
  const totalBillableCbm = raw.totalBillableCbm ?? totalVolumeCbm;
  const costPerCbm = raw.costPerCbm ?? (totalBillableCbm > 0 ? Number((totalExpensesUsd / totalBillableCbm).toFixed(2)) : 0);

  const packages: ProrationPackageItem[] = rawList.map((p: RawProrationItem) => {
    let percentage = p.percentage;
    if (percentage === undefined && p.volumeRatioPercentage) {
      percentage = parseFloat(p.volumeRatioPercentage) || 0;
    }
    const volumeCbm = Number(p.volumeCbm) || 0;
    return {
      packageId: p.packageId || p.id || '',
      trackingCode: p.trackingCode || '',
      description: p.description,
      volumeCbm,
      billableCbm: p.billableCbm != null ? Number(p.billableCbm) : volumeCbm,
      percentage: Number(percentage) || 0,
      proratedCost: Number(p.proratedCost) || 0,
    };
  });

  return {
    containerId: raw.containerId || '',
    containerNumber: raw.containerNumber || '',
    totalVolumeCbm,
    totalBillableCbm,
    totalExpensesUsd,
    costPerCbm,
    packages,
  };
}

type RawPackage = IntlImportPackage & { invoiceNumber?: string };

function normalizePackage(raw: RawPackage): IntlImportPackage {
  if (!raw) return raw;
  return {
    ...raw,
    originalTrackingNumber: raw.originalTrackingNumber || raw.invoiceNumber || undefined,
    customerName: raw.customer?.name || raw.customerName,
    supplierName: raw.supplier?.name || raw.supplierName,
    containerNumber: raw.container?.containerNumber || raw.containerNumber,
  };
}

export const intlImportsService = {
  // --- Packages ---
  async listPackages(params?: PackageQueryParams): Promise<{ data: IntlImportPackage[]; total: number; page: number; totalPages: number }> {
    try {
      const res = await api.get<unknown>('/intl-imports/packages', { params: params as Record<string, string | number | boolean | undefined> });
      if (Array.isArray(res)) {
        return { data: (res as RawPackage[]).map(normalizePackage), total: res.length, page: 1, totalPages: 1 };
      }
      const raw = res as {
        items?: IntlImportPackage[];
        data?: IntlImportPackage[];
        pagination?: { total?: number; page?: number; totalPages?: number; limit?: number };
        total?: number;
        page?: number;
        totalPages?: number;
      };
      const list = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.data) ? raw.data : [];
      const total = raw?.pagination?.total ?? raw?.total ?? list.length;
      const page = raw?.pagination?.page ?? raw?.page ?? 1;
      const totalPages = raw?.pagination?.totalPages ?? raw?.totalPages ?? Math.max(1, Math.ceil(total / (params?.limit || 15)));
      return { data: list.map(normalizePackage), total, page, totalPages };
    } catch {
      return { data: [], total: 0, page: 1, totalPages: 1 };
    }
  },

  async getPackage(id: string): Promise<IntlImportPackage> {
    const raw = await api.get<IntlImportPackage>(`/intl-imports/packages/${id}`);
    return normalizePackage(raw);
  },

  async getPackageByTracking(code: string): Promise<IntlImportPackage> {
    const raw = await api.get<IntlImportPackage>(`/intl-imports/packages/code/${encodeURIComponent(code)}`);
    return normalizePackage(raw);
  },

  async createPackage(payload: Partial<IntlImportPackage>): Promise<IntlImportPackage> {
    // Solo se envian entradas crudas. Los campos derivados (chargeableWeight,
    // billableCbm, volumetricFactorKgPerCbm, chargeableBasis) los calcula y
    // persiste el backend; mandarlos aqui permitiria Acceptar un valor ajeno
    // al factor vigente del tenant.
    const body: Record<string, unknown> = {
      actualWeightKg: Number(payload.actualWeightKg),
      trackingCode: payload.trackingCode?.trim() || undefined,
      invoiceNumber: payload.originalTrackingNumber?.trim() || undefined,
      description: payload.description || undefined,
      declaredValueUsd: payload.declaredValueUsd ? Number(payload.declaredValueUsd) : undefined,
      currency: 'USD',
    };
    if (payload.volumeCbm !== undefined && payload.volumeCbm !== null) {
      body.volumeCbm = Number(payload.volumeCbm);
    }
    if (payload.lengthCm) body.lengthCm = Number(payload.lengthCm);
    if (payload.widthCm) body.widthCm = Number(payload.widthCm);
    if (payload.heightCm) body.heightCm = Number(payload.heightCm);
    if (payload.originCountry?.trim()) body.originCountry = payload.originCountry.trim();
    if (payload.transportMode?.trim()) body.transportMode = payload.transportMode.trim();
    if (payload.carrier?.trim()) body.carrier = payload.carrier.trim();
    // Regla asignada explicitamente. Viaja el ID, nunca el factor: el backend
    // lo lee de la regla almacenada y congela su snapshot en el paquete.
    if (payload.volumetricRuleId?.trim()) body.volumetricRuleId = payload.volumetricRuleId.trim();
    // El factor manual solo viaja si hay motivo: el backend lo rechaza sin el.
    if (payload.volumetricFactorKgPerCbm && payload.factorOverrideReason?.trim()) {
      body.volumetricFactorKgPerCbm = Number(payload.volumetricFactorKgPerCbm);
      body.factorOverrideReason = payload.factorOverrideReason.trim();
    }
    if (payload.customerId && payload.customerId.trim()) {
      body.customerId = payload.customerId.trim();
    }
    if (payload.supplierId && payload.supplierId.trim()) {
      body.supplierId = payload.supplierId.trim();
    }
    if (payload.containerId && payload.containerId.trim()) {
      body.containerId = payload.containerId.trim();
    }
    const created = await api.post<IntlImportPackage>('/intl-imports/packages', body);
    return normalizePackage(created);
  },

  async updatePackage(id: string, payload: Partial<IntlImportPackage>): Promise<IntlImportPackage> {
    // Se reenvian solo campos editables; los derivados se omiten a proposito.
    const {
      actualWeightKg, volumeCbm, lengthCm, widthCm, heightCm,
      originCountry, transportMode, carrier,
      volumetricFactorKgPerCbm, factorOverrideReason,
      ...rest
    } = payload;
    const body: Record<string, unknown> = { ...rest };
    if (actualWeightKg !== undefined) body.actualWeightKg = Number(actualWeightKg);
    if (volumeCbm !== undefined) body.volumeCbm = Number(volumeCbm);
    if (lengthCm !== undefined) body.lengthCm = Number(lengthCm);
    if (widthCm !== undefined) body.widthCm = Number(widthCm);
    if (heightCm !== undefined) body.heightCm = Number(heightCm);
    if (originCountry !== undefined) body.originCountry = originCountry;
    if (transportMode !== undefined) body.transportMode = transportMode;
    if (carrier !== undefined) body.carrier = carrier;
    if (volumetricFactorKgPerCbm !== undefined) {
      body.volumetricFactorKgPerCbm = Number(volumetricFactorKgPerCbm);
      body.factorOverrideReason = factorOverrideReason?.trim() || undefined;
    }
    const updated = await api.patch<IntlImportPackage>(`/intl-imports/packages/${id}`, body);
    return normalizePackage(updated);
  },

  async deletePackage(id: string): Promise<{ success: boolean; id: string }> {
    return api.delete<{ success: boolean; id: string }>(`/intl-imports/packages/${id}`);
  },

  async addPackageEvent(id: string, event: { status: IntlImportPackageStatus; label: string; location?: string; description?: string }): Promise<IntlImportPackageEvent> {
    return api.post<IntlImportPackageEvent>(`/intl-imports/packages/${id}/events`, event);
  },

  // --- Containers ---
  async listContainers(params?: { status?: IntlImportContainerStatus; search?: string }): Promise<IntlImportContainer[]> {
    try {
      const res = await api.get<unknown>('/intl-imports/containers', { params: params as Record<string, string | number | boolean | undefined> });
      let list: RawContainer[] = [];
      if (Array.isArray(res)) list = res as RawContainer[];
      else {
        const raw = res as { items?: RawContainer[]; data?: RawContainer[] };
        if (Array.isArray(raw?.items)) list = raw.items;
        else if (Array.isArray(raw?.data)) list = raw.data;
      }
      return list.map(normalizeContainer);
    } catch {
      return [];
    }
  },

  async getContainer(id: string): Promise<IntlImportContainer> {
    const raw = await api.get<RawContainer>(`/intl-imports/containers/${id}`);
    return normalizeContainer(raw);
  },

  async createContainer(payload: Partial<IntlImportContainer> & { origin?: string; destination?: string; notes?: string; capacityCbm?: number }): Promise<IntlImportContainer> {
    const body: Record<string, unknown> = {
      containerNumber: payload.containerNumber?.trim().toUpperCase(),
      origin: payload.origin?.trim() || undefined,
      destination: payload.destination?.trim() || undefined,
      capacityCbm: payload.capacityCbm || payload.maxCapacityCbm || undefined,
      maxWeightKg: payload.maxWeightKg || undefined,
      notes: payload.notes || (payload.sealNumber ? `Sello: ${payload.sealNumber}` : undefined),
    };
    if (payload.estimatedDeparture && payload.estimatedDeparture.trim()) {
      body.estimatedDeparture = new Date(payload.estimatedDeparture).toISOString();
    }
    if (payload.estimatedArrival && payload.estimatedArrival.trim()) {
      body.estimatedArrival = new Date(payload.estimatedArrival).toISOString();
    }
    const created = await api.post<RawContainer>('/intl-imports/containers', body);
    return normalizeContainer(created);
  },

  async updateContainer(id: string, payload: Partial<IntlImportContainer>): Promise<IntlImportContainer> {
    const updated = await api.patch<RawContainer>(`/intl-imports/containers/${id}`, payload);
    return normalizeContainer(updated);
  },

  async deleteContainer(id: string): Promise<{ success: boolean; id: string }> {
    return api.delete<{ success: boolean; id: string }>(`/intl-imports/containers/${id}`);
  },

  async assignPackages(containerId: string, packageIds: string[]): Promise<{ count: number }> {
    return api.post<{ count: number }>(`/intl-imports/containers/${containerId}/assign-packages`, { packageIds });
  },

  /**
   * Devuelve paquetes a bodega de origen sin borrarlos. Es la operación
   * correcta dentro de la vista de contenedor: el paquete, su trazabilidad y
   * su volumetría congelada sobreviven, y puede volver a asignarse.
   */
  /** Devuelve el contenedor recalculado, no solo el conteo: los totales
   *  facturables se releen del servidor tras sacar los paquetes. */
  async unassignPackages(containerId: string, packageIds: string[]): Promise<IntlImportContainer> {
    return api.post<IntlImportContainer>(`/intl-imports/containers/${containerId}/unassign-packages`, { packageIds });
  },

  // --- Customs & Expenses ---
  async addExpense(containerId: string, payload: { expenseType: string; amount: number; description?: string }): Promise<IntlImportExpense> {
    return api.post<IntlImportExpense>(`/intl-imports/containers/${containerId}/expenses`, payload);
  },

  async getProrationPreview(containerId: string): Promise<ProrationPreviewResult> {
    const raw = await api.get<RawProrationPreview>(`/intl-imports/containers/${containerId}/proration`);
    return normalizeProrationPreview(raw);
  },

  async closeAndProrateContainer(containerId: string): Promise<{ success: boolean; closedAt: string }> {
    return api.post<{ success: boolean; closedAt: string }>(`/intl-imports/containers/${containerId}/close-prorate`, {});
  },

  // --- Config ---
  async getConfig(): Promise<IntlImportConfig> {
    try {
      return await api.get<IntlImportConfig>('/intl-imports/config');
    } catch {
      return {
        volumetricFactorKgPerCbm: 167,
        defaultContainerCbm: 20,
        defaultContainerMaxKg: 5000,
        trackingPrefix: 'CC-',
      };
    }
  },

  async updateConfig(payload: Partial<IntlImportConfig>): Promise<IntlImportConfig> {
    return api.patch<IntlImportConfig>('/intl-imports/config', payload);
  },

  // --- Volumetria: el backend es la unica fuente de la formula ---

  /**
   * Preview del calculo facturable. La UI lo usa para mostrar el resultado y
   * NUNCA para calcularlo por su cuenta: replicar la formula aqui fue
   * precisamente la fuente de divergencias que esta preview elimina.
   */
  async previewChargeable(payload: {
    actualWeightKg: number;
    volumeCbm?: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    originCountry?: string;
    transportMode?: string;
    carrier?: string;
    /** Regla del tenant asignada explicitamente a este paquete. */
    volumetricRuleId?: string;
    volumetricFactorKgPerCbm?: number;
  }): Promise<ChargeablePreviewResult> {
    return api.post<ChargeablePreviewResult>('/intl-imports/chargeable/preview', payload);
  },

  async listVolumetricFactors(includeInactive = false): Promise<IntlVolumetricFactor[]> {
    return api.get<IntlVolumetricFactor[]>('/intl-imports/volumetric-factors', {
      params: { includeInactive },
    });
  },

  async createVolumetricFactor(payload: Partial<IntlVolumetricFactor>): Promise<IntlVolumetricFactor> {
    return api.post<IntlVolumetricFactor>('/intl-imports/volumetric-factors', payload);
  },

  async updateVolumetricFactor(id: string, payload: Partial<IntlVolumetricFactor>): Promise<IntlVolumetricFactor> {
    return api.patch<IntlVolumetricFactor>(`/intl-imports/volumetric-factors/${id}`, payload);
  },

  async deleteVolumetricFactor(id: string): Promise<{ success: boolean; id: string; deactivated?: boolean }> {
    return api.delete<{ success: boolean; id: string; deactivated?: boolean }>(`/intl-imports/volumetric-factors/${id}`);
  },

  // --- Cierre y movimientos ---

  async getContainerBalance(containerId: string): Promise<ContainerBalance> {
    return api.get<ContainerBalance>(`/intl-imports/containers/${containerId}/balance`);
  },

  async getContainerClosures(containerId: string): Promise<ContainerClosure[]> {
    return api.get<ContainerClosure[]>(`/intl-imports/containers/${containerId}/closures`);
  },

  async getPackageMovements(packageId: string): Promise<PackageMovement[]> {
    return api.get<PackageMovement[]>(`/intl-imports/packages/${packageId}/movements`);
  },

  /** Simula el movimiento sin escribir nada. Usar antes de confirmar. */
  async simulateMove(payload: { targetContainerId: string; packageIds: string[]; reason?: string }): Promise<MoveSimulationResult> {
    return api.post<MoveSimulationResult>('/intl-imports/move-packages/simulate', payload);
  },

  async movePackages(payload: { targetContainerId: string; packageIds: string[]; reason?: string }): Promise<{ moved: number; simulation: MoveSimulationResult }> {
    return api.post<{ moved: number; simulation: MoveSimulationResult }>('/intl-imports/move-packages', payload);
  },

  async closeContainerByException(containerId: string, closeReason: string): Promise<{ success: boolean; closedAt: string; closedByException: true }> {
    return api.post<{ success: boolean; closedAt: string; closedByException: true }>(
      `/intl-imports/containers/${containerId}/close-by-exception`,
      { closeReason },
    );
  },

  async reopenContainer(containerId: string, reason: string): Promise<{ success: boolean; reopenCount: number; reopenedAt: string }> {
    return api.post<{ success: boolean; reopenCount: number; reopenedAt: string }>(
      `/intl-imports/containers/${containerId}/reopen`,
      { reason },
    );
  },
};
