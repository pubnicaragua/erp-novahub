import { api } from './api';

export type DayMode = 'REGULAR' | 'EXTRA' | 'OFF';
export interface DaySchedule { mode: DayMode; start: string | null; end: string | null }
export type VacationRule = 'FULL_DAY' | 'HALF_DAY' | 'HOURS';
export interface ScheduleResponse {
  scope: 'COMPANY' | 'EMPLOYEE'; employeeId: string | null; configured: boolean; days: Record<string, DaySchedule>;
  vacationRule: VacationRule; fullDayHours: number; overtimeMultiplier: number; operatingHoursPerMonth: number;
}
export interface HolidayItem { id: string; date: string; weekday: number; name: string; kind: 'NATIONAL' | 'LOCAL' | 'CUSTOM'; enabled: boolean; worked: boolean; payMultiplier: number; extraCost: number }
export interface HolidaysResponse { year: number; currency: string; dailyPayroll: number; items: HolidayItem[] }
export interface RecurringLeaveRow { id: string; employeeId: string; employeeName: string; employeeNumber: string; weekday: number; startDate: string; endDate: string; portion: number; status: 'ACTIVE' | 'CANCELLED'; reason: string | null }
export interface RecurringLeavePreview {
  employee: { id: string; name: string }; weekday: number; year: number;
  vacation: { total: number; used: number; pending: number; recurringUsed: number; recurringPlanned: number; available: number };
  occurrences: number; portion: number; daysConsumed: number; remainingAfter: number; shortfallDays: number; occurrencesThatFit: number; owesVacation: boolean; dates: string[]; skippedHolidays: string[];
}
export interface CostItem { id: string; label: string; kind: string; monthlyAmount: number; currency: string; includeInHourly: boolean }
export interface CostsResponse { currency: string; operatingHoursPerMonth: number; monthlyTotal: number; hourlyCost: number; items: CostItem[] }
export interface SalesPattern {
  weeks: number; from: string; to: string; currency: string; invoices: number; bestDay: number | null; peakHours: number[];
  byWeekday: Array<{ weekday: number; avgSales: number; avgInvoices: number }>; byHour: Array<{ hour: number; avgSales: number }>; heatmap: number[][];
}
export type Verdict = 'GOOD' | 'MARGINAL' | 'NOT_WORTH' | 'NO_DATA';
export interface OvertimeResult {
  scenario: 'OVERTIME' | 'HOLIDAY'; date: string; weekday: number; currency: string; hours: number; startHour: number; endHour: number; multiplier: number;
  holiday: { name: string; worked: boolean; payMultiplier: number } | null;
  cost: { people: Array<{ id: string; name: string; hourlyRate: number; pay: number }>; payTotal: number; operating: number; transport: number; meal: number; other: number; total: number };
  hourlyOperatingCost: number; expectedSales: number | null; salesBasis: 'ACTUAL' | 'AVERAGE' | 'NONE'; marginPct: number; breakEvenSales: number | null;
  verdict: Verdict; expectedProfit: number | null; net: number | null; ratio: number | null;
}
export interface OvertimeRequest {
  scenario: 'OVERTIME' | 'HOLIDAY'; date: string; hours?: number; startTime?: string; employeeIds: string[]; transport?: number; meal?: number; other?: number; marginPct?: number;
}

export const workforceService = {
  getSchedule: (employeeId?: string, signal?: AbortSignal) => api.get<ScheduleResponse>('/workforce/schedule', { params: employeeId ? { employeeId } : {}, signal }),
  saveSchedule: (data: { employeeId?: string | null; days: Record<string, DaySchedule>; vacationRule: VacationRule; fullDayHours: number; overtimeMultiplier: number }) => api.put<ScheduleResponse>('/workforce/schedule', data),
  removeEmployeeSchedule: (employeeId: string) => api.delete<{ employeeId: string }>(`/workforce/schedule/${employeeId}`),
  getHolidays: (year: number, signal?: AbortSignal) => api.get<HolidaysResponse>('/workforce/holidays', { params: { year }, signal }),
  createHoliday: (data: { date: string; name: string; worked?: boolean }) => api.post<{ id: string }>('/workforce/holidays', data),
  updateHoliday: (id: string, data: Partial<Pick<HolidayItem, 'name' | 'worked' | 'enabled' | 'payMultiplier'>>) => api.patch<{ id: string }>(`/workforce/holidays/${id}`, data),
  removeHoliday: (id: string) => api.delete<{ id: string }>(`/workforce/holidays/${id}`),
  listRecurringLeaves: (employeeId?: string, signal?: AbortSignal) => api.get<RecurringLeaveRow[]>('/workforce/recurring-leaves', { params: employeeId ? { employeeId } : {}, signal }),
  previewRecurringLeave: (data: { employeeId: string; weekday: number; startDate: string; endDate: string }) => api.post<RecurringLeavePreview>('/workforce/recurring-leaves/preview', data),
  createRecurringLeave: (data: { employeeId: string; weekday: number; startDate: string; endDate: string; reason?: string }) => api.post<RecurringLeavePreview & { id: string }>('/workforce/recurring-leaves', data),
  cancelRecurringLeave: (id: string) => api.post<{ id: string }>(`/workforce/recurring-leaves/${id}/cancel`, {}),
  getCosts: (signal?: AbortSignal) => api.get<CostsResponse>('/workforce/operating-costs', { signal }),
  saveCost: (data: { label: string; kind: string; monthlyAmount: number; currency?: string; includeInHourly?: boolean }, id?: string) => (id ? api.patch<CostsResponse>(`/workforce/operating-costs/${id}`, data) : api.post<CostsResponse>('/workforce/operating-costs', data)),
  removeCost: (id: string) => api.delete<CostsResponse>(`/workforce/operating-costs/${id}`),
  getSalesPattern: (weeks: number, signal?: AbortSignal) => api.get<SalesPattern>('/workforce/sales-pattern', { params: { weeks }, signal }),
  simulateOvertime: (data: OvertimeRequest) => api.post<OvertimeResult>('/workforce/overtime/simulate', data),
};

export const WEEKDAY_NAMES = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const VACATION_RULE_LABEL: Record<VacationRule, string> = { FULL_DAY: 'Un día completo', HALF_DAY: 'Medio día si la jornada es corta', HOURS: 'Proporcional a las horas del día' };
export const VERDICT_LABEL: Record<Verdict, { label: string; text: string; tone: string }> = {
  GOOD: { label: 'Conviene', text: 'Lo que se espera vender cubre con holgura todo lo que cuesta.', tone: 'is-covered' },
  MARGINAL: { label: 'Justo', text: 'Se cubre el costo, pero con poco margen.', tone: 'is-tight' },
  NOT_WORTH: { label: 'No conviene', text: 'Lo que se espera vender no alcanza para pagar lo que cuesta.', tone: 'is-short' },
  NO_DATA: { label: 'Sin datos de ventas', text: 'Aún no hay ventas registradas en esa franja para compararlas con el costo.', tone: 'is-tight' },
};
