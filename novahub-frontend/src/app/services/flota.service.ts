import { api } from './api';

export type VehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
export type CostFieldKind = 'AMOUNT' | 'PERCENT' | 'FORMULA';

export interface FleetVehicle {
  id: string;
  code: string;
  plate?: string | null;
  name?: string | null;
  vehicleType?: string | null;
  capacityGallons?: string | number | null;
  kmPerGallon?: string | number | null;
  commissionPercent?: string | number | null;
  status: VehicleStatus;
  consumptionWarehouseId?: string | null;
  fixedAssetId?: string | null;
  notes?: string | null;
}

export interface FleetRoute {
  id: string;
  origin: string;
  destination: string;
  zone?: string | null;
  distanceKm?: string | number | null;
  rate: string | number;
  rateUnit: 'PER_GALLON' | 'PER_TRIP';
  isActive: boolean;
  notes?: string | null;
}

export interface CommissionTier { upToGallons: number; percent: number }

export interface FleetSettings {
  dieselPrice: string | number;
  kmFactor: string | number;
  defaultKmPerGallon: string | number;
  linkFixedAssets: boolean;
  commissionTiers: CommissionTier[];
  /** Fórmula opcional de tarifa de la empresa (p. ej. «km * factor_km / capacidad»). */
  rateFormula?: string | null;
}

export interface CostFieldDefinition {
  id: string;
  code: string;
  label: string;
  kind: CostFieldKind;
  formula?: string | null;
  defaultValue?: string | number | null;
  visibleToCustomer: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface IndustryTemplate { id: string; code: string; name: string; description?: string | null; modules: string[] }

export interface RateImportRow { origin: string; destination: string; zone?: string; distanceKm?: number | null; rate: number }
export interface RateImportResult { preview: boolean; total: number; toCreate?: number; toUpdate?: number; created?: number; updated?: number }

export type TripSourceType = 'INVOICE' | 'ORDER' | 'ESTIMATE';
export type DriverType = 'PAYROLL' | 'SUBCONTRACTED' | 'PER_TRIP';

export interface TripCostLine { code: string; label: string; kind: string; amount: number; visibleToCustomer: boolean; error?: string }
export interface TripCostResult {
  km: number; rate: number; rateSource: 'MANUAL' | 'ROUTE' | 'FORMULA' | 'NONE'; revenue: number; kmPerGallon: number;
  consumptionGallons: number; commissionPercent: number; lines: TripCostLine[]; totalCost: number; profit: number;
  marginPercent: number; warnings: string[];
}
export interface TripCostInput {
  vehicleId?: string; driverType?: DriverType; driverEmployeeId?: string; driverName?: string;
  origin?: string; destination?: string; km?: number | string; quantity?: number | string; revenue?: number | string; rate?: number | string;
  kmPerGallon?: number | string; dieselPrice?: number | string; commissionPercent?: number | string;
  viatico?: number | string; driverPay?: number | string; depreciation?: number | string; otherCosts?: number | string; extraStop?: number | string;
  custom?: Record<string, number | string>; lineId?: string; tripDate?: string; currency?: string;
}
export interface SavedTripCost {
  id: string; lineId: string; vehicleId?: string | null; driverType: DriverType; driverEmployeeId?: string | null; driverName?: string | null;
  origin?: string | null; destination?: string | null; distanceKm: string | number; quantity: string | number; revenue: string | number;
  inputs: Record<string, unknown>; breakdown: TripCostLine[]; totalCost: string | number; profit: string | number;
}
export interface FormulaHelp { variables: Array<{ name: string; description: string }>; functions: string[]; operators: string[]; example: string }
export interface FormulaCheck { ok: boolean; error?: string; variables: string[]; unknown: string[] }
export interface ProfitabilityRow { key: string; label: string; trips: number; revenue: number; cost: number; profit: number; km: number; marginPercent: number; lines: Record<string, number> }
export interface ProfitabilityReport {
  from: string; to: string; groupBy: string; truncated: boolean;
  totals: { trips: number; revenue: number; cost: number; profit: number; km: number; marginPercent: number; lines: Record<string, number> };
  rows: ProfitabilityRow[];
}

export const flotaService = {
  getSettings: (signal?: AbortSignal) => api.get<FleetSettings>('/fleet/settings', { signal }),
  saveSettings: (data: Partial<FleetSettings>) => api.put<FleetSettings>('/fleet/settings', data),

  listVehicles: (params?: { status?: string; search?: string }, signal?: AbortSignal) => api.get<FleetVehicle[]>('/fleet/vehicles', { params, signal }),
  createVehicle: (data: Record<string, unknown>) => api.post<FleetVehicle>('/fleet/vehicles', data),
  updateVehicle: (id: string, data: Record<string, unknown>) => api.patch<FleetVehicle>(`/fleet/vehicles/${id}`, data),
  removeVehicle: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/fleet/vehicles/${id}`),

  listRoutes: (params?: { search?: string; includeInactive?: string }, signal?: AbortSignal) => api.get<FleetRoute[]>('/fleet/routes', { params, signal }),
  createRoute: (data: Record<string, unknown>) => api.post<FleetRoute>('/fleet/routes', data),
  updateRoute: (id: string, data: Record<string, unknown>) => api.patch<FleetRoute>(`/fleet/routes/${id}`, data),
  removeRoute: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/fleet/routes/${id}`),
  importRoutes: (rows: RateImportRow[], preview: boolean) => api.post<RateImportResult>('/fleet/routes/import', { rows, preview }),

  listCostFields: (signal?: AbortSignal) => api.get<CostFieldDefinition[]>('/fleet/cost-fields', { signal }),
  createCostField: (data: Record<string, unknown>) => api.post<CostFieldDefinition>('/fleet/cost-fields', data),
  updateCostField: (id: string, data: Record<string, unknown>) => api.patch<CostFieldDefinition>(`/fleet/cost-fields/${id}`, data),
  removeCostField: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/fleet/cost-fields/${id}`),

  formulaHelp: (signal?: AbortSignal) => api.get<FormulaHelp>('/fleet/trips/formula-help', { signal }),
  checkFormula: (formula: string) => api.post<FormulaCheck>('/fleet/trips/formula-check', { formula }),
  previewTrip: (data: TripCostInput) => api.post<TripCostResult>('/fleet/trips/preview', data),
  listTrips: (sourceType: TripSourceType, sourceId: string, signal?: AbortSignal) => api.get<SavedTripCost[]>(`/fleet/trips/${sourceType}/${sourceId}`, { signal }),
  saveTrip: (sourceType: TripSourceType, sourceId: string, data: TripCostInput) => api.put<SavedTripCost & { summary: TripCostResult }>(`/fleet/trips/${sourceType}/${sourceId}`, data),
  removeTrip: (sourceType: TripSourceType, sourceId: string, lineId = '') => api.delete<{ deleted: number }>(`/fleet/trips/${sourceType}/${sourceId}?lineId=${encodeURIComponent(lineId)}`),
  profitability: (params: { from?: string; to?: string; groupBy?: string; vehicleId?: string }, signal?: AbortSignal) => api.get<ProfitabilityReport>('/fleet/reports/profitability', { params, signal }),

  listTemplates: (signal?: AbortSignal) => api.get<IndustryTemplate[]>('/fleet/templates', { signal }),
  applyTemplate: (code: string) => api.post<{ template: string; createdFields: number; skippedFields: number; settingsCreated: boolean }>(`/fleet/templates/${code}/apply`, {}),
};

/** Convierte la tabla de tarifas de Excel en filas. Acepta la tabla MTI (destino y zona a la izquierda, un origen por columna)
 *  o una lista plana con columnas Origen, Destino, Zona, Km y Tarifa. */
export function parseRateSheet(matrix: unknown[][]): { rows: RateImportRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const clean = (value: unknown) => String(value ?? '').trim();
  const norm = (value: unknown) => clean(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const num = (value: unknown) => {
    let text = clean(value);
    // «3,17851» (coma decimal) se lee como 3.17851; «1,234.5» (coma de miles con punto) se lee como 1234.5.
    text = /^-?\d+,\d+$/.test(text) ? text.replace(',', '.') : text.replace(/,/g, '');
    if (!text) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  const headerIndex = matrix.findIndex((row) => row.some((cell) => norm(cell) === 'destino'));
  if (headerIndex < 0) return { rows: [], warnings: ['No encontré la columna «Destino» en el archivo.'] };
  const header = matrix[headerIndex].map(norm);
  const destCol = header.indexOf('destino');
  const originCol = header.indexOf('origen');
  const rateCol = header.findIndex((cell) => cell === 'tarifa' || cell === 'rate');
  const zoneCol = header.indexOf('zona');
  const kmCol = header.findIndex((cell) => cell === 'km' || cell === 'kilometros');
  const rows: RateImportRow[] = [];

  if (originCol >= 0 && rateCol >= 0) {
    matrix.slice(headerIndex + 1).forEach((row, index) => {
      const origin = clean(row[originCol]); const destination = clean(row[destCol]);
      if (!origin && !destination) return;
      const rate = num(row[rateCol]);
      if (rate === null || Number.isNaN(rate)) { warnings.push(`Fila ${headerIndex + index + 2}: tarifa vacía o inválida, se omitió.`); return; }
      const km = kmCol >= 0 ? num(row[kmCol]) : null;
      rows.push({ origin, destination, zone: zoneCol >= 0 ? clean(row[zoneCol]) : undefined, distanceKm: km === null || Number.isNaN(km) ? null : km, rate });
    });
    return { rows, warnings };
  }

  // Tabla MTI: cada columna después de «Zona» es un origen.
  const firstOriginCol = Math.max(destCol, zoneCol) + 1;
  const origins = matrix[headerIndex].map((cell, col) => ({ col, name: clean(cell) })).filter((item) => item.col >= firstOriginCol && item.name);
  if (!origins.length) return { rows: [], warnings: ['No encontré columnas de origen (por ejemplo Corinto, Managua).'] };
  matrix.slice(headerIndex + 1).forEach((row, index) => {
    const destination = clean(row[destCol]);
    if (!destination) return;
    origins.forEach(({ col, name }) => {
      const value = num(row[col]);
      if (value === null) return;
      if (Number.isNaN(value)) { warnings.push(`Fila ${headerIndex + index + 2}, ${name}: valor inválido, se omitió.`); return; }
      rows.push({ origin: name, destination, zone: zoneCol >= 0 ? clean(row[zoneCol]) : undefined, rate: value });
    });
  });
  return { rows, warnings };
}
