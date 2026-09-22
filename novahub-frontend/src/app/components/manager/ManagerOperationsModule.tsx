import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { enterpriseGroupsService, type ManagerOperationsModule as OperationsModule, type ManagerOperationsModuleResponse } from '../../services/enterprise-groups.service';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Eye, LayoutDashboard, ListChecks, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { cn } from '../ui/utils';
import { useCardsOnlyBelowTableBreakpoint } from '../ui/ViewLayoutSelect';
import { buildDateFilteredDownloadFileName } from '../../utils/exportFileNames';
import { managerStatusLabel } from '../../utils/managerLabels';
import { useManagerShellNavigation } from '../ManagerShell';
import { MANAGER_OPERATION_DEFINITIONS } from './manager-operations.types';
import { ExportMenu } from '../ui/ExportMenu';
import { generateManagerTablePDF } from '../../utils/managerReportPdf';

type BranchOption = { id: string; name: string; businessUnitId?: string | null };

const numberFormat = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 });
const formatNumber = (value: unknown) => numberFormat.format(Number(value || 0));
const formatDate = (value: unknown) => { if (!value) return '—'; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-NI'); };
const formatValue = (value: unknown) => typeof value === 'number' ? formatNumber(value) : typeof value === 'boolean' ? (value ? 'Sí' : 'No') : value == null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const dateOf = (row: any) => row.date || row.createdAt || row.updatedAt || row.dueDate || row.reminderDate || row.receivedAt || row.placedAt || row.sentAt || row.costDate;
const primaryOf = (row: any) => row.number || row.code || row.title || row.name || row.trackingCode || row.ticketNumber || row.subject || row.id;
const detailOf = (row: any) => row.description || row.purpose || row.category?.name || row.categoryName || row.station || row.type || '';
const amountOf = (row: any) => row.total ?? row.amount ?? row.requestedAmount ?? row.plannedBudget ?? row.executedCost ?? row.billableWeight ?? row.size ?? row.packageCount;
const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierto', IN_PROGRESS: 'En proceso', IN_PROCESS: 'En proceso', RESOLVED: 'Resuelto', CLOSED: 'Cerrado',
  PENDING: 'Pendiente', PENDING_REVIEW: 'Pendiente de revisión', PENDING_APPROVAL: 'Pendiente de aprobación', CANCELLED: 'Cancelado',
  COMPLETED: 'Completado', DRAFT: 'Borrador', PLANNED: 'Planificado', PAUSED: 'En pausa', SCHEDULED: 'Programado',
  WAITING_DOCS: 'Esperando documentos', APPROVED: 'Aprobado', REJECTED: 'Rechazado', DISBURSED: 'Desembolsado', IN_REVIEW: 'En revisión',
  PENDING_CONFIRMATION: 'Pendiente de confirmación', CONFIRMED: 'Confirmado', SENT_TO_KITCHEN: 'Enviado a cocina', IN_PREPARATION: 'En preparación',
  READY: 'Listo', SERVED: 'Servido', PARTIALLY_PAID: 'Pago parcial', PAID: 'Pagado',
  AVAILABLE: 'Disponible', OCCUPIED: 'Ocupada', RESERVED: 'Reservada', CLEANING: 'Limpieza', INACTIVE: 'Inactiva', ACTIVE: 'Activo',
  RECEIVED: 'Recibido', IN_TRANSIT: 'En tránsito', CUSTOMS: 'Aduana', OUT_FOR_DELIVERY: 'En reparto', DELIVERED: 'Entregado',
  RETURNED: 'Devuelto', ON_HOLD: 'En espera', LOST: 'Extraviado', NONE: 'Pendiente', PURCHASED: 'Conciliado',
  AVAILABLE_FOR_BILLING: 'Disponible para facturar', BILLED: 'Facturado', PUBLISHED: 'Publicado', ARCHIVED: 'Archivado',
  COMMITTED: 'Comprometido', EXECUTED: 'Ejecutado', NO_PAYMENT: 'Sin cobro', COUNTING: 'En conteo', ISSUED: 'Emitido',
  REVERSED: 'Revertido', REFACTURED: 'Refacturado', CREDIT_NOTE: 'Nota de crédito', POSTED: 'Contabilizado', SENT: 'Enviado', SHIPPED: 'Enviado',
  RETURNED_FOR_CORRECTION: 'Devuelto para corrección', CONVERTED_TO_ORDER: 'Convertido a orden', REOPENED: 'Reabierto', EARNED: 'Generado',
  PRESENT: 'Presente', ABSENT: 'Ausente', LATE: 'Tardanza', REMOTE: 'Remoto', HALF_DAY: 'Medio día',
};
const formatStatus = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const normalized = raw.toUpperCase();
  if (STATUS_LABELS[normalized]) return STATUS_LABELS[normalized];
  return managerStatusLabel(value);
};
const DETAIL_LABELS: Record<string, string> = {
  CALL: 'Llamada', MEETING: 'Reunión', EMAIL: 'Correo', TASK: 'Tarea', DEADLINE: 'Fecha límite', EVENT: 'Evento',
  DINE_IN: 'En salón', TAKEAWAY: 'Para llevar', DELIVERY: 'Entrega', QR: 'Código QR', COMMENT: 'Comentario', ACTIVITY: 'Actividad',
  STATUS_CHANGE: 'Cambio de estado', BUDGET_CHANGE: 'Cambio de presupuesto', COST_CHANGE: 'Cambio de costo', MEMBER_ADDED: 'Miembro agregado',
  MEMBER_REMOVED: 'Miembro retirado', TASK_COMPLETED: 'Tarea completada', MILESTONE_COMPLETED: 'Hito completado',
};
const formatDetail = (value: unknown) => {
  const raw = String(value ?? '').trim();
  return DETAIL_LABELS[raw.toUpperCase()] || formatValue(value);
};
const branchNameOf = (row: any, branches: BranchOption[]) => {
  if (row?.branchName || row?.branch?.name) return row.branchName || row.branch.name;
  const branchId = row?.branchId || row?.branch?.id || row?.clientTenantId || row?.tenantId;
  return branches.find((branch) => branch.id === branchId)?.name || 'Sucursal no identificada';
};
const STATUS_BY_MODULE: Record<string, string[]> = {
  activities: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], projects: ['DRAFT', 'PLANNED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED'], tickets: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], restaurant: ['PENDING_CONFIRMATION', 'CONFIRMED', 'SENT_TO_KITCHEN', 'IN_PREPARATION', 'READY', 'SERVED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'], logistics: ['PENDING', 'RECEIVED', 'IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'ON_HOLD', 'LOST', 'CANCELLED'], financing: ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED'], legal: ['PENDING', 'IN_PROGRESS', 'WAITING_DOCS', 'COMPLETED', 'CANCELLED'], novachat: ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'], support: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
};
function getStatusOptions(module: OperationsModule, view: string) {
  if (module === 'tickets' && view === 'faqs') return ['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((value) => ({ value, label: STATUS_LABELS[value] || formatStatus(value) }));
  if (module === 'tickets' && view === 'agents') return ['ACTIVE', 'INACTIVE'].map((value) => ({ value, label: STATUS_LABELS[value] || formatStatus(value) }));
  if (module === 'logistics' && view === 'reconciliation') return ['NONE', 'PURCHASED'].map((value) => ({ value, label: STATUS_LABELS[value] || formatStatus(value) }));
  if (module === 'logistics' && view === 'billing') return ['NONE', 'AVAILABLE_FOR_BILLING', 'BILLED', 'DELIVERED'].map((value) => ({ value, label: STATUS_LABELS[value] || formatStatus(value) }));
  if (module === 'documents' || (module === 'novachat' && ['channels', 'contacts', 'agents'].includes(view)) || (module === 'projects' && ['budget', 'resources', 'documents', 'activities'].includes(view)) || (module === 'activities' && view === 'logs') || (module === 'tickets' && view === 'categories') || (module === 'restaurant' && view === 'menu')) return [];
  return (STATUS_BY_MODULE[module] || []).map((value) => ({ value, label: STATUS_LABELS[value] || formatStatus(value) }));
}

export function ManagerOperationsModule({ module, view: requestedView, onViewChange, groupId, businessUnitId, branchId, branches, canExport = true }: { module: OperationsModule; view?: string; onViewChange?: (view: string) => void; groupId: string; businessUnitId?: string; branchId?: string; branches: BranchOption[]; canExport?: boolean }) {
  const { sidebarCollapsed } = useManagerShellNavigation();
  const [internalView, setInternalView] = useState('overview');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [exporting, setExporting] = useState(false);
  const isCompact = useCardsOnlyBelowTableBreakpoint();
  const definition = MANAGER_OPERATION_DEFINITIONS.find((item) => item.id === module) || MANAGER_OPERATION_DEFINITIONS[0];
  const view = requestedView || internalView;
  const activeView = definition.views.some((item) => item.id === view) ? view : 'overview';
  const query = useTenantQuery<ManagerOperationsModuleResponse>(
    ['manager-operations', groupId, definition.id, activeView, businessUnitId || 'all', branchId || 'all', debouncedSearch, status, dateFrom, dateTo, page, pageSize],
    (signal) => enterpriseGroupsService.getOperationsModule(groupId, { module: definition.id, view: activeView, businessUnitId, branchId, search: debouncedSearch || undefined, status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, pageSize }, signal),
    { enabled: Boolean(groupId) },
  );
  const response = query.data;
  const rows = response?.data || [];
  const metrics = response?.metrics || {};
  const statusOptions = getStatusOptions(definition.id, activeView);
  const showDateFilters = !(definition.id === 'documents' || (definition.id === 'projects' && activeView === 'documents'));
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search), 300); return () => window.clearTimeout(timer); }, [search]);
  const changeView = (next: string) => { if (onViewChange) onViewChange(next); else setInternalView(next); setPage(1); setStatus(''); setSelectedRow(null); };
  const clearFilters = () => { setSearch(''); setStatus(''); setDateFrom(''); setDateTo(''); setPage(1); };
  const exportReport = async (format: 'xlsx' | 'pdf' = 'xlsx') => {
    if (!canExport) return;
    setExporting(true);
    try {
      const report = await enterpriseGroupsService.getOperationsModule(groupId, { module: definition.id, view: activeView, businessUnitId, branchId, search: search || undefined, status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page: 1, pageSize: 5000, report: true, export: true });
      const exportRows = (report.data || []).map((row: any) => ({ Sucursal: branchNameOf(row, branches), Registro: primaryOf(row), Detalle: formatDetail(detailOf(row)), Fecha: formatDate(dateOf(row)), Estado: formatStatus(row.status), Valor: amountOf(row) == null ? '' : formatValue(amountOf(row)), Rubro: row.businessUnitName || '' }));
      if (format === 'pdf') {
        await generateManagerTablePDF({ title: `Operaciones consolidadas · ${definition.label} · ${activeView}`, rows: exportRows, fileName: buildDateFilteredDownloadFileName(['manager', module, activeView], 'pdf', dateFrom, dateTo) });
        return;
      }
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows.length ? exportRows : [{ Mensaje: 'Sin registros para el alcance seleccionado' }]), 'Operaciones');
      XLSX.writeFile(workbook, buildDateFilteredDownloadFileName(['manager', module, activeView], 'xlsx', dateFrom, dateTo));
    } finally { setExporting(false); }
  };
  const overviewEntries = Object.entries(metrics).filter(([key, value]) => !['branchCount', 'total'].includes(key) && typeof value === 'number');
  const currentPage = response?.meta.page || page;
  const totalPages = response?.meta.totalPages || 1;
  return <div className="manager-operations-module min-w-0 space-y-5 overflow-x-hidden p-4 sm:p-6 md:p-8">
    <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-start gap-3"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><definition.icon className="size-6" /></div><div className="min-w-0"><h1 className="truncate text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">Consolidado de <span className="text-primary">{definition.label}</span></h1><p className="mt-1 text-sm text-muted-foreground">Lectura agregada por sucursal, con origen visible en cada registro.</p><Badge variant="outline" className="mt-3 rounded-md border-primary/20 bg-primary/10 text-[10px] font-black uppercase tracking-widest text-primary">{branches.length} sucursal(es) en el alcance</Badge></div></div>
      <div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" className="rounded-xl" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={cn('mr-2 size-4', query.isFetching && 'animate-spin')} />Actualizar</Button>{canExport && <ExportMenu disabled={exporting} onPdf={() => void exportReport('pdf')} onExcel={() => void exportReport('xlsx')} pdfDescription="Consolidado operativo de Manager" excelDescription="Todos los registros del alcance" />}</div>
    </div>
    {sidebarCollapsed && <div className="sales-subnav manager-module-subnav flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 to-muted/50 p-1.5 backdrop-blur-sm" role="tablist" aria-label={`Vistas de ${definition.label}`}>{definition.views.map((item) => <button key={item.id} type="button" role="tab" aria-selected={activeView === item.id} onClick={() => changeView(item.id)} className={cn('flex-none shrink-0 rounded-xl px-3 py-2.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', activeView === item.id && 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg hover:from-primary hover:to-primary/80 hover:text-primary-foreground')}>{item.label}</button>)}</div>}
    {activeView !== 'overview' && <Card className="rounded-3xl border-border/60 shadow-sm"><CardContent className="grid min-w-0 grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_minmax(150px,.7fr)_minmax(150px,.7fr)_minmax(150px,.7fr)_auto] xl:items-end"><label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>Buscar</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Número, nombre, descripción..." className="pl-9" />{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="size-3.5" /></button>}</div></label><label className="space-y-1.5 text-xs font-bold text-muted-foreground"><span>Estado</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal"><option value="">Todos</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>{showDateFilters && <><label className="space-y-1.5 text-xs font-bold text-muted-foreground"><span>Fecha desde</span><Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></label><label className="space-y-1.5 text-xs font-bold text-muted-foreground"><span>Fecha hasta</span><Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></label></>}<Button type="button" variant="ghost" className="rounded-xl" onClick={clearFilters}>Limpiar</Button></CardContent></Card>}
    {query.error && <Card className="rounded-3xl border-destructive/30 bg-destructive/5"><CardContent className="p-6 text-sm text-destructive"><p className="font-black">No se pudo cargar el módulo.</p><p className="mt-1 break-words">{query.error.message}</p></CardContent></Card>}
    {query.isLoading ? <LoadingState /> : activeView === 'overview' ? <Overview metrics={overviewEntries} branchCount={Number(metrics.branchCount || branches.length)} /> : <>{isCompact ? <Cards rows={rows} branches={branches} onDetails={setSelectedRow} /> : <DataTable rows={rows} branches={branches} onDetails={setSelectedRow} />}{rows.length > 0 && <Pagination page={currentPage} totalPages={totalPages} total={response?.meta.total || 0} pageSize={pageSize} setPage={setPage} setPageSize={(next) => { setPageSize(next); setPage(1); }} />}</>}
    {selectedRow && <DetailCard row={selectedRow} branches={branches} onClose={() => setSelectedRow(null)} />}
  </div>;
}

function Overview({ metrics, branchCount }: { metrics: Array<[string, unknown]>; branchCount: number }) { return <div className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.length ? metrics.map(([label, value]) => <Card key={label} className="rounded-2xl border-border/60 shadow-sm"><CardContent className="p-5"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label.replaceAll(/([A-Z])/g, ' $1')}</p><p className="mt-2 truncate text-2xl font-black">{formatNumber(value)}</p></CardContent></Card>) : <Card className="rounded-3xl border-dashed sm:col-span-2 xl:col-span-4"><CardContent className="p-10 text-center text-sm text-muted-foreground"><LayoutDashboard className="mx-auto mb-3 size-8 text-primary/60" />No hay indicadores para el alcance seleccionado.</CardContent></Card>}</div><Card className="rounded-3xl border-primary/20 bg-primary/5"><CardHeader><CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><ListChecks className="size-5 text-primary" /> Lectura gerencial</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2"><p className="text-muted-foreground">Sucursales incluidas: <strong className="text-foreground">{formatNumber(branchCount)}</strong></p><p className="text-muted-foreground">Los indicadores se calculan en backend; al abrir una vista se muestran registros paginados y su sucursal de origen.</p></CardContent></Card></div>; }

function DataTable({ rows, branches, onDetails }: { rows: any[]; branches: BranchOption[]; onDetails: (row: any) => void }) { return <Card className="overflow-hidden rounded-3xl border-border/60 shadow-sm"><CardContent className="p-0">{rows.length ? <div className="sales-responsive-table overflow-x-auto"><Table className="min-w-[900px]"><TableHeader><TableRow><TableHead>Sucursal</TableHead><TableHead>Registro</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead><TableHead>Detalle</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="whitespace-nowrap font-semibold text-primary">{branchNameOf(row, branches)}</TableCell><TableCell><p className="font-semibold">{formatValue(primaryOf(row))}</p><p className="text-xs text-muted-foreground">{row.id?.slice?.(0, 8) || ''}</p></TableCell><TableCell className="whitespace-nowrap">{formatDate(dateOf(row))}</TableCell><TableCell><Badge variant="outline" className="capitalize">{formatStatus(row.status)}</Badge></TableCell><TableCell className="max-w-72 break-words">{formatDetail(detailOf(row))}</TableCell><TableCell className="text-right font-semibold">{formatValue(amountOf(row))}</TableCell><TableCell className="text-right"><Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => onDetails(row)}><Eye className="mr-1.5 size-3.5" />Detalle</Button></TableCell></TableRow>)}</TableBody></Table></div> : <EmptyState />}</CardContent></Card>; }

function Cards({ rows, branches, onDetails }: { rows: any[]; branches: BranchOption[]; onDetails: (row: any) => void }) { return rows.length ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{rows.map((row) => <Card key={row.id} className="rounded-2xl border-border/60 shadow-sm"><CardContent className="space-y-3 p-5"><p className="border-b border-border/60 pb-2 text-xs font-semibold text-primary">Sucursal: {branchNameOf(row, branches)}</p><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black">{formatValue(primaryOf(row))}</p><p className="text-xs text-muted-foreground">{formatDetail(detailOf(row))}</p></div><Badge variant="outline" className="shrink-0 capitalize">{formatStatus(row.status)}</Badge></div><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Fecha</p><p className="font-semibold">{formatDate(dateOf(row))}</p></div><div><p className="text-xs text-muted-foreground">Valor</p><p className="font-black">{formatValue(amountOf(row))}</p></div></div><Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => onDetails(row)}><Eye className="mr-2 size-4" />Ver detalle</Button></CardContent></Card>)}</div> : <EmptyState />; }

function DetailCard({ row, branches, onClose }: { row: any; branches: BranchOption[]; onClose: () => void }) { const fields = Object.entries(row).filter(([key, value]) => !['id', 'clientTenantId', 'tenantId'].includes(key) && value !== null && value !== undefined && typeof value !== 'function'); return <Card className="rounded-3xl border-primary/25 bg-primary/5"><CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle className="text-lg font-black uppercase italic tracking-tight">Detalle del registro</CardTitle><p className="mt-1 text-sm text-muted-foreground">{formatValue(primaryOf(row))} · {branchNameOf(row, branches)}</p></div><Button type="button" variant="ghost" size="icon" aria-label="Cerrar detalle" onClick={onClose}><X className="size-4" /></Button></CardHeader><CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">{fields.map(([key, value]) => <div key={key} className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{key.replaceAll(/([A-Z])/g, ' $1')}</p><p className="break-words font-semibold">{key.toLowerCase().includes('status') ? formatStatus(value) : key === 'type' ? formatDetail(value) : formatValue(value)}</p></div>)}</CardContent></Card>; }

function Pagination({ page, totalPages, total, pageSize, setPage, setPageSize }: { page: number; totalPages: number; total: number; pageSize: number; setPage: (page: number) => void; setPageSize: (size: number) => void }) { return <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{formatNumber(total)} registro(s)</span><div className="flex items-center gap-2"><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-9 rounded-lg border border-border bg-background px-2 text-xs"><option value={25}>25 / página</option><option value={50}>50 / página</option><option value={100}>100 / página</option></select><Button type="button" variant="outline" size="icon" className="size-9 rounded-lg" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Página anterior"><ChevronLeft className="size-4" /></Button><span className="min-w-20 text-center text-xs font-semibold">Página {page} de {totalPages}</span><Button type="button" variant="outline" size="icon" className="size-9 rounded-lg" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Página siguiente"><ChevronRight className="size-4" /></Button></div></div>; }
function LoadingState() { return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><RefreshCw className="mr-2 size-5 animate-spin" />Cargando operaciones consolidadas...</div>; }
function EmptyState() { return <div className="flex min-h-48 flex-col items-center justify-center rounded-3xl border border-dashed border-border px-5 text-center"><CalendarDays className="size-8 text-muted-foreground/40" /><p className="mt-3 font-black">Sin registros</p><p className="mt-1 text-sm text-muted-foreground">No hay información para el alcance y filtros seleccionados.</p></div>; }
