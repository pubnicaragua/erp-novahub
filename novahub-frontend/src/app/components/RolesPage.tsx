import React, { useState, useEffect } from 'react';
import { Shield, Users, Plus, Search, Edit, Trash2, Eye, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { rolesService } from '../services/roles.service';
import { usersService } from '../services/users.service';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import {
  SALES_SUBMODULES,
  PURCHASES_SUBMODULES,
  INVENTORY_SUBMODULES,
  FINANCIAL_SUBMODULES,
  HR_SUBMODULES,
  NOTIFICATIONS_SUBMODULES,
  ACTIVITIES_SUBMODULES,
  DOCUMENTS_SUBMODULES,
  REPORTS_SUBMODULES,
} from '../types/modules';

const SYSTEM_ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'employee', label: 'Empleado' },
  { value: 'viewer', label: 'Visualizador' },
];

// Module groups for the allowedModules selector
const MODULE_GROUPS = [
  { id: 'SALES', label: 'Ventas', submodules: SALES_SUBMODULES },
  { id: 'PURCHASES', label: 'Compras', submodules: PURCHASES_SUBMODULES },
  { id: 'INVENTORY', label: 'Inventario', submodules: INVENTORY_SUBMODULES },
  { id: 'FINANCIAL', label: 'Finanzas', submodules: FINANCIAL_SUBMODULES },
  { id: 'HR', label: 'Recursos Humanos', submodules: HR_SUBMODULES },
  { id: 'ACTIVITIES', label: 'Actividades', submodules: ACTIVITIES_SUBMODULES },
  { id: 'DOCUMENTS', label: 'Documentos', submodules: DOCUMENTS_SUBMODULES },
  { id: 'TICKETS', label: 'Tickets', submodules: [] },
  { id: 'NOTIFICATIONS', label: 'Notificaciones', submodules: NOTIFICATIONS_SUBMODULES },
  { id: 'REPORTS', label: 'Reportes', submodules: REPORTS_SUBMODULES },
  { id: 'CONFIGURATION', label: 'Configuración', submodules: [] },
];

const MODULES = ['Ventas', 'Compras', 'Inventario', 'Finanzas', 'RRHH', 'Clientes', 'Proveedores', 'Actividades', 'Tickets', 'Documentos', 'Notificaciones', 'Transferencias', 'Reportes', 'Roles', 'Configuracion', 'Schema'];

export function RolesPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [rolesData, setRolesData] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const emptyRole: any = {
    name: '',
    description: '',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    permissions: MODULES.map(m => ({ module: m, read: false, write: false, delete: false })),
    allowedModules: [] as string[],
  };

  const [roleForm, setRoleForm] = useState<any>(emptyRole);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesRes, usersRes] = await Promise.all([
        rolesService.getAll({ clientTenantId: user?.tenantId }),
        usersService.getAll()
      ]);
      let rolesList = Array.isArray(rolesRes) ? rolesRes : (rolesRes as any)?.data || [];
      // Asegurar aislamiento frontend por si el backend no lo filtra
      if (!user?.isPlatformAdmin) {
        rolesList = rolesList.filter((r: any) => r.clientTenantId === user?.tenantId || r.isSystemRole);
      }
      setRolesData(rolesList);
      
      let usersList = Array.isArray(usersRes) ? usersRes : ((usersRes as any)?.data || []);
      // Filtrar usuarios por tenant si no es platform admin
      if (!user?.isPlatformAdmin) {
        usersList = usersList.filter((u: any) => u.clientTenantId === user?.tenantId);
      }
      
      setUsers((usersList || []).map((u: any) => ({
        ...u,
        role: String(u.role || 'employee').toLowerCase(),
      })));
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserRoleChange = async (userId: string, role: string) => {
    const previousUsers = [...users];
    setUsers(users.map(user => user.id === userId ? { ...user, role: role as any } : user));
    try {
      await usersService.update(userId, { role: role.toUpperCase() as any });
      toast.success('Rol actualizado correctamente');
    } catch (error) {
      setUsers(previousUsers);
      toast.error('No se pudo actualizar el rol');
      console.error('Error updating user role:', error);
    }
  };

  const filteredRoles = rolesData.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(usr =>
    usr.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usr.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenNew = () => {
    setRoleForm({ ...emptyRole });
    setIsEditing(false);
    setExpandedGroups({});
    setIsRoleModalOpen(true);
  };

  const handleOpenEdit = (role: any) => {
    setRoleForm({ ...role, allowedModules: role.allowedModules || [] });
    setIsEditing(true);
    setExpandedGroups({});
    setIsRoleModalOpen(true);
  };

  const handleDeleteRole = async (id: string) => {
    try {
      if (window.confirm('¿Estás seguro de eliminar este rol? Los usuarios asignados serán desvinculados.')) {
        await rolesService.delete(id);
        toast.success('Rol eliminado correctamente');
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al eliminar rol');
    }
  };

  const handleSaveRole = async () => {
    if (!roleForm.name?.trim()) {
      toast.error('El nombre del rol es requerido');
      return;
    }
    try {
      const payload = {
        name: roleForm.name,
        description: roleForm.description,
        color: roleForm.color,
        permissions: roleForm.permissions,
        allowedModules: roleForm.allowedModules || [],
        clientTenantId: user?.tenantId // Asegurar que el rol se asocie al tenant actual
      };
      if (isEditing && roleForm.id) {
        await rolesService.update(roleForm.id, payload);
        toast.success('Rol actualizado correctamente');
      } else {
        await rolesService.create(payload);
        toast.success('Rol creado correctamente');
      }
      setIsRoleModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al guardar rol');
    }
  };

  const updatePerm = (module: string, field: 'read' | 'write' | 'delete', val: boolean) => {
    setRoleForm((prev: any) => ({
      ...prev,
      permissions: (prev.permissions || []).map((p: any) => p.module === module ? { ...p, [field]: val } : p)
    }));
  };

  // Toggle a single module ID in allowedModules
  const toggleAllowedModule = (moduleId: string) => {
    setRoleForm((prev: any) => {
      const current = prev.allowedModules || [];
      const isIncluded = current.includes(moduleId);
      return {
        ...prev,
        allowedModules: isIncluded
          ? current.filter((m: string) => m !== moduleId)
          : [...current, moduleId],
      };
    });
  };

  // Toggle all submodules in a group
  const toggleGroupModules = (group: typeof MODULE_GROUPS[0]) => {
    const allIds = group.submodules.length > 0
      ? group.submodules.map(s => s.id)
      : [group.id];
    const current = roleForm.allowedModules || [];
    const allSelected = allIds.every((id: string) => current.includes(id));

    setRoleForm((prev: any) => ({
      ...prev,
      allowedModules: allSelected
        ? (prev.allowedModules || []).filter((m: string) => !allIds.includes(m))
        : [...new Set([...(prev.allowedModules || []), ...allIds])],
    }));
  };

  const totalUsers = users.length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card/80 backdrop-blur-md p-5 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
            <Shield className="size-7 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Gestión de Roles y Permisos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Administra accesos, define permisos granulares y asigna roles a los operadores.
            </p>
          </div>
        </div>
        <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenNew} className="gap-2 bg-purple-600 hover:bg-purple-700 !text-white shadow-md shadow-purple-500/20">
              <Plus className="size-4" />
              Crear Rol
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditing ? `Editar Rol: ${roleForm.name}` : 'Crear Nuevo Rol'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Actualiza los permisos y accesos del rol.' : 'Define un nuevo rol con permisos y módulos permitidos'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nombre">Nombre del Rol</Label>
                <Input id="nombre" value={roleForm.name} onChange={e => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="Ej: Contador, Supervisor..." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Input id="descripcion" value={roleForm.description} onChange={e => setRoleForm({ ...roleForm, description: e.target.value })} placeholder="Describe las responsabilidades de este rol" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="color">Color de Identificación</Label>
                <Select value={roleForm.color} onValueChange={v => setRoleForm({ ...roleForm, color: v })}>
                  <SelectTrigger id="color">
                    <SelectValue placeholder="Selecciona un color" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text-red-400 bg-red-500/10 border-red-500/20">Rojo</SelectItem>
                    <SelectItem value="text-blue-400 bg-blue-500/10 border-blue-500/20">Azul</SelectItem>
                    <SelectItem value="text-green-400 bg-green-500/10 border-green-500/20">Verde</SelectItem>
                    <SelectItem value="text-purple-400 bg-purple-500/10 border-purple-500/20">Púrpura</SelectItem>
                    <SelectItem value="text-orange-400 bg-orange-500/10 border-orange-500/20">Naranja</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ─── Módulos Permitidos ─── */}
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold">Módulos Permitidos</Label>
                  <Badge variant="outline" className="text-xs">
                    {(roleForm.allowedModules || []).length} seleccionados
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Selecciona a qué partes del sistema tendrán acceso los usuarios con este rol. Solo verán los módulos que estén habilitados aquí <strong>y</strong> en la suscripción de la empresa.
                </p>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {MODULE_GROUPS.map(group => {
                    const allIds = group.submodules.length > 0
                      ? group.submodules.map(s => s.id)
                      : [group.id];
                    const currentModules = roleForm.allowedModules || [];
                    const selectedCount = allIds.filter((id: string) => currentModules.includes(id)).length;
                    const allSelected = selectedCount === allIds.length;
                    const isExpanded = expandedGroups[group.id] || false;

                    return (
                      <div key={group.id}>
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setExpandedGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                        >
                          <div className="flex items-center gap-3">
                            {group.submodules.length > 0 ? (
                              isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />
                            ) : (
                              <div className="size-4" />
                            )}
                            <span className="font-medium text-sm">{group.label}</span>
                            {selectedCount > 0 && (
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]">
                                {selectedCount}/{allIds.length}
                              </Badge>
                            )}
                          </div>
                          <Switch
                            checked={allSelected}
                            onCheckedChange={(e) => {
                              e; // consume event
                              toggleGroupModules(group);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        {isExpanded && group.submodules.length > 0 && (
                          <div className="pl-10 pr-3 pb-3 space-y-1">
                            {group.submodules.map(sub => (
                              <div key={sub.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-muted/20 transition-colors">
                                <div>
                                  <p className="text-sm font-medium">{sub.label}</p>
                                  <p className="text-xs text-muted-foreground">{sub.description}</p>
                                </div>
                                <Switch
                                  checked={currentModules.includes(sub.id)}
                                  onCheckedChange={() => toggleAllowedModule(sub.id)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ─── Permisos por Módulo (CRUD) ─── */}
              <div className="grid gap-3">
                <Label>Permisos por Módulo (Lectura/Escritura/Eliminación)</Label>
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Módulo</TableHead>
                        <TableHead className="text-center">Lectura</TableHead>
                        <TableHead className="text-center">Escritura</TableHead>
                        <TableHead className="text-center">Eliminación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(roleForm.permissions || []).map((perm: any) => (
                        <TableRow key={perm.module}>
                          <TableCell className="font-medium">{perm.module}</TableCell>
                          <TableCell className="text-center">
                            <Switch checked={perm.read} onCheckedChange={c => updatePerm(perm.module, 'read', c)} />
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch checked={perm.write} onCheckedChange={c => updatePerm(perm.module, 'write', c)} />
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch checked={perm.delete} onCheckedChange={c => updatePerm(perm.module, 'delete', c)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRoleModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveRole} className="bg-purple-600 hover:bg-purple-700 !text-white">
                {isEditing ? 'Guardar Cambios' : 'Crear Rol'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-5 md:grid-cols-4">
        {/* Primary KPI Card */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group bg-gradient-to-br from-purple-600 to-purple-900 text-white border-transparent shadow-lg shadow-purple-500/20">
          <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/20 blur-2xl opacity-50 transition-transform group-hover:scale-150 duration-500" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <Shield className="size-6 text-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-white/80">Total Roles</p>
              <p className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">{rolesData.length}</p>
            </div>
            <div className="mt-4 text-xs font-medium text-white/70">Roles configurados en el sistema</div>
          </CardContent>
        </Card>

        {/* Secondary KPI Cards */}
        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
          <div className="absolute -right-6 -top-6 size-24 rounded-full bg-blue-500/10 blur-2xl opacity-50 transition-transform group-hover:scale-150 duration-500" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-inner">
                <Users className="size-6 text-blue-500" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-muted-foreground">Total Usuarios</p>
              <p className="text-3xl font-bold tracking-tight text-foreground">{totalUsers}</p>
            </div>
            <div className="mt-4 text-xs font-medium text-blue-500/80">Usuarios activos registrados</div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
          <div className="absolute -right-6 -top-6 size-24 rounded-full bg-green-500/10 blur-2xl opacity-50 transition-transform group-hover:scale-150 duration-500" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-green-500/10 border border-green-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-inner">
                <Shield className="size-6 text-green-500" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-muted-foreground">Módulos</p>
              <p className="text-3xl font-bold tracking-tight text-foreground">{MODULE_GROUPS.length}</p>
            </div>
            <div className="mt-4 text-xs font-medium text-green-500/80">Módulos configurables por rol</div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group bg-card/50 backdrop-blur-sm border-border/50 shadow-sm">
          <div className="absolute -right-6 -top-6 size-24 rounded-full bg-orange-500/10 blur-2xl opacity-50 transition-transform group-hover:scale-150 duration-500" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-inner">
                <Check className="size-6 text-orange-500" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-muted-foreground">Estado RBAC</p>
              <p className="text-3xl font-bold tracking-tight text-foreground">Activo</p>
            </div>
            <div className="mt-4 text-xs font-medium text-orange-500/80">Protección granular de accesos</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="roles" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="roles" className="min-w-[120px]">Roles y Permisos</TabsTrigger>
          <TabsTrigger value="usuarios" className="min-w-[120px]">Usuarios</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          {/* Search Roles */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar roles..."
              className="pl-9 max-w-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Roles Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {filteredRoles.map((role) => {
              const allowedCount = (role.allowedModules || []).length;
              const userCount = role._count?.users || role.usuarios || 0;
              return (
                <Card key={role.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${role.color}`}>
                          <Shield className="size-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{role.name}</CardTitle>
                          <CardDescription className="mt-1">{role.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleOpenEdit(role)}
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-red-400 hover:text-red-300"
                          onClick={() => handleDeleteRole(role.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {userCount} {userCount === 1 ? 'usuario' : 'usuarios'}
                        </span>
                      </div>
                      {allowedCount > 0 && (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]">
                          {allowedCount} módulos permitidos
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Permisos por Módulo</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleOpenEdit(role)}
                        >
                          <Eye className="mr-1 size-3" />
                          Ver detalles
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {(role.permissions || []).slice(0, 4).map((permiso: any) => (
                          <div
                            key={permiso.module}
                            className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1.5"
                          >
                            {permiso.read && permiso.write && permiso.delete ? (
                              <Check className="size-3 text-green-400" />
                            ) : permiso.read ? (
                              <Eye className="size-3 text-blue-400" />
                            ) : (
                              <X className="size-3 text-red-400" />
                            )}
                            <span className="truncate">{permiso.module}</span>
                          </div>
                        ))}
                      </div>
                      {role.permissions && role.permissions.length > 4 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{role.permissions.length - 4} módulos más
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="usuarios" className="space-y-4">
          {/* Search Usuarios */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar usuarios..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Card>
            <CardHeader><CardTitle>Gestión de Usuarios Activos</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Rol del Sistema</TableHead>
                      <TableHead>Rol Personalizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={u.isActive !== false ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}>
                            {u.isActive !== false ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.role}
                            onValueChange={(val) => handleUserRoleChange(u.id, val)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Selecciona un rol" />
                            </SelectTrigger>
                             <SelectContent>
                              {SYSTEM_ROLE_OPTIONS.map(r => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.customRoleId || 'none'}
                            onValueChange={async (val) => {
                              try {
                                await usersService.update(u.id, { customRoleId: val === 'none' ? null : val } as any);
                                setUsers(users.map(usr => usr.id === u.id ? { ...usr, customRoleId: val === 'none' ? null : val } : usr));
                                toast.success('Rol personalizado actualizado');
                              } catch {
                                toast.error('Error al asignar rol');
                              }
                            }}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Sin rol personalizado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin rol personalizado</SelectItem>
                              {rolesData.map(r => (
                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
