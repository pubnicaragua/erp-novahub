import { api } from './api';
import { resolveStorageReferences } from './storage.service';

export type ProjectStatus = 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ProjectBudgetType = 'COST' | 'INCOME';
export type ProjectCostSource = 'MANUAL' | 'PURCHASE' | 'INVENTORY' | 'PAYROLL' | 'ACTIVITY' | 'OTHER';
export type ProjectCostStatus = 'PENDING' | 'COMMITTED' | 'EXECUTED' | 'CANCELLED';
export type ProjectActivityType = 'COMMENT' | 'ACTIVITY' | 'STATUS_CHANGE' | 'BUDGET_CHANGE' | 'COST_CHANGE' | 'MEMBER_ADDED' | 'MEMBER_REMOVED' | 'TASK_COMPLETED' | 'MILESTONE_COMPLETED';

export interface PlannedCurvePoint {
  weekIndex: number;
  periodStart: string;
  plannedPct: number;
}

export interface SeriesPoint {
  weekIndex: number;
  periodLabel: `Semana ${number}`;
  plannedPct: number;
  plannedValue: number;
  earnedPct: number | null;
  earnedValue: number | null;
  actualPct: number | null;
  actualValue: number | null;
}

export interface EvmIndicators {
  bac: number;
  pv: number;
  ev: number | null;
  ac: number;
  cv: number | null;
  sv: number | null;
  cpi: number | null;
  spi: number | null;
  eac: number | null;
  vac: number | null;
  tcpi: number | null;
  consumedPct: number;
  projectedMarginPct: number | null;
}

export interface BudgetByLine {
  costLineId: string | null;
  label: string;
  budget: number;
  committed: number;
  executed: number;
  consumedPct: number;
}

export type EvmResponse =
  | { status: 'NO_BASELINE'; baselineVersion?: number; message?: string }
  | { status: 'NO_EVIDENCE'; baselineVersion: number; curve: SeriesPoint[] }
  | { status: 'OK'; baselineVersion: number; curve: SeriesPoint[]; indicators: EvmIndicators; budgetByLine: BudgetByLine[] };

export interface ProjectCostTemplateLineInput {
  name: string;
  code?: string;
  description?: string;
  unit?: string;
  quantity?: number;
  materiales?: number;
  consumibles?: number;
  manoObra?: number;
  andamiosEquipos?: number;
  fletes?: number;
  viaticos?: number;
  gmMaterial?: number;
  gmInstalacion?: number;
  includeInExposure?: boolean;
  position?: number;
}

export interface ProjectCostTemplateInput {
  name: string;
  description?: string;
  lines: ProjectCostTemplateLineInput[];
}

export interface ProjectCostTemplate {
  id: string;
  name: string;
  description?: string | null;
  isArchived: boolean;
  lines: (Omit<ProjectCostTemplateLineInput, 'code' | 'description' | 'gmMaterial' | 'gmInstalacion'> & {
    id: string;
    code?: string | null;
    description?: string | null;
    gmMaterial?: number | null;
    gmInstalacion?: number | null;
  })[];
}

export interface ProjectDeleteImpact {
  storedImages: number;
  externalLinks: number;
  attachedDocuments: number;
  storedDocuments: number;
  externalDocuments: number;
  executedCosts: number;
  hasExecutedCosts: boolean;
  canDelete: boolean;
  hasStoredFiles: boolean;
  hasDependencies: boolean;
}

export interface ProjectSummary {
  plannedBudget: number;
  plannedIncome: number;
  executedCost: number;
  executedIncome: number;
  committedCost: number;
  available: number;
  varianceAbs: number;
  variancePct: number;
  expectedMargin: number;
  realMargin: number;
  marginDelta: number;
  overBudget: boolean;
  progress: number;
}

export interface ProjectListItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  endDate?: string;
  progress: number;
  currency: string;
  exchangeRate: number;
  plannedBudget: number;
  plannedIncome: number;
  committedCost: number;
  executedCost: number;
  executedIncome: number;
  basePlannedBudget: number;
  basePlannedIncome: number;
  baseCommittedCost: number;
  baseExecutedCost: number;
  baseExecutedIncome: number;
  customerId?: string;
  branchId?: string;
  managerId?: string;
  notes?: string;
  customer?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  manager?: { id: string; name: string } | null;
  _count?: { tasks: number; costs: number; milestones: number; members: number };
  summary: ProjectSummary;
}

export interface ProjectDetail extends ProjectListItem {
  notes?: string;
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  milestones: ProjectMilestone[];
  budgetLines: ProjectBudgetLine[];
  budgetSummary?: Record<string, unknown>;
  costs: ProjectCost[];
  tasks: ProjectTask[];
  documents: ProjectDocument[];
  activities: ProjectActivity[];
}

export interface ProjectTask {
  id: string;
  projectId: string;
  milestoneId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  startDate?: string | null;
  progress: number;
  assignedToId?: string | null;
  completedAt?: string | null;
  assignedTo?: { id: string; name: string } | null;
  milestone?: { id: string; name: string } | null;
}

export type ProjectQuotationStatus = 'DRAFT' | 'IN_PROCESS' | 'COMPLETE' | 'CANCELLED';
export type ProjectSubQuotationStatus = 'PENDING' | 'SENT' | 'SUBMITTED' | 'RECEIVED' | 'COMPLETED_MANUAL' | 'EXPIRED';
export type ProjectSubQuotationOrigin = 'PENDING' | 'SUPPLIER' | 'MANUAL';

export interface ProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  order?: number;
  weight?: number;
  progress?: number;
  startDate?: string | null;
  dueDate?: string | null;
  status: TaskStatus;
  completedAt?: string | null;
  _count?: { tasks: number };
}

export interface ProjectProgressCapture {
  id: string;
  projectId: string;
  milestoneId?: string | null;
  imageUrl: string;
  caption: string;
  capturedAt: string;
  isPublic: boolean;
  milestone?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
}

export interface ProjectPublicLink {
  id: string;
  projectId: string;
  tokenHash: string;
  isActive: boolean;
  expiresAt?: string | null;
  revokedAt?: string | null;
  lastAccessAt?: string | null;
  createdAt: string;
  _count?: { accessLogs: number };
}

export interface ProjectQuotationMaterial {
  id: string;
  quotationId: string;
  code?: string | null;
  description: string;
  quantity: number;
  unit: string;
  specifications?: string | null;
  sortOrder: number;
  offers?: ProjectSubQuotationOffer[];
}

export interface ProjectSubQuotationOffer {
  id: string;
  subQuotationId: string;
  materialId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  deliveryDays?: number | null;
  deliveryTime?: string | null;
  observations?: string | null;
  isQuoted: boolean;
  isSelected: boolean;
  subQuotation?: {
    id: string;
    code: string;
    status: ProjectSubQuotationStatus;
    supplier: { id: string; name: string; ruc?: string | null };
  };
}

export interface ProjectSubQuotation {
  id: string;
  quotationId: string;
  projectId: string;
  supplierId: string;
  code: string;
  status: ProjectSubQuotationStatus;
  origin: ProjectSubQuotationOrigin;
  currency: string;
  tokenHash?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  expiresAt?: string | null;
  revokedAt?: string | null;
  editWindowHours: number;
  submittedAt?: string | null;
  editableUntil?: string | null;
  windowClosedAt?: string | null;
  overwrittenBySupplier: boolean;
  overwrittenAt?: string | null;
  overwriteDismissedAt?: string | null;
  supplierNotes?: string | null;
  internalNotes?: string | null;
  supplier?: {
    id: string;
    code: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    contactName?: string | null;
    ruc?: string | null;
  };
  offers?: ProjectSubQuotationOffer[];
  termsAcceptance?: {
    termsVersion: string;
    acceptedAt: string;
  } | null;
  _count?: { historySnapshots: number };
}

export interface ProjectSubQuotationHistorySnapshot {
  id: string;
  reason: string;
  origin: string;
  snapshot: {
    subtotal?: number;
    total?: number;
    taxAmount?: number;
    offers?: Array<{ description?: string; unitPrice?: number; quantity?: number; subtotal?: number }>;
  };
  createdAt: string;
}

export interface ProjectMaterialQuotation {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description?: string | null;
  status: ProjectQuotationStatus;
  currency: string;
  exchangeRate: number;
  quotedSubtotalAmount: number;
  quotedTaxAmount: number;
  quotedTotalAmount: number;
  selectedSubtotalAmount: number;
  selectedTaxAmount: number;
  selectedTotalAmount: number;
  completedAt?: string | null;
  createdAt: string;
  materials?: ProjectQuotationMaterial[];
  subQuotations?: ProjectSubQuotation[];
  _count?: { materials: number; subQuotations: number };
}

export interface QuotationComparison {
  quotationId: string;
  code: string;
  name: string;
  currency: string;
  status: ProjectQuotationStatus;
  quotedTotalAmount: number;
  selectedTotalAmount: number;
  comparison: {
    materialId: string;
    code?: string | null;
    description: string;
    unit: string;
    quantity: number;
    offers: {
      id: string;
      subQuotationId: string;
      supplierName: string;
      supplierId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      deliveryDays?: number | null;
      deliveryTime?: string | null;
      observations?: string | null;
      isQuoted: boolean;
      isSelected: boolean;
      isSuggestedLowestPrice: boolean;
    }[];
  }[];
}

export interface ProjectBudgetLine {
  id: string;
  projectId: string;
  type: ProjectBudgetType;
  category: string;
  concept: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  baseAmount: number;
  notes?: string | null;
}

export interface ProjectCost {
  id: string;
  projectId: string;
  concept: string;
  category: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  baseAmount: number;
  costDate: string;
  supplierId?: string | null;
  documentReference?: string | null;
  source: ProjectCostSource;
  sourceId?: string | null;
  status: ProjectCostStatus;
  recordedById?: string | null;
  observation?: string | null;
  supplier?: { id: string; name: string } | null;
  recordedBy?: { id: string; name: string } | null;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  role: string;
  isPrimary: boolean;
  user: { id: string; name: string; email: string };
}

export interface ProjectDocument {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  folder?: string | null;
}

export interface ProjectActivity {
  id: string;
  type: ProjectActivityType;
  description: string;
  createdAt: string;
  recordedBy?: { id: string; name: string } | null;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProjectReport {
  project: { id: string; code: string; name: string; status: ProjectStatus; priority: Priority; startDate: string; endDate?: string; progress: number; currency: string };
  summary: ProjectSummary;
  baseCurrency: string;
  tasks: { total: number; byStatus: Record<string, number>; overdue: number; upcoming: number };
  milestones: { total: number; completed: number };
  members: number;
  costsByCategory: Record<string, number>;
  alerts: { overdueTasks: number; overBudget: boolean; delayed: boolean; upcomingDeadlines: number };
}

export interface ProjectListQuery {
  search?: string;
  status?: ProjectStatus;
  priority?: Priority;
  managerId?: string;
  customerId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  report?: boolean;
  export?: boolean;
}

function qs(params?: Record<string, unknown>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}

const resolveDocs = (rows: ProjectDocument[]) =>
  Array.isArray(rows) ? resolveStorageReferences(rows) : Promise.resolve([]);

export const projectsService = {
  list: async (params?: ProjectListQuery, signal?: AbortSignal): Promise<Paginated<ProjectListItem>> => {
    const data = await api.get(`/projects${qs(params as any)}`, { signal }) as Paginated<ProjectListItem>;
    return data;
  },
  get: async (id: string, signal?: AbortSignal): Promise<ProjectDetail> => {
    const data = await api.get(`/projects/${id}`, { signal }) as ProjectDetail;
    data.documents = await resolveDocs(data.documents || []);
    return data;
  },
  create: async (payload: Partial<any>): Promise<ProjectListItem> => {
    return api.idempotentPost('/projects', payload) as Promise<ProjectListItem>;
  },
  update: async (id: string, payload: Partial<any>): Promise<ProjectListItem> => {
    return api.patch(`/projects/${id}`, payload) as Promise<ProjectListItem>;
  },
  remove: async (id: string, cascadeFiles = false) =>
    api.delete(`/projects/${id}${cascadeFiles ? '?cascadeFiles=true' : ''}`),

  getDeleteImpact: async (id: string): Promise<ProjectDeleteImpact> =>
    api.get(`/projects/${id}/delete-impact`),

  // Tareas
  tasks: async (projectId: string, signal?: AbortSignal): Promise<ProjectTask[]> => {
    return api.get(`/projects/${projectId}/tasks`, { signal }) as Promise<ProjectTask[]>;
  },
  createTask: async (projectId: string, payload: Partial<any>): Promise<ProjectTask> => {
    return api.post(`/projects/${projectId}/tasks`, payload) as Promise<ProjectTask>;
  },
  updateTask: async (projectId: string, taskId: string, payload: Partial<any>): Promise<ProjectTask> => {
    return api.patch(`/projects/${projectId}/tasks/${taskId}`, payload) as Promise<ProjectTask>;
  },
  completeTask: async (projectId: string, taskId: string): Promise<ProjectTask> => {
    return api.post(`/projects/${projectId}/tasks/${taskId}/complete`, {}) as Promise<ProjectTask>;
  },
  deleteTask: async (projectId: string, taskId: string) => api.delete(`/projects/${projectId}/tasks/${taskId}`),

  // Hitos
  milestones: async (projectId: string, signal?: AbortSignal): Promise<ProjectMilestone[]> => {
    return api.get(`/projects/${projectId}/milestones`, { signal }) as Promise<ProjectMilestone[]>;
  },
  createMilestone: async (projectId: string, payload: Partial<any>): Promise<ProjectMilestone> => {
    return api.post(`/projects/${projectId}/milestones`, payload) as Promise<ProjectMilestone>;
  },
  updateMilestone: async (projectId: string, milestoneId: string, payload: Partial<any>): Promise<ProjectMilestone> => {
    return api.patch(`/projects/${projectId}/milestones/${milestoneId}`, payload) as Promise<ProjectMilestone>;
  },
  deleteMilestone: async (projectId: string, milestoneId: string) => api.delete(`/projects/${projectId}/milestones/${milestoneId}`),

  // Cronograma
  timeline: async (projectId: string, signal?: AbortSignal) => api.get(`/projects/${projectId}/timeline`, { signal }),

  // Presupuesto
  budget: async (projectId: string, signal?: AbortSignal) => api.get(`/projects/${projectId}/budget`, { signal }),
  createBudgetLine: async (projectId: string, payload: Partial<any>) => api.post(`/projects/${projectId}/budget`, payload),
  updateBudgetLine: async (projectId: string, lineId: string, payload: Partial<any>) => api.patch(`/projects/${projectId}/budget/${lineId}`, payload),
  deleteBudgetLine: async (projectId: string, lineId: string) => api.delete(`/projects/${projectId}/budget/${lineId}`),

  // Costos
  costs: async (projectId: string, params?: Partial<any>, signal?: AbortSignal): Promise<Paginated<ProjectCost>> => {
    return api.get(`/projects/${projectId}/costs${qs(params)}`, { signal }) as Promise<Paginated<ProjectCost>>;
  },
  createCost: async (projectId: string, payload: Partial<any>): Promise<ProjectCost> => {
    return api.post(`/projects/${projectId}/costs`, payload) as Promise<ProjectCost>;
  },
  updateCost: async (projectId: string, costId: string, payload: Partial<any>): Promise<ProjectCost> => {
    return api.patch(`/projects/${projectId}/costs/${costId}`, payload) as Promise<ProjectCost>;
  },
  deleteCost: async (projectId: string, costId: string) => api.delete(`/projects/${projectId}/costs/${costId}`),

  // Miembros
  members: async (projectId: string, signal?: AbortSignal): Promise<ProjectMember[]> => {
    return api.get(`/projects/${projectId}/members`, { signal }) as Promise<ProjectMember[]>;
  },
  addMember: async (projectId: string, payload: Partial<any>) => api.post(`/projects/${projectId}/members`, payload),
  removeMember: async (projectId: string, memberId: string) => api.delete(`/projects/${projectId}/members/${memberId}`),

  // Actividades / documentos
  activities: async (projectId: string, signal?: AbortSignal): Promise<ProjectActivity[]> => {
    return api.get(`/projects/${projectId}/activities`, { signal }) as Promise<ProjectActivity[]>;
  },
  addActivity: async (projectId: string, payload: Partial<any>) => api.post(`/projects/${projectId}/activities`, payload),
  documents: async (projectId: string, signal?: AbortSignal): Promise<ProjectDocument[]> => {
    const rows = await api.get(`/projects/${projectId}/documents`, { signal }) as ProjectDocument[];
    return resolveDocs(rows);
  },
  registerDocument: async (projectId: string, payload: Partial<any>) => api.post(`/projects/${projectId}/documents`, payload),
  removeDocument: async (projectId: string, documentId: string) => api.delete(`/projects/${projectId}/documents/${documentId}`),

  // Reporte / contabilidad
  report: async (projectId: string, signal?: AbortSignal): Promise<ProjectReport> => {
    return api.get(`/projects/${projectId}/report`, { signal }) as Promise<ProjectReport>;
  },
  generateJournal: async (projectId: string, costId: string) => api.post(`/projects/${projectId}/costs/${costId}/journal`, {}),
  dependenciesCount: async (projectId: string, signal?: AbortSignal) => api.get(`/projects/${projectId}/dependencies-count`, { signal }),

  // ==================== MGP: HITOS PONDERADOS ====================
  updateMilestoneWeight: async (projectId: string, milestoneId: string, payload: { weight?: number; progress?: number; order?: number }) =>
    api.patch(`/projects/${projectId}/milestones/${milestoneId}/weight`, payload),

  // ==================== MGP: CAPTURAS DE AVANCE ====================
  captures: async (projectId: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<ProjectProgressCapture[]> =>
    api.get(`/projects/${projectId}/captures${qs(params)}`, { signal }) as Promise<ProjectProgressCapture[]>,
  createCapture: async (projectId: string, payload: { imageUrl: string; caption: string; milestoneId?: string; isPublic?: boolean }): Promise<ProjectProgressCapture> =>
    api.post(`/projects/${projectId}/captures`, payload) as Promise<ProjectProgressCapture>,
  deleteCapture: async (projectId: string, captureId: string) =>
    api.delete(`/projects/${projectId}/captures/${captureId}`),

  // ==================== MGP: ENLACES PÚBLICOS DE CLIENTE ====================
  publicLinks: async (projectId: string, signal?: AbortSignal): Promise<ProjectPublicLink[]> =>
    api.get(`/projects/${projectId}/public-links`, { signal }) as Promise<ProjectPublicLink[]>,
  createPublicLink: async (projectId: string, payload?: { expiresAt?: Date; revokeExisting?: boolean }): Promise<{ id: string; token: string; url: string; expiresAt?: string }> =>
    api.post(`/projects/${projectId}/public-links`, payload || {}) as Promise<{ id: string; token: string; url: string; expiresAt?: string }>,
  revokePublicLink: async (projectId: string, linkId: string) =>
    api.post(`/projects/${projectId}/public-links/${linkId}/revoke`, {}),

  // ==================== MGP: COTIZACIONES DE MATERIALES ====================
  materialQuotations: async (projectId: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<ProjectMaterialQuotation[]> =>
    api.get(`/projects/${projectId}/material-quotations${qs(params)}`, { signal }) as Promise<ProjectMaterialQuotation[]>,
  materialQuotation: async (projectId: string, quotationId: string, signal?: AbortSignal): Promise<ProjectMaterialQuotation> =>
    api.get(`/projects/${projectId}/material-quotations/${quotationId}`, { signal }) as Promise<ProjectMaterialQuotation>,
  createMaterialQuotation: async (projectId: string, payload: Record<string, unknown>): Promise<ProjectMaterialQuotation> =>
    api.idempotentPost(`/projects/${projectId}/material-quotations`, payload) as Promise<ProjectMaterialQuotation>,
  addQuotationMaterials: async (projectId: string, quotationId: string, materials: Array<Record<string, unknown>>) =>
    api.post(`/projects/${projectId}/material-quotations/${quotationId}/materials`, { materials }),
  deleteQuotationMaterial: async (projectId: string, quotationId: string, materialId: string) =>
    api.delete(`/projects/${projectId}/material-quotations/${quotationId}/materials/${materialId}`),

  createSubQuotation: async (projectId: string, quotationId: string, payload: { supplierId: string; materialIds?: string[]; expiresAt?: Date; editWindowHours?: number }): Promise<{ subQuotation: ProjectSubQuotation; token: string; publicPath: string }> =>
    api.idempotentPost(`/projects/${projectId}/material-quotations/${quotationId}/subquotations`, payload) as Promise<{ subQuotation: ProjectSubQuotation; token: string; publicPath: string }>,
  regenerateSubQuotationLink: async (projectId: string, quotationId: string, subId: string): Promise<{ token: string; publicPath: string }> =>
    api.post(`/projects/${projectId}/material-quotations/${quotationId}/subquotations/${subId}/regenerate-link`, {}) as Promise<{ token: string; publicPath: string }>,
  manualFillSubQuotation: async (projectId: string, quotationId: string, subId: string, payload: { offers: Array<{ materialId: string; unitPrice: number; quantity?: number; deliveryDays?: number }>; taxAmount?: number; internalNotes?: string }): Promise<ProjectSubQuotation> =>
    api.idempotentPost(`/projects/${projectId}/material-quotations/${quotationId}/subquotations/${subId}/manual-fill`, payload) as Promise<ProjectSubQuotation>,
  dismissOverwrite: async (projectId: string, quotationId: string, subId: string) =>
    api.patch(`/projects/${projectId}/material-quotations/${quotationId}/subquotations/${subId}/dismiss-overwrite`, {}),
  subQuotationHistory: async (projectId: string, quotationId: string, subId: string, signal?: AbortSignal): Promise<ProjectSubQuotationHistorySnapshot[]> =>
    api.get(`/projects/${projectId}/material-quotations/${quotationId}/subquotations/${subId}/history`, { signal }) as Promise<ProjectSubQuotationHistorySnapshot[]>,

  quotationComparison: async (projectId: string, quotationId: string, signal?: AbortSignal): Promise<QuotationComparison> =>
    api.get(`/projects/${projectId}/material-quotations/${quotationId}/comparison`, { signal }) as Promise<QuotationComparison>,
  selectOffers: async (projectId: string, quotationId: string, payload: { selectedOfferIds?: string[]; autoSelectLowest?: boolean }): Promise<ProjectMaterialQuotation> =>
    api.patch(`/projects/${projectId}/material-quotations/${quotationId}/select-offers`, payload) as Promise<ProjectMaterialQuotation>,

  // ==================== MGP: ENDPOINTS PÚBLICOS ====================
  getPublicProjectProgress: async (token: string, signal?: AbortSignal): Promise<any> =>
    api.get(`/public-access/project-progress/${encodeURIComponent(token)}`, { signal }),
  getPublicSubQuotation: async (token: string, signal?: AbortSignal): Promise<any> =>
    api.get(`/public-access/subquotation/${encodeURIComponent(token)}`, { signal }),
  acceptSupplierTerms: async (token: string, payload?: { termsVersion?: string }) =>
    api.post(`/public-access/subquotation/${encodeURIComponent(token)}/accept-terms`, payload || {}),
  submitSupplierOffer: async (token: string, payload: { offers: Array<{ materialId: string; unitPrice: number; deliveryDays?: number; deliveryTime?: string; observations?: string }>; taxAmount?: number; supplierNotes?: string }) =>
    api.post(`/public-access/subquotation/${encodeURIComponent(token)}/submit`, payload),

  // ==================== CONFIGURACIÓN DE PROYECTOS ====================
  /* eslint-disable @typescript-eslint/no-explicit-any */
  getTenantConfig: async (signal?: AbortSignal): Promise<any> =>
    api.get('/projects/config', { signal }),
  updateTenantConfig: async (data: any): Promise<any> =>
    api.patch('/projects/config', data),

  // ==================== MOTOR DE PRECIOS POR PROYECTO ====================
  getCalculationMemory: async <T>(id: string, signal?: AbortSignal): Promise<{ data: T | null; updatedAt: string | null }> =>
    api.get(`/projects/${id}/calculation-memory`, { signal }) as Promise<{ data: T | null; updatedAt: string | null }>,
  saveCalculationMemory: async <T>(id: string, data: T): Promise<{ data: T; updatedAt: string }> =>
    api.patch(`/projects/${id}/calculation-memory`, data) as Promise<{ data: T; updatedAt: string }>,

  getProjectPricingEngine: async (id: string, signal?: AbortSignal): Promise<any> =>
    api.get(`/projects/${id}/pricing-engine`, { signal }),
  updateProjectPricingEngine: async (id: string, data: any): Promise<any> =>
    api.patch(`/projects/${id}/pricing-engine`, data),
  syncProjectPricingEngine: async (id: string): Promise<any> =>
    api.post(`/projects/${id}/pricing-engine/sync`, {}),

  // ==================== COSTEO 6D PERSISTENTE ====================
  getCostLines: async (id: string, signal?: AbortSignal): Promise<any[]> =>
    api.get(`/projects/${id}/costing/lines`, { signal }) as Promise<any[]>,
  createCostLine: async (id: string, data: any): Promise<any> =>
    api.post(`/projects/${id}/costing/lines`, data),
  updateCostLine: async (id: string, lineId: string, data: any): Promise<any> =>
    api.patch(`/projects/${id}/costing/lines/${lineId}`, data),
  deleteCostLine: async (id: string, lineId: string): Promise<void> =>
    api.delete(`/projects/${id}/costing/lines/${lineId}`) as Promise<void>,
  reorderCostLines: async (id: string, lineIds: string[]): Promise<any[]> =>
    api.post(`/projects/${id}/costing/lines/reorder`, { lineIds }) as Promise<any[]>,
  getCostTemplates: async (signal?: AbortSignal): Promise<ProjectCostTemplate[]> =>
    api.get('/projects/cost-templates', { signal }) as Promise<ProjectCostTemplate[]>,
  createCostTemplate: async (data: ProjectCostTemplateInput): Promise<ProjectCostTemplate> =>
    api.post('/projects/cost-templates', data) as Promise<ProjectCostTemplate>,
  updateCostTemplate: async (templateId: string, data: Partial<ProjectCostTemplateInput> & { isArchived?: boolean }): Promise<ProjectCostTemplate> =>
    api.patch(`/projects/cost-templates/${templateId}`, data) as Promise<ProjectCostTemplate>,
  applyCostTemplate: async (id: string, templateId: string, overwrite = false): Promise<any[]> =>
    api.post(`/projects/${id}/costing/apply-template`, { templateId, overwrite }) as Promise<any[]>,
  getCostBaselines: async (id: string, signal?: AbortSignal): Promise<any[]> =>
    api.get(`/projects/${id}/costing/baselines`, { signal }) as Promise<any[]>,
  approveCostBaseline: async (id: string, pricingSnapshot: any): Promise<any> =>
    api.post(`/projects/${id}/costing/baselines`, { pricingSnapshot }),
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // ==================== CONTROL EVM ====================
  getEvm: async (id: string, granularity: 'daily' | 'weekly' | 'monthly' = 'weekly', signal?: AbortSignal): Promise<EvmResponse> =>
    api.get<EvmResponse>(`/projects/${id}/evm?granularity=${granularity}`, { signal }),
  getEvmCurve: async (id: string, signal?: AbortSignal): Promise<{ baselineVersion: number; points: PlannedCurvePoint[] }> =>
    api.get<{ baselineVersion: number; points: PlannedCurvePoint[] }>(`/projects/${id}/evm/curve`, { signal }),
  updateEvmCurve: async (id: string, points: PlannedCurvePoint[]): Promise<unknown> =>
    api.patch<unknown>(`/projects/${id}/evm/curve`, { points }),
  recordProgress: async (id: string, payload: { physicalProgressPct: number; note?: string }): Promise<unknown> =>
    api.post<unknown>(`/projects/${id}/evm/progress`, payload),
};


