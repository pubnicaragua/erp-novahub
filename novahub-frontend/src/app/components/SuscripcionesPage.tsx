import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionsService, type SubscriptionRequest } from '../services/subscriptions.service';
import { tenantsService } from '../services/tenants.service';
import { toast } from 'sonner';
import { api } from '../services/api';
import { 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Plus, 
  HandCoins, 
  ShieldCheck, 
  LayoutGrid, 
  Building2,
  Lock,
  Zap,
  DollarSign,
  Search,
  Check,
  Globe,
  Mail,
  User as UserIcon,
  MessageSquare,
  TrendingUp,
  Activity,
  Award,
  Edit2,
  Eye,
  Trash2,
  Users,
  FileText,
  Settings,
  BarChart3,
  CalendarDays,
  Briefcase,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './ui/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { PREDEFINED_ROLES, type CustomRole } from '../types/roles';
import { 
  SALES_SUBMODULES, 
  PURCHASES_SUBMODULES, 
  INVENTORY_SUBMODULES, 
  FINANCIAL_SUBMODULES, 
  HR_SUBMODULES, 
  PROJECTS_SUBMODULES,
  type Submodule 
} from '../types/modules';
import { storageService } from '../services/storage.service';

const AVAILABLE_MODULES = [
  { id: 'SALES', label: 'Ventas', icon: TrendingUp, description: 'Cotizaciones, Facturación y Clientes', submodules: SALES_SUBMODULES },
  { id: 'INVENTORY', label: 'Inventario', icon: Package, description: 'Stock, Almacenes y SKU', submodules: INVENTORY_SUBMODULES },
  { id: 'FINANCIAL', label: 'Finanzas', icon: DollarSign, description: 'Libro Mayor y Balance General', submodules: FINANCIAL_SUBMODULES },
  { id: 'PURCHASES', label: 'Compras', icon: HandCoins, description: 'Proveedores y Órdenes de Compra', submodules: PURCHASES_SUBMODULES },
  { id: 'HR', label: 'Recursos Humanos', icon: UserIcon, description: 'Nómina y Gestión de Empleados', submodules: HR_SUBMODULES },
  { id: 'PROJECTS', label: 'Proyectos', icon: Briefcase, description: 'Tareas y Cronogramas de Obra', submodules: PROJECTS_SUBMODULES },
  { id: 'CLIENTS', label: 'Clientes', icon: Users, description: 'CRM y Gestión de Clientes' },
  { id: 'PROVIDERS', label: 'Proveedores', icon: Building2, description: 'Gestión de Proveedores' },
  { id: 'ACTIVITIES', label: 'Actividades', icon: CalendarDays, description: 'Registro de Actividades' },
  { id: 'DOCUMENTS', label: 'Documentos', icon: FileText, description: 'Gestión Documental' },
  { id: 'REPORTS', label: 'Reportes', icon: BarChart3, description: 'Informes y Análisis' },
  { id: 'CONFIGURATION', label: 'Configuración', icon: Settings, description: 'Ajustes del Sistema' },
];

export function SuscripcionesPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTenantDialogOpen, setIsTenantDialogOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [tenantDetails, setTenantDetails] = useState<any>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  // Form state for module request
  const [requestForm, setRequestForm] = useState({
    tenantId: '',
    module: '',
    price: 0,
    notes: ''
  });

  // Form states for new tenant
  const [tenantForm, setTenantForm] = useState({
    name: '',
    slug: '',
    adminName: '',
    adminEmail: '',
    industry: 'TECHNOLOGY',
    plan: 'BASIC',
    logo: ''
  });

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchData();
      // Actualización automática cada 5 segundos SOLO para admin
      const interval = setInterval(() => {
        fetchData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (user?.role?.toLowerCase() === 'admin') {
        const [reqs, allTenants] = await Promise.all([
          subscriptionsService.getAllRequests(),
          tenantsService.getAll()
        ]);
        console.log('Tenants structure:', allTenants[0]); // Debug
        setRequests(reqs);
        setTenants(allTenants);
      } else if (user?.role?.toLowerCase() === 'partner') {
        const [reqs, myTenants] = await Promise.all([
          subscriptionsService.getPartnerRequests(),
          tenantsService.getAll()
        ]);
        setRequests(reqs);
        setTenants(myTenants);
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      toast.error('Error al cargar datos de suscripciones');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    try {
      setUploading(true);
      let logoUrl = tenantForm.logo || null;
      
      if (logoFile) {
        logoUrl = await storageService.uploadTenantLogo(logoFile, tenantForm.slug || 'temp');
      }
      
      await tenantsService.create({ ...tenantForm, logo: logoUrl || undefined });
      toast.success('Empresa creada exitosamente');
      setIsTenantDialogOpen(false);
      resetTenantForm();
      setLogoFile(null);
      setLogoPreview('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Error al crear empresa');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateTenant = async () => {
    if (!selectedTenant) return;
    try {
      setUploading(true);
      let logoUrl = tenantForm.logo;
      
      if (logoFile) {
        logoUrl = await storageService.uploadTenantLogo(logoFile, selectedTenant.id);
      }
      
      await tenantsService.update(selectedTenant.id, { ...tenantForm, logo: logoUrl });
      toast.success('Información actualizada correctamente');
      setIsTenantDialogOpen(false);
      setSelectedTenant(null);
      setLogoFile(null);
      setLogoPreview('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Error al actualizar información');
    } finally {
      setUploading(false);
    }
  };

  const handleArchiveTenant = async (id: string) => {
    if (!confirm('¿Estás seguro de archivar esta empresa? No aparecerá en la lista activa.')) return;
    try {
      await api.patch(`/tenants/${id}`, { isActive: false });
      toast.success('Empresa archivada exitosamente');
      setTenants(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      toast.error('Error al archivar empresa');
    }
  };

  const handleDeleteTenant = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar permanentemente "${name}"? Esta acción NO se puede deshacer.`)) return;
    try {
      await tenantsService.delete(id);
      toast.success('Empresa eliminada permanentemente');
      fetchData();
    } catch (error) {
      toast.error('Error al eliminar empresa');
    }
  };

  const handleViewDetails = async (tenant: any) => {
    setTenantDetails(tenant);
    setIsDetailsDialogOpen(true);
  };

  const handleAddUser = async () => {
    if (!userForm.name || !userForm.email) {
      toast.error('Complete nombre y email');
      return;
    }
    try {
      setUploading(true);
      let avatarUrl = null;
      
      if (avatarFile) {
        const tempUserId = `${selectedTenant.id}-${Date.now()}`;
        avatarUrl = await storageService.uploadUserAvatar(avatarFile, tempUserId);
      }
      
      await tenantsService.addUser({
        clientTenantId: selectedTenant.id,
        name: userForm.name,
        email: userForm.email,
        password: userForm.password || 'DefaultPass123!',
        role: userForm.role,
        avatar: avatarUrl
      });
      toast.success('Usuario agregado exitosamente');
      setUserForm({ name: '', email: '', password: '', role: 'user' });
      setAvatarFile(null);
      setAvatarPreview('');
      setIsUserDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al agregar usuario');
    } finally {
      setUploading(false);
    }
  };

  const resetTenantForm = () => {
    setTenantForm({
      name: '',
      slug: '',
      adminName: '',
      adminEmail: '',
      industry: 'TECHNOLOGY',
      plan: 'BASIC',
      logo: ''
    });
    setLogoFile(null);
    setLogoPreview('');
  };

  const openEditTenant = (tenant: any) => {
    setSelectedTenant(tenant);
    setTenantForm({
      name: tenant.name,
      slug: tenant.slug,
      adminName: tenant.users?.[0]?.name || '',
      adminEmail: tenant.users?.[0]?.email || '',
      industry: tenant.industry,
      plan: tenant.plan,
      logo: tenant.logo || ''
    });
    setLogoPreview(tenant.logo || '');
    setIsTenantDialogOpen(true);
  };

  const handleToggleModule = (tenantId: string, moduleName: string, currentlyActive: boolean) => {
    if (currentlyActive) {
      return; // Ya está activo, no hacer nada
    }

    if (user?.role?.toLowerCase() !== 'admin') {
      setRequestForm({
        tenantId,
        module: moduleName,
        price: 0,
        notes: ''
      });
      setIsRequestDialogOpen(true);
    } else {
      handleDirectEnable(tenantId, moduleName);
    }
  };

  const handleDirectEnable = async (tenantId: string, moduleName: string) => {
    if (!tenantId) {
      toast.error('ID de empresa inválido. Por favor recarga la página.');
      return;
    }
    
    try {
      const res = await subscriptionsService.createRequest({
        clientTenantId: tenantId,
        requestedModule: moduleName,
        customPrice: 0,
        notes: 'Activación directa por Super Admin'
      });
      await subscriptionsService.updateRequestStatus(res.id, { status: 'APPROVED' });
      toast.success(`Módulo activado exitosamente`);
      fetchData();
    } catch (error: any) {
      console.error('Error activación:', error);
      toast.error(error.response?.data?.message || 'Error al activar módulo');
      fetchData();
    }
  };

  const handleSubmitRequest = async () => {
    try {
      await subscriptionsService.createRequest({
        clientTenantId: requestForm.tenantId,
        requestedModule: requestForm.module,
        customPrice: requestForm.price,
        notes: requestForm.notes
      });
      toast.success('✅ Solicitud enviada - El Super Admin recibirá una notificación');
      setIsRequestDialogOpen(false);
      setRequestForm({ tenantId: '', module: '', price: 0, notes: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al enviar solicitud');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await subscriptionsService.updateRequestStatus(id, { status: 'APPROVED' });
      toast.success('Suscripción aprobada y módulo habilitado');
      fetchData();
    } catch (error) {
      toast.error('Error al aprobar suscripción');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await subscriptionsService.updateRequestStatus(id, { status: 'REJECTED' });
      toast.error('Suscripción rechazada');
      fetchData();
    } catch (error) {
      toast.error('Error al rechazar suscripción');
    }
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getIndustryIcon = (industry: string) => {
    switch (industry) {
      case 'ARCHITECTURE': return Globe;
      case 'RETAIL': return LayoutGrid;
      case 'SERVICES': return UserIcon;
      default: return Building2;
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'BASIC': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'PROFESSIONAL': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'ENTERPRISE': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default: return 'bg-white/10 text-white/40 border-white/10';
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto min-h-screen">
      {/* --- HEADER --- */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3 uppercase italic">
            <Zap className="size-10 text-emerald-500 fill-emerald-500/20" />
            Control <span className="text-emerald-500">Nova</span>Hub
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              Tenancy Master Console
            </Badge>
            <span className="text-white/30 text-xs font-medium">
              V 2.4.0 — Aprovisionamiento Real
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Dialog open={isTenantDialogOpen} onOpenChange={setIsTenantDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-xl shadow-emerald-900/40 px-8 h-12 rounded-2xl transition-all hover:scale-105 active:scale-95 font-bold">
                <Plus className="size-5" /> Registrar Empresa
              </Button>
            </DialogTrigger>
            <DialogContent className="border-white/5 sm:max-w-[500px] shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">{selectedTenant ? 'Editar Entidad' : 'Nueva Entidad Tenant'}</DialogTitle>
                <DialogDescription> Configura el entorno aislado para el cliente. </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-white/40 ml-1">Nombre Comercial</Label>
                    <Input 
                      placeholder="Empresa S.A." 
                      className="bg-white/5 border-white/10 h-11 rounded-xl" 
                      value={tenantForm.name}
                      onChange={e => {
                        const newName = e.target.value;
                        const autoSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                        setTenantForm({
                          ...tenantForm, 
                          name: newName,
                          slug: autoSlug // SIEMPRE auto-genera en tiempo real
                        });
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-white/40 ml-1">URL Personalizada (slug)</Label>
                    <Input 
                      placeholder="mi-empresa (auto-generado del nombre)" 
                      className="bg-white/5 border-white/10 h-11 rounded-xl" 
                      disabled={!!selectedTenant}
                      value={tenantForm.slug}
                      onChange={e => setTenantForm({...tenantForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})}
                    />
                    <p className="text-[9px] text-white/30 ml-1">{tenantForm.slug || 'auto'}.novahub.io</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-white/40 ml-1">Administrador de Cuenta</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <Input 
                      placeholder="Nombre Completo" 
                      className="bg-white/5 border-white/10 h-11 rounded-xl"
                      value={tenantForm.adminName}
                      onChange={e => setTenantForm({...tenantForm, adminName: e.target.value})}
                    />
                    <Input 
                      placeholder="correo@empresa.com" 
                      className="bg-white/5 border-white/10 h-11 rounded-xl"
                      value={tenantForm.adminEmail}
                      onChange={e => setTenantForm({...tenantForm, adminEmail: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-white/40 ml-1">Vertical de Industria</Label>
                    <Input 
                      placeholder="Ej: Retail, Manufactura, Tecnología, Salud..." 
                      className="bg-white/5 border-white/10 h-11 rounded-xl"
                      value={tenantForm.industry}
                      onChange={e => setTenantForm({...tenantForm, industry: e.target.value})}
                    />
                    <p className="text-[9px] text-white/30 ml-1">Cualquiera de las 50+ industrias disponibles</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-white/40 ml-1">Plan de Facturación</Label>
                    <Select value={tenantForm.plan} onValueChange={v => setTenantForm({...tenantForm, plan: v})}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-11 rounded-xl">
                        <SelectValue placeholder="Seleccionar plan..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BASICO">Básico - Funcionalidades esenciales</SelectItem>
                        <SelectItem value="PROFESIONAL">Profesional - Para empresas en crecimiento</SelectItem>
                        <SelectItem value="ENTERPRISE">Enterprise - Solución completa</SelectItem>
                        <SelectItem value="CUSTOM">Custom - Personalizado a medida</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[9px] text-white/30 ml-1">Selecciona el plan de facturación</p>
                  </div>
                </div>
                
                {/* Upload Logo */}
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-white/40 ml-1">Logo de Empresa (Opcional)</Label>
                  <div className="flex items-center gap-4">
                    {(logoPreview || tenantForm.logo) && (
                      <img src={logoPreview || tenantForm.logo} alt="Logo preview" className="size-16 rounded-xl object-cover border-2 border-white/10" />
                    )}
                    <Input 
                      type="file" 
                      accept="image/*"
                      className="bg-white/5 border-white/10 h-11 rounded-xl file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-emerald-500 file:text-white hover:file:bg-emerald-600"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLogoFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setLogoPreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                  <p className="text-[9px] text-white/30 ml-1">PNG, JPG o WEBP - Máx. 2MB</p>
                </div>
              </div>
              <DialogFooter className="gap-3">
                <Button variant="outline" className="border-white/5 rounded-xl h-11" onClick={() => { setIsTenantDialogOpen(false); setSelectedTenant(null); resetTenantForm(); }}>Cancelar</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-11 px-8 font-bold" onClick={selectedTenant ? handleUpdateTenant : handleCreateTenant}>
                  {selectedTenant ? 'Guardar Cambios' : 'Crear Entidad'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* --- STATS DASHBOARD --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Empresas Activas', value: (tenants || []).length, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Servicios Habilitados', value: (tenants || []).reduce((acc, t) => acc + (t.subscriptions?.length || 0), 0), icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Pendientes Revisión', value: (requests || []).filter(r => r.status === 'PENDING').length, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Crecimiento Mes', value: '+12%', icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="bg-card/50 border-border/50 hover:border-primary/20 transition-all group overflow-hidden relative backdrop-blur-md rounded-2xl shadow-sm">
              <div className={cn("absolute -top-2 -right-2 p-3 opacity-5 group-hover:opacity-10 transition-opacity", stat.color)}>
                <stat.icon className="size-20" />
              </div>
              <CardContent className="p-5 flex items-center gap-5 relative z-10">
                <div className={cn("p-3 rounded-2xl", stat.bg, stat.color)}>
                  <stat.icon className="size-6" />
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
                  <p className="text-3xl font-black text-foreground tabular-nums tracking-tighter">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Request Module Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="bg-card border-border text-card-foreground sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Solicitar Activación de Módulo</DialogTitle>
            <DialogDescription className="text-muted-foreground"> Envía una solicitud de habilitación para el cliente seleccionado. </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/10 border border-border/50">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Zap className="size-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Módulo a Habilitar</p>
                <p className="text-sm font-bold text-foreground">{AVAILABLE_MODULES.find(m => m.id === requestForm.module)?.label}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Precio de Venta Sugerido (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input 
                  type="number"
                  placeholder="0.00"
                  className="bg-muted/10 border-border/50 pl-9"
                  value={requestForm.price}
                  onChange={e => setRequestForm({...requestForm, price: Number(e.target.value)})}
                />
              </div>
              <p className="text-[10px] text-muted-foreground italic">Este precio será comunicado al cliente en su facturación.</p>
            </div>

            <div className="space-y-2">
              <Label>Notas o Requerimientos Especiales</Label>
              <Textarea 
                placeholder="Ej: El cliente necesita acceso a reportes personalizados..."
                className="bg-muted/10 border-border/50 min-h-[100px]"
                value={requestForm.notes}
                onChange={e => setRequestForm({...requestForm, notes: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border text-foreground hover:bg-muted/10" onClick={() => setIsRequestDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSubmitRequest}>Enviar Solicitud</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px] bg-[#111] border border-white/5 p-1 h-12">
          <TabsTrigger value="active" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest gap-2">
            <Building2 className="size-4" /> Gestión Empresas
          </TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white uppercase text-[10px] font-black tracking-widest gap-2">
            <Clock className="size-4" /> {user?.role === 'admin' ? 'Aprobaciones' : 'Solicitudes'}
            {requests.filter(r => r.status === 'PENDING').length > 0 && (
              <Badge className="bg-rose-500 text-[10px] size-5 p-0 flex items-center justify-center rounded-full ml-1 animate-pulse border-none">
                {requests.filter(r => r.status === 'PENDING').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6 space-y-6">
          <div className="flex items-center gap-4 bg-muted/10 p-3 rounded-xl border border-border/50">
            <Search className="size-5 text-muted-foreground ml-2" />
            <Input 
              placeholder="Buscar por Empresa, Cliente o Industria..." 
              className="bg-transparent border-none focus-visible:ring-0 text-foreground placeholder:text-muted-foreground"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredTenants.map(tenant => {
              const IndIcon = getIndustryIcon(tenant.industry);
              return (
                <Card key={tenant.id} className="bg-card border-border/50 hover:border-primary/20 transition-all overflow-hidden group">
                  <div className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      <div className="flex items-center gap-5">
                        <div className="size-16 rounded-2xl bg-muted/20 flex items-center justify-center border border-border group-hover:bg-primary/10 group-hover:border-primary/30 transition-all relative">
                          <IndIcon className="size-8 text-muted-foreground group-hover:text-primary" />
                          <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-background border border-border flex items-center justify-center">
                            <ShieldCheck className="size-3 text-primary" />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-foreground tracking-tight">{tenant.name}</h2>
                            <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-widest", getPlanColor(tenant.plan))}>
                              {tenant.plan}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-muted-foreground font-bold uppercase tracking-tighter">
                            <span className="flex items-center gap-1.5"><Globe className="size-3.5" /> {tenant.slug}.novahub.io</span>
                            <span className="flex items-center gap-1.5"><UserIcon className="size-3.5" /> {tenant._count?.users || 0} Usuarios</span>
                            <span className="flex items-center gap-1.5 text-emerald-500/50"><Zap className="size-3.5" /> {tenant.industry}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-white/20 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl"
                          onClick={() => openEditTenant(tenant)}
                        >
                          <Edit2 className="size-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-white/20 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl"
                          onClick={() => { setSelectedTenant(tenant); setIsUserDialogOpen(true); }}
                        >
                          <Users className="size-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-white/20 hover:text-purple-500 hover:bg-purple-500/10 rounded-xl"
                          onClick={() => handleViewDetails(tenant)}
                          title="Ver detalles"
                        >
                          <Eye className="size-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-white/20 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl"
                          onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                          title="Eliminar permanentemente"
                        >
                          <Trash2 className="size-5" />
                        </Button>
                      </div>

                      <div className="bg-muted/30 dark:bg-black/40 p-3 rounded-2xl border border-border/50">
                        <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest mb-2">Módulos Soportados</p>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                          {AVAILABLE_MODULES.map(mod => {
                            const isActive = tenant.subscriptions?.some((s: any) => s.module === mod.id && s.isActive);
                            const isPending = requests.some(r => r.clientTenantId === tenant.id && r.requestedModule === mod.id && r.status === 'PENDING');
                            const isExpanded = expandedModules[`${tenant.id}-${mod.id}`];
                            const hasSubmodules = mod.submodules && mod.submodules.length > 0;
                            
                            return (
                              <div key={mod.id} className="space-y-1">
                                {/* Módulo Principal */}
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => hasSubmodules 
                                      ? setExpandedModules(prev => ({ ...prev, [`${tenant.id}-${mod.id}`]: !isExpanded }))
                                      : handleToggleModule(tenant.id, mod.id, isActive)
                                    }
                                    disabled={isPending && !hasSubmodules}
                                    className={cn(
                                      "flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-tight transition-all",
                                      isActive 
                                        ? "bg-emerald-500 text-white border-emerald-400/50 shadow-lg shadow-emerald-500/10" 
                                        : isPending
                                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-500 border-amber-500/30 animate-pulse"
                                          : "bg-muted/50 text-muted-foreground/60 border-border/50 hover:border-primary/30 hover:text-foreground/80"
                                    )}
                                  >
                                    <mod.icon className={cn("size-3.5", isActive ? "text-white" : "text-muted-foreground/50")} />
                                    {mod.label}
                                    {isActive && !hasSubmodules && <Check className="size-3 ml-auto" />}
                                    {isPending && !hasSubmodules && <Clock className="size-3 ml-auto" />}
                                    {hasSubmodules && (
                                      <span className="ml-auto text-[8px] opacity-60">
                                        {isExpanded ? '▼' : '▶'} {mod.submodules.length} submódulos
                                      </span>
                                    )}
                                  </button>
                                </div>

                                {/* Submódulos Expandibles */}
                                {hasSubmodules && isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="pl-6 space-y-1"
                                  >
                                    {mod.submodules.map((sub: Submodule) => {
                                      const subIsActive = tenant.subscriptions?.some((s: any) => s.module === sub.id && s.isActive);
                                      const subIsPending = requests.some(r => r.clientTenantId === tenant.id && r.requestedModule === sub.id && r.status === 'PENDING');
                                      
                                      return (
                                        <button
                                          key={sub.id}
                                          onClick={() => handleToggleModule(tenant.id, sub.id, subIsActive)}
                                          disabled={subIsPending}
                                          className={cn(
                                            "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] font-bold uppercase tracking-tight transition-all",
                                            subIsActive 
                                              ? "bg-emerald-500/80 text-white border-emerald-400/40" 
                                              : subIsPending
                                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-500 border-amber-500/20 animate-pulse"
                                                : "bg-muted/30 text-muted-foreground/50 border-border/30 hover:border-primary/20 hover:text-foreground/70"
                                          )}
                                          title={sub.description}
                                        >
                                          <span className="size-1.5 rounded-full bg-current" />
                                          {sub.label}
                                          {subIsActive && <Check className="size-2.5 ml-auto" />}
                                          {subIsPending && <Clock className="size-2.5 ml-auto" />}
                                        </button>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <div className="grid grid-cols-1 gap-4">
            {requests.length === 0 ? (
              <Card className="bg-[#0a0a0a] border-dashed border-white/10 py-20">
                <div className="flex flex-col items-center justify-center text-center">
                  <Clock className="size-12 text-white/10 mb-4" />
                  <p className="text-white/60 font-bold uppercase tracking-widest text-xs">No hay solicitudes pendientes en este momento.</p>
                </div>
              </Card>
            ) : (
              requests.map((req) => (
                <Card key={req.id} className="bg-card border-border/50 overflow-hidden hover:border-primary/30 transition-all group">
                  <div className="flex flex-col md:flex-row items-center p-6 gap-6">
                    <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                      <LayoutGrid className="size-7 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-foreground uppercase tracking-tight">{req.requestedModule}</h3>
                        <Badge variant="outline" className={cn(
                          "uppercase text-[10px] font-black tracking-widest",
                          req.status === 'PENDING' ? "text-amber-500 border-amber-500/30 bg-amber-500/5" :
                          req.status === 'APPROVED' ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" :
                          "text-rose-500 border-rose-500/30 bg-rose-500/5"
                        )}>
                          {req.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground uppercase font-bold tracking-tighter">
                        <span className="flex items-center gap-1"><Building2 className="size-3" /> {req.clientTenant?.name}</span>
                        <span className="flex items-center gap-1"><ShieldCheck className="size-3" /> Partner: {req.partner?.name || 'Sistema'}</span>
                        <span className="flex items-center gap-1 text-primary/80"><DollarSign className="size-3" /> Precio Proyectado: ${req.customPrice || 0}</span>
                      </div>
                      {req.notes && (
                         <div className="mt-3 p-3 rounded-lg bg-muted/10 border border-border/50 flex gap-3">
                           <MessageSquare className="size-4 text-muted-foreground/50 shrink-0" />
                           <p className="text-xs text-muted-foreground leading-relaxed italic">"{req.notes}"</p>
                         </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                       {user?.role === 'admin' && req.status === 'PENDING' ? (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleReject(req.id)}
                            className="bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500 hover:text-white uppercase text-[10px] font-black px-4"
                          >
                            Rechazar
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => handleApprove(req.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 uppercase text-[10px] font-black px-4"
                          >
                            Aprobar
                          </Button>
                        </>
                       ) : (
                         <Button variant="ghost" disabled className="text-white/20 uppercase text-[10px] font-black tracking-widest italic">
                           {req.status === 'PENDING' ? 'En espera de revisión' : 'Solicitud Finalizada'}
                         </Button>
                       )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5 text-blue-500" />
              Gestión de Usuarios: {selectedTenant?.name}
            </DialogTitle>
            <DialogDescription>Listado de colaboradores con acceso a este tenant.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {(selectedTenant?.users || []).map((u: any) => (
              <div key={u.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/10 border border-border/50 transition-all hover:border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {u.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] uppercase font-black tracking-widest px-3 py-1">
                  {u.role}
                </Badge>
              </div>
            ))}
            {(!selectedTenant?.users || selectedTenant.users.length === 0) && (
              <p className="text-center py-10 text-muted-foreground uppercase text-xs font-black tracking-widest italic">No hay usuarios registrados</p>
            )}
            
            {/* Agregar Nuevo Usuario */}
            <div className="border-t border-border/50 pt-4 mt-4">
              <h4 className="text-sm font-bold mb-3 uppercase tracking-wide">Agregar Nuevo Usuario</h4>
              <div className="space-y-3">
                <Input 
                  placeholder="Nombre completo" 
                  value={userForm.name} 
                  onChange={e => setUserForm({...userForm, name: e.target.value})}
                  className="bg-muted/10 border-border/50 rounded-xl"
                />
                <Input 
                  type="email" 
                  placeholder="Email" 
                  value={userForm.email} 
                  onChange={e => setUserForm({...userForm, email: e.target.value})}
                  className="bg-muted/10 border-border/50 rounded-xl"
                />
                <Input 
                  type="password" 
                  placeholder="Contraseña (opcional - DefaultPass123!)" 
                  value={userForm.password} 
                  onChange={e => setUserForm({...userForm, password: e.target.value})}
                  className="bg-muted/10 border-border/50 rounded-xl"
                />
                <Select value={userForm.role} onValueChange={v => setUserForm({...userForm, role: v})}>
                  <SelectTrigger className="bg-muted/10 border-border/50 rounded-xl">
                    <SelectValue placeholder="Seleccionar rol..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {PREDEFINED_ROLES.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex flex-col">
                          <span className="font-bold">{role.name}</span>
                          <span className="text-xs text-muted-foreground">{role.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Upload Foto Perfil (Opcional) */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground">Foto de Perfil (Opcional)</Label>
                  <div className="flex items-center gap-3">
                    {avatarPreview && (
                      <img src={avatarPreview} alt="Avatar preview" className="size-12 rounded-full object-cover border-2 border-primary/20" />
                    )}
                    <Input 
                      type="file" 
                      accept="image/*"
                      className="bg-muted/10 border-border/50 rounded-xl file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-500 file:text-white hover:file:bg-blue-600"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAvatarFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => setAvatarPreview(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleAddUser}
                  disabled={uploading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase text-xs tracking-wide disabled:opacity-50"
                >
                  {uploading ? 'Subiendo...' : <><Plus className="size-4 mr-2" />Agregar Usuario</>}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full rounded-xl border-border text-foreground" onClick={() => setIsUserDialogOpen(false)}>Cerrar Panel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Detalles de Empresa */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto border-white/5">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
              <Building2 className="size-6 text-emerald-500" />
              Detalles: {tenantDetails?.name}
            </DialogTitle>
            <DialogDescription>Información completa de la empresa y su historial</DialogDescription>
          </DialogHeader>
          
          {tenantDetails && (
            <div className="space-y-6 py-4">
              {/* Info General */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-2">ID Sistema</p>
                  <p className="text-sm font-mono text-foreground">{tenantDetails.id}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-2">Slug URL</p>
                  <p className="text-sm font-bold text-emerald-500">{tenantDetails.slug}.novahub.io</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-2">Industria</p>
                  <p className="text-sm font-bold text-foreground">{tenantDetails.industry}</p>
                </div>
                <div className="p-4 rounded-xl bg-muted/20 border border-border/50">
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground mb-2">Plan</p>
                  <p className="text-sm font-bold text-foreground">{tenantDetails.plan}</p>
                </div>
              </div>

              {/* Módulos Activos */}
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3">Módulos Habilitados</h3>
                <div className="flex flex-wrap gap-2">
                  {tenantDetails.subscriptions && tenantDetails.subscriptions.length > 0 ? (
                    tenantDetails.subscriptions.map((sub: any) => (
                      <Badge key={sub.id} className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs font-bold uppercase">
                        <Check className="size-3 mr-1" /> {sub.module}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-xs italic">Sin módulos habilitados</p>
                  )}
                </div>
              </div>

              {/* Usuarios */}
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3">Usuarios ({tenantDetails._count?.users || 0})</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {tenantDetails.users && tenantDetails.users.length > 0 ? (
                    tenantDetails.users.map((u: any) => (
                      <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-border/50">
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {u.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-foreground text-sm">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase font-black">{u.role}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-xs italic">Sin usuarios registrados</p>
                  )}
                </div>
              </div>

              {/* Historial de Solicitudes */}
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3">Historial de Solicitudes</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {requests.filter(r => r.clientTenantId === tenantDetails.id).length > 0 ? (
                    requests.filter(r => r.clientTenantId === tenantDetails.id).map((req) => (
                      <div key={req.id} className="p-3 rounded-xl bg-muted/10 border border-border/50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-foreground text-sm">{req.requestedModule}</p>
                            <p className="text-xs text-muted-foreground">{req.notes || 'Sin notas'}</p>
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[10px] uppercase font-black",
                            req.status === 'PENDING' ? "text-amber-500 border-amber-500/30" :
                            req.status === 'APPROVED' ? "text-emerald-500 border-emerald-500/30" :
                            "text-rose-500 border-rose-500/30"
                          )}>
                            {req.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-xs italic">Sin historial de solicitudes</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setIsDetailsDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
