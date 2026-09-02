import { useMemo, useState } from 'react';
import { BriefcaseBusiness, Building2, Check, Edit2, Plus, Search, Trash2, UsersRound } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Popover, PopoverAnchor, PopoverContent } from '../ui/popover';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { hrService } from '../../services/hr.service';
import { HRViewTutorial } from './HRViewTutorial';

interface DepartmentForm {
  name: string;
  description: string;
  isSellerDepartment: boolean;
  employeeIds: string[];
}

const emptyForm: DepartmentForm = {
  name: '',
  description: '',
  isSellerDepartment: false,
  employeeIds: [],
};

const employeeName = (employee: any) => `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || employee?.employeeNumber || 'Empleado';
const employeePositionName = (employee: any) => employee?.position?.title || employee?.jobTitle || 'Sin puesto';
const employeeDepartmentName = (employee: any) => employee?.position?.department?.name
  || employee?.department?.name
  || employee?.departmentMemberships?.find((membership: any) => membership?.isPrimary)?.department?.name
  || employee?.departmentMemberships?.[0]?.department?.name
  || 'Sin departamento';

const employeeDepartmentIds = (employee: any, validDepartmentIds?: Set<string>) => {
  const memberships = (employee?.departmentMemberships || [])
    .map((membership: any) => membership.department?.id || membership.departmentId)
    .filter(Boolean);
  const ids = [...new Set([...(employee?.departmentId ? [employee.departmentId] : []), ...memberships])];
  return validDepartmentIds ? ids.filter((id) => validDepartmentIds.has(id)) : ids;
};

const sameIds = (left: string[], right: string[]) => left.length === right.length && left.every((id) => right.includes(id));

export function DepartamentosView({ departments = [], employees = [], positions = [], onRefresh }: any) {
  const { canPerform } = useAuth();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [initialEmployeeIds, setInitialEmployeeIds] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = canPerform('HR_EMPLOYEES', 'create');
  const canEdit = canPerform('HR_EMPLOYEES', 'edit');
  const canDelete = canPerform('HR_EMPLOYEES', 'delete');
  const validDepartmentIds = useMemo(
    () => new Set<string>(departments.filter((department: any) => department?.status !== 'INACTIVE').map((department: any) => department.id)),
    [departments],
  );
  const activeEmployees = useMemo(
    () => employees.filter((employee: any) => employee?.employmentStatus === 'ACTIVE' || !employee?.employmentStatus),
    [employees],
  );
  const filteredEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    if (!term) return activeEmployees;
    return activeEmployees.filter((employee: any) => `${employeeName(employee)} ${employee.employeeNumber || ''} ${employeePositionName(employee)} ${employeeDepartmentName(employee)}`.toLowerCase().includes(term));
  }, [activeEmployees, employeeSearch]);
  const assignedEmployees = useMemo(
    () => activeEmployees.filter((employee: any) => form.employeeIds.includes(employee.id)),
    [activeEmployees, form.employeeIds],
  );
  const availableEmployees = useMemo(
    () => filteredEmployees.filter((employee: any) => !form.employeeIds.includes(employee.id)),
    [filteredEmployees, form.employeeIds],
  );

  const openCreate = () => {
    setEditingId(null);
    setInitialEmployeeIds([]);
    setForm(emptyForm);
    setEmployeeSearch('');
    setEmployeePickerOpen(false);
    setEditorOpen(true);
  };

  const openEdit = (department: any) => {
    const linkedEmployeeIds = activeEmployees
      .filter((employee: any) => employeeDepartmentIds(employee, validDepartmentIds).includes(department.id))
      .map((employee: any) => employee.id);
    setEditingId(department.id);
    setInitialEmployeeIds(linkedEmployeeIds);
    setForm({
      name: department.name || '',
      description: department.description || '',
      isSellerDepartment: department.isSellerDepartment === true,
      employeeIds: linkedEmployeeIds,
    });
    setEmployeeSearch('');
    setEmployeePickerOpen(false);
    setEditorOpen(true);
  };

  const toggleEmployee = (employee: any) => {
    const isAssigned = form.employeeIds.includes(employee.id);
    if (isAssigned && employeeDepartmentIds(employee, validDepartmentIds).length <= 1) {
      toast.error('Un empleado debe pertenecer al menos a un departamento');
      return;
    }
    setForm((current) => ({
      ...current,
      employeeIds: isAssigned
        ? current.employeeIds.filter((id) => id !== employee.id)
        : [...current.employeeIds, employee.id],
    }));
  };

  const syncDepartmentEmployees = async (departmentId: string) => {
    const impactedIds = [...new Set([...initialEmployeeIds, ...form.employeeIds])];
    for (const employeeId of impactedIds) {
      const employee = activeEmployees.find((item: any) => item.id === employeeId);
      if (!employee) continue;
      // Se descartan vínculos históricos a departamentos inactivos. El endpoint
      // de empleados solo acepta departamentos HR activos.
      const currentIds = employeeDepartmentIds(employee, validDepartmentIds);
      const shouldBeLinked = form.employeeIds.includes(employeeId);
      const nextIds = shouldBeLinked
        ? [...new Set([...currentIds, departmentId])]
        : currentIds.filter((id: string) => id !== departmentId);
      if (!nextIds.length) {
        throw new Error(`El empleado ${employeeName(employee)} debe conservar al menos un departamento`);
      }
      const primaryDepartmentId = employee.departmentId && nextIds.includes(employee.departmentId)
        ? employee.departmentId
        : nextIds[0];
      if (!sameIds(currentIds, nextIds) || (shouldBeLinked && !currentIds.includes(departmentId))) {
        await hrService.updateEmployeeDepartments(employeeId, nextIds, primaryDepartmentId);
      }
    }
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error('Ingresa el nombre del departamento');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name,
        description: form.description.trim() || null,
        isSellerDepartment: form.isSellerDepartment,
      };
      const savedDepartment: any = editingId
        ? await hrService.updateDepartment(editingId, payload)
        : await hrService.createDepartment(payload);
      const departmentId = savedDepartment?.id || editingId;
      if (!departmentId) throw new Error('El departamento se guardó, pero no se recibió su identificador');
      await syncDepartmentEmployees(departmentId);
      toast.success(editingId ? 'Departamento actualizado' : 'Departamento creado');
      setEditorOpen(false);
      await onRefresh?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo guardar el departamento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      setDeleting(true);
      await hrService.deleteDepartment(pendingDeleteId);
      toast.success('Departamento desactivado');
      setPendingDeleteId(null);
      await onRefresh?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo desactivar el departamento');
    } finally {
      setDeleting(false);
    }
  };

  const departmentToDelete = departments.find((department: any) => department.id === pendingDeleteId);
  const activeSellerDepartment = departments.find((department: any) => department?.isSellerDepartment === true) || null;
  const anotherSellerDepartment = activeSellerDepartment && activeSellerDepartment.id !== editingId
    ? activeSellerDepartment
    : null;
  const showSellerToggle = form.isSellerDepartment || !anotherSellerDepartment;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end" data-tour="hr-departments-title">
        <div>
          <div className="flex items-center gap-2"><Building2 className="size-5 text-primary" /><h2 className="text-xl font-black uppercase tracking-tight">Departamentos</h2></div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Organiza empleados por áreas. Cada empleado conserva un cargo y puede pertenecer a varios departamentos.</p>
        </div>
        <div className="erp-list-toolbar flex flex-wrap items-center gap-2" data-tour="hr-departments-actions">
          {canCreate && <Button type="button" onClick={openCreate} data-toolbar-role="primary" className="h-10 shrink-0 gap-2 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest !text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"><Plus className="size-4" /> Nuevo departamento</Button>}
          <HRViewTutorial label="Cómo gestionar departamentos" targetPrefix="hr-departments" copy={{ data: { description: 'Consulta las áreas, empleados vinculados y qué departamentos habilitan vendedores.' }, actions: { description: 'Crea, edita o desactiva departamentos según tus permisos.' } }} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="hr-departments-data">
        {departments.map((department: any, index: number) => {
          const departmentEmployees = employees.filter((employee: any) => employeeDepartmentIds(employee, validDepartmentIds).includes(department.id));
          const departmentPositions = positions
            .filter((position: any) => String(position?.departmentId) === String(department.id))
            .map((position: any) => ({
              position,
              employeeCount: departmentEmployees.filter((employee: any) => String(employee.positionId) === String(position.id)).length,
            }));
          const hasLinkedEmployees = departmentEmployees.length > 0
            || Number(department?._count?.employees || 0) > 0
            || Number(department?._count?.employeeMemberships || 0) > 0;
          return (
            <motion.div key={department.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
              <Card className={cn('h-full overflow-hidden rounded-2xl border-border/50 shadow-sm transition-shadow hover:shadow-md', department.isSellerDepartment && 'border-primary/70 shadow-md shadow-primary/10 ring-1 ring-primary/20')}>
                <CardHeader className="border-b border-border/40 bg-muted/10 pb-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Building2 className="size-5" /></div><div className="min-w-0"><CardTitle className="truncate text-base font-black">{department.name}</CardTitle>{department.isSellerDepartment && <Badge className="mt-1 border-primary/25 bg-primary/10 text-[10px] text-primary hover:bg-primary/10">Departamento vendedor</Badge>}</div></div><div className="flex shrink-0 items-center gap-1">{canEdit && <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" title="Editar departamento" aria-label={`Editar ${department.name}`} onClick={() => openEdit(department)}><Edit2 className="size-4" /></Button>}{canDelete && <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg" title={hasLinkedEmployees ? 'No se puede desactivar: hay empleados vinculados' : 'Desactivar departamento'} aria-label={hasLinkedEmployees ? `No se puede desactivar ${department.name} porque tiene empleados vinculados` : `Desactivar ${department.name}`} disabled={hasLinkedEmployees} onClick={() => setPendingDeleteId(department.id)}><Trash2 className="size-4" /></Button>}</div></div></CardHeader>
                <CardContent className="space-y-4 p-5">
                  <p className="min-h-10 text-sm text-muted-foreground">{department.description || 'Sin descripción registrada.'}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/40 pt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><UsersRound className="size-3.5" /> {departmentEmployees.length} {departmentEmployees.length === 1 ? 'empleado' : 'empleados'}</span>
                    <span className="text-border" aria-hidden="true">·</span>
                    <span className="flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" /> {departmentPositions.length} {departmentPositions.length === 1 ? 'puesto asociado' : 'puestos asociados'}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><BriefcaseBusiness className="size-3.5" /> Empleados por puesto</p>
                      <Badge variant="secondary" className="text-[9px]">{departmentPositions.length}</Badge>
                    </div>
                    {departmentPositions.length ? <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                      {departmentPositions.map(({ position, employeeCount }: any) => <div key={position.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/10 px-3 py-2.5"><div className="min-w-0"><p className="truncate text-xs font-bold">{position.title || 'Puesto sin nombre'}</p><p className="truncate text-[10px] text-muted-foreground">{position.code ? `${position.code} · ` : ''}Puesto de {department.name}</p></div><Badge variant={employeeCount ? 'outline' : 'secondary'} className="shrink-0 text-[10px]">{employeeCount} {employeeCount === 1 ? 'empleado' : 'empleados'}</Badge></div>)}
                    </div> : <div className="rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground">No hay puestos configurados para este departamento.</div>}
                  </div>
                  {departmentEmployees.length ? <><div className="flex flex-wrap gap-1.5">{departmentEmployees.slice(0, 4).map((employee: any) => <Badge key={employee.id} variant="outline" className="max-w-full gap-1.5 rounded-lg text-[10px]"><span className="max-w-32 truncate">{employeeName(employee)}</span><span className="max-w-24 truncate text-muted-foreground">· {employeePositionName(employee)}</span></Badge>)}{departmentEmployees.length > 4 && <Badge variant="secondary" className="rounded-lg text-[10px]">+{departmentEmployees.length - 4}</Badge>}</div><p className="text-[10px] text-muted-foreground">No se puede desactivar mientras existan empleados vinculados.</p></> : <div className="rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground">{hasLinkedEmployees ? 'Hay empleados vinculados que no aparecen en esta página.' : 'No hay empleados vinculados. Este departamento se puede desactivar.'}</div>}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {!departments.length && <Card className="rounded-2xl border-dashed border-border/70"><CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center"><div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Building2 className="size-7" /></div><p className="font-black">Aún no hay departamentos</p><p className="max-w-md text-sm text-muted-foreground">Crea el primer departamento de Recursos Humanos y vincula sus empleados.</p>{canCreate && <Button type="button" onClick={openCreate} className="mt-2 rounded-xl"><Plus className="size-4" /> Crear departamento</Button>}</CardContent></Card>}

      <Dialog open={editorOpen} onOpenChange={(open) => { if (!saving) { setEditorOpen(open); if (!open) { setEmployeePickerOpen(false); setEmployeeSearch(''); } } }}><DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] !max-w-3xl !overflow-hidden rounded-3xl p-0"><DialogHeader className="shrink-0 border-b border-border/40 px-6 py-5" data-tour="hr-department-form-title"><DialogTitle className="flex items-center gap-2 text-xl font-black"><Building2 className="size-5 text-primary" /> {editingId ? 'Editar departamento' : 'Nuevo departamento'}</DialogTitle><DialogDescription>Define el área, marca si sus empleados pueden vender y vincula uno o varios empleados.</DialogDescription><HRViewTutorial label={editingId ? 'Cómo editar departamento' : 'Cómo crear departamento'} targetPrefix="hr-department-form" stepKeys={['title', 'data', 'items', 'actions']} copy={{ data: { description: 'Escribe solamente el nombre visible del departamento y su descripción.' }, items: { title: 'Empleados vinculados', description: 'Selecciona empleados activos; cada uno conserva su cargo y puede estar en varias áreas.' }, actions: { description: 'Guarda el departamento y sus empleados.' } }} /></DialogHeader>
          <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain scrollbar-overlay px-6 py-5" data-tour="hr-department-form-data"><div className="space-y-2"><Label htmlFor="department-name">Nombre del departamento</Label><Input id="department-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Ventas" autoFocus /></div><div className="space-y-2"><Label htmlFor="department-description">Descripción</Label><Textarea id="department-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Responsabilidad principal del departamento" rows={3} /></div>
          {showSellerToggle && <label className={cn('flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors', form.isSellerDepartment ? 'border-primary/70 bg-primary/[0.06] hover:bg-primary/[0.1]' : 'border-border/60 bg-muted/10 hover:bg-muted/30')}><input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={form.isSellerDepartment} onChange={(event) => setForm((current) => ({ ...current, isSellerDepartment: event.target.checked }))} /><span className="min-w-0"><span className="flex items-center gap-2 text-sm font-black"><BriefcaseBusiness className="size-4 text-primary" /> Departamento vendedor</span><span className="mt-1 block text-xs text-muted-foreground">Los empleados vinculados a este departamento aparecerán en el selector de vendedores de Ventas.</span></span></label>}
          <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/[0.03] p-4" data-tour="hr-department-form-items"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><Label className="text-sm font-black">Empleados vinculados</Label><p className="mt-1 text-xs text-muted-foreground">Busca por nombre, número, cargo o departamento. El puesto siempre pertenece a un departamento de Recursos Humanos.</p></div><Badge variant="outline" className="w-fit">{form.employeeIds.length} seleccionados</Badge></div>
            <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" /><PopoverAnchor asChild><Input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} onFocus={() => setEmployeePickerOpen(true)} onClick={() => setEmployeePickerOpen(true)} placeholder="Buscar empleado, número, cargo o departamento" className="pl-9" aria-label="Buscar empleado por nombre, número, cargo o departamento" /></PopoverAnchor></div><PopoverContent align="start" sideOffset={6} className="w-[var(--radix-popover-trigger-width)] min-w-[min(18rem,calc(100vw-3rem))] max-w-[calc(100vw-3rem)] rounded-2xl p-2"><div className="border-b border-border/40 px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{employeeSearch.trim() ? `Resultados para “${employeeSearch.trim()}”` : 'Empleados disponibles'}</div><div className="mt-2 max-h-72 space-y-1 overflow-y-auto">{availableEmployees.slice(0, 5).map((employee: any) => <button key={employee.id} type="button" onClick={() => { toggleEmployee(employee); setEmployeeSearch(''); setEmployeePickerOpen(false); }} className="flex w-full min-w-0 items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-black text-muted-foreground">{employeeName(employee).split(/\s+/).map((part: string) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{employeeName(employee)}</span><span className="block truncate text-[10px] text-muted-foreground">{employee.employeeNumber || 'Sin número de empleado'}</span><span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground"><BriefcaseBusiness className="size-3 shrink-0" /><span className="truncate">Cargo: {employeePositionName(employee)}</span><span aria-hidden="true">·</span><span className="truncate">Departamento: {employeeDepartmentName(employee)}</span></span></span><Plus className="size-4 shrink-0 text-muted-foreground" /></button>)}{!availableEmployees.length && <p className="rounded-xl border border-dashed border-border/60 px-3 py-5 text-center text-xs text-muted-foreground">No hay empleados disponibles que coincidan con la búsqueda.</p>}{availableEmployees.length > 5 && <p className="px-2 py-2 text-center text-[10px] text-muted-foreground">Refina la búsqueda para ver más resultados.</p>}</div></PopoverContent></Popover>
             {assignedEmployees.length ? <div className="space-y-2"><div className="flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600"><Check className="size-3.5" /> Vinculados</p><Badge variant="secondary" className="text-[9px]">{assignedEmployees.length}</Badge></div><div className="grid max-h-56 gap-2 overflow-y-auto pr-1 scrollbar-overlay sm:grid-cols-2">{assignedEmployees.map((employee: any) => <button key={employee.id} type="button" aria-pressed="true" onClick={() => toggleEmployee(employee)} className="flex min-w-0 items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-emerald-500/[0.08]"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">{employeeName(employee).split(/\s+/).map((part: string) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{employeeName(employee)}</span><span className="flex min-w-0 items-center gap-1 truncate text-[10px] text-muted-foreground"><BriefcaseBusiness className="size-3 shrink-0" />Cargo: {employeePositionName(employee)}</span><span className="block truncate text-[10px] text-muted-foreground">Departamento: {employeeDepartmentName(employee)}</span></span><Check className="size-4 shrink-0 text-emerald-600" /></button>)}</div></div> : <p className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">Aún no hay empleados seleccionados. Escribe en la búsqueda para vincular uno.</p>}
          </div>
        </div><DialogFooter className="shrink-0 border-t border-border/40 px-6 py-4" data-tour="hr-department-form-actions"><Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>Cancelar</Button><Button type="button" onClick={() => void handleSave()} disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear departamento'}</Button></DialogFooter>
      </DialogContent></Dialog>

      <ConfirmDialog open={Boolean(pendingDeleteId)} onOpenChange={(open) => !open && setPendingDeleteId(null)} title="Desactivar departamento" description={`Se desactivará ${departmentToDelete?.name || 'este departamento'}. Los vínculos históricos de empleados se conservarán.`} confirmLabel="Desactivar" onConfirm={handleDelete} loading={deleting} />
    </div>
  );
}
