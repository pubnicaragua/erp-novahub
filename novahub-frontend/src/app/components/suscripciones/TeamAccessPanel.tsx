import { useEffect, useMemo, useState } from 'react';
import { Check, Edit2, Eye, Info, Plus, ShieldCheck, Trash2, UserCog, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { rolesService } from '../../services/roles.service';
import { ALL_PERM_MODULES, normalizePermissions, SUBMODULES_FOR_PERMS } from '../ConfiguracionPage';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { allowedModulesFromPermissions, hydratePermissionActions, permissionValue, PERMISSION_ACTION_DEFINITIONS, SENSITIVE_PERMISSION_ACTION_DEFINITIONS, supportsInventoryCostPermission, supportsPermissionAction, type PermissionMatrixAction } from '../../utils/permissions';

interface TeamAccessPanelProps {
  tenantId: string;
  tenantName: string;
  users: any[];
  onRolesChange?: () => Promise<unknown> | void;
  canViewRoles?: boolean;
  canCreateRoles?: boolean;
  canEditRoles?: boolean;
  canDeleteRoles?: boolean;
}

const permissionActions = [...PERMISSION_ACTION_DEFINITIONS, ...SENSITIVE_PERMISSION_ACTION_DEFINITIONS];

const emptyPermissions = () => ALL_PERM_MODULES.map((module: any) => ({
  module: module.id,
  ...Object.fromEntries(permissionActions.map(({ key }) => [key, false])),
}));

const getPermissionGroupLabel = (group: string) => {
  const module = ALL_PERM_MODULES.find((item: any) => item.id === group) as any;
  return module?.label || group.replace(/_/g, ' ');
};

function PermissionHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary" aria-label="Información sobre las acciones de permisos">
          <Info className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-widest">¿Qué incluye cada acción?</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Las acciones se aplican a la vista de cada fila. "Aprobar" solo aparece donde existe un flujo de aprobación o transición.</p>
        </div>
        <div className="space-y-3 p-4">
          {permissionActions.map(({ key, label, description }) => (
            <div key={key} className="flex items-start gap-2.5">
              <span className={key === 'approve' ? 'mt-0.5 size-2 shrink-0 rounded-full bg-emerald-500' : 'mt-0.5 size-2 shrink-0 rounded-full bg-primary/60'} />
              <div className="min-w-0">
                <p className="text-xs font-bold">{label}</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function hydratePermissions(role: any) {
  const current = normalizePermissions(role?.permissions);
  return ALL_PERM_MODULES.map((module: any) => {
    const existing = current.find((permission: any) => String(permission.module || '').toUpperCase() === String(module.id).toUpperCase());
    return hydratePermissionActions(existing, module.id);
  });
}

export function TeamAccessPanel({ tenantId, tenantName, users, onRolesChange, canViewRoles = true, canCreateRoles = true, canEditRoles = true, canDeleteRoles = true }: TeamAccessPanelProps) {
  const [roles, setRoles] = useState<any[]>([]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [viewingRole, setViewingRole] = useState<any | null>(null);
  const [assignedUsersRole, setAssignedUsersRole] = useState<any | null>(null);

  const { data: teamData, refetch: refetchTeam } = useTenantQuery(
    ['my-company-team-access', tenantId],
    async (signal) => {
      const rolesResponse = await rolesService.getAll({ clientTenantId: tenantId }, signal);
      return {
        roles: asList(rolesResponse).filter((role: any) => !role.clientTenantId || role.clientTenantId === tenantId),
      };
    },
    { enabled: Boolean(tenantId && canViewRoles), onError: (error) => toast.error(error.message || 'No se pudo cargar la configuración del equipo') },
  );

  useEffect(() => {
    if (!teamData) return;
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

  const actionIsAvailable = (moduleId: string, action: PermissionMatrixAction) => action === 'viewCost'
    ? supportsInventoryCostPermission(moduleId)
    : supportsPermissionAction(moduleId, action);

  const isSectionFullyEnabled = (modules: any[]) => {
    const permissions = normalizePermissions(editingRole?.permissions);
    return modules.length > 0 && modules.every((module: any) => {
      const permission = permissions.find((item: any) => item.module === module.id) || {};
      return permissionActions.every(({ key }) => !actionIsAvailable(module.id, key) || permissionValue(permission, key));
    });
  };

  const toggleSectionPermissions = (modules: any[]) => {
    if ((!canEditRoles && !canCreateRoles) || !modules.length) return;
    const shouldEnable = !isSectionFullyEnabled(modules);
    const moduleIds = new Set(modules.map((module: any) => module.id));
    const legacyKeys = ['view', 'canView', 'write', 'deactivate', 'cancel', 'reject', 'reverse', 'canDelete', 'canDeactivate', 'canCancel', 'canReject', 'canReverse'];

    setEditingRole((current: any) => {
      if (!current) return current;
      const permissions = normalizePermissions(current.permissions).map((permission: any) => ({ ...permission }));
      permissions.forEach((permission: any) => {
        if (!moduleIds.has(permission.module)) return;
        permissionActions.forEach(({ key }) => {
          if (!actionIsAvailable(permission.module, key)) {
            if (key === 'approve') permission[key] = false;
            return;
          }
          permission[key] = shouldEnable;
        });
        permission.write = shouldEnable;
        if (!shouldEnable) legacyKeys.forEach((key) => { permission[key] = false; });
      });
      return { ...current, permissions };
    });
  };

  const openCreateRole = () => {
    if (!canCreateRoles) return;
    setEditingRole({ name: '', description: '', permissions: emptyPermissions() });
    setRoleDialogOpen(true);
  };

  const openEditRole = (role: any) => {
    if (!canEditRoles) return;
    setEditingRole({ ...role, permissions: hydratePermissions(role) });
    setRoleDialogOpen(true);
  };

  const openViewRole = (role: any) => setViewingRole({ ...role, permissions: hydratePermissions(role) });
  const openAssignedUsers = (role: any) => setAssignedUsersRole(role);

  const togglePermission = (moduleId: string, action: PermissionMatrixAction) => {
    if ((!canEditRoles && !canCreateRoles) || !actionIsAvailable(moduleId, action)) return;
    setEditingRole((current: any) => {
      if (!current) return current;
      const permissions = normalizePermissions(current.permissions).map((permission: any) => ({ ...permission }));
      const target = permissions.find((permission: any) => permission.module === moduleId);
      if (!target) return current;
      const nextValue = !permissionValue(target, action);
      if (action === 'read' && !nextValue && permissionActions.some(({ key }) => key !== 'read' && permissionValue(target, key))) return current;
      target[action] = nextValue;
      if (action !== 'read' && nextValue) target.read = true;

      const childModules = SUBMODULES_FOR_PERMS.filter((module: any) => module.parent === moduleId);
      childModules.forEach((child: any) => {
        if (!actionIsAvailable(child.id, action)) return;
        const childPermission = permissions.find((permission: any) => permission.module === child.id);
        if (!childPermission) return;
        childPermission[action] = nextValue;
        if (action !== 'read' && nextValue) childPermission.read = true;
        if (action === 'read' && !nextValue) {
          permissionActions.filter(({ key }) => key !== 'read').forEach(({ key }) => { childPermission[key] = false; });
          childPermission.write = false;
        }
      });

      const childDefinition = SUBMODULES_FOR_PERMS.find((module: any) => module.id === moduleId);
      if (childDefinition) {
        const parentPermission = permissions.find((permission: any) => permission.module === childDefinition.parent);
        const siblings = SUBMODULES_FOR_PERMS.filter((module: any) => module.parent === childDefinition.parent);
        const siblingPermissions = siblings.map((sibling: any) => permissions.find((permission: any) => permission.module === sibling.id)).filter(Boolean);
        if (parentPermission && actionIsAvailable(childDefinition.parent, action) && siblingPermissions.length > 0) {
          parentPermission[action] = siblingPermissions.every((permission: any) => permissionValue(permission, action));
          if (action !== 'read') parentPermission.read = siblingPermissions.every((permission: any) => permissionValue(permission, 'read'));
        }
      }

      return { ...current, permissions };
    });
  };

  const saveRole = async () => {
    if (!editingRole || (editingRole.id ? !canEditRoles : !canCreateRoles)) return;
    const name = String(editingRole?.name || '').trim();
    if (!name) return toast.error('El nombre del rol es obligatorio');
    setRoleSaving(true);
    try {
      const permissions = normalizePermissions(editingRole.permissions).map((permission: any) => ({
        ...permission,
        write: !!(permission.create || permission.edit || permission.write),
        ...Object.fromEntries(permissionActions.filter(({ key }) => key !== 'read').map(({ key }) => [key, permissionValue(permission, key)])),
      }));
      const payload = {
        name,
        description: String(editingRole.description || '').trim(),
        permissions,
        allowedModules: allowedModulesFromPermissions(permissions),
        clientTenantId: tenantId,
      };
      if (editingRole.id) await rolesService.update(editingRole.id, payload);
      else await rolesService.create(payload);
      toast.success(editingRole.id ? 'Rol actualizado' : 'Rol creado');
      setRoleDialogOpen(false);
      setEditingRole(null);
      await load();
      await onRolesChange?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al guardar el rol');
    } finally {
      setRoleSaving(false);
    }
  };

  const deleteRole = async (role: any) => {
    if (!canDeleteRoles) return;
    if (role.isSystemRole) return toast.error('Los roles del sistema no se pueden eliminar');
    try {
      await rolesService.delete(role.id);
      toast.success('Rol eliminado');
      await load();
      await onRolesChange?.();
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
            {canCreateRoles && <Button size="sm" onClick={openCreateRole} className="h-8 gap-1.5 text-xs"><Plus className="size-3.5" /> Nuevo rol</Button>}
          </CardHeader>
          <CardContent className="space-y-2">
            {!roles.length && <p className="py-5 text-center text-xs text-muted-foreground">Sin roles personalizados</p>}
            {roles.map((role: any) => (
              <div key={role.id || role.name} className="flex items-center justify-between gap-3 rounded-lg bg-muted/20 px-4 py-3 text-xs">
                <div className="min-w-0"><p className="truncate font-bold">{role.name}</p><p className="truncate text-[10px] text-muted-foreground">{role.description || 'Sin descripción'}</p></div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant="secondary" className="text-[9px]">{normalizePermissions(role.permissions).filter((permission: any) => permission.read).length} módulos</Badge>
                  <Badge variant="outline" className="text-[9px]">{users.filter((user: any) => user.customRoleId === role.id).length} usuarios</Badge>
                  {canViewRoles && <Button variant="ghost" size="icon" className="size-7" onClick={() => openViewRole(role)} title="Ver permisos"><Eye className="size-3.5" /></Button>}
                  {canViewRoles && <Button variant="ghost" size="icon" className="size-7" onClick={() => openAssignedUsers(role)} title="Ver usuarios asignados"><Users className="size-3.5" /></Button>}
                  {canEditRoles && <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditRole(role)} title="Editar permisos"><Edit2 className="size-3.5" /></Button>}
                  {canDeleteRoles && <Button variant="ghost" size="icon" className="size-7 text-rose-500" disabled={role.isSystemRole} onClick={() => void deleteRole(role)} title="Eliminar rol"><Trash2 className="size-3.5" /></Button>}
                </div>
              </div>
            ))}
          </CardContent>
      </Card>

      <Dialog open={!!viewingRole} onOpenChange={(open) => !open && setViewingRole(null)}>
        <DialogContent className="flex h-[90vh] w-[96vw] max-w-[calc(100%-1rem)] flex-col overflow-hidden p-0 sm:!max-w-6xl">
          <DialogHeader className="shrink-0 border-b border-border/50 bg-card px-6 py-5">
            <div className="flex items-center justify-between gap-3"><DialogTitle className="flex items-center gap-2 text-xl font-black"><Eye className="size-5 text-primary" /> Permisos del rol: {viewingRole?.name}</DialogTitle><PermissionHelp /></div>
            <DialogDescription className="text-sm">{viewingRole?.description || 'Revisa los módulos y acciones habilitadas para este rol.'}</DialogDescription>
          </DialogHeader>
          <div className="relative min-h-0 flex-1 overflow-auto px-6 pt-0 pb-5">
            <div className="min-w-[1040px] rounded-xl border border-border/50">
              <div className="isolate sticky top-0 z-[100] grid min-w-[1040px] items-center gap-1.5 border-b border-border bg-card px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-md" style={{ gridTemplateColumns: `minmax(240px,1fr) repeat(${permissionActions.length},88px)` }}>
                <span>Módulo</span>{permissionActions.map(({ key, label }) => <span key={key} className="text-center">{label}</span>)}
              </div>
              {Object.entries(groupedModules).map(([group, modules]) => <div key={group} className="border-b border-border last:border-b-0">
                <div className="bg-muted px-5 py-3 text-xs font-black uppercase tracking-widest text-primary">{getPermissionGroupLabel(group)}</div>
                {(modules as any[]).map((module: any) => {
                  const permission = normalizePermissions(viewingRole?.permissions).find((item: any) => item.module === module.id) || {};
                  return <div key={module.id} className="grid min-w-[1040px] items-center gap-1.5 border-t border-border/40 px-5 py-3.5 text-sm" style={{ gridTemplateColumns: `minmax(240px,1fr) repeat(${permissionActions.length},88px)` }}>
                    <span className={module.parent ? 'pl-5 text-muted-foreground' : 'font-bold'}>{module.label}</span>
                    {permissionActions.map(({ key }) => <div key={key} className="flex justify-center">
                      {!actionIsAvailable(module.id, key) ? <span className="text-muted-foreground/20" aria-label="No aplica">—</span> : permissionValue(permission, key) ? <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-500"><Check className="mr-1 size-3" />Sí</Badge> : <span className="text-muted-foreground/30">—</span>}
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
        <DialogContent className="flex h-[90vh] w-[96vw] max-w-[calc(100%-1rem)] flex-col overflow-hidden p-0 sm:!max-w-6xl">
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
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/20 px-6 py-3">
            <div className="flex min-w-0 items-start gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-foreground">Matriz de permisos por módulo y vista</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Cada fila representa una vista. Desplázate horizontalmente para revisar todas las acciones.</p>
              </div>
            </div>
            <PermissionHelp />
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest">{ALL_PERM_MODULES.length} vistas · {permissionActions.length} acciones</Badge>
          </div>
          <div data-tour="role-permissions" className="relative min-h-0 flex-1 overflow-auto px-6 pt-0 pb-5">
            <div className="min-w-[1040px] rounded-xl border border-border/50">
              <div className="isolate sticky top-0 z-[100] grid min-w-[1040px] items-center gap-1.5 border-b border-border bg-card px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground shadow-md" style={{ gridTemplateColumns: `minmax(240px,1fr) repeat(${permissionActions.length},88px)` }}>
                <span>Módulo</span>{permissionActions.map(({ key, label }) => <span key={key} className="text-center">{label}</span>)}
              </div>
              {Object.entries(groupedModules).map(([group, modules]) => <div key={group} className="border-b border-border last:border-b-0">
                <div className="flex items-center justify-between gap-4 bg-muted px-5 py-3">
                  <span className="text-xs font-black uppercase tracking-widest text-primary">{getPermissionGroupLabel(group)}</span>
                  <label className="flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <span>{isSectionFullyEnabled(modules as any[]) ? 'Todos habilitados' : 'Habilitar todos'}</span>
                    <Switch
                      aria-label={`${isSectionFullyEnabled(modules as any[]) ? 'Deshabilitar' : 'Habilitar'} todos los permisos de ${getPermissionGroupLabel(group)}`}
                      checked={isSectionFullyEnabled(modules as any[])}
                      onCheckedChange={() => toggleSectionPermissions(modules as any[])}
                    />
                  </label>
                </div>
                {(modules as any[]).map((module: any) => {
                  const permission = normalizePermissions(editingRole?.permissions).find((item: any) => item.module === module.id) || {};
                  return <div key={module.id} className="grid min-w-[1040px] items-center gap-1.5 border-t border-border/40 px-5 py-3.5 text-sm" style={{ gridTemplateColumns: `minmax(240px,1fr) repeat(${permissionActions.length},88px)` }}><span className={module.parent ? 'pl-5 text-muted-foreground' : 'font-bold'}>{module.label}</span>{permissionActions.map(({ key, label }) => <div key={key} className={`flex justify-center ${key === 'viewCost' ? 'border-l border-rose-500/20' : ''}`}>{!actionIsAvailable(module.id, key) ? <span className="text-muted-foreground/20" aria-label="No aplica">—</span> : <Switch aria-label={`${module.label}: ${label}`} checked={permissionValue(permission, key)} onCheckedChange={() => togglePermission(module.id, key)} className={key === 'viewCost' ? 'data-[state=checked]:bg-rose-500' : undefined} />}</div>)}</div>;
                })}
              </div>)}
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border/50 bg-card px-6 py-4"><Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancelar</Button>{(editingRole?.id ? canEditRoles : canCreateRoles) && <Button onClick={() => void saveRole()} disabled={roleSaving}>{roleSaving ? 'Guardando...' : 'Guardar rol'}</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
