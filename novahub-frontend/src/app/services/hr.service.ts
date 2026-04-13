import { api } from './api';

export const hrService = {
  // ===== DEPARTMENTS =====
  getDepartments: () => api.get('/hr/departments'),
  getDepartment: (id: string) => api.get(`/hr/departments/${id}`),
  createDepartment: (data: any) => api.post('/hr/departments', data),
  updateDepartment: (id: string, data: any) => api.patch(`/hr/departments/${id}`, data),
  deleteDepartment: (id: string) => api.delete(`/hr/departments/${id}`),

  // ===== POSITIONS =====
  getPositions: (departmentId?: string) => api.get('/hr/positions', { params: { departmentId } }),
  getPosition: (id: string) => api.get(`/hr/positions/${id}`),
  createPosition: (data: any) => api.post('/hr/positions', data),
  updatePosition: (id: string, data: any) => api.patch(`/hr/positions/${id}`, data),
  deletePosition: (id: string) => api.delete(`/hr/positions/${id}`),

  // ===== EMPLOYEES =====
  getEmployees: (filters?: any) => api.get('/hr/employees', { params: filters }),
  getEmployee: (id: string) => api.get(`/hr/employees/${id}`),
  getEmployeeHistory: (id: string) => api.get(`/hr/employees/${id}/history`),
  createEmployee: (data: any) => api.post('/hr/employees', data),
  updateEmployee: (id: string, data: any) => api.patch(`/hr/employees/${id}`, data),
  deleteEmployee: (id: string) => api.delete(`/hr/employees/${id}`),
  bulkImportEmployees: (employees: any[]) => api.post('/hr/employees/bulk-import', { employees }),
  exportEmployees: () => api.get('/hr/employees/export'),

  // ===== PAYROLL =====
  getPayrolls: (filters?: any) => api.get('/hr/payroll', { params: filters }),
  createPayroll: (data: any) => api.post('/hr/payroll', data),
  bulkProcessPayroll: (data: any) => api.post('/hr/payroll/bulk-process', data),
  calculatePayroll: (data: any) => api.post('/hr/payroll/calculate', data),
  getPayrollPeriods: () => api.get('/hr/payroll/periods'),
  getPayrollReports: (period?: string) => api.get('/hr/payroll/reports', { params: { period } }),
  updatePayrollStatus: (id: string, status: string) => api.patch(`/hr/payroll/${id}/status`, { status }),
  deletePayroll: (id: string) => api.delete(`/hr/payroll/${id}`),

  // ===== ATTENDANCE =====
  clockIn: (data: any) => api.post('/hr/attendance/clock-in', data),
  clockOut: (data: any) => api.post('/hr/attendance/clock-out', data),
  createAttendance: (data: any) => api.post('/hr/attendance', data),
  getAttendanceRecords: (filters?: any) => api.get('/hr/attendance/records', { params: filters }),
  getAttendanceReports: (month?: string) => api.get('/hr/attendance/reports', { params: { month } }),

  // ===== LEAVE REQUESTS =====
  getLeaveRequests: (filters?: any) => api.get('/hr/leave/requests', { params: filters }),
  createLeaveRequest: (data: any) => api.post('/hr/leave/requests', data),
  approveLeaveRequest: (id: string, approvedBy: string) => api.put(`/hr/leave/requests/${id}/approve`, { approvedBy }),
  rejectLeaveRequest: (id: string, rejectionReason: string) => api.put(`/hr/leave/requests/${id}/reject`, { rejectionReason }),

  // ===== PERFORMANCE REVIEWS =====
  getPerformanceReviews: (employeeId?: string) => api.get('/hr/performance/reviews', { params: { employeeId } }),
  getPerformanceReview: (id: string) => api.get(`/hr/performance/reviews/${id}`),
  createPerformanceReview: (data: any) => api.post('/hr/performance/reviews', data),
  updatePerformanceReview: (id: string, data: any) => api.patch(`/hr/performance/reviews/${id}`, data),
  getPerformanceMetrics: () => api.get('/hr/performance/metrics'),

  // ===== TRAINING =====
  getTrainings: (status?: string) => api.get('/hr/training', { params: { status } }),
  getTraining: (id: string) => api.get(`/hr/training/${id}`),
  createTraining: (data: any) => api.post('/hr/training', data),
  updateTraining: (id: string, data: any) => api.patch(`/hr/training/${id}`, data),
  enrollEmployee: (data: any) => api.post('/hr/training/enroll', data),
  completeTraining: (trainingId: string, employeeId: string, data: any) => 
    api.put(`/hr/training/${trainingId}/complete/${employeeId}`, data),

  // ===== BENEFITS =====
  getBenefits: () => api.get('/hr/benefits'),
  createBenefit: (data: any) => api.post('/hr/benefits', data),
  updateBenefit: (id: string, data: any) => api.patch(`/hr/benefits/${id}`, data),
  deleteBenefit: (id: string) => api.delete(`/hr/benefits/${id}`),
  assignBenefit: (data: any) => api.post('/hr/benefits/assign', data),

  // ===== DOCUMENTS =====
  getDocuments: (employeeId?: string) => api.get('/hr/documents', { params: { employeeId } }),
  createDocument: (data: any) => api.post('/hr/documents', data),
  deleteDocument: (id: string) => api.delete(`/hr/documents/${id}`),

  // ===== ANALYTICS =====
  getDashboardStats: () => api.get('/hr/dashboard/stats'),
  getHeadcountAnalytics: () => api.get('/hr/analytics/headcount'),
  getTurnoverRate: () => api.get('/hr/analytics/turnover'),

  // ===== PAYROLL CONFIG =====
  getPayrollConfigs: () => api.get('/hr/payroll-config'),
  getActivePayrollConfig: () => api.get('/hr/payroll-config/active'),
  createPayrollConfig: (data: any) => api.post('/hr/payroll-config', data),
  updatePayrollConfig: (id: string, data: any) => api.patch(`/hr/payroll-config/${id}`, data),
};
