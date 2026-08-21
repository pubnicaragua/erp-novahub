import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Briefcase,
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
const getDepartmentHeadIds = (department: any) => (department?.departmentHeads || [])
  .map((head: any) => head.userId || head.user?.id)
  .filter(Boolean);

const getEmployeeName = (employee: any) => `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.employeeNumber || 'Empleado';

const getRoleLabel = (user: any) => {
  if (user.role?.toUpperCase() === 'ADMIN') return 'Administrador';
  return user.customRole?.name || 'Colaborador';
};

export function DepartmentsView({ tenantId, users, employees, onBack, onDataChange, onLinkUserToEmployee }: DepartmentsViewProps) {
  const queryClient = useQueryClient();
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [newDepartment, setNewDepartment] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [headSearch, setHeadSearch] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingPosition, setCreatingPosition] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingPositionKey, setDeletingPositionKey] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: departmentsData, isLoading, refetch: refetchDepartments } = useTenantQuery(
    ['my-company-departments', tenantId],
    async (signal) => asList(await hrService.getDepartments(signal)),
    { enabled: Boolean(tenantId), onError: (error) => toast.error(error.message || 'No se pudieron cargar los departamentos') },
  );

  const { data: positionsData, refetch: refetchPositions } = useTenantQuery(
    ['my-company-positions', tenantId],
    async (signal) => asList(await hrService.getPositions(undefined, signal)),
    { enabled: Boolean(tenantId), onError: (error) => toast.error(error.message || 'No se pudieron cargar los puestos') },
  );

  useEffect(() => {
    if (!positionsData) return;
    setPositions(positionsData);
  }, [positionsData]);

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

  const departmentPositions = useMemo(() => {
    return positions.filter((position) => position.departmentId === selectedDepartmentId);
  }, [positions, selectedDepartmentId]);

  const departmentUsers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    const filtered = users.filter((user) => !term || `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(term));
    return filtered.sort((a, b) => Number(getUserDepartmentIds(b).includes(selectedDepartmentId)) - Number(getUserDepartmentIds(a).includes(selectedDepartmentId)));
  }, [users, memberSearch, selectedDepartmentId]);

  const departmentEmployees = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    return employees.filter((employee) => !term || `${getEmployeeName(employee)} ${employee.email || ''} ${employee.employeeNumber || ''}`.toLowerCase().includes(term));
  }, [employees, memberSearch]);

  const assignedDepartmentUsers = useMemo(
    () => departmentUsers.filter((user) => getUserDepartmentIds(user).includes(selectedDepartmentId)),
    [departmentUsers, selectedDepartmentId],
  );
  const availableDepartmentUsers = useMemo(
    () => departmentUsers.filter((user) => !getUserDepartmentIds(user).includes(selectedDepartmentId)),
    [departmentUsers, selectedDepartmentId],
  );
  const assignedDepartmentEmployees = useMemo(
    () => departmentEmployees.filter((employee) => getEmployeeDepartmentIds(employee).includes(selectedDepartmentId)),
    [departmentEmployees, selectedDepartmentId],
  );
  const availableDepartmentEmployees = useMemo(
    () => departmentEmployees.filter((employee) => !getEmployeeDepartmentIds(employee).includes(selectedDepartmentId)),
    [departmentEmployees, selectedDepartmentId],
  );

  const activeUsers = useMemo(() => users.filter((user) => user.isActive !== false), [users]);
  const departmentHeadIds = useMemo(() => getDepartmentHeadIds(selectedDepartment), [selectedDepartment]);
  const filteredHeadUsers = useMemo(() => {
    const term = headSearch.trim().toLowerCase();
    return activeUsers
      .filter((user) => !term || `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(term))
      .sort((a, b) => Number(departmentHeadIds.includes(b.id)) - Number(departmentHeadIds.includes(a.id)));
  }, [activeUsers, departmentHeadIds, headSearch]);
  const assignedDepartmentHeads = useMemo(
    () => activeUsers.filter((user) => departmentHeadIds.includes(user.id)),
    [activeUsers, departmentHeadIds],
  );
  const availableDepartmentHeads = useMemo(
    () => filteredHeadUsers.filter((user) => !departmentHeadIds.includes(user.id)),
    [filteredHeadUsers, departmentHeadIds],
  );

  const countMembers = (departmentId: string) => ({
    users: users.filter((user) => getUserDepartmentIds(user).includes(departmentId)).length,
    employees: employees.filter((employee) => getEmployeeDepartmentIds(employee).includes(departmentId)).length,
    positions: positions.filter((position) => position.departmentId === departmentId).length,
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

  const createPosition = async () => {
    if (!selectedDepartment) return;
    const title = newPosition.trim();
    if (!title) {
      toast.error('Escribe el título del puesto');
      return;
    }
    try {
      setCreatingPosition(true);
      const code = `POS-${title.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}${Math.floor(Math.random() * 100)}`;
      await hrService.createPosition({ title, departmentId: selectedDepartment.id, code });
      setNewPosition('');
      await refetchPositions();
      await onDataChange?.();
      toast.success('Puesto creado correctamente');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al crear el puesto');
    } finally {
      setCreatingPosition(false);
    }
  };

  const deletePosition = async (position: any) => {
    try {
      setDeletingPositionKey(position.id);
      await hrService.deletePosition(position.id);
      setPositions((items) => items.filter((item) => item.id !== position.id));
      await refetchPositions();
      await onDataChange?.();
      toast.success('Puesto eliminado');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al eliminar el puesto');
    } finally {
      setDeletingPositionKey('');
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

  const toggleDepartmentHead = async (user: any) => {
    if (!selectedDepartment) return;
    const isAssigned = departmentHeadIds.includes(user.id);
    const nextHeadUserIds = isAssigned
      ? departmentHeadIds.filter((id: string) => id !== user.id)
      : [...departmentHeadIds, user.id];

    try {
      setSavingKey(`head:${user.id}`);
      const response: any = await hrService.updateDepartment(selectedDepartment.id, { headUserIds: nextHeadUserIds });
      const updatedDepartment = response?.data || response;
      setDepartments((items) => items.map((department) => (
        department.id === selectedDepartment.id
          ? { ...department, ...updatedDepartment }
          : department
      )));
      await refetchDepartments();
      await onDataChange?.();
      toast.success(isAssigned ? 'Jefe desvinculado del departamento' : 'Jefe asignado al departamento');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al actualizar los jefes del departamento');
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
              <Input value={departmentSearch} onChange={(event) => { const term = event.target.value; setDepartmentSearch(term); const normalized = term.trim().toLowerCase(); if (normalized) { const match = departments.find((department) => `${department.name} ${department.code || ''}`.toLowerCase().includes(normalized)); if (match) setSelectedDepartmentId(match.id); } }} placeholder="Buscar departamento..." className="h-10 pl-9" aria-label="Buscar departamento" />
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
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-muted-foreground"><span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-1"><Users className="size-3" /> {counts.users} usuarios</span><span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-1"><UserRound className="size-3" /> {counts.employees} empleados</span><span className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-1"><Briefcase className="size-3" /> {counts.positions} puestos</span></div>
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
              <Card className="min-w-0 border-primary/20 bg-primary/[0.02]">
                <CardHeader className="border-b border-border/30 pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-black"><UserRoundCheck className="size-4 text-primary" /> Jefes de departamento <Badge variant="secondary" className="text-[9px]">{assignedDepartmentHeads.length}</Badge></CardTitle>
                  <CardDescription className="text-xs">Selecciona uno o varios usuarios. Los empleados no aparecen aquí como candidatos; solo se muestran sus cuentas de acceso.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600"><Check className="size-3.5" /> Usuarios asignados</p><Badge variant="secondary" className="text-[9px]">{assignedDepartmentHeads.length}</Badge></div>
                    <div className="grid max-h-52 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {!assignedDepartmentHeads.length && <p className="col-span-full rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">Aún no hay jefes asignados.</p>}
                      {assignedDepartmentHeads.map((user) => {
                        const busy = savingKey === `head:${user.id}`;
                        const hasEmployee = Boolean(user.employee?.id);
                        return <div key={user.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2.5"><div className="flex min-w-0 items-center gap-2"><div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">{user.name?.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-bold">{user.name}</p><p className="truncate text-[10px] text-muted-foreground">{user.email}</p><Badge variant="outline" className="mt-1 rounded-full text-[9px]">{hasEmployee ? 'Usuario + empleado' : 'Usuario sin empleado'}</Badge></div></div><Button type="button" size="sm" variant="outline" disabled={busy} className="h-8 shrink-0 gap-1.5 text-[10px] font-bold" onClick={() => void toggleDepartmentHead(user)} aria-label={`Desvincular jefe ${user.name}`}><Check className="size-3" /> Quitar</Button></div>;
                      })}
                    </div>
                  </div>
                  <div className="border-t border-border/40 pt-4">
                    <div className="mb-2 flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground"><Plus className="size-3.5" /> Usuarios disponibles</p><Badge variant="secondary" className="text-[9px]">{availableDepartmentHeads.length}</Badge></div>
                    <div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={headSearch} onChange={(event) => setHeadSearch(event.target.value)} placeholder="Buscar usuario por nombre o correo..." className="h-9 pl-9 text-xs" aria-label="Buscar usuario jefe" /></div>
                    <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {availableDepartmentHeads.map((user) => {
                        const busy = savingKey === `head:${user.id}`;
                        const hasEmployee = Boolean(user.employee?.id);
                        return <div key={user.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/70 px-3 py-2.5"><div className="flex min-w-0 items-center gap-2"><div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-black text-muted-foreground">{user.name?.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-bold">{user.name}</p><p className="truncate text-[10px] text-muted-foreground">{user.email}</p><Badge variant="outline" className="mt-1 rounded-full text-[9px]">{hasEmployee ? 'Usuario + empleado' : 'Usuario sin empleado'}</Badge></div></div><Button type="button" size="sm" variant="outline" disabled={busy} className="h-8 shrink-0 gap-1.5 text-[10px] font-bold" onClick={() => void toggleDepartmentHead(user)} aria-label={`Asignar como jefe a ${user.name}`}><Plus className="size-3" /> Asignar</Button></div>;
                      })}
                    </div>
                    {!availableDepartmentHeads.length && <p className="mt-2 rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No hay usuarios disponibles que coincidan con la búsqueda.</p>}
                  </div>
                </CardContent>
              </Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black uppercase tracking-wider">Integrantes del departamento</p><p className="mt-1 text-xs text-muted-foreground">Los usuarios tienen acceso a la empresa; los empleados pertenecen a Recursos Humanos. Un empleado puede existir sin usuario vinculado.</p></div><div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Buscar usuario o empleado..." className="h-10 pl-9" aria-label="Buscar integrante" /></div></div>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.03] px-3 py-2.5 text-[10px] text-muted-foreground"><span className="font-black uppercase tracking-wider text-foreground">Cómo leerlo:</span><Badge variant="outline" className="gap-1 rounded-full text-[9px]"><UserRoundCheck className="size-3 text-emerald-600" /> Vinculado</Badge><Badge variant="outline" className="gap-1 rounded-full text-[9px]"><Users className="size-3 text-primary" /> Usuario + empleado</Badge><Badge variant="outline" className="gap-1 rounded-full text-[9px]"><UserRound className="size-3" /> Solo empleado</Badge></div>
              <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-2">
                <Card className="min-w-0 border-border/50 bg-muted/5"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm font-black"><Users className="size-4 text-primary" /> Usuarios <Badge variant="secondary" className="text-[9px]">{users.length}</Badge></CardTitle><CardDescription className="text-xs">Cuentas con acceso a la empresa. Se separan los usuarios ya asignados de los disponibles.</CardDescription></CardHeader><CardContent className="space-y-4"><div><div className="mb-2 flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600"><UserRoundCheck className="size-3.5" /> Vinculados a este departamento</p><Badge variant="secondary" className="text-[9px]">{assignedDepartmentUsers.length}</Badge></div><div className="max-h-[250px] space-y-2 overflow-y-auto pr-1">{!assignedDepartmentUsers.length && <p className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No hay usuarios vinculados aquí.</p>}{assignedDepartmentUsers.map((user) => { const busy = savingKey === `user:${user.id}`; const hasEmployee = Boolean(user.employee?.id); const needsEmployee = selectedDepartment.isSellerDepartment && !hasEmployee; return <div key={user.id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">{user.name?.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-bold">{user.name}</p><p className="truncate text-[10px] text-muted-foreground">{user.email}</p><div className="mt-1 flex flex-wrap gap-1"><Badge variant="outline" className="rounded-full text-[9px]">{hasEmployee ? 'Usuario + empleado' : 'Usuario sin empleado'}</Badge><Badge variant="outline" className="rounded-full text-[9px]">{getRoleLabel(user)}</Badge></div>{needsEmployee && <p className="mt-1 text-[10px] font-semibold text-amber-600">Requiere empleado vinculado para comisiones</p>}</div></div><div className="flex flex-wrap items-center justify-end gap-2"><Button type="button" size="sm" variant="outline" disabled={busy} className="h-8 shrink-0 gap-1.5 text-[10px] font-bold" onClick={() => void toggleUserDepartment(user)} aria-label={`Desvincular usuario ${user.name}`}><Check className="size-3" /> Desvincular</Button>{needsEmployee && onLinkUserToEmployee && <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 border-amber-500/25 text-[10px] font-bold text-amber-600 hover:bg-amber-500/10" onClick={() => onLinkUserToEmployee(user)}><Link2 className="size-3" /> Vincular empleado</Button>}</div></div>; })}</div></div><div className="border-t border-border/40 pt-4"><div className="mb-2 flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground"><Plus className="size-3.5" /> Disponibles para vincular</p><Badge variant="secondary" className="text-[9px]">{availableDepartmentUsers.length}</Badge></div><div className="max-h-[250px] space-y-2 overflow-y-auto pr-1">{!availableDepartmentUsers.length && <p className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No hay usuarios disponibles con esta búsqueda.</p>}{availableDepartmentUsers.map((user) => { const busy = savingKey === `user:${user.id}`; const hasEmployee = Boolean(user.employee?.id); const needsEmployee = selectedDepartment.isSellerDepartment && !hasEmployee; return <div key={user.id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/40 bg-background/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">{user.name?.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-bold">{user.name}</p><p className="truncate text-[10px] text-muted-foreground">{user.email}</p><div className="mt-1 flex flex-wrap gap-1"><Badge variant="outline" className="rounded-full text-[9px]">{hasEmployee ? 'Usuario + empleado' : 'Usuario sin empleado'}</Badge><Badge variant="outline" className="rounded-full text-[9px]">{getRoleLabel(user)}</Badge></div>{needsEmployee && <p className="mt-1 text-[10px] font-semibold text-amber-600">Requiere empleado vinculado para comisiones</p>}</div></div><div className="flex flex-wrap items-center justify-end gap-2"><Button type="button" size="sm" variant="outline" disabled={busy} className="h-8 shrink-0 gap-1.5 text-[10px] font-bold" onClick={() => void toggleUserDepartment(user)} aria-label={`Vincular usuario ${user.name}`}><Plus className="size-3" /> Vincular</Button>{needsEmployee && onLinkUserToEmployee && <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 border-amber-500/25 text-[10px] font-bold text-amber-600 hover:bg-amber-500/10" onClick={() => onLinkUserToEmployee(user)}><Link2 className="size-3" /> Vincular empleado</Button>}</div></div>; })}</div></div></CardContent></Card>
                <Card className="min-w-0 border-border/50 bg-muted/5"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm font-black"><UserRound className="size-4 text-primary" /> Empleados <Badge variant="secondary" className="text-[9px]">{employees.length}</Badge></CardTitle><CardDescription className="text-xs">Expedientes de Recursos Humanos. Pueden existir aunque no tengan una cuenta de acceso.</CardDescription></CardHeader><CardContent className="space-y-4"><div><div className="mb-2 flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600"><UserRoundCheck className="size-3.5" /> Vinculados a este departamento</p><Badge variant="secondary" className="text-[9px]">{assignedDepartmentEmployees.length}</Badge></div><div className="max-h-[250px] space-y-2 overflow-y-auto pr-1">{!assignedDepartmentEmployees.length && <p className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No hay empleados vinculados aquí.</p>}{assignedDepartmentEmployees.map((employee) => { const busy = savingKey === `employee:${employee.id}`; const hasUser = Boolean(employee.user?.id); return <div key={employee.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{getEmployeeName(employee)}</p><p className="truncate text-[10px] text-muted-foreground">{employee.employeeNumber || employee.email || 'Sin identificador'}</p><div className="mt-1 flex flex-wrap items-center gap-1"><Badge variant="outline" className="rounded-full text-[9px]">{hasUser ? 'Empleado + usuario' : 'Solo empleado'}</Badge>{hasUser && <span className="truncate text-[10px] text-emerald-600">Usuario: {employee.user.name}</span>}</div></div><Button type="button" size="sm" variant="outline" disabled={busy} className="h-8 shrink-0 gap-1.5 text-[10px] font-bold" onClick={() => void toggleEmployeeDepartment(employee)} aria-label={`Desvincular empleado ${getEmployeeName(employee)}`}><Check className="size-3" /> Desvincular</Button></div>; })}</div></div><div className="border-t border-border/40 pt-4"><div className="mb-2 flex items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground"><Plus className="size-3.5" /> Disponibles para vincular</p><Badge variant="secondary" className="text-[9px]">{availableDepartmentEmployees.length}</Badge></div><div className="max-h-[250px] space-y-2 overflow-y-auto pr-1">{!availableDepartmentEmployees.length && <p className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No hay empleados disponibles con esta búsqueda.</p>}{availableDepartmentEmployees.map((employee) => { const busy = savingKey === `employee:${employee.id}`; const hasUser = Boolean(employee.user?.id); return <div key={employee.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/60 px-3 py-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{getEmployeeName(employee)}</p><p className="truncate text-[10px] text-muted-foreground">{employee.employeeNumber || employee.email || 'Sin identificador'}</p><div className="mt-1 flex flex-wrap items-center gap-1"><Badge variant="outline" className="rounded-full text-[9px]">{hasUser ? 'Empleado + usuario' : 'Solo empleado'}</Badge>{hasUser && <span className="truncate text-[10px] text-emerald-600">Usuario: {employee.user.name}</span>}</div></div><Button type="button" size="sm" variant="outline" disabled={busy} className="h-8 shrink-0 gap-1.5 text-[10px] font-bold" onClick={() => void toggleEmployeeDepartment(employee)} aria-label={`Vincular empleado ${getEmployeeName(employee)}`}><Plus className="size-3" /> Vincular</Button></div>; })}</div></div></CardContent></Card>
              </div>
              <Card className="min-w-0 border-border/50 bg-muted/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-black"><Briefcase className="size-4 text-primary" /> Puestos del departamento <Badge variant="secondary" className="text-[9px]">{departmentPositions.length}</Badge></CardTitle>
                  <CardDescription className="text-xs">Los puestos creados aquí se comparten con Recursos Humanos y pueden asignarse a los empleados.</CardDescription>
                  <div className="flex min-w-0 gap-2 pt-2">
                    <Input value={newPosition} onChange={(event) => setNewPosition(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void createPosition()} placeholder="Nuevo puesto (Ej. Vendedor)" className="h-9 min-w-0 text-sm" aria-label="Nombre del nuevo puesto" />
                    <Button size="sm" className="h-9 shrink-0 gap-1.5" onClick={() => void createPosition()} disabled={creatingPosition}><Plus className="size-4" /> Crear</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!departmentPositions.length && <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No hay puestos creados en este departamento.</p>}
                  {departmentPositions.map((position) => {
                    const busy = deletingPositionKey === position.id;
                    return <div key={position.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/60 px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2"><div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-black text-primary"><Briefcase className="size-3.5" /></div><div className="min-w-0"><p className="truncate text-xs font-bold">{position.title}</p><p className="truncate text-[10px] text-muted-foreground">{position.code || 'Sin código'}</p></div></div>
                      <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 text-rose-500 hover:bg-rose-500/10" disabled={busy} onClick={() => void deletePosition(position)} title="Eliminar puesto" aria-label={`Eliminar puesto ${position.title}`}><Trash2 className="size-3.5" /></Button>
                    </div>;
                  })}
                </CardContent>
              </Card>
              <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0 text-primary" /><p>Los roles y permisos de módulos continúan configurándose directamente en cada usuario. Este departamento solo organiza integrantes y define si sus empleados participan como vendedores.</p></div>
            </CardContent>
          </>}
        </Card>
      </div>

      <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} title="¿Eliminar departamento?" description={`Se desactivará ${selectedDepartment?.name || 'este departamento'}. Sus vínculos históricos se conservarán, pero dejará de aparecer en los nuevos listados.`} confirmLabel="Eliminar" onConfirm={deleteDepartment} loading={deleting} />
    </div>
  );
}
