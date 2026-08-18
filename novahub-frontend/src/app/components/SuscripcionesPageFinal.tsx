import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from './ui/utils';
import {
  Building2, Users, CheckCircle2, XCircle, Clock, Plus, Search, Edit2, Trash2,
  UserPlus, TrendingUp, DollarSign, Zap, HandCoins, Headphones, BellRing, Settings, FileText, CalendarDays, Package, Users as UserIcon, BarChart3
} from 'lucide-react';
import { subscriptionsService } from '../services/subscriptions.service';
import { tenantsService } from '../services/tenants.service';
import { useAuth } from '../contexts/AuthContext';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { getPasswordError, isValidEmail, normalizeEmail } from '../utils/accountValidation';

const AVAILABLE_MODULES = [
  { id: 'SALES', label: 'Ventas', icon: TrendingUp, description: 'Cotizaciones, Facturación y Clientes' },
  { id: 'INVENTORY', label: 'Inventario de Mercancías', icon: Package, description: 'Stock, Almacenes y SKU' },
  { id: 'FINANCIAL', label: 'Finanzas', icon: DollarSign, description: 'Libro Mayor y Balance General' },
  { id: 'PURCHASES', label: 'Compras', icon: HandCoins, description: 'Proveedores y Órdenes de Compra' },
  { id: 'HR', label: 'Recursos Humanos', icon: UserIcon, description: 'Nómina y Gestión de Empleados' },
  { id: 'ACTIVITIES', label: 'Actividades', icon: CalendarDays, description: 'Registro de Actividades' },
  { id: 'DOCUMENTS', label: 'Documentos', icon: FileText, description: 'Gestión Documental' },
  { id: 'TICKETS', label: 'Tickets y Soporte', icon: Headphones, description: 'Soporte y Atención' },
  { id: 'NOTIFICATIONS', label: 'Notificaciones', icon: BellRing, description: 'Alertas del sistema' },
  { id: 'REPORTS', label: 'Reportes', icon: BarChart3, description: 'Informes y Análisis' },
  { id: 'CONFIGURATION', label: 'Configuración', icon: Settings, description: 'Ajustes del Sistema' },
];

export function SuscripcionesPageFinal() {
  const { user } = useAuth();
  const isPlatformAdmin = !!user?.isPlatformAdmin;
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialogs
  const [isTenantDialogOpen, setIsTenantDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  
  // Forms
  const [tenantForm, setTenantForm] = useState({
    name: '', slug: '', industry: 'TECHNOLOGY', plan: 'BASIC',
    adminName: '', adminEmail: '', adminPassword: ''
  });
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [moduleForm, setModuleForm] = useState({ module: '', price: 0, notes: '' });
  const [pendingDeleteTenant, setPendingDeleteTenant] = useState<{ id: string; name: string } | null>(null);

  const fetchData = async () => {
    if (!isPlatformAdmin) {
      setLoading(false);
      setTenants([]);
      setRequests([]);
      return;
    }
    try {
      setLoading(true);
      const [tenantsRes, requestsRes] = await Promise.all([
        tenantsService.getAll(),
        user?.role === 'admin' ? subscriptionsService.getAllRequests() : subscriptionsService.getPartnerRequests(),
      ]);
      setTenants(tenantsRes || []);
      setRequests(requestsRes || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchData();
    };
    load();
  }, []);

  const handleCreateTenant = async () => {
    if (!isPlatformAdmin) return toast.error('No autorizado');
    const passwordError = getPasswordError(tenantForm.adminPassword);
    if (passwordError || !isValidEmail(tenantForm.adminEmail)) {
      return toast.error(passwordError || 'Escribe un correo válido para el administrador');
    }
    try {
      const payload = {
        name: tenantForm.name,
        slug: tenantForm.slug || tenantForm.name.toLowerCase().replace(/\s+/g, '-'),
        industry: tenantForm.industry,
        plan: tenantForm.plan,
        adminName: tenantForm.adminName,
        adminEmail: normalizeEmail(tenantForm.adminEmail),
        adminPassword: tenantForm.adminPassword
      };
      await tenantsService.create(payload);
      toast.success('Empresa creada exitosamente');
      setIsTenantDialogOpen(false);
      resetTenantForm();
      fetchData();
    } catch (error: any) {
      console.error('Create tenant error:', error);
      toast.error(error.response?.data?.message || 'Error al crear empresa');
    }
  };

  const handleUpdateTenant = async () => {
    if (!isPlatformAdmin) return toast.error('No autorizado');
    try {
      await tenantsService.update(selectedTenant.id, {
        name: tenantForm.name,
        industry: tenantForm.industry,
        plan: tenantForm.plan,
      });
      toast.success('Empresa actualizada');
      setIsTenantDialogOpen(false);
      setSelectedTenant(null);
      resetTenantForm();
      fetchData();
    } catch {
      toast.error('Error al actualizar empresa');
    }
  };

  const handleDeleteTenant = (id: string, name: string) => {
    if (!isPlatformAdmin) return toast.error('No autorizado');
    setPendingDeleteTenant({ id, name });
  };

  const confirmDeleteTenant = async () => {
    if (!pendingDeleteTenant) return;
    try {
      await tenantsService.delete(pendingDeleteTenant.id);
      toast.success('Empresa eliminada');
      setPendingDeleteTenant(null);
      fetchData();
    } catch {
      toast.error('Error al eliminar empresa');
    }
  };

  const handleAddUser = async () => {
    if (!isPlatformAdmin) return toast.error('No autorizado');
    const passwordError = getPasswordError(userForm.password);
    if (passwordError || !isValidEmail(userForm.email)) {
      return toast.error(passwordError || 'Escribe un correo válido para el usuario');
    }
    try {
      const payload = {
        clientTenantId: selectedTenant.id,
        name: userForm.name,
        email: normalizeEmail(userForm.email),
        password: userForm.password,
        role: userForm.role
      };
      await tenantsService.addUser(payload);
      toast.success('Usuario agregado exitosamente');
      setIsUserDialogOpen(false);
      setUserForm({ name: '', email: '', password: '', role: 'user' });
      fetchData();
    } catch (error: any) {
      console.error('Add user error:', error);
      toast.error(error.response?.data?.message || 'Error al agregar usuario');
    }
  };

  const handleEnableModule = async () => {
    if (!isPlatformAdmin) return toast.error('No autorizado');
    try {
      const payload = {
        clientTenantId: selectedTenant.id,
        requestedModule: moduleForm.module,
        customPrice: moduleForm.price || 0,
        notes: moduleForm.notes || 'Activación por administrador'
      };
      const request = await subscriptionsService.createRequest(payload);
      
      // Auto-approve if admin
      if (isPlatformAdmin) {
        await subscriptionsService.updateRequestStatus(request.id, { status: 'APPROVED' });
        toast.success('Módulo activado exitosamente');
      } else {
        toast.success('Solicitud enviada para aprobación');
      }
      
      setIsModuleDialogOpen(false);
      setModuleForm({ module: '', price: 0, notes: '' });
      fetchData();
    } catch (error: any) {
      console.error('Enable module error:', error);
      toast.error(error.response?.data?.message || 'Error al habilitar módulo');
    }
  };

  const handleApproveRequest = async (id: string) => {
    if (!isPlatformAdmin) return toast.error('No autorizado');
    try {
      await subscriptionsService.updateRequestStatus(id, { status: 'APPROVED' });
      toast.success('Solicitud aprobada');
      fetchData();
    } catch {
      toast.error('Error al aprobar solicitud');
    }
  };

  const handleRejectRequest = async (id: string) => {
    if (!isPlatformAdmin) return toast.error('No autorizado');
    try {
      await subscriptionsService.updateRequestStatus(id, { status: 'REJECTED' });
      toast.success('Solicitud rechazada');
      fetchData();
    } catch {
      toast.error('Error al rechazar solicitud');
    }
  };

  const openEditTenant = (tenant: any) => {
    setSelectedTenant(tenant);
    setTenantForm({
      name: tenant.name,
      slug: tenant.slug,
      industry: tenant.industry || 'TECHNOLOGY',
      plan: tenant.plan || 'BASIC',
      adminName: '',
      adminEmail: '',
      adminPassword: ''
    });
    setIsTenantDialogOpen(true);
  };

  const openAddModule = (tenant: any) => {
    setSelectedTenant(tenant);
    setIsModuleDialogOpen(true);
  };

  const openManageUsers = (tenant: any) => {
    setSelectedTenant(tenant);
    setIsUserDialogOpen(true);
  };

  const resetTenantForm = () => {
    setTenantForm({
      name: '', slug: '', industry: 'TECHNOLOGY', plan: 'BASIC',
      adminName: '', adminEmail: '', adminPassword: ''
    });
  };

  const filteredTenants = tenants.filter(t => 
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingRequests = requests.filter(r => r.status === 'PENDING');

  const stats = [
    { title: 'Empresas Activas', value: tenants.filter(t => t.isActive).length, icon: Building2, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
    { title: 'Módulos Habilitados', value: tenants.reduce((sum, t) => sum + (t.subscriptions?.length || 0), 0), icon: Zap, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { title: 'Solicitudes Pendientes', value: pendingRequests.length, icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
    { title: 'Usuarios Totales', value: tenants.reduce((sum, t) => sum + (t.users?.length || 0), 0), icon: Users, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30' },
  ];

  if (!isPlatformAdmin) {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-border/40">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Vista restringida: solo administradores de plataforma.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Suscripciones</h1>
          <p className="text-muted-foreground mt-1">{tenants.length} empresas registradas</p>
        </div>
        <Button onClick={() => { setSelectedTenant(null); resetTenantForm(); setIsTenantDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="size-4 mr-2" />Registrar Empresa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="border-border/40 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{stat.title}</p>
                    <h3 className="text-3xl font-bold tracking-tight">{stat.value}</h3>
                  </div>
                  <div className={cn("p-3 rounded-xl", stat.bgColor)}><stat.icon className={cn("size-6", stat.color)} /></div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tenants" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tenants">Empresas ({tenants.length})</TabsTrigger>
          <TabsTrigger value="requests">
            Solicitudes ({requests.length})
            {pendingRequests.length > 0 && (
              <Badge className="ml-2 bg-orange-700 text-white">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tenants Tab */}
        <TabsContent value="tenants" className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="Buscar empresa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
            </div>
          </div>

          {/* Tenants List */}
          <div className="space-y-4">
            {filteredTenants.map((tenant, i) => (
              <motion.div key={tenant.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="border-border/40 hover:shadow-md transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="size-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center">
                          <Building2 className="size-6 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold">{tenant.name}</h3>
                            <Badge variant="outline" className="bg-primary/10 text-primary">{tenant.plan || 'BASIC'}</Badge>
                            {tenant.isActive ? (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">Activa</Badge>
                            ) : (
                              <Badge variant="secondary">Inactiva</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            URL: <code className="bg-muted px-2 py-1 rounded">{tenant.slug}.novahub.io</code>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {tenant.subscriptions?.map((sub: any) => (
                              <Badge key={sub.module} className="bg-emerald-600 text-white">
                                {AVAILABLE_MODULES.find(m => m.id === sub.module)?.label || sub.module}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openManageUsers(tenant)}>
                          <UserPlus className="size-4 mr-2" />Usuarios ({tenant.users?.length || 0})
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openAddModule(tenant)}>
                          <Plus className="size-4 mr-2" />Módulo
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditTenant(tenant)}>
                          <Edit2 className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteTenant(tenant.id, tenant.name)}>
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          {requests.map((req, i) => (
            <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="border-border/40">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-bold">{req.clientTenant?.name}</h4>
                        <Badge className="bg-emerald-600 text-white">{AVAILABLE_MODULES.find(m => m.id === req.requestedModule)?.label}</Badge>
                        <Badge variant={req.status === 'PENDING' ? 'default' : req.status === 'APPROVED' ? 'default' : 'destructive'}>
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Partner: {req.partner?.name} • Precio: ${req.customPrice || 0}
                      </p>
                      {req.notes && <p className="text-sm text-muted-foreground mt-2 italic">"{req.notes}"</p>}
                    </div>
                    {isPlatformAdmin && req.status === 'PENDING' && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleApproveRequest(req.id)} className="bg-emerald-600 hover:bg-emerald-700">
                          <CheckCircle2 className="size-4 mr-2" />Aprobar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRejectRequest(req.id)}>
                          <XCircle className="size-4 mr-2" />Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Tenant Dialog */}
      <Dialog open={isTenantDialogOpen} onOpenChange={setIsTenantDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedTenant ? 'Editar Empresa' : 'Registrar Nueva Empresa'}</DialogTitle>
            <DialogDescription>
              {selectedTenant ? 'Modifica los datos de la empresa.' : 'La URL será: nombreempresa.novahub.io'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de la Empresa *</Label>
              <Input value={tenantForm.name} onChange={e => setTenantForm({...tenantForm, name: e.target.value})} placeholder="Ej: Mi Empresa S.A." />
            </div>
            {!selectedTenant && (
              <div className="space-y-2">
                <Label>URL Personalizada (slug)</Label>
                <Input 
                  value={tenantForm.slug} 
                  onChange={e => setTenantForm({...tenantForm, slug: e.target.value})} 
                  placeholder="mi-empresa (auto-generado si se deja vacío)"
                />
                <p className="text-xs text-muted-foreground">URL final: {tenantForm.slug || tenantForm.name.toLowerCase().replace(/\s+/g, '-')}.novahub.io</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Industria</Label>
                <Select value={tenantForm.industry} onValueChange={v => setTenantForm({...tenantForm, industry: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TECHNOLOGY">Tecnología</SelectItem>
                    <SelectItem value="RETAIL">Retail</SelectItem>
                    <SelectItem value="CONSTRUCTION">Construcción</SelectItem>
                    <SelectItem value="OTHER">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={tenantForm.plan} onValueChange={v => setTenantForm({...tenantForm, plan: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASIC">Básico ($29/mes) - Funcionalidades esenciales</SelectItem>
                    <SelectItem value="PROFESSIONAL">Profesional ($79/mes) - Para empresas en crecimiento</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise ($199/mes) - Solución completa</SelectItem>
                    <SelectItem value="CUSTOM">Custom (A medida) - Personalizado según necesidades</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!selectedTenant && (
              <>
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Usuario Administrador</h4>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label>Nombre Completo *</Label>
                      <Input value={tenantForm.adminName} onChange={e => setTenantForm({...tenantForm, adminName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input type="email" value={tenantForm.adminEmail} onChange={e => setTenantForm({...tenantForm, adminEmail: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Contraseña (opcional)</Label>
                      <Input type="password" value={tenantForm.adminPassword} onChange={e => setTenantForm({...tenantForm, adminPassword: e.target.value})} placeholder="8 caracteres, mayúscula, número y símbolo" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTenantDialogOpen(false)}>Cancelar</Button>
            <Button onClick={selectedTenant ? handleUpdateTenant : handleCreateTenant} className="bg-emerald-600 hover:bg-emerald-700">
              {selectedTenant ? 'Actualizar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Module Dialog */}
      <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Habilitar Módulo para {selectedTenant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Módulo a Habilitar *</Label>
              <Select value={moduleForm.module} onValueChange={v => setModuleForm({...moduleForm, module: v})}>
                <SelectTrigger><SelectValue placeholder="Seleccionar módulo..." /></SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODULES.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.label} - {m.description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Precio Mensual (USD)</Label>
              <Input type="number" value={moduleForm.price} onChange={e => setModuleForm({...moduleForm, price: Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={moduleForm.notes} onChange={e => setModuleForm({...moduleForm, notes: e.target.value})} placeholder="Notas internas..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModuleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEnableModule} className="bg-emerald-600 hover:bg-emerald-700">Habilitar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Users Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Usuarios de {selectedTenant?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <h4 className="font-semibold">Usuarios Actuales ({selectedTenant?.users?.length || 0})</h4>
              {selectedTenant?.users?.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge>{u.role}</Badge>
                </div>
              ))}
              {(!selectedTenant?.users || selectedTenant.users.length === 0) && (
                <p className="text-center text-muted-foreground py-4">No hay usuarios registrados</p>
              )}
            </div>
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Agregar Nuevo Usuario</h4>
              <div className="space-y-3">
                <Input placeholder="Nombre completo" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} />
                <Input type="email" placeholder="Email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                <Input type="password" placeholder="8 caracteres, mayúscula, número y símbolo" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
                <Select value={userForm.role} onValueChange={v => setUserForm({...userForm, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="user">Usuario</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddUser} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  <UserPlus className="size-4 mr-2" />Agregar Usuario
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteTenant)}
        onOpenChange={open => { if (!open) setPendingDeleteTenant(null); }}
        title="¿Eliminar empresa?"
        description={pendingDeleteTenant ? `La empresa «${pendingDeleteTenant.name}» y sus datos asociados se eliminarán. Esta acción no se puede deshacer.` : undefined}
        confirmLabel="Eliminar empresa"
        variant="destructive"
        onConfirm={confirmDeleteTenant}
      />
    </div>
  );
}
