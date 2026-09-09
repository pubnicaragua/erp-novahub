import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Download, Eye, FileSearch, History, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTenantQuery } from '../hooks/useTenantQuery';
import { auditService, type AuditLog, type AuditLogQuery, type AuditFilterOptions } from '../services/audit.service';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { cn } from './ui/utils';

const EMPTY_FILTERS: AuditLogQuery = { page: 1, pageSize: 25 };

const labels: Record<string, string> = {
  AUTH: 'Autenticación', SALES: 'Ventas', PURCHASES: 'Compras', INVENTORY: 'Inventario',
  CONFIGURATION: 'Configuración', HR: 'Recursos humanos', ACTIVITIES: 'Actividades',
  PROJECTS: 'Proyectos', RESTAURANT: 'Restaurante', SUPPORT_TECH: 'Soporte', TRACKING: 'Tracking',
  ACCOUNTING: 'Contabilidad', FINANCIALS: 'Finanzas', CREATE: 'Creación', UPDATE: 'Edición',
  DELETE: 'Eliminación', PAYMENT: 'Pago', STATUS_CHANGE: 'Cambio de estado', INVENTORY_AUDIT: 'Auditoría de inventario',
  LOGIN: 'Inicio de sesión', LOGOUT: 'Cierre de sesión', LOGIN_FAILED: 'Inicio fallido', ACCESS_DENIED: 'Acceso denegado',
  EXPORT: 'Exportación', IMPORT: 'Importación', APPROVE: 'Aprobación', REJECT: 'Rechazo', SUCCESS: 'Correcto', FAILURE: 'Fallido',
};

const humanize = (value?: string | null) => {
  if (!value) return '—';
  return labels[value] || value.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
};

const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

function stringify(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') {
    try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
  }
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function changePart(value: unknown, key: 'before' | 'after') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return key in record ? record[key] : undefined;
}

function ResultBadge({ value }: { value?: string | null }) {
  const result = String(value || 'SUCCESS').toUpperCase();
  return <Badge variant="outline" className={cn('font-bold', result === 'SUCCESS' ? 'border-emerald-500/40 text-emerald-600' : 'border-destructive/40 text-destructive')}>{humanize(result)}</Badge>;
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn('flex min-w-0 flex-col gap-1.5', className)}><span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}

function SelectField({ label, value, onChange, options, placeholder = 'Todos' }: { label: string; value?: string; onChange: (value: string) => void; options: Array<string | { value: string; label: string }>; placeholder?: string }) {
  return <Field label={label}><select value={value || ''} onChange={(event) => onChange(event.target.value)} className="h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">{placeholder}</option>{options.map((option) => { const item = typeof option === 'string' ? { value: option, label: humanize(option) } : option; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select></Field>;
}

function DetailValue({ value }: { value: unknown }) {
  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-foreground">{stringify(value)}</pre>;
}

function AuditDetail({ log }: { log: AuditLog }) {
  const changedFields = log.changedFields && typeof log.changedFields === 'object' && !Array.isArray(log.changedFields)
    ? Object.entries(log.changedFields as Record<string, unknown>)
    : [];
  return <div className="min-w-0 space-y-5 overflow-y-auto px-1 pb-2">
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {[
        ['Fecha', formatDate(log.createdAt)], ['Actor', log.actorName || log.user?.name || 'Sistema'],
        ['Correo', log.actorEmail || log.user?.email || '—'], ['Rol', humanize(log.actorRole || log.user?.role)],
        ['Empresa', log.companyName], ['Sucursal', log.branchName], ['Módulo', humanize(log.module)],
        ['Vista / submódulo', [log.view, log.submodule].filter(Boolean).map(humanize).join(' · ') || '—'],
        ['Acción', humanize(log.action)], ['Resultado', humanize(log.result)], ['Origen', humanize(log.source)],
        ['Registro', [humanize(log.entity), log.entityLabel || log.entityId].filter(Boolean).join(' · ')],
      ].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-border/50 bg-card/60 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold text-foreground">{value || '—'}</p></div>)}
    </div>
    <div className="space-y-2"><h3 className="text-sm font-black uppercase tracking-tight">Descripción</h3><p className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-foreground">{log.description || '—'}</p></div>
    {changedFields.length > 0 && <div className="space-y-2"><h3 className="text-sm font-black uppercase tracking-tight">Campos modificados</h3><div className="overflow-x-auto rounded-lg border border-border/60"><table className="w-full min-w-[420px] text-left text-xs"><thead className="bg-muted/40"><tr><th className="p-2">Campo</th><th className="p-2">Antes</th><th className="p-2">Después</th></tr></thead><tbody>{changedFields.map(([field, value]) => <tr key={field} className="border-t border-border/50"><td className="p-2 font-semibold">{field}</td><td className="max-w-[180px] break-words p-2 text-muted-foreground">{stringify(changePart(value, 'before'))}</td><td className="max-w-[180px] break-words p-2">{stringify(changePart(value, 'after') ?? value)}</td></tr>)}</tbody></table></div></div>}
    <div className="grid min-w-0 gap-4 lg:grid-cols-2"><div className="space-y-2"><h3 className="text-sm font-black uppercase tracking-tight">Estado anterior</h3><DetailValue value={log.beforeData} /></div><div className="space-y-2"><h3 className="text-sm font-black uppercase tracking-tight">Estado posterior</h3><DetailValue value={log.afterData} /></div></div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2"><div className="space-y-2"><h3 className="text-sm font-black uppercase tracking-tight">Metadatos</h3><DetailValue value={log.metadata || log.details} /></div><div className="space-y-2"><h3 className="text-sm font-black uppercase tracking-tight">Contexto técnico</h3><DetailValue value={{ context: log.context, endpoint: log.endpoint, correlationId: log.correlationId, ipAddress: log.ipAddress, userAgent: log.userAgent }} /></div></div>
  </div>;
}

function toCsvValue(value: unknown) {
  const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function AuditoriaPage() {
  const { user } = useAuth();
  const canView = Boolean(user);
  const canExport = user?.isPlatformAdmin || user?.isTenantAdmin || user?.managerMode || user?.permissions?.some((permission) => permission.module.toUpperCase() === 'AUDIT_LOGS' && permission.canExport);
  const [filters, setFilters] = useState<AuditLogQuery>(EMPTY_FILTERS);
  const [searchDraft, setSearchDraft] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => ({ ...current, search: searchDraft || undefined, page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const logsQuery = useTenantQuery(['audit-logs', filters], (signal) => auditService.list(filters, signal), { enabled: canView, staleTime: 15_000 });
  const optionsQuery = useTenantQuery<AuditFilterOptions>(['audit-filter-options'], (signal) => auditService.filterOptions(signal), { enabled: canView, staleTime: 5 * 60_000 });
  const detailQuery = useTenantQuery<AuditLog>(['audit-log-detail', selectedId], (signal) => auditService.get(selectedId!, signal), { enabled: Boolean(selectedId) });
  const data = logsQuery.data;
  const rows = data?.items || [];
  const options = optionsQuery.data;
  const successCount = rows.filter((row) => String(row.result || 'SUCCESS').toUpperCase() === 'SUCCESS').length;
  const failureCount = rows.length - successCount;
  const modules = useMemo(() => options?.modules || [], [options?.modules]);

  const setFilter = (key: keyof AuditLogQuery, value: string | number | undefined) => setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }));
  const clearFilters = () => { setSearchDraft(''); setFilters(EMPTY_FILTERS); };

  const exportLogs = async () => {
    if (!canExport) return;
    try {
      const response = await auditService.export(filters);
      const header = ['Fecha', 'Actor', 'Rol', 'Empresa', 'Sucursal', 'Módulo', 'Submódulo', 'Acción', 'Entidad', 'Identificador', 'Resultado', 'Descripción', 'IP', 'Correlación'];
      const lines = response.items.map((row) => [row.createdAt, row.actorName, row.actorRole, row.companyName, row.branchName, row.module, row.submodule, row.action, row.entity, row.entityLabel || row.entityId, row.result, row.description, row.ipAddress, row.correlationId].map(toCsvValue).join(','));
      const blob = new Blob([`\uFEFF${header.map(toCsvValue).join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `novahub-auditoria-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
      toast.success(response.total > response.items.length ? `Se exportaron los primeros ${response.items.length} registros del filtro.` : 'Auditoría exportada.');
    } catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'No se pudo exportar la auditoría.'); }
  };

  return <div className="min-w-0 max-w-full overflow-x-hidden p-4 sm:p-6 md:p-10"><div className="mx-auto min-w-0 max-w-[1700px] space-y-6">
    <header className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="flex min-w-0 items-start gap-3"><div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><History className="size-6" /></div><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Control y trazabilidad</p><h1 className="break-words text-2xl font-black uppercase italic tracking-tight text-foreground sm:text-3xl">Logs y auditoría</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Registro inmutable de operaciones, accesos y cambios dentro del alcance autorizado.</p></div></div><div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" onClick={() => void logsQuery.refetch()} disabled={logsQuery.isFetching} aria-label="Actualizar logs"><RefreshCw className={cn('size-4', logsQuery.isFetching && 'animate-spin')} />Actualizar</Button>{canExport && <Button onClick={() => void exportLogs()}><Download className="size-4" />Exportar</Button>}</div></header>
    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><Card><CardContent className="p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Registros filtrados</p><p className="mt-2 text-2xl font-black">{data?.total ?? '—'}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Correctos en página</p><p className="mt-2 text-2xl font-black text-emerald-600">{successCount}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Incidentes en página</p><p className="mt-2 text-2xl font-black text-destructive">{failureCount}</p></CardContent></Card><Card><CardContent className="flex items-center gap-3 p-4"><ShieldCheck className="size-8 shrink-0 text-primary" /><div><p className="text-xs font-bold uppercase text-muted-foreground">Integridad</p><p className="mt-1 text-sm font-bold">Solo lectura</p></div></CardContent></Card></div>
    <Card><CardHeader className="gap-4"><div><CardTitle className="flex items-center gap-2 text-lg font-black"><FileSearch className="size-5 text-primary" />Filtros de auditoría</CardTitle><CardDescription>Las condiciones se ejecutan en el servidor y respetan empresa, sucursal y permisos del actor.</CardDescription></div><div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" onClick={clearFilters}><X className="size-4" />Limpiar</Button></div></CardHeader><CardContent className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"><Field label="Buscar"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Actor, acción, entidad..." /></div></Field><Field label="Desde"><Input type="date" value={filters.dateFrom || ''} onChange={(event) => setFilter('dateFrom', event.target.value)} /></Field><Field label="Hasta"><Input type="date" value={filters.dateTo || ''} onChange={(event) => setFilter('dateTo', event.target.value)} /></Field><Field label="Identificador"><Input value={filters.identifier || ''} onChange={(event) => setFilter('identifier', event.target.value)} placeholder="UUID, número o código" /></Field><SelectField label="Usuario" value={filters.userId} onChange={(value) => setFilter('userId', value)} options={(options?.users || []).map((item) => ({ value: item.id, label: item.name || item.email || item.id }))} placeholder="Todos los usuarios" /><SelectField label="Rol" value={filters.role} onChange={(value) => setFilter('role', value)} options={options?.roles || []} /><SelectField label="Empresa" value={filters.enterpriseGroupId} onChange={(value) => setFilter('enterpriseGroupId', value)} options={(options?.companies || []).map((item) => ({ value: item.id, label: item.name || item.id }))} /><SelectField label="Sucursal" value={filters.branchId} onChange={(value) => setFilter('branchId', value)} options={(options?.branches || []).map((item) => ({ value: item.id, label: item.name || item.id }))} /><SelectField label="Módulo" value={filters.module} onChange={(value) => setFilter('module', value)} options={modules} /><SelectField label="Submódulo" value={filters.submodule} onChange={(value) => setFilter('submodule', value)} options={options?.submodules || []} /><SelectField label="Acción" value={filters.action} onChange={(value) => setFilter('action', value)} options={options?.actions || []} /><SelectField label="Entidad" value={filters.entity} onChange={(value) => setFilter('entity', value)} options={options?.entities || []} /><SelectField label="Resultado" value={filters.result} onChange={(value) => setFilter('result', value)} options={options?.results || ['SUCCESS', 'FAILURE']} /></CardContent></Card>
    <Card className="min-w-0 overflow-hidden"><CardHeader><CardTitle className="text-lg font-black">Actividad registrada</CardTitle><CardDescription>{data ? `Página ${data.page} de ${data.totalPages} · ${data.total} registro(s)` : 'Cargando registros...'}</CardDescription></CardHeader><CardContent className="min-w-0 p-0"><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1120px] text-left text-sm"><thead className="border-y border-border/60 bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Fecha</th><th className="p-3">Actor</th><th className="p-3">Empresa / sucursal</th><th className="p-3">Módulo</th><th className="p-3">Acción</th><th className="p-3">Registro</th><th className="p-3">Resultado</th><th className="p-3 text-right">Detalle</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-border/50 align-top last:border-0 hover:bg-muted/20"><td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{formatDate(row.createdAt)}</td><td className="max-w-[190px] p-3"><p className="truncate font-semibold">{row.actorName || 'Sistema'}</p><p className="truncate text-xs text-muted-foreground">{humanize(row.actorRole)}</p></td><td className="max-w-[210px] p-3"><p className="truncate font-semibold">{row.companyName || '—'}</p><p className="truncate text-xs text-muted-foreground">{row.branchName || '—'}</p></td><td className="p-3"><p className="font-semibold">{humanize(row.module)}</p><p className="text-xs text-muted-foreground">{humanize(row.submodule)}</p></td><td className="p-3 font-semibold">{humanize(row.action)}</td><td className="max-w-[220px] p-3"><p className="truncate font-semibold">{humanize(row.entity)}</p><p className="truncate text-xs text-muted-foreground">{row.entityLabel || row.entityId}</p></td><td className="p-3"><ResultBadge value={row.result} /></td><td className="p-3 text-right"><Button variant="ghost" size="sm" onClick={() => setSelectedId(row.id)} aria-label={`Ver detalle del log ${row.id}`}><Eye className="size-4" />Ver</Button></td></tr>)}</tbody></table></div><div className="space-y-3 p-4 md:hidden">{rows.map((row) => <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className="block w-full rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black">{humanize(row.action)} · {humanize(row.module)}</p><p className="mt-1 truncate text-xs text-muted-foreground">{row.actorName || 'Sistema'} · {formatDate(row.createdAt)}</p></div><ResultBadge value={row.result} /></div><p className="mt-3 break-words text-xs text-muted-foreground">{row.description || `${humanize(row.entity)} · ${row.entityLabel || row.entityId}`}</p></button>)}{!rows.length && !logsQuery.isLoading && <p className="py-10 text-center text-sm text-muted-foreground">No hay registros para los filtros elegidos.</p>}</div>{logsQuery.isLoading && <div className="p-10 text-center text-sm text-muted-foreground">Cargando logs...</div>}{logsQuery.error && <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">No se pudieron cargar los logs: {logsQuery.error.message}</div>}{!logsQuery.isLoading && !logsQuery.error && !rows.length && <div className="hidden p-10 text-center text-sm text-muted-foreground md:block">No hay registros para los filtros elegidos.</div>}<div className="flex flex-col gap-3 border-t border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Los registros no se editan ni eliminan desde NovaHub.</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={(data?.page || 1) <= 1 || logsQuery.isFetching} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }))}>Anterior</Button><span className="min-w-[100px] text-center text-xs font-semibold">{data ? `${data.page} / ${data.totalPages}` : '—'}</span><Button variant="outline" size="sm" disabled={!data || data.page >= data.totalPages || logsQuery.isFetching} onClick={() => setFilters((current) => ({ ...current, page: (current.page || 1) + 1 }))}>Siguiente</Button></div></div></CardContent></Card>
    <Dialog open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}><DialogContent className="max-h-[min(92dvh,900px)] w-[calc(100%-1rem)] max-w-5xl overflow-hidden p-0"><DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4 pr-12"><DialogTitle className="flex items-center gap-2 text-lg font-black"><Eye className="size-5 text-primary" />Detalle del log</DialogTitle><DialogDescription>{detailQuery.data ? `${humanize(detailQuery.data.action)} · ${formatDate(detailQuery.data.createdAt)}` : 'Cargando detalle...'}</DialogDescription></DialogHeader>{detailQuery.isLoading && <div className="p-10 text-center text-sm text-muted-foreground">Cargando detalle...</div>}{detailQuery.error && <div className="p-6 text-sm text-destructive">No se pudo cargar el detalle: {detailQuery.error.message}</div>}{detailQuery.data && <div className="min-h-0 flex-1 overflow-y-auto p-5"><AuditDetail log={detailQuery.data} /></div>}<DialogFooter className="shrink-0 border-t border-border/60 px-5 py-3"><Button variant="outline" onClick={() => setSelectedId(null)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>
  </div></div>;
}
