import { api } from './api';

export type AuditRisk = 'Alto' | 'Medio' | 'Bajo';
export type AuditClientStatus = 'Activa' | 'Inactiva';

export interface AuditKpi {
  label: string;
  value: string;
  trend: string;
  trendDirection: 'up' | 'down';
  detail: string;
  tone?: 'default' | 'danger';
}

export interface AuditDashboardData {
  kpis: AuditKpi[];
  progressSeries: Array<{ month: string; completed: number; running: number; review: number; planned: number; notStarted: number }>;
  auditDistribution: Array<{ label: string; value: number; color: string }>;
  deadlines: Array<{ date: string; title: string; client: string; days: string; tone: 'danger' | 'warning' | 'neutral' }>;
  engagements: Array<{ code: string; client: string; type: string; period: string; partner: string; status: string; progress: number; closeDate: string }>;
  findingsByArea: Array<{ area: string; total: number; critical: number; width: number; tone: 'danger' | 'warning' | 'success' }>;
  significantRisks: Array<{ risk: string; area: string; level: AuditRisk; engagements: number; status: string }>;
  teamWorkload: Array<{ initials: string; name: string; role: string; utilization: number; tone: 'success' | 'danger' }>;
  recentActivity: Array<{ time: string; actor: string; description: string; client: string; tone: 'success' | 'warning' | 'info' }>;
}

export interface AuditClientContact {
  initials: string;
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface AuditClientEngagement {
  code: string;
  year: string;
  type: string;
  status: string;
  progress: number;
}

export interface AuditClientDocument {
  name: string;
  meta: string;
  status: 'Validado' | 'Por revisar';
}

export interface AuditClient {
  id: string;
  initials: string;
  name: string;
  commercialName: string;
  ruc: string;
  sector: string;
  city: string;
  partner: string;
  risk: AuditRisk;
  status: AuditClientStatus;
  engagements: number;
  docsPending: number;
  personType: 'LEGAL_ENTITY' | 'NATURAL_PERSON';
  regime: string;
  currency: string;
  group: string;
  auditedYears: string;
  lastClose: string;
  riskScore: number;
  address: string;
  website: string;
  contacts: AuditClientContact[];
  engagementList: AuditClientEngagement[];
  documents: AuditClientDocument[];
}

export interface AuditClientsData {
  items: AuditClient[];
  total: number;
  kpis: {
    entities: number;
    active: number;
    withEngagements: number;
    pendingDocuments: number;
    highRisk: number;
  };
}

export interface AuditDashboardParams {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  engagementType?: string;
  officeId?: string;
}

export interface AuditClientsParams {
  search?: string;
  sector?: string;
  city?: string;
  status?: string;
  partner?: string;
  risk?: string;
  page?: number;
  pageSize?: number;
}

export type AuditEngagementStatus = 'Borrador' | 'Aceptación' | 'Planificación' | 'En ejecución' | 'En revisión' | 'Emitido' | 'Archivado';

export interface AuditTeamMember {
  initials: string;
  name: string;
  role: string;
  tone?: 'green' | 'amber' | 'gray';
}

export interface AuditEngagementRow {
  id: string;
  code: string;
  clientId: string;
  client: string;
  type: string;
  period: string;
  partner: string;
  manager: string;
  team: AuditTeamMember[];
  status: AuditEngagementStatus;
  progress: number;
  startDate: string;
  closeDate: string;
  industry: string;
  office: string;
}

export interface AuditEngagementWorkspace {
  engagement: AuditEngagementRow;
  summary: { documents: number; pendingDocuments: number; findings: number; highPriorityFindings: number; risks: number; risksInTreatment: number };
  phases: Array<{ label: string; status: 'complete' | 'active' | 'pending'; progress: number; date: string }>;
  milestones: Array<{ date: string; title: string; detail: string; status: 'complete' | 'active' | 'pending' }>;
  tasks: Array<{ title: string; due: string; priority: 'Alta' | 'Media' | 'Baja'; status: string }>;
  issues: Array<{ title: string; detail: string; tone: 'danger' | 'warning' | 'info'; status: string }>;
  recentActivity: Array<{ date: string; actor: string; detail: string }>;
}

export interface AuditEngagementsData {
  items: AuditEngagementRow[];
  total: number;
  workspace: AuditEngagementWorkspace;
}

export interface AuditAcceptanceData {
  engagement: { code: string; client: string; type: string; period: string; partner: string; ruc: string; industry: string; size: string; location: string };
  result: { title: string; detail: string; criteria: string; conflicts: string; risk: AuditRisk };
  dueDiligence: Array<{ label: string; value: string; tone: 'success' | 'warning' }>;
  risks: Array<{ label: string; level: AuditRisk }>;
  criteria: Array<{ id: number; label: string; category: string; responsible: string; result: 'Completo' | 'Pendiente'; note: string }>;
  independence: Array<{ initials: string; name: string; role: string; status: string; date: string }>;
  conflicts: { title: string; detail: string; checkedAt: string };
  documents: Array<{ name: string; version: string; status: 'Listo' | 'Pendiente' }>;
  approvals: Array<{ step: string; person: string; role: string; status: 'Completado' | 'Pendiente'; date: string }>;
  history: Array<{ version: string; detail: string; actor: string; date: string }>;
}

export interface AuditPlanningData {
  engagement: { code: string; client: string; type: string; period: string; status: string; progress: number };
  metrics: { global: string; execution: string; threshold: string; significantAreas: string; procedures: string };
  objectives: string;
  scope: { included: string[]; excluded: string[] };
  materiality: { base: string; baseAmount: string; globalPercent: string; executionPercent: string; thresholdPercent: string };
  areas: Array<{ area: string; balance: string; percent: string; risk: AuditRisk; significant: boolean }>;
  phases: Array<{ phase: string; start: string; end: string; tone: 'green' | 'amber' | 'gray' }>;
  documents: Array<{ name: string; type: string; status: 'Borrador' | 'En revisión' | 'Aprobado'; date: string }>;
  notes: Array<{ initials: string; author: string; note: string; status: 'Pendiente' | 'Resuelta' }>;
}

export interface AuditAccountingImportData {
  engagement: { code: string; client: string; period: string; status: string; partner: string; reviewer: string };
  kpis: { received: number; valid: number; errors: number; difference: string; currentVersion: string };
  step: 'source' | 'mapping' | 'validation' | 'publication';
  source: { fileName: string; fileSize: string; rows: number; sourceType: string; period: string; sheet: string; timezone: string };
  mapping: Array<{ source: string; target: string; type: string; status: 'OK' | 'Opcional' | 'Falta' }>;
  preview: Array<{ row: number; account: string; concept: string; debit: string; credit: string; status: 'Correcto' | 'Requiere mapeo' }>;
  validations: Array<{ label: string; detail: string; tone: 'success' | 'warning' | 'danger'; progress?: number }>;
  incidents: Array<{ label: string; detail: string; count: number; tone: 'success' | 'warning' | 'danger' }>;
  reconciliation: { debit: string; credit: string; difference: string; duplicates: string; unmapped: string };
  versions: Array<{ version: string; date: string; status: string; rows: string }>;
  impact: Array<{ view: string; action: string }>;
}

export interface AuditTrialBalanceData {
  engagement: { code: string; client: string; period: string; status: string; version: string };
  kpis: { assets: string; liabilities: string; equity: string; adjustments: string; version: string };
  accounts: Array<{ code: string; name: string; debit: string; credit: string; original: string; adjusted: string; review: string; ref: string; level: number }>;
  summaries: Array<{ ref: string; area: string; balance: string; risks: number; papers: number; status: string }>;
  selectedAccount: { code: string; name: string; balance: string; summary: string; risks: number; procedures: number; evidence: number; lastReview: string };
  links: Array<{ code: string; label: string; detail: string }>;
  consistency: Array<{ label: string; value: string; tone: 'success' | 'warning' | 'danger' }>;
}

export interface AuditRiskWorkspaceData {
  engagement: { code: string; client: string; period: string; status: string; version: string };
  kpis: { identified: number; significant: number; controls: number; procedures: number; withoutResponse: number };
  risks: Array<{ id: string; title: string; area: string; assertion: string; score: string; level: 'Crítico' | 'Alto' | 'Medio' | 'Bajo'; procedures: number; status: string }>;
  selectedRisk: { id: string; title: string; area: string; assertion: string; impact: number; probability: number; responsible: string; controls: number; procedures: number; response: string };
  controls: Array<{ code: string; title: string; risk: string; design: string; implementation: string; effectiveness: string }>;
  procedures: Array<{ code: string; title: string; type: string; assertion: string; responsible: string; status: string }>;
  review: { preparedBy: string; reviewer: string; updatedAt: string; status: string };
}

export interface AuditProgramsWorkspaceData {
  engagement: { code: string; client: string; period: string; status: string };
  kpis: { programs: number; procedures: number; executed: number; pendingReview: number; risksWithoutResponse: number };
  programs: Array<{ id: string; code: string; title: string; procedures: number; responsible: string; progress: number; status: string; risks: string[] }>;
  procedures: Array<{ id: string; code: string; title: string; assertion: string; responsible: string; status: string; workpaper: string }>;
  selectedProgram: { code: string; title: string; objective: string; balance: string; materiality: string; procedures: number; risks: string[]; papers: number };
  coverage: Array<{ area: string; covered: string; tone: 'success' | 'warning' | 'danger' }>;
  approvals: Array<{ step: string; person: string; status: string }>;
  library: Array<{ title: string; detail: string }>;
}

export interface AuditSamplingWorkspaceData {
  engagement: { code: string; client: string; period: string; status: string };
  kpis: { population: string; populationValue: string; sampleSize: number; tested: number; exceptions: number };
  plan: { procedure: string; method: string; sampleSize: number; seed: string; universe: string; stratification: string; materiality: string; tolerance: string; highRisk: number; exclusions: number };
  population: Array<{ ref: string; transaction: string; account: string; value: string; date: string; selection: string }>;
  selected: Array<{ ref: string; transaction: string; amount: string; status: string; error: string }>;
  evaluation: { version: string; tested: number; exceptions: number; errorAmount: string; coverage: number; status: string };
  traceability: Array<{ label: string; value: string }>;
}

export interface AuditWorkpapersWorkspaceData {
  engagement: { code: string; client: string; period: string; status: string };
  kpis: { total: number; approved: number; inReview: number; openNotes: number; evidence: number };
  workpapers: Array<{ id: string; code: string; title: string; author: string; status: string; detail: string }>;
  selected: { code: string; title: string; objective: string; version: string; preparedBy: string; reviewedBy: string; status: string; rows: Array<{ label: string; ref: string; mark: string; amount: string }>; conclusion: string };
  evidence: Array<{ name: string; ref: string; status: string }>;
  notes: Array<{ author: string; role: string; note: string; status: string }>;
  approval: { preparer: string; supervisor: string; status: string; version: string };
  traceability: Array<{ label: string; value: string }>;
}

export interface AuditPbcWorkspaceData {
  engagement: { code: string; client: string; period: string; status: string };
  kpis: { requests: number; received: number; review: number; overdue: number; accepted: number };
  requests: Array<{ id: string; title: string; area: string; auditor: string; status: string; due: string; attachments: number }>;
  selected: { id: string; title: string; area: string; status: string; company: string; contact: string; responsible: string; due: string; procedure: string; paper: string; warning: string };
  conversation: Array<{ author: string; text: string; date: string }>;
  sla: Array<{ label: string; date: string; status: string }>;
}

export interface AuditFindingsWorkspaceData {
  engagement: { code: string; client: string; period: string; status: string };
  kpis: { findings: number; misstatements: string; adjustments: number; managementObservations: number };
  findings: Array<{ id: string; title: string; area: string; amount: string; severity: string; status: string }>;
  selected: { id: string; title: string; severity: string; procedure: string; workpaper: string; amount: string; responsible: string; condition: string; evidence: Array<{ name: string; ref: string; status: string }>; response: string };
  adjustments: Array<{ id: string; origin: string; destination: string; debit: string; credit: string; status: string }>;
  communications: Array<{ id: string; title: string; status: string; date: string }>;
}

export interface AuditReviewsWorkspaceData {
  engagement: { code: string; client: string; period: string; status: string };
  kpis: { pending: number; notes: number; approved: number; blocked: number };
  items: Array<{ id: string; code: string; title: string; preparer: string; reviewer: string; priority: string; status: string; notes: number; version: string }>;
  selected: { id: string; code: string; title: string; objective: string; version: string; preparer: string; reviewer: string; evidence: string; conclusion: string };
  notes: Array<{ id: string; code: string; text: string; status: string }>;
  approvalChain: Array<{ role: string; person: string; status: string; date: string }>;
  qualityGates: Array<{ label: string; status: string; detail: string }>;
}

export interface AuditReportsWorkspaceData {
  engagement: { code: string; client: string; period: string; status: string };
  report: { id: string; code: string; title: string; version: string; status: string; opinion: string; framework: string; materiality: string; misstatements: string; content: Array<{ heading: string; body: string }> };
  stages: Array<{ label: string; status: string }>;
  conclusions: Array<{ area: string; status: string; detail: string }>;
  requirements: Array<{ label: string; status: string; detail: string }>;
  authorization: Array<{ role: string; person: string; status: string }>;
}

export interface AuditArchiveWorkspaceData {
  engagement: { code: string; client: string; period: string; status: string };
  kpis: { integrity: string; approved: string; documents: number; followups: number };
  checklist: Array<{ label: string; status: string; detail: string }>;
  inventory: Array<{ code: string; category: string; count: number; status: string }>;
  followups: Array<{ id: string; title: string; owner: string; due: string; status: string }>;
  activity: Array<{ title: string; detail: string; tone: string }>;
  archive: { status: string; retention: string; access: string; manifest: string };
}

const dashboardKpis: AuditKpi[] = [
  { label: 'Auditorías activas', value: '24', trend: '+26%', trendDirection: 'up', detail: 'vs. período anterior' },
  { label: 'En ejecución', value: '11', trend: '+10%', trendDirection: 'up', detail: 'vs. período anterior' },
  { label: 'En revisión', value: '6', trend: '+50%', trendDirection: 'up', detail: 'vs. período anterior' },
  { label: 'Hallazgos críticos', value: '7', trend: '-22%', trendDirection: 'down', detail: 'vs. período anterior', tone: 'danger' },
  { label: 'Informes por emitir', value: '9', trend: '+125%', trendDirection: 'up', detail: 'vs. período anterior' },
  { label: 'Cumplimiento del plan', value: '82.4%', trend: '+6.1 pp', trendDirection: 'up', detail: 'vs. período anterior' },
];

export const DEMO_AUDIT_DASHBOARD: AuditDashboardData = {
  kpis: dashboardKpis,
  progressSeries: [
    { month: 'Ene', completed: 6, running: 8, review: 4, planned: 3, notStarted: 2 },
    { month: 'Feb', completed: 9, running: 10, review: 5, planned: 4, notStarted: 2 },
    { month: 'Mar', completed: 11, running: 8, review: 4, planned: 3, notStarted: 2 },
    { month: 'Abr', completed: 10, running: 9, review: 5, planned: 3, notStarted: 1 },
    { month: 'May', completed: 12, running: 10, review: 5, planned: 3, notStarted: 2 },
    { month: 'Jun', completed: 15, running: 11, review: 6, planned: 4, notStarted: 2 },
    { month: 'Jul', completed: 16, running: 12, review: 6, planned: 4, notStarted: 2 },
    { month: 'Ago', completed: 15, running: 13, review: 6, planned: 4, notStarted: 1 },
    { month: 'Sep', completed: 15, running: 12, review: 5, planned: 4, notStarted: 2 },
    { month: 'Oct', completed: 17, running: 14, review: 6, planned: 5, notStarted: 2 },
    { month: 'Nov', completed: 15, running: 13, review: 5, planned: 4, notStarted: 2 },
    { month: 'Dic', completed: 12, running: 12, review: 5, planned: 4, notStarted: 1 },
  ],
  auditDistribution: [
    { label: 'Financiera', value: 10, color: '#07553c' },
    { label: 'Control interno', value: 5, color: '#2d8a62' },
    { label: 'Cumplimiento', value: 4, color: '#8bcf69' },
    { label: 'Operativa', value: 3, color: '#f2c85b' },
    { label: 'Especial', value: 2, color: '#cbd5d1' },
  ],
  deadlines: [
    { date: '17 OCT', title: 'Entrega de informes', client: 'Comercial Pacífico, S.A.', days: 'En 2 días', tone: 'danger' },
    { date: '21 OCT', title: 'Revisión de calidad', client: 'Grupo Agroexport, S.A.', days: 'En 6 días', tone: 'warning' },
    { date: '28 OCT', title: 'Cierre de papeles de trabajo', client: 'Industria del Norte, S.A.', days: 'En 13 días', tone: 'neutral' },
    { date: '31 OCT', title: 'Reunión de hallazgos', client: 'Servicios Beta, S.A.', days: 'En 16 días', tone: 'warning' },
  ],
  engagements: [
    { code: 'AUD-2025-001', client: 'Comercial Pacífico, S.A.', type: 'Financiera', period: '2025', partner: 'María López', status: 'En ejecución', progress: 68, closeDate: '29 OCT' },
    { code: 'AUD-2025-002', client: 'Industria del Norte, S.A.', type: 'Financiera', period: '2025', partner: 'Carlos Méndez', status: 'Planificación', progress: 31, closeDate: '08 NOV' },
    { code: 'AUD-2025-003', client: 'Grupo Agroexport, S.A.', type: 'Cumplimiento', period: '2025', partner: 'Ana Torres', status: 'En revisión', progress: 91, closeDate: '19 OCT' },
    { code: 'AUD-2025-004', client: 'Servicios Beta, S.A.', type: 'Operativa', period: '2025', partner: 'José Rivera', status: 'En ejecución', progress: 54, closeDate: '04 NOV' },
    { code: 'AUD-2025-005', client: 'Transporte Centro, S.A.', type: 'Control interno', period: '2025', partner: 'Laura Pérez', status: 'En ejecución', progress: 76, closeDate: '21 OCT' },
  ],
  findingsByArea: [
    { area: 'Ingresos', total: 12, critical: 3, width: 94, tone: 'danger' },
    { area: 'Inventarios', total: 9, critical: 1, width: 73, tone: 'warning' },
    { area: 'Cuentas por cobrar', total: 8, critical: 1, width: 65, tone: 'warning' },
    { area: 'Activos fijos', total: 6, critical: 0, width: 49, tone: 'success' },
    { area: 'Cuentas por pagar', total: 5, critical: 1, width: 42, tone: 'warning' },
    { area: 'Gastos', total: 4, critical: 1, width: 34, tone: 'warning' },
    { area: 'Patrimonio', total: 3, critical: 0, width: 25, tone: 'success' },
    { area: 'Otros', total: 2, critical: 0, width: 17, tone: 'success' },
  ],
  significantRisks: [
    { risk: 'Reconocimiento de ingresos', area: 'Ingresos', level: 'Alto', engagements: 5, status: 'En tratamiento' },
    { risk: 'Valoración de inventarios', area: 'Inventarios', level: 'Alto', engagements: 4, status: 'Pendiente' },
    { risk: 'Estimación de provisiones', area: 'Cuentas por cobrar', level: 'Medio', engagements: 3, status: 'En tratamiento' },
    { risk: 'Fraude en pagos', area: 'Cuentas por pagar', level: 'Alto', engagements: 3, status: 'Pendiente' },
    { risk: 'Continuidad del negocio', area: 'General', level: 'Medio', engagements: 2, status: 'Monitoreo' },
  ],
  teamWorkload: [
    { initials: 'ML', name: 'María López', role: 'Socia', utilization: 89, tone: 'success' },
    { initials: 'CM', name: 'Carlos Méndez', role: 'Socio', utilization: 78, tone: 'success' },
    { initials: 'AT', name: 'Ana Torres', role: 'Gerente', utilization: 92, tone: 'danger' },
    { initials: 'JR', name: 'José Rivera', role: 'Gerente', utilization: 64, tone: 'success' },
    { initials: 'LP', name: 'Laura Pérez', role: 'Supervisora', utilization: 71, tone: 'success' },
  ],
  recentActivity: [
    { time: 'Hoy 10:24', actor: 'María López', description: 'actualizó el avance de AUD-2025-001', client: 'Comercial Pacífico, S.A.', tone: 'success' },
    { time: 'Hoy 09:15', actor: 'Carlos Méndez', description: 'agregó un nuevo hallazgo', client: 'Industria del Norte, S.A.', tone: 'warning' },
    { time: 'Ayer 16:42', actor: 'Ana Torres', description: 'completó la revisión de papeles', client: 'Grupo Agroexport, S.A.', tone: 'success' },
    { time: '14 OCT 11:30', actor: 'José Rivera', description: 'subió 5 documentos', client: 'Servicios Beta, S.A.', tone: 'info' },
  ],
};

export const DEMO_AUDIT_CLIENTS: AuditClientsData = {
  total: 148,
  kpis: { entities: 148, active: 126, withEngagements: 64, pendingDocuments: 38, highRisk: 9 },
  items: [
    { id: 'client-01', initials: 'CP', name: 'Comercial Pacífico, S.A.', commercialName: 'Comercial Pacífico', ruc: 'J0310001234567', sector: 'Comercial', city: 'Managua', partner: 'María López', risk: 'Alto', status: 'Activa', engagements: 3, docsPending: 2, personType: 'LEGAL_ENTITY', regime: 'General', currency: 'NIO', group: 'No', auditedYears: '2022 – 2025', lastClose: '31 dic. 2024', riskScore: 72, address: 'Km 4.5 Carretera a Masaya, Managua, Nicaragua', website: 'www.comercialpacifico.com', contacts: [{ initials: 'ML', name: 'María López', role: 'Gerente General', phone: '+505 8888 0101', email: 'mlopez@cpacifico.com' }, { initials: 'JR', name: 'Juan Rivera', role: 'Contador', phone: '+505 8777 0202', email: 'jrivera@cpacifico.com' }, { initials: 'CA', name: 'Carla Aguilar', role: 'Tesorera', phone: '+505 8666 0303', email: 'caguilar@cpacifico.com' }], engagementList: [{ code: 'AUD-2025-001', year: '2025', type: 'Financiera', status: 'En ejecución', progress: 68 }, { code: 'AUD-2024-003', year: '2024', type: 'Financiera', status: 'Emitido', progress: 100 }, { code: 'AUD-2023-009', year: '2023', type: 'Financiera', status: 'Emitido', progress: 100 }, { code: 'AUD-2022-004', year: '2022', type: 'Financiera', status: 'Emitido', progress: 100 }], documents: [{ name: 'Escritura constitutiva', meta: 'PDF · 2.4 MB · 2022', status: 'Validado' }, { name: 'RUC', meta: 'PDF · 1.1 MB · 2022', status: 'Validado' }, { name: 'Organigrama corporativo', meta: 'PDF · 1.8 MB · 2024', status: 'Validado' }, { name: 'Políticas contables', meta: 'PDF · 2.1 MB · 2023', status: 'Por revisar' }, { name: 'Contratos relevantes', meta: '4 archivos · 2023–2025', status: 'Validado' }, { name: 'Estados financieros', meta: '4 ejercicios · 2022–2025', status: 'Validado' }, { name: 'Actas de junta directiva', meta: '6 archivos · 2023–2024', status: 'Por revisar' }] },
    { id: 'client-02', initials: 'IN', name: 'Industrias del Norte, S.A.', commercialName: 'Industrias del Norte', ruc: 'J0310004563211', sector: 'Industrial', city: 'León', partner: 'Carlos Méndez', risk: 'Medio', status: 'Activa', engagements: 2, docsPending: 3, personType: 'LEGAL_ENTITY', regime: 'General', currency: 'NIO', group: 'No', auditedYears: '2024 – 2025', lastClose: '31 dic. 2024', riskScore: 55, address: 'Zona industrial, León, Nicaragua', website: 'www.industriasnorte.com', contacts: [{ initials: 'CM', name: 'Carlos Méndez', role: 'Socio responsable', phone: '+505 8555 0101', email: 'cmendez@industriasnorte.com' }], engagementList: [{ code: 'AUD-2025-002', year: '2025', type: 'Financiera', status: 'Planificación', progress: 31 }, { code: 'AUD-2024-010', year: '2024', type: 'Financiera', status: 'Emitido', progress: 100 }], documents: [{ name: 'RUC', meta: 'PDF · 890 KB · 2024', status: 'Validado' }, { name: 'Estados financieros', meta: '2 ejercicios · 2024–2025', status: 'Por revisar' }] },
    { id: 'client-03', initials: 'AG', name: 'Grupo Agroexport, S.A.', commercialName: 'Grupo Agroexport', ruc: 'J0310007091200', sector: 'Agroindustrial', city: 'Estelí', partner: 'Ana Torres', risk: 'Alto', status: 'Activa', engagements: 1, docsPending: 1, personType: 'LEGAL_ENTITY', regime: 'General', currency: 'USD', group: 'Entidad independiente', auditedYears: '2025', lastClose: '30 jun. 2025', riskScore: 78, address: 'Carretera Panamericana, Estelí, Nicaragua', website: 'www.agroexport.com', contacts: [{ initials: 'AT', name: 'Ana Torres', role: 'Gerente de auditoría', phone: '+505 8444 0101', email: 'atorres@agroexport.com' }], engagementList: [{ code: 'AUD-2025-003', year: '2025', type: 'Cumplimiento', status: 'En revisión', progress: 91 }], documents: [{ name: 'Carta de encargo', meta: 'PDF · 1.4 MB · 2025', status: 'Validado' }] },
    { id: 'client-04', initials: 'SB', name: 'Servicios Beta, S.A.', commercialName: 'Servicios Beta', ruc: 'J0310004567899', sector: 'Servicios profesionales', city: 'Managua', partner: 'José Rivera', risk: 'Bajo', status: 'Activa', engagements: 2, docsPending: 0, personType: 'LEGAL_ENTITY', regime: 'General', currency: 'NIO', group: 'No', auditedYears: '2024 – 2025', lastClose: '31 dic. 2024', riskScore: 28, address: 'Pista Juan Pablo II, Managua', website: 'www.serviciosbeta.com', contacts: [{ initials: 'JR', name: 'José Rivera', role: 'Administrador', phone: '+505 8333 0101', email: 'jrivera@serviciosbeta.com' }], engagementList: [{ code: 'AUD-2025-004', year: '2025', type: 'Operativa', status: 'En ejecución', progress: 54 }], documents: [{ name: 'Escritura constitutiva', meta: 'PDF · 1.2 MB · 2024', status: 'Validado' }] },
    { id: 'client-05', initials: 'TR', name: 'Transportes Centro, S.A.', commercialName: 'Transportes Centro', ruc: 'J0310008901234', sector: 'Transporte', city: 'Masaya', partner: 'Laura Pérez', risk: 'Medio', status: 'Activa', engagements: 1, docsPending: 2, personType: 'LEGAL_ENTITY', regime: 'General', currency: 'NIO', group: 'No', auditedYears: '2025', lastClose: '31 mar. 2025', riskScore: 49, address: 'Carretera Masaya, km 15', website: 'www.transportescentro.com', contacts: [{ initials: 'LP', name: 'Laura Pérez', role: 'Supervisora', phone: '+505 8222 0101', email: 'lperez@transportescentro.com' }], engagementList: [{ code: 'AUD-2025-005', year: '2025', type: 'Control interno', status: 'En ejecución', progress: 76 }], documents: [{ name: 'Permiso de operación', meta: 'PDF · 760 KB · 2025', status: 'Por revisar' }] },
    { id: 'client-06', initials: 'DC', name: 'Distribuidora Caribe, S.A.', commercialName: 'Distribuidora Caribe', ruc: 'J0310006789001', sector: 'Comercial', city: 'Bluefields', partner: 'María López', risk: 'Bajo', status: 'Activa', engagements: 2, docsPending: 0, personType: 'LEGAL_ENTITY', regime: 'General', currency: 'NIO', group: 'No', auditedYears: '2023 – 2024', lastClose: '31 dic. 2024', riskScore: 24, address: 'Barrio Central, Bluefields', website: 'www.distribuidoracaribe.com', contacts: [{ initials: 'ML', name: 'María López', role: 'Contacto principal', phone: '+505 8111 0101', email: 'mlopez@distribuidoracaribe.com' }], engagementList: [{ code: 'AUD-2024-007', year: '2024', type: 'Financiera', status: 'Emitido', progress: 100 }], documents: [{ name: 'RUC', meta: 'PDF · 760 KB · 2024', status: 'Validado' }] },
  ],
};

const demoTeam: AuditTeamMember[] = [
  { initials: 'ML', name: 'María López', role: 'Socia responsable', tone: 'green' },
  { initials: 'CM', name: 'Carlos Méndez', role: 'Gerente', tone: 'green' },
  { initials: 'AT', name: 'Ana Torres', role: 'Senior', tone: 'amber' },
  { initials: 'JR', name: 'José Rivera', role: 'Asistente', tone: 'gray' },
  { initials: 'LP', name: 'Laura Pérez', role: 'Auditor', tone: 'gray' },
];

const demoEngagementRows: AuditEngagementRow[] = [
  { id: 'engagement-001', code: 'AUD-2025-001', clientId: 'client-01', client: 'Comercial Pacífico, S.A.', type: 'Financiera', period: '2025', partner: 'María López', manager: 'Carlos Méndez', team: demoTeam, status: 'En ejecución', progress: 68, startDate: '01 Ene 2025', closeDate: '31 Oct 2025', industry: 'Manufactura', office: 'Managua · NIC' },
  { id: 'engagement-002', code: 'AUD-2025-002', clientId: 'client-02', client: 'Industrias del Norte, S.A.', type: 'Financiera', period: '2025', partner: 'Carlos Méndez', manager: 'Ana Torres', team: [demoTeam[1], demoTeam[2], demoTeam[4]], status: 'Planificación', progress: 31, startDate: '01 Ene 2025', closeDate: '31 Dic 2025', industry: 'Industrial', office: 'León · NIC' },
  { id: 'engagement-003', code: 'AUD-2025-003', clientId: 'client-03', client: 'Grupo Agroexport, S.A.', type: 'Cumplimiento', period: '2025', partner: 'Ana Torres', manager: 'José Rivera', team: [demoTeam[2], demoTeam[3], demoTeam[4]], status: 'En revisión', progress: 91, startDate: '01 Ene 2025', closeDate: '22 Oct 2025', industry: 'Agroindustrial', office: 'Estelí · NIC' },
  { id: 'engagement-004', code: 'AUD-2025-004', clientId: 'client-04', client: 'Servicios Beta, S.A.', type: 'Operativa', period: '2025', partner: 'José Rivera', manager: 'Laura Pérez', team: [demoTeam[3], demoTeam[4]], status: 'En ejecución', progress: 54, startDate: '01 Ene 2025', closeDate: '04 Nov 2025', industry: 'Servicios', office: 'Managua · NIC' },
  { id: 'engagement-005', code: 'AUD-2025-005', clientId: 'client-05', client: 'Transportes Centro, S.A.', type: 'Procedimientos acordados', period: '2025', partner: 'Laura Pérez', manager: 'Diego Castillo', team: [demoTeam[4]], status: 'Aceptación', progress: 12, startDate: '01 Ene 2025', closeDate: '14 Nov 2025', industry: 'Transporte', office: 'Masaya · NIC' },
];

export const DEMO_AUDIT_ENGAGEMENTS: AuditEngagementsData = {
  items: demoEngagementRows,
  total: 24,
  workspace: {
    engagement: demoEngagementRows[0],
    summary: { documents: 245, pendingDocuments: 12, findings: 3, highPriorityFindings: 1, risks: 5, risksInTreatment: 2 },
    phases: [
      { label: 'Aceptación e independencia', status: 'complete', progress: 100, date: '05 Oct 2025' },
      { label: 'Planificación y materialidad', status: 'complete', progress: 100, date: '07 Oct 2025' },
      { label: 'Importación de datos contables', status: 'complete', progress: 100, date: '12 Oct 2025' },
      { label: 'Ejecución de pruebas', status: 'active', progress: 68, date: '20 Oct 2025' },
      { label: 'Revisión y conclusión', status: 'pending', progress: 0, date: '22 Oct 2025' },
      { label: 'Emisión de informe', status: 'pending', progress: 0, date: '28 Oct 2025' },
      { label: 'Archivo del encargo', status: 'pending', progress: 0, date: '31 Oct 2025' },
    ],
    milestones: [
      { date: '05 Oct 2025', title: 'Aceptación del cliente', detail: 'Carta de encargo e independencia', status: 'complete' },
      { date: '07 Oct 2025', title: 'Plan de auditoría aprobado', detail: 'Estrategia y enfoque definidos', status: 'complete' },
      { date: '12 Oct 2025', title: 'Datos contables importados', detail: 'Saldos al 30 Sep 2025', status: 'complete' },
      { date: '20 Oct 2025', title: 'Ejecución de pruebas', detail: 'Pruebas sustantivas en proceso', status: 'active' },
      { date: '22 Oct 2025', title: 'Revisión de papeles', detail: 'Control de calidad del encargo', status: 'pending' },
      { date: '31 Oct 2025', title: 'Informe final', detail: 'Fecha objetivo de emisión', status: 'pending' },
    ],
    tasks: [
      { title: 'Revisar confirmaciones de terceros', due: 'Hoy', priority: 'Alta', status: 'Pendiente' },
      { title: 'Completar pruebas de ingresos', due: '22 Oct', priority: 'Media', status: 'Pendiente' },
      { title: 'Revisar estimaciones contables', due: '24 Oct', priority: 'Media', status: 'Pendiente' },
      { title: 'Enviar borrador de hallazgos al cliente', due: '27 Oct', priority: 'Baja', status: 'Pendiente' },
    ],
    issues: [
      { title: 'Retraso en confirmaciones bancarias', detail: 'Abierto · 3 días', tone: 'danger', status: 'Alta' },
      { title: 'Pendiente información de inventarios', detail: 'Abierto · 1 día', tone: 'warning', status: 'Media' },
      { title: 'Ajustes en estimaciones contables', detail: 'En seguimiento', tone: 'info', status: 'Baja' },
    ],
    recentActivity: [
      { date: 'Hoy 10:24', actor: 'María López', detail: 'actualizó el avance del encargo' },
      { date: 'Ayer 16:42', actor: 'Ana Torres', detail: 'completó la revisión de papeles' },
      { date: '14 Oct 11:30', actor: 'José Rivera', detail: 'subió 5 documentos' },
    ],
  },
};

export const DEMO_AUDIT_ACCEPTANCE: AuditAcceptanceData = {
  engagement: { code: 'AUD-2025-001', client: 'Comercial Pacífico, S.A.', type: 'Auditoría financiera', period: 'Ejercicio 2025', partner: 'María López', ruc: 'J031000123456', industry: 'Comercio al por mayor', size: 'Grande', location: 'Managua, Nicaragua' },
  result: { title: 'Apto para continuar', detail: 'Con base en las evaluaciones completadas, no se han identificado impedimentos para continuar con el encargo.', criteria: '12/12', conflicts: '0', risk: 'Bajo' },
  dueDiligence: [{ label: 'Reputación', value: 'Sin alertas relevantes', tone: 'success' }, { label: 'Situación financiera', value: 'Sólida', tone: 'success' }, { label: 'Entorno regulatorio', value: 'Riesgo bajo', tone: 'success' }, { label: 'Antecedentes', value: 'Sin hallazgos adversos', tone: 'success' }],
  risks: [{ label: 'Integridad de la administración', level: 'Bajo' }, { label: 'Capacidad técnica del equipo', level: 'Bajo' }, { label: 'Independencia financiera', level: 'Bajo' }, { label: 'Riesgos regulatorios y legales', level: 'Medio' }, { label: 'Continuidad de la relación', level: 'Bajo' }],
  criteria: [
    { id: 1, label: 'Integridad y reputación de la administración', category: 'Perfil del cliente', responsible: 'ML', result: 'Completo', note: 'Sin alertas' },
    { id: 2, label: 'Independencia de la firma y del equipo', category: 'Independencia', responsible: 'AT', result: 'Completo', note: 'Sin conflictos' },
    { id: 3, label: 'Competencias y capacidad operativa', category: 'Perfil del cliente', responsible: 'CM', result: 'Completo', note: 'Equipo calificado' },
    { id: 4, label: 'Conflictos y relaciones profesionales', category: 'Independencia', responsible: 'ML', result: 'Completo', note: 'Sin conflictos' },
    { id: 5, label: 'Condiciones previas para auditoría', category: 'Riesgos', responsible: 'GT', result: 'Completo', note: 'Cumple requisitos' },
  ],
  independence: [
    { initials: 'ML', name: 'María López', role: 'Socia del encargo', status: 'Firmada', date: '05 Oct 2025' },
    { initials: 'CM', name: 'Carlos Méndez', role: 'Gerente de auditoría', status: 'Firmada', date: '06 Oct 2025' },
    { initials: 'AT', name: 'Ana Torres', role: 'Supervisora', status: 'Firmada', date: '06 Oct 2025' },
    { initials: 'JR', name: 'José Rivera', role: 'Auditor senior', status: 'Firmada', date: '06 Oct 2025' },
    { initials: 'LP', name: 'Laura Pérez', role: 'Auditor', status: 'Firmada', date: '07 Oct 2025' },
  ],
  conflicts: { title: 'Sin conflictos identificados', detail: 'Se realizó la verificación en la base de datos de la firma y no se identificaron relaciones que afecten la independencia.', checkedAt: 'Verificación realizada el 05 Oct 2025' },
  documents: [{ name: 'Cuestionario de aceptación', version: 'v1.0 · 05 Oct 2025', status: 'Listo' }, { name: 'Declaraciones del equipo', version: 'v1.0 · 06 Oct 2025', status: 'Listo' }, { name: 'Análisis de independencia', version: 'v1.0 · 07 Oct 2025', status: 'Listo' }, { name: 'Borrador de carta de encargo', version: 'v0.3 · 08 Oct 2025', status: 'Pendiente' }],
  approvals: [{ step: 'Preparación del análisis', person: 'Ana Torres', role: 'Supervisora', status: 'Completado', date: '05 Oct 2025, 14:20' }, { step: 'Revisión técnica', person: 'Carlos Méndez', role: 'Gerente', status: 'Completado', date: '08 Oct 2025, 10:15' }, { step: 'Aprobación del socio', person: 'María López', role: 'Socia del encargo', status: 'Pendiente', date: 'Pendiente de aprobación' }],
  history: [{ version: 'v0.3', detail: 'Carta de encargo actualizada', actor: 'Ana Torres', date: '08 Oct 2025, 09:12' }, { version: 'v0.2', detail: 'Declaraciones de equipo completadas', actor: 'Carlos Méndez', date: '06 Oct 2025, 16:45' }, { version: 'v0.1', detail: 'Cuestionario inicial', actor: 'Ana Torres', date: '05 Oct 2025, 11:20' }],
};

export const DEMO_AUDIT_PLANNING: AuditPlanningData = {
  engagement: { code: 'AUD-2025-001', client: 'Comercial Pacífico, S.A.', type: 'Auditoría financiera', period: '01 ene 2025 – 31 dic 2025', status: 'En planificación', progress: 35 },
  metrics: { global: 'C$ 1,250,000', execution: 'C$ 875,000', threshold: 'C$ 62,500', significantAreas: '6 de 8', procedures: '42' },
  objectives: 'Obtener seguridad razonable sobre los estados financieros de Comercial Pacífico, S.A. preparados razonablemente, en todos sus aspectos importantes, a su situación financiera al 31 de diciembre de 2025.',
  scope: { included: ['Estado de situación financiera', 'Estado de resultados', 'Estado de cambios en el patrimonio', 'Estado de flujos de efectivo', 'Notas a los estados financieros'], excluded: ['Información financiera intermedia', 'Auditoría de sostenibilidad', 'Auditoría de TI', 'Otras aseguraciones'] },
  materiality: { base: 'Ingresos netos', baseAmount: 'C$ 50,000,000', globalPercent: '2.5', executionPercent: '70', thresholdPercent: '5' },
  areas: [{ area: 'Caja y bancos', balance: 'C$ 12,450,000', percent: '18%', risk: 'Alto', significant: true }, { area: 'Cuentas por cobrar', balance: 'C$ 9,800,000', percent: '14%', risk: 'Alto', significant: true }, { area: 'Inventarios', balance: 'C$ 8,760,000', percent: '13%', risk: 'Medio', significant: true }, { area: 'Activos fijos', balance: 'C$ 15,200,000', percent: '22%', risk: 'Medio', significant: true }, { area: 'Ingresos', balance: 'C$ 50,000,000', percent: '72%', risk: 'Alto', significant: true }, { area: 'Compras y CxP', balance: 'C$ 7,450,000', percent: '11%', risk: 'Medio', significant: true }, { area: 'Planilla', balance: 'C$ 3,200,000', percent: '5%', risk: 'Bajo', significant: false }, { area: 'Impuestos', balance: 'C$ 4,100,000', percent: '6%', risk: 'Medio', significant: true }],
  phases: [{ phase: 'Aceptación e independencia', start: '02 ene', end: '15 ene', tone: 'green' }, { phase: 'Planificación', start: '16 ene', end: '31 ene', tone: 'green' }, { phase: 'Procedimientos', start: '01 feb', end: '30 abr', tone: 'green' }, { phase: 'Revisión y conclusiones', start: '01 may', end: '20 may', tone: 'amber' }, { phase: 'Informe y comunicación', start: '21 may', end: '31 may', tone: 'gray' }],
  documents: [{ name: 'Plan de auditoría', type: 'DOCX · 120 KB', status: 'Borrador', date: '05 Oct 2025' }, { name: 'Memorando de estrategia', type: 'PDF · 450 KB', status: 'En revisión', date: '08 Oct 2025' }, { name: 'Cálculo de materialidad', type: 'XLSX · 85 KB', status: 'Aprobado', date: '05 Oct 2025' }, { name: 'Cronograma del encargo', type: 'PDF · 220 KB', status: 'Borrador', date: '06 Oct 2025' }, { name: 'Listado de áreas significativas', type: 'XLSX · 62 KB', status: 'Aprobado', date: '05 Oct 2025' }],
  notes: [{ initials: 'CM', author: 'Carlos Méndez', note: 'Revisar si se incluyen subsidiarias en el alcance', status: 'Pendiente' }, { initials: 'AT', author: 'Ana Torres', note: 'Confirmar saldo de inventarios con conteo físico', status: 'Pendiente' }, { initials: 'ML', author: 'María López', note: 'Cliente proporcionará contrato bancario', status: 'Resuelta' }, { initials: 'JR', author: 'José Rivera', note: 'Ajustar cronograma por disponibilidad del cliente', status: 'Resuelta' }],
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

function unwrap<T>(raw: T): unknown {
  const value = raw as unknown;
  const record = asRecord(value);
  const data = record.data;
  const nestedData = asRecord(data).data;
  return nestedData || data || record.result || value;
}

function normaliseKpi(value: UnknownRecord, fallback: AuditKpi): AuditKpi {
  return {
    label: String(value.label || value.name || fallback.label),
    value: String(value.value ?? fallback.value),
    trend: String(value.trend || fallback.trend),
    trendDirection: value.trendDirection === 'down' || value.direction === 'down' ? 'down' : fallback.trendDirection,
    detail: String(value.detail || fallback.detail),
    tone: value.tone === 'danger' ? 'danger' : fallback.tone,
  };
}

export function normalizeDashboard(raw: unknown): AuditDashboardData {
  const value = asRecord(unwrap(raw));
  return {
    ...value,
    kpis: Array.isArray(value.kpis) ? value.kpis.map((item, index) => normaliseKpi(asRecord(item), dashboardKpis[index] || dashboardKpis[0])) : [],
    progressSeries: Array.isArray(value.progressSeries) ? value.progressSeries as AuditDashboardData['progressSeries'] : [],
    auditDistribution: Array.isArray(value.auditDistribution) ? value.auditDistribution as AuditDashboardData['auditDistribution'] : [],
    deadlines: Array.isArray(value.deadlines) ? value.deadlines as AuditDashboardData['deadlines'] : [],
    engagements: Array.isArray(value.engagements) ? value.engagements as AuditDashboardData['engagements'] : [],
    findingsByArea: Array.isArray(value.findingsByArea) ? value.findingsByArea as AuditDashboardData['findingsByArea'] : [],
    significantRisks: Array.isArray(value.significantRisks) ? value.significantRisks as AuditDashboardData['significantRisks'] : [],
    teamWorkload: Array.isArray(value.teamWorkload) ? value.teamWorkload as AuditDashboardData['teamWorkload'] : [],
    recentActivity: Array.isArray(value.recentActivity) ? value.recentActivity as AuditDashboardData['recentActivity'] : [],
  };
}

export function normalizeClients(raw: unknown): AuditClientsData {
  const unwrapped = unwrap(raw);
  const value = asRecord(unwrapped);
  const items = Array.isArray(value.items) ? value.items : Array.isArray(value.clients) ? value.clients : Array.isArray(unwrapped) ? unwrapped : [];
  const mapped = items.map((item, index): AuditClient => {
    const record = asRecord(item);
    return {
    riskScore: 0,
    regime: 'General',
    currency: 'NIO',
    group: 'No',
    auditedYears: '—',
    lastClose: '—',
    address: '—',
    website: '—',
    id: String(record.id || record.clientId || `client-${index + 1}`),
    initials: String(record.initials || String(record.name || 'CL').split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2)).toUpperCase(),
    name: String(record.name || record.legalName || record.businessName || 'Cliente sin nombre'),
    commercialName: String(record.commercialName || record.tradeName || record.name || '—'),
    ruc: String(record.ruc || record.taxId || record.identification || '—'),
    sector: String(record.sector || 'Sin clasificar'),
    city: String(record.city || record.location || '—'),
    partner: String(record.partner || record.responsiblePartner || 'Sin asignar'),
    risk: record.risk === 'Alto' || record.risk === 'Bajo' ? record.risk : 'Medio',
    status: record.status === 'Inactiva' ? 'Inactiva' : 'Activa',
    engagements: Number(record.engagements ?? record.engagementCount ?? 0),
    docsPending: Number(record.docsPending ?? record.pendingDocuments ?? 0),
    personType: record.personType === 'NATURAL_PERSON' ? 'NATURAL_PERSON' : 'LEGAL_ENTITY',
    contacts: Array.isArray(record.contacts) ? record.contacts as AuditClient['contacts'] : [],
    engagementList: Array.isArray(record.engagementList) ? record.engagementList as AuditClient['engagementList'] : [],
    documents: Array.isArray(record.documents) ? record.documents as AuditClient['documents'] : [],
  };
  });
  const kpis = asRecord(value.kpis);
  return {
    items: mapped,
    total: Number(value.total ?? mapped.length),
    kpis: {
      entities: Number(kpis.entities ?? value.total ?? mapped.length),
      active: Number(kpis.active ?? mapped.filter(item => item.status === 'Activa').length),
      withEngagements: Number(kpis.withEngagements ?? mapped.filter(item => item.engagements > 0).length),
      pendingDocuments: Number(kpis.pendingDocuments ?? mapped.reduce((total, item) => total + item.docsPending, 0)),
      highRisk: Number(kpis.highRisk ?? mapped.filter(item => item.risk === 'Alto').length),
    },
  };
}

function mergeWithDemo<T extends object>(raw: unknown, fallback: T): T {
  const value = asRecord(unwrap(raw));
  return { ...fallback, ...value } as T;
}

export function normalizeEngagements(raw: unknown): AuditEngagementsData {
  const value = asRecord(unwrap(raw));
  const items = Array.isArray(value.items) ? value.items : Array.isArray(value.engagements) ? value.engagements : [];
  const mappedItems = items.map((item, index) => {
    const record = asRecord(item);
    const client = asRecord(record.client);
    const team = Array.isArray(record.team) ? record.team.map(member => {
      const person = asRecord(member);
      return { initials: String(person.initials || String(person.name || 'EQ').slice(0, 2)).toUpperCase(), name: String(person.name || 'Equipo'), role: String(person.role || 'Auditor'), tone: person.tone as AuditTeamMember['tone'] };
    }) : [];
    return {
      id: String(record.id || `engagement-${index + 1}`),
      code: String(record.code || `AUD-${record.period || ''}-${String(index + 1).padStart(3, '0')}`),
      clientId: String(record.clientId || client.id || ''),
      client: String(record.client || record.clientName || client.name || ''),
      type: String(record.type || ''),
      period: String(record.period || ''),
      partner: String(record.partner || record.partnerName || ''),
      manager: String(record.manager || record.managerName || ''),
      team,
      status: String(record.status || 'Borrador') as AuditEngagementStatus,
      progress: Number(record.progress || 0),
      startDate: String(record.startDate || ''),
      closeDate: String(record.closeDate || ''),
      industry: String(record.industry || ''),
      office: String(record.office || ''),
    } as AuditEngagementRow;
  });
  const first = mappedItems[0] || { id: '', code: '', clientId: '', client: '', type: '', period: '', partner: '', manager: '', team: [], status: 'Borrador' as AuditEngagementStatus, progress: 0, startDate: '', closeDate: '', industry: '', office: '' };
  const workspace = asRecord(value.workspace);
  return {
    items: mappedItems,
    total: Number(value.total ?? mappedItems.length),
    workspace: {
      engagement: (asRecord(workspace.engagement) as AuditEngagementRow) || first,
      summary: (asRecord(workspace.summary) as AuditEngagementWorkspace['summary']) || { documents: 0, pendingDocuments: 0, findings: 0, highPriorityFindings: 0, risks: 0, risksInTreatment: 0 },
      phases: Array.isArray(workspace.phases) ? workspace.phases as AuditEngagementWorkspace['phases'] : [],
      milestones: Array.isArray(workspace.milestones) ? workspace.milestones as AuditEngagementWorkspace['milestones'] : [],
      tasks: Array.isArray(workspace.tasks) ? workspace.tasks as AuditEngagementWorkspace['tasks'] : [],
      issues: Array.isArray(workspace.issues) ? workspace.issues as AuditEngagementWorkspace['issues'] : [],
      recentActivity: Array.isArray(workspace.recentActivity) ? workspace.recentActivity as AuditEngagementWorkspace['recentActivity'] : [],
    },
  };
}

export function normalizeAcceptance(raw: unknown): AuditAcceptanceData {
  const value = asRecord(unwrap(raw));
  const engagement = asRecord(value.engagement);
  return {
    engagement: { code: String(engagement.code || ''), client: String(engagement.client || ''), type: String(engagement.type || ''), period: String(engagement.period || ''), partner: String(engagement.partner || ''), ruc: String(engagement.ruc || '—'), industry: String(engagement.industry || '—'), size: String(engagement.size || '—'), location: String(engagement.location || '—') },
    result: { title: String(asRecord(value.result).title || 'Evaluación pendiente'), detail: String(asRecord(value.result).detail || 'Completa la evaluación de aceptación para continuar.'), criteria: String(asRecord(value.result).criteria || '0/0'), conflicts: String(asRecord(value.result).conflicts || '0'), risk: (asRecord(value.result).risk === 'Alto' || asRecord(value.result).risk === 'Medio' ? asRecord(value.result).risk : 'Bajo') as AuditRisk },
    dueDiligence: Array.isArray(value.dueDiligence) ? value.dueDiligence as AuditAcceptanceData['dueDiligence'] : [],
    risks: Array.isArray(value.risks) ? value.risks as AuditAcceptanceData['risks'] : [],
    criteria: Array.isArray(value.criteria) ? value.criteria as AuditAcceptanceData['criteria'] : [],
    independence: Array.isArray(value.independence) ? value.independence as AuditAcceptanceData['independence'] : [],
    conflicts: (asRecord(value.conflicts) as AuditAcceptanceData['conflicts']) || { title: 'Sin conflictos registrados', detail: 'No hay conflictos documentados.', checkedAt: '—' },
    documents: Array.isArray(value.documents) ? value.documents as AuditAcceptanceData['documents'] : [],
    approvals: Array.isArray(value.approvals) ? value.approvals as AuditAcceptanceData['approvals'] : [],
    history: Array.isArray(value.history) ? value.history as AuditAcceptanceData['history'] : [],
  };
}

export function normalizePlanning(raw: unknown): AuditPlanningData {
  const value = asRecord(unwrap(raw));
  const engagement = asRecord(value.engagement);
  const materiality = asRecord(value.materiality);
  return {
    engagement: { code: String(engagement.code || ''), client: String(engagement.client || ''), type: String(engagement.type || ''), period: String(engagement.period || ''), status: String(engagement.status || 'Borrador'), progress: Number(engagement.progress || 0) },
    metrics: (asRecord(value.metrics) as AuditPlanningData['metrics']) || { global: 'C$ 0', execution: 'C$ 0', threshold: 'C$ 0', significantAreas: '0 de 0', procedures: '0' },
    objectives: String(value.objectives || ''),
    scope: (asRecord(value.scope) as AuditPlanningData['scope']) || { included: [], excluded: [] },
    materiality: { base: String(materiality.base || ''), baseAmount: String(materiality.baseAmount || 'C$ 0'), globalPercent: String(materiality.globalPercent || '0'), executionPercent: String(materiality.executionPercent || '0'), thresholdPercent: String(materiality.thresholdPercent || '0') },
    areas: Array.isArray(value.areas) ? value.areas as AuditPlanningData['areas'] : [],
    phases: Array.isArray(value.phases) ? value.phases as AuditPlanningData['phases'] : [],
    documents: Array.isArray(value.documents) ? value.documents as AuditPlanningData['documents'] : [],
    notes: Array.isArray(value.notes) ? value.notes as AuditPlanningData['notes'] : [],
  };
}

export const auditWorkspaceService = {
  listAuditTenants: (signal?: AbortSignal) =>
    api.get<unknown>('/audit/v1/context/tenants', { signal }),
  getDashboard: (params?: AuditDashboardParams, signal?: AbortSignal) =>
    api.get<unknown>('/audit/v1/dashboard', { params, signal }),
  getClients: (params?: AuditClientsParams, signal?: AbortSignal) =>
    api.get<unknown>('/audit/v1/clients', { params, signal }),
  getClientWorkspace: (id: string, signal?: AbortSignal) =>
    api.get<unknown>(`/audit/v1/clients/${encodeURIComponent(id)}/workspace`, { signal }),
  createClient: (body: unknown) => api.post<unknown>('/audit/v1/clients', body),
  updateClient: (id: string, body: unknown) => api.patch<unknown>(`/audit/v1/clients/${encodeURIComponent(id)}`, body),
  getEngagements: (params?: Record<string, unknown>, signal?: AbortSignal) =>
    api.get<unknown>('/audit/v1/engagements', { params, signal }),
  getEngagementWorkspace: (id: string, signal?: AbortSignal) =>
    api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/workspace`, { signal }),
  createEngagement: (body: unknown) => api.post<unknown>('/audit/v1/engagements', body),
  updateEngagement: (id: string, body: unknown) => api.patch<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}`, body),
  updateEngagementTeam: (id: string, body: unknown) => api.put<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/team`, body),
  getAcceptance: (id: string, signal?: AbortSignal) =>
    api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/acceptance`, { signal }),
  saveAcceptance: (id: string, body: unknown) => api.patch<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/acceptance`, body),
  createIndependenceAttestation: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/independence-attestations`, body),
  transitionAcceptance: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/acceptance/transitions`, body),
  generateEngagementLetter: (id: string) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/engagement-letter`, {}),
  getPlanning: (id: string, signal?: AbortSignal) =>
    api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/planning`, { signal }),
  savePlanning: (id: string, body: unknown) => api.patch<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/planning`, body),
  createMaterialityVersion: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/materiality/versions`, body),
  updateMilestones: (id: string, body: unknown) => api.put<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/milestones`, body),
  transitionPlanning: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/planning/transitions`, body),
  getAccountingImports: (id: string, params?: Record<string, unknown>, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/accounting/imports`, { params, signal }),
  createAccountingImport: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/accounting/imports`, body),
  getAccountingImport: (jobId: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/accounting/imports/${encodeURIComponent(jobId)}`, { signal }),
  updateAccountingMapping: (jobId: string, body: unknown) => api.put<unknown>(`/audit/v1/accounting/imports/${encodeURIComponent(jobId)}/mapping`, body),
  validateAccountingImport: (jobId: string) => api.post<unknown>(`/audit/v1/accounting/imports/${encodeURIComponent(jobId)}/validate`, {}),
  commitAccountingImport: (jobId: string) => api.post<unknown>(`/audit/v1/accounting/imports/${encodeURIComponent(jobId)}/commit`, {}),
  getTrialBalance: (id: string, params?: Record<string, unknown>, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/trial-balance`, { params, signal }),
  getTrialBalanceAccount: (id: string, accountId: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/trial-balance/accounts/${encodeURIComponent(accountId)}`, { signal }),
  getSummaries: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/summaries`, { signal }),
  generateSummaries: (id: string, body?: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/summaries/generate`, body || {}),
  getAccountingVersions: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/accounting/versions`, { signal }),
  getRiskWorkspace: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/risks/workspace`, { signal }),
  createRisk: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/risks`, body),
  updateRisk: (id: string, riskId: string, body: unknown) => api.patch<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/risks/${encodeURIComponent(riskId)}`, body),
  updateRiskControls: (id: string, riskId: string, body: unknown) => api.put<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/risks/${encodeURIComponent(riskId)}/controls`, body),
  updateRiskProcedures: (id: string, riskId: string, body: unknown) => api.put<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/risks/${encodeURIComponent(riskId)}/procedures`, body),
  submitRiskReview: (id: string, body?: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/risks/review/submit`, body || {}),
  getProgramsWorkspace: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/programs/workspace`, { signal }),
  createProgram: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/programs`, body),
  updateProgram: (id: string, programId: string, body: unknown) => api.patch<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/programs/${encodeURIComponent(programId)}`, body),
  createProcedure: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/procedures`, body),
  updateProcedure: (id: string, procedureId: string, body: unknown) => api.patch<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/procedures/${encodeURIComponent(procedureId)}`, body),
  programReviewAction: (id: string, programId: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/programs/${encodeURIComponent(programId)}/review-actions`, body),
  getSamplingWorkspace: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/sampling/workspace`, { signal }),
  createSamplePlan: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/sample-plans`, body),
  updateSamplePlan: (planId: string, body: unknown) => api.patch<unknown>(`/audit/v1/sample-plans/${encodeURIComponent(planId)}`, body),
  drawSample: (planId: string, body?: unknown) => api.post<unknown>(`/audit/v1/sample-plans/${encodeURIComponent(planId)}/draw`, body || {}),
  getSampleSelections: (planId: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/sample-plans/${encodeURIComponent(planId)}/selections`, { signal }),
  updateSampleResults: (planId: string, body: unknown) => api.patch<unknown>(`/audit/v1/sample-plans/${encodeURIComponent(planId)}/results`, body),
  evaluateSample: (planId: string, body?: unknown) => api.post<unknown>(`/audit/v1/sample-plans/${encodeURIComponent(planId)}/evaluate`, body || {}),
  getWorkpapersWorkspace: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/workpapers/workspace`, { signal }),
  createWorkpaper: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/workpapers`, body),
  updateWorkpaper: (workpaperId: string, body: unknown) => api.patch<unknown>(`/audit/v1/workpapers/${encodeURIComponent(workpaperId)}`, body),
  createWorkpaperVersion: (workpaperId: string, body: unknown) => api.post<unknown>(`/audit/v1/workpapers/${encodeURIComponent(workpaperId)}/versions`, body),
  linkWorkpaperEvidence: (workpaperId: string, body: unknown) => api.post<unknown>(`/audit/v1/workpapers/${encodeURIComponent(workpaperId)}/evidence-links`, body),
  workpaperReviewAction: (workpaperId: string, body: unknown) => api.post<unknown>(`/audit/v1/workpapers/${encodeURIComponent(workpaperId)}/review-actions`, body),
  exportWorkpaper: (workpaperId: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/workpapers/${encodeURIComponent(workpaperId)}/export`, { signal }),
  getPbcWorkspace: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/pbc/workspace`, { signal }),
  createPbcRequest: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/pbc/requests`, body),
  updatePbcRequest: (requestId: string, body: unknown) => api.patch<unknown>(`/audit/v1/pbc/requests/${encodeURIComponent(requestId)}`, body),
  sharePbcRequest: (requestId: string, body?: unknown) => api.post<unknown>(`/audit/v1/pbc/requests/${encodeURIComponent(requestId)}/share`, body || {}),
  submitPbcDocument: (requestId: string, body: unknown) => api.post<unknown>(`/audit/v1/pbc/requests/${encodeURIComponent(requestId)}/submissions`, body),
  pbcReviewAction: (requestId: string, body: unknown) => api.post<unknown>(`/audit/v1/pbc/requests/${encodeURIComponent(requestId)}/review-actions`, body),
  getFindingsWorkspace: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/findings/workspace`, { signal }),
  createFinding: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/findings`, body),
  updateFinding: (id: string, findingId: string, body: unknown) => api.patch<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/findings/${encodeURIComponent(findingId)}`, body),
  createAdjustment: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/adjustments`, body),
  updateAdjustment: (id: string, adjustmentId: string, body: unknown) => api.patch<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/adjustments/${encodeURIComponent(adjustmentId)}`, body),
  createManagementCommunication: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/management-communications`, body),
  findingReviewAction: (id: string, findingId: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/findings/${encodeURIComponent(findingId)}/review-actions`, body),
  getReviewsWorkspace: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/reviews/workspace`, { signal }),
  getReviewItem: (reviewItemId: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/review-items/${encodeURIComponent(reviewItemId)}`, { signal }),
  addReviewNote: (reviewItemId: string, body: unknown) => api.post<unknown>(`/audit/v1/review-items/${encodeURIComponent(reviewItemId)}/notes`, body),
  reviewItemAction: (reviewItemId: string, body: unknown) => api.post<unknown>(`/audit/v1/review-items/${encodeURIComponent(reviewItemId)}/actions`, body),
  getQualityGates: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/quality-gates`, { signal }),
  recheckQualityGates: (id: string, body?: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/quality-gates/recheck`, body || {}),
  getReportsWorkspace: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/reports/workspace`, { signal }),
  createReportDraft: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/reports/drafts`, body),
  getReport: (reportId: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/reports/${encodeURIComponent(reportId)}`, { signal }),
  updateReport: (reportId: string, body: unknown) => api.patch<unknown>(`/audit/v1/reports/${encodeURIComponent(reportId)}`, body),
  reportReviewAction: (reportId: string, body: unknown) => api.post<unknown>(`/audit/v1/reports/${encodeURIComponent(reportId)}/review-actions`, body),
  issueReport: (reportId: string, body?: unknown) => api.post<unknown>(`/audit/v1/reports/${encodeURIComponent(reportId)}/issue`, body || {}),
  exportReport: (reportId: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/reports/${encodeURIComponent(reportId)}/export`, { signal }),
  getArchiveWorkspace: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/archive/workspace`, { signal }),
  validateArchive: (id: string, body?: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/archive/validate`, body || {}),
  archiveAction: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/archive/actions`, body),
  getArchivePackage: (id: string, signal?: AbortSignal) => api.get<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/archive/package`, { signal }),
  createFollowupAction: (id: string, body: unknown) => api.post<unknown>(`/audit/v1/engagements/${encodeURIComponent(id)}/followup-actions`, body),
  updateFollowupAction: (actionId: string, body: unknown) => api.patch<unknown>(`/audit/v1/followup-actions/${encodeURIComponent(actionId)}`, body),
};
