import { api } from './api';
import { resolveStorageReferences } from './storage.service';

export type ProjectStatus = 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ProjectBudgetType = 'COST' | 'INCOME';
export type ProjectCostSource = 'MANUAL' | 'PURCHASE' | 'INVENTORY' | 'PAYROLL' | 'ACTIVITY' | 'OTHER';
export type ProjectCostStatus = 'PENDING' | 'COMMITTED' | 'EXECUTED' | 'CANCELLED';
export type ProjectActivityType = 'COMMENT' | 'ACTIVITY' | 'STATUS_CHANGE' | 'BUDGET_CHANGE' | 'COST_CHANGE' | 'MEMBER_ADDED' | 'MEMBER_REMOVED' | 'TASK_COMPLETED' | 'MILESTONE_COMPLETED';

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

export interface ProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  dueDate?: string | null;
  status: TaskStatus;
  completedAt?: string | null;
  _count?: { tasks: number };
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
    return api.post('/projects', payload) as Promise<ProjectListItem>;
  },
  update: async (id: string, payload: Partial<any>): Promise<ProjectListItem> => {
    return api.patch(`/projects/${id}`, payload) as Promise<ProjectListItem>;
  },
  remove: async (id: string) => api.delete(`/projects/${id}`),

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
};