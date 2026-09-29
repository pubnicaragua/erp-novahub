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

export interface IntlImportPackageEvent {
  id: string;
  packageId: string;
  status: IntlImportPackageStatus;
  label: string;
  description?: string;
  location?: string;
  occurredAt: string;
}

export interface IntlImportPackage {
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
  status: IntlImportContainerStatus;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualArrival?: string;
  isClosed: boolean;
  packagesCount?: number;
  totalVolumeCbm?: number;
  totalActualWeightKg?: number;
  totalExpensesUsd?: number;
  expenses?: IntlImportExpense[];
  packages?: IntlImportPackage[];
  createdAt: string;
  updatedAt: string;
}

export interface IntlImportConfig {
  volumetricFactorKgPerCbm: number;
  defaultContainerCbm: number;
  defaultContainerMaxKg: number;
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
  percentage: number;
  proratedCost: number;
  volumeRatioPercentage?: string;
}

export interface ProrationPreviewResult {
  containerId: string;
  containerNumber: string;
  totalVolumeCbm: number;
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
      totalExpensesUsd: 0,
      costPerCbm: 0,
      packages: [],
    };
  }
  const rawList = Array.isArray(raw.packages) ? raw.packages : Array.isArray(raw.proratedPackages) ? raw.proratedPackages : [];
  const totalExpensesUsd = raw.totalExpensesUsd ?? raw.totalExpenses ?? 0;
  const totalVolumeCbm = raw.totalVolumeCbm ?? 0;
  const costPerCbm = raw.costPerCbm ?? (totalVolumeCbm > 0 ? Number((totalExpensesUsd / totalVolumeCbm).toFixed(2)) : 0);

  const packages: ProrationPackageItem[] = rawList.map((p) => {
    let percentage = p.percentage;
    if (percentage === undefined && p.volumeRatioPercentage) {
      percentage = parseFloat(p.volumeRatioPercentage) || 0;
    }
    return {
      packageId: p.packageId || (p as any).id || '',
      trackingCode: p.trackingCode || '',
      description: p.description,
      volumeCbm: Number(p.volumeCbm) || 0,
      percentage: Number(percentage) || 0,
      proratedCost: Number(p.proratedCost) || 0,
    };
  });

  return {
    containerId: raw.containerId || '',
    containerNumber: raw.containerNumber || '',
    totalVolumeCbm,
    totalExpensesUsd,
    costPerCbm,
    packages,
  };
}

function normalizePackage(raw: any): IntlImportPackage {
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
        return { data: (res as any[]).map(normalizePackage), total: res.length, page: 1, totalPages: 1 };
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
    const body: Record<string, unknown> = {
      actualWeightKg: Number(payload.actualWeightKg),
      volumeCbm: Number(payload.volumeCbm),
      trackingCode: payload.trackingCode?.trim() || undefined,
      invoiceNumber: payload.originalTrackingNumber?.trim() || undefined,
      description: payload.description || undefined,
      declaredValueUsd: payload.declaredValueUsd ? Number(payload.declaredValueUsd) : undefined,
      currency: 'USD',
    };
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
    const updated = await api.patch<IntlImportPackage>(`/intl-imports/packages/${id}`, payload);
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
};
