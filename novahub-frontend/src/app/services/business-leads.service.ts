import { api } from './api';

export type LeadStage = 'IDENTIFIED' | 'CONTACTED' | 'MEETING' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';
export type LeadHealth = 'OK' | 'DUE_TODAY' | 'OVERDUE' | 'STALE' | 'NO_ACTION' | 'CLOSED';
export type LeadSource = 'REFERRAL' | 'SOCIAL' | 'EVENT' | 'WALK_IN' | 'COLD' | 'WEB' | 'OTHER';
export type ContactKind = 'CLIENT' | 'PARTNER' | 'SUPPLIER' | 'FRIEND' | 'OTHER';
export type IntroStatus = 'IDEA' | 'REQUESTED' | 'INTRODUCED' | 'DECLINED';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ActivityKind = 'NOTE' | 'CALL' | 'VISIT' | 'WHATSAPP' | 'EMAIL' | 'MEETING' | 'STAGE';
/** Montos por moneda: nunca se suman monedas distintas. */
export type MoneyByCurrency = Record<string, number>;

export interface LeadRow {
  id: string; company: string; contactName: string | null; contactRole: string | null; phone: string | null; email: string | null; businessLine: string | null; country: string | null; website: string | null;
  source: LeadSource; stage: LeadStage; stageLabel: string; estimatedValue: number | null; currency: string; probability: number; weighted: number; expectedCloseDate: string | null;
  nextAction: string | null; nextActionAt: string | null; lostReason: string | null; ownerUserId: string | null; ownerName: string | null; createdById: string | null;
  introducedByContactId: string | null; introducedBy?: { id: string; name: string } | null; health: LeadHealth; lastActivityAt: string; createdAt: string; closedAt: string | null;
  industry: string | null; audienceSize: number | null; signals: string[]; sourceUrl: string | null; reviewStatus: ReviewStatus; fitScore: number | null; fitReason: string | null;
  budgetEstimate: number | null; budgetSource: 'ESTIMATED' | 'MANUAL' | null;
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
  industry?: string | null; audienceSize?: number | null; signals?: string[]; sourceUrl?: string | null; budgetEstimate?: number | null; allowDuplicate?: boolean;
}

export interface LeadOffer {
  id: string; name: string; description: string | null; industries: string[]; signals: string[]; minPrice: number; maxPrice: number; currency: string; materialUrl: string | null; sortOrder: number; active: boolean;
}
export interface OfferSuggestion { offerId: string; name: string; materialUrl: string | null; currency: string; suggestedPrice: number; approvalBelow: number; negotiationRoom: number; match: number; reasons: string[] }
export interface OfferAttempt { id: string; offerName: string; price: number; currency: string; outcome: 'PROPOSED' | 'ACCEPTED' | 'DECLINED'; reason: string | null; createdAt: string }
export interface OfferAdvice {
  leadId: string; budget: { amount: number; source: 'ESTIMATED' | 'MANUAL'; reason: string }; fit: { score: number | null; reason: string | null };
  primary: OfferSuggestion | null; alternatives: OfferSuggestion[]; expansions: OfferSuggestion[]; downshift: boolean; declined: Array<{ name: string; price: number }>; excludedByBudget: string[]; message: string; history: OfferAttempt[];
}
export interface DiscountRequest {
  id: string; leadId: string; offerName: string; minPrice: number; requestedPrice: number; currency: string; reason: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; requestedByName: string | null;
  decisionNote: string | null; createdAt: string; lead?: { id: string; company: string };
}
export interface IngestKey { id: string; name: string; prefix: string; active: boolean; lastUsedAt: string | null; createdAt: string; revokedAt: string | null; userName: string | null }
export interface SellerProfile { dailyGoal?: number; focusIndustries: string[]; focusCountries: string[]; offerIds: string[]; notes: string | null }
export interface LeadGoalSettings {
  dailyGoal: number; warnAt: string; closeAt: string; timezone: string; goalUserIds: string[]; sellerProfiles: Record<string, SellerProfile | null>; users: Array<{ id: string; name: string }>;
  companyPitch: string | null; idealClient: string | null; tone: 'USTED' | 'TU'; landingUrl: string | null;
}
export interface PlanTask {
  id: string; kind: 'SEARCH' | 'SOCIAL' | 'FOLLOWUP' | 'REVIEW'; title: string; why: string; prompt: string | null; links: Array<{ label: string; url: string }>;
  chatgptUrl: string | null; claudeUrl: string | null; action: 'REVIEW' | 'FOLLOWUPS' | null;
}
export interface DailyPlan { headline: string; remaining: number; tasks: PlanTask[]; progress: { count: number; goal: number; phase: 'BEFORE' | 'WARN' | 'CLOSED'; minutesToClose: number } }
export interface PasteResult {
  created: number; items: Array<{ id: string; company: string; fitScore: number | null }>; duplicates: Array<{ row: number; company: string; existingCompany: string; why: string }>;
  errors: Array<{ row: number; message: string }>; skipped: number; verified: number;
}
export interface SearchItem {
  placeId: string; name: string; address: string | null; rating: number | null; reviews: number | null; mapsUrl: string | null; signals: string[]; fitScore: number; fitReason: string; closed: boolean; webProblems: string[];
  duplicate: { id: string; company: string; why: string } | null; ready: boolean; lead: LeadInput;
}
export interface SearchResult { query: string; city: string; country: string; remainingToday: number; summary: { total: number; ready: number; closed: number; duplicates: number }; items: SearchItem[] }
export interface SearchProfile {
  id: string; name: string; query: string; city: string; country: string; ownerUserId: string; ownerName: string | null; frequencyDays: number; maxResults: number; active: boolean; lastRunAt: string | null; lastFound: number;
}
export interface AssistantMessage { id: string; role: 'USER' | 'ASSISTANT'; content: string; createdAt: string }
export interface GoalProgress {
  day: string; phase: 'BEFORE' | 'WARN' | 'CLOSED'; minutesToClose: number; warnAt: string; closeAt: string; people: Array<{ userId: string; name: string; count: number; goal: number; met: boolean }>;
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
  listReview: (signal?: AbortSignal) => api.get<{ total: number; items: LeadRow[] }>('/sales/leads/review', { signal }),
  review: (id: string, data: { decision: 'approve' | 'reject'; reason?: string }) => api.post<LeadDetail>(`/sales/leads/${id}/review`, data),
  offers: (signal?: AbortSignal) => api.get<LeadOffer[]>('/sales/leads/offers', { signal }),
  createOffer: (data: Partial<LeadOffer>) => api.post<LeadOffer>('/sales/leads/offers', data),
  updateOffer: (id: string, data: Partial<LeadOffer>) => api.patch<LeadOffer>(`/sales/leads/offers/${id}`, data),
  removeOffer: (id: string) => api.delete<{ id: string; deactivated: boolean }>(`/sales/leads/offers/${id}`),
  advice: (id: string, signal?: AbortSignal) => api.get<OfferAdvice>(`/sales/leads/${id}/offers`, { signal }),
  recordOffer: (id: string, data: { offerId?: string; offerName?: string; price: number; outcome?: 'PROPOSED' | 'ACCEPTED' | 'DECLINED'; reason?: string }) => api.post<OfferAdvice>(`/sales/leads/${id}/offers`, data),
  requestDiscount: (id: string, data: { offerId: string; price: number; reason: string }) => api.post<DiscountRequest>(`/sales/leads/${id}/discount-request`, data),
  discounts: (status?: string, signal?: AbortSignal) => api.get<DiscountRequest[]>('/sales/leads/discounts', { params: status ? { status } : {}, signal }),
  decideDiscount: (id: string, data: { decision: 'approve' | 'reject'; note?: string }) => api.post<DiscountRequest>(`/sales/leads/discounts/${id}/decision`, data),
  keys: (signal?: AbortSignal) => api.get<IngestKey[]>('/sales/leads/ingest-keys', { signal }),
  createKey: (name: string) => api.post<IngestKey & { key: string }>('/sales/leads/ingest-keys', { name }),
  revokeKey: (id: string) => api.delete<{ id: string }>(`/sales/leads/ingest-keys/${id}`),
  settings: (signal?: AbortSignal) => api.get<LeadGoalSettings>('/sales/leads/settings', { signal }),
  updateSettings: (data: Partial<Omit<LeadGoalSettings, 'users'>>) => api.patch<LeadGoalSettings>('/sales/leads/settings', data),
  progress: (signal?: AbortSignal) => api.get<GoalProgress>('/sales/leads/progress', { signal }),
  plan: (signal?: AbortSignal) => api.get<DailyPlan>('/sales/leads/plan', { signal }),
  pasteResults: (text: string, verifyWebsites = true) => api.post<PasteResult>('/sales/leads/paste-results', { text, verifyWebsites }),
  searchPlaces: (data: { query: string; city: string; country?: string; limit?: number }) => api.post<SearchResult>('/sales/leads/search', data),
  bulkCreatePending: (leads: LeadInput[]) => api.post<{ created: number; errors: Array<{ row: number; message: string }> }>('/sales/leads/bulk?review=pending', { leads }),
  searches: (signal?: AbortSignal) => api.get<SearchProfile[]>('/sales/leads/searches', { signal }),
  createSearch: (data: Partial<SearchProfile>) => api.post<SearchProfile>('/sales/leads/searches', data),
  updateSearch: (id: string, data: Partial<SearchProfile>) => api.patch<SearchProfile>(`/sales/leads/searches/${id}`, data),
  removeSearch: (id: string) => api.delete<{ id: string }>(`/sales/leads/searches/${id}`),
  runSearch: (id: string) => api.post<{ found: number; saved: number; duplicates: number; closed: number }>(`/sales/leads/searches/${id}/run`, {}),
  assistantHistory: (leadId?: string | null, signal?: AbortSignal) => api.get<AssistantMessage[]>('/sales/leads/assistant', { params: leadId ? { leadId } : {}, signal }),
  assistantChat: (message: string, leadId?: string | null) => api.post<AssistantMessage>('/sales/leads/assistant', { message, leadId: leadId || undefined }),
  assistantClear: (leadId?: string | null) => api.delete<{ deleted: number }>(`/sales/leads/assistant${leadId ? `?leadId=${encodeURIComponent(leadId)}` : ''}`),
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
export const SIGNAL_LABEL: Record<string, string> = {
  ASKED_SOFTWARE: 'Busca software o una empresa como la nuestra', REFERRED: 'Llegó por referido', MANUAL_PAYROLL: 'Lleva planilla o contabilidad a mano', MULTI_LOCATION: 'Tiene varias sedes',
  SELLS_PRODUCTS: 'Vende productos', BIG_AUDIENCE: 'Comunidad grande en redes', NO_WEBSITE: 'No tiene sitio web', OLD_WEBSITE: 'Sitio web viejo o roto', NO_SOCIAL_AUTOMATION: 'Responde las redes a mano', CLOSED: 'El negocio está cerrado',
};
export const OUTCOME_LABEL: Record<OfferAttempt['outcome'], string> = { PROPOSED: 'Propuesta', ACCEPTED: 'Aceptó', DECLINED: 'Dijo que no' };
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
