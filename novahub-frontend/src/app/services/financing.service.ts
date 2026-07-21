import { api } from './api';

export interface FinancingApplication {
  id: string;
  tenantId: string;
  number: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'DISBURSED';
  requestedAmount: number;
  termMonths: number;
  purpose: string;
  guarantees: string[];
  repaymentSource: string;
  monthlyRevenue?: number;
  monthlyExpenses?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  netWorth?: number;
  monthlyCashFlow?: number;
  monthlyPayroll?: number;
  debtRatio?: number;
  hasActiveCredits: boolean;
  activeCreditDetail?: string;
  hasPastDue: boolean;
  pastDueDetail?: string;
  isRucRegistered: boolean;
  hasIrDeclarations: boolean;
  hasDgiDebts: boolean;
  hasInssDebts: boolean;
  fundsDeclaration: boolean;
  references?: any;
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  documents: FinancingDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface FinancingDocument {
  id: string;
  applicationId: string;
  type: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  isRequired: boolean;
  isErpAttached: boolean;
  createdAt: string;
}

export interface PrefillData {
  companyName: string;
  industry: string;
  ruc: string;
  address: string;
  phone: string;
  yearsOfOperation: number;
  legalRepresentative: string;
  legalRepresentativeEmail: string;
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyCashFlow: number | null;
  hasHistoricalData: boolean;
}

export interface PaymentCalculation {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  annualRate: number;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_REVIEW: 'En Revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  DISBURSED: 'Desembolsada',
};

const PURPOSE_LABELS: Record<string, string> = {
  capital_trabajo: 'Capital de trabajo',
  compra_activos: 'Compra de activos fijos',
  expansion: 'Expansión del negocio',
  pago_deudas: 'Pago de deudas',
  compra_inventario: 'Compra de inventario',
  mejoras_local: 'Mejoras al local',
  otro: 'Otro',
};

const GUARANTEE_LABELS: Record<string, string> = {
  hipotecaria: 'Hipotecaria',
  prendaria: 'Prendaria',
  fianza_personal: 'Fianza personal',
  codeudor: 'Codeudor',
  sin_garantia: 'Sin garantía',
};

export const financingService = {
  list: () =>
    api.get<FinancingApplication[]>('/financing/applications'),

  getById: (id: string) =>
    api.get<FinancingApplication>(`/financing/applications/${id}`),

  create: (dto: any) =>
    api.post<FinancingApplication>('/financing/applications', dto),

  updateStatus: (id: string, status: string, reviewNotes?: string) =>
    api.patch<FinancingApplication>(`/financing/applications/${id}/status`, { status, reviewNotes }),

  addDocument: (id: string, doc: { type: string; fileName: string; fileUrl: string; fileSize?: number; isRequired?: boolean }) =>
    api.post(`/financing/applications/${id}/documents`, doc),

  addNote: (id: string, note: string) =>
    api.post(`/financing/applications/${id}/notes`, { note }),

  getPrefill: (tenantId: string) =>
    api.get<PrefillData>(`/financing/prefill/${tenantId}`),

  calculate: (amount: number, termMonths: number, rate?: number) =>
    api.get<PaymentCalculation>('/financing/calculator', {
      params: { amount, term: termMonths, rate: rate?.toString() },
    }),

  getStatusLabel: (status: string) => STATUS_LABELS[status] || status,
  getStatusColor: (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
      IN_REVIEW: 'bg-blue-100 text-blue-700 border-blue-200',
      APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      REJECTED: 'bg-rose-100 text-rose-700 border-rose-200',
      DISBURSED: 'bg-purple-100 text-purple-700 border-purple-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  },
  getPurposeLabel: (purpose: string) => PURPOSE_LABELS[purpose] || purpose,
  getGuaranteeLabel: (g: string) => GUARANTEE_LABELS[g] || g,
};
