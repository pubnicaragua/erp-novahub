import { api } from './api';

export type QaStatus = 'FUNCIONAL' | 'PARCIAL' | 'FALLIDO' | 'PENDIENTE';
export type QaRunSource = 'API' | 'E2E' | 'MANUAL';

export interface QaStepResult {
  index: number;
  ok: boolean | null;
  message?: string;
  checkedAt?: string;
}

export interface QaStep {
  label: string;
  auto?: { type: 'endpoint' | 'count'; method?: string; path?: string; model?: string; min?: number };
}

export interface QaCheck {
  id: string;
  moduleKey: string;
  moduleLabel?: string;
  viewKey: string;
  actionKey: string;
  title: string;
  description?: string;
  scenarioSteps: QaStep[];
  expectedResult?: string;
  priority: 'alta' | 'media' | 'baja';
  status: QaStatus;
  progressPct: number;
  stepResults?: QaStepResult[];
  lastRunAt?: string;
  createdAt: string;
  findings?: QaFinding[];
  runs?: QaRun[];
}

export interface QaRun {
  id: string;
  source: QaRunSource;
  stepsOk: number;
  stepsTotal: number;
  result: 'PASS' | 'PARTIAL' | 'FAIL';
  notes?: string;
  evidenceUrl?: string;
  runBy?: string;
  createdAt: string;
}

export interface QaFinding {
  id: string;
  checkId: string;
  severity: 'critica' | 'alta' | 'media' | 'baja';
  description: string;
  screenshotUrl?: string;
  assignee?: string;
  status: 'ABIERTO' | 'EN_PROGRESO' | 'RESUELTO' | 'CERRADO';
  createdBy?: string;
  createdAt: string;
  check?: { title: string; moduleKey: string; viewKey: string; actionKey: string };
}

export interface QaModuleSummary {
  moduleKey: string;
  moduleLabel: string;
  total: number;
  funcional: number;
  parcial: number;
  fallido: number;
  pendiente: number;
  progressPct: number;
  validatedPct: number;
  openFindings: number;
}

export interface QaSummary {
  modules: QaModuleSummary[];
  global: {
    total: number;
    funcional: number;
    parcial: number;
    fallido: number;
    pendiente: number;
    progressPct: number;
    validatedPct: number;
    openFindings: number;
  };
  generatedAt: string;
}

export interface AutoVerifyResult {
  checkKey: string;
  title: string;
  stepsOk: number;
  stepsTotal: number;
  details: { index: number; ok: boolean; message: string }[];
}

export const qaService = {
  getChecks: (filters?: { module?: string; status?: string; priority?: string; search?: string }) =>
    api.get<QaCheck[]>('/qa/checks', { params: filters }),
  getSummary: () => api.get<QaSummary>('/qa/summary'),
  getFindings: (status?: string) => api.get<QaFinding[]>('/qa/findings', { params: { status } }),
  runCheck: (id: string, payload: { source: QaRunSource; stepsOk: number; stepsTotal: number; result: 'PASS' | 'PARTIAL' | 'FAIL'; notes?: string; evidenceUrl?: string; stepResults?: QaStepResult[] }) =>
    api.post(`/qa/checks/${id}/run`, payload),
  createFinding: (id: string, payload: { severity: string; description: string; assignee?: string; screenshotUrl?: string }) =>
    api.post(`/qa/checks/${id}/findings`, payload),
  updateFinding: (id: string, payload: { status?: string; assignee?: string }) =>
    api.patch(`/qa/findings/${id}`, payload),
  autoVerify: () => api.post<{ ran: number; results: AutoVerifyResult[] }>('/qa/auto-verify'),
  sync: () => api.post<{ upserted: number; total: number }>('/qa/sync'),
};
