import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Edit2, Eye, Plus, ShieldCheck, Trash2, UserCog, Users, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { rolesService } from '../../services/roles.service';
import { tenantsService } from '../../services/tenants.service';
import { ALL_PERM_MODULES, normalizePermissions } from '../ConfiguracionPage';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';

interface TeamAccessPanelProps {
  tenantId: string;
  tenantName: string;
  users: any[];
  departmentDialogOpen: boolean;
  onDepartmentDialogChange: (open: boolean) => void;
  onRolesChange?: () => void;
  onUsersChange?: () => void;
}

const permissionActions = ['read', 'create', 'edit', 'delete'] as const;
type PermissionAction = typeof permissionActions[number];

const emptyPermissions = () => ALL_PERM_MODULES.map((module: any) => ({
  module: module.id,
  read: false,
  create: false,
  edit: false,
  delete: false,
}));

const getPermissionGroupLabel = (group: string) => {
  const module = ALL_PERM_MODULES.find((item: any) => item.id === group) as any;
  return module?.label || group.replace(/_/g, ' ');
};

function hydratePermissions(role: any) {
  const current = normalizePermissions(role?.permissions);
  return ALL_PERM_MODULES.map((module: any) => {
    const existing = current.find((permission: any) => String(permission.module || '').toUpperCase() === String(module.id).toUpperCase());
    return {
      module: module.id,
      read: !!existing?.read,
      create: existing?.create !== undefined ? !!existing.create : !!existing?.write,
      edit: existing?.edit !== undefined ? !!existing.edit : !!existing?.write,
      delete: !!existing?.delete,
    };
  });
}

export function TeamAccessPanel({ tenantId, tenantName, users, departmentDialogOpen, onDepartmentDialogChange, onRolesChange, onUsersChange }: TeamAccessPanelProps) {
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [newDepartment, setNewDepartment] = useState('');
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [viewingRole, setViewingRole] = useState<any | null>(null);
  const [assignedUsersRole, setAssignedUsersRole] = useState<any | null>(null);

  const { data: teamData, refetch: refetchTeam } = useTenantQuery(
    ['my-company-team-access', tenantId],
    async (signal) => {
      const [departmentsResponse, rolesResponse] = await Promise.all([
        api.get<any>('/hr/departments', { signal }),
        rolesService.getAll({ clientTenantId: tenantId }, signal),
      ]);
      return {
        departments: asList(departmentsResponse),
        roles: asList(rolesResponse).filter((role: any) => !role.clientTenantId || role.clientTenantId === tenantId),
      };
    },
    { enabled: Boolean(tenantId), onError: (error) => toast.error(error.message || 'No se pudo cargar la configuración del equipo') },
  );

  useEffect(() => {
    if (!teamData) return;
    setDepartments(teamData.departments);
    setRoles(teamData.roles);
  }, [teamData]);

  const load = async () => {
    try {
      await refetchTeam();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No se pudo cargar la configuración del equipo');
    }
  };

  const groupedModules = useMemo(() => ALL_PERM_MODULES.reduce((groups: Record<string, any[]>, module: any) => {
    const group = module.parent || module.id;
    (groups[group] ||= []).push(module);
    return groups;
  }, {}), []);

  const createDepartment = async () => {
    const name = newDepartment.trim();
    if (!name) return toast.error('Escribe el nombre del departamento');
    try {
      const code = `DEPT-${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}${Math.floor(Math.random() * 100)}`;
      await api.post('/hr/departments', { name, code, tenantId });
      setNewDepartment('');
      toast.success('Departamento creado');
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al crear departamento');
    }
  };

  const deleteDepartment = async (id: string) => {
    try {
      await api.delete(`/hr/departments/${id}`);
      toast.success('Departamento eliminado');
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al eliminar departamento');
    }
  };

  const assignUserDepartment = async (userId: string, departmentId: string) => {
    try {
      await tenantsService.updateUser(tenantId, userId, { departmentId: departmentId === 'none' ? null : departmentId } as any);
      toast.success('Departamento asignado');
      onUsersChange?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al asignar departamento');
    }
  };

  const openCreateRole = () => {
    setEditingRole({ name: '', description: '', permissions: emptyPermissions() });
    setRoleDialogOpen(true);
  };

  const openEditRole = (role: any) => {
    setEditingRole({ ...role, permissions: hydratePermissions(role) });
    setRoleDialogOpen(true);
  };

  const openViewRole = (role: any) => setViewingRole({ ...role, permissions: hydratePermissions(role) });
  const openAssignedUsers = (role: any) => setAssignedUsersRole(role);

  const togglePermission = (moduleId: string, action: PermissionAction) => {
    setEditingRole((current: any) => {
      if (!current) return current;
      const permissions = normalizePermissions(current.permissions).map((permission: any) => ({ ...permission }));
      const target = permissions.find((permission: any) => permission.module === moduleId);
      if (!target) return current;
      const nextValue = !target[action];
      if (action === 'read' && !nextValue && (target.create || target.edit || target.delete)) return current;
      target[action] = nextValue;
      if (action !== 'read' && nextValue) target.read = true;
      return { ...current, permissions };
    });
  };

  const saveRole = async () => {
    const name = String(editingRole?.name || '').trim();
    if (!name) return toast.error('El nombre del rol es obligatorio');
    setRoleSaving(true);
    try {
      const permissions = normalizePermissions(editingRole.permissions).map((permission: any) => ({
        ...permission,
        write: !!(permission.create || permission.edit || permission.write),
      }));
      const payload = {
        name,
        description: String(editingRole.description || '').trim(),
        permissions,
        allowedModules: permissions.filter((permission: any) => permission.read).map((permission: any) => permission.module),
        clientTenantId: tenantId,
      };
      if (editingRole.id) await rolesService.update(editingRole.id, payload);
      else await rolesService.create(payload);
      toast.success(editingRole.id ? 'Rol actualizado' : 'Rol creado');
      setRoleDialogOpen(false);
      setEditingRole(null);
      await load();
      onRolesChange?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al guardar el rol');
    } finally {
      setRoleSaving(false);
    }
  };

  const deleteRole = async (role: any) => {
    if (role.isSystemRole) return toast.error('Los roles del sistema no se pueden eliminar');
    try {
      await rolesService.delete(role.id);
      toast.success('Rol eliminado');
      await load();
      onRolesChange?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al eliminar rol');
    }
  };

  return (
    <div className="h-full" data-tour="team-roles">
      <Card className="h-full border-border/50">
          <CardHeader className="flex-row items-center justify-between gap-4 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider"><UserCog className="size-4 text-primary" /> Roles ({roles.length})</CardTitle>
              <CardDescription className="mt-1 text-xs">Define los permisos que tendrá cada grupo de usuarios.</CardDescription>
            </div>
            <Button size="sm" onClick={openCreateRole} className="h-8 gap-1.5 text-xs"><Plus className="size-3.5" /> Nuevo rol</Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {!roles.length && <p className="py-5 text-center text-xs text-muted-foreground">Sin roles personalizados</p>}
            {roles.map((role: any) => (
              <div key={role.id || role.name} className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 px-4 py-3 text-xs">
                <div className="min-w-0"><p className="truncate font-bold">{role.name}</p><p className="truncate text-[10px] text-muted-foreground">{role.description || 'Sin descripción'}</p></div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant="secondary" className="text-[9px]">{normalizePermissions(role.permissions).filter((permission: any) => permission.read).length} módulos</Badge>
                  <Badge variant="outline" className="text-[9px]">{users.filter((user: any) => user.customRoleId === role.id).length} usuarios</Badge>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openViewRole(role)} title="Ver permisos"><Eye className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openAssignedUsers(role)} title="Ver usuarios asignados"><Users className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditRole(role)} title="Editar permisos"><Edit2 className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-7 text-rose-500" disabled={role.isSystemRole} onClick={() => void deleteRole(role)} title="Eliminar rol"><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
      </Card>

      <Dialog open={departmentDialogOpen} onOpenChange={onDepartmentDialogChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="size-5 text-primary" /> Departamentos</DialogTitle>
            <DialogDescription>Crea departamentos y asigna cada usuario al área que le corresponde.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex gap-2">
              <Input value={newDepartment} onChange={(event) => setNewDepartment(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void createDepartment()} placeholder="Nuevo departamento..." className="h-10" />
              <Button onClick={() => void createDepartment()} className="h-10 shrink-0 gap-2"><Plus className="size-4" /> Crear</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {!departments.length && <p className="text-xs text-muted-foreground">Sin departamentos creados.</p>}
              {departments.map((department: any) => <Badge key={department.id || department.name} variant="secondary" className="gap-1.5 py-1.5 pl-3 pr-1.5 text-xs">
                {department.name}
                <Button variant="ghost" size="icon" className="size-5 text-rose-500 hover:bg-rose-500/10" onClick={() => void deleteDepartment(department.id)} title="Eliminar departamento"><X className="size-3" /></Button>
              </Badge>)}
            </div>
            <div className="space-y-2 rounded-xl border border-border/50 p-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><Users className="size-3.5" /> Asignar usuarios</div>
              {!users.length && <p className="py-4 text-center text-xs text-muted-foreground">Crea usuarios desde el panel izquierdo.</p>}
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {users.map((user: any) => <div key={user.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 px-3 py-2">
                  <div className="min-w-0"><p className="truncate text-xs font-bold">{user.name}</p><p className="truncate text-[10px] text-muted-foreground">{user.email}</p></div>
                  <Select value={user.departmentId || 'none'} onValueChange={(value) => void assignUserDepartment(user.id, value)}>
                    <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Sin departamento" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin departamento</SelectItem>
                      {departments.map((department: any) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>)}
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => onDepartmentDialogChange(false)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingRole} onOpenChange={(open) => !open && setViewingRole(null)}>
        <DialogContent className="flex h-[90vh] w-[96vw] max-w-6xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border/50 bg-card px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-xl font-black"><Eye className="size-5 text-primary" /> Permisos del rol: {viewingRole?.name}</DialogTitle>
            <DialogDescription className="text-sm">{viewingRole?.description || 'Revisa los módulos y acciones habilitadas para este rol.'}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="overflow-hidden rounded-xl border border-border/50">
              <div className="sticky top-0 z-20 grid grid-cols-[minmax(130px,1fr)_repeat(4,64px)] items-center gap-1.5 border-b border-border bg-muted px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <span>Módulo</span><span className="text-center">Ver</span><span className="text-center">Crear</span><span className="text-center">Editar</span><span className="text-center">Borrar</span>
              </div>
              {Object.entries(groupedModules).map(([group, modules]) => <div key={group} className="border-b border-border last:border-b-0">
                <div className="bg-muted px-5 py-3 text-xs font-black uppercase tracking-widest text-primary">{getPermissionGroupLabel(group)}</div>
                {(modules as any[]).map((module: any) => {
                  const permission = normalizePermissions(viewingRole?.permissions).find((item: any) => item.module === module.id) || {};
                  return <div key={module.id} className="grid grid-cols-[minmax(130px,1fr)_repeat(4,64px)] items-center gap-1.5 border-t border-border/40 px-5 py-3.5 text-sm">
                    <span className={module.parent ? 'pl-5 text-muted-foreground' : 'font-bold'}>{module.label}</span>
                    {permissionActions.map((action) => <div key={action} className="flex justify-center">
                      {permission[action] ? <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]"><Check className="mr-1 size-3" />Sí</Badge> : <span className="text-muted-foreground/30">—</span>}
                    </div>)}
                  </div>;
                })}
              </div>)}
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border/50 bg-card px-6 py-4"><Button variant="outline" onClick={() => setViewingRole(null)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignedUsersRole} onOpenChange={(open) => !open && setAssignedUsersRole(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="size-5 text-primary" /> Usuarios con el rol {assignedUsersRole?.name}</DialogTitle>
            <DialogDescription>Usuarios que tienen asignado este rol personalizado.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto py-2">
            {users.filter((user: any) => user.customRoleId === assignedUsersRole?.id).map((user: any) => <div key={user.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
              <div><p className="text-sm font-bold">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div>
              <Badge variant="outline" className="text-[9px] uppercase">{user.isActive ? 'Activo' : 'Suspendido'}</Badge>
            </div>)}
            {!users.some((user: any) => user.customRoleId === assignedUsersRole?.id) && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Ningún usuario tiene este rol asignado.</div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAssignedUsersRole(null)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleDialogOpen} onOpenChange={(open) => { setRoleDialogOpen(open); if (!open) setEditingRole(null); }}>
        <DialogContent className="flex h-[90vh] w-[96vw] max-w-6xl flex-col overflow-hidden p-0">
          <DialogHeader className="sticky top-0 z-30 shrink-0 border-b border-border/50 bg-card px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl font-black"><ShieldCheck className="size-5 text-primary" /> {editingRole?.id ? 'Editar rol' : 'Nuevo rol'}</DialogTitle>
                <DialogDescription className="mt-1 text-sm">Define qué módulos y acciones podrá utilizar este rol dentro de {tenantName}.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="grid shrink-0 gap-4 border-b border-border/50 bg-background px-6 py-5 md:grid-cols-2">
            <Input data-tour="role-name" value={editingRole?.name || ''} onChange={(event) => setEditingRole((current: any) => ({ ...current, name: event.target.value }))} placeholder="Nombre del rol" className="h-11" />
            <Input data-tour="role-description" value={editingRole?.description || ''} onChange={(event) => setEditingRole((current: any) => ({ ...current, description: event.target.value }))} placeholder="Descripción (opcional)" className="h-11" />
          </div>
          <div data-tour="role-permissions" className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="overflow-hidden rounded-xl border border-border/50">
              <div className="sticky top-0 z-20 grid grid-cols-[minmax(130px,1fr)_repeat(4,64px)] items-center gap-1.5 border-b border-border bg-muted px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <span>Módulo</span><span className="text-center">Ver</span><span className="text-center">Crear</span><span className="text-center">Editar</span><span className="text-center">Borrar</span>
              </div>
              {Object.entries(groupedModules).map(([group, modules]) => <div key={group} className="border-b border-border last:border-b-0">
                <div className="bg-muted px-5 py-3 text-xs font-black uppercase tracking-widest text-primary">{getPermissionGroupLabel(group)}</div>
                {(modules as any[]).map((module: any) => {
                  const permission = normalizePermissions(editingRole?.permissions).find((item: any) => item.module === module.id) || {};
                  return <div key={module.id} className="grid grid-cols-[minmax(130px,1fr)_repeat(4,64px)] items-center gap-1.5 border-t border-border/40 px-5 py-3.5 text-sm"><span className={module.parent ? 'pl-5 text-muted-foreground' : 'font-bold'}>{module.label}</span>{permissionActions.map((action) => <div key={action} className="flex justify-center"><Switch checked={!!permission[action]} onCheckedChange={() => togglePermission(module.id, action)} /></div>)}</div>;
                })}
              </div>)}
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border/50 bg-card px-6 py-4"><Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancelar</Button><Button onClick={() => void saveRole()} disabled={roleSaving}>{roleSaving ? 'Guardando...' : 'Guardar rol'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
