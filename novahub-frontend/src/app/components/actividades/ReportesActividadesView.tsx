import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight, ClipboardCheck, Download, FileText, Filter, ListTree, RefreshCw, Rows3, Search, UsersRound, ListTodo, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DateField } from '../ui/DateField';
import { KpiSummaryNotice } from '../ui/KpiSummaryNotice';
import { SalesKpiCard } from '../ventas/SalesKpiCard';
import { cn } from '../ui/utils';
import { ActivityViewHeader } from './ActivityViewHeader';
import { ReportEntry, REPORT_KIND_LABEL } from './ReportEntry';
import { resolvePeriod, type PeriodPreset } from './reportPeriod';
import { activityReportsService } from '../../services/actividades.service';
import { usersService } from '../../services/users.service';
import { useAuth } from '../../contexts/AuthContext';
import { asList, invalidateTenantQueries, useTenantQuery } from '../../hooks/useTenantQuery';
import { createReportWorkbook } from '../../utils/reportWorkbook';
import { buildDatedDownloadFileName } from '../../utils/exportFileNames';
import type { ActivityReportFeedItem } from '../../types';

type StatusFilter = 'ALL' | 'INCOMPLETE' | 'WITH_FILES';
type Grouping = 'TASK' | 'TIME';

const TASK_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', WAITING_APPROVAL: 'Por aprobar', COMPLETED: 'Completada', CANCELLED: 'Cancelada',
};

const startOfLocalDay = (value: string) => new Date(`${value}T00:00:00`).toISOString();
const endOfLocalDay = (value: string) => new Date(`${value}T23:59:59.999`).toISOString();

interface TaskGroup {
  task: ActivityReportFeedItem['task'];
  items: ActivityReportFeedItem[];
  incomplete: number;
}

export function ReportesActividadesView() {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const canReview = canPerform('ACTIVITIES_TASKS', 'approve');
  const canExport = canPerform('ACTIVITIES_TASKS', 'export');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [authorId, setAuthorId] = useState('ALL');
  const [preset, setPreset] = useState<PeriodPreset>('30D');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [grouping, setGrouping] = useState<Grouping>('TASK');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const period = resolvePeriod(preset, { from: customFrom, to: customTo });
  const usersQuery = useTenantQuery<any[]>(['activities', 'report-users'], (signal) => usersService.getLookup(undefined, signal));
  const users = asList(usersQuery.data);

  const filters = {
    authorId: authorId === 'ALL' ? undefined : authorId,
    from: period.from ? startOfLocalDay(period.from) : undefined,
    to: period.to ? endOfLocalDay(period.to) : undefined,
    incomplete: statusFilter === 'INCOMPLETE' ? true : undefined,
    withFiles: statusFilter === 'WITH_FILES' ? true : undefined,
    search: debouncedSearch || undefined,
  };
  const reportsQuery = useTenantQuery(
    ['activities', 'reports-center', filters],
    (signal) => activityReportsService.list({ ...filters, limit: 500 }, signal),
  );
  const feed = reportsQuery.data?.items ?? [];
  const summary = reportsQuery.data?.summary;
  const loading = reportsQuery.isLoading || reportsQuery.isFetching;

  const groups = useMemo<TaskGroup[]>(() => {
    const map = new Map<string, TaskGroup>();
    for (const item of feed) {
      const existing = map.get(item.activityId);
      if (existing) {
        existing.items.push(item);
        if (item.isIncomplete) existing.incomplete += 1;
      } else {
        map.set(item.activityId, { task: item.task, items: [item], incomplete: item.isIncomplete ? 1 : 0 });
      }
    }
    // Primero las tareas con algo pendiente de complementar; luego la actividad más reciente.
    return [...map.values()].sort((a, b) => (b.incomplete - a.incomplete) || (new Date(b.items[0].createdAt).getTime() - new Date(a.items[0].createdAt).getTime()));
  }, [feed]);

  const activeFilters = (authorId !== 'ALL' ? 1 : 0) + (preset !== '30D' ? 1 : 0) + (statusFilter !== 'ALL' ? 1 : 0) + (debouncedSearch ? 1 : 0);
  const resetFilters = () => { setSearch(''); setAuthorId('ALL'); setPreset('30D'); setCustomFrom(''); setCustomTo(''); setStatusFilter('ALL'); };
  const refresh = () => { void invalidateTenantQueries(queryClient); };
  const toggleGroup = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const exportExcel = () => {
    if (feed.length === 0) { toast.info('No hay reportes para exportar con estos filtros.'); return; }
    const rows = feed.map((item) => ({
      Fecha: new Date(item.createdAt).toLocaleString('es-NI'),
      Persona: item.author?.name || '—',
      Tarea: item.task.title,
      'Estado de la tarea': TASK_STATUS_LABEL[item.task.status] || item.task.status,
      Tipo: REPORT_KIND_LABEL[item.kind] || item.kind,
      'Avance %': item.progressPercent ?? '',
      Reporte: item.body || '',
      Archivos: item.files.map((file) => file.fileName).join(', '),
      Revisión: item.isIncomplete ? `Incompleto${item.incompleteNote ? `: ${item.incompleteNote}` : ''}` : 'Sin observaciones',
    }));
    createReportWorkbook({
      fileName: buildDatedDownloadFileName(['reportes_de_avance'], 'xlsx'),
      sheets: [{ name: 'Reportes', rows }],
      filters: {
        Persona: authorId === 'ALL' ? 'Todas' : (users.find((u: any) => u.id === authorId)?.name || authorId),
        Desde: period.from || 'Sin límite',
        Hasta: period.to || 'Sin límite',
        Revisión: statusFilter === 'INCOMPLETE' ? 'Solo incompletos' : statusFilter === 'WITH_FILES' ? 'Con documentos' : 'Todos',
      },
    });
    toast.success('Excel exportado');
  };

  const periodLabel = preset === 'ALL' ? 'Cualquier fecha' : preset === 'TODAY' ? 'Hoy' : preset === '7D' ? 'Últimos 7 días' : preset === '30D' ? 'Últimos 30 días' : 'Rango personalizado';

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <ActivityViewHeader
        title="Reportes y documentos"
        tourPrefix="reportes-tutorial"
        helpLabel="Cómo usar Reportes y documentos"
        helpTitle="Reportes y documentos"
        helpDescription="Aquí está todo lo que el equipo reporta en las tareas: textos de avance, entregas y documentos adjuntos, en un solo lugar y con quién, cuándo y de qué tarea."
        dataTitle="Filtra por persona y fecha"
        dataDescription="Elige una persona y un periodo (hoy, últimos 7 o 30 días, o fechas propias) para ver qué reportó cada quien, sin buscar archivos uno por uno."
        actionsTitle="Revisa y marca"
        actionsDescription="Abre un reporte, descarga sus archivos y, si falta algo, márcalo como incompleto: quien lo hizo recibe un aviso para complementarlo."
        purpose="Todo lo que se reporta en las tareas, en un solo lugar: revisa tarea por tarea, filtra por persona y fecha, descarga los documentos y marca lo que quedó incompleto."
      />

      <div className="space-y-2" data-tour="reportes-tutorial-data" aria-busy={loading}>
        <KpiSummaryNotice loading={loading && !summary} error={reportsQuery.isError} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SalesKpiCard title="Reportes" value={summary ? summary.total : '—'} icon={ClipboardCheck} kind="filter" active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} sub={periodLabel} />
          <SalesKpiCard title="Con documentos" value={summary ? summary.withFiles : '—'} icon={FileText} kind="filter" active={statusFilter === 'WITH_FILES'} onClick={() => setStatusFilter((current) => (current === 'WITH_FILES' ? 'ALL' : 'WITH_FILES'))} />
          <SalesKpiCard title="Incompletos" value={summary ? summary.incomplete : '—'} icon={AlertTriangle} tone={summary && summary.incomplete > 0 ? 'bad' : 'default'} kind="filter" active={statusFilter === 'INCOMPLETE'} onClick={() => setStatusFilter((current) => (current === 'INCOMPLETE' ? 'ALL' : 'INCOMPLETE'))} sub="Por complementar" />
          <SalesKpiCard title="Personas" value={summary ? summary.authors : '—'} icon={UsersRound} kind="indicator" sub="Que reportaron" />
          <SalesKpiCard title="Tareas" value={summary ? summary.tasks : '—'} icon={ListTodo} kind="indicator" sub="Con reportes" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="erp-list-toolbar flex min-w-0 flex-wrap items-center gap-3" data-tour="reportes-tutorial-actions">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
            <Input
              data-testid="activities-reports-search"
              placeholder="Buscar en reportes, tareas o archivos…"
              className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-xs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button type="button" variant="outline" data-toolbar-role="filters" onClick={() => setShowFilters((value) => !value)} className="h-10 gap-2 rounded-xl px-3 text-xs font-bold">
            <Filter className="size-3.5 text-primary" /> Filtros
            {activeFilters > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[9px] font-black">{activeFilters}</Badge>}
          </Button>
          <div className="inline-flex rounded-xl border border-border/50 bg-background/50 p-0.5" data-toolbar-role="layout" role="group" aria-label="Agrupar reportes">
            <Button type="button" size="sm" variant={grouping === 'TASK' ? 'default' : 'ghost'} className="h-8 gap-1.5 rounded-lg px-3 text-xs" aria-pressed={grouping === 'TASK'} onClick={() => setGrouping('TASK')}><ListTree className="size-3.5" /> Por tarea</Button>
            <Button type="button" size="sm" variant={grouping === 'TIME' ? 'default' : 'ghost'} className="h-8 gap-1.5 rounded-lg px-3 text-xs" aria-pressed={grouping === 'TIME'} onClick={() => setGrouping('TIME')}><Rows3 className="size-3.5" /> Cronológico</Button>
          </div>
          <Button type="button" variant="ghost" size="icon" data-toolbar-role="alerts" title="Actualizar" aria-label="Actualizar" className="size-9 rounded-lg text-muted-foreground" onClick={refresh}><RefreshCw className={cn('size-4', reportsQuery.isFetching && 'animate-spin')} /></Button>
          {canExport && (
            <Button type="button" data-toolbar-role="primary" onClick={exportExcel} className="h-10 shrink-0 gap-2 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest">
              <Download className="size-4" /> Exportar Excel
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-border/50 bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-3">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Persona</label>
              <Select value={authorId} onValueChange={setAuthorId}>
                <SelectTrigger className="h-9 w-full text-xs" data-testid="activities-reports-person"><SelectValue placeholder="Todas las personas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las personas</SelectItem>
                  {users.map((person: any) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-3">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Periodo</label>
              <Select value={preset} onValueChange={(value) => setPreset(value as PeriodPreset)}>
                <SelectTrigger className="h-9 w-full text-xs" data-testid="activities-reports-period"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAY">Hoy</SelectItem>
                  <SelectItem value="7D">Últimos 7 días</SelectItem>
                  <SelectItem value="30D">Últimos 30 días</SelectItem>
                  <SelectItem value="ALL">Cualquier fecha</SelectItem>
                  <SelectItem value="CUSTOM">Rango personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {preset === 'CUSTOM' && (
              <>
                <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Desde</label>
                  <DateField value={customFrom} onChange={setCustomFrom} maxDate={customTo || undefined} placeholder="Fecha inicial" className="w-full" />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-3">
                  <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Hasta</label>
                  <DateField value={customTo} onChange={setCustomTo} minDate={customFrom || undefined} placeholder="Fecha final" className="w-full" />
                </div>
              </>
            )}
            {activeFilters > 0 && (
              <div className="flex items-end lg:col-span-3">
                <Button type="button" variant="ghost" size="sm" onClick={resetFilters} className="h-9 gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive"><RotateCcw className="size-3.5" /> Limpiar filtros</Button>
              </div>
            )}
          </div>
        )}
      </div>

      {reportsQuery.isError ? (
        <Card className="rounded-2xl border-destructive/30 p-6 text-sm text-destructive" role="alert">No se pudieron cargar los reportes. Intenta de nuevo con el botón Actualizar.</Card>
      ) : loading && feed.length === 0 ? (
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground" role="status">Cargando reportes…</Card>
      ) : feed.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-10 text-center">
          <p className="text-sm font-bold text-foreground">No hay reportes con estos filtros</p>
          <p className="mt-1 text-xs text-muted-foreground">Cuando alguien reporte avance, adjunte un documento o entregue una tarea, aparecerá aquí.</p>
        </Card>
      ) : grouping === 'TIME' ? (
        <div className="space-y-3">
          {feed.map((item) => <ReportEntry key={item.id} report={item} taskTitle={item.task.title} canReview={canReview} onReviewed={refresh} />)}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.task.id);
            return (
              <Card key={group.task.id} className="min-w-0 overflow-hidden rounded-2xl border-border/50">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.task.id)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full min-w-0 items-center gap-3 border-b border-border/40 bg-muted/20 px-4 py-3 text-left"
                >
                  {isCollapsed ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-bold text-foreground">{group.task.title}</span>
                    <span className="block break-words text-[11px] text-muted-foreground">
                      {group.task.assignees.length > 0 ? group.task.assignees.map((person) => person.name).filter(Boolean).join(', ') : 'Sin asignar'}
                    </span>
                  </span>
                  <Badge variant="outline" className="shrink-0 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">{TASK_STATUS_LABEL[group.task.status] || group.task.status}</Badge>
                  <Badge variant="secondary" className="shrink-0 px-2 py-0.5 text-[9px] font-black">{group.items.length} {group.items.length === 1 ? 'reporte' : 'reportes'}</Badge>
                  {group.incomplete > 0 && <Badge variant="outline" className="shrink-0 gap-1 border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300"><AlertTriangle className="size-3" /> {group.incomplete}</Badge>}
                </button>
                {!isCollapsed && (
                  <div className="space-y-3 p-4">
                    {group.items.map((item) => <ReportEntry key={item.id} report={item} canReview={canReview} onReviewed={refresh} />)}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {reportsQuery.data?.truncated && (
        <p className="text-xs text-muted-foreground" role="status">Se muestran los 500 reportes más recientes. Acota por persona o fecha para ver los demás.</p>
      )}
    </div>
  );
}
