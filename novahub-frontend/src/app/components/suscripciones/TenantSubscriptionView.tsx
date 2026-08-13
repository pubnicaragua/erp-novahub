import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Zap, Building2, CircleHelp, Globe, User as UserIcon, LayoutGrid, Check, Clock, Plus, ShieldCheck, DollarSign, MessageSquare, Users, Edit2, Trash2, KeyRound, X, Mail, Shield, MapPin, Store, Info, Crown, Link2, UserRoundCheck, GitBranch
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../ui/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { TeamAccessPanel } from './TeamAccessPanel';
import { DepartmentsView } from './DepartmentsView';
import { OrgChartView } from './OrgChartView';
import { SucursalesView } from '../inventory/SucursalesView';
import { DominiosView } from './DominiosView';
import { TrialCountdownBanner } from '../auth/TrialCountdownBanner';
import { tenantsService } from '../../services/tenants.service';
import { hrService } from '../../services/hr.service';
import { usersService } from '../../services/users.service';
import { inventoryService } from '../../services/inventario.service';
import { brandingService } from '../../services/branding.service';
import { authService } from '../../services/auth.service';
import { api } from '../../services/api';
import { cajaService } from '../../services/caja.service';
import { toast } from 'sonner';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { ALL_PERM_MODULES, normalizePermissions } from '../ConfiguracionPage';
import { getPasswordError, isValidEmail, normalizeEmail } from '../../utils/accountValidation';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { pendingUserCreate, clearPendingUserCreate } from '../../utils/pendingUserCreate';

interface TenantSubscriptionViewProps {
  tenant: any;
  availableModules: any[];
  requests: any[];
  customRoles?: any[];
  onRequestModule: (moduleId: string, notes: string) => void;
  onRefresh: () => void;
}

const SYSTEM_ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administrador', description: 'Acceso total a todos los módulos' },
  { value: 'EMPLOYEE', label: 'Colaborador', description: 'Acceso limitado según rol personalizado asignado' },
];

const TEAM_TOUR_STEPS: GuidedTourStep[] = [
  { target: '[data-tour="team-users"]', title: 'Usuarios', description: 'Desde aquí puedes crear y administrar las personas que tienen acceso a la empresa, su tipo de acceso, rol, contraseña y estado.', placement: 'right' },
  { target: '[data-tour="team-roles"]', title: 'Roles y permisos', description: 'Los roles agrupan permisos para que puedas asignar rápidamente qué módulos y acciones puede utilizar cada usuario.', placement: 'left' },
  { target: '[data-tour="team-departments"]', title: 'Departamentos', description: 'Crea áreas de trabajo y asigna usuarios a cada departamento para mantener organizado el equipo.', placement: 'bottom' },
];

const linkedEmployeePuesto = (user: any, employees: any[]) => {
  if (!user?.employee?.id) return '';
  const employee = employees.find((e: any) => e.id === user.employee.id) || user.employee;
  return employee.position?.title || employee.position || '';
};

export function TenantSubscriptionView({ tenant, availableModules, requests, customRoles = [], onRequestModule, onRefresh }: TenantSubscriptionViewProps) {
  const { updateConfig } = useTheme();
  const { user: currentUser, canPerform } = useAuth();
  const canViewCompany = canPerform('CONFIG_COMPANY', 'view');
  const canEditCompany = canPerform('CONFIG_COMPANY', 'edit');
  const canCreateCompany = canPerform('CONFIG_COMPANY', 'create');
  const canDeactivateCompany = canPerform('CONFIG_COMPANY', 'deactivate');
  const canCreateUsers = canPerform('CONFIG_USERS', 'create');
  const canEditUsers = canPerform('CONFIG_USERS', 'edit');
  const canDeactivateUsers = canPerform('CONFIG_USERS', 'deactivate');
  const canViewUsers = canPerform('CONFIG_USERS', 'view');
  const canManageRoles = canPerform('CONFIG_ROLES', 'edit');
  const canViewRoles = canPerform('CONFIG_ROLES', 'view');
  const canViewDepartments = canPerform('CONFIG_DEPARTMENTS', 'view');
  const canViewOrgChart = canPerform('CONFIG_ORG_CHART', 'view');
  const canEditEmployees = canPerform('HR_EMPLOYEES', 'edit');
  const canViewEmployees = canPerform('HR_EMPLOYEES', 'view');
  const canViewCompanyBranches = canPerform('COMPANY_BRANCHES', 'view');
  const canViewLegacyBranches = canPerform('INVENTORY_WAREHOUSES', 'view');
  const branchPermissionModule = canViewCompanyBranches ? 'COMPANY_BRANCHES' : 'INVENTORY_WAREHOUSES';
  const canViewWarehouses = canViewCompanyBranches || canViewLegacyBranches;
  const canViewDomains = canPerform('CONFIG_DOMAINS', 'view');
  const canViewSubscriptions = canPerform('SUBSCRIPTIONS', 'view');
  const canRequestModules = canPerform('SUBSCRIPTIONS', 'create');
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isPermsDialogOpen, setIsPermsDialogOpen] = useState(false);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [showDepartmentsView, setShowDepartmentsView] = useState(false);
  const [showOrgChartView, setShowOrgChartView] = useState(false);
  const [showTeamTutorial, setShowTeamTutorial] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [linkingUser, setLinkingUser] = useState<any>(null);
  const [linkingEmployeeId, setLinkingEmployeeId] = useState('');
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('OTHER');
  const [industryOptions, setIndustryOptions] = useState<{ id?: string; code: string; name: string; isDefault: boolean }[]>([]);
  const [newIndustryName, setNewIndustryName] = useState('');
  const [showAddIndustry, setShowAddIndustry] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'EMPLOYEE' });
  const [uploading, setUploading] = useState(false);

  const [newPasswordForUser, setNewPasswordForUser] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [userEmailError, setUserEmailError] = useState('');
  const [checkingUserEmail, setCheckingUserEmail] = useState(false);
  const [showEmployeeGuard, setShowEmployeeGuard] = useState(false);
  const [userDialogMode, setUserDialogMode] = useState<'plain' | 'withEmployee'>('plain');
  const [selectedCreateEmployeeId, setSelectedCreateEmployeeId] = useState('');
  const [activeTab, setActiveTab] = useState('general');

  const { data: tenantData, isLoading: tenantDataLoading, refetch: refetchTenantData } = useTenantQuery(
    ['my-company-detail', tenant?.id || 'none'],
    async (signal) => {
      if (!tenant?.id) return null;
      const [usersRes, warehouseRes, branding, industriesRes, employeesRes] = await Promise.all([
        canViewUsers ? tenantsService.getUsers(tenant.id, signal) : Promise.resolve([]),
        canViewWarehouses ? inventoryService.getWarehouses(signal) : Promise.resolve([]),
        (canViewCompany || canPerform('CONFIG_BRANDING', 'view')) ? brandingService.getCurrent(signal) : Promise.resolve(null),
        canViewCompany ? api.get<any[]>(`/tenants/${tenant.id}/industries`, { signal }) : Promise.resolve([]),
        (canViewEmployees || canEditEmployees) ? hrService.getEmployees({ status: 'ACTIVE', pageSize: 500 }, signal) : Promise.resolve([]),
      ]);
      return { users: asList(usersRes), warehouses: asList(warehouseRes), branding, industries: asList(industriesRes), employees: asList(employeesRes) };
    },
    { enabled: Boolean(tenant?.id), onError: (error) => toast.error(error.message || 'Error cargando Mi Empresa') },
  );

  useEffect(() => {
    setLoadingUsers(tenantDataLoading);
    if (!tenant) return;
    setCompanyName(tenantData?.branding?.companyName || tenant.name || '');
    setCompanySlug(tenant.slug || '');
    setCompanyIndustry(tenantData?.branding?.industry || tenant.industry || 'OTHER');
    if (!tenantData) return;
    setUsers(tenantData.users);
    setEmployees(tenantData.employees || []);
    setWarehouses(tenantData.warehouses);
    setIndustryOptions(tenantData.industries);
  }, [tenant, tenantData, tenantDataLoading]);

  useEffect(() => {
    if (pendingUserCreate.returnToUserModal && pendingUserCreate.returnToEmployeeId) {
      setActiveTab('team');
      setUserDialogMode('withEmployee');
      setSelectedCreateEmployeeId(pendingUserCreate.returnToEmployeeId);
      setUserForm((current) => ({
        ...current,
        name: pendingUserCreate.returnEmployee?.name || current.name,
        email: pendingUserCreate.returnEmployee?.email || current.email,
      }));
      setIsUserDialogOpen(true);
      clearPendingUserCreate();
    }
  }, []);

  const visibleTabs = useMemo(() => [
    ...(canViewCompany ? ['general'] : []),
    ...(canViewSubscriptions ? ['plan'] : []),
    ...((canViewUsers || canViewRoles) ? ['team'] : []),
    ...(canViewWarehouses ? ['sucursales'] : []),
    ...(canViewDomains ? ['dominio'] : []),
  ], [canViewCompany, canViewSubscriptions, canViewUsers, canViewRoles, canViewWarehouses, canViewDomains]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0] || 'general');
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (userDialogMode !== 'withEmployee' || !selectedCreateEmployeeId) return;
    const employee = employees.find((e: any) => e.id === selectedCreateEmployeeId);
    if (employee) {
      const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
      setUserForm((current) => ({
        ...current,
        name: fullName || current.name,
        email: employee.email || current.email,
      }));
    }
  }, [selectedCreateEmployeeId, employees, userDialogMode]);

  useEffect(() => {
    const email = normalizeEmail(userForm.email);
    setUserEmailError('');
    if (!email || !isValidEmail(email)) {
      setCheckingUserEmail(false);
      return;
    }
    const duplicateInList = users.some(existing => normalizeEmail(existing.email) === email);
    if (duplicateInList) {
      setUserEmailError('Este correo ya está en uso. Escribe otro.');
      setCheckingUserEmail(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setCheckingUserEmail(true);
      try {
        const response: any = await authService.checkEmail(email);
        const exists = response?.data?.exists ?? response?.exists;
        setUserEmailError(exists ? 'Este correo ya está en uso. Escribe otro.' : '');
      } catch {
        setUserEmailError('No se pudo verificar el correo. Intenta nuevamente.');
      } finally {
        setCheckingUserEmail(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [userForm.email, users]);

  const handleAddIndustry = async () => {
    if (!canCreateCompany) return;
    const name = newIndustryName.trim();
    if (!name || !tenant?.id) return;
    try {
      const code = name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      await api.post(`/tenants/${tenant.id}/industries`, { name, code });
      setNewIndustryName('');
      setShowAddIndustry(false);
      await refetchTenantData();
      toast.success('Industria agregada correctamente');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al agregar industria');
    }
  };

  const handleDeleteIndustry = async (id: string) => {
    if (!canDeactivateCompany) return;
    try {
      await api.delete(`/tenants/${tenant.id}/industries/${id}`);
      setIndustryOptions((current) => current.filter((industry) => industry.id !== id));
      toast.success('Industria eliminada');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al eliminar industria');
    }
  };

  const handleSaveCompanyInfo = async () => {
    if (!canEditCompany) return;
    if (!companyName.trim()) {
      toast.error('El nombre de la empresa es obligatorio');
      return;
    }
    try {
      setSavingCompany(true);
      await Promise.all([
        brandingService.update({ companyName: companyName.trim(), industry: companyIndustry }),
        tenantsService.update(tenant.id, { name: companyName.trim(), slug: companySlug.trim() }),
      ]);
      updateConfig({ tenantName: companyName.trim() });
      toast.success('Información general actualizada');
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al guardar la información');
    } finally {
      setSavingCompany(false);
    }
  };

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
    if (!canManageRoles) return;
    try {
      await tenantsService.updateUser(tenant.id, userId, { customRoleId: customRoleId === 'none' ? null : customRoleId } as any);
      toast.success('Rol personalizado actualizado');
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al asignar rol');
    }
  };

  const handleViewPerms = (user: any) => {
    setSelectedUser(user);
    setIsPermsDialogOpen(true);
  };

  const handleOpenChangePassword = (user: any) => {
    if (!canEditUsers) return;
    setSelectedUser(user);
    setNewPasswordForUser('');
    setIsChangePasswordDialogOpen(true);
  };

  const handleAdminChangePassword = async () => {
    if (!canEditUsers) return;
    const passwordError = getPasswordError(newPasswordForUser);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    if (!selectedUser?.id) return;

    try {
      setUpdatingPassword(true);
      await usersService.changePassword(selectedUser.id, newPasswordForUser);
      toast.success('Contraseña del usuario actualizada correctamente');
      setIsChangePasswordDialogOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al cambiar la contraseña');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleLinkEmployee = async () => {
    if (!canEditEmployees) return;
    if (!linkingUser?.id || !linkingEmployeeId) return;
    try {
      await tenantsService.linkUserToEmployee(tenant.id, linkingUser.id, linkingEmployeeId);
      toast.success('Usuario vinculado al empleado');
      setLinkingUser(null);
      setLinkingEmployeeId('');
      await fetchUsers();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No se pudo vincular el empleado');
    }
  };

  const handleUnlinkEmployee = async (user: any) => {
    if (!canEditEmployees) return;
    try {
      await tenantsService.unlinkUserFromEmployee(tenant.id, user.id);
      toast.success('Vínculo con empleado eliminado');
      await fetchUsers();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No se pudo quitar el vínculo');
    }
  };

  if (!tenant) return (
    <div className="p-20 flex flex-col items-center justify-center text-muted-foreground italic">
      <Clock className="size-12 mb-4 opacity-20 animate-pulse" />
      Cargando información de suscripción...
    </div>
  );

  const handleAddUser = async () => {
    if (!canCreateUsers) return;
    if (!userForm.name || !userForm.email) {
      toast.error('Complete nombre y email');
      return;
    }
    const passwordError = getPasswordError(userForm.password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    if (userEmailError || checkingUserEmail || !isValidEmail(userForm.email)) {
      toast.error(userEmailError || 'Escribe un correo válido y disponible');
      return;
    }
    if (userDialogMode === 'withEmployee' && !selectedCreateEmployeeId) {
      toast.error('Selecciona el empleado a vincular');
      return;
    }
    try {
      setUploading(true);
      const createdResponse: any = await tenantsService.addUser({
        clientTenantId: tenant.id,
        name: userForm.name,
        email: normalizeEmail(userForm.email),
        password: userForm.password,
        role: userForm.role,
      });
      const createdUser = createdResponse?.data || createdResponse;
      const createdUserId = createdUser?.id || users.find((u) => normalizeEmail(u.email) === normalizeEmail(userForm.email))?.id;
      let linked = false;
      if (selectedCreateEmployeeId) {
        if (createdUserId) {
          try {
            await tenantsService.linkUserToEmployee(tenant.id, createdUserId, selectedCreateEmployeeId);
            linked = true;
          } catch {
            linked = false;
          }
        } else {
          toast.error('Usuario creado pero no se pudo vincular el empleado automáticamente');
        }
      }
      toast.success(linked ? 'Usuario creado y vinculado al empleado' : 'Usuario agregado correctamente');
      setUserForm({ name: '', email: '', password: '', role: 'EMPLOYEE' });
      setSelectedCreateEmployeeId('');
      setUserDialogMode('plain');
      setIsUserDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al agregar usuario');
    } finally {
      setUploading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    if (!canDeactivateUsers) return;
    try {
      await tenantsService.updateUser(tenant.id, userId, { isActive: !currentStatus });
      toast.success(currentStatus ? 'Usuario desactivado' : 'Usuario activado');
      fetchUsers();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar estado');
    }
  };

  const handleRequestClick = (mod: any) => {
    if (!canRequestModules) return;
    setSelectedModule(mod);
    setIsRequestDialogOpen(true);
  };

  const submitRequest = () => {
    if (selectedModule && canRequestModules) {
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
    return tenant?.subscriptions?.some((s: any) => s.module === modId && s.isActive);
  };

  const isModulePending = (modId: string) => {
    return requests.some((r: any) => r.clientTenantId === tenant?.id && r.requestedModule === modId && r.status === 'PENDING');
  };

  if (!tenant) {
    return <div className="mx-auto flex min-h-[320px] max-w-3xl items-center justify-center p-6 text-center text-sm text-muted-foreground">Cargando la información de Mi Empresa...</div>;
  }

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto min-h-screen">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-foreground flex items-center gap-3 uppercase italic">
            <Zap className="size-10 text-primary fill-primary/20" />
             Mi Empresa
          </h1>
           <p className="text-muted-foreground font-medium mt-2">Gestiona la suscripción, el equipo y la estructura de {tenant.name}.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={cn("text-[12px] font-black uppercase tracking-widest px-4 py-1.5 h-10 flex items-center", getPlanColor(tenant.plan))}>
            Plan {tenant.plan}
          </Badge>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <TrialCountdownBanner />
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/20 border border-border/50 p-1 h-auto min-h-12 mb-8 flex flex-wrap">
          {canViewCompany && <TabsTrigger value="general" className="px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase text-[10px] tracking-widest gap-2">
            <Building2 className="size-4" /> General
          </TabsTrigger>}
          {canViewSubscriptions && <TabsTrigger value="plan" className="px-8 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase text-[10px] tracking-widest gap-2">
            <LayoutGrid className="size-4" /> Módulos y Plan
          </TabsTrigger>}
          {(canViewUsers || canViewRoles) && <TabsTrigger value="team" className="px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase text-[10px] tracking-widest gap-2">
            <Users className="size-4" /> Mi Equipo ({users.length})
          </TabsTrigger>}
          {canViewWarehouses && <TabsTrigger value="sucursales" className="px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase text-[10px] tracking-widest gap-2">
            <Store className="size-4" /> Sucursales
          </TabsTrigger>}
          {canViewDomains && <TabsTrigger value="dominio" className="px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase text-[10px] tracking-widest gap-2">
            <Globe className="size-4" /> Dominio propio
          </TabsTrigger>}
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><Building2 className="size-5 text-primary" />Datos generales</CardTitle>
                <CardDescription>Información principal de {tenant.name}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre de la empresa</Label>
                    <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} disabled={!canEditCompany} placeholder="Ej: Empresa Demo S.A." className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Slug / Identificador</Label>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-muted px-3 py-2 text-sm font-mono text-muted-foreground">novahub.io/</span>
                    <Input value={companySlug} onChange={(event) => setCompanySlug(event.target.value)} disabled={!canEditCompany} className="h-11 rounded-xl font-mono" placeholder="empresa-demo" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Identificador único de tu empresa dentro de NovaHub.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Industria</Label>
                  <select value={companyIndustry} onChange={(event) => setCompanyIndustry(event.target.value)} disabled={!canEditCompany} className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {industryOptions.length > 0 ? (
                      <>
                        <optgroup label="Predeterminadas">
                          {industryOptions.filter((industry) => industry.isDefault).map((industry) => <option key={industry.code} value={industry.code}>{industry.name}</option>)}
                        </optgroup>
                        {industryOptions.some((industry) => !industry.isDefault) && <optgroup label="Personalizadas">
                          {industryOptions.filter((industry) => !industry.isDefault).map((industry) => <option key={industry.code} value={industry.code}>{industry.name}</option>)}
                        </optgroup>}
                      </>
                    ) : (
                      <>
                        <option value="RETAIL">Comercio / Retail</option>
                        <option value="SERVICES">Servicios profesionales</option>
                        <option value="TECHNOLOGY">Tecnología</option>
                        <option value="OTHER">Otro</option>
                      </>
                    )}
                  </select>
                  {industryOptions.filter((industry) => !industry.isDefault).length > 0 && <div className="flex flex-wrap gap-1.5">
                    {industryOptions.filter((industry) => !industry.isDefault).map((industry) => <Badge key={industry.id} variant="secondary" className="gap-1 pr-1 text-[10px] font-bold">
                      {industry.name}
                      {canDeactivateCompany && <button onClick={() => industry.id && void handleDeleteIndustry(industry.id)} className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-destructive/20 hover:text-destructive"><Trash2 className="size-2.5" /></button>}
                    </Badge>)}
                  </div>}
                  {canCreateCompany && (showAddIndustry ? <div className="flex gap-2">
                    <Input value={newIndustryName} onChange={(event) => setNewIndustryName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void handleAddIndustry()} placeholder="Ej: Logística y Transporte" className="h-9 flex-1 rounded-xl text-xs" autoFocus />
                    <Button size="sm" onClick={() => void handleAddIndustry()} className="h-9 rounded-xl text-xs font-bold">Agregar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowAddIndustry(false); setNewIndustryName(''); }} className="h-9 text-xs">Cancelar</Button>
                  </div> : <button onClick={() => setShowAddIndustry(true)} className="flex items-center gap-1.5 text-xs font-bold text-primary transition-colors hover:text-primary/80"><Plus className="size-3.5" />Agregar nueva industria</button>)}
                </div>
                {canEditCompany && <Button onClick={() => void handleSaveCompanyInfo()} disabled={savingCompany} className="h-11 w-full gap-2 rounded-xl font-bold">
                  {savingCompany ? 'Guardando...' : 'Guardar información'}
                </Button>}
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><Info className="size-5 text-primary" />Resumen de la empresa</CardTitle>
                <CardDescription>Datos de referencia de tu cuenta.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {[
                  { label: 'Tenant ID', value: tenant.id, mono: true },
                  { label: 'Slug activo', value: tenant.slug || companySlug || 'N/A', mono: true },
                  { label: 'Usuarios', value: String(users.length), mono: false },
                  { label: 'Plan actual', value: tenant.plan || 'BASIC', mono: false },
                ].map(({ label, value, mono }) => <div key={label} className="flex items-center justify-between rounded-xl border border-border/30 bg-muted/20 p-3">
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                  <span className={cn('text-xs font-bold', mono && 'font-mono')}>{value}</span>
                </div>)}
                <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                  <div><p className="text-xs font-black uppercase tracking-widest text-primary">Estado</p><p className="mt-0.5 text-2xl font-black">Activa</p></div>
                  <Crown className="size-7 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plan" className="space-y-8">
          {/* Plan Card */}
          <Card className="bg-card border-border/50 overflow-hidden relative shadow-sm">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <CardContent className="p-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
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
                                {canRequestModules && !subActive && !subPending && (
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

                    {canRequestModules && !hasSubmodules && !isMainActive && !isMainPending && (
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

         <TabsContent value="team" className="space-y-4">
          {showOrgChartView ? <OrgChartView tenantId={tenant.id} tenantName={tenant.name} employees={employees} users={users} onBack={() => setShowOrgChartView(false)} onDataChange={async () => { await refetchTenantData(); }} /> : showDepartmentsView ? <DepartmentsView tenantId={tenant.id} users={users} employees={employees} onBack={() => setShowDepartmentsView(false)} onDataChange={async () => { await refetchTenantData(); }} onLinkUserToEmployee={(user) => { setLinkingUser(user); setLinkingEmployeeId(''); }} /> : <>
            <div className="flex justify-end">
             <div className="flex items-center gap-2">
              {canViewUsers && <Button data-tour="team-tutorial" variant="outline" className="gap-2 font-bold" onClick={() => setShowTeamTutorial(true)}>
                <CircleHelp className="size-4" /> Tutorial
              </Button>}
              {canViewUsers && canViewEmployees && canViewDepartments && <Button data-tour="team-departments" variant="outline" className="gap-2 font-bold" onClick={() => setShowDepartmentsView(true)}>
              <Building2 className="size-4" /> Departamentos
              </Button>}
              {canViewUsers && canViewEmployees && canViewOrgChart && <Button variant="outline" className="gap-2 font-bold" onClick={() => setShowOrgChartView(true)}>
              <GitBranch className="size-4" /> Organigrama
              </Button>}
            </div>
           </div>

          <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
            {canViewUsers && <Card className="h-full border-border/50" data-tour="team-users">
              <CardHeader className="flex-row items-center justify-between gap-4 border-b border-border/30 bg-muted/10 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider"><Users className="size-4 text-primary" /> Usuarios ({users.length})</CardTitle>
                  <CardDescription className="mt-1 text-xs">Administra las personas que tienen acceso a la empresa.</CardDescription>
                </div>
                {canCreateUsers && <Button size="sm" className="h-8 shrink-0 gap-1.5 text-xs" onClick={() => setShowEmployeeGuard(true)}>
                  <Plus className="size-4" /> Crear usuario
                </Button>}
              </CardHeader>
              <CardContent className="space-y-2 p-4">
            {users.map((u) => {
              const isCurrentUser = currentUser?.id === u.id;
              return <div key={u.id} className={cn('space-y-3 rounded-lg bg-muted/20 px-4 py-3 transition-colors', isCurrentUser ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-muted/40')}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl font-black text-lg', isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')}>
                      {u.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-sm font-bold text-foreground">{u.name}</h4>
                        {isCurrentUser && <Badge className="bg-primary text-primary-foreground text-[9px] uppercase">Tu usuario</Badge>}
                      </div>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><Mail className="size-3" /> {u.email}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-primary/80">{u.departments?.map((department: any) => department.name).join(' · ') || u.department?.name || 'Sin departamento'}</p>
                      {u.employee ? <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-600"><UserRoundCheck className="size-3" /> Empleado: {u.employee.firstName} {u.employee.lastName}{linkedEmployeePuesto(u, employees) ? <span className="normal-case"> · Puesto: {linkedEmployeePuesto(u, employees)}</span> : <span className="font-semibold text-muted-foreground"> · Sin puesto</span>}</p> : <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><UserRoundCheck className="size-3" /> Sin puesto</p>}
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0 text-[10px] font-black uppercase tracking-widest', u.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20')}>
                    {u.isActive ? 'Activo' : 'Suspendido'}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-[52px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tipo</span>
                    <Select value={u.role?.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE'} onValueChange={async (val) => {
                      try {
                        await tenantsService.updateUser(tenant.id, u.id, { role: val });
                        if (val === 'ADMIN') await tenantsService.updateUser(tenant.id, u.id, { customRoleId: null } as any);
                        toast.success('Tipo de acceso actualizado');
                        fetchUsers();
                      } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
                    }} disabled={!canEditUsers}>
                      <SelectTrigger className="h-8 w-[122px] bg-primary/5 text-[10px] font-bold uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent>{SYSTEM_ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value} className="text-[10px] font-bold uppercase">{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {canManageRoles && u.role?.toUpperCase() !== 'ADMIN' && <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Rol</span>
                    <Select value={u.customRoleId || 'none'} onValueChange={(val) => handleUpdateCustomRole(u.id, val)}>
                      <SelectTrigger className="h-8 w-[132px] bg-purple-500/5 text-[10px] font-bold uppercase text-purple-600"><SelectValue placeholder="Ninguno" /></SelectTrigger>
                      <SelectContent><SelectItem value="none" className="text-[10px] font-bold uppercase">Ninguno</SelectItem>{customRoles.map(r => <SelectItem key={r.id} value={r.id} className="text-[10px] font-bold uppercase">{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>}

                  {canEditUsers && u.role?.toUpperCase() !== 'ADMIN' && <Button variant="outline" size="sm" className="h-8 gap-1.5 border-orange-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-orange-500/10 hover:text-orange-500" onClick={() => handleOpenChangePassword(u)} title="Cambiar contraseña"><KeyRound className="size-3" /> Contraseña</Button>}
                  {canEditEmployees && (u.employee ? <Button variant="outline" size="sm" className="h-8 gap-1.5 border-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-500/10" onClick={() => void handleUnlinkEmployee(u)} title="Desvincular empleado"><UserRoundCheck className="size-3" /> Empleado vinculado</Button> : <Button variant="outline" size="sm" className="h-8 gap-1.5 border-amber-500/20 text-[10px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-500/10" onClick={() => { setLinkingUser(u); setLinkingEmployeeId(''); }} title="Vincular empleado"><Link2 className="size-3" /> Vincular empleado</Button>)}
                  {(canViewUsers || canViewRoles) && <Button variant="outline" size="sm" className="h-8 gap-1.5 border-primary/10 text-[10px] font-black uppercase tracking-widest hover:bg-primary/5 hover:text-primary" onClick={() => handleViewPerms(u)}><Shield className="size-3" /> Permisos</Button>}
                  {canDeactivateUsers && <Button variant="ghost" size="sm" disabled={isCurrentUser} className={cn('h-8 gap-1.5 text-[10px] font-black uppercase tracking-widest', isCurrentUser ? 'cursor-not-allowed text-muted-foreground/50' : u.isActive ? 'hover:bg-rose-500/10 hover:text-rose-500' : 'hover:bg-emerald-500/10 hover:text-emerald-500')} onClick={() => !isCurrentUser && toggleUserStatus(u.id, u.isActive)} title={isCurrentUser ? 'No puedes suspenderte a ti mismo' : u.isActive ? 'Suspender usuario' : 'Activar usuario'}>
                    {u.isActive ? <><X className="size-3" /> {isCurrentUser ? 'Tu usuario' : 'Suspender'}</> : <><Check className="size-3" /> Activar</>}
                  </Button>}
                </div>
              </div>;
            })}
                {!users.length && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Aún no hay usuarios creados.</div>}
              </CardContent>
            </Card>}

            {canViewRoles && <TeamAccessPanel tenantId={tenant.id} tenantName={tenant.name} users={users} onRolesChange={onRefresh} canViewRoles={canViewRoles} canCreateRoles={canPerform('CONFIG_ROLES', 'create')} canEditRoles={canPerform('CONFIG_ROLES', 'edit')} canDeleteRoles={canPerform('CONFIG_ROLES', 'delete')} />}
          </div>
          </>}
         </TabsContent>
         <TabsContent value="sucursales" className="space-y-6">
           <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
             <strong className="text-foreground">Sucursales de la empresa.</strong> Crea sucursales y asigna los usuarios que tendrán acceso a cada una.
           </div>
           <SucursalesView permissionModule={branchPermissionModule} warehouses={warehouses} onRefresh={() => inventoryService.getWarehouses().then((response: any) => setWarehouses(Array.isArray(response) ? response : (response?.data || []))).catch(() => undefined)} />
         </TabsContent>
         <TabsContent value="dominio" className="space-y-6">
           <DominiosView />
         </TabsContent>
      </Tabs>

      {showTeamTutorial && <GuidedTour steps={TEAM_TOUR_STEPS} onClose={() => setShowTeamTutorial(false)} title="Mi Equipo" allowTargetInteraction />}

      {/* Permissions Viewer Dialog */}
      <Dialog open={isPermsDialogOpen} onOpenChange={setIsPermsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase italic tracking-tighter">
              <Shield className="size-6 text-primary" />
              Permisos de {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Accesos efectivos por el rol directo del usuario. {selectedUser?.employee ? `Empleado vinculado: ${selectedUser.employee.firstName} ${selectedUser.employee.lastName}.` : 'No hay empleado vinculado.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="rounded-xl border border-border overflow-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-black uppercase text-[10px] tracking-widest">Módulo</th>
                    <th className="text-center p-3 font-black uppercase text-[10px] tracking-widest">Ver</th>
                    <th className="text-center p-3 font-black uppercase text-[10px] tracking-widest">Crear</th>
                    <th className="text-center p-3 font-black uppercase text-[10px] tracking-widest">Editar</th>
                    <th className="text-center p-3 font-black uppercase text-[10px] tracking-widest">Eliminar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(() => {
                    const directRole = selectedUser?.customRole || customRoles.find(r => r.id === selectedUser?.customRoleId);
                    const roleSources = [directRole].filter(Boolean);
                    const permissionMap = new Map<string, any>();
                    roleSources.flatMap((role: any) => normalizePermissions(role.permissions)).forEach((permission: any) => {
                      const current = permissionMap.get(permission.module) || { module: permission.module };
                      ['read', 'write', 'create', 'edit', 'delete'].forEach((action) => { current[action] = !!current[action] || !!permission[action]; });
                      permissionMap.set(permission.module, current);
                    });
                    const rolePermissions = [...permissionMap.values()];
                    
                    if (rolePermissions.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground italic">
                            {selectedUser?.role?.toUpperCase() === 'ADMIN' 
                              ? 'Este usuario es Administrador y tiene acceso total a todos los módulos.'
                            : 'Este usuario no tiene permisos efectivos. Asígnale un rol directo.'}
                          </td>
                        </tr>
                      );
                    }

                    return ALL_PERM_MODULES.map((mod) => {
                      const p = rolePermissions.find((perm: any) => perm.module === mod.id);
                      if (!p) return null;
                      const hasAny = p.read || p.create || p.edit || p.delete || p.write;
                      if (!hasAny) return null;
                      
                      const isSubmodule = 'parent' in mod;
                      const Icon = mod.icon;

                      return (
                        <tr key={mod.id} className={cn(
                          "hover:bg-muted/10 transition-colors",
                          isSubmodule ? "bg-muted/5 opacity-90" : "bg-card border-t border-border/50"
                        )}>
                          <td className="p-3">
                            <div className={cn("flex items-center gap-3", isSubmodule && "pl-8")}>
                              <div className={cn(
                                "size-6 rounded-lg flex items-center justify-center flex-shrink-0",
                                isSubmodule ? "bg-muted/20" : "bg-primary/10"
                              )}>
                                {Icon && <Icon className={cn("size-3", isSubmodule ? "text-muted-foreground" : "text-primary")} />}
                              </div>
                              <div>
                                <p className={cn("font-bold", isSubmodule ? "text-xs text-muted-foreground" : "text-sm text-foreground")}>
                                  {mod.label}
                                  {isSubmodule && <span className="ml-2 text-[9px] font-black text-muted-foreground/50 uppercase">VISTA</span>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">{p.read ? <Check className="size-4 text-emerald-500 mx-auto" /> : <X className="size-4 text-muted-foreground/30 mx-auto" />}</td>
                          <td className="p-3 text-center">{(p.create ?? p.write) ? <Check className="size-4 text-emerald-500 mx-auto" /> : <X className="size-4 text-muted-foreground/30 mx-auto" />}</td>
                          <td className="p-3 text-center">{(p.edit ?? p.write) ? <Check className="size-4 text-emerald-500 mx-auto" /> : <X className="size-4 text-muted-foreground/30 mx-auto" />}</td>
                          <td className="p-3 text-center">{p.delete ? <Check className="size-4 text-emerald-500 mx-auto" /> : <X className="size-4 text-muted-foreground/30 mx-auto" />}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermsDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={showEmployeeGuard} onOpenChange={setShowEmployeeGuard}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-black italic uppercase tracking-tighter flex items-center gap-3">
              <UserRoundCheck className="size-6 text-primary" />
              ¿El empleado ya está creado?
            </DialogTitle>
            <DialogDescription>Necesitamos saber si esta persona ya tiene un registro de empleado en Recursos Humanos para vincularla automáticamente al crear el acceso.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <Button variant="outline" className="h-12 gap-2 font-bold" onClick={() => { setShowEmployeeGuard(false); setUserDialogMode('withEmployee'); setSelectedCreateEmployeeId(''); setUserForm((current) => ({ ...current, name: '', email: '' })); setIsUserDialogOpen(true); }}>
              <Check className="size-4 text-emerald-500" /> Sí, existe
            </Button>
            <Button className="h-12 gap-2 font-bold" onClick={() => {
              setShowEmployeeGuard(false);
              pendingUserCreate.returnToUserModal = true;
              window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'rh', subModule: 'empleados' } }));
            }}>
              <Plus className="size-4" /> No, crearlo
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setShowEmployeeGuard(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUserDialogOpen} onOpenChange={(open) => { setIsUserDialogOpen(open); if (!open) { setSelectedCreateEmployeeId(''); setUserDialogMode('plain'); } }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
              <Users className="size-6 text-primary" />
              Nuevo Usuario
            </DialogTitle>
            <DialogDescription>Asigna un nuevo integrante al equipo de {tenant.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {userDialogMode === 'withEmployee' && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empleado (vinculación automática)</Label>
                <Select value={selectedCreateEmployeeId || '__none__'} onValueChange={(employeeId) => {
                  setSelectedCreateEmployeeId(employeeId === '__none__' ? '' : employeeId);
                }}>
                  <SelectTrigger className="bg-muted/10 h-11"><SelectValue placeholder="Selecciona un empleado o sin empleado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-[10px] font-bold uppercase">Sin empleado</SelectItem>
                    {employees.filter((employee: any) => !employee.user).map((employee: any) => <SelectItem key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.employeeNumber}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!employees.some((employee: any) => !employee.user) && <p className="text-[10px] text-amber-600">No hay empleados sin vínculo disponibles para auto-vincular.</p>}
              </div>
            )}
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
                aria-invalid={!!userEmailError}
                className={cn('bg-muted/10 h-11', userEmailError && 'border-destructive')}
              />
              {userEmailError && <p className="text-xs text-destructive">{userEmailError}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de Acceso</Label>
              <Select value={userForm.role} onValueChange={v => setUserForm({...userForm, role: v})}>
                <SelectTrigger className="bg-muted/10 h-11">
                  <SelectValue placeholder="Seleccionar tipo..." />
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
              {userForm.role === 'EMPLOYEE' && (
                <p className="text-[10px] text-amber-500 font-medium flex items-center gap-1">
                  <Shield className="size-3" />
                  Deberás asignarle un rol personalizado después de crearlo desde "Mi Equipo".
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contraseña Temporal *</Label>
              <Input
                type="password"
                placeholder="8 caracteres, mayúscula, número y símbolo"
                value={userForm.password}
                onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                className={cn('bg-muted/10 h-11', getPasswordError(userForm.password) && 'border-destructive')}
              />
              {getPasswordError(userForm.password) && <p className="text-xs text-destructive">{getPasswordError(userForm.password)}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)} className="h-11 px-6">Cancelar</Button>
            <Button 
              className="bg-primary text-primary-foreground font-bold h-11 px-8" 
              onClick={handleAddUser}
              disabled={uploading || checkingUserEmail || !!userEmailError || !isValidEmail(userForm.email) || !!getPasswordError(userForm.password) || (userDialogMode === 'withEmployee' && !selectedCreateEmployeeId)}
            >
              {uploading ? 'Creando...' : 'Crear Acceso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkingUser} onOpenChange={(open) => { if (!open) { setLinkingUser(null); setLinkingEmployeeId(''); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="size-5 text-primary" /> Vincular empleado</DialogTitle>
            <DialogDescription>Relaciona el usuario {linkingUser?.name} con su registro laboral. Sus departamentos y datos de nómina seguirán gestionándose desde Recursos Humanos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empleado disponible</Label>
            <Select value={linkingEmployeeId} onValueChange={setLinkingEmployeeId}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Selecciona un empleado" /></SelectTrigger>
              <SelectContent>
                {employees.filter((employee: any) => !employee.user).map((employee: any) => <SelectItem key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.employeeNumber}</SelectItem>)}
              </SelectContent>
            </Select>
            {!employees.some((employee: any) => !employee.user) && <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">No hay empleados activos disponibles para vincular.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkingUser(null)}>Cancelar</Button>
            <Button onClick={() => void handleLinkEmployee()} disabled={!linkingEmployeeId}>Vincular empleado</Button>
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

      {/* Change Password Dialog (Admin) */}
      <Dialog open={isChangePasswordDialogOpen} onOpenChange={setIsChangePasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-orange-500" /> Cambiar Contraseña
            </DialogTitle>
            <DialogDescription>
              Actualiza la contraseña del usuario <span className="font-bold text-foreground">{selectedUser?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nueva Contraseña</Label>
              <Input 
                type="password" 
                placeholder="8 caracteres, mayúscula, número y símbolo" 
                value={newPasswordForUser}
                onChange={(e) => setNewPasswordForUser(e.target.value)}
                className={cn('bg-muted/10 h-11', getPasswordError(newPasswordForUser) && 'border-destructive')}
              />
              {getPasswordError(newPasswordForUser) && <p className="text-xs text-destructive">{getPasswordError(newPasswordForUser)}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangePasswordDialogOpen(false)} disabled={updatingPassword}>Cancelar</Button>
            <Button onClick={handleAdminChangePassword} disabled={updatingPassword || !!getPasswordError(newPasswordForUser)} className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-10">
              {updatingPassword ? 'Guardando...' : 'Actualizar Contraseña'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
