import React, { useState, useEffect } from 'react';
import { Shield, Users, Plus, Search, Edit, Trash2, Eye, Check, X } from 'lucide-react';
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
import type { RoleManagement, User, Permission } from '../types';
import { toast } from 'sonner';

const SYSTEM_ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'employee', label: 'Empleado' },
  { value: 'viewer', label: 'Visualizador' },
];

export function RolesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [rolesData, setRolesData] = useState<RoleManagement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const MODULES = ['Ventas', 'Compras', 'Inventario', 'Finanzas', 'RRHH', 'Clientes', 'Proveedores', 'Actividades', 'Tickets', 'Documentos', 'Notificaciones', 'Transferencias', 'Reportes', 'Roles', 'Configuracion', 'Schema'];

  const emptyRole: Partial<RoleManagement> = {
    name: '',
    description: '',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    permissions: MODULES.map(m => ({ module: m, read: false, write: false, delete: false }))
  };

  const [roleForm, setRoleForm] = useState<Partial<RoleManagement>>(emptyRole);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesRes, usersRes] = await Promise.all([
        rolesService.getAll(),
        usersService.getAll()
      ]);
      setRolesData(rolesRes.data || []);
      const usersList = Array.isArray(usersRes) ? usersRes : ((usersRes as any)?.data || []);
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
    setIsRoleModalOpen(true);
  };

  const handleOpenEdit = (role: RoleManagement) => {
    setRoleForm({ ...role });
    setIsEditing(true);
    setIsRoleModalOpen(true);
  };

  const handleDeleteRole = async (id: string) => {
    try {
      if (window.confirm('¿Estás seguro de eliminar este rol?')) {
        await rolesService.delete(id);
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting role:', error);
    }
  };

  const handleSaveRole = async () => {
    try {
      if (isEditing && roleForm.id) {
        await rolesService.update(roleForm.id, roleForm);
      } else {
        await rolesService.create(roleForm);
      }
      setIsRoleModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving role:', error);
    }
  };

  const updatePerm = (module: string, field: 'read' | 'write' | 'delete', val: boolean) => {
    setRoleForm(prev => ({
      ...prev,
      permissions: (prev.permissions || []).map((p: any) => p.module === module ? { ...p, [field]: val } : p)
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
            <Button onClick={handleOpenNew} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20">
              <Plus className="size-4" />
              Crear Rol
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditing ? `Editar Rol: ${roleForm.name}` : 'Crear Nuevo Rol'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Actualiza los permisos y detalles del rol.' : 'Define un nuevo rol con permisos personalizados'}
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
              <div className="grid gap-3">
                <Label>Permisos por Módulo</Label>
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
              <Button onClick={handleSaveRole}>
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
              <p className="text-sm font-medium text-muted-foreground">Permisos</p>
              <p className="text-3xl font-bold tracking-tight text-foreground">{MODULES.length}</p>
            </div>
            <div className="mt-4 text-xs font-medium text-green-500/80">Módulos asegurados</div>
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

      <Tabs defaultValue="usuarios" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="usuarios" className="min-w-[120px]">Usuarios</TabsTrigger>
          <TabsTrigger value="roles" className="min-w-[120px]">Roles y Permisos</TabsTrigger>
        </TabsList>

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
                      <TableHead>Rol Asignado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={u.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}>
                            {u.isActive ? 'Activo' : 'Inactivo'}
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
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300">
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
            {filteredRoles.map((role) => (
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
                      {role.id !== 'admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-red-400 hover:text-red-300"
                          onClick={() => handleDeleteRole(role.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {role.usuarios} {role.usuarios === 1 ? 'usuario' : 'usuarios'}
                    </span>
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
            ))}
          </div>


        </TabsContent>
      </Tabs>
    </div>
  );
}
