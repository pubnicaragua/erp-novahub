import { useState, useEffect } from 'react';
import { Plus, Search, FolderKanban, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useTenantQuery, asList, invalidateTenantQueries } from '../../hooks/useTenantQuery';
import { usersService } from '../../services/users.service';
import { customersService } from '../../services/ventas.service';
import { projectsService, type ProjectListItem, type ProjectDetail, type ProjectDeleteImpact } from '../../services/projects.service';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/app/services/toast';
import { cn } from '../ui/utils';
import { DateField } from '../ui/DateField';
import { ExportMenu } from '../ui/ExportMenu';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateConfiguredReportSectionsPDF } from '../../utils/pdfGenerator';
import { createReportWorkbook } from '../../utils/reportWorkbook';
import { buildDatedDownloadFileName } from '../../utils/exportFileNames';
import {
  PROJECT_STATUS_META, PRIORITY_META, PROJECT_STATUS_OPTIONS, PRIORITY_OPTIONS,
  money, formatDate, fromLocalDate, toLocalDate,
} from './shared';

const EMPTY_SELECT_VALUE = '__none__';

interface ProyectosListViewProps {
  loading: boolean;
  onSelect: (id: string) => void;
  onChanged: () => void;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canViewCosts: boolean;
  canViewTimeline: boolean;
}

export function ProyectosListView({ loading, onSelect, onChanged, canCreate, canEdit, canDelete, canViewCosts, canViewTimeline }: ProyectosListViewProps) {
  const { userBranches, user, canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('ALL');
  const [priority, setPriority] = useState<string>('ALL');
  const [branchId, setBranchId] = useState<string>('ALL');
  const [managerId, setManagerId] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectListItem | null>(null);

  const usersQuery = useTenantQuery<any[]>(['projects', 'users'], (signal) => usersService.getLookup(undefined, signal), { enabled: true });
  const customersQuery = useTenantQuery<any[]>(['projects', 'customers'], (signal) => customersService.getLookup({ page: 1, pageSize: 200 }, signal).then((res: any) => asList(res)), { enabled: dialogOpen });

  const listQuery = useTenantQuery<any>(
    ['projects', 'list', search, status, priority, branchId, managerId, page],
    (signal) => projectsService.list({
      search: search || undefined,
      status: (status === 'ALL' ? undefined : status) as any,
      priority: (priority === 'ALL' ? undefined : priority) as any,
      branchId: branchId === 'ALL' ? undefined : branchId,
      managerId: managerId === 'ALL' ? undefined : managerId,
      page,
      pageSize,
      sort: 'createdAt',
      order: 'desc',
    }, signal),
    { enabled: true },
  );

  const rows = asList(listQuery.data) as ProjectListItem[];
  const total = Number(listQuery.data?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const users = asList(usersQuery.data);
  const canExport = canPerform('PROJECTS_LIST', 'export');

  const exportProjects = async (format: 'pdf' | 'xlsx') => {
    if (!canExport) return;
    const toastId = toast.loading(`Preparando ${format === 'pdf' ? 'PDF' : 'Excel'} de proyectos…`);
    try {
      const response = await projectsService.list({
        search: search || undefined,
        status: (status === 'ALL' ? undefined : status) as any,
        priority: (priority === 'ALL' ? undefined : priority) as any,
        branchId: branchId === 'ALL' ? undefined : branchId,
        managerId: managerId === 'ALL' ? undefined : managerId,
        page: 1,
        pageSize: 5000,
        sort: 'createdAt',
        order: 'desc',
        report: true,
        export: true,
      });
      const exportRows: Array<Record<string, string | number>> = (asList(response) as ProjectListItem[]).map((project) => ({
        Código: project.code,
        Proyecto: project.name,
        Estado: project.status,
        Prioridad: project.priority,
        Responsable: project.manager?.name || '—',
        Inicio: project.startDate ? new Date(project.startDate).toLocaleDateString('es-NI') : '—',
        Fin: project.endDate ? new Date(project.endDate).toLocaleDateString('es-NI') : '—',
        ...(canViewTimeline ? { Avance: `${Number(project.progress || 0).toFixed(2)}%` } : {}),
        ...(canViewCosts ? { Presupuesto: project.plannedBudget, Ejecutado: project.executedCost } : {}),
      })) as Array<Record<string, string | number | undefined>>;
      const headers = Object.keys(exportRows[0] || { Mensaje: 'Sin registros para el alcance seleccionado' });
      const sections = [{ id: 'projects-list', title: 'Listado de proyectos', headers, rows: exportRows.length ? exportRows.map((row) => headers.map((header) => row[header] ?? '')) : [['Sin registros para el alcance seleccionado']] }];
      const filters = { Búsqueda: search || '—', Estado: status === 'ALL' ? 'Todos' : status, Prioridad: priority === 'ALL' ? 'Todas' : priority, Sucursal: branchId === 'ALL' ? 'Todas' : branchId, Responsable: managerId === 'ALL' ? 'Todos' : managerId };
      if (format === 'xlsx') {
        createReportWorkbook({ fileName: buildDatedDownloadFileName(['reporte_proyectos'], 'xlsx'), sheets: [{ name: 'Proyectos', rows: exportRows }], filters });
      } else {
        await generateConfiguredReportSectionsPDF({ targetKey: 'proyectos.list', title: 'Listado de proyectos', tenantName: user?.tenantName || 'Mi Empresa', tenantLogo: user?.sessionBranding?.logo || null, sections, fileName: buildDatedDownloadFileName(['reporte_proyectos'], 'pdf') });
      }
      toast.success(`${format === 'pdf' ? 'PDF' : 'Excel'} de proyectos exportado`, { id: toastId });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo exportar proyectos', { id: toastId });
    }
  };

  const saveMutation = useMutation({
    mutationFn: (payload: any) => editing
      ? projectsService.update(editing.id, payload)
      : projectsService.create(payload),
    onSuccess: () => {
      toast.success(editing ? 'Proyecto actualizado' : 'Proyecto creado');
      setDialogOpen(false);
      setEditing(null);
      invalidateTenantQueries(queryClient);
      onChanged();
    },
    onError: (err: any) => toast.error(err?.message || 'No se pudo guardar el proyecto'),
  });

  const [deleting, setDeleting] = useState<ProjectListItem | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<ProjectDeleteImpact | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (args: { id: string; cascadeFiles: boolean }) =>
      projectsService.remove(args.id, args.cascadeFiles),
    onSuccess: (_data, args) => {
      setDeleting(null);
      setDeleteImpact(null);
      toast.success(
        args.cascadeFiles
          ? 'Proyecto y archivos dependientes eliminados'
          : 'Proyecto eliminado',
      );
      invalidateTenantQueries(queryClient);
      onChanged();
    },
    onError: (err: any) => {
      setDeleting(null);
      setDeleteImpact(null);
      toast.error(err?.message || 'No se pudo eliminar el proyecto');
    },
  });

  // Antes de borrar se pide el desglose: el backend responde cuántos archivos
  // se perderían para que la persona decida con los números a la vista.
  const openDelete = (row: ProjectListItem) => {
    setDeleting(row);
    setDeleteImpact(null);
    projectsService
      .getDeleteImpact(row.id)
      .then(setDeleteImpact)
      .catch(() => setDeleteImpact(null));
  };

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (row: ProjectListItem) => { setEditing(row); setDialogOpen(true); };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-4 relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nombre, código o descripción..." className="pl-9" />
            </div>
            <div className="md:col-span-2">
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  {PROJECT_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Prioridad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las prioridades</SelectItem>
                  {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={branchId} onValueChange={(v) => { setBranchId(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Sucursal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las sucursales</SelectItem>
                  {(userBranches || []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={managerId} onValueChange={(v) => { setManagerId(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Responsable" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {canCreate && (
              <div className="md:col-span-12 lg:col-span-12 xl:col-span-0 flex justify-end">
              {canExport && <ExportMenu onPdf={() => void exportProjects('pdf')} onExcel={() => void exportProjects('xlsx')} className="mr-2" pdfDescription="Reporte configurado de proyectos" excelDescription="Todos los proyectos filtrados" />}
              <Button data-testid="projects-new-project" onClick={openCreate} className="gap-2"><Plus className="size-4" /> Nuevo proyecto</Button>
              </div>
            )}
            {!canCreate && canExport && <div className="md:col-span-12 flex justify-end"><ExportMenu onPdf={() => void exportProjects('pdf')} onExcel={() => void exportProjects('xlsx')} pdfDescription="Reporte configurado de proyectos" excelDescription="Todos los proyectos filtrados" /></div>}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Inicio · Fin</TableHead>
                  {canViewTimeline && <TableHead>Avance</TableHead>}
                  {canViewCosts && <TableHead className="text-right">Presupuesto</TableHead>}
                  {canViewCosts && <TableHead className="text-right">Ejecutado</TableHead>}
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6 + Number(canViewTimeline) + Number(canViewCosts) * 2 + 1} className="py-12 text-center text-muted-foreground">Cargando proyectos...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6 + Number(canViewTimeline) + Number(canViewCosts) * 2 + 1} className="py-12 text-center text-muted-foreground">No hay proyectos. Crea el primero.</TableCell></TableRow>
                ) : rows.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => onSelect(row.id)}>
                    <TableCell className="font-mono text-xs font-bold text-primary">{row.code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FolderKanban className="size-4 text-muted-foreground" />
                        <span className="font-bold">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('border', PROJECT_STATUS_META[row.status].badge)}>{PROJECT_STATUS_META[row.status].label}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-bold', PRIORITY_META[row.priority].badge)}>
                        <span className={cn('size-2 rounded-full', PRIORITY_META[row.priority].dot)} />{PRIORITY_META[row.priority].label}
                      </span>
                    </TableCell>
                    <TableCell>{row.manager?.name || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(row.startDate)} · {formatDate(row.endDate)}</TableCell>
                    {canViewTimeline && <TableCell className="min-w-[130px]">
                      <div className="flex items-center gap-2">
                        <Progress value={Number(row.progress) || 0} className="h-1.5 w-20" />
                        <span className="text-xs font-bold">{Number(row.progress) || 0}%</span>
                      </div>
                    </TableCell>}
                    {canViewCosts && <TableCell className="text-right text-xs">{money(row.basePlannedBudget, row.currency)}</TableCell>}
                    {canViewCosts && <TableCell className={cn('text-right text-xs', row.summary?.overBudget ? 'font-bold text-rose-600' : '')}>{money(row.baseExecutedCost, row.currency)}</TableCell>}
                    <TableCell>
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="size-8" title="Abrir" onClick={() => onSelect(row.id)}><ExternalLink className="size-4" /></Button>
                        {canEdit && <Button size="icon" variant="ghost" className="size-8" title="Editar" onClick={() => openEdit(row)}><Pencil className="size-4" /></Button>}
                        {canDelete && (
                          <Button size="icon" variant="ghost" className="size-8 text-rose-500" title="Eliminar"
                            onClick={() => openDelete(row)}>
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{total} proyectos</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

      <ProjectFormDialog
        key={editing?.id || 'new'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        canViewCosts={canViewCosts}
        users={users}
        customers={asList(customersQuery.data)}
        branches={userBranches || []}
        saving={saveMutation.isPending}
        onSubmit={(payload) => saveMutation.mutate(payload)}
      />

      <ProjectDeleteDialog
        project={deleting}
        impact={deleteImpact}
        saving={deleteMutation.isPending}
        onCancel={() => { setDeleting(null); setDeleteImpact(null); }}
        onConfirm={(cascadeFiles) => {
          if (deleting) deleteMutation.mutate({ id: deleting.id, cascadeFiles });
        }}
      />
    </div>
  );
}

function ProjectDeleteDialog({ project, impact, saving, onCancel, onConfirm }: {
  project: ProjectListItem | null;
  impact: ProjectDeleteImpact | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (cascadeFiles: boolean) => void;
}) {
  // Cualquier dependencia (imágenes almacenadas, enlaces externos o documentos)
  // obliga al borrado masivo: el backend rechaza el borrado simple para que nadie
  // destruya archivos sin haber leído antes el aviso con las cifras.
  const hasDependencies = Boolean(impact?.hasDependencies);
  const dependencyCount = impact ? impact.storedImages + impact.storedDocuments : 0;
  const blockedByCosts = Boolean(impact?.hasExecutedCosts);
  const loading = Boolean(project) && !impact;

  return (
    <Dialog open={Boolean(project)} onOpenChange={(open) => { if (!open && !saving) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Eliminar proyecto</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <p className="font-semibold">
            ¿Eliminar <span className="text-primary">{project?.name}</span>? Esta acción no se puede deshacer.
          </p>

          {loading ? (
            <p className="text-muted-foreground">Revisando archivos dependientes…</p>
          ) : null}

          {impact && impact.executedCosts > 0 ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <p className="font-semibold text-destructive">
                No se puede eliminar: tiene {impact.executedCosts} costo{impact.executedCosts === 1 ? '' : 's'} ejecutado{impact.executedCosts === 1 ? '' : 's'}.
              </p>
              <p className="mt-1 text-muted-foreground">Cancelá el proyecto en su lugar para conservar el historial.</p>
            </div>
          ) : null}

          {impact && !blockedByCosts ? (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5">
              <p className="font-semibold">Al eliminar el proyecto:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Se borran hitos, tareas, presupuesto, costos y miembros.</li>
                {impact.storedImages > 0 ? (
                  <li className="font-semibold text-destructive">
                    • Se eliminan {impact.storedImages} imagen{impact.storedImages === 1 ? '' : 'es'} de avance
                    {impact.storedImages === 1 ? '' : 's'} y el archivo en el almacenamiento. No se pueden recuperar.
                  </li>
                ) : null}
                {impact.attachedDocuments > 0 ? (
                  <li className="font-semibold text-destructive">
                    • Se eliminan {impact.attachedDocuments} documento{impact.attachedDocuments === 1 ? '' : 's'} adjunto{impact.attachedDocuments === 1 ? '' : 's'}{' '}
                    {impact.storedDocuments > 0
                      ? `y ${impact.storedDocuments} archivo${impact.storedDocuments === 1 ? '' : 's'} en el almacenamiento.`
                      : 'y sus enlaces quedan sin referencia.'}{' '}
                    No se pueden recuperar.
                  </li>
                ) : null}
                {impact.externalLinks > 0 ? (
                  <li>• Se quitan {impact.externalLinks} enlace{impact.externalLinks === 1 ? '' : 's'} externo{impact.externalLinks === 1 ? '' : 's'} de la lista de evidencias.</li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving} className="h-8 text-xs">
            Cancelar
          </Button>
          {hasDependencies ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => onConfirm(true)}
              disabled={saving || loading || blockedByCosts}
              className="h-8 text-xs font-bold"
            >
              {saving ? 'Eliminando...' : `Eliminar todo (${dependencyCount} archivo${dependencyCount === 1 ? '' : 's'})`}
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={() => onConfirm(false)}
              disabled={saving || loading || blockedByCosts}
              className="h-8 text-xs font-bold"
            >
              {saving ? 'Eliminando...' : 'Eliminar proyecto'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectFormDialog({ open, onOpenChange, editing, users, customers, branches, saving, onSubmit, canViewCosts }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ProjectListItem | null;
  users: any[];
  customers: any[];
  branches: any[];
  saving: boolean;
  canViewCosts: boolean;
  onSubmit: (payload: any) => void;
}) {
  const detailQuery = useTenantQuery<ProjectDetail | null>(
    ['projects', 'form-detail', editing?.id || 'none'],
    (signal) => (editing?.id ? projectsService.get(editing.id, signal) : Promise.resolve(null)),
    { enabled: Boolean(open && editing?.id) },
  );

  const buildInitialState = (item: ProjectListItem | null) => ({
    name: item?.name || '',
    description: item?.description || '',
    customerId: item?.customer?.id || item?.customerId || '',
    branchId: item?.branch?.id || item?.branchId || '',
    managerId: item?.manager?.id || item?.managerId || '',
    status: item?.status || 'DRAFT',
    priority: item?.priority || 'MEDIUM',
    startDate: toLocalDate(item?.startDate) || '',
    endDate: toLocalDate(item?.endDate) || '',
    plannedBudget: canViewCosts && item?.plannedBudget != null ? String(item.plannedBudget) : '',
    plannedIncome: canViewCosts && item?.plannedIncome != null ? String(item.plannedIncome) : '',
    currency: item?.currency || 'NIO',
    exchangeRate: item?.exchangeRate && item.exchangeRate !== 1 ? String(item.exchangeRate) : '',
    notes: item?.notes || '',
    memberUserIds: [] as string[],
  });

  const [form, setForm] = useState<any>(() => buildInitialState(editing));
  const [hasSyncedDetail, setHasSyncedDetail] = useState(false);

  useEffect(() => {
    const detail = detailQuery.data;
    if (!detail || hasSyncedDetail) return;

    setHasSyncedDetail(true);
    setForm((prev: any) => ({
      ...prev,
      description: detail.description || prev.description,
      notes: detail.notes || prev.notes,
      memberUserIds: Array.isArray(detail.members)
        ? detail.members.map((member) => member.user?.id || member.userId).filter(Boolean)
        : prev.memberUserIds,
    }));
  }, [detailQuery.data, hasSyncedDetail]);

  const valid = form.name?.trim() && form.startDate;

  const submit = () => {
    if (!valid || saving) return;
    const payload: any = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      customerId: form.customerId || undefined,
      branchId: form.branchId || undefined,
      managerId: form.managerId || undefined,
      status: form.status,
      priority: form.priority,
      startDate: fromLocalDate(form.startDate),
      endDate: fromLocalDate(form.endDate),
      ...(canViewCosts ? {
        plannedBudget: form.plannedBudget === '' ? 0 : Number(form.plannedBudget),
        plannedIncome: form.plannedIncome === '' ? 0 : Number(form.plannedIncome),
      } : {}),
      currency: form.currency,
      exchangeRate: form.exchangeRate === '' ? undefined : Number(form.exchangeRate),
      notes: form.notes?.trim() || undefined,
      memberUserIds: Array.isArray(form.memberUserIds) ? form.memberUserIds : [],
    };
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar proyecto ${editing.code}` : 'Nuevo proyecto'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Nombre del proyecto *</Label>
            <Input data-testid="projects-form-name" value={form.name || ''} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Ej. Remodelación de sucursal Managua" />
          </div>
          <div className="sm:col-span-2">
            <Label>Descripción</Label>
            <Textarea data-testid="projects-form-description" rows={2} value={form.description || ''} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Alcance, entregables, contexto..." />
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prioridad</Label>
            <Select value={form.priority} onValueChange={(v) => setForm((f: any) => ({ ...f, priority: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsable</Label>
            <Select value={form.managerId || EMPTY_SELECT_VALUE} onValueChange={(v) => setForm((f: any) => ({ ...f, managerId: v === EMPTY_SELECT_VALUE ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>Sin asignar</SelectItem>
                {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sucursal</Label>
            <Select value={form.branchId || EMPTY_SELECT_VALUE} onValueChange={(v) => setForm((f: any) => ({ ...f, branchId: v === EMPTY_SELECT_VALUE ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>Sin sucursal</SelectItem>
                {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cliente relacionado</Label>
            <Select value={form.customerId || EMPTY_SELECT_VALUE} onValueChange={(v) => setForm((f: any) => ({ ...f, customerId: v === EMPTY_SELECT_VALUE ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>Sin cliente</SelectItem>
                {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div>
              <Label>Fecha de inicio *</Label>
              <DateField id="projects-form-start-date" value={form.startDate || ''} onChange={(v) => setForm((f: any) => ({ ...f, startDate: v }))} />
            </div>
            <div>
              <Label>Fecha de fin</Label>
              <DateField value={form.endDate || ''} onChange={(v) => setForm((f: any) => ({ ...f, endDate: v }))} />
            </div>
          </div>
          {canViewCosts && <div>
            <Label>Presupuesto proyectado</Label>
            <Input data-testid="projects-form-planned-budget" type="number" min={0} value={form.plannedBudget} onChange={(e) => setForm((f: any) => ({ ...f, plannedBudget: e.target.value }))} placeholder="0.00" />
          </div>}
          {canViewCosts && <div>
            <Label>Ingresos proyectados</Label>
            <Input type="number" min={0} value={form.plannedIncome} onChange={(e) => setForm((f: any) => ({ ...f, plannedIncome: e.target.value }))} placeholder="0.00" />
          </div>}
          <div>
            <Label>Moneda</Label>
            <Select value={form.currency} onValueChange={(v) => setForm((f: any) => ({ ...f, currency: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="NIO">NIO (Córdobas)</SelectItem><SelectItem value="USD">USD (Dólares)</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tasa de cambio (si no es NIO)</Label>
            <Input type="number" min={0} step="0.01" value={form.exchangeRate} onChange={(e) => setForm((f: any) => ({ ...f, exchangeRate: e.target.value }))} placeholder="36.50" />
          </div>
          <div className="sm:col-span-2">
            <Label>Miembros del equipo</Label>
            <Select value="" onValueChange={(v) => { if (v && !(form.memberUserIds || []).includes(v)) setForm((f: any) => ({ ...f, memberUserIds: [...(f.memberUserIds || []), v] })); }}>
              <SelectTrigger><SelectValue placeholder="Agregar miembro..." /></SelectTrigger>
              <SelectContent>
                {users.filter((u: any) => !(form.memberUserIds || []).includes(u.id)).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {(form.memberUserIds || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(form.memberUserIds || []).map((uid: string) => {
                  const u = users.find((x: any) => x.id === uid);
                  return (
                    <Badge key={uid} variant="outline" className="gap-1 pr-1">
                      {u?.name || uid}
                      <button onClick={() => setForm((f: any) => ({ ...f, memberUserIds: (f.memberUserIds || []).filter((id: string) => id !== uid) }))} className="ml-1 rounded px-1 hover:bg-muted">×</button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <Label>Notas</Label>
            <Textarea rows={2} value={form.notes || ''} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="Observaciones generales..." />
          </div>
        </div>
        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground text-left">
            {!form.name?.trim() ? 'Ingresa el nombre del proyecto.' : !form.startDate ? 'Selecciona la fecha de inicio para continuar.' : ''}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button data-testid="projects-form-submit" onClick={submit} disabled={!valid || saving} className="gap-2">
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear proyecto'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
