import { api } from './api';

type HrGetOptions = { params?: Record<string, any>; signal?: AbortSignal };
const withSignal = (params?: Record<string, any>, signal?: AbortSignal): HrGetOptions => ({ params, signal });

export const hrService = {
  // ===== DEPARTMENTS =====
  getDepartments: (signal?: AbortSignal) => api.get('/hr/departments', withSignal(undefined, signal)),
  getDepartmentHeadCandidates: (signal?: AbortSignal) => api.get('/hr/department-head-candidates', withSignal(undefined, signal)),
  getDepartment: (id: string, signal?: AbortSignal) => api.get(`/hr/departments/${id}`, withSignal(undefined, signal)),
  createDepartment: (data: any) => api.post('/hr/departments', data),
  updateDepartment: (id: string, data: any) => api.patch(`/hr/departments/${id}`, data),
  deleteDepartment: (id: string) => api.delete(`/hr/departments/${id}`),

  // ===== POSITIONS =====
  getPositions: (departmentId?: string, signal?: AbortSignal) => api.get('/hr/positions', withSignal({ departmentId }, signal)),
  getPosition: (id: string, signal?: AbortSignal) => api.get(`/hr/positions/${id}`, withSignal(undefined, signal)),
  createPosition: (data: any) => api.post('/hr/positions', data),
  updatePosition: (id: string, data: any) => api.patch(`/hr/positions/${id}`, data),
  deletePosition: (id: string) => api.delete(`/hr/positions/${id}`),

  // ===== EMPLOYEES =====
  getEmployees: (filters?: any, signal?: AbortSignal) => api.get('/hr/employees', withSignal(filters, signal)),
  getEmployee: (id: string, signal?: AbortSignal) => api.get(`/hr/employees/${id}`, withSignal(undefined, signal)),
  getEmployeeHistory: (id: string, signal?: AbortSignal) => api.get(`/hr/employees/${id}/history`, withSignal(undefined, signal)),
  createEmployee: (data: any) => api.post('/hr/employees', data),
  updateEmployee: (id: string, data: any) => api.patch(`/hr/employees/${id}`, data),
  updateEmployeeDepartments: (id: string, departmentIds: string[], primaryDepartmentId?: string | null) =>
    api.put(`/hr/employees/${id}/departments`, { departmentIds, primaryDepartmentId }),
  deleteEmployee: (id: string) => api.delete(`/hr/employees/${id}`),
  bulkImportEmployees: (employees: any[]) => api.post('/hr/employees/bulk-import', { employees }),
  exportEmployees: (signal?: AbortSignal) => api.get('/hr/employees/export', withSignal(undefined, signal)),

  // ===== PAYROLL =====
  getPayrolls: (filters?: any, signal?: AbortSignal) => api.get('/hr/payroll', withSignal(filters, signal)),
  createPayroll: (data: any) => api.post('/hr/payroll', data),
  bulkProcessPayroll: (data: any) => api.post('/hr/payroll/bulk-process', data),
  calculatePayroll: (data: any) => api.post('/hr/payroll/calculate', data),
  getPayrollPeriods: (signal?: AbortSignal) => api.get('/hr/payroll/periods', withSignal(undefined, signal)),
  getPayrollReports: (period?: string, signal?: AbortSignal) => api.get('/hr/payroll/reports', withSignal({ period }, signal)),
  updatePayrollStatus: (id: string, status: string) => api.patch(`/hr/payroll/${id}/status`, { status }),
  deletePayroll: (id: string) => api.delete(`/hr/payroll/${id}`),

  // ===== ATTENDANCE =====
  clockIn: (data: any) => api.post('/hr/attendance/clock-in', data),
  clockOut: (data: any) => api.post('/hr/attendance/clock-out', data),
  createAttendance: (data: any) => api.post('/hr/attendance', data),
  getAttendanceRecords: (filters?: any, signal?: AbortSignal) => api.get('/hr/attendance/records', withSignal(filters, signal)),
  getAttendanceReports: (month?: string, signal?: AbortSignal) => api.get('/hr/attendance/reports', withSignal({ month }, signal)),

  // ===== LEAVE REQUESTS =====
  getLeaveRequests: (filters?: any, signal?: AbortSignal) => api.get('/hr/leave/requests', withSignal(filters, signal)),
  createLeaveRequest: (data: any) => api.post('/hr/leave/requests', data),
  approveLeaveRequest: (id: string, approvedBy: string) => api.put(`/hr/leave/requests/${id}/approve`, { approvedBy }),
  rejectLeaveRequest: (id: string, rejectionReason: string) => api.put(`/hr/leave/requests/${id}/reject`, { rejectionReason }),

  // ===== PERFORMANCE REVIEWS =====
  getPerformanceReviews: (employeeId?: string, signal?: AbortSignal, filters?: any) => api.get('/hr/performance/reviews', withSignal({ employeeId, ...filters }, signal)),
  getPerformanceReview: (id: string, signal?: AbortSignal) => api.get(`/hr/performance/reviews/${id}`, withSignal(undefined, signal)),
  createPerformanceReview: (data: any) => api.post('/hr/performance/reviews', data),
  updatePerformanceReview: (id: string, data: any) => api.patch(`/hr/performance/reviews/${id}`, data),
  getPerformanceMetrics: (signal?: AbortSignal) => api.get('/hr/performance/metrics', withSignal(undefined, signal)),

  // ===== TRAINING =====
  getTrainings: (statusOrFilters?: string | any, signal?: AbortSignal) => api.get('/hr/training', withSignal(typeof statusOrFilters === 'object' ? statusOrFilters : { status: statusOrFilters }, signal)),
  getTraining: (id: string, signal?: AbortSignal) => api.get(`/hr/training/${id}`, withSignal(undefined, signal)),
  createTraining: (data: any) => api.idempotentPost('/hr/training', data),
  updateTraining: (id: string, data: any) => api.patch(`/hr/training/${id}`, data),
  enrollEmployee: (data: any) => api.post('/hr/training/enroll', data),
  completeTraining: (trainingId: string, employeeId: string, data: any) => 
    api.put(`/hr/training/${trainingId}/complete/${employeeId}`, data),

  // ===== BENEFITS =====
  getBenefits: (filters?: any, signal?: AbortSignal) => api.get('/hr/benefits', withSignal(filters, signal)),
  createBenefit: (data: any) => api.idempotentPost('/hr/benefits', data),
  updateBenefit: (id: string, data: any) => api.idempotentPatch(`/hr/benefits/${id}`, data),
  deleteBenefit: (id: string) => api.delete(`/hr/benefits/${id}`),
  assignBenefit: (data: any) => api.post('/hr/benefits/assign', data),

  // ===== DOCUMENTS =====
  getDocuments: (employeeId?: string, signal?: AbortSignal, filters?: any) => api.get('/hr/documents', withSignal({ employeeId, ...filters }, signal)),
  createDocument: (data: any) => api.post('/hr/documents', data),
  deleteDocument: (id: string) => api.delete(`/hr/documents/${id}`),

  // ===== ANALYTICS =====
  getDashboardStats: (signal?: AbortSignal) => api.get('/hr/dashboard/stats', withSignal(undefined, signal)),
  getHeadcountAnalytics: (signal?: AbortSignal) => api.get('/hr/analytics/headcount', withSignal(undefined, signal)),
  getTurnoverRate: (signal?: AbortSignal) => api.get('/hr/analytics/turnover', withSignal(undefined, signal)),

  // ===== PAYROLL CONFIG =====
  getPayrollConfigs: (signal?: AbortSignal) => api.get('/hr/payroll-config', withSignal(undefined, signal)),
  getActivePayrollConfig: (signal?: AbortSignal) => api.get('/hr/payroll-config/active', withSignal(undefined, signal)),
  createPayrollConfig: (data: any) => api.post('/hr/payroll-config', data),
  updatePayrollConfig: (id: string, data: any) => api.patch(`/hr/payroll-config/${id}`, data),

  // ─── EMPLOYEE AUTHORIZATION ──────────────────────────────────────────
  submitEmployee: (id: string) => api.post(`/hr/employees/${id}/submit`, {}),
  approveEmployee: (id: string) => api.post(`/hr/employees/${id}/approve`, {}),
  rejectEmployee: (id: string, reason: string) => api.post(`/hr/employees/${id}/reject`, { reason }),
  getEmployeeChangeLog: (id: string, signal?: AbortSignal) => api.get(`/hr/employees/${id}/changelog`, withSignal(undefined, signal)),

  // ─── VACATION BALANCE ────────────────────────────────────────────────
  getVacationBalance: (employeeId: string, year?: number, signal?: AbortSignal) => api.get(`/hr/vacation-balance/${employeeId}`, withSignal({ year }, signal)),
  getVacationBalances: (year?: number, signal?: AbortSignal) => api.get('/hr/vacation-balance', withSignal({ year }, signal)),
  recalcVacationBalance: (employeeId: string, year?: number) => api.post(`/hr/vacation-balance/${employeeId}/recalc`, {}, { params: { year } }),

  // ─── ABSENCE TYPE ────────────────────────────────────────────────────
  createAbsenceType: (data: any) => api.post('/hr/absence-types', data),
  getAbsenceTypes: (signal?: AbortSignal) => api.get('/hr/absence-types', withSignal(undefined, signal)),
  updateAbsenceType: (id: string, data: any) => api.patch(`/hr/absence-types/${id}`, data),

  // ─── KPI ─────────────────────────────────────────────────────────────
  createKpiDefinition: (data: any) => api.post('/hr/kpi-definitions', data),
  getKpiDefinitions: (assignToType?: string, signal?: AbortSignal) => api.get('/hr/kpi-definitions', withSignal({ assignToType }, signal)),
  updateKpiDefinition: (id: string, data: any) => api.patch(`/hr/kpi-definitions/${id}`, data),
  createKpiResult: (data: any) => api.post('/hr/kpi-results', data),
  getKpiResults: (employeeId?: string, kpiDefinitionId?: string, signal?: AbortSignal) => api.get('/hr/kpi-results', withSignal({ employeeId, kpiDefinitionId }, signal)),
};
