import { api } from './api';

export type OrgViewMode = 'DAY' | 'WEEK' | 'MONTH' | 'AGENDA';
export type OrgVisibility = 'PRIVATE' | 'AVAILABILITY' | 'TEAM';
export type OrgAccessLevel = 'AVAILABILITY' | 'SHARED_EVENTS' | 'EDIT';
export type WeekDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type WorkingDay = { enabled: boolean; start: string | null; end: string | null };
export type WorkingHours = Record<WeekDayKey, WorkingDay>;

export interface OrgPreferences {
  timezone: string;
  defaultView: OrgViewMode;
  weekStartsOn: 0 | 1 | 6;
  showWeekends: boolean;
  workingHours: WorkingHours;
  visibility: OrgVisibility;
  persisted: boolean;
}

export interface OrgUser { id: string; name: string; email: string; role?: string }

export interface AgendaEvent {
  id: string;
  kind: 'EVENT' | 'MEETING';
  busy: boolean;
  title: string;
  description?: string | null;
  status: string;
  priority?: string;
  location?: string | null;
  startDate: string | null;
  endDate: string | null;
  meetingUrl?: string | null;
  meetingPlatform?: string | null;
  organizerId?: string | null;
  guestCount?: number;
  customFields?: Record<string, string> | null;
}

export interface AgendaTask {
  id: string;
  kind: 'TASK';
  title: string;
  description?: string | null;
  status: string;
  priority?: string;
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  customFields?: Record<string, string> | null;
  assigneeIds: string[];
}

export interface AgendaReminder {
  id: string;
  kind: 'REMINDER';
  title: string;
  description?: string | null;
  reminderDate: string;
  status: string;
  scope: string;
  activityId?: string | null;
}

export interface AgendaResponse {
  ownerUserId: string;
  readOnlyView: boolean;
  range: { from: string; to: string };
  events: AgendaEvent[];
  tasks: AgendaTask[];
  reminders: AgendaReminder[];
}

export interface SharedGuest {
  id: string;
  type: 'INTERNAL' | 'EXTERNAL';
  role: string;
  rsvpStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  name: string;
  email: string | null;
}

export interface SharedEvent {
  id: string;
  kind: 'EVENT' | 'MEETING';
  title: string;
  description?: string | null;
  status: string;
  location?: string | null;
  startDate: string | null;
  endDate: string | null;
  meetingUrl?: string | null;
  meetingPlatform?: string | null;
  organizer: OrgUser | null;
  isOrganizer: boolean;
  myRsvp: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null;
  rsvpCounts: { confirmed: number; pending: number; declined: number };
  guests: SharedGuest[];
}

export interface AccessGrant {
  id: string;
  user: OrgUser;
  level: OrgAccessLevel;
  allowPersonalTaskEdit: boolean;
  createdAt: string;
}

export interface AccessList { granted: AccessGrant[]; received: AccessGrant[] }

type Range = { from: string; to: string };

export type SupervisionScope = 'ALL' | 'USER' | 'DEPARTMENT' | 'ROLE';
export type SupervisionSource = SupervisionScope | 'DEPARTMENT_HEAD' | 'REPORTS_TO';
export interface TeamMember {
  id: string; name: string; email: string; department: string | null; role: string | null;
  sources: SupervisionSource[]; pending: number; overdue: number; completedRecently: number;
  quality: { inReview: number; delivered: number; rejected: number; firstPassRate: number | null; withEstimate: number; overEstimate: number };
}
export interface TeamAgenda {
  range: { from: string; to: string };
  users: OrgUser[];
  events: Array<{ id: string; kind: 'EVENT' | 'MEETING'; title: string; status: string; startDate: string | null; endDate: string | null; location?: string | null; userIds: string[] }>;
  tasks: Array<{ id: string; kind: 'TASK'; title: string; status: string; priority?: string; dueDate: string | null; startDate: string | null; endDate: string | null; userIds: string[] }>;
}
export interface TeamTask {
  id: string; title: string; status: string; priority?: string; dueDate: string | null; createdAt: string;
  assignees: OrgUser[]; trackedMinutes: number; estimatedMinutes: number | null; deviationPct: number | null;
  checklist: { done: number; total: number } | null; rejectedAt: string | null; rejectedReason: string | null;
}
export interface TeamTaskPage { data: TeamTask[]; total: number; page: number; pageSize: number }
export interface SupervisionRule {
  id: string; supervisor: OrgUser; scopeType: SupervisionScope; scopeValue: string; scopeLabel: string; includeSubDepartments: boolean; createdAt: string;
}
export interface RuleTargets { departments: Array<{ id: string; name: string }>; roles: Array<{ id: string; name: string }> }

export const organizacionService = {
  getPreferences: (signal?: AbortSignal) => api.get<OrgPreferences>('/organization/preferences', { signal }),
  updatePreferences: (data: Partial<Omit<OrgPreferences, 'persisted'>>) => api.patch<OrgPreferences>('/organization/preferences', data),
  getAgenda: (params: Range & { ownerUserId?: string }, signal?: AbortSignal) =>
    api.get<AgendaResponse>('/organization/agenda', { params, signal }),
  getViewableOwners: (signal?: AbortSignal) => api.get<OrgUser[]>('/organization/viewable-owners', { signal }),
  getSharedEvents: (params: Range, signal?: AbortSignal) => api.get<SharedEvent[]>('/organization/shared-events', { params, signal }),
  respondRsvp: (eventId: string, rsvpStatus: 'ACCEPTED' | 'DECLINED' | 'PENDING') =>
    api.patch<{ eventId: string; rsvpStatus: string }>(`/organization/shared-events/${eventId}/rsvp`, { rsvpStatus }),
  getUsers: (signal?: AbortSignal) => api.get<OrgUser[]>('/organization/users', { signal }),
  getAccess: (signal?: AbortSignal) => api.get<AccessList>('/organization/access', { signal }),
  grantAccess: (data: { granteeUserId: string; level: OrgAccessLevel; allowPersonalTaskEdit?: boolean }) =>
    api.post<AccessGrant>('/organization/access', data),
  updateAccess: (granteeUserId: string, data: { level?: OrgAccessLevel; allowPersonalTaskEdit?: boolean }) =>
    api.patch<AccessGrant>(`/organization/access/${granteeUserId}`, data),
  revokeAccess: (granteeUserId: string) => api.delete<{ success: boolean }>(`/organization/access/${granteeUserId}`),
  // Equipo (supervisión)
  getTeam: (signal?: AbortSignal) => api.get<TeamMember[]>('/organization/team', { signal }),
  getTeamAgenda: (params: Range & { userIds?: string }, signal?: AbortSignal) => api.get<TeamAgenda>('/organization/team/agenda', { params, signal }),
  getTeamTasks: (params: Record<string, string | number | undefined>, signal?: AbortSignal) => api.get<TeamTaskPage>('/organization/team/tasks', { params, signal }),
  getSupervisionRules: (signal?: AbortSignal) => api.get<SupervisionRule[]>('/organization/team/rules', { signal }),
  getRuleTargets: (signal?: AbortSignal) => api.get<RuleTargets>('/organization/team/rule-targets', { signal }),
  createSupervisionRule: (data: { supervisorUserId: string; scopeType: SupervisionScope; scopeValue?: string; includeSubDepartments?: boolean }) => api.post<{ id: string }>('/organization/team/rules', data),
  deleteSupervisionRule: (id: string) => api.delete<{ success: boolean }>(`/organization/team/rules/${id}`),
};
