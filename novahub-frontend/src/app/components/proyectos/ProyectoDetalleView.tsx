import { useState } from 'react';
import { ArrowLeft, FolderKanban, LayoutDashboard, ListTodo, Wallet, Receipt, Users, FileText, MessageSquare, BarChart3 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { projectsService, type ProjectDetail } from '../../services/projects.service';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../ui/utils';
import { PROJECT_STATUS_META, PRIORITY_META, money, formatDate } from './shared';
import { ProyectoPlanificacionPanel } from './ProyectoPlanificacionPanel';
import { ProyectoPresupuestoPanel, ProyectoCostosPanel, ProyectoReportePanel } from './ProyectoFinanzasPanels';
import { ProyectoRecursosPanel, ProyectoDocumentosPanel, ProyectoActividadesPanel } from './ProyectoColaboracionPanels';

interface ProyectoDetalleViewProps {
  projectId: string;
  onBack: () => void;
}

const TAB_DEFS = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard, module: 'PROJECTS' },
  { id: 'planificacion', label: 'Planificación', icon: ListTodo, module: 'PROJECTS_TASKS' },
  { id: 'presupuesto', label: 'Presupuesto', icon: Wallet, module: 'PROJECTS' },
  { id: 'costos', label: 'Costos', icon: Receipt, module: 'PROJECTS_EXPENSES' },
  { id: 'recursos', label: 'Recursos', icon: Users, module: 'PROJECTS' },
  { id: 'documentos', label: 'Documentos', icon: FileText, module: 'PROJECTS_DOCUMENTS' },
  { id: 'actividades', label: 'Actividades', icon: MessageSquare, module: 'PROJECTS' },
  { id: 'reporte', label: 'Reporte', icon: BarChart3, module: 'PROJECTS' },
];

export function ProyectoDetalleView({ projectId, onBack }: ProyectoDetalleViewProps) {
  const { user, canPerform } = useAuth();
  const [activeTab, setActiveTab] = useState('resumen');
  const detailQuery = useTenantQuery<ProjectDetail>(['projects', 'detail', projectId], (signal) => projectsService.get(projectId, signal), { enabled: true });
  const project = detailQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2"><ArrowLeft className="size-4" /> Portafolio</Button>
        {project ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10"><FolderKanban className="size-6 text-primary" /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-black tracking-tight">{project.name}</h2>
                <span className="font-mono text-xs font-bold text-primary">{project.code}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(project.startDate)} — {formatDate(project.endDate)} · {project.customer?.name || 'Sin cliente'}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn('border', PROJECT_STATUS_META[project.status].badge)}>{PROJECT_STATUS_META[project.status].label}</Badge>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-bold', PRIORITY_META[project.priority].badge)}>
                <span className={cn('size-2 rounded-full', PRIORITY_META[project.priority].dot)} />{PRIORITY_META[project.priority].label}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 gap-3">
            <Skeleton className="size-11 rounded-xl" />
            <div className="flex-1 space-y-2"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-4 w-1/4" /></div>
          </div>
        )}
      </div>

      {project ? (
        <div className="flex flex-wrap items-center gap-2">
          {project.manager && <Badge variant="outline" className="gap-1 border-border/60"><span className="text-muted-foreground">Responsable:</span> {project.manager.name}</Badge>}
          {project.branch && <Badge variant="outline" className="gap-1 border-border/60"><span className="text-muted-foreground">Sucursal:</span> {project.branch.name}</Badge>}
          <Badge variant="outline" className="gap-1 border-border/60"><span className="text-muted-foreground">Moneda:</span> {project.currency}</Badge>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-4 w-full overflow-x-auto custom-scrollbar">
          <TabsList className="flex h-auto w-max min-w-full gap-1.5 rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 to-muted/50 p-1.5 backdrop-blur-sm [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground">
            {TAB_DEFS.map((tab) => {
              const hasEnabled = user?.enabledModules?.includes(tab.module) || user?.enabledModules?.includes('PROJECTS');
              if (user?.enabledModules && !hasEnabled) return null;
              if (!canPerform(tab.module, 'view')) return null;
              return (
                <TabsTrigger key={tab.id} value={tab.id}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">
                  <tab.icon className="size-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {activeTab === 'resumen' && project ? <ProyectoResumenPanel project={project} /> : null}
        {activeTab === 'planificacion' && <ProyectoPlanificacionPanel projectId={projectId} />}
        {activeTab === 'presupuesto' && <ProyectoPresupuestoPanel projectId={projectId} />}
        {activeTab === 'costos' && <ProyectoCostosPanel projectId={projectId} />}
        {activeTab === 'recursos' && <ProyectoRecursosPanel projectId={projectId} />}
        {activeTab === 'documentos' && <ProyectoDocumentosPanel projectId={projectId} />}
        {activeTab === 'actividades' && <ProyectoActividadesPanel projectId={projectId} />}
        {activeTab === 'reporte' && <ProyectoReportePanel projectId={projectId} />}
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: 'default' | 'good' | 'bad' | 'warn' }) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardContent className="p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-xl font-black tracking-tight', tone === 'good' && 'text-emerald-600', tone === 'bad' && 'text-rose-600', tone === 'warn' && 'text-amber-600')}>{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function ProyectoResumenPanel({ project }: { project: ProjectDetail }) {
  const s = project.summary;
  const overdue = project.tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate) < new Date());
  const upcoming = project.tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate && new Date(t.dueDate) >= new Date() && new Date(t.dueDate) <= new Date(Date.now() + 7 * 86400000));
  const totalTasks = project.tasks.length;
  const completedTasks = project.tasks.filter((t) => t.status === 'COMPLETED').length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Presupuesto" value={money(s.plannedBudget, project.currency)} hint="Proyectado (base)" />
        <KpiCard label="Ejecutado" value={money(s.executedCost, project.currency)} hint="Costos ejecutados" />
        <KpiCard label="Saldo disponible" value={money(s.available, project.currency)} tone={s.available < 0 ? 'bad' : 'default'} hint="Presupuesto − ejecutado" />
        <KpiCard label="Variación" value={`${s.varianceAbs >= 0 ? '+' : ''}${money(s.varianceAbs, project.currency)}`} tone={s.overBudget ? 'bad' : 'good'} hint={`${s.variancePct >= 0 ? '+' : ''}${s.variancePct.toFixed(1)}%`} />
        <KpiCard label="Margen esperado" value={money(s.expectedMargin, project.currency)} tone={s.expectedMargin < 0 ? 'bad' : 'good'} hint="Ingresos − presupuesto" />
        <KpiCard label="Margen real" value={money(s.realMargin, project.currency)} tone={s.realMargin < 0 ? 'bad' : 'good'} hint={`Δ ${money(s.marginDelta, project.currency)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-border/60 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Resumen del proyecto</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold">Avance</span>
                <span className="font-black text-primary">{Number(project.progress) || 0}%</span>
              </div>
              <Progress value={Number(project.progress) || 0} className="mt-1.5 h-2" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tareas</p>
                <p className="mt-1 text-lg font-black">{completedTasks}/{totalTasks} <span className="text-xs font-normal text-muted-foreground">completadas</span></p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hitos</p>
                <p className="mt-1 text-lg font-black">{project.milestones.filter((m) => m.status === 'COMPLETED').length}/{project.milestones.length} <span className="text-xs font-normal text-muted-foreground">completados</span></p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Miembros</p>
                <p className="mt-1 text-lg font-black">{project.members.length}</p>
              </div>
            </div>
            {project.description && <p className="text-sm leading-6 text-muted-foreground">{project.description}</p>}
            {project.notes && <p className="rounded-xl bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">{project.notes}</p>}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Alertas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {s.overBudget ? <AlertRow tone="rose" text={`El proyecto superó el presupuesto por ${money(Math.abs(s.varianceAbs), project.currency)}.`} /> : null}
            {overdue.length > 0 ? <AlertRow tone="rose" text={`${overdue.length} tarea(s) vencida(s).`} /> : null}
            {upcoming.length > 0 ? <AlertRow tone="amber" text={`${upcoming.length} tarea(s) vencen esta semana.`} /> : null}
            {project.tasks.some((t) => t.status === 'PENDING' && t.priority === 'URGENT') ? <AlertRow tone="amber" text="Hay tareas urgentes sin iniciar." /> : null}
            {!s.overBudget && overdue.length === 0 && upcoming.length === 0 && <p className="text-sm text-muted-foreground">Sin alertas pendientes.</p>}
          </CardContent>
        </Card>
      </div>

      {overdue.length > 0 && (
        <Card className="rounded-2xl border-rose-200 bg-rose-50/40 shadow-sm dark:border-rose-800/40 dark:bg-rose-950/20">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">Fechas críticas vencidas</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-rose-100 dark:divide-rose-900/30">
              {overdue.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="font-bold">{t.title}</span>
                  <span className="text-xs font-bold text-rose-600">Vence {formatDate(t.dueDate)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AlertRow({ tone, text }: { tone: 'rose' | 'amber' | 'emerald'; text: string }) {
  return (
    <div className={cn('flex items-start gap-2 rounded-xl border p-3 text-sm',
      tone === 'rose' && 'border-rose-200 bg-rose-50/60 text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-300',
      tone === 'amber' && 'border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300',
      tone === 'emerald' && 'border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300')}>
      <span className="mt-0.5 size-2 shrink-0 rounded-full bg-current" />
      <span>{text}</span>
    </div>
  );
}