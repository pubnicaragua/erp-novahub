import { api } from './api';

export interface LegalCase {
  id: string;
  clientTenantId: string;
  number: string;
  type: string;
  description: string;
  urgency: 'NORMAL' | 'URGENT' | 'VERY_URGENT';
  desiredDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'WAITING_DOCS' | 'COMPLETED' | 'CANCELLED';
  assignedTo?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  notes: LegalNote[];
  documents: LegalDocument[];
}

export interface LegalNote {
  id: string;
  caseId: string;
  content: string;
  isInternal: boolean;
  createdBy: string;
  createdAt: string;
}

export interface LegalDocument {
  id: string;
  caseId: string;
  name: string;
  url: string;
  type?: string;
  createdAt: string;
}

export interface LegalReminder {
  id: string;
  clientTenantId: string;
  title: string;
  description?: string;
  dueDate: string;
  caseId?: string;
  createdAt: string;
}

const CASE_TYPE_LABELS: Record<string, string> = {
  CONSTITUTION: 'Constitución de empresa',
  STATUTE_MODIFICATION: 'Modificación de estatuto',
  NOTARIAL_POWER: 'Poder notarial',
  LEASE_CONTRACT: 'Contrato de arrendamiento',
  WORK_CONTRACT: 'Contrato laboral',
  PURCHASE_SALE_CONTRACT: 'Contrato de compraventa',
  TRADEMARK_REGISTRATION: 'Registro de marca',
  OPERATION_PERMIT: 'Permiso de operación',
  DGI_PROCEDURE: 'Trámite DGI',
  INSS_PROCEDURE: 'Trámite INSS',
  MAYOR_PROCEDURE: 'Trámite Municipal',
  LABOR_CONSULTATION: 'Consulta laboral',
  MERCANTILE_CONSULTATION: 'Consulta mercantil',
  OTHER: 'Otro',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En Proceso',
  WAITING_DOCS: 'Esperando Docs',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const URGENCY_LABELS: Record<string, string> = {
  NORMAL: 'Normal',
  URGENT: 'Urgente',
  VERY_URGENT: 'Muy Urgente',
};

export const legalService = {
  listCases: (type?: string, status?: string) => {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    if (status) params.status = status;
    return api.get<LegalCase[]>('/legal/cases', { params });
  },

  getCase: (id: string) =>
    api.get<LegalCase>(`/legal/cases/${id}`),

  createCase: (dto: {
    type: string;
    description: string;
    urgency?: string;
    desiredDate?: string;
    assignedTo?: string;
  }) =>
    api.post<LegalCase>('/legal/cases', dto),

  updateStatus: (id: string, status: string, assignedTo?: string) =>
    api.patch<LegalCase>(`/legal/cases/${id}/status`, { status, assignedTo }),

  addNote: (caseId: string, content: string, isInternal = false) =>
    api.post<LegalNote>(`/legal/cases/${caseId}/notes`, { content, isInternal }),

  addDocument: (caseId: string, name: string, url: string, type?: string) =>
    api.post<LegalDocument>(`/legal/cases/${caseId}/documents`, { name, url, type }),

  listReminders: () =>
    api.get<LegalReminder[]>('/legal/reminders'),

  createReminder: (dto: { title: string; description?: string; dueDate: string; caseId?: string }) =>
    api.post<LegalReminder>('/legal/reminders', dto),

  deleteReminder: (id: string) =>
    api.delete(`/legal/reminders/${id}`),

  getCaseTypeLabel: (type: string) => CASE_TYPE_LABELS[type] || type,
  getStatusLabel: (status: string) => STATUS_LABELS[status] || status,
  getUrgencyLabel: (urgency: string) => URGENCY_LABELS[urgency] || urgency,
  getStatusColor: (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
      IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
      WAITING_DOCS: 'bg-orange-100 text-orange-700 border-orange-200',
      COMPLETED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  },
  getUrgencyColor: (urgency: string) => {
    const colors: Record<string, string> = {
      NORMAL: 'bg-sky-100 text-sky-700 border-sky-200',
      URGENT: 'bg-amber-100 text-amber-700 border-amber-200',
      VERY_URGENT: 'bg-rose-100 text-rose-700 border-rose-200',
    };
    return colors[urgency] || 'bg-gray-100 text-gray-700';
  },
  CASE_TYPES: Object.entries(CASE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
};
