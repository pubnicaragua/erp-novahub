import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Zap, Building2, Globe, User as UserIcon, LayoutGrid, Check, Clock, Plus, ShieldCheck, DollarSign, MessageSquare, Users, Edit2, Trash2, KeyRound, X, Mail, Shield
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../ui/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { tenantsService } from '../../services/tenants.service';
import { toast } from 'sonner';

interface TenantSubscriptionViewProps {
  tenant: any;
  availableModules: any[];
  requests: any[];
  customRoles?: any[];
  onRequestModule: (moduleId: string, notes: string) => void;
  onRefresh: () => void;
}

const SYSTEM_ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administrador', description: 'Acceso total a la empresa' },
  { value: 'MANAGER', label: 'Gerente', description: 'Gestión operativa y supervisión' },
  { value: 'EMPLOYEE', label: 'Empleado', description: 'Acceso operativo estándar' },
  { value: 'VIEWER', label: 'Visualizador', description: 'Solo lectura de datos' },
];

export function TenantSubscriptionView({ tenant, availableModules, requests, customRoles = [], onRequestModule, onRefresh }: TenantSubscriptionViewProps) {
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isPermsDialogOpen, setIsPermsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'EMPLOYEE' });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (tenant?.id) {
      fetchUsers();
    }
  }, [tenant?.id]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await tenantsService.getUsers(tenant.id);
      setUsers(Array.isArray(res) ? res : (res as any)?.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUpdateCustomRole = async (userId: string, customRoleId: string | null) => {
    try {
      await tenantsService.updateUser(tenant.id, userId, { customRoleId: customRoleId === 'none' ? null : customRoleId } as any);
      toast.success('Rol personalizado actualizado');
      fetchUsers();
    } catch (error) {
      toast.error('Error al asignar rol');
    }
  };

  const handleViewPerms = (user: any) => {
    setSelectedUser(user);
    setIsPermsDialogOpen(true);
  };

  if (!tenant) return (
    <div className="p-20 flex flex-col items-center justify-center text-muted-foreground italic">
      <Clock className="size-12 mb-4 opacity-20 animate-pulse" />
      Cargando información de suscripción...
    </div>
  );

  const handleAddUser = async () => {
    if (!userForm.name || !userForm.email) {
      toast.error('Complete nombre y email');
      return;
    }
    if (!userForm.password || userForm.password.length < 10) {
      toast.error('La contraseña es obligatoria y debe tener al menos 10 caracteres');
      return;
    }
    try {
      setUploading(true);
      await tenantsService.addUser({
        clientTenantId: tenant.id,
        name: userForm.name,
        email: userForm.email,
        password: userForm.password,
        role: userForm.role,
      });
      toast.success('Usuario agregado correctamente');
      setUserForm({ name: '', email: '', password: '', role: 'EMPLOYEE' });
      setIsUserDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al agregar usuario');
    } finally {
      setUploading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await tenantsService.updateUser(tenant.id, userId, { isActive: !currentStatus });
      toast.success(currentStatus ? 'Usuario desactivado' : 'Usuario activado');
      fetchUsers();
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const handleRequestClick = (mod: any) => {
    setSelectedModule(mod);
    setIsRequestDialogOpen(true);
  };

  const submitRequest = () => {
    if (selectedModule) {
      onRequestModule(selectedModule.id, notes);
      setIsRequestDialogOpen(false);
      setSelectedModule(null);
      setNotes('');
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'BASIC': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'PROFESSIONAL': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'ENTERPRISE': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default: return 'bg-muted/30 text-muted-foreground border-border/50';
    }
  };

  const isModuleActive = (modId: string) => {
    return tenant.subscriptions?.some((s: any) => s.module === modId && s.isActive);
  };

  const isModulePending = (modId: string) => {
    return requests.some((r: any) => r.clientTenantId === tenant.id && r.requestedModule === modId && r.status === 'PENDING');
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto min-h-screen">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground flex items-center gap-3 uppercase italic">
            <Zap className="size-10 text-primary fill-primary/20" />
            Mi Suscripción
          </h1>
          <p className="text-muted-foreground font-medium mt-2">Gestiona el plan, módulos y el equipo de {tenant.name}.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={cn("text-[12px] font-black uppercase tracking-widest px-4 py-1.5 h-10 flex items-center", getPlanColor(tenant.plan))}>
            Plan {tenant.plan}
          </Badge>
        </div>
      </motion.div>

      <Tabs defaultValue="plan" className="w-full">
        <TabsList className="bg-muted/20 border border-border/50 p-1 h-12 mb-8">
          <TabsTrigger value="plan" className="px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase text-[10px] tracking-widest gap-2">
            <LayoutGrid className="size-4" /> Módulos y Plan
          </TabsTrigger>
          <TabsTrigger value="team" className="px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase text-[10px] tracking-widest gap-2">
            <Users className="size-4" /> Mi Equipo ({users.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="space-y-8">
          {/* Plan Card */}
          <Card className="bg-card border-border/50 overflow-hidden relative shadow-sm">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-6">
                  <div className="size-20 rounded-2xl bg-muted/20 flex items-center justify-center border border-border">
                    <Building2 className="size-10 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight mb-2">{tenant.name}</h2>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                        <Globe className="size-4" /> {tenant.slug}.novahub.io
                      </span>
                      <div className="size-1 rounded-full bg-border" />
                      <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                        <Users className="size-4" /> {users.length} Usuarios Activos
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Estado de Cuenta</p>
                  <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 font-black">AL DÍA</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Modules Catalog */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {availableModules.map((mod) => {
              const hasSubmodules = mod.submodules && mod.submodules.length > 0;
              const activeSubmodulesCount = hasSubmodules 
                ? mod.submodules.filter((sub: any) => isModuleActive(sub.id)).length 
                : 0;
              const allSubmodulesActive = hasSubmodules ? activeSubmodulesCount === mod.submodules.length : false;
              
              const isMainActive = hasSubmodules ? allSubmodulesActive : isModuleActive(mod.id);
              const isMainPending = hasSubmodules ? false : isModulePending(mod.id);
              const isPartial = hasSubmodules && !allSubmodulesActive && activeSubmodulesCount > 0;

              const Icon = mod.icon;

              return (
                <Card key={mod.id} className={cn(
                  "relative overflow-hidden transition-all duration-300 border-border/50 flex flex-col group",
                  isMainActive ? "bg-primary/5 border-primary/20 shadow-md shadow-primary/5" : "bg-card hover:border-primary/30"
                )}>
                  <CardContent className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className={cn(
                        "p-3 rounded-xl transition-colors",
                        isMainActive ? "bg-primary/20 text-primary" : isPartial ? "bg-primary/10 text-primary/70" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                      )}>
                        <Icon className="size-6" />
                      </div>
                      {isMainActive ? (
                        <Badge className="bg-primary text-primary-foreground border-none font-bold uppercase text-[10px] px-2 py-0.5">
                          <Check className="size-3 mr-1" /> Activo
                        </Badge>
                      ) : isMainPending ? (
                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-bold uppercase text-[10px] animate-pulse">
                          <Clock className="size-3 mr-1" /> Pendiente
                        </Badge>
                      ) : isPartial ? (
                        <Badge className="bg-primary/10 text-primary/70 border-primary/20 font-bold uppercase text-[10px]">
                          {activeSubmodulesCount} Activos
                        </Badge>
                      ) : null}
                    </div>
                    <h4 className="font-bold text-lg mb-1">{mod.label}</h4>
                    <p className="text-sm text-muted-foreground mb-6 line-clamp-2">{mod.description}</p>
                    
                    {/* Submodules List */}
                    {hasSubmodules && (
                      <div className="mt-auto space-y-2 pt-4 border-t border-border/50">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Funcionalidades</p>
                        {mod.submodules.map((sub: any) => {
                          const subActive = isModuleActive(sub.id);
                          const subPending = isModulePending(sub.id);
                          
                          return (
                            <div key={sub.id} className="flex items-center justify-between group/sub">
                              <div className="flex items-center gap-2">
                                <div className={cn("size-1.5 rounded-full", subActive ? "bg-primary" : "bg-muted-foreground/30")} />
                                <span className={cn("text-xs font-medium", subActive ? "text-foreground" : "text-muted-foreground")}>
                                  {sub.label}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                {!subActive && !subPending && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="h-6 px-2 text-[10px] uppercase font-bold text-primary hover:bg-primary/10"
                                    onClick={() => handleRequestClick(sub)}
                                  >
                                    Solicitar
                                  </Button>
                                )}
                              </div>
                              
                              {subPending && (
                                <Badge className="bg-amber-500/10 text-amber-500 border-none text-[9px] uppercase px-1.5 py-0">
                                  En Cola
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!hasSubmodules && !isMainActive && !isMainPending && (
                      <div className="mt-auto pt-6">
                        <Button 
                          variant="outline" 
                          className="w-full font-bold uppercase text-[10px] tracking-widest border-primary/20 text-primary hover:bg-primary/10"
                          onClick={() => handleRequestClick(mod)}
                        >
                          <Plus className="size-4 mr-2" /> Solicitar Activación
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <div className="flex items-center justify-between bg-card border border-border/50 p-6 rounded-2xl">
            <div>
              <h3 className="text-xl font-bold tracking-tight">Miembros de la Empresa</h3>
              <p className="text-sm text-muted-foreground">Gestiona quién tiene acceso a los módulos habilitados de {tenant.name}.</p>
            </div>
            <Button className="bg-primary text-primary-foreground gap-2 font-bold px-6" onClick={() => setIsUserDialogOpen(true)}>
              <Plus className="size-5" /> Agregar Miembro
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u) => (
              <Card key={u.id} className="bg-card border-border/50 hover:border-primary/20 transition-all overflow-hidden group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl">
                        {u.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground leading-tight">{u.name}</h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="size-3" /> {u.email}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      u.isActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    )}>
                      {u.isActive ? 'Activo' : 'Suspendido'}
                    </Badge>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-border/50">
                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Rol Base</span>
                        <Select
                          value={u.role?.toUpperCase()}
                          onValueChange={async (val) => {
                            try {
                              await tenantsService.updateUser(tenant.id, u.id, { role: val });
                              toast.success('Rol del sistema actualizado');
                              fetchUsers();
                            } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
                          }}
                        >
                          <SelectTrigger className="h-7 w-[120px] text-[10px] font-bold uppercase bg-primary/5 border-none shadow-none focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SYSTEM_ROLE_OPTIONS.map(r => (
                              <SelectItem key={r.value} value={r.value} className="text-[10px] font-bold uppercase">{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Rol Personalizado</span>
                        <Select
                          value={u.customRoleId || 'none'}
                          onValueChange={(val) => handleUpdateCustomRole(u.id, val)}
                        >
                          <SelectTrigger className="h-7 w-[120px] text-[10px] font-bold uppercase bg-purple-500/5 text-purple-600 border-none shadow-none focus:ring-0">
                            <SelectValue placeholder="Ninguno" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-[10px] font-bold uppercase">Ninguno</SelectItem>
                            {customRoles.map(r => (
                              <SelectItem key={r.id} value={r.id} className="text-[10px] font-bold uppercase">{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 hover:text-primary h-8 border-primary/10"
                        onClick={() => handleViewPerms(u)}
                      >
                        <Shield className="size-3 mr-2" /> Ver Permisos
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn(
                          "flex-1 text-[10px] font-black uppercase tracking-widest h-8",
                          u.isActive ? "hover:bg-rose-500/10 hover:text-rose-500" : "hover:bg-emerald-500/10 hover:text-emerald-500"
                        )}
                        onClick={() => toggleUserStatus(u.id, u.isActive)}
                      >
                        {u.isActive ? <><X className="size-3 mr-2" /> Suspender</> : <><Check className="size-3 mr-2" /> Activar</>}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Permissions Viewer Dialog */}
      <Dialog open={isPermsDialogOpen} onOpenChange={setIsPermsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase italic tracking-tighter">
              <Shield className="size-6 text-primary" />
              Permisos de {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Detalle de accesos basados en el Rol Base ({selectedUser?.role}) {selectedUser?.customRole && `y Rol Personalizado (${selectedUser.customRole.name})`}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-3 font-black uppercase text-[10px] tracking-widest">Módulo</th>
                    <th className="text-center p-3 font-black uppercase text-[10px] tracking-widest">Ver</th>
                    <th className="text-center p-3 font-black uppercase text-[10px] tracking-widest">Crear/Editar</th>
                    <th className="text-center p-3 font-black uppercase text-[10px] tracking-widest">Eliminar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {/* Aquí mapearíamos los permisos reales si el objeto User los tuviera calculados, 
                      pero como ejemplo mostramos la estructura del rol personalizado si existe */}
                  {(selectedUser?.customRole?.permissions || []).length > 0 ? (
                    selectedUser.customRole.permissions.map((p: any) => (
                      <tr key={p.module} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-bold text-xs">{p.module}</td>
                        <td className="p-3 text-center">{p.read ? <Check className="size-4 text-emerald-500 mx-auto" /> : <X className="size-4 text-muted-foreground/30 mx-auto" />}</td>
                        <td className="p-3 text-center">{p.write ? <Check className="size-4 text-emerald-500 mx-auto" /> : <X className="size-4 text-muted-foreground/30 mx-auto" />}</td>
                        <td className="p-3 text-center">{p.delete ? <Check className="size-4 text-emerald-500 mx-auto" /> : <X className="size-4 text-muted-foreground/30 mx-auto" />}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground italic">
                        Este usuario utiliza los permisos predeterminados del Rol Base. 
                        Para dar permisos específicos, asígnale un Rol Personalizado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="gap-3">
            {selectedUser?.customRoleId && (
              <Button 
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2"
                onClick={() => {
                  setIsPermsDialogOpen(false);
                  toast.info('Redirigiendo a la edición del rol...');
                  // Aquí podrías usar una función para navegar a la página de roles y abrir el editor del rol específico
                }}
              >
                <Edit2 className="size-4" /> Ajustar este Rol
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsPermsDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
              <Users className="size-6 text-primary" />
              Nuevo Miembro
            </DialogTitle>
            <DialogDescription>Asigna un nuevo integrante al equipo de {tenant.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre Completo</Label>
              <Input 
                placeholder="Ej: Juan Pérez" 
                value={userForm.name}
                onChange={e => setUserForm({...userForm, name: e.target.value})}
                className="bg-muted/10 h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Correo Electrónico</Label>
              <Input 
                type="email"
                placeholder="juan@empresa.com" 
                value={userForm.email}
                onChange={e => setUserForm({...userForm, email: e.target.value})}
                className="bg-muted/10 h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rol Base del Sistema</Label>
              <Select value={userForm.role} onValueChange={v => setUserForm({...userForm, role: v})}>
                <SelectTrigger className="bg-muted/10 h-11">
                  <SelectValue placeholder="Seleccionar rol..." />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_ROLE_OPTIONS.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs">{role.label}</span>
                        <span className="text-[10px] text-muted-foreground">{role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contraseña Temporal *</Label>
              <Input
                type="password"
                placeholder="Mínimo 10 caracteres"
                value={userForm.password}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                className="bg-muted/10 h-11"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)} className="h-11 px-6">Cancelar</Button>
            <Button 
              className="bg-primary text-primary-foreground font-bold h-11 px-8" 
              onClick={handleAddUser}
              disabled={uploading}
            >
              {uploading ? 'Creando...' : 'Crear Acceso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Module Request Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Módulo: {selectedModule?.label}</DialogTitle>
            <DialogDescription>
              Envía una solicitud para habilitar este módulo en tu empresa. Nuestro equipo se contactará para los detalles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notas Adicionales (Opcional)</Label>
              <Textarea 
                placeholder="¿Algún requerimiento especial para este módulo?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-primary-foreground" onClick={submitRequest}>
              Enviar Solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
