import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Check,
  Code2,
  Info,
  Link2,
  Plus,
  Search,
  Trash2,
  UserRound,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { cn } from '../ui/utils';
import { hrService } from '../../services/hr.service';
import { tenantsService } from '../../services/tenants.service';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';

interface DepartmentsViewProps {
  tenantId: string;
  users: any[];
  employees: any[];
  onBack: () => void;
  onDataChange?: () => Promise<unknown> | void;
  onLinkUserToEmployee?: (user: any) => void;
}

const getMembershipIds = (memberships: any[] | undefined, fallbackId?: string | null) => {
  const ids = (memberships || [])
    .map((membership) => membership.department?.id || membership.departmentId)
    .filter(Boolean);
  return ids.length ? ids : (fallbackId ? [fallbackId] : []);
};

const getUserDepartmentIds = (user: any) => getMembershipIds(user.departmentMemberships, user.departmentId);
const getEmployeeDepartmentIds = (employee: any) => getMembershipIds(employee.departmentMemberships, employee.departmentId);

const getEmployeeName = (employee: any) => `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.employeeNumber || 'Empleado';

export function DepartmentsView({ tenantId, users, employees, onBack, onDataChange, onLinkUserToEmployee }: DepartmentsViewProps) {
  const queryClient = useQueryClient();
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [newDepartment, setNewDepartment] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: departmentsData, isLoading, refetch: refetchDepartments } = useTenantQuery(
    ['my-company-departments', tenantId],
    async (signal) => asList(await hrService.getDepartments(signal)),
    { enabled: Boolean(tenantId), onError: (error) => toast.error(error.message || 'No se pudieron cargar los departamentos') },
  );

  useEffect(() => {
    if (!departmentsData) return;
    setDepartments(departmentsData);
  }, [departmentsData]);

  useEffect(() => {
    if (!departments.length) {
      setSelectedDepartmentId(null);
      return;
    }
    if (!selectedDepartmentId || !departments.some((department) => department.id === selectedDepartmentId)) {
      setSelectedDepartmentId(departments[0].id);
    }
  }, [departments, selectedDepartmentId]);

  const filteredDepartments = useMemo(() => {
    const term = departmentSearch.trim().toLowerCase();
    if (!term) return departments;
    return departments.filter((department) => `${department.name} ${department.code || ''}`.toLowerCase().includes(term));
  }, [departments, departmentSearch]);

  const selectedDepartment = departments.find((department) => department.id === selectedDepartmentId) || null;

  const departmentUsers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    return users.filter((user) => !term || `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(term));
  }, [users, memberSearch]);

  const departmentEmployees = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    return employees.filter((employee) => !term || `${getEmployeeName(employee)} ${employee.email || ''} ${employee.employeeNumber || ''}`.toLowerCase().includes(term));
  }, [employees, memberSearch]);

  const countMembers = (departmentId: string) => ({
    users: users.filter((user) => getUserDepartmentIds(user).includes(departmentId)).length,
    employees: employees.filter((employee) => getEmployeeDepartmentIds(employee).includes(departmentId)).length,
  });

  const createDepartment = async () => {
    const name = newDepartment.trim();
    if (!name) {
      toast.error('Escribe el nombre del departamento');
      return;
    }

    try {
      setCreating(true);
      const code = `DEPT-${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}${Math.floor(Math.random() * 100)}`;
      const response: any = await hrService.createDepartment({ name, code });
      const created = response?.data || response;
      setNewDepartment('');
      if (created?.id) setSelectedDepartmentId(created.id);
      await refetchDepartments();
      toast.success('Departamento creado correctamente');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al crear departamento');
    } finally {
      setCreating(false);
    }
  };

  const updateSellerDepartment = async (checked: boolean) => {
    if (!selectedDepartment) return;
    try {
      setSavingKey(`seller:${selectedDepartment.id}`);
      await hrService.updateDepartment(selectedDepartment.id, { isSellerDepartment: checked });
      setDepartments((items) => items.map((department) => department.id === selectedDepartment.id ? { ...department, isSellerDepartment: checked } : department));
      await queryClient.invalidateQueries({ queryKey: ['sales', 'employees'] });
      await onDataChange?.();
      toast.success(checked ? 'Departamento habilitado como vendedor' : 'Departamento quitado como vendedor');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al actualizar el departamento');
    } finally {
      setSavingKey('');
    }
  };

  const toggleUserDepartment = async (user: any) => {
    if (!selectedDepartment) return;
    const current = getUserDepartmentIds(user);
    const isAddingToSellerDepartment = !current.includes(selectedDepartment.id) && selectedDepartment.isSellerDepartment;
    if (isAddingToSellerDepartment && !user.employee?.id) {
      toast.error('No se puede vincular este usuario al departamento vendedor porque no tiene un empleado vinculado. Vincula primero su empleado para que las comisiones puedan llegar a nómina.');
      return;
    }
    const next = current.includes(selectedDepartment.id)
      ? current.filter((id) => id !== selectedDepartment.id)
      : [...current, selectedDepartment.id];
    const primary = current[0] === selectedDepartment.id ? (next[0] || null) : (current[0] || next[0] || null);

    try {
      setSavingKey(`user:${user.id}`);
      await tenantsService.updateUserDepartments(tenantId, user.id, next, primary);
      await onDataChange?.();
      toast.success(next.includes(selectedDepartment.id) ? 'Usuario vinculado al departamento' : 'Usuario desvinculado del departamento');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al actualizar el usuario');
    } finally {
      setSavingKey('');
    }
  };

  const toggleEmployeeDepartment = async (employee: any) => {
    if (!selectedDepartment) return;
    const current = getEmployeeDepartmentIds(employee);
    const isAssigned = current.includes(selectedDepartment.id);
    if (isAssigned && current.length === 1) {
      toast.error('El empleado debe conservar al menos un departamento');
      return;
    }
    const next = isAssigned
      ? current.filter((id) => id !== selectedDepartment.id)
      : [...current, selectedDepartment.id];
    const primary = employee.departmentId === selectedDepartment.id
      ? (next[0] || null)
      : (employee.departmentId || next[0] || null);

    try {
      setSavingKey(`employee:${employee.id}`);
      await hrService.updateEmployeeDepartments(employee.id, next, primary);
      await queryClient.invalidateQueries({ queryKey: ['sales', 'employees'] });
      await onDataChange?.();
      toast.success(isAssigned ? 'Empleado desvinculado del departamento' : 'Empleado vinculado al departamento');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al actualizar el empleado');
    } finally {
      setSavingKey('');
    }
  };

  const deleteDepartment = async () => {
    if (!selectedDepartment) return;
    try {
      setDeleting(true);
      await hrService.deleteDepartment(selectedDepartment.id);
      setDeleteDialogOpen(false);
      setSelectedDepartmentId(null);
      await refetchDepartments();
      await onDataChange?.();
      toast.success('Departamento eliminado');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al eliminar departamento');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6" data-tour="departments-view">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="outline" size="icon" className="mt-1 shrink-0" onClick={onBack} aria-label="Volver a Mi Equipo">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-2xl font-black uppercase italic tracking-tight"><Building2 className="size-6 shrink-0 text-primary" /> Departamentos</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Crea los departamentos compartidos con Recursos Humanos y administra desde aquí sus usuarios, empleados y la condición de vendedores.</p>
          </div>
        </div>
        <Badge variant="outline" className="w-fit shrink-0 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest">{departments.length} creados</Badge>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <Card className="min-w-0 border-border/50">
          <CardHeader className="border-b border-border/30 bg-muted/10 pb-4">
            <CardTitle className="text-sm font-black uppercase tracking-wider">Nuevo departamento</CardTitle>
            <CardDescription className="text-xs">El departamento se utilizará también en Recursos Humanos.</CardDescription>
            <div className="flex min-w-0 gap-2 pt-2">
              <Input value={newDepartment} onChange={(event) => setNewDepartment(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void createDepartment()} placeholder="Ej. Ventas" className="h-10 min-w-0" aria-label="Nombre del nuevo departamento" />
              <Button onClick={() => void createDepartment()} disabled={creating} className="h-10 shrink-0 gap-1.5"><Plus className="size-4" /> Crear</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={departmentSearch} onChange={(event) => setDepartmentSearch(event.target.value)} placeholder="Buscar departamento..." className="h-10 pl-9" aria-label="Buscar departamento" />
            </div>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Cargando departamentos...</p>}
              {!isLoading && !filteredDepartments.length && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No hay departamentos que mostrar.</div>}
              {filteredDepartments.map((department) => {
                const counts = countMembers(department.id);
                const selected = department.id === selectedDepartmentId;
                return <button key={department.id} type="button" onClick={() => setSelectedDepartmentId(department.id)} className={cn('w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', selected ? 'border-primary bg-primary/10' : 'border-border/50 bg-muted/10 hover:bg-muted/30')} aria-pressed={selected}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate text-sm font-black uppercase tracking-wide">{department.name}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Code2 className="size-3" /> {department.code || 'Sin código'}</p></div>
                    {department.isSellerDepartment && <Badge className="shrink-0 bg-emerald-500/10 text-[9px] text-emerald-600 hover:bg-emerald-500/10">Vendedores</Badge>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-muted-foreground"><span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-1"><Users className="size-3" /> {counts.users} usuarios</span><span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-1"><UserRound className="size-3" /> {counts.employees} empleados</span></div>
                </button>;
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/50">
          {!selectedDepartment ? <CardContent className="flex min-h-[520px] items-center justify-center p-8 text-center"><div className="max-w-sm"><Building2 className="mx-auto size-12 text-muted-foreground/30" /><p className="mt-4 font-bold">Selecciona un departamento</p><p className="mt-1 text-sm text-muted-foreground">Aquí podrás marcarlo como departamento vendedor y administrar sus integrantes.</p></div></CardContent> : <>
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0"><CardTitle className="truncate text-xl font-black uppercase tracking-tight">{selectedDepartment.name}</CardTitle><CardDescription className="mt-1 flex items-center gap-1 text-xs"><Code2 className="size-3" /> {selectedDepartment.code || 'Sin código'} · Compartido con Recursos Humanos</CardDescription></div>
                <Button variant="outline" size="sm" className="w-fit shrink-0 gap-1.5 border-rose-500/20 text-rose-600 hover:bg-rose-500/10" onClick={() => setDeleteDialogOpen(true)}><Trash2 className="size-3.5" /> Eliminar</Button>
              </div>
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3"><UserRoundCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" /><div><p className="text-sm font-black">Vendedores por departamento</p><p className="mt-1 text-xs text-muted-foreground">Todos los empleados vinculados a este departamento podrán seleccionarse como vendedores en Ventas y sus comisiones podrán pasar a nómina.</p></div></div>
                <Switch id={`seller-department-${selectedDepartment.id}`} checked={!!selectedDepartment.isSellerDepartment} onCheckedChange={(checked) => void updateSellerDepartment(checked)} disabled={savingKey === `seller:${selectedDepartment.id}`} aria-label={`Marcar ${selectedDepartment.name} como departamento vendedor`} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black uppercase tracking-wider">Integrantes del departamento</p><p className="mt-1 text-xs text-muted-foreground">Un usuario puede pertenecer a varios departamentos. Un empleado conserva al menos uno.</p></div><div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Buscar usuario o empleado..." className="h-10 pl-9" aria-label="Buscar integrante" /></div></div>
              <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-2">
                <Card className="min-w-0 border-border/50 bg-muted/5"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm font-black"><Users className="size-4 text-primary" /> Usuarios <Badge variant="secondary" className="text-[9px]">{users.filter((user) => getUserDepartmentIds(user).includes(selectedDepartment.id)).length}</Badge></CardTitle><CardDescription className="text-xs">Personas con acceso a la empresa.</CardDescription></CardHeader><CardContent className="space-y-2"><div className="max-h-[390px] space-y-2 overflow-y-auto pr-1">{!departmentUsers.length && <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No hay usuarios que coincidan.</p>}{departmentUsers.map((user) => { const assigned = getUserDepartmentIds(user).includes(selectedDepartment.id); const busy = savingKey === `user:${user.id}`; const needsEmployee = selectedDepartment.isSellerDepartment && !user.employee?.id && !assigned; return <div key={user.id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">{user.name?.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-bold">{user.name}</p><p className="truncate text-[10px] text-muted-foreground">{user.email}</p>{needsEmployee && <p className="mt-1 text-[10px] font-semibold text-amber-600">Requiere empleado vinculado para comisiones</p>}</div></div><div className="flex flex-wrap items-center justify-end gap-2"><Button type="button" size="sm" variant={assigned ? 'default' : 'outline'} disabled={busy} className="h-8 shrink-0 gap-1.5 text-[10px] font-bold" onClick={() => void toggleUserDepartment(user)} aria-pressed={assigned}>{assigned ? <Check className="size-3" /> : <Plus className="size-3" />}{assigned ? 'Vinculado' : 'Vincular'}</Button>{needsEmployee && onLinkUserToEmployee && <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 border-amber-500/25 text-[10px] font-bold text-amber-600 hover:bg-amber-500/10" onClick={() => onLinkUserToEmployee(user)}><Link2 className="size-3" /> Vincular empleado</Button>}</div></div>; })}</div></CardContent></Card>
                <Card className="min-w-0 border-border/50 bg-muted/5"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm font-black"><UserRound className="size-4 text-primary" /> Empleados <Badge variant="secondary" className="text-[9px]">{employees.filter((employee) => getEmployeeDepartmentIds(employee).includes(selectedDepartment.id)).length}</Badge></CardTitle><CardDescription className="text-xs">Empleados de Recursos Humanos y futuros vendedores.</CardDescription></CardHeader><CardContent className="space-y-2"><div className="max-h-[390px] space-y-2 overflow-y-auto pr-1">{!departmentEmployees.length && <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No hay empleados que coincidan.</p>}{departmentEmployees.map((employee) => { const assigned = getEmployeeDepartmentIds(employee).includes(selectedDepartment.id); const busy = savingKey === `employee:${employee.id}`; return <div key={employee.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/60 px-3 py-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{getEmployeeName(employee)}</p><p className="truncate text-[10px] text-muted-foreground">{employee.employeeNumber || employee.email || 'Sin identificador'}</p>{employee.user && <p className="mt-1 text-[10px] font-semibold text-emerald-600">Usuario vinculado: {employee.user.name}</p>}</div><Button type="button" size="sm" variant={assigned ? 'default' : 'outline'} disabled={busy} className="h-8 shrink-0 gap-1.5 text-[10px] font-bold" onClick={() => void toggleEmployeeDepartment(employee)} aria-pressed={assigned}>{assigned ? <Check className="size-3" /> : <Plus className="size-3" />}{assigned ? 'Vinculado' : 'Vincular'}</Button></div>; })}</div></CardContent></Card>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0 text-primary" /><p>Los roles y permisos de módulos continúan configurándose directamente en cada usuario. Este departamento solo organiza integrantes y define si sus empleados participan como vendedores.</p></div>
            </CardContent>
          </>}
        </Card>
      </div>

      <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} title="¿Eliminar departamento?" description={`Se desactivará ${selectedDepartment?.name || 'este departamento'}. Sus vínculos históricos se conservarán, pero dejará de aparecer en los nuevos listados.`} confirmLabel="Eliminar" onConfirm={deleteDepartment} loading={deleting} />
    </div>
  );
}
