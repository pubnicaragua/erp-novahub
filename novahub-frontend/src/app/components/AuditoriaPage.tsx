import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Download, Eye, FileSearch, History, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTenantQuery } from '../hooks/useTenantQuery';
import { auditService, type AuditFilterOptions, type AuditLog, type AuditLogQuery } from '../services/audit.service';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Combobox } from './ui/Combobox';
import { toast } from '@/app/services/toast';
import { cn } from './ui/utils';
import { ExportMenu } from './ui/ExportMenu';
import { generateFastGlobalReportPDF, getPdfDesignSettings } from '../utils/pdfGenerator';
import { createReportWorkbook } from '../utils/reportWorkbook';

const EMPTY_FILTERS: AuditLogQuery = { page: 1, pageSize: 25 };
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const TECHNICAL_TEXT_PATTERN = /(endpoint|metadata|correlation|user.?agent|ip.?address|https?:\/\/|\/api\/|\b(?:GET|POST|PUT|PATCH|DELETE)\b)/i;
const DESCRIPTION_FIELD_LABELS: Record<string, string> = {
  code: 'Código', number: 'Número', name: 'Nombre', title: 'Título', subject: 'Asunto', description: 'Descripción',
  commercialNote: 'Nota comercial', isActive: 'Estado', status: 'Estado', attributes: 'Atributos', warehouses: 'Bodegas',
  quantity: 'Cantidad', salePrice: 'Precio de venta', costPrice: 'Costo', total: 'Total', customer: 'Cliente', seller: 'Vendedor',
  category: 'Categoría', email: 'Correo electrónico', phone: 'Teléfono', address: 'Dirección', currency: 'Moneda', date: 'Fecha',
  dueDate: 'Fecha de vencimiento', priority: 'Prioridad', assignedTo: 'Responsable', role: 'Rol', permissions: 'Permisos',
  branch: 'Sucursal', warehouse: 'Bodega', trackingCode: 'Código de seguimiento', employeeNumber: 'Número de empleado',
};

const MODULE_LABELS: Record<string, string> = {
  AUTH: 'Seguridad', SALES: 'Ventas', PURCHASES: 'Compras', INVENTORY: 'Inventario de Mercancías',
  CONFIGURATION: 'Configuración', HR: 'Recursos Humanos', ACTIVITIES: 'Actividades', PROJECTS: 'Proyectos',
  RESTAURANT: 'Restaurante POS', SUPPORT_TECH: 'Soporte técnico', TRACKING: 'Tracking de Importaciones',
  ACCOUNTING: 'Contabilidad', FINANCIALS: 'Finanzas', FINANCIAL: 'Finanzas', FORCE_SALES: 'Fuerza Comercial',
  REPORTS: 'Reportes', DOCUMENTS: 'Nova Cloud', NOTIFICATIONS: 'Notificaciones', NOVACHAT: 'Nova Suite',
  LEGAL: 'Asesoría legal', FINANCING: 'Financiamiento PYME', HR_TRAINING: 'Centro de capacitación',
  TICKETS: 'Gestión de tickets', SUPPORT: 'Soporte técnico', TOOLS: 'Soporte técnico',
  ENTERPRISE_GROUPS: 'Grupos y cotizaciones', FINANCIAL_ACCOUNTS: 'Finanzas', FINANCIAL_INCOMES: 'Finanzas',
  FINANCIAL_EXPENSES: 'Finanzas', REPORTS_FINANCIAL: 'Reportes',
  // Eventos emitidos por rutas antiguas o por el interceptor HTTP.
  STORAGE: 'Nova Cloud', TENANTS: 'Mi Sucursal', ROLES: 'Mi Sucursal', AUDIT: 'Configuración',
  ENTERPRISE_GROUP: 'Grupos y cotizaciones', LOGISTICS: 'Tracking de Importaciones', FIXED_ASSETS: 'Contabilidad',
  CAJA: 'Ventas', POS: 'Ventas', USERS: 'Mi Sucursal', SUBSCRIPTIONS: 'Mi Sucursal',
  BRANDING: 'Configuración', PDF_DOCUMENT_DESIGNS: 'Configuración', PDF_PREVIEWS: 'Configuración',
  COUNTRY_CONFIG: 'Configuración', MODULE_PRICING: 'Grupos y cotizaciones',
  MASTER_CONSOLE: 'Master Console', PLATFORM: 'Master Console', QA_CONSOLE: 'Validador ERP (QA)',
  SYSTEM: 'Sistema',
};

const CONTEXTUAL_MODULE_LABELS: Record<string, { branch: string; platform: string }> = {
  TENANTS: { branch: 'Mi Sucursal', platform: 'Grupos y cotizaciones' },
  ROLES: { branch: 'Mi Sucursal', platform: 'Grupos y cotizaciones' },
  USERS: { branch: 'Mi Sucursal', platform: 'Grupos y cotizaciones' },
  SUBSCRIPTIONS: { branch: 'Mi Sucursal', platform: 'Grupos y cotizaciones' },
  AUDIT: { branch: 'Configuración', platform: 'Logs y auditoría' },
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creación', UPDATE: 'Edición', DELETE: 'Eliminación', PAYMENT: 'Pago', STATUS_CHANGE: 'Cambio de estado',
  INVENTORY_AUDIT: 'Auditoría de inventario', LOGIN: 'Inicio de sesión', LOGOUT: 'Cierre de sesión',
  LOGIN_FAILED: 'Inicio de sesión fallido', ACCESS_DENIED: 'Acceso denegado', EXPORT: 'Exportación', IMPORT: 'Importación',
  APPROVE: 'Aprobación', REJECT: 'Rechazo', SESSION_TAKEOVER: 'Cambio de sesión', IMPERSONATE_ENTER: 'Ingreso a sucursal',
  DUPLICATE_OVERRIDE: 'Confirmación de duplicado', AUDIT: 'Auditoría', SENT_TO_CORRECT: 'Enviado a corregir',
  CANCELLED: 'Anulación', REISSUED: 'Reemisión', REISSUE: 'Reemisión', TICKET_CREATED: 'Ticket creado',
  MANAGER_UPDATE_USER: 'Usuario actualizado', MANAGER_DEACTIVATE_USER: 'Usuario inhabilitado',
  STATUS_CHANGED: 'Estado actualizado', PRIORITY_CHANGED: 'Prioridad actualizada', ASSIGNED_CHANGED: 'Asignación actualizada',
  CUSTOMER_CHANGED: 'Cliente actualizado', CATEGORY_CHANGED: 'Categoría actualizada', RELATION_UPDATED: 'Relación actualizada',
  SUBJECT_UPDATED: 'Asunto actualizado', DESCRIPTION_UPDATED: 'Descripción actualizada', SLA_UPDATED: 'SLA actualizado',
  TICKET_REOPENED: 'Ticket reabierto', COMMENT_ADDED: 'Comentario agregado', ATTACHMENT_ADDED: 'Archivo adjunto agregado',
  ATTACHMENT_REMOVED: 'Archivo adjunto retirado', SLA_BREACHED: 'SLA incumplido', SLA_REMINDER_SENT: 'Recordatorio de SLA enviado',
};

const ENTITY_LABELS: Record<string, string> = {
  USER: 'Usuario', CUSTOMER: 'Cliente', ESTIMATE: 'Cotización', SALES_ORDER: 'Orden de venta', INVOICE: 'Factura',
  RECURRING_INVOICE: 'Factura recurrente', PAYMENT_RECEIVED: 'Pago recibido', CREDIT_NOTE: 'Nota de crédito',
  SALES_RETURN: 'Devolución de venta', PURCHASE_ORDER: 'Orden de compra', PURCHASE_RECEIPT: 'Recepción de compra',
  SUPPLIER_INVOICE: 'Factura de proveedor', PAYMENT_MADE: 'Pago realizado', SUPPLIER_CREDIT: 'Crédito de proveedor',
  SUPPLIER: 'Proveedor', EXPENSE: 'Gasto', PRODUCT: 'Producto', CATEGORY: 'Categoría', WAREHOUSE: 'Bodega',
  ROLE: 'Rol', EMPLOYEE: 'Empleado', DEPARTMENT: 'Departamento', POSITION: 'Puesto', TASK: 'Tarea', EVENT: 'Evento',
  REMINDER: 'Recordatorio', ACTIVITY_LOG: 'Bitácora', PROJECT: 'Proyecto', TICKET: 'Ticket', SYSTEM: 'Sistema',
  TRACKING_SHIPMENT: 'Envío', TRACKING_EVENT: 'Evento de envío', ENTERPRISE_GROUP: 'Grupo empresarial',
  SUPPLIER_PRICE: 'Precio de proveedor', RECURRING_EXPENSE: 'Gasto recurrente', RECURRING_SUPPLIER_INVOICE: 'Factura recurrente de proveedor',
  PURCHASE_REQUEST: 'Solicitud de compra', PURCHASE_MANAGEMENT: 'Gestión de compras', MILESTONE: 'Hito', BUDGET_LINE: 'Partida presupuestaria',
  PROJECT_COST: 'Costo de proyecto', PROJECT_MEMBER: 'Miembro de proyecto', PROJECT_DOCUMENT: 'Documento de proyecto', PROJECT_ACTIVITY: 'Actividad de proyecto',
  FINANCIAL_ACCOUNT: 'Cuenta financiera', FINANCIAL_INCOME: 'Ingreso financiero', FINANCIAL_EXPENSE: 'Gasto financiero',
  ACCOUNTING_PERIOD: 'Período contable', RESTAURANT_ORDER: 'Orden de restaurante', RESTAURANT_TABLE: 'Mesa', RESTAURANT_MENU_ITEM: 'Producto del menú',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', EMPLOYEE: 'Empleado', MANAGER: 'Supervisor', PARTNER: 'Administrador de plataforma', SUPERADMIN: 'Superadministrador',
  OWNER: 'Propietario', ACCOUNTANT: 'Contador', USER: 'Usuario', SYSTEM: 'Sistema',
};

function labelFrom(value: string | null | undefined, labels: Record<string, string>, fallback: string) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  return labels[raw.toUpperCase()] || fallback;
}

export function auditModuleLabel(value?: string | null, platformScope = false) {
  const key = String(value || '').trim().toUpperCase();
  if (!key) return '—';
  return CONTEXTUAL_MODULE_LABELS[key]?.[platformScope ? 'platform' : 'branch'] || MODULE_LABELS[key] || 'Sistema';
}
export function auditActionLabel(value?: string | null) { return labelFrom(value, ACTION_LABELS, 'Actividad registrada'); }
function auditEntityLabel(value?: string | null) { return labelFrom(value, ENTITY_LABELS, 'Registro'); }
export function auditRoleLabel(value?: string | null) { return labelFrom(value, ROLE_LABELS, 'Usuario'); }

function formatDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function scopeDisplay(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

export type AuditDescriptionInput = Pick<AuditLog, 'entity' | 'entityLabel' | 'recordLabel' | 'actorName' | 'actorEmail' | 'action' | 'description'>;

function recordDisplay(log: AuditDescriptionInput) {
  const candidates = [log.recordLabel, log.entityLabel, log.entity === 'USER' ? log.actorName : undefined, log.entity === 'USER' ? log.actorEmail : undefined];
  const readable = candidates.find((candidate) => candidate && !UUID_PATTERN.test(String(candidate).trim()) && !TECHNICAL_TEXT_PATTERN.test(String(candidate).trim()));
  return readable ? String(readable).trim() : `Registro de ${auditEntityLabel(log.entity).toLowerCase()}`;
}

function parseDescription(raw: string): Record<string, unknown> | null {
  if (!raw.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function descriptionFieldLabels(value: unknown): string[] {
  const values = Array.isArray(value) ? value : String(value || '').split(/[,|\n]+/);
  return values.map((item) => String(item).trim()).filter(Boolean).map((item) => DESCRIPTION_FIELD_LABELS[item] || DESCRIPTION_FIELD_LABELS[item.toLowerCase()]).filter(Boolean) as string[];
}

function functionalDescription(log: AuditDescriptionInput) {
  const raw = String(log.description || '').trim();
  const record = `${auditEntityLabel(log.entity).toLowerCase()} ${recordDisplay(log)}`;
  const parsed = parseDescription(raw);
  if (parsed) {
    const fields = descriptionFieldLabels(parsed.fields_updated ?? parsed.fieldsUpdated ?? parsed.updatedFields ?? parsed.changedFields ?? parsed.changes);
    if (fields.length) return `${auditActionLabel(log.action)} de ${record}. Campos actualizados: ${fields.join(', ')}.`;
    const readableValues = Object.entries(parsed)
      .filter(([key, value]) => DESCRIPTION_FIELD_LABELS[key] && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
      .map(([key, value]) => `${DESCRIPTION_FIELD_LABELS[key]}: ${String(value)}`);
    if (readableValues.length) return `${auditActionLabel(log.action)} de ${record}. ${readableValues.join(' · ')}.`;
    return `${auditActionLabel(log.action)} de ${record}.`;
  }
  if (raw && !UUID_PATTERN.test(raw) && !TECHNICAL_TEXT_PATTERN.test(raw)) return raw;
  return `${auditActionLabel(log.action)} de ${record}.`;
}

export function auditDescriptionLabel(log: AuditDescriptionInput) {
  return functionalDescription(log);
}

function technicalDescription(log: AuditDescriptionInput) {
  const raw = String(log.description || '').trim();
  if (!raw || (!parseDescription(raw) && !TECHNICAL_TEXT_PATTERN.test(raw))) return null;
  const parsed = parseDescription(raw);
  return parsed ? JSON.stringify(parsed, null, 2) : raw;
}

function ResultBadge({ value }: { value?: string | null }) {
  const result = String(value || 'SUCCESS').toUpperCase();
  return <Badge variant="outline" className={cn('font-bold', result === 'SUCCESS' ? 'border-emerald-500/40 text-emerald-600' : 'border-destructive/40 text-destructive')}>{result === 'SUCCESS' ? 'Correcto' : result === 'FAILURE' ? 'Fallido' : 'Revisar'}</Badge>;
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn('flex min-w-0 flex-col gap-1.5', className)}><span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}

function SelectField({ label, value, onChange, options, placeholder = 'Todos', disabled = false }: { label: string; value?: string; onChange: (value: string) => void; options: Array<string | { value: string; label: string }>; placeholder?: string; disabled?: boolean }) {
  return <Field label={label}><select value={value || ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"><option value="">{placeholder}</option>{options.map((option) => { const item = typeof option === 'string' ? { value: option, label: auditRoleLabel(option) } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select></Field>;
}

function AuditDetail({ log, platformScope, showTechnicalDetails }: { log: AuditLog; platformScope: boolean; showTechnicalDetails: boolean }) {
  const technical = showTechnicalDetails ? technicalDescription(log) : null;
  const values: Array<[string, string | null | undefined]> = [
    ['Fecha', formatDate(log.createdAt)], ['Autor', log.actorName || log.user?.name || 'Sistema'], ['Rol', auditRoleLabel(log.actorRole || log.user?.role)],
    ...(platformScope ? [['Grupo empresarial', scopeDisplay(log.companyName, 'Sin grupo asociado')] as [string, string], ['Rubro', scopeDisplay(log.businessUnitName, 'No aplica')] as [string, string], ['Sucursal', scopeDisplay(log.branchName, 'No aplica')] as [string, string]] : []),
    ['Módulo', auditModuleLabel(log.module, platformScope)], ['Acción', auditActionLabel(log.action)], ['Registro', `${auditEntityLabel(log.entity)} · ${recordDisplay(log)}`], ['Resultado', String(log.result || 'SUCCESS').toUpperCase() === 'SUCCESS' ? 'Correcto' : 'Fallido'],
  ];
  return <div className="min-w-0 space-y-5 overflow-y-auto px-1 pb-2"><div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">{values.map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-border/50 bg-card/60 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold text-foreground">{value || '—'}</p></div>)}</div><div className="space-y-2"><h3 className="text-sm font-black uppercase tracking-tight">Descripción</h3><p className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-foreground">{functionalDescription(log)}</p></div>{technical && <details className="rounded-lg border border-border/60 bg-muted/10 p-3"><summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-muted-foreground">Detalle técnico · solo SuperAdmin</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 text-xs text-muted-foreground">{technical}</pre></details>}<p className="text-xs text-muted-foreground">{showTechnicalDetails ? 'Este detalle muestra información funcional y permite revisar el detalle técnico autorizado.' : 'Este detalle muestra únicamente información funcional del registro.'}</p></div>;
}

export function AuditoriaPage() {
  const { user } = useAuth();
  const platformScope = Boolean(user?.isPlatformAdmin);
  const canView = Boolean(user);
  const canExport = Boolean(user?.isPlatformAdmin || user?.isTenantAdmin || user?.managerMode || user?.permissions?.some((permission) => permission.module.toUpperCase() === 'AUDIT_LOGS' && permission.canExport));
  const [filters, setFilters] = useState<AuditLogQuery>(EMPTY_FILTERS);
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => ({ ...current, search: searchDraft || undefined, page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const logsQuery = useTenantQuery(['audit-logs', platformScope, filters], (signal) => auditService.list(filters, signal), { enabled: canView, staleTime: 15_000 });
  const optionsQuery = useTenantQuery<AuditFilterOptions>(['audit-filter-options', platformScope], (signal) => auditService.filterOptions(signal), { enabled: canView, staleTime: 5 * 60_000 });
  const detailQuery = useTenantQuery<AuditLog>(['audit-log-detail', selectedId], (signal) => auditService.get(selectedId!, signal), { enabled: Boolean(selectedId) });
  const data = logsQuery.data;
  const rows = data?.items || [];
  const options = optionsQuery.data;
  const moduleOptions = useMemo(() => {
    const grouped = new Map<string, { value: string; label: string }>();
    for (const rawValue of options?.modules || []) {
      const value = String(rawValue || '').trim();
      if (!value) continue;
      const label = auditModuleLabel(value, platformScope);
      const key = label.toLocaleLowerCase('es-NI');
      const current = grouped.get(key);
      grouped.set(key, current ? { ...current, value: `${current.value},${value}` } : { value, label });
    }
    return [...grouped.values()];
  }, [options?.modules, platformScope]);
  const selectedEnterpriseGroupId = filters.enterpriseGroupId || '';
  const visibleBusinessUnits = useMemo(() => (options?.businessUnits || []).filter((businessUnit) => businessUnit.enterpriseGroupId === selectedEnterpriseGroupId), [options?.businessUnits, selectedEnterpriseGroupId]);
  const visibleBranches = useMemo(() => (options?.branches || []).filter((branch) => branch.companyId === selectedEnterpriseGroupId && (!filters.businessUnitId || branch.businessUnitId === filters.businessUnitId)), [options?.branches, filters.businessUnitId, selectedEnterpriseGroupId]);
  const successCount = rows.filter((row) => String(row.result || 'SUCCESS').toUpperCase() === 'SUCCESS').length;
  const failureCount = rows.length - successCount;

  const setFilter = (key: keyof AuditLogQuery, value: string | number | undefined) => setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }));
  const setEnterpriseGroup = (value: string) => setFilters((current) => ({ ...current, enterpriseGroupId: value || undefined, businessUnitId: undefined, branchId: undefined, page: 1 }));
  const setBusinessUnit = (value: string) => setFilters((current) => ({ ...current, businessUnitId: value || undefined, branchId: undefined, page: 1 }));
  const clearFilters = () => { setSearchDraft(''); setFilters(EMPTY_FILTERS); };

  const exportLogs = async (format: 'pdf' | 'xlsx') => {
    if (!canExport) return;
    try {
      const response = await auditService.export(filters);
      const rows = response.items.map((row) => ({
        fecha: row.createdAt,
        autor: row.actorName || 'Sistema',
        rol: auditRoleLabel(row.actorRole),
        grupo: scopeDisplay(row.companyName, 'Sin grupo asociado'),
        rubro: scopeDisplay(row.businessUnitName, 'No aplica'),
        sucursal: scopeDisplay(row.branchName, 'No aplica'),
        modulo: auditModuleLabel(row.module, platformScope),
        accion: auditActionLabel(row.action),
        registro: `${auditEntityLabel(row.entity)} · ${recordDisplay(row)}`,
        resultado: row.result === 'SUCCESS' ? 'Correcto' : 'Fallido',
        descripcion: functionalDescription(row),
      }));
      if (format === 'xlsx') {
        createReportWorkbook({ fileName: `novahub-auditoria-${new Date().toISOString().slice(0, 10)}.xlsx`, sheets: [{ name: 'Auditoría', rows }], filters: { ...filters, alcance: platformScope ? 'Plataforma' : 'Sucursal' }, singleSheet: !platformScope });
      } else {
        const pdfSettings = await getPdfDesignSettings('auditoria.logs');
        await generateFastGlobalReportPDF({
          targetKey: 'auditoria.logs',
          title: 'Bitácora de auditoría',
          tenantName: user?.tenantName || 'Mi Empresa',
          settings: pdfSettings,
          rows,
          columns: [
            { header: 'Fecha', value: row => row.fecha || '—' },
            { header: 'Autor', value: row => row.autor },
            { header: 'Módulo', value: row => row.modulo },
            { header: 'Acción', value: row => row.accion },
            { header: 'Registro', value: row => row.registro },
            { header: 'Resultado', value: row => row.resultado },
          ],
          fileName: `novahub-auditoria-${new Date().toISOString().slice(0, 10)}.pdf`,
        });
      }
      toast.success(response.total > response.items.length ? `Se exportaron los primeros ${response.items.length} registros del filtro.` : `Auditoría exportada en ${format === 'xlsx' ? 'Excel' : 'PDF'}.`);
    } catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'No se pudo exportar la auditoría.'); }
  };

  const commonFilters = <><Field label="Buscar"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Autor, acción o registro..." /></div></Field><Field label="Desde"><Input type="date" value={filters.dateFrom || ''} onChange={(event) => setFilter('dateFrom', event.target.value)} /></Field><Field label="Hasta"><Input type="date" value={filters.dateTo || ''} onChange={(event) => setFilter('dateTo', event.target.value)} /></Field>{!platformScope && <SelectField label="Usuario" value={filters.userId} onChange={(value) => setFilter('userId', value)} options={(options?.users || []).map((item) => ({ value: item.id, label: item.name || item.email || 'Usuario' }))} placeholder="Todos los usuarios" />}<SelectField label="Módulo" value={filters.module} onChange={(value) => setFilter('module', value)} options={moduleOptions} placeholder="Todos los módulos" /></>;
  const platformFilters = platformScope && <><Field label="Grupo empresarial"><Combobox value={selectedEnterpriseGroupId} onChange={setEnterpriseGroup} options={(options?.companies || []).map((item) => ({ value: item.id, label: item.name }))} placeholder="Todos los grupos" searchPlaceholder="Buscar grupo empresarial..." emptyMessage="No se encontraron grupos empresariales." maxVisibleOptions={200} /></Field><SelectField label="Rubro" value={filters.businessUnitId} onChange={setBusinessUnit} options={visibleBusinessUnits.map((item) => ({ value: item.id, label: item.name }))} placeholder={selectedEnterpriseGroupId ? 'Todos los rubros' : 'Selecciona un grupo'} disabled={!selectedEnterpriseGroupId} /><SelectField label="Sucursal" value={filters.branchId} onChange={(value) => setFilter('branchId', value)} options={visibleBranches.map((item) => ({ value: item.id, label: item.name }))} placeholder={filters.businessUnitId ? 'Todas las sucursales' : 'Selecciona un rubro'} disabled={!filters.businessUnitId} /></>;

  return <div className="min-w-0 max-w-full overflow-x-hidden p-4 sm:p-6 md:p-10"><div className="mx-auto min-w-0 max-w-[1700px] space-y-6">
    <header className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="flex min-w-0 items-start gap-3"><div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><History className="size-6" /></div><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Control y trazabilidad</p><h1 className="break-words text-2xl font-black uppercase italic tracking-tight text-foreground sm:text-3xl">Logs y auditoría</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{platformScope ? 'Consulta por grupo empresarial, rubro y sucursal dentro del alcance administrativo.' : 'Consulta la actividad de esta sucursal con filtros operativos y lenguaje claro.'}</p></div></div><div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" onClick={() => void logsQuery.refetch()} disabled={logsQuery.isFetching} aria-label="Actualizar logs"><RefreshCw className={cn('size-4', logsQuery.isFetching && 'animate-spin')} />Actualizar</Button>{canExport && <ExportMenu onPdf={() => void exportLogs('pdf')} onExcel={() => void exportLogs('xlsx')} />}</div></header>
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><Card><CardContent className="p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Registros filtrados</p><p className="mt-2 text-2xl font-black">{data?.total ?? '—'}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Correctos en página</p><p className="mt-2 text-2xl font-black text-emerald-600">{successCount}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Incidentes en página</p><p className="mt-2 text-2xl font-black text-destructive">{failureCount}</p></CardContent></Card><Card><CardContent className="flex items-center gap-3 p-4"><ShieldCheck className="size-8 shrink-0 text-primary" /><div><p className="text-xs font-bold uppercase text-muted-foreground">Integridad</p><p className="mt-1 text-sm font-bold">Solo lectura</p></div></CardContent></Card></div>
    <Card><CardHeader className="gap-4"><div><CardTitle className="flex items-center gap-2 text-lg font-black"><FileSearch className="size-5 text-primary" />Filtros de auditoría</CardTitle><CardDescription>{platformScope ? 'Filtra por grupo empresarial, rubro, sucursal y los datos funcionales del evento.' : 'En esta sucursal solo están disponibles los filtros de búsqueda, fecha, usuario y módulo.'}</CardDescription></div><Button variant="ghost" size="sm" className="self-start" onClick={clearFilters}><X className="size-4" />Limpiar</Button></CardHeader><CardContent className={cn('grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2', platformScope ? 'lg:grid-cols-4 xl:grid-cols-5' : 'lg:grid-cols-3')}>{commonFilters}{platformFilters}</CardContent></Card>
    <Card className="min-w-0 overflow-hidden"><CardHeader><CardTitle className="text-lg font-black">Actividad registrada</CardTitle><CardDescription>{data ? `Página ${data.page} de ${data.totalPages} · ${data.total} registro(s)` : 'Cargando registros...'}</CardDescription></CardHeader><CardContent className="min-w-0 p-0"><div className="overflow-x-auto"><table className={cn('w-full text-left text-sm', platformScope ? 'min-w-[1350px]' : 'min-w-[880px]')}><thead className="border-y border-border/60 bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Fecha</th><th className="p-3">Autor</th>{platformScope && <><th className="p-3">Grupo empresarial</th><th className="p-3">Rubro</th><th className="p-3">Sucursal</th></>}<th className="p-3">Módulo</th><th className="p-3">Acción</th><th className="p-3">Registro</th><th className="p-3">Resultado</th><th className="p-3 text-right">Ver</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-border/50 align-top last:border-0 hover:bg-muted/20"><td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{formatDate(row.createdAt)}</td><td className="max-w-[190px] p-3"><p className="truncate font-semibold">{row.actorName || 'Sistema'}</p><p className="truncate text-xs text-muted-foreground">{auditRoleLabel(row.actorRole)}</p></td>{platformScope && <><td className="max-w-[180px] p-3"><span className="break-words font-semibold">{scopeDisplay(row.companyName, 'Sin grupo asociado')}</span></td><td className="max-w-[180px] p-3"><span className="break-words">{scopeDisplay(row.businessUnitName, 'No aplica')}</span></td><td className="max-w-[180px] p-3"><span className="break-words">{scopeDisplay(row.branchName, 'No aplica')}</span></td></>}<td className="p-3"><span className="font-semibold">{auditModuleLabel(row.module, platformScope)}</span></td><td className="p-3 font-semibold">{auditActionLabel(row.action)}</td><td className="max-w-[230px] p-3"><p className="font-semibold">{auditEntityLabel(row.entity)}</p><p className="break-words text-xs text-muted-foreground">{recordDisplay(row)}</p></td><td className="p-3"><ResultBadge value={row.result} /></td><td className="p-3 text-right"><Button variant="ghost" size="sm" onClick={() => setSelectedId(row.id)} aria-label="Ver detalle de la actividad"><Eye className="size-4" />Ver</Button></td></tr>)}</tbody></table></div>{logsQuery.isLoading && <div className="p-10 text-center text-sm text-muted-foreground">Cargando registros...</div>}{logsQuery.error && <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">No se pudieron cargar los registros: {logsQuery.error.message}</div>}{!logsQuery.isLoading && !logsQuery.error && !rows.length && <div className="p-10 text-center text-sm text-muted-foreground">No hay registros para los filtros elegidos.</div>}<div className="flex flex-col gap-3 border-t border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Los registros no se editan ni eliminan desde NovaHub.</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={(data?.page || 1) <= 1 || logsQuery.isFetching} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }))}>Anterior</Button><span className="min-w-[100px] text-center text-xs font-semibold">{data ? `${data.page} / ${data.totalPages}` : '—'}</span><Button variant="outline" size="sm" disabled={!data || data.page >= data.totalPages || logsQuery.isFetching} onClick={() => setFilters((current) => ({ ...current, page: (current.page || 1) + 1 }))}>Siguiente</Button></div></div></CardContent></Card>
    <Dialog open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}><DialogContent className="max-h-[min(92dvh,900px)] w-[calc(100%-1rem)] max-w-5xl overflow-hidden p-0"><DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-12"><DialogTitle className="flex items-center gap-2 text-lg font-black"><Eye className="size-5 text-primary" />Detalle de actividad</DialogTitle><DialogDescription>{detailQuery.data ? `${auditActionLabel(detailQuery.data.action)} · ${formatDate(detailQuery.data.createdAt)}` : 'Cargando detalle...'}</DialogDescription></DialogHeader>{detailQuery.isLoading && <div className="p-10 text-center text-sm text-muted-foreground">Cargando detalle...</div>}{detailQuery.error && <div className="p-6 text-sm text-destructive">No se pudo cargar el detalle: {detailQuery.error.message}</div>}{detailQuery.data && <div className="min-h-0 flex-1 overflow-y-auto p-5"><AuditDetail log={detailQuery.data} platformScope={platformScope} showTechnicalDetails={user?.role === 'superadmin'} /></div>}<DialogFooter className="shrink-0 border-t border-border/60 px-5 py-3"><Button variant="outline" onClick={() => setSelectedId(null)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>
  </div></div>;
}
