import { api } from './api';

// ───────────── Preguntas por hora ─────────────
export type CheckinAudience = 'ALL' | 'SELECTED';

export interface CheckinConfig {
  enabled: boolean;
  audience: CheckinAudience;
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  weekdays: number[];
  breakStart: string | null;
  breakEnd: string | null;
  responseMinutes: number;
  notifySupervisor: boolean;
  skipOnLeave: boolean;
}

export interface CheckinUserSetting {
  userId: string;
  enabled: boolean;
  intervalMinutes: number | null;
  responseMinutes: number | null;
  startTime: string | null;
  endTime: string | null;
}

export interface CheckinConfigResponse {
  config: CheckinConfig;
  userSettings: CheckinUserSetting[];
  users: Array<{ id: string; name: string; email: string }>;
}

export interface PendingCheckin {
  id: string;
  scheduledFor: string;
  dueAt: string;
  source: 'SCHEDULED' | 'MANUAL';
  overdue: boolean;
}

export interface PendingCheckinsResponse {
  prompts: PendingCheckin[];
  tasks: Array<{ id: string; title: string; estimatedMinutes: number | null; status: string }>;
}

export interface CheckinResponseInput {
  workingOn: string;
  activityIds?: string[];
  remainingMinutes?: number | null;
  blockers?: string | null;
}

export type CheckinStatus = 'PENDING' | 'ANSWERED' | 'MISSED';

export interface CheckinPromptRow {
  id: string;
  userId: string;
  userName: string;
  scheduledFor: string;
  dueAt: string;
  source: 'SCHEDULED' | 'MANUAL';
  status: CheckinStatus;
  overdue: boolean;
  answeredAt: string | null;
  workingOn: string | null;
  activityIds: string[];
  remainingMinutes: number | null;
  blockers: string | null;
  rating: number | null;
  ratingComment: string | null;
  ratedById: string | null;
}

export interface CheckinPage {
  total: number;
  page: number;
  pageSize: number;
  items: CheckinPromptRow[];
}

export interface CheckinSummary {
  total: number;
  answered: number;
  missed: number;
  late: number;
  awaitingRating: number;
  rated: number;
  open: number;
  responseRate: number | null;
  averageRating: number | null;
  compliance: number | null;
}

export interface CheckinSummaryResponse {
  from: string;
  to: string;
  overall: CheckinSummary;
  people: Array<CheckinSummary & { userId: string; name: string }>;
}

// ───────────── Línea de tiempo ─────────────
export interface TimelineCheckin {
  id: string;
  scheduledFor: string;
  status: CheckinStatus;
  answeredAt: string | null;
  workingOn: string | null;
  remainingMinutes: number | null;
  blockers: string | null;
  rating: number | null;
  ratingComment: string | null;
}

export interface TimelineHour {
  hour: number;
  label: string;
  checkins: TimelineCheckin[];
  workedMinutes: number;
  tasksCompleted: Array<{ id: string; title: string }>;
  opportunities: Array<{ id: string; name: string }>;
  visits: Array<{ id: string; name: string }>;
  messages: number;
  invoices: { count: number; amount: number };
  hasActivity: boolean;
}

export interface DayTotals {
  workedMinutes: number;
  tasksCompleted: number;
  opportunities: number;
  visits: number;
  messages: number;
  invoices: number;
  invoiceAmount: number;
  checkinsAnswered: number;
  checkinsMissed: number;
}

export interface DayTimeline {
  user: { id: string; name: string };
  timeZone: string;
  date: string;
  hours: TimelineHour[];
  totals: DayTotals;
}

export interface RangeTimeline {
  user: { id: string; name: string };
  timeZone: string;
  days: Array<DayTotals & { date: string; firstActivity: string | null; lastActivity: string | null; activeHours: number }>;
}

export interface TeamHourly {
  date: string;
  timeZone: string;
  hours: Array<{ hour: number; label: string; opportunities: number; visits: number; messages: number; invoices: number; invoiceAmount: number; checkinsAnswered: number; checkinsMissed: number; workedMinutes: number }>;
  totals: { opportunities: number; visits: number; messages: number; invoices: number; invoiceAmount: number; workedMinutes: number };
  members: Array<DayTotals & { userId: string; name: string; opportunitiesByHour: number[]; activeHours: number }>;
}

// ───────────── Metas y bonos ─────────────
export type GoalMetric = 'SALES_AMOUNT' | 'OPPORTUNITIES' | 'VISITS' | 'MESSAGES_SENT' | 'TASKS_COMPLETED' | 'HOURS_LOGGED' | 'CHECKIN_COMPLIANCE' | 'MANUAL';
export type GoalLevel = 'MIN' | 'TARGET' | 'STRETCH';
export type GoalScope = 'USER' | 'DEPARTMENT' | 'COMPANY';
export type GoalPeriodType = 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
export type GoalPace = 'MET' | 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'MISSED';
export type GoalUnit = 'AMOUNT' | 'COUNT' | 'HOURS' | 'PERCENT';

export interface GoalMetricInfo { key: GoalMetric; label: string; unit: GoalUnit; automatic: boolean }

export interface GoalEvaluation {
  value: number;
  percentOfTarget: number;
  level: GoalLevel | null;
  nextLevel: GoalLevel | null;
  remainingToNext: number | null;
  elapsedPercent: number;
  pace: GoalPace;
}

export interface BonusRule { level: GoalLevel; amount: number; currency: string; requiresApproval: boolean }
export type BonusStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  metric: GoalMetric;
  metricLabel: string;
  unit: GoalUnit;
  automatic: boolean;
  scopeType: GoalScope;
  userId: string | null;
  departmentId: string | null;
  periodType: GoalPeriodType;
  periodStart: string;
  periodEnd: string;
  minValue: number | null;
  targetValue: number;
  stretchValue: number | null;
  currency: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  evaluation: GoalEvaluation;
  bonusRules: BonusRule[];
  awards: Array<{ id: string; userId: string; level: GoalLevel; amount: number; currency: string; status: BonusStatus }>;
}

export interface GoalInput {
  title: string;
  description?: string | null;
  metric: GoalMetric;
  scopeType: GoalScope;
  userId?: string | null;
  departmentId?: string | null;
  periodType: GoalPeriodType;
  startDate: string;
  endDate?: string;
  minValue?: number | null;
  targetValue: number;
  stretchValue?: number | null;
  currency?: string | null;
  bonusRules?: Array<Omit<BonusRule, 'currency'> & { currency?: string }>;
}

export interface BonusAward {
  id: string;
  goalId: string;
  goalTitle: string;
  metric: GoalMetric;
  periodStart: string;
  periodEnd: string;
  userId: string;
  userName: string;
  level: GoalLevel;
  amount: number;
  currency: string;
  achievedValue: number;
  status: BonusStatus;
  decidedById: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  payrollId: string | null;
}

export const performanceService = {
  // Preguntas por hora: configuración
  getCheckinConfig: (signal?: AbortSignal) => api.get<CheckinConfigResponse>('/performance/checkins/config', { signal }),
  saveCheckinConfig: (data: Partial<CheckinConfig>) => api.put<CheckinConfig>('/performance/checkins/config', data),
  saveCheckinUserSetting: (userId: string, data: Partial<Omit<CheckinUserSetting, 'userId'>>) => api.put<CheckinUserSetting>(`/performance/checkins/users/${userId}`, data),
  deleteCheckinUserSetting: (userId: string) => api.delete<{ removed: number }>(`/performance/checkins/users/${userId}`),
  // La persona responde
  getPendingCheckins: (signal?: AbortSignal) => api.get<PendingCheckinsResponse>('/performance/checkins/pending', { signal }),
  respondCheckin: (id: string, data: CheckinResponseInput) => api.post<CheckinPromptRow>(`/performance/checkins/${id}/respond`, data),
  // Supervisión
  getCheckins: (params: Record<string, string | number | undefined>, signal?: AbortSignal) => api.get<CheckinPage>('/performance/checkins', { params, signal }),
  getCheckinSummary: (params: Record<string, string | undefined>, signal?: AbortSignal) => api.get<CheckinSummaryResponse>('/performance/checkins/summary', { params, signal }),
  rateCheckin: (id: string, data: { rating: number; comment?: string }) => api.post<CheckinPromptRow>(`/performance/checkins/${id}/rate`, data),
  askNow: (data: { userIds: string[]; responseMinutes?: number }) => api.post<{ asked: number }>('/performance/checkins/ask', data),
  // Línea de tiempo
  getDayTimeline: (params: { userId?: string; date?: string }, signal?: AbortSignal) => api.get<DayTimeline>('/performance/timeline/day', { params, signal }),
  getRangeTimeline: (params: { userId?: string; from: string; to: string }, signal?: AbortSignal) => api.get<RangeTimeline>('/performance/timeline/range', { params, signal }),
  getTeamHourly: (params: { date?: string }, signal?: AbortSignal) => api.get<TeamHourly>('/performance/timeline/team', { params, signal }),
  // Metas y bonos
  getGoalMetrics: (signal?: AbortSignal) => api.get<GoalMetricInfo[]>('/performance/goals/metrics', { signal }),
  getMyGoals: (signal?: AbortSignal) => api.get<Goal[]>('/performance/goals/mine', { signal }),
  getGoals: (params: { status?: string; userId?: string; metric?: string }, signal?: AbortSignal) => api.get<Goal[]>('/performance/goals', { params, signal }),
  createGoal: (data: GoalInput) => api.post<Goal>('/performance/goals', data),
  updateGoal: (id: string, data: Partial<GoalInput>) => api.patch<Goal>(`/performance/goals/${id}`, data),
  archiveGoal: (id: string) => api.post<{ id: string; status: string }>(`/performance/goals/${id}/archive`, {}),
  restoreGoal: (id: string) => api.post<{ id: string; status: string }>(`/performance/goals/${id}/restore`, {}),
  getGoalEntries: (id: string, signal?: AbortSignal) => api.get<Array<{ id: string; value: number; note: string | null; createdAt: string }>>(`/performance/goals/${id}/entries`, { signal }),
  addGoalEntry: (id: string, data: { value: number; note?: string }) => api.post<{ id: string }>(`/performance/goals/${id}/entries`, data),
  setBonusRules: (id: string, rules: BonusRule[]) => api.put<Goal>(`/performance/goals/${id}/bonus-rules`, { rules }),
  getBonuses: (params: { status?: string; userId?: string }, signal?: AbortSignal) => api.get<BonusAward[]>('/performance/bonuses', { params, signal }),
  syncBonuses: () => api.post<{ checked: number; created: number; updated: number }>('/performance/bonuses/sync', {}),
  decideBonus: (id: string, decision: 'APPROVE' | 'REJECT', note?: string) => api.post<{ id: string; status: BonusStatus }>(`/performance/bonuses/${id}/decision`, { decision, note }),
};
