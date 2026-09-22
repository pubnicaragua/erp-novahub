import { useState } from 'react';
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
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { usersService } from '../../services/users.service';
import { customersService } from '../../services/ventas.service';
import { projectsService, type ProjectListItem } from '../../services/projects.service';
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
}

export function ProyectosListView({ loading, onSelect, onChanged, canCreate, canEdit, canDelete }: ProyectosListViewProps) {
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
      const exportRows = (asList(response) as ProjectListItem[]).map((project) => ({
        Código: project.code,
        Proyecto: project.name,
        Estado: project.status,
        Prioridad: project.priority,
        Responsable: project.manager?.name || '—',
        Inicio: project.startDate ? new Date(project.startDate).toLocaleDateString('es-NI') : '—',
        Fin: project.endDate ? new Date(project.endDate).toLocaleDateString('es-NI') : '—',
        Avance: `${Number(project.progress || 0).toFixed(2)}%`,
        Presupuesto: project.plannedBudget,
        Ejecutado: project.executedCost,
      }));
      const headers = Object.keys(exportRows[0] || { Mensaje: 'Sin registros para el alcance seleccionado' });
      const sections = [{ id: 'projects-list', title: 'Listado de proyectos', headers, rows: exportRows.length ? exportRows.map((row) => headers.map((header) => row[header] as string | number)) : [['Sin registros para el alcance seleccionado']] }];
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
      queryClient.invalidateQueries({ queryKey: ['tenant-module'] });
      onChanged();
    },
    onError: (err: any) => toast.error(err?.message || 'No se pudo guardar el proyecto'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsService.remove(id),
    onSuccess: () => { toast.success('Proyecto eliminado'); queryClient.invalidateQueries({ queryKey: ['tenant-module'] }); onChanged(); },
    onError: (err: any) => toast.error(err?.message || 'No se pudo eliminar el proyecto'),
  });

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
                  <TableHead>Avance</TableHead>
                  <TableHead className="text-right">Presupuesto</TableHead>
                  <TableHead className="text-right">Ejecutado</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-12 text-center text-muted-foreground">Cargando proyectos...</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-12 text-center text-muted-foreground">No hay proyectos. Crea el primero.</TableCell></TableRow>
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
                    <TableCell className="min-w-[130px]">
                      <div className="flex items-center gap-2">
                        <Progress value={Number(row.progress) || 0} className="h-1.5 w-20" />
                        <span className="text-xs font-bold">{Number(row.progress) || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs">{money(row.basePlannedBudget, row.currency)}</TableCell>
                    <TableCell className={cn('text-right text-xs', row.summary?.overBudget ? 'font-bold text-rose-600' : '')}>{money(row.baseExecutedCost, row.currency)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="size-8" title="Abrir" onClick={() => onSelect(row.id)}><ExternalLink className="size-4" /></Button>
                        {canEdit && <Button size="icon" variant="ghost" className="size-8" title="Editar" onClick={() => openEdit(row)}><Pencil className="size-4" /></Button>}
                        {canDelete && (
                          <Button size="icon" variant="ghost" className="size-8 text-rose-500" title="Eliminar"
                            onClick={() => { if (window.confirm(`¿Eliminar el proyecto ${row.name}? Esta acción no se puede deshacer.`)) deleteMutation.mutate(row.id); }}>
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
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        users={users}
        customers={asList(customersQuery.data)}
        branches={userBranches || []}
        saving={saveMutation.isPending}
        onSubmit={(payload) => saveMutation.mutate(payload)}
      />
    </div>
  );
}

function ProjectFormDialog({ open, onOpenChange, editing, users, customers, branches, saving, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ProjectListItem | null;
  users: any[];
  customers: any[];
  branches: any[];
  saving: boolean;
  onSubmit: (payload: any) => void;
}) {
  const [form, setForm] = useState<any>({
    name: editing?.name || '',
    description: editing?.description || '',
    customerId: editing?.customer?.id || editing?.customerId || '',
    branchId: editing?.branch?.id || editing?.branchId || '',
    managerId: editing?.manager?.id || editing?.managerId || '',
    status: editing?.status || 'DRAFT',
    priority: editing?.priority || 'MEDIUM',
    startDate: toLocalDate(editing?.startDate) || '',
    endDate: toLocalDate(editing?.endDate) || '',
    plannedBudget: editing?.plannedBudget != null ? String(editing.plannedBudget) : '',
    plannedIncome: editing?.plannedIncome != null ? String(editing.plannedIncome) : '',
    currency: editing?.currency || 'NIO',
    exchangeRate: editing?.exchangeRate && editing.exchangeRate !== 1 ? String(editing.exchangeRate) : '',
    notes: editing?.notes || '',
    memberUserIds: [],
  });

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
      plannedBudget: form.plannedBudget === '' ? 0 : Number(form.plannedBudget),
      plannedIncome: form.plannedIncome === '' ? 0 : Number(form.plannedIncome),
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
          <div>
            <Label>Presupuesto proyectado</Label>
              <Input data-testid="projects-form-planned-budget" type="number" min={0} value={form.plannedBudget} onChange={(e) => setForm((f: any) => ({ ...f, plannedBudget: e.target.value }))} placeholder="0.00" />
          </div>
          <div>
            <Label>Ingresos proyectados</Label>
            <Input type="number" min={0} value={form.plannedIncome} onChange={(e) => setForm((f: any) => ({ ...f, plannedIncome: e.target.value }))} placeholder="0.00" />
          </div>
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button data-testid="projects-form-submit" onClick={submit} disabled={!valid || saving} className="gap-2">
            {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear proyecto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
