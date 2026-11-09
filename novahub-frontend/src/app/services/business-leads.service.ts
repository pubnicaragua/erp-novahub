import { api } from './api';

export type LeadStage = 'IDENTIFIED' | 'CONTACTED' | 'MEETING' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';
export type LeadHealth = 'OK' | 'DUE_TODAY' | 'OVERDUE' | 'STALE' | 'NO_ACTION' | 'CLOSED';
export type LeadSource = 'REFERRAL' | 'SOCIAL' | 'EVENT' | 'WALK_IN' | 'COLD' | 'WEB' | 'OTHER';
export type ContactKind = 'CLIENT' | 'PARTNER' | 'SUPPLIER' | 'FRIEND' | 'OTHER';
export type IntroStatus = 'IDEA' | 'REQUESTED' | 'INTRODUCED' | 'DECLINED';
export type ActivityKind = 'NOTE' | 'CALL' | 'VISIT' | 'WHATSAPP' | 'EMAIL' | 'MEETING' | 'STAGE';
/** Montos por moneda: nunca se suman monedas distintas. */
export type MoneyByCurrency = Record<string, number>;

export interface LeadRow {
  id: string; company: string; contactName: string | null; contactRole: string | null; phone: string | null; email: string | null; businessLine: string | null; country: string | null; website: string | null;
  source: LeadSource; stage: LeadStage; stageLabel: string; estimatedValue: number | null; currency: string; probability: number; weighted: number; expectedCloseDate: string | null;
  nextAction: string | null; nextActionAt: string | null; lostReason: string | null; ownerUserId: string | null; ownerName: string | null; createdById: string | null;
  introducedByContactId: string | null; introducedBy?: { id: string; name: string } | null; health: LeadHealth; lastActivityAt: string; createdAt: string; closedAt: string | null;
}
export interface LeadActivity { id: string; kind: ActivityKind; message: string; createdAt: string; userName: string }
export interface LeadDetail extends LeadRow { strategy: string | null; activities: LeadActivity[]; introducedBy: NetworkContactRow | null }
export interface LeadsSummary {
  total: number; open: number; pipeline: MoneyByCurrency; weighted: MoneyByCurrency; wonThisMonth: MoneyByCurrency;
  byStage: Record<LeadStage, { count: number; value: MoneyByCurrency }>;
  followUps: { overdue: number; today: number; noAction: number; stale: number };
  businessLines: Array<{ name: string; count: number }>;
  countries: Array<{ name: string; count: number; pipeline: MoneyByCurrency }>;
  team?: Array<{ userId: string; name: string; open: number; addedToday: number; added7d: number; overdue: number }>;
}
export interface LeadInput {
  company?: string; contactName?: string | null; contactRole?: string | null; phone?: string | null; email?: string | null; businessLine?: string | null; country?: string | null; website?: string | null; source?: LeadSource;
  estimatedValue?: number | null; currency?: string; probability?: number; expectedCloseDate?: string | null; nextAction?: string | null; nextActionAt?: string | null;
  strategy?: string | null; ownerUserId?: string | null; introducedByContactId?: string | null; stage?: LeadStage;
}

export interface NetworkIntroduction { id: string; contactId: string; targetName: string; targetCompany: string | null; note: string | null; status: IntroStatus; leadId: string | null; createdAt: string }
export interface NetworkContactRow {
  id: string; name: string; company: string | null; role: string | null; phone: string | null; email: string | null; kind: ContactKind; customerId: string | null; strength: number; notes: string | null;
}
export interface NetworkContact extends NetworkContactRow {
  leads: Array<{ id: string; company: string; stage: LeadStage; estimatedValue: number | null; currency: string }>;
  introductions: NetworkIntroduction[]; pipeline: MoneyByCurrency; won: MoneyByCurrency;
}
export interface NetworkOverview {
  contacts: NetworkContact[]; customerCandidates: Array<{ id: string; name: string; contactName: string | null }>;
  summary: { contacts: number; openIdeas: number; introduced: number };
}

export const businessLeadsService = {
  getCapabilities: (signal?: AbortSignal) => api.get<{ enabled: boolean; canManageAll: boolean }>('/sales/leads/capabilities', { signal }),
  list: (params: { stage?: string; health?: string; search?: string; owner?: string; businessLine?: string; country?: string } = {}, signal?: AbortSignal) => api.get<{ summary: LeadsSummary; items: LeadRow[] }>('/sales/leads', { params, signal }),
  bulkCreate: (leads: LeadInput[]) => api.post<{ created: number; errors: Array<{ row: number; message: string }> }>('/sales/leads/bulk', { leads }),
  get: (id: string, signal?: AbortSignal) => api.get<LeadDetail>(`/sales/leads/${id}`, { signal }),
  create: (data: LeadInput) => api.post<LeadDetail>('/sales/leads', data),
  update: (id: string, data: LeadInput) => api.patch<LeadDetail>(`/sales/leads/${id}`, data),
  changeStage: (id: string, data: { stage: LeadStage; reason?: string }) => api.post<LeadDetail>(`/sales/leads/${id}/stage`, data),
  addActivity: (id: string, data: { kind: ActivityKind; message: string; nextAction?: string | null; nextActionAt?: string | null }) => api.post<LeadDetail>(`/sales/leads/${id}/activities`, data),
  network: (signal?: AbortSignal) => api.get<NetworkOverview>('/sales/leads/network', { signal }),
  createContact: (data: Partial<NetworkContactRow>) => api.post<NetworkContactRow>('/sales/leads/network/contacts', data),
  contactFromCustomer: (customerId: string) => api.post<NetworkContactRow>(`/sales/leads/network/contacts/from-customer/${customerId}`, {}),
  updateContact: (id: string, data: Partial<NetworkContactRow>) => api.patch<NetworkContactRow>(`/sales/leads/network/contacts/${id}`, data),
  removeContact: (id: string) => api.delete<{ id: string }>(`/sales/leads/network/contacts/${id}`),
  addIntroduction: (contactId: string, data: { targetName: string; targetCompany?: string; note?: string }) => api.post<NetworkIntroduction>(`/sales/leads/network/contacts/${contactId}/introductions`, data),
  updateIntroduction: (id: string, data: { status?: IntroStatus; note?: string }) => api.patch<NetworkIntroduction>(`/sales/leads/network/introductions/${id}`, data),
  removeIntroduction: (id: string) => api.delete<{ id: string }>(`/sales/leads/network/introductions/${id}`),
  convertIntroduction: (id: string, data: Partial<LeadInput> = {}) => api.post<LeadDetail>(`/sales/leads/network/introductions/${id}/convert`, data),
};

export const STAGES: Array<{ id: LeadStage; label: string; tone: string }> = [
  { id: 'IDENTIFIED', label: 'Identificado', tone: 'bg-slate-100 text-slate-800' },
  { id: 'CONTACTED', label: 'Contactado', tone: 'bg-sky-100 text-sky-900' },
  { id: 'MEETING', label: 'Reunión', tone: 'bg-indigo-100 text-indigo-900' },
  { id: 'PROPOSAL', label: 'Propuesta', tone: 'bg-amber-100 text-amber-900' },
  { id: 'NEGOTIATION', label: 'Negociación', tone: 'bg-orange-100 text-orange-900' },
  { id: 'WON', label: 'Ganado', tone: 'bg-emerald-100 text-emerald-900' },
  { id: 'LOST', label: 'Perdido', tone: 'bg-slate-200 text-slate-600' },
];
export const OPEN_STAGE_IDS: LeadStage[] = ['IDENTIFIED', 'CONTACTED', 'MEETING', 'PROPOSAL', 'NEGOTIATION'];
export const HEALTH_LABEL: Record<LeadHealth, { label: string; tone: string } | null> = {
  OK: null, CLOSED: null, OVERDUE: { label: 'Atrasado', tone: 'bg-red-100 text-red-900' }, DUE_TODAY: { label: 'Hoy', tone: 'bg-amber-100 text-amber-900' },
  NO_ACTION: { label: 'Sin siguiente paso', tone: 'bg-orange-100 text-orange-900' }, STALE: { label: 'Frío', tone: 'bg-sky-100 text-sky-900' },
};
export const SOURCE_LABEL: Record<LeadSource, string> = { REFERRAL: 'Referido', SOCIAL: 'Redes sociales', EVENT: 'Evento', WALK_IN: 'Visita', COLD: 'Contacto en frío', WEB: 'Sitio web', OTHER: 'Otro' };
export const CONTACT_KIND_LABEL: Record<ContactKind, string> = { CLIENT: 'Cliente', PARTNER: 'Aliado', SUPPLIER: 'Proveedor', FRIEND: 'Conocido', OTHER: 'Otro' };
export const INTRO_LABEL: Record<IntroStatus, { label: string; tone: string }> = {
  IDEA: { label: 'Idea', tone: 'bg-slate-100 text-slate-800' }, REQUESTED: { label: 'Pedida', tone: 'bg-amber-100 text-amber-900' },
  INTRODUCED: { label: 'Concretada', tone: 'bg-emerald-100 text-emerald-900' }, DECLINED: { label: 'Rechazada', tone: 'bg-slate-200 text-slate-600' },
};
export const ACTIVITY_LABEL: Record<ActivityKind, string> = { NOTE: 'Nota', CALL: 'Llamada', VISIT: 'Visita', WHATSAPP: 'WhatsApp', EMAIL: 'Correo', MEETING: 'Reunión', STAGE: 'Cambio de etapa' };
export const formatMoney = (amount: number, currency: string) => `${currency} ${new Intl.NumberFormat('es-NI', { maximumFractionDigits: 0 }).format(amount)}`;
export const formatMoneyMap = (map: MoneyByCurrency | undefined) => {
  const entries = Object.entries(map ?? {}).filter(([, value]) => value);
  return entries.length ? entries.map(([currency, amount]) => formatMoney(amount, currency)).join(' · ') : '—';
};
