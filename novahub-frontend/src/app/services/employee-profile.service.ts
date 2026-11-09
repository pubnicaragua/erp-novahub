import { api } from './api';

export interface VacationSummary {
  daysPerYear: number; perMonth: number; perDay: number; accruedDays: number; takenDays: number; pendingDays: number;
  balanceDays: number; tookMoreThanOwed: boolean; balanceAmount: number; dayValue: number;
}
export interface TenureSummary {
  years: number; months: number; days: number; totalYears: number; severanceMonths: number; severanceAmount: number; dayValue: number; detail: string;
}
export interface LeavePolicy { minNoticeHours: number; policyNoticeHours: number; allowExtraordinary: boolean }
export interface EmployeeSummary {
  employeeId: string; asOf: string; hireDate: string; salary: number; currency: string;
  tenure: TenureSummary; vacations: VacationSummary; policy: LeavePolicy;
  leaves: { year: number; totalYear: number; totalMonth: number; daysYear: number; daysMonth: number; extraordinaryYear: number; byType: Array<{ type: string; year: number; month: number; daysYear: number; daysMonth: number }> };
  performance: { averageRating: number | null; reviewCount: number; lastRating: number | null; checkinCompliance: number | null; checkinResponseRate: number | null; checkinAverageRating: number | null };
}
export interface PaymentAccount {
  id: string; employeeId: string; bankName: string; accountType: string; accountNumber: string; last4: string; masked: boolean; currency: string;
  holderName: string | null; isPrimary: boolean; isActive: boolean;
}
export interface PaymentAccountInput { bankName: string; accountType: string; accountNumber: string; currency: string; holderName?: string; isPrimary?: boolean; isActive?: boolean }
export type PaymentKind = 'PAYROLL' | 'BONUS' | 'COMMISSION' | 'AGUINALDO' | 'SETTLEMENT' | 'OTHER';
export interface EmployeePayment {
  id: string; kind: PaymentKind; amount: number; currency: string; paidAt: string; reference: string | null; bankName: string | null; accountLast4: string | null; notes: string | null; executedById: string | null;
}
export interface PaymentHistory { total: number; page: number; pageSize: number; totals: Array<{ currency: string; amount: number }>; items: EmployeePayment[] }
export type BonusFrequency = 'ONCE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'MONTHLY_SPREAD';
export interface BonusPlan {
  id: string; name: string; bonusType: string; amount: number; currency: string; frequency: BonusFrequency; weekday: number | null; dayOfMonth: number | null;
  startDate: string; endDate: string | null; isActive: boolean; notes: string | null; minScore: number | null;
}
export interface BonusPlanInput { minScore?: number | null; name: string; bonusType: string; amount: number; currency: string; frequency: BonusFrequency; weekday?: number | null; dayOfMonth?: number | null; startDate: string; endDate?: string | null; notes?: string }
export interface LeaveRequestRow { id: string; leaveType: string; startDate: string; endDate: string; days: number; status: string; reason: string | null; isExtraordinary: boolean; noticeHours: number | null; createdAt: string }
export interface MyLeaveContext { employee: { id: string; name: string }; vacations: VacationSummary; policy: LeavePolicy; requests: LeaveRequestRow[] }
export type ContractStatus = 'DRAFT' | 'SENT' | 'SIGNED' | 'EXPIRED' | 'CANCELLED';
export interface Contract {
  id: string; employeeId: string; title: string; body: string; status: ContractStatus; sentAt: string | null; sentTo: string | null; tokenExpiresAt: string | null; signedAt: string | null;
  signerName: string | null; signerIp: string | null; documentHash: string | null; hasSignature: boolean; companySignerName: string | null; companySignedAt: string | null; createdAt: string; signatureData?: string | null; missing?: string[];
}
export interface ContractTemplate { id: string; name: string; contractType: string | null; body: string; isDefault: boolean }
export interface ContractTemplates { variables: Array<{ key: string; label: string }>; templates: ContractTemplate[]; company: Record<string, string> }
export interface PublicContract { title: string; body: string; status: ContractStatus; employeeName: string; companySignerName: string | null; companySignedAt: string | null; signedAt: string | null; signerName: string | null; documentHash: string | null; expiresAt: string | null }

export const employeeProfileService = {
  getSummary: (employeeId: string, signal?: AbortSignal) => api.get<EmployeeSummary>(`/hr/employees/${employeeId}/summary`, { signal }),
  getAccounts: (employeeId: string, signal?: AbortSignal) => api.get<PaymentAccount[]>(`/hr/employees/${employeeId}/payment-accounts`, { signal }),
  createAccount: (employeeId: string, data: PaymentAccountInput) => api.post<PaymentAccount>(`/hr/employees/${employeeId}/payment-accounts`, data),
  updateAccount: (employeeId: string, accountId: string, data: Partial<PaymentAccountInput>) => api.patch<PaymentAccount>(`/hr/employees/${employeeId}/payment-accounts/${accountId}`, data),
  getPayments: (employeeId: string, params: { kind?: string; from?: string; to?: string; page?: number } = {}, signal?: AbortSignal) => api.get<PaymentHistory>(`/hr/employees/${employeeId}/payments`, { params, signal }),
  recordPayment: (employeeId: string, data: { kind: PaymentKind; amount: number; currency: string; paidAt?: string; reference?: string; notes?: string; accountId?: string }) => api.post<EmployeePayment>(`/hr/employees/${employeeId}/payments`, data),
  getBonusPlans: (employeeId: string, signal?: AbortSignal) => api.get<BonusPlan[]>(`/hr/employees/${employeeId}/bonus-plans`, { signal }),
  createBonusPlan: (employeeId: string, data: BonusPlanInput) => api.post<BonusPlan>(`/hr/employees/${employeeId}/bonus-plans`, data),
  updateBonusPlan: (employeeId: string, planId: string, data: Partial<BonusPlanInput> & { isActive?: boolean }) => api.patch<BonusPlan>(`/hr/employees/${employeeId}/bonus-plans/${planId}`, data),
  getLeavePolicy: (signal?: AbortSignal) => api.get<LeavePolicy>('/hr/leave-policy', { signal }),
  saveLeavePolicy: (data: Partial<LeavePolicy>) => api.put<LeavePolicy>('/hr/leave-policy', data),
  getMyLeave: (signal?: AbortSignal) => api.get<MyLeaveContext>('/hr/my/leave', { signal }),
  requestMyLeave: (data: { leaveType: string; startDate: string; endDate?: string; reason?: string }) => api.post<LeaveRequestRow>('/hr/my/leave', data),
  getContractTemplates: (signal?: AbortSignal) => api.get<ContractTemplates>('/hr/contract-templates', { signal }),
  saveContractTemplate: (data: { name: string; body: string; contractType?: string | null; isDefault?: boolean }, id?: string) => (id ? api.put<ContractTemplate>(`/hr/contract-templates/${id}`, data) : api.post<ContractTemplate>('/hr/contract-templates', data)),
  getContracts: (employeeId: string, signal?: AbortSignal) => api.get<Contract[]>(`/hr/employees/${employeeId}/contracts`, { signal }),
  generateContract: (employeeId: string, data: { templateId?: string; company?: Record<string, string> }) => api.post<Contract>(`/hr/employees/${employeeId}/contracts`, data),
  getContract: (contractId: string, signal?: AbortSignal) => api.get<Contract>(`/hr/contracts/${contractId}`, { signal }),
  updateContract: (contractId: string, data: { body: string; title?: string }) => api.patch<Contract>(`/hr/contracts/${contractId}`, data),
  companySign: (contractId: string) => api.post<Contract>(`/hr/contracts/${contractId}/company-sign`, {}),
  sendContract: (contractId: string) => api.post<{ url: string; expiresAt: string; sentTo: string | null }>(`/hr/contracts/${contractId}/send`, {}),
  cancelContract: (contractId: string) => api.post<Contract>(`/hr/contracts/${contractId}/cancel`, {}),
  getAccessAssets: (employeeId: string, signal?: AbortSignal) => api.get<AccessAssets>(`/hr/employees/${employeeId}/access-assets`, { signal }),
  getAssignableAssets: (signal?: AbortSignal) => api.get<AssignableAsset[]>('/hr/assets/assignable', { signal }),
  assignAsset: (employeeId: string, assetId: string) => api.post<{ assetId: string }>(`/hr/employees/${employeeId}/assets`, { assetId }),
  releaseAsset: (employeeId: string, assetId: string) => api.delete<{ assetId: string }>(`/hr/employees/${employeeId}/assets/${assetId}`),
  getFiles: (employeeId: string, signal?: AbortSignal) => api.get<EmployeeFile[]>(`/hr/employees/${employeeId}/files`, { signal }),
  createFile: (employeeId: string, data: { title: string; type: string; fileUrl: string; expiryDate?: string }) => api.post<EmployeeFile>(`/hr/employees/${employeeId}/files`, data),
  getFileUrl: (employeeId: string, documentId: string) => api.get<{ url: string }>(`/hr/employees/${employeeId}/files/${documentId}/url`),
  deleteFile: (employeeId: string, documentId: string) => api.delete<{ id: string }>(`/hr/employees/${employeeId}/files/${documentId}`),
  getExpiringFiles: (signal?: AbortSignal) => api.get<Array<EmployeeFile & { employeeName: string }>>('/hr/documents/expiring', { signal }),
  getBirthdays: (month?: number, signal?: AbortSignal) => api.get<{ month: number; items: Birthday[] }>('/hr/birthdays', { params: month ? { month } : {}, signal }),
  getUpcomingBirthdays: (days = 30, signal?: AbortSignal) => api.get<Birthday[]>('/hr/birthdays/upcoming', { params: { days }, signal }),
  getCardDesign: (signal?: AbortSignal) => api.get<{ design: CardDesign; configured: boolean; company: { name: string; logo: string | null } }>('/hr/card-design', { signal }),
  saveCardDesign: (data: Partial<CardDesign>) => api.put<CardDesign>('/hr/card-design', data),
  getCardData: (employeeIds: string[]) => api.post<CardData>('/hr/employees/card-data', { employeeIds }),
  getPublicContract: (token: string, signal?: AbortSignal) => api.get<PublicContract>(`/public/contracts/${token}`, { signal }),
  signPublicContract: (token: string, data: { signerName: string; accept: boolean; signatureData?: string }) => api.post<{ signedAt: string; documentHash: string }>(`/public/contracts/${token}/sign`, data),
};

export const LEAVE_TYPE_LABEL: Record<string, string> = { VACATION: 'Vacaciones', SICK: 'Enfermedad', PERSONAL: 'Permiso personal', MATERNITY: 'Maternidad', PATERNITY: 'Paternidad', UNPAID: 'Sin goce de salario', BEREAVEMENT: 'Duelo', OTHER: 'Otro' };
export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = { PAYROLL: 'Nómina', BONUS: 'Bono', COMMISSION: 'Comisión', AGUINALDO: 'Aguinaldo', SETTLEMENT: 'Liquidación', OTHER: 'Otro' };
export const BONUS_TYPE_LABEL: Record<string, string> = { ATTENDANCE: 'Asistencia', PUNCTUALITY: 'Puntualidad', PRODUCTIVITY: 'Producción', PERFORMANCE: 'Desempeño', TRANSPORT: 'Transporte', FOOD: 'Alimentación', SEASONAL: 'Temporada', OTHER: 'Otro' };
export const BONUS_FREQUENCY_LABEL: Record<BonusFrequency, string> = { ONCE: 'Una sola vez', WEEKLY: 'Cada semana', BIWEEKLY: 'Cada dos semanas', MONTHLY: 'Cada mes', MONTHLY_SPREAD: 'Cada mes, repartido en cada pago' };
export const WEEKDAY_LABEL = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const ACCOUNT_TYPE_LABEL: Record<string, string> = { SAVINGS: 'Ahorro', CHECKING: 'Corriente', WALLET: 'Billetera móvil', OTHER: 'Otra' };
export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = { DRAFT: 'Borrador', SENT: 'Enviado a firmar', SIGNED: 'Firmado', EXPIRED: 'Enlace vencido', CANCELLED: 'Cancelado' };

export interface AccessAssets {
  employeeId: string;
  access: { hasUser: false } | { hasUser: true; email: string; role: string; userType: string; isActive: boolean; lastLoginAt: string | null; customRole: string | null; modules: string[]; permissionModules: string[] };
  assets: Array<{ id: string; code: string; name: string; category: string; brand: string | null; model: string | null; serialNumber: string | null; status: string; location: string | null; acquisitionDate: string | null; cost: number; currency: string }>;
}
export interface AssignableAsset { id: string; code: string; name: string; category: string; brand: string | null; model: string | null; serialNumber: string | null }
export type FileStatus = 'EXPIRED' | 'EXPIRING' | 'VALID' | 'NO_EXPIRY';
export interface EmployeeFile { id: string; employeeId: string; title: string; type: string; uploadedAt: string; expiryDate: string | null; status: FileStatus; isStored: boolean }
export interface Birthday { employeeId: string; name: string; day: number; month: number; turnsAge: number | null; daysUntil: number; isToday: boolean; position: string | null; department: string | null }
export type CardLayout = 'CLASSIC' | 'MODERN' | 'VERTICAL' | 'BOLD' | 'MINIMAL' | 'CORPORATE';
export type CardFont = 'SANS' | 'SERIF' | 'ROUNDED' | 'MONO' | 'CONDENSED';
export interface CardDesign { layout: CardLayout; primaryColor: string; accentColor: string; textColor: string; showQr: boolean; showPhoto: boolean; showDepartment: boolean; fontFamily: CardFont; qrLinkTemplate: string | null; footerText: string | null; backText: string | null }
export interface CardEmployee { id: string; number: string; firstName: string; lastName: string; position: string | null; department: string | null; photo: string | null; hireDate: string; active: boolean; nationalIdLast4: string | null; qr: string }
export interface CardData { design: CardDesign; company: { name: string; logo: string | null }; employees: CardEmployee[] }

export const DOCUMENT_TYPE_LABEL: Record<string, string> = { CONTRACT: 'Contrato', ID: 'Cédula o identificación', CV: 'Hoja de vida', DEGREE: 'Título', CERTIFICATE: 'Certificado o licencia', MEDICAL: 'Constancia médica', INSS: 'INSS', POLICE_RECORD: 'Antecedentes', REFERENCE: 'Referencia', OTHER: 'Otro' };
export const FILE_STATUS_LABEL: Record<FileStatus, { label: string; tone: string }> = {
  EXPIRED: { label: 'Vencido', tone: 'bg-red-100 text-red-900' }, EXPIRING: { label: 'Por vencer', tone: 'bg-amber-100 text-amber-900' },
  VALID: { label: 'Vigente', tone: 'bg-emerald-100 text-emerald-900' }, NO_EXPIRY: { label: 'Sin vencimiento', tone: 'bg-slate-100 text-slate-700' },
};
export const ASSET_CATEGORY_LABEL: Record<string, string> = { BUILDING: 'Edificio', VEHICLE: 'Vehículo', OFFICE_FURNITURE: 'Mobiliario', COMPUTER_EQUIPMENT: 'Equipo de cómputo', MACHINERY: 'Maquinaria', OTHER: 'Otro' };
