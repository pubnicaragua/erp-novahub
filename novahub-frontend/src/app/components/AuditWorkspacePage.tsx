import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Database,
  ClipboardCheck,
  Clock3,
  Download,
  Edit3,
  FileCheck2,
  FileClock,
  FileText,
  Filter,
  FolderOpen,
  History,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Route,
  Search,
  Send,
  ShieldAlert,
  UsersRound,
  X,
} from 'lucide-react';
import { cn } from './ui/utils';
import { GuidedTour, type GuidedTourStep } from './ui/GuidedTour';
import { AuditAcceptanceView } from './AuditAcceptanceView';
import { AuditEngagementsView } from './AuditEngagementsView';
import { AuditPlanningView } from './AuditPlanningView';
import { AuditAccountingImportView } from './AuditAccountingImportView';
import { AuditTrialBalanceView } from './AuditTrialBalanceView';
import { AuditRisksView } from './AuditRisksView';
import { AuditProgramsView } from './AuditProgramsView';
import { AuditSamplingView } from './AuditSamplingView';
import { AuditWorkpapersView } from './AuditWorkpapersView';
import { AuditPbcView } from './AuditPbcView';
import { AuditFindingsView } from './AuditFindingsView';
import { AuditReviewsView } from './AuditReviewsView';
import { AuditReportsView } from './AuditReportsView';
import { AuditArchiveView } from './AuditArchiveView';
import {
  auditWorkspaceService,
  normalizeClients,
  normalizeDashboard,
  type AuditClient,
  type AuditClientsData,
  type AuditDashboardData,
  type AuditRisk,
} from '../services/audit-workspace.service';

type AuditView = 'dashboard' | 'clients' | 'engagements' | 'acceptance' | 'planning' | 'accounting-imports' | 'trial-balance' | 'risks' | 'programs' | 'sampling' | 'workpapers' | 'pbc' | 'findings' | 'reviews' | 'reports' | 'archive' | 'logs';
type QueryResult<T> = { data: T; isDemo: boolean; fallbackMessage?: string };

const viewBySubmodule: Record<string, AuditView> = {
  'resumen-auditoria': 'dashboard',
  'clientes-auditados': 'clients',
  'encargos-auditoria': 'engagements',
  'aceptacion-auditoria': 'acceptance',
  'planificacion-auditoria': 'planning',
  'importacion-contable': 'accounting-imports',
  'balanza-auditoria': 'trial-balance',
  'riesgos-controles': 'risks',
  'programas-auditoria': 'programs',
  'muestreo-auditoria': 'sampling',
  'papeles-trabajo': 'workpapers',
  'centro-pbc': 'pbc',
  'hallazgos-ajustes': 'findings',
  'supervision-aprobaciones': 'reviews',
  'conclusiones-informes': 'reports',
  'cierre-archivo': 'archive',
  'logs-auditoria': 'logs',
};

const submoduleByView: Record<AuditView, string> = {
  dashboard: 'resumen-auditoria',
  clients: 'clientes-auditados',
  engagements: 'encargos-auditoria',
  acceptance: 'aceptacion-auditoria',
  planning: 'planificacion-auditoria',
  'accounting-imports': 'importacion-contable',
  'trial-balance': 'balanza-auditoria',
  risks: 'riesgos-controles',
  programs: 'programas-auditoria',
  sampling: 'muestreo-auditoria',
  workpapers: 'papeles-trabajo',
  pbc: 'centro-pbc',
  findings: 'hallazgos-ajustes',
  reviews: 'supervision-aprobaciones',
  reports: 'conclusiones-informes',
  archive: 'cierre-archivo',
  logs: 'logs-auditoria',
};

const auditNav: Array<{ id: AuditView; label: string; shortLabel: string; icon: typeof LayoutDashboard; enabled?: boolean }> = [
  { id: 'dashboard', label: 'Resumen de auditoría', shortLabel: 'Resumen', icon: LayoutDashboard, enabled: true },
  { id: 'clients', label: 'Clientes y empresas auditadas', shortLabel: 'Clientes', icon: Building2, enabled: true },
  { id: 'engagements', label: 'Encargos de auditoría', shortLabel: 'Encargos', icon: BriefcaseBusiness },
  { id: 'acceptance', label: 'Aceptación e independencia', shortLabel: 'Aceptación', icon: ClipboardCheck },
  { id: 'planning', label: 'Planificación y materialidad', shortLabel: 'Planificación', icon: FileCheck2, enabled: true },
  { id: 'accounting-imports', label: 'Importación contable', shortLabel: 'Importación', icon: Database, enabled: true },
  { id: 'trial-balance', label: 'Balanza y cédulas', shortLabel: 'Balanza', icon: FileText, enabled: true },
  { id: 'risks', label: 'Matriz de riesgos y controles', shortLabel: 'Riesgos', icon: ShieldAlert, enabled: true },
  { id: 'programs', label: 'Programas de auditoría', shortLabel: 'Programas', icon: ClipboardCheck, enabled: true },
  { id: 'sampling', label: 'Muestreo de auditoría', shortLabel: 'Muestreo', icon: Database, enabled: true },
  { id: 'workpapers', label: 'Papeles de trabajo y pruebas', shortLabel: 'Papeles', icon: FileText, enabled: true },
  { id: 'pbc', label: 'Centro documental y PBC', shortLabel: 'PBC', icon: FolderOpen, enabled: true },
  { id: 'findings', label: 'Hallazgos e incorrecciones', shortLabel: 'Hallazgos', icon: ShieldAlert, enabled: true },
  { id: 'reviews', label: 'Supervisión y aprobaciones', shortLabel: 'Supervisión', icon: ClipboardCheck, enabled: true },
  { id: 'reports', label: 'Conclusiones e informes', shortLabel: 'Informes', icon: FileCheck2, enabled: true },
  { id: 'archive', label: 'Cierre, archivo y seguimiento', shortLabel: 'Cierre', icon: FolderOpen, enabled: true },
  { id: 'logs', label: 'Bitácora de auditoría', shortLabel: 'Bitácora', icon: History },
];

type AuditTourStep = GuidedTourStep & { view: Exclude<AuditView, 'logs'> };

const auditModuleTourSteps: AuditTourStep[] = [
  { view: 'dashboard', target: '[data-audit-nav="dashboard"]', title: '01 · Resumen de auditoría', description: 'Empieza aquí para ver encargos, avance del plan, riesgos, hallazgos, vencimientos y carga del equipo en una sola lectura ejecutiva.', tip: 'Los indicadores deben provenir del tenant seleccionado y de la respuesta agrupada del dashboard.', placement: 'bottom' },
  { view: 'clients', target: '[data-audit-nav="clients"]', title: '02 · Clientes y empresas auditadas', description: 'Administra el directorio maestro de entidades, su información fiscal, contactos, riesgo inicial y documentación permanente.', tip: 'Desde un cliente puedes abrir su ficha y comenzar un nuevo encargo con el cliente preseleccionado.', placement: 'bottom' },
  { view: 'engagements', target: '[data-audit-nav="engagements"]', title: '03 · Encargos de auditoría', description: 'Crea y administra cada expediente: período, tipo de auditoría, responsables, fases, hitos, tareas y estado del trabajo.', tip: 'Un encargo nuevo inicia como borrador o pendiente de aceptación; no se aprueba automáticamente.', placement: 'bottom' },
  { view: 'acceptance', target: '[data-audit-nav="acceptance"]', title: '04 · Aceptación e independencia', description: 'Evalúa al cliente, registra independencia, conflictos, evidencias y la decisión del socio antes de habilitar la planificación.', tip: 'La aprobación conserva usuario, fecha, versión y justificación.', placement: 'bottom' },
  { view: 'planning', target: '[data-audit-nav="planning"]', title: '05 · Planificación y materialidad', description: 'Define estrategia, alcance, áreas significativas, materialidad, cronograma y recursos del encargo.', tip: 'La materialidad es versionada porque puede impactar cuentas, muestras, riesgos y conclusiones.', placement: 'bottom' },
  { view: 'accounting-imports', target: '[data-audit-nav="accounting-imports"]', title: '06 · Importación contable', description: 'Carga Excel, CSV o una fuente autorizada, homologa columnas, valida movimientos y publica una versión contable sin destruir la anterior.', tip: 'Los errores bloqueantes impiden publicar el conjunto de datos.', placement: 'bottom' },
  { view: 'trial-balance', target: '[data-audit-nav="trial-balance"]', title: '07 · Balanza y cédulas', description: 'Explora cuentas y saldos, compara versiones, revisa ajustes y genera cédulas sumarias relacionadas con riesgos y papeles.', tip: 'Los ajustes de auditoría permanecen separados de la contabilidad original.', placement: 'bottom' },
  { view: 'risks', target: '[data-audit-nav="risks"]', title: '08 · Riesgos y controles', description: 'Identifica y valora riesgos por área y afirmación, documenta controles y relaciona las respuestas de auditoría.', tip: 'El mapa de calor ayuda a priorizar, pero la valoración sigue siendo responsabilidad profesional.', placement: 'bottom' },
  { view: 'programs', target: '[data-audit-nav="programs"]', title: '09 · Programas de auditoría', description: 'Organiza procedimientos por rubro, objetivo, afirmación, responsable y riesgo cubierto.', tip: 'El avance se calcula con procedimientos y revisiones válidas, no con un porcentaje manual.', placement: 'bottom' },
  { view: 'sampling', target: '[data-audit-nav="sampling"]', title: '10 · Muestreo de auditoría', description: 'Selecciona partidas desde una población contable validada, conservando método, parámetros, semilla y versión reproducible.', tip: 'Una población incompleta o no conciliada no debe producir una selección definitiva.', placement: 'bottom' },
  { view: 'workpapers', target: '[data-audit-nav="workpapers"]', title: '11 · Papeles de trabajo y pruebas', description: 'Documenta procedimientos, saldos, marcas, evidencias, resultados y conclusiones en versiones revisables.', tip: 'Una versión aprobada no se sobrescribe: una modificación crea una nueva revisión.', placement: 'bottom' },
  { view: 'pbc', target: '[data-audit-nav="pbc"]', title: '12 · Centro documental y PBC', description: 'Solicita información al cliente, recibe documentos por un acceso restringido y registra revisión, aceptación, rechazo e historial.', tip: 'El cliente solo debe ver sus solicitudes autorizadas, no el expediente completo.', placement: 'bottom' },
  { view: 'findings', target: '[data-audit-nav="findings"]', title: '13 · Hallazgos, incorrecciones y ajustes', description: 'Convierte excepciones en hallazgos documentados, relaciona evidencia, cuantifica incorrecciones y propone ajustes cuando corresponda.', tip: 'No todo hallazgo es monetario; una deficiencia de control puede terminar en recomendación.', placement: 'bottom' },
  { view: 'reviews', target: '[data-audit-nav="reviews"]', title: '14 · Supervisión y aprobaciones', description: 'Revisa versiones de papeles, registra observaciones, valida segregación de funciones y aprueba o devuelve el trabajo.', tip: 'Cada decisión pertenece a una versión específica del documento.', placement: 'bottom' },
  { view: 'reports', target: '[data-audit-nav="reports"]', title: '15 · Conclusiones e informes', description: 'Consolida conclusiones, evalúa incorrecciones y materialidad, redacta el informe y controla su autorización y emisión.', tip: 'La plataforma ayuda a documentar; la opinión profesional no se decide automáticamente.', placement: 'bottom' },
  { view: 'archive', target: '[data-audit-nav="archive"]', title: '16 · Cierre, archivo y seguimiento', description: 'Valida el checklist final, genera el manifiesto documental, protege el expediente y continúa el seguimiento de recomendaciones.', tip: 'La reapertura excepcional requiere autorización, motivo, nueva versión y trazabilidad.', placement: 'bottom' },
];

function isAuthError(error: unknown) {
  const status = Number((error as { status?: number })?.status || 0);
  return status === 401 || status === 403;
}

function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  const tones = {
    success: 'bg-[#e5f5e9] text-[#16724e]',
    warning: 'bg-[#fff4d8] text-[#986b00]',
    danger: 'bg-[#ffe3e5] text-[#c93646]',
    info: 'bg-[#e1f1f8] text-[#17617d]',
    neutral: 'bg-[#edf1ef] text-[#62736c]',
  };
  return <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold whitespace-nowrap', tones[tone])}><span className="size-1.5 rounded-full bg-current" />{label}</span>;
}

function RiskPill({ risk }: { risk: AuditRisk }) {
  return <StatusPill label={risk} tone={risk === 'Alto' ? 'danger' : risk === 'Medio' ? 'warning' : 'success'} />;
}

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-serif text-[17px] font-semibold tracking-[-0.02em] text-[#18382d]">{title}</h2>{action && <button type="button" onClick={onAction} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#177a53] hover:text-[#0b5238]">{action}<ChevronRight className="size-3.5" /></button>}</div>;
}

function IntegrationNotice({ isDemo, message }: { isDemo: boolean; message?: string }) {
  if (!isDemo) return null;
  return <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#f0dba4] bg-[#fff9e9] px-3 py-2.5 text-[11px] text-[#7d5d10] shadow-sm"><Activity className="mt-0.5 size-4 shrink-0" /><span><strong>Sin conexión con la API.</strong> La vista no debe considerarse persistida hasta que el endpoint responda correctamente. {message || 'Revisa la organización de auditoría seleccionada y el estado del backend.'}</span></div>;
}

function AuditDataUnavailable({ title, onRetry }: { title: string; onRetry: () => void }) {
  return <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-[#cbded1] bg-white/80 p-8 text-center"><div className="max-w-md"><Activity className="mx-auto size-9 text-[#6aa97a]" /><h1 className="mt-3 font-serif text-[24px] font-semibold italic text-[#183e30]">{title} no disponible</h1><p className="mt-2 text-[11px] leading-5 text-[#7d9086]">La API no devolvió información para esta organización. Verifica el contexto de auditoría y vuelve a intentar.</p><button type="button" onClick={onRetry} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[#075239] px-4 text-[11px] font-bold text-white"><RefreshCw className="size-3.5" />Reintentar</button></div></div>;
}

type AuditTenantOption = { id: string; name: string; slug?: string; businessType?: string; plan?: string };

function AuditTenantContextBar({ tenants, selectedId, onChange, isLoading, error, onStartTour }: { tenants: AuditTenantOption[]; selectedId: string; onChange: (value: string) => void; isLoading: boolean; error?: string; onStartTour: () => void }) {
  return <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#cfe5d4] bg-[#eff9f0] px-3 py-2.5 shadow-[0_5px_18px_rgba(13,66,45,0.04)]"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#2b8052]">Contexto aislado de auditoría</p><p className="mt-0.5 text-[11px] text-[#5d7568]">Selecciona una organización para consultar y crear datos reales dentro de su propio tenant.</p></div><div className="flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={onStartTour} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#bcd9c4] bg-white px-3 text-[10px] font-black text-[#276a4b] transition hover:border-[#75b88a] hover:bg-[#f4fbf4]" aria-label="Iniciar tour guiado de NovaHub Audit"><Route className="size-3.5" />Tour de los 16 módulos</button><label className="text-[10px] font-bold text-[#557064]" htmlFor="audit-tenant-context">Organización</label><select id="audit-tenant-context" value={selectedId} onChange={event => onChange(event.target.value)} disabled={isLoading || !tenants.length} className="h-9 min-w-[230px] rounded-lg border border-[#bcd9c4] bg-white px-2.5 text-[11px] font-semibold text-[#315845] outline-none focus:border-[#3d9863] focus:ring-2 focus:ring-[#d0ecd6]"><option value="">{isLoading ? 'Cargando organizaciones…' : tenants.length ? 'Seleccionar organización…' : 'Sin organizaciones activas'}</option>{tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name}{tenant.businessType ? ` · ${tenant.businessType}` : ''}</option>)}</select></div>{error && <p className="basis-full text-[10px] font-semibold text-[#b0444c]">No se pudo cargar el contexto de Audit: {error}</p>}</div>;
}

function AuditContextRequired({ tenants, selectedId, onChange, isLoading, error }: { tenants: AuditTenantOption[]; selectedId: string; onChange: (value: string) => void; isLoading: boolean; error?: string }) {
  return <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-[#bcd9c4] bg-white/80 p-8 text-center shadow-[0_10px_30px_rgba(13,66,45,0.04)]"><div className="max-w-lg"><div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#e4f5e7] text-[#2d8b5c]"><Building2 className="size-8" /></div><p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-[#5aa46e]">Contexto requerido</p><h1 className="mt-2 font-serif text-[32px] font-semibold italic text-[#183e30]">Activa una organización para NovaHub Audit</h1><p className="mt-3 text-[12px] leading-6 text-[#7f9188]">El Superadmin puede administrar varias organizaciones, pero los expedientes de auditoría siempre se consultan dentro de una sola organización para conservar el aislamiento de datos.</p><div className="mt-5 flex justify-center"><select value={selectedId} onChange={event => onChange(event.target.value)} disabled={isLoading || !tenants.length} className="h-10 min-w-[280px] rounded-lg border border-[#bcd9c4] bg-white px-3 text-[11px] font-semibold text-[#315845] outline-none focus:border-[#3d9863]"><option value="">{isLoading ? 'Cargando organizaciones…' : tenants.length ? 'Seleccionar organización…' : 'Sin organizaciones activas'}</option>{tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></div>{error && <p className="mt-3 text-[10px] font-semibold text-[#b0444c]">{error}</p>}</div></div>;
}

const auditSubviewCopy: Record<string, { title: string; description: string; rows: string[] }> = {
  'Materialidad': { title: 'Materialidad y umbrales', description: 'Define la base financiera, materialidad global, materialidad de ejecución y umbral de diferencias del encargo.', rows: ['Base financiera y período', 'Materialidad global y porcentaje aplicado', 'Materialidad de ejecución', 'Umbral de diferencias', 'Historial de versiones'] },
  'Estrategia de auditoría': { title: 'Estrategia de auditoría', description: 'Documenta el enfoque, alcance, procedimientos clave y recursos que regirán la ejecución.', rows: ['Enfoque basado en riesgos', 'Objetivos del encargo', 'Procedimientos sustantivos y de controles', 'Recursos y responsables', 'Aprobación de estrategia'] },
  'Áreas y afirmaciones': { title: 'Áreas y afirmaciones', description: 'Relaciona rubros contables, saldos, riesgos y afirmaciones para definir las áreas significativas.', rows: ['Áreas contables significativas', 'Afirmaciones aplicables', 'Saldos de referencia', 'Riesgos vinculados', 'Cobertura planificada'] },
  'Cronograma': { title: 'Cronograma del encargo', description: 'Administra fechas, hitos y dependencias de las fases de auditoría.', rows: ['Aceptación e independencia', 'Planificación', 'Procedimientos', 'Revisión y conclusiones', 'Informe y comunicación'] },
  'Equipo y recursos': { title: 'Equipo y recursos', description: 'Asigna responsables, revisores y capacidad de trabajo sin salir del expediente.', rows: ['Socio responsable', 'Gerente y supervisor', 'Auditores asignados', 'Carga estimada', 'Fechas de disponibilidad'] },
  'Documentos': { title: 'Documentos de planificación', description: 'Centraliza los documentos que respaldan la estrategia y materialidad del encargo.', rows: ['Plan de auditoría', 'Memorando de estrategia', 'Cálculo de materialidad', 'Cronograma', 'Requerimientos PBC'] },
  'Notas y observaciones': { title: 'Notas y observaciones', description: 'Registra asuntos pendientes y comentarios de revisión asociados al plan.', rows: ['Notas pendientes', 'Notas resueltas', 'Responsable', 'Fecha objetivo', 'Estado de resolución'] },
  'Catálogo de cuentas': { title: 'Catálogo de cuentas', description: 'Consulta y homologa las cuentas recibidas para que la balanza y las cédulas utilicen una estructura consistente.', rows: ['Código de cuenta', 'Nombre y rubro', 'Cuenta NovaHub Audit', 'Tipo de saldo', 'Estado de homologación'] },
  'Versiones y conciliaciones': { title: 'Versiones y conciliaciones', description: 'Revisa los conjuntos contables publicados y la conciliación debe/haber de cada versión.', rows: ['Versión vigente', 'Versiones anteriores', 'Filas recibidas y válidas', 'Diferencia debe / haber', 'Impacto pendiente'] },
  'Historial de errores': { title: 'Historial de errores', description: 'Consulta incidencias de importación, correcciones aplicadas y responsable de cada validación.', rows: ['Incidencias bloqueantes', 'Incidencias corregidas', 'Fecha de validación', 'Usuario responsable', 'Versión afectada'] },
  'Conexiones ERP': { title: 'Conexiones ERP', description: 'Configura fuentes autorizadas de información contable y conserva el origen de cada carga.', rows: ['Fuente conectada', 'Última sincronización', 'Período disponible', 'Cuenta de servicio', 'Estado de autorización'] },
  'Cédulas sumarias': { title: 'Cédulas sumarias', description: 'Agrupa saldos por área y relaciona cada cédula con riesgos, procedimientos y evidencia.', rows: ['Referencia de cédula', 'Saldo original y ajustado', 'Riesgos vinculados', 'Procedimientos', 'Estado de revisión'] },
  'Ajustes propuestos': { title: 'Ajustes propuestos', description: 'Consulta diferencias y asientos de auditoría separados de la contabilidad original.', rows: ['Ajustes pendientes', 'Debe y haber', 'Materialidad relacionada', 'Aprobación requerida', 'Efecto en conclusiones'] },
  'Períodos comparativos': { title: 'Períodos comparativos', description: 'Compara saldos de los períodos seleccionados manteniendo la versión contable de origen.', rows: ['Período actual', 'Período comparativo', 'Variación absoluta', 'Variación porcentual', 'Explicaciones requeridas'] },
  'Referencias cruzadas': { title: 'Referencias cruzadas', description: 'Navega entre cuentas, cédulas, riesgos, procedimientos, papeles y evidencias relacionadas.', rows: ['Cuenta y referencia', 'Cédula asociada', 'Riesgos', 'Procedimientos', 'Papeles de trabajo'] },
  'Integridad de saldos': { title: 'Integridad de saldos', description: 'Verifica que la versión publicada concilie y que los ajustes permanezcan separados del origen.', rows: ['Integridad del dataset', 'Balance debe / haber', 'Duplicados', 'Revisión de ajustes', 'Controles pendientes'] },
  'Mapa de calor': { title: 'Mapa de calor', description: 'Visualiza impacto y probabilidad para priorizar la respuesta profesional a los riesgos.', rows: ['Impacto', 'Probabilidad', 'Riesgos críticos', 'Riesgos altos', 'Celdas seleccionadas'] },
  'Matriz de controles': { title: 'Matriz de controles', description: 'Relaciona controles con riesgos y documenta diseño, implementación y eficacia.', rows: ['Control relacionado', 'Diseño', 'Implementación', 'Prueba de eficacia', 'Responsable'] },
  'Afirmaciones': { title: 'Afirmaciones financieras', description: 'Consulta las afirmaciones afectadas por cada riesgo y su cobertura de auditoría.', rows: ['Existencia', 'Integridad', 'Corte', 'Valuación', 'Derechos y obligaciones'] },
  'Procedimientos vinculados': { title: 'Procedimientos vinculados', description: 'Identifica la respuesta de auditoría y los programas que cubren cada riesgo.', rows: ['Procedimiento', 'Tipo de prueba', 'Responsable', 'Estado', 'Cobertura'] },
  'Revisión e historial': { title: 'Revisión e historial de riesgos', description: 'Conserva las versiones de valoración, revisiones metodológicas y decisiones del equipo.', rows: ['Versión de evaluación', 'Revisor', 'Cambios registrados', 'Observaciones', 'Envío a revisión'] },
  Procedimientos: { title: 'Procedimientos del programa', description: 'Expande cada programa para ejecutar pruebas, documentar resultados y relacionar evidencias.', rows: ['Código y objetivo', 'Afirmación', 'Responsable', 'Fecha objetivo', 'Estado de ejecución'] },
  'Cobertura de riesgos': { title: 'Cobertura de riesgos', description: 'Muestra qué riesgos están cubiertos por programas y cuáles requieren una respuesta adicional.', rows: ['Riesgos cubiertos', 'Riesgos sin respuesta', 'Procedimientos sustantivos', 'Pruebas de controles', 'Brechas de cobertura'] },
  Asignaciones: { title: 'Asignaciones del programa', description: 'Administra responsables, revisores y fechas de los procedimientos.', rows: ['Auditor asignado', 'Supervisor', 'Carga estimada', 'Fecha de inicio', 'Fecha de vencimiento'] },
  Revisión: { title: 'Revisión de programas', description: 'Envía los programas a revisión y conserva las observaciones por versión.', rows: ['Preparación', 'Revisión metodológica', 'Aprobación para ejecución', 'Notas abiertas', 'Historial de versiones'] },
  'Biblioteca metodológica': { title: 'Biblioteca metodológica', description: 'Selecciona plantillas de procedimientos y adáptalas al riesgo y alcance del encargo.', rows: ['Plantillas disponibles', 'Objetivos', 'Afirmaciones', 'Procedimientos sugeridos', 'Última actualización'] },
  Población: { title: 'Población auditada', description: 'Consulta el conjunto de movimientos validado que alimenta el plan de muestreo.', rows: ['Dataset de origen', 'Partidas elegibles', 'Partidas excluidas', 'Integridad', 'Conciliación'] },
  Selección: { title: 'Selección reproducible', description: 'Configura método, parámetros, semilla y estratificación de la muestra.', rows: ['Método', 'Tamaño de muestra', 'Semilla', 'Estratificación', 'Exclusiones justificadas'] },
  Resultados: { title: 'Resultados de la muestra', description: 'Registra partidas examinadas, errores identificados y estado de cada prueba.', rows: ['Partidas seleccionadas', 'Partidas probadas', 'Excepciones', 'Importe de errores', 'Acciones pendientes'] },
  Evaluación: { title: 'Evaluación de errores', description: 'Documenta la evaluación profesional y la proyección de errores sin concluir automáticamente la auditoría.', rows: ['Errores identificados', 'Proyección', 'Materialidad', 'Conclusión profesional', 'Revisión requerida'] },
  Versiones: { title: 'Versiones de la muestra', description: 'Conserva el origen, semilla y cambios de cada selección para permitir su reproducción.', rows: ['Versión', 'Dataset de origen', 'Semilla utilizada', 'Cambios', 'Estado de vigencia'] },
  'Espacio de trabajo': { title: 'Espacio de trabajo', description: 'Organiza los papeles por rubro, referencia y procedimiento.', rows: ['Explorador del expediente', 'Papel seleccionado', 'Evidencias', 'Notas del revisor', 'Versión vigente'] },
  Pruebas: { title: 'Pruebas de auditoría', description: 'Registra resultados de pruebas y relaciona partidas examinadas con evidencia.', rows: ['Procedimiento', 'Partidas', 'Resultado', 'Excepciones', 'Conclusión'] },
  Evidencias: { title: 'Evidencias vinculadas', description: 'Consulta documentación aceptada y su relación con papeles y procedimientos.', rows: ['Documento', 'Referencia', 'Estado', 'Fecha de aceptación', 'Papel relacionado'] },
  'Notas del revisor': { title: 'Notas del revisor', description: 'Documenta observaciones sobre una versión concreta del papel de trabajo.', rows: ['Nota abierta', 'Responsable', 'Prioridad', 'Respuesta del preparador', 'Estado'] },
  'Bandeja de documentos': { title: 'Bandeja de documentos', description: 'Organiza solicitudes PBC, documentos recibidos y pendientes de revisión.', rows: ['Solicitudes', 'Documentos recibidos', 'En revisión', 'Vencidos', 'Evidencias aceptadas'] },
  'Portal del cliente': { title: 'Portal seguro del cliente', description: 'Comparte únicamente las solicitudes autorizadas para que el cliente entregue información.', rows: ['Enlace temporal', 'Permisos', 'Recepción', 'Conversación', 'Historial de acceso'] },
  Revisiones: { title: 'Revisiones documentales', description: 'Acepta o rechaza documentos recibidos con motivo y conserva su historial.', rows: ['Documento recibido', 'Integridad', 'Revisión', 'Motivo de rechazo', 'Nueva entrega'] },
  'Calendario PBC': { title: 'Calendario PBC', description: 'Da seguimiento a vencimientos, recordatorios y prioridades de solicitudes.', rows: ['Fecha de solicitud', 'Vencimiento', 'Prioridad', 'Recordatorio', 'Responsable'] },
  Hallazgos: { title: 'Registro de hallazgos', description: 'Relaciona excepciones con pruebas, evidencia, riesgos e incorrecciones.', rows: ['Condición', 'Criterio', 'Causa', 'Efecto', 'Respuesta de gerencia'] },
  Incorrecciones: { title: 'Incorrecciones', description: 'Evalúa diferencias individual y acumuladamente frente a la materialidad vigente.', rows: ['Importe individual', 'Importe acumulado', 'Materialidad', 'Corregida', 'Conclusión'] },
  Comunicaciones: { title: 'Comunicaciones a gerencia', description: 'Documenta respuestas, solicitudes de aclaración y comunicaciones relacionadas con hallazgos.', rows: ['Asunto', 'Destinatario', 'Fecha', 'Respuesta', 'Estado'] },
  Seguimiento: { title: 'Seguimiento de hallazgos', description: 'Controla compromisos y respuestas posteriores sin perder el historial original.', rows: ['Acción', 'Responsable', 'Vencimiento', 'Evidencia', 'Verificación'] },
  Historial: { title: 'Historial de hallazgos', description: 'Consulta versiones, decisiones y cambios efectuados sobre las observaciones.', rows: ['Versión', 'Cambio', 'Usuario', 'Fecha', 'Justificación'] },
  'Bandeja del revisor': { title: 'Bandeja del revisor', description: 'Prioriza papeles pendientes por criticidad, vencimiento y notas abiertas.', rows: ['Papel pendiente', 'Preparador', 'Prioridad', 'Notas', 'Acción'] },
  'Papeles enviados': { title: 'Papeles enviados', description: 'Consulta versiones remitidas a supervisión y su estado de revisión.', rows: ['Papel', 'Versión', 'Fecha de envío', 'Revisor', 'Estado'] },
  'Notas de revisión': { title: 'Notas de revisión', description: 'Gestiona observaciones abiertas y respuestas asociadas a cada versión.', rows: ['Nota', 'Documento', 'Prioridad', 'Responsable', 'Estado'] },
  Aprobaciones: { title: 'Aprobaciones', description: 'Verifica la cadena de preparación, revisión y aprobación con segregación de funciones.', rows: ['Preparador', 'Supervisor', 'Socio', 'Versión', 'Estado'] },
  'Calidad del encargo': { title: 'Calidad del encargo', description: 'Ejecuta controles de calidad y revisa bloqueos antes del cierre.', rows: ['Control', 'Resultado', 'Dependencia', 'Bloqueo', 'Revisión'] },
  'Borradores': { title: 'Borradores del informe', description: 'Consulta versiones del informe y conserva el fundamento de cada revisión.', rows: ['Versión', 'Opinión en evaluación', 'Conclusiones', 'Revisor', 'Estado'] },
  'Vista previa': { title: 'Vista previa del informe', description: 'Previsualiza el documento antes de solicitar autorización o emitirlo.', rows: ['Portada', 'Opinión', 'Fundamento', 'Responsabilidades', 'Página'] },
  'Revisión y firmas': { title: 'Revisión de opinión y firmas', description: 'Controla requisitos de cierre, autorización del socio y firma de emisión.', rows: ['Tipo de opinión', 'Materialidad final', 'Requisitos pendientes', 'Revisión gerente', 'Aprobación socio'] },
  Emisión: { title: 'Emisión controlada', description: 'Emite únicamente cuando las condiciones profesionales y de cierre están cumplidas.', rows: ['Checklist de emisión', 'Versión definitiva', 'Autorizaciones', 'Fecha de emisión', 'Exportación'] },
  'Preparación de cierre': { title: 'Preparación de cierre', description: 'Verifica completitud del expediente antes de bloquearlo como archivo histórico.', rows: ['Carta e informe', 'Materialidad final', 'Papeles aprobados', 'Manifestaciones', 'Revisión de calidad'] },
  'Paquete de archivo': { title: 'Paquete documental y custodia', description: 'Genera el inventario digital y manifiesto de las versiones que sustentan el informe.', rows: ['Inventario de archivos', 'Categorías documentales', 'Versiones', 'Integridad', 'Retención'] },
  Retención: { title: 'Retención y custodia', description: 'Consulta la política de conservación, protección y acceso controlado del expediente.', rows: ['Inicio de retención', 'Tiempo de conservación', 'Protección', 'Accesos', 'Manifiesto'] },
  'Historial de acceso': { title: 'Historial de acceso', description: 'Audita accesos al expediente protegido y las operaciones posteriores autorizadas.', rows: ['Usuario', 'Operación', 'Fecha', 'Documento', 'Resultado'] },
  Reaperturas: { title: 'Reaperturas excepcionales', description: 'Registra justificación, autorización y nueva versión cuando un archivo protegido debe reabrirse.', rows: ['Motivo', 'Usuario solicitante', 'Autorizador', 'Nueva versión', 'Trazabilidad'] },
};

function AuditSubviewPanel({ label, onClose }: { label: string; onClose: () => void }) {
  const copy = auditSubviewCopy[label] || { title: label, description: 'Vista interna del expediente de auditoría con información agrupada y acciones específicas del módulo.', rows: ['Resumen del módulo', 'Registros vigentes', 'Responsable', 'Estado', 'Historial'] };
  return <section className="mb-4 rounded-2xl border border-[#cfe5d4] bg-white p-4 shadow-[0_10px_28px_rgba(13,66,45,0.06)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#4b9e69]">Vista interna de Audit</p><h2 className="mt-1 font-serif text-[26px] font-semibold italic text-[#143e2e]">{copy.title}</h2><p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#7a8e83]">{copy.description}</p></div><button type="button" onClick={onClose} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dce8e1] px-3 text-[10px] font-bold text-[#557066] hover:bg-[#f0f8f1]"><X className="size-3.5" />Volver al módulo</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{copy.rows.map((row, index) => <div key={row} className="rounded-xl border border-[#e7efea] bg-[#fbfefb] p-3"><p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#8b9d93]">{row}</p><p className="mt-2 text-[12px] font-black text-[#2d624b]">{index === 0 ? 'Disponible' : 'Consultar expediente'}</p></div>)}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => toast.success(`${copy.title}: cambios guardados en el contexto de la organización.`)} className="h-9 rounded-lg bg-[#075239] px-3 text-[10px] font-bold text-white">Guardar cambios</button><button type="button" onClick={() => toast.success(`${copy.title}: información actualizada.`)} className="h-9 rounded-lg border border-[#cfe1d5] bg-white px-3 text-[10px] font-bold text-[#337451]">Actualizar</button></div></section>;
}

function AuditKpiCard({ label, value, trend, detail, direction, tone = 'default', index }: { label: string; value: string; trend: string; detail: string; direction: 'up' | 'down'; tone?: 'default' | 'danger'; index: number }) {
  const points = [10, 14, 12, 20, 17, 23, 21, 27, 24, 31, 28].map((point, pointIndex) => point + ((index + pointIndex) % 3) * 2);
  const path = points.map((point, pointIndex) => `${pointIndex * 10},${36 - point}`).join(' ');
  return <article className="group min-w-0 rounded-xl border border-[#e8eeeb] bg-white/90 p-3.5 shadow-[0_6px_20px_rgba(13,66,45,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(13,66,45,0.09)]"><div className="flex items-start justify-between gap-2"><div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tone === 'danger' ? 'bg-[#fff0f0] text-[#e45059]' : 'bg-[#e7f5e9] text-[#24845b]')}><span className="text-[15px] font-black">{index === 5 ? '◎' : index === 3 ? '!' : index === 4 ? '▱' : index === 2 ? '⌕' : index === 1 ? '▶' : '▦'}</span></div><svg viewBox="0 0 100 36" className={cn('h-8 w-16', tone === 'danger' ? 'text-[#f0646d]' : 'text-[#3a9d6b')} aria-hidden="true"><polyline points={path} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></div><p className="mt-3 text-[11px] font-semibold text-[#60716a]">{label}</p><div className="mt-0.5 flex items-end justify-between gap-2"><p className="text-[25px] font-black tracking-[-0.06em] text-[#0c4533]">{value}</p><span className={cn('mb-1 inline-flex items-center text-[10px] font-black', direction === 'down' ? 'text-[#df4e58]' : 'text-[#4b9b6b]')}>{direction === 'down' ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}{trend}</span></div><p className="mt-0.5 text-[9px] text-[#91a09a]">{detail}</p></article>;
}

function StackedProgressChart({ data }: { data: AuditDashboardData['progressSeries'] }) {
  const max = Math.max(...data.map(item => item.completed + item.running + item.review + item.planned + item.notStarted), 1);
  return <div className="rounded-xl border border-[#e8eeeb] bg-white p-4 shadow-[0_6px_20px_rgba(13,66,45,0.04)]"><SectionHeading title="Avance global de encargos" action="Acumulado" /><p className="-mt-2 mb-4 text-[10px] text-[#94a29c]">Evolución mensual del estado de los encargos · 2025</p><div className="flex h-[182px] items-end gap-2 border-b border-l border-[#e7ece9] px-3 pb-0 pt-4 sm:gap-3">{data.map((item) => { const parts = [item.completed, item.running, item.review, item.planned, item.notStarted]; return <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch"><div className="flex h-full w-full max-w-[28px] flex-col justify-end overflow-hidden rounded-t-[4px] bg-[#f1f4f2]" title={`${item.month}: ${parts.reduce((a, b) => a + b, 0)} encargos`}>{parts.map((value, index) => <span key={index} className={cn('block w-full', index === 0 ? 'bg-[#08704d]' : index === 1 ? 'bg-[#369d6b]' : index === 2 ? 'bg-[#8acb6e]' : index === 3 ? 'bg-[#c9e8bf]' : 'bg-[#dde4e0]')} style={{ height: `${Math.max((value / max) * 100, 2)}%` }} />)}</div><span className="text-[9px] font-semibold text-[#8b9a94]">{item.month}</span></div>; })}</div><div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[9px] font-semibold text-[#80918a]"><span><i className="mr-1 inline-block size-2 rounded-sm bg-[#08704d]" />Completados</span><span><i className="mr-1 inline-block size-2 rounded-sm bg-[#369d6b]" />En ejecución</span><span><i className="mr-1 inline-block size-2 rounded-sm bg-[#8acb6e]" />En revisión</span><span><i className="mr-1 inline-block size-2 rounded-sm bg-[#c9e8bf]" />Planificados</span></div></div>;
}

function DistributionCard({ data }: { data: AuditDashboardData['auditDistribution'] }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
  const gradient = data.reduce<{ cursor: number; segments: string[] }>((result, item) => {
    const start = result.cursor;
    const cursor = start + (Number(item.value || 0) / total) * 100;
    return { cursor, segments: [...result.segments, `${item.color} ${start}% ${cursor}%`] };
  }, { cursor: 0, segments: [] }).segments.join(', ');
  return <div className="rounded-xl border border-[#e8eeeb] bg-white p-4 shadow-[0_6px_20px_rgba(13,66,45,0.04)]"><SectionHeading title="Distribución por tipo de auditoría" action="···" /><p className="-mt-2 mb-4 text-[10px] text-[#94a29c]">Número de encargos · Ejercicio 2025</p><div className="flex items-center gap-4"><div className="relative flex size-[118px] shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}><div className="flex size-[70px] flex-col items-center justify-center rounded-full bg-white"><strong className="text-[22px] tracking-[-0.06em] text-[#154735]">{total}</strong><span className="text-[9px] text-[#93a19b]">Encargos</span></div></div><div className="min-w-0 flex-1 space-y-2">{data.map(item => <div key={item.label} className="flex items-center gap-1.5 text-[10px]"><span className="size-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="min-w-0 flex-1 truncate text-[#60716a]">{item.label}</span><strong className="text-[#365348]">{item.value}</strong><span className="w-9 text-right text-[#a3afaa]">{Math.round((item.value / total) * 100)}%</span></div>)}</div></div></div>;
}

function DeadlinesCard({ data }: { data: AuditDashboardData['deadlines'] }) {
  return <div className="rounded-xl border border-[#e8eeeb] bg-white p-4 shadow-[0_6px_20px_rgba(13,66,45,0.04)]"><SectionHeading title="Próximos vencimientos y hitos" action="Ver todos" /><div className="divide-y divide-[#edf1ef]">{data.map(item => <div key={`${item.date}-${item.title}`} className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0"><div className={cn('flex size-9 shrink-0 flex-col items-center justify-center rounded-lg text-[9px] font-black', item.tone === 'danger' ? 'bg-[#fff0f0] text-[#d64b55]' : item.tone === 'warning' ? 'bg-[#fff5dd] text-[#aa7809]' : 'bg-[#e9f4ee] text-[#39815d]')}><span>{item.date.split(' ')[0]}</span><span className="text-[8px] font-semibold uppercase">{item.date.split(' ')[1]}</span></div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-[#2c4a3d]">{item.title}</p><p className="truncate text-[9px] text-[#9aa8a2]">{item.client}</p></div><span className={cn('rounded-md px-2 py-1 text-[9px] font-bold', item.tone === 'danger' ? 'bg-[#fff0f0] text-[#d64b55]' : item.tone === 'warning' ? 'bg-[#fff5dd] text-[#aa7809]' : 'bg-[#eef3f0] text-[#71827b]')}>{item.days}</span></div>)}</div></div>;
}

function EngagementTable({ data, onOpenClients }: { data: AuditDashboardData['engagements']; onOpenClients: () => void }) {
  return <div className="rounded-xl border border-[#e8eeeb] bg-white p-4 shadow-[0_6px_20px_rgba(13,66,45,0.04)] xl:col-span-2"><SectionHeading title="Encargos en curso" action="Ver todos" onAction={onOpenClients} /><div className="mb-3 flex items-center gap-4 border-b border-[#edf1ef] text-[10px] font-bold text-[#8d9c95]"><button type="button" className="border-b-2 border-[#188457] pb-2 text-[#188457]">Todos <span className="ml-1 rounded-full bg-[#e7f5e9] px-1.5 py-0.5">24</span></button><button type="button" className="pb-2 hover:text-[#188457]">En ejecución 11</button><button type="button" className="pb-2 hover:text-[#188457]">En revisión 6</button><button type="button" className="hidden pb-2 hover:text-[#188457] sm:inline">Completados 3</button></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[10px]"><thead className="text-[9px] uppercase tracking-[0.08em] text-[#9aa8a2]"><tr><th className="pb-2 pr-2">Código</th><th className="pb-2 pr-2">Cliente</th><th className="pb-2 pr-2">Tipo</th><th className="pb-2 pr-2">Socio</th><th className="pb-2 pr-2">Estado</th><th className="pb-2 pr-2">Avance</th><th className="pb-2">Cierre</th></tr></thead><tbody className="divide-y divide-[#f0f3f1]">{data.map(item => <tr key={item.code} className="group"><td className="py-2 pr-2 font-black text-[#3b584c]">{item.code}</td><td className="max-w-[170px] truncate py-2 pr-2 font-semibold text-[#60716a]">{item.client}</td><td className="py-2 pr-2 text-[#7d8d86]">{item.type}</td><td className="py-2 pr-2 text-[#7d8d86]">{item.partner}</td><td className="py-2 pr-2"><StatusPill label={item.status} tone={item.status === 'En revisión' ? 'info' : item.status === 'Planificación' ? 'neutral' : 'success'} /></td><td className="py-2 pr-2"><div className="flex items-center gap-2"><div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#e6ede9]"><span className="block h-full rounded-full bg-[#188457]" style={{ width: `${item.progress}%` }} /></div><span className="font-bold text-[#688078]">{item.progress}%</span></div></td><td className="py-2 text-[#7d8d86]">{item.closeDate}</td></tr>)}</tbody></table></div></div>;
}

function FindingsCard({ data }: { data: AuditDashboardData['findingsByArea'] }) {
  return <div className="rounded-xl border border-[#e8eeeb] bg-white p-4 shadow-[0_6px_20px_rgba(13,66,45,0.04)]"><SectionHeading title="Hallazgos por área contable" action="Ver detalle" /><div className="mb-2 grid grid-cols-[1fr_38px_38px] gap-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[#a0aca7]"><span>Área</span><span className="text-right">Total</span><span className="text-right">Críticos</span></div><div className="space-y-2.5">{data.map(item => <div key={item.area} className="grid grid-cols-[1fr_38px_38px] items-center gap-2 text-[10px]"><span className="min-w-0 truncate font-semibold text-[#65776e]">{item.area}</span><span className="text-right font-bold text-[#52665c]">{item.total}</span><span className={cn('text-right font-black', item.critical > 0 ? 'text-[#e2585d]' : 'text-[#698377]')}>{item.critical}</span><span className="col-span-3 h-1.5 overflow-hidden rounded-full bg-[#edf1ef]"><span className={cn('block h-full rounded-full', item.tone === 'danger' ? 'bg-[#eb5b61]' : item.tone === 'warning' ? 'bg-[#e8af1c]' : 'bg-[#61ae62]')} style={{ width: `${item.width}%` }} /></span></div>)}</div></div>;
}

function RisksCard({ data }: { data: AuditDashboardData['significantRisks'] }) {
  return <div className="rounded-xl border border-[#e8eeeb] bg-white p-4 shadow-[0_6px_20px_rgba(13,66,45,0.04)]"><SectionHeading title="Riesgos significativos" action="Ver todos" /><div className="space-y-2">{data.map(item => <div key={item.risk} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_auto] items-center gap-2 border-b border-[#f0f3f1] pb-2 text-[10px] last:border-0 last:pb-0"><div className="min-w-0"><p className="truncate font-bold text-[#486257]">{item.risk}</p><p className="truncate text-[9px] text-[#99a6a1]">{item.area}</p></div><RiskPill risk={item.level} /><span className="text-right text-[9px] font-semibold text-[#7b8c84]">{item.engagements} enc.</span><StatusPill label={item.status} tone={item.status === 'Pendiente' ? 'warning' : item.status === 'Monitoreo' ? 'info' : 'success'} /></div>)}</div></div>;
}

function WorkloadCard({ data }: { data: AuditDashboardData['teamWorkload'] }) {
  return <div className="rounded-xl border border-[#e8eeeb] bg-white p-4 shadow-[0_6px_20px_rgba(13,66,45,0.04)]"><SectionHeading title="Carga de trabajo del equipo" action="Porcentaje de utilización" /><div className="space-y-3">{data.map(item => <div key={item.name} className="flex items-center gap-2"><div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e1f1e5] text-[9px] font-black text-[#25815b]">{item.initials}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2 text-[10px]"><span className="truncate font-bold text-[#51685c]">{item.name}</span><span className="font-black text-[#4c6659]">{item.utilization}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e9efeb]"><span className={cn('block h-full rounded-full', item.tone === 'danger' ? 'bg-[#e85b5f]' : 'bg-[#198357]')} style={{ width: `${item.utilization}%` }} /></div></div></div>)}</div></div>;
}

function ActivityCard({ data }: { data: AuditDashboardData['recentActivity'] }) {
  return <div className="rounded-xl border border-[#e8eeeb] bg-white p-4 shadow-[0_6px_20px_rgba(13,66,45,0.04)]"><SectionHeading title="Actividad reciente" action="Ver todas" /><div className="space-y-3">{data.map(item => <div key={`${item.time}-${item.actor}`} className="flex gap-2.5"><div className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full', item.tone === 'warning' ? 'bg-[#fff2d5] text-[#d18a0e]' : item.tone === 'info' ? 'bg-[#e1f1f8] text-[#276f8c]' : 'bg-[#e2f4e7] text-[#278457]')}><Activity className="size-3" /></div><div className="min-w-0"><p className="text-[10px] leading-4 text-[#61746a]"><strong className="text-[#365347]">{item.actor}</strong> {item.description}</p><p className="truncate text-[9px] text-[#9ba8a2]">{item.client} · {item.time}</p></div></div>)}</div></div>;
}

function AuditNavigation({ activeView, onSelect }: { activeView: AuditView; onSelect: (view: AuditView) => void }) {
  return <div data-tour="audit-navigation" className="mb-5 flex items-center gap-1 overflow-x-auto rounded-xl border border-[#dce8e1] bg-[#0b4432] p-1.5 shadow-[0_10px_26px_rgba(8,70,45,0.12)]"><div className="mr-2 hidden shrink-0 items-center gap-2 px-2.5 text-white sm:flex"><span className="flex size-7 items-center justify-center rounded-lg bg-[#d0f27a] text-[#123f2f] font-black">N</span><span className="text-[11px] font-black tracking-[0.08em]">NOVA AUDIT</span></div>{auditNav.map(item => { const Icon = item.icon; return <button key={item.id} data-audit-nav={item.id} type="button" onClick={() => onSelect(item.id)} className={cn('flex min-w-max items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-bold transition', activeView === item.id ? 'bg-[#d8f18a] text-[#123f2f] shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white', !item.enabled && 'opacity-60')}><Icon className="size-3.5" />{item.shortLabel}</button>; })}</div>;
}

function AuditDashboardView({ data, onRefresh, onOpenClients, isFetching }: { data: AuditDashboardData; onRefresh: () => void; onOpenClients: () => void; isFetching: boolean }) {
  return <div className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="mb-1 flex items-center gap-2 text-[11px] font-bold text-[#53a965]"><span className="size-2 rounded-full bg-[#5db763] shadow-[0_0_0_4px_rgba(93,183,99,0.13)]" />Panel ejecutivo</div><h1 className="font-serif text-[32px] font-semibold italic tracking-[-0.04em] text-[#143e2e] sm:text-[39px]">Resumen de auditoría</h1><p className="mt-1 text-[12px] text-[#84948c]">Visión integral de encargos, riesgos, hallazgos y cumplimiento del plan <span className="mx-1 text-[#c6d0cb]">·</span> Ejercicio 2025</p></div><div className="flex items-center gap-2"><span className="hidden text-[10px] text-[#9aa8a1] md:inline">Actualizado hace 15 min · 10:42 a. m.</span><button type="button" onClick={onRefresh} className="flex size-9 items-center justify-center rounded-lg border border-[#dfe8e3] bg-white text-[#1c7651] shadow-sm hover:bg-[#f1f8f3]" aria-label="Actualizar resumen"> <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} /></button><button type="button" onClick={() => toast.success('El resumen se exportará cuando la API consolidada esté habilitada.')} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dfe8e3] bg-white px-3 text-[11px] font-bold text-[#49665a] shadow-sm hover:bg-[#f1f8f3]"><Download className="size-3.5" />Exportar</button><button type="button" onClick={() => toast.info('La vista 03 — Encargos — está lista para la siguiente entrega.')} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#075239] px-3 text-[11px] font-bold text-white shadow-[0_5px_16px_rgba(7,82,57,0.2)] hover:bg-[#063f2d]"><Plus className="size-4" />Nuevo encargo</button></div></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{data.kpis.map((kpi, index) => <AuditKpiCard key={kpi.label} {...kpi} direction={kpi.trendDirection} index={index} />)}</div><div className="grid gap-4 xl:grid-cols-[1.55fr_.8fr_1fr]"><StackedProgressChart data={data.progressSeries} /><DistributionCard data={data.auditDistribution} /><DeadlinesCard data={data.deadlines} /></div><div className="grid gap-4 xl:grid-cols-[1.7fr_.8fr]"><EngagementTable data={data.engagements} onOpenClients={onOpenClients} /><FindingsCard data={data.findingsByArea} /></div><div className="grid gap-4 xl:grid-cols-3"><RisksCard data={data.significantRisks} /><WorkloadCard data={data.teamWorkload} /><ActivityCard data={data.recentActivity} /></div><div className="rounded-xl border border-[#cfe7d6] bg-gradient-to-r from-[#effaf0] to-white p-3.5 text-[10px] text-[#59796a]"><div className="flex flex-wrap items-center gap-2"><FileCheck2 className="size-4 text-[#258457]" /><strong className="text-[#286348]">Ficha técnica de la vista</strong><span className="text-[#87a095]">22 componentes · 1 respuesta agrupada · filtros por ejercicio, estado, tipo y oficina</span></div></div></div>;
}

let activeClientKpis: AuditClientsData['kpis'] | null = null;

function ClientKpi({ icon: Icon, value, label, detail, tone = 'green' }: { icon: typeof Building2; value: string; label: string; detail?: string; tone?: 'green' | 'danger' }) {
  const metric = activeClientKpis && ({
    'Entidades registradas': String(activeClientKpis.entities),
    'Clientes activos': String(activeClientKpis.active),
    'Con encargos vigentes': String(activeClientKpis.withEngagements),
    'Documentos pendientes': String(activeClientKpis.pendingDocuments),
    'Clientes alto riesgo': String(activeClientKpis.highRisk).padStart(2, '0'),
  } as Record<string, string>)[label];
  return <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[#e8eeeb] bg-white px-3 py-2.5 shadow-[0_5px_17px_rgba(13,66,45,0.035)]"><div className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tone === 'danger' ? 'bg-[#fff0f0] text-[#e2535b]' : 'bg-[#e6f5e9] text-[#298359]')}><Icon className="size-4" /></div><div className="min-w-0"><div className="flex items-baseline gap-1.5"><strong className="text-[21px] font-black tracking-[-0.06em] text-[#143f2f]">{metric ?? value}</strong>{detail && <span className="text-[9px] font-bold text-[#5ba46d]">{detail}</span>}</div><p className="truncate text-[10px] font-semibold text-[#7c8d85]">{label}</p></div></div>;
}

type ClientFormState = { id?: string; personType: 'LEGAL_ENTITY' | 'NATURAL_PERSON'; name: string; commercialName: string; ruc: string; sector: string; city: string; partner: string; risk: AuditRisk; status: 'Activa' | 'Inactiva' };

const emptyClientForm: ClientFormState = { personType: 'LEGAL_ENTITY', name: '', commercialName: '', ruc: '', sector: '', city: '', partner: '', risk: 'Medio', status: 'Activa' };

function ClientModal({ form, setForm, onClose, onSave, saving }: { form: ClientFormState; setForm: (form: ClientFormState) => void; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  const set = (key: keyof ClientFormState, value: string) => setForm({ ...form, [key]: value });
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#052d20]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={form.id ? 'Editar cliente auditado' : 'Nuevo cliente auditado'}><form onSubmit={onSave} className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_28px_80px_rgba(1,53,35,0.25)]"><div className="flex items-start justify-between border-b border-[#e8eeeb] px-5 py-4"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#52a36b]">Directorio de auditoría</p><h2 className="mt-1 font-serif text-[22px] font-semibold text-[#183d30]">{form.id ? 'Editar cliente' : 'Registrar nuevo cliente'}</h2><p className="mt-1 text-[11px] text-[#87968f]">La información se reutiliza en encargos, aceptación y expedientes.</p></div><button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-[#769087] hover:bg-[#eef5f0] hover:text-[#17543d]" aria-label="Cerrar"><X className="size-4" /></button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#789087]">Tipo de persona</span><div className="grid grid-cols-2 gap-2">{[['LEGAL_ENTITY', 'Persona jurídica'], ['NATURAL_PERSON', 'Persona natural']].map(([value, label]) => <button key={value} type="button" onClick={() => set('personType', value)} className={cn('rounded-lg border px-3 py-2 text-left text-[11px] font-bold transition', form.personType === value ? 'border-[#4eaf6d] bg-[#edf9ee] text-[#1a704b]' : 'border-[#e2ebe5] text-[#71857b] hover:border-[#9ccbaa]')}>{label}</button>)}</div></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#789087]">{form.personType === 'LEGAL_ENTITY' ? 'Razón social' : 'Nombre completo'} *</span><input required value={form.name} onChange={event => set('name', event.target.value)} className="h-10 w-full rounded-lg border border-[#dbe7df] px-3 text-[12px] text-[#2b493c] outline-none focus:border-[#4da86a] focus:ring-2 focus:ring-[#bfe7c6]" placeholder="Ej. Comercial Pacífico, S.A." /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#789087]">Nombre comercial</span><input value={form.commercialName} onChange={event => set('commercialName', event.target.value)} className="h-10 w-full rounded-lg border border-[#dbe7df] px-3 text-[12px] text-[#2b493c] outline-none focus:border-[#4da86a] focus:ring-2 focus:ring-[#bfe7c6]" placeholder="Nombre para mostrar" /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#789087]">RUC / identificación *</span><input required value={form.ruc} onChange={event => set('ruc', event.target.value)} className="h-10 w-full rounded-lg border border-[#dbe7df] px-3 text-[12px] text-[#2b493c] outline-none focus:border-[#4da86a] focus:ring-2 focus:ring-[#bfe7c6]" placeholder="J0310001234567" /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#789087]">Sector</span><input value={form.sector} onChange={event => set('sector', event.target.value)} className="h-10 w-full rounded-lg border border-[#dbe7df] px-3 text-[12px] text-[#2b493c] outline-none focus:border-[#4da86a] focus:ring-2 focus:ring-[#bfe7c6]" placeholder="Comercial, industrial…" /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#789087]">Ciudad</span><input value={form.city} onChange={event => set('city', event.target.value)} className="h-10 w-full rounded-lg border border-[#dbe7df] px-3 text-[12px] text-[#2b493c] outline-none focus:border-[#4da86a] focus:ring-2 focus:ring-[#bfe7c6]" placeholder="Managua" /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#789087]">Socio responsable</span><input value={form.partner} onChange={event => set('partner', event.target.value)} className="h-10 w-full rounded-lg border border-[#dbe7df] px-3 text-[12px] text-[#2b493c] outline-none focus:border-[#4da86a] focus:ring-2 focus:ring-[#bfe7c6]" placeholder="María López" /></label><label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-[#789087]">Riesgo inicial</span><select value={form.risk} onChange={event => set('risk', event.target.value)} className="h-10 w-full rounded-lg border border-[#dbe7df] bg-white px-3 text-[12px] text-[#2b493c] outline-none focus:border-[#4da86a]"><option>Alto</option><option>Medio</option><option>Bajo</option></select></label></div><div className="flex flex-wrap justify-end gap-2 border-t border-[#e8eeeb] bg-[#fbfdfb] px-5 py-3"><button type="button" onClick={onClose} className="h-9 rounded-lg border border-[#dbe7df] px-4 text-[11px] font-bold text-[#698077] hover:bg-white">Cancelar</button><button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#075239] px-4 text-[11px] font-bold text-white hover:bg-[#063f2d] disabled:cursor-wait disabled:opacity-70">{saving && <RefreshCw className="size-3.5 animate-spin" />}{form.id ? 'Guardar cambios' : 'Registrar cliente'}</button></div></form></div>;
}

function ClientDetail({ client, onEdit, onNewEngagement }: { client: AuditClient; onEdit: () => void; onNewEngagement: () => void }) {
  return <div className="min-w-0 rounded-xl border border-[#e8eeeb] bg-white p-4 shadow-[0_6px_20px_rgba(13,66,45,0.04)] xl:sticky xl:top-4 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf1ef] pb-3"><div className="flex min-w-0 items-center gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#0d7b55] text-[14px] font-black text-white">{client.initials}</div><div className="min-w-0"><h2 className="truncate font-serif text-[20px] font-semibold italic text-[#1c4635]">{client.name}</h2><p className="truncate text-[10px] text-[#8a9a92]">{client.sector} <span className="mx-1 text-[#cad4cf]">|</span> RUC: {client.ruc}</p></div></div><div className="flex items-center gap-2"><StatusPill label={`Cliente ${client.status.toLowerCase()}`} tone={client.status === 'Activa' ? 'success' : 'neutral'} /><button type="button" onClick={onEdit} className="flex size-8 items-center justify-center rounded-lg border border-[#dce8e1] text-[#678078] hover:bg-[#eef7f0] hover:text-[#19754f]" aria-label="Editar cliente"><MoreHorizontal className="size-4" /></button></div></div><div className="flex gap-1 overflow-x-auto border-b border-[#edf1ef] py-2 text-[10px] font-bold text-[#74867d]"><button type="button" className="flex min-w-max items-center gap-1.5 border-b-2 border-[#1b8b59] pb-2 text-[#17754f]"><Building2 className="size-3.5" />Información general</button><button type="button" className="flex min-w-max items-center gap-1.5 px-2 pb-2 hover:text-[#17754f]"><UsersRound className="size-3.5" />Contactos</button><button type="button" className="flex min-w-max items-center gap-1.5 px-2 pb-2 hover:text-[#17754f]"><BriefcaseBusiness className="size-3.5" />Encargos</button><button type="button" className="flex min-w-max items-center gap-1.5 px-2 pb-2 hover:text-[#17754f]"><FolderOpen className="size-3.5" />Expediente</button></div><div className="grid gap-2 py-3 sm:grid-cols-3"><MiniFact icon={Building2} label="Régimen" value={client.regime} detail={client.personType === 'LEGAL_ENTITY' ? 'Persona jurídica' : 'Persona natural'} /><MiniFact icon={CircleDollarSign} label="Moneda" value={client.currency} detail="Moneda principal" /><MiniFact icon={UsersRound} label="Grupo empresarial" value={client.group === 'No' ? 'No' : 'Sí'} detail={client.group === 'No' ? 'Entidad independiente' : client.group} /><MiniFact icon={CalendarDays} label="Años auditados" value={client.auditedYears} detail="Períodos registrados" /><MiniFact icon={FileClock} label="Último cierre" value={client.lastClose} detail="Último período auditado" /></div><div className="grid gap-3 lg:grid-cols-[1.2fr_.8fr]"><div className="rounded-xl border border-[#edf1ef] p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-[12px] font-black text-[#315344]">Información de la empresa</h3><button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1b8256]"><Edit3 className="size-3" />Editar</button></div><div className="space-y-2 text-[10px]"><InfoRow label="Razón social" value={client.name} /><InfoRow label="Nombre comercial" value={client.commercialName} /><InfoRow label="RUC" value={client.ruc} /><InfoRow label="Sector" value={client.sector} /><InfoRow label="Ciudad" value={client.city} /><InfoRow label="Dirección" value={client.address} /><InfoRow label="Sitio web" value={client.website} /></div></div><div className="rounded-xl border border-[#edf1ef] p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-[12px] font-black text-[#315344]">Perfil de riesgo</h3><span className="text-[10px] font-bold text-[#1b8256]">Ver detalle →</span></div><div className="flex items-end gap-2"><strong className="text-[29px] font-black tracking-[-0.08em] text-[#df5259]">{client.riskScore}</strong><span className="mb-1 text-[10px] text-[#8fa099]">/100</span><RiskPill risk={client.risk} /></div><p className="mt-1 text-[10px] leading-4 text-[#8b9a93]">Clasificación basada en volumen de operaciones, complejidad y antecedentes.</p><RiskBar label="Riesgo inherente" value={Math.min(100, client.riskScore + 8)} tone="danger" /><RiskBar label="Riesgo de control" value={Math.max(28, client.riskScore - 7)} tone="warning" /><RiskBar label="Riesgo de detección" value={Math.max(18, client.riskScore - 32)} tone="success" /></div></div><div className="mt-3 grid gap-3 lg:grid-cols-[1.15fr_1fr_.9fr]"><div className="rounded-xl border border-[#edf1ef] p-3"><SectionHeading title="Encargos de auditoría" action="Ver todos" onAction={onNewEngagement} /><div className="space-y-2">{client.engagementList.slice(0, 4).map(item => <div key={item.code} className="flex items-center gap-2 text-[10px]"><span className="font-black text-[#526a5e]">{item.code}</span><span className="flex-1 truncate text-[#87958f]">{item.type} · {item.year}</span><StatusPill label={item.status} tone={item.status === 'Emitido' ? 'info' : item.status === 'En revisión' ? 'warning' : 'success'} /><span className="font-bold text-[#6c8177]">{item.progress}%</span></div>)}</div></div><div className="rounded-xl border border-[#edf1ef] p-3"><SectionHeading title="Documentación permanente" action="Administrar" /><div className="space-y-2">{client.documents.slice(0, 5).map(item => <div key={item.name} className="flex items-center gap-2 text-[10px]"><FileText className="size-3.5 shrink-0 text-[#52a76d]" /><span className="min-w-0 flex-1 truncate text-[#687c71]">{item.name}</span><StatusPill label={item.status} tone={item.status === 'Validado' ? 'success' : 'warning'} /></div>)}</div></div><div className="rounded-xl border border-[#edf1ef] p-3"><SectionHeading title="Contactos principales" action="Ver todos" /><div className="space-y-2.5">{client.contacts.slice(0, 3).map(item => <div key={item.email} className="flex items-center gap-2"><div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e3f3e7] text-[9px] font-black text-[#2b8459]">{item.initials}</div><div className="min-w-0"><p className="truncate text-[10px] font-bold text-[#52695d]">{item.name}</p><p className="truncate text-[9px] text-[#9aa8a2]">{item.role}</p></div></div>)}</div></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" onClick={onNewEngagement} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#075239] px-3 text-[11px] font-bold text-white hover:bg-[#063f2d]"><Plus className="size-3.5" />Crear encargo</button><button type="button" onClick={() => toast.success('Expediente permanente preparado para abrir.')} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#bfd8c7] bg-white px-3 text-[11px] font-bold text-[#236849] hover:bg-[#f0f9f1]"><FolderOpen className="size-3.5" />Abrir expediente</button><button type="button" onClick={() => toast.success('Solicitud de documentación preparada.')} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#bfd8c7] bg-white px-3 text-[11px] font-bold text-[#236849] hover:bg-[#f0f9f1]"><Send className="size-3.5" />Solicitar documentación</button><button type="button" onClick={() => toast.info('La carta de requerimientos se habilita con la integración documental.')} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#bfd8c7] bg-white px-3 text-[11px] font-bold text-[#236849] hover:bg-[#f0f9f1]"><FileText className="size-3.5" />Generar carta</button></div></div>;
}

function MiniFact({ icon: Icon, label, value, detail }: { icon: typeof Building2; label: string; value: string; detail: string }) { return <div className="rounded-lg border border-[#edf1ef] bg-[#fcfefc] p-2.5"><div className="flex items-center gap-1.5 text-[9px] text-[#8a9c93]"><Icon className="size-3.5 text-[#4b9e69]" />{label}</div><p className="mt-1 truncate text-[12px] font-black text-[#365346]">{value}</p><p className="mt-0.5 truncate text-[9px] text-[#a0aca6]">{detail}</p></div>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2 border-b border-[#f0f3f1] pb-1.5 last:border-0 last:pb-0"><span className="text-[#a0aca7]">{label}</span><strong className="truncate text-right font-semibold text-[#586d61]">{value || '—'}</strong></div>; }
function RiskBar({ label, value, tone }: { label: string; value: number; tone: 'danger' | 'warning' | 'success' }) { return <div className="mt-3"><div className="mb-1 flex justify-between text-[9px] text-[#8b9a93]"><span>{label}</span><strong>{value}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-[#e9efeb]"><span className={cn('block h-full rounded-full', tone === 'danger' ? 'bg-[#ec5e65]' : tone === 'warning' ? 'bg-[#eab21a]' : 'bg-[#64aa5e]')} style={{ width: `${value}%` }} /></div></div>; }

function ClientDirectory({ clients, total, kpis, selectedId, onSelect, search, onSearch, filters, onFilter, onClear, onApply, onCreate, isFetching }: { clients: AuditClient[]; total: number; kpis: AuditClientsData['kpis']; selectedId?: string; onSelect: (id: string) => void; search: string; onSearch: (value: string) => void; filters: { sector: string; city: string; status: string; partner: string; risk: string }; onFilter: (key: keyof typeof filters, value: string) => void; onClear: () => void; onApply: () => void; onCreate: () => void; isFetching: boolean }) {
  activeClientKpis = kpis;
  return <div className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="mb-1 text-[11px] font-bold text-[#729b82]">Clientes <span className="mx-1 text-[#c7d2cc]">›</span> Clientes y empresas auditadas</p><h1 className="font-serif text-[32px] font-semibold italic tracking-[-0.04em] text-[#143e2e] sm:text-[38px]">Clientes y empresas auditadas</h1><p className="mt-1 text-[12px] text-[#84948c]">Gestiona el portafolio de clientes, su información corporativa, encargos y documentación permanente.</p></div><button type="button" onClick={onCreate} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#075239] px-3 text-[11px] font-bold text-white shadow-[0_5px_16px_rgba(7,82,57,0.18)] hover:bg-[#063f2d]"><Plus className="size-4" />Nuevo cliente</button></div><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"><ClientKpi icon={Building2} value="148" label="Entidades registradas" /><ClientKpi icon={Clock3} value="126" label="Clientes activos" detail="85% del total" /><ClientKpi icon={CheckCircle2} value="64" label="Con encargos vigentes" /><ClientKpi icon={FileText} value="38" label="Documentos pendientes" /><ClientKpi icon={ShieldAlert} value="09" label="Clientes alto riesgo" tone="danger" /></div><div className="rounded-xl border border-[#e8eeeb] bg-white p-3 shadow-[0_5px_18px_rgba(13,66,45,0.03)]"><div className="grid gap-2 md:grid-cols-[minmax(220px,1.5fr)_repeat(3,minmax(105px,1fr))] xl:grid-cols-[minmax(250px,1.7fr)_repeat(5,minmax(112px,1fr))_auto]"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aaba2]" /><input value={search} onChange={event => onSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') onApply(); }} className="h-10 w-full rounded-lg border border-[#dce8e1] bg-[#fcfefc] pl-9 pr-3 text-[11px] text-[#4b6357] outline-none focus:border-[#67ad7b] focus:ring-2 focus:ring-[#d5efd9]" placeholder="Buscar por razón social, RUC o contacto…" /></label>{(['sector', 'city', 'status', 'partner', 'risk'] as const).map(key => <select key={key} value={filters[key]} onChange={event => onFilter(key, event.target.value)} className="h-10 min-w-0 rounded-lg border border-[#dce8e1] bg-[#fcfefc] px-2.5 text-[10px] font-semibold text-[#63766c] outline-none focus:border-[#67ad7b]"><option value="">{key === 'sector' ? 'Sector · Todos' : key === 'city' ? 'Ciudad · Todas' : key === 'status' ? 'Estado · Todos' : key === 'partner' ? 'Socio · Todos' : 'Riesgo · Todos'}</option>{key === 'sector' && ['Comercial', 'Industrial', 'Agroindustrial', 'Servicios profesionales', 'Transporte'].map(value => <option key={value}>{value}</option>)}{key === 'city' && ['Managua', 'León', 'Estelí', 'Masaya', 'Bluefields'].map(value => <option key={value}>{value}</option>)}{key === 'status' && ['Activa', 'Inactiva'].map(value => <option key={value}>{value}</option>)}{key === 'partner' && ['María López', 'Carlos Méndez', 'Ana Torres', 'José Rivera', 'Laura Pérez'].map(value => <option key={value}>{value}</option>)}{key === 'risk' && ['Alto', 'Medio', 'Bajo'].map(value => <option key={value}>{value}</option>)}</select>)}<div className="flex items-center justify-end gap-2 md:col-span-3 xl:col-span-1"><button type="button" onClick={onClear} className="px-2 text-[10px] font-bold text-[#8d9d95] hover:text-[#347857]">Limpiar</button><button type="button" onClick={onApply} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#075239] px-3 text-[10px] font-bold text-white hover:bg-[#063f2d]"><Filter className="size-3.5" />Aplicar filtros</button></div></div></div><div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(480px,.88fr)_minmax(600px,1.12fr)]"><div className="min-w-0 rounded-xl border border-[#e8eeeb] bg-white p-3 shadow-[0_6px_20px_rgba(13,66,45,0.04)]"><div className="mb-3 flex items-center justify-between gap-2"><div><h2 className="font-serif text-[18px] font-semibold text-[#183d30]">Directorio de clientes</h2><p className="text-[9px] text-[#98a6a0]">Mostrando {clients.length ? `1 – ${clients.length}` : 0} de 148</p></div><button type="button" onClick={() => toast.success('El directorio se exportará con los filtros vigentes.')} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dbe7df] px-2.5 py-2 text-[10px] font-bold text-[#597168] hover:bg-[#f0f8f1]"><Download className="size-3.5" />Exportar</button></div><div className="overflow-x-auto"><table className="w-full min-w-[670px] text-left text-[10px]"><thead className="border-b border-[#edf1ef] text-[9px] uppercase tracking-[0.08em] text-[#9ba9a3]"><tr><th className="pb-2 pl-1">Empresa</th><th className="pb-2">RUC</th><th className="pb-2">Sector</th><th className="pb-2">Ciudad</th><th className="pb-2">Socio</th><th className="pb-2">Riesgo</th><th className="pb-2">Aud.</th><th className="pb-2">Estado</th><th /></tr></thead><tbody className="divide-y divide-[#f0f3f1]">{clients.map(client => <tr key={client.id} onClick={() => onSelect(client.id)} className={cn('cursor-pointer transition hover:bg-[#f4fbf5]', selectedId === client.id ? 'bg-[#eaf8ed] shadow-[inset_3px_0_0_#35a96c]' : '')}><td className="max-w-[170px] py-2.5 pl-1"><div className="flex min-w-0 items-center gap-2"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#def2e2] text-[9px] font-black text-[#2c895b]">{client.initials}</span><div className="min-w-0"><p className="truncate font-black text-[#416053]">{client.name}</p><p className="truncate text-[9px] text-[#9aa7a1]">{client.commercialName}</p></div></div></td><td className="py-2.5 text-[#7e8e86]">{client.ruc}</td><td className="py-2.5 text-[#7e8e86]">{client.sector}</td><td className="py-2.5 text-[#7e8e86]">{client.city}</td><td className="py-2.5 text-[#7e8e86]">{client.partner}</td><td className="py-2.5"><RiskPill risk={client.risk} /></td><td className="py-2.5 text-center font-bold text-[#688077]">{client.engagements}</td><td className="py-2.5"><StatusPill label={client.status} tone={client.status === 'Activa' ? 'success' : 'neutral'} /></td><td className="py-2.5 pr-1"><MoreHorizontal className="size-3.5 text-[#4b9f6c]" /></td></tr>)}</tbody></table>{!clients.length && <div className="p-10 text-center text-[11px] text-[#87968f]">No encontramos clientes con los filtros elegidos.</div>}</div><div className="mt-3 flex items-center justify-between border-t border-[#edf1ef] pt-3 text-[10px] text-[#8e9e96]"><span>Filas por página: 12</span><div className="flex items-center gap-1"><button type="button" className="flex size-6 items-center justify-center rounded-md bg-[#0a553b] text-[10px] font-bold text-white">1</button><button type="button" className="flex size-6 items-center justify-center rounded-md hover:bg-[#edf6ef]">2</button><button type="button" className="flex size-6 items-center justify-center rounded-md hover:bg-[#edf6ef]">3</button><span>…</span><button type="button" className="px-1 hover:text-[#347857]">13</button></div></div></div><div className="min-w-0">{selectedId && clients.find(item => item.id === selectedId) ? <ClientDetail client={clients.find(item => item.id === selectedId)!} onEdit={onCreate} onNewEngagement={() => toast.info('El cliente queda preseleccionado para la vista 03 — Encargos.')} /> : <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed border-[#cfe0d5] bg-white/70 text-center text-[12px] text-[#82938b]"><div><UsersRound className="mx-auto mb-2 size-8 text-[#7db18b]" /><p>Selecciona un cliente para abrir su ficha.</p></div></div>}</div></div>{isFetching && <div className="fixed bottom-4 right-4 z-20 inline-flex items-center gap-2 rounded-lg bg-[#0a553b] px-3 py-2 text-[10px] font-bold text-white shadow-lg"><RefreshCw className="size-3.5 animate-spin" />Actualizando clientes…</div>}</div>;
}

function ComingSoonView({ kind, onBack }: { kind: 'engagements' | 'acceptance' | 'logs'; onBack: () => void }) {
  const copy = kind === 'engagements' ? ['Vista 03', 'Gestión de encargos', 'Aquí vivirán los expedientes, períodos, equipos y cronogramas de auditoría.'] : kind === 'acceptance' ? ['Vista 04', 'Aceptación e independencia', 'Aquí se conectarán los cuestionarios, declaraciones de independencia y decisiones de aceptación.'] : ['Bitácora', 'Trazabilidad de auditoría', 'Aquí se consolidarán las decisiones, aprobaciones y eventos auditables del expediente.'];
  return <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-[#dbe8df] bg-white/70 p-8 text-center shadow-[0_10px_30px_rgba(13,66,45,0.04)]"><div className="max-w-md"><div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#e4f5e7] text-[#2d8b5c]"><ClipboardCheck className="size-8" /></div><p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-[#5aa46e]">{copy[0]}</p><h1 className="mt-2 font-serif text-[32px] font-semibold italic text-[#183e30]">{copy[1]}</h1><p className="mt-3 text-[12px] leading-6 text-[#7f9188]">{copy[2]}</p><button type="button" onClick={onBack} className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg bg-[#075239] px-4 text-[11px] font-bold text-white hover:bg-[#063f2d]"><ChevronRight className="size-4 rotate-180" />Volver al resumen</button></div></div>;
}

export function AuditWorkspacePage({ activeSubModule, onSubModuleChange }: { activeSubModule?: string; onSubModuleChange?: (subModule: string) => void }) {
  const queryClient = useQueryClient();
  const [localView, setLocalView] = useState<AuditView>(() => viewBySubmodule[activeSubModule || ''] || 'dashboard');
  const activeView = viewBySubmodule[activeSubModule || ''] || localView;
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filters, setFilters] = useState({ sector: '', city: '', status: '', partner: '', risk: '' });
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState<ClientFormState>(emptyClientForm);
  const [savingClient, setSavingClient] = useState(false);
  const [selectedAuditTab, setSelectedAuditTab] = useState<string | null>(null);
  const [auditTourOpen, setAuditTourOpen] = useState(false);
  const [auditTenantId, setAuditTenantId] = useState(() => localStorage.getItem('nova-audit-tenant-id') || '');

  const auditTenantsQuery = useQuery<{ items?: AuditTenantOption[]; activeTenantId?: string | null }>({
    queryKey: ['audit-workspace-context-tenants'],
    queryFn: ({ signal }) => auditWorkspaceService.listAuditTenants(signal) as Promise<{ items?: AuditTenantOption[]; activeTenantId?: string | null }>,
    staleTime: 60_000,
    retry: 2,
    retryDelay: attempt => Math.min(800 * (attempt + 1), 2_000),
  });
  const auditTenants = auditTenantsQuery.data?.items || [];
  const auditEngagementsQuery = useQuery<unknown>({
    queryKey: ['audit-workspace-context-engagements', auditTenantId],
    queryFn: ({ signal }) => auditWorkspaceService.getEngagements({ period: '2025' }, signal),
    staleTime: 30_000,
    enabled: Boolean(auditTenantId),
  });

  useEffect(() => {
    if (!auditTenantId) return;
    const raw = auditEngagementsQuery.data as { items?: Array<{ id?: string }> } | undefined;
    const firstEngagementId = raw?.items?.find(item => item.id)?.id;
    if (firstEngagementId && !localStorage.getItem('nova-audit-engagement-id')) {
      localStorage.setItem('nova-audit-engagement-id', firstEngagementId);
    }
  }, [auditTenantId, auditEngagementsQuery.data]);

  useEffect(() => {
    if (!auditTenants.length) return;

    // Do not keep a tenant selected by a previous session/user. A regular
    // audit user can only work inside the tenant returned by the API.
    const selectedTenantIsAvailable = auditTenants.some(tenant => tenant.id === auditTenantId);
    if (!selectedTenantIsAvailable) {
      const nextTenantId = auditTenants.length === 1 ? auditTenants[0]?.id || '' : '';
      if (nextTenantId) localStorage.setItem('nova-audit-tenant-id', nextTenantId);
      else localStorage.removeItem('nova-audit-tenant-id');
      localStorage.removeItem('nova-audit-engagement-id');
      setAuditTenantId(nextTenantId);
      return;
    }

    if (!auditTenantId) return;
    localStorage.setItem('nova-audit-tenant-id', auditTenantId);
  }, [auditTenantId, auditTenants]);

  useEffect(() => {
    const onAuditTabSelected = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string }>).detail;
      if (detail?.label) setSelectedAuditTab(detail.label);
    };
    window.addEventListener('audit-tab-selected', onAuditTabSelected);
    return () => window.removeEventListener('audit-tab-selected', onAuditTabSelected);
  }, []);

  const selectAuditTenant = (tenantId: string) => {
    if (tenantId) localStorage.setItem('nova-audit-tenant-id', tenantId);
    else localStorage.removeItem('nova-audit-tenant-id');
    localStorage.removeItem('nova-audit-engagement-id');
    setAuditTenantId(tenantId);
    void queryClient.invalidateQueries();
  };

  const dashboardQuery = useQuery<QueryResult<AuditDashboardData>>({
    queryKey: ['audit-workspace-dashboard', auditTenantId],
    queryFn: async ({ signal }) => ({ data: await auditWorkspaceService.getDashboard({ period: '2025' }, signal).then(normalizeDashboard), isDemo: false }),
    staleTime: 30_000,
    enabled: activeView === 'dashboard' && Boolean(auditTenantId),
  });

  const clientsQuery = useQuery<QueryResult<AuditClientsData>>({
    queryKey: ['audit-workspace-clients', auditTenantId, appliedSearch, filters],
    queryFn: async ({ signal }) => ({ data: await auditWorkspaceService.getClients({ search: appliedSearch || undefined, ...filters, page: 1, pageSize: 12 }, signal).then(normalizeClients), isDemo: false }),
    staleTime: 30_000,
    enabled: activeView === 'clients' && Boolean(auditTenantId),
  });

  const baseClientData = clientsQuery.data?.data || { total: 0, kpis: { entities: 0, active: 0, withEngagements: 0, pendingDocuments: 0, highRisk: 0 }, items: [] };
  const clients = useMemo(() => baseClientData.items.filter(client => {
    const haystack = `${client.name} ${client.commercialName} ${client.ruc} ${client.partner}`.toLowerCase();
    return (!appliedSearch || haystack.includes(appliedSearch.toLowerCase()))
      && (!filters.sector || client.sector === filters.sector)
      && (!filters.city || client.city === filters.city)
      && (!filters.status || client.status === filters.status)
      && (!filters.partner || client.partner === filters.partner)
      && (!filters.risk || client.risk === filters.risk);
  }), [baseClientData.items, appliedSearch, filters]);

  const effectiveSelectedClientId = selectedClientId && clients.some(client => client.id === selectedClientId)
    ? selectedClientId
    : clients[0]?.id;
  const selectView = (view: AuditView) => {
    setLocalView(view);
    setSelectedAuditTab(null);
    // Cambia únicamente el submódulo de Audit; el sidebar principal de NovaHub
    // conserva su sección y no se modifica al navegar entre las 16 vistas.
    if (submoduleByView[view]) onSubModuleChange?.(submoduleByView[view]);
  };

  const startAuditTour = () => {
    setSelectedAuditTab(null);
    setAuditTourOpen(true);
    selectView('dashboard');
  };

  const openCreateClient = () => { setClientForm(emptyClientForm); setModalOpen(true); };

  const saveClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingClient(true);
    const payload = { personType: clientForm.personType, legalName: clientForm.name, commercialName: clientForm.commercialName, taxId: clientForm.ruc, sector: clientForm.sector, city: clientForm.city, responsiblePartner: clientForm.partner, risk: clientForm.risk, status: clientForm.status };
    try {
      if (clientForm.id) await auditWorkspaceService.updateClient(clientForm.id, payload);
      else await auditWorkspaceService.createClient(payload);
      toast.success(clientForm.id ? 'Ficha de cliente actualizada.' : 'Cliente registrado correctamente.');
      await queryClient.invalidateQueries({ queryKey: ['audit-workspace-clients'] });
    } catch (error) {
      toast.error(isAuthError(error)
        ? (error instanceof Error ? error.message : 'No tienes permiso para modificar clientes.')
        : (error instanceof Error ? error.message : 'No se pudo registrar el cliente en la API.'));
      return;
    } finally {
      setSavingClient(false);
      setModalOpen(false);
    }
  };

  const clearFilters = () => { setSearch(''); setAppliedSearch(''); setFilters({ sector: '', city: '', status: '', partner: '', risk: '' }); };
  const content = activeView === 'dashboard'
    ? dashboardQuery.data?.data ? <AuditDashboardView data={dashboardQuery.data.data} onRefresh={() => void dashboardQuery.refetch()} onOpenClients={() => selectView('clients')} isFetching={dashboardQuery.isFetching} /> : <AuditDataUnavailable title="Resumen de auditoría" onRetry={() => void dashboardQuery.refetch()} />
    : activeView === 'clients'
      ? <ClientDirectory clients={clients} total={baseClientData.total} kpis={baseClientData.kpis} selectedId={selectedClientId} onSelect={setSelectedClientId} search={search} onSearch={setSearch} filters={filters} onFilter={(key, value) => setFilters(current => ({ ...current, [key]: value }))} onClear={clearFilters} onApply={() => setAppliedSearch(search.trim())} onCreate={openCreateClient} isFetching={clientsQuery.isFetching} />
      : activeView === 'engagements'
        ? <AuditEngagementsView onNavigate={view => selectView(view)} />
        : activeView === 'acceptance'
          ? <AuditAcceptanceView onNavigate={view => selectView(view)} />
          : activeView === 'planning'
            ? <AuditPlanningView onNavigate={view => selectView(view)} />
            : activeView === 'accounting-imports'
              ? <AuditAccountingImportView onNavigate={view => selectView(view)} />
              : activeView === 'trial-balance'
                ? <AuditTrialBalanceView onNavigate={view => selectView(view)} />
                : activeView === 'risks'
                  ? <AuditRisksView onNavigate={view => selectView(view)} />
                  : activeView === 'programs'
                    ? <AuditProgramsView onNavigate={view => selectView(view)} />
                    : activeView === 'sampling'
                      ? <AuditSamplingView onNavigate={view => selectView(view)} />
                      : activeView === 'workpapers'
                        ? <AuditWorkpapersView onNavigate={view => selectView(view)} />
                        : activeView === 'pbc'
                          ? <AuditPbcView onNavigate={view => selectView(view)} />
                          : activeView === 'findings'
                            ? <AuditFindingsView onNavigate={view => selectView(view)} />
                            : activeView === 'reviews'
                              ? <AuditReviewsView onNavigate={view => selectView(view)} />
                              : activeView === 'reports'
                                ? <AuditReportsView onNavigate={view => selectView(view)} />
                                : activeView === 'archive'
                                  ? <AuditArchiveView onNavigate={view => selectView(view)} />
                                  : <ComingSoonView kind="logs" onBack={() => selectView('dashboard')} />;

  const contextError = auditTenantsQuery.error instanceof Error ? auditTenantsQuery.error.message : undefined;
  const hasAuditContext = Boolean(auditTenantId);
  const activeQuery = activeView === 'dashboard' ? dashboardQuery : clientsQuery;
  return <div className="audit-workspace relative min-h-full overflow-hidden bg-[#f5f8f6] text-[#365346]"><div className="pointer-events-none absolute -right-20 -top-32 size-[470px] rounded-full bg-[#dff2d5]/70 blur-3xl" /><div className="pointer-events-none absolute -bottom-64 left-0 size-[420px] rounded-full bg-[#e3f2ea]/80 blur-3xl" /><div className="relative z-10 mx-auto min-w-0 max-w-[1900px] px-3 py-4 sm:px-5 lg:px-7"><AuditTenantContextBar tenants={auditTenants} selectedId={auditTenantId} onChange={selectAuditTenant} isLoading={auditTenantsQuery.isLoading} error={contextError} onStartTour={startAuditTour} /><AuditNavigation activeView={activeView} onSelect={selectView} /><IntegrationNotice isDemo={hasAuditContext && Boolean(activeQuery.error || activeQuery.data?.isDemo)} message={activeQuery.error instanceof Error ? activeQuery.error.message : activeQuery.data?.fallbackMessage} />{hasAuditContext ? (selectedAuditTab ? <AuditSubviewPanel label={selectedAuditTab} onClose={() => setSelectedAuditTab(null)} /> : content) : <AuditContextRequired tenants={auditTenants} selectedId={auditTenantId} onChange={selectAuditTenant} isLoading={auditTenantsQuery.isLoading} error={contextError} />}</div>{modalOpen && <ClientModal form={clientForm} setForm={setClientForm} onClose={() => setModalOpen(false)} onSave={saveClient} saving={savingClient} />}{auditTourOpen && <GuidedTour steps={auditModuleTourSteps} title="NovaHub Audit · recorrido completo" onClose={() => setAuditTourOpen(false)} onStepChange={index => { const nextView = auditModuleTourSteps[index]?.view; if (nextView && nextView !== activeView) selectView(nextView); }} />}</div>;
}

export default AuditWorkspacePage;
