import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, Check, Info, Plus, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import { hrService } from '../../services/hr.service';
import { tenantsService } from '../../services/tenants.service';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';

interface DepartmentsViewProps {
  tenantId: string;
  users: any[];
  onBack: () => void;
  onDataChange?: () => Promise<unknown> | void;
}

const getUserDepartmentIds = (user: any) => {
  const memberships = (user?.departmentMemberships || [])
    .filter((membership: any) => !membership.department?.type || membership.department.type === 'ACCESS')
    .map((membership: any) => membership.department?.id || membership.departmentId)
    .filter(Boolean);
  return memberships.length
    ? memberships
    : (user?.department && (!user.department.type || user.department.type === 'ACCESS') && user?.departmentId ? [user.departmentId] : []);
};

const getRoleLabel = (user: any) => user?.role?.toUpperCase() === 'ADMIN'
  ? 'Administrador'
  : user?.customRole?.name || 'Colaborador';

function departmentUsersFor(department: any, users: any[]) {
  return users.filter((user: any) => getUserDepartmentIds(user).includes(department.id));
}

export function DepartmentsView({ tenantId, users, onBack, onDataChange }: DepartmentsViewProps) {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: departmentsData, isLoading, refetch: refetchDepartments } = useTenantQuery(
    ['my-company-access-departments', tenantId],
    async (signal) => asList(await hrService.getDepartments(signal, 'ACCESS')),
    { enabled: Boolean(tenantId), onError: (error) => toast.error(error.message || 'No se pudieron cargar los departamentos') },
  );

  const departments = departmentsData || [];
  const selectedDepartment = departments.find((department: any) => department.id === selectedDepartmentId) || null;

  useEffect(() => {
    if (!selectedDepartmentId && departments[0]?.id) setSelectedDepartmentId(departments[0].id);
    if (selectedDepartmentId && !departments.some((department: any) => department.id === selectedDepartmentId)) {
      setSelectedDepartmentId(departments[0]?.id || null);
    }
  }, [departments, selectedDepartmentId]);

  const filteredDepartments = useMemo(() => {
    const term = departmentSearch.trim().toLowerCase();
    if (!term) return departments;
    return departments.filter((department: any) => `${department.name}`.toLowerCase().includes(term));
  }, [departments, departmentSearch]);

  const departmentUsers = useMemo(() => {
    if (!selectedDepartment) return { assigned: [], available: [] };
    const term = memberSearch.trim().toLowerCase();
    const matches = users.filter((user: any) => !term || `${user.name} ${user.email}`.toLowerCase().includes(term));
    return {
      assigned: matches.filter((user: any) => getUserDepartmentIds(user).includes(selectedDepartment.id)),
      available: matches.filter((user: any) => !getUserDepartmentIds(user).includes(selectedDepartment.id)),
    };
  }, [memberSearch, selectedDepartment, users]);

  const createDepartment = async () => {
    const name = newDepartmentName.trim();
    if (!name) {
      toast.error('El nombre del grupo es obligatorio');
      return;
    }
    try {
      setCreating(true);
      await hrService.createDepartment({ name, type: 'ACCESS' });
      setNewDepartmentName('');
      await refetchDepartments();
      await onDataChange?.();
      toast.success('Departamento creado');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No se pudo crear el departamento');
    } finally {
      setCreating(false);
    }
  };

  const toggleUser = async (user: any) => {
    if (!selectedDepartment) return;
    const currentIds = getUserDepartmentIds(user);
    const isAssigned = currentIds.includes(selectedDepartment.id);
    const nextIds = isAssigned ? currentIds.filter((id: string) => id !== selectedDepartment.id) : [...currentIds, selectedDepartment.id];
    const primaryId = isAssigned
      ? (user.departmentId === selectedDepartment.id ? nextIds[0] || null : user.departmentId || nextIds[0] || null)
      : user.departmentId || selectedDepartment.id;

    try {
      setSavingKey(`user:${user.id}`);
      await tenantsService.updateUserDepartments(tenantId, user.id, nextIds, primaryId);
      await onDataChange?.();
      toast.success(isAssigned ? 'Usuario desvinculado del grupo' : 'Usuario vinculado al grupo');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No se pudo actualizar el grupo del usuario');
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
      toast.success('Departamento desactivado');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No se pudo desactivar el departamento');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="Volver a Mi Equipo"><ArrowLeft className="size-4" /></Button>
          <div className="min-w-0"><h2 className="truncate text-2xl font-black uppercase italic tracking-tight">Departamentos</h2><p className="text-xs text-muted-foreground">Agrupa usuarios para organizar el equipo. No modifica sus permisos ni accesos.</p></div>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 border-primary/20 text-primary"><Users className="size-3.5" /> {departments.length} {departments.length === 1 ? 'departamento' : 'departamentos'}</Badge>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0 text-primary" /><p>Estos departamentos solo agrupan usuarios de Mi Empresa. La pertenencia no cambia roles, permisos ni accesos. Los departamentos, puestos y vendedores de Recursos Humanos se administran por separado en RR. HH.</p></div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(250px,0.35fr)_minmax(0,0.65fr)]">
        <Card className="min-w-0 border-border/50">
          <CardHeader className="space-y-3 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider"><Building2 className="size-4 text-primary" /> Departamentos</CardTitle>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={departmentSearch} onChange={(event) => setDepartmentSearch(event.target.value)} placeholder="Buscar departamento..." className="h-9 pl-9 text-xs" aria-label="Buscar departamento" /></div>
            <div className="flex gap-2">
              <Input value={newDepartmentName} onChange={(event) => setNewDepartmentName(event.target.value)} placeholder="Nombre" className="h-9 text-xs" aria-label="Nombre del departamento" />
              <Button size="sm" className="h-9 gap-1.5" onClick={() => void createDepartment()} disabled={creating}><Plus className="size-3.5" /> Crear</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <p className="py-6 text-center text-xs text-muted-foreground">Cargando departamentos...</p>}
            {!isLoading && !filteredDepartments.length && <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No hay departamentos creados.</p>}
            {filteredDepartments.map((department: any) => <button key={department.id} type="button" onClick={() => setSelectedDepartmentId(department.id)} className={cn('flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors', selectedDepartment?.id === department.id ? 'border-primary/40 bg-primary/10' : 'border-border/40 bg-background/60 hover:bg-muted/40')}>
              <span className="flex min-w-0 items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-bold">{department.name}</span></span></span>
              <Badge variant="secondary" className="shrink-0 text-[9px]"><Users className="mr-1 size-3" />{departmentUsersFor(department, users).length} {departmentUsersFor(department, users).length === 1 ? 'usuario' : 'usuarios'}</Badge>
            </button>)}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/50">
          {!selectedDepartment ? <CardContent className="flex min-h-[300px] items-center justify-center p-6 text-center text-sm text-muted-foreground">Selecciona un departamento para administrar sus usuarios.</CardContent> : <>
            <CardHeader className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><CardTitle className="truncate text-lg font-black">{selectedDepartment.name}</CardTitle><CardDescription className="text-xs">Agrupador de usuarios; no modifica permisos ni accesos</CardDescription></div><Button variant="outline" size="sm" className="w-fit shrink-0 gap-1.5 border-rose-500/25 text-rose-600 hover:bg-rose-500/10" onClick={() => setDeleteDialogOpen(true)}><Trash2 className="size-3.5" /> Desactivar</Button></CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Buscar usuario por nombre o correo..." className="h-10 pl-9" aria-label="Buscar usuario del grupo" /></div>
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">{[
                { title: 'Usuarios vinculados', data: departmentUsers.assigned, assigned: true },
                { title: 'Usuarios disponibles', data: departmentUsers.available, assigned: false },
              ].map((section) => <div key={section.title} className="min-w-0 space-y-2"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{section.title}</p><Badge variant="secondary" className="text-[9px]">{section.data.length}</Badge></div><div className="max-h-[390px] space-y-2 overflow-y-auto pr-1">{!section.data.length && <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No hay usuarios en esta lista.</p>}{section.data.map((user: any) => { const busy = savingKey === `user:${user.id}`; return <div key={user.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-3"><div className="flex min-w-0 items-center gap-2"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">{user.name?.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-bold">{user.name}</p><p className="truncate text-[10px] text-muted-foreground">{user.email}</p><Badge variant="outline" className="mt-1 rounded-full text-[9px]">{getRoleLabel(user)}</Badge></div></div><Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 text-[10px] font-bold" disabled={busy} onClick={() => void toggleUser(user)}>{section.assigned ? <><Check className="size-3" /> Quitar</> : <><Plus className="size-3" /> Vincular</>}</Button></div>; })}</div></div>)}</div>
            </CardContent>
          </>}
        </Card>
      </div>

      <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} title="¿Desactivar departamento?" description={`Se desactivará ${selectedDepartment?.name || 'este departamento'}. Los vínculos históricos se conservarán.`} confirmLabel="Desactivar" onConfirm={deleteDepartment} loading={deleting} />
    </div>
  );
}
