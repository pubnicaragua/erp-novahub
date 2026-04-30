import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Zap, Building2, Globe, Users, Clock, Shield, Plus, KeyRound, Check, 
  CreditCard, FileText, Activity, AlertTriangle, Download, Ticket, UserPlus, Loader2,
  ArrowUpCircle, Trash2, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../ui/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { tenantsService } from '../../services/tenants.service';
import { usersService } from '../../services/users.service';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useCurrency } from '../../contexts/CurrencyContext';
import { subscriptionsService } from '../../services/subscriptions.service';

interface TenantSubscriptionViewProps {
  tenant: any;
  availableModules: any[];
  requests: any[];
  customRoles?: any[];
  onRequestModule: (moduleId: string, notes: string) => void;
  onRefresh: () => void;
}

export function TenantSubscriptionView({ tenant, availableModules, requests, customRoles, onRequestModule, onRefresh }: TenantSubscriptionViewProps) {
  const { user: currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState<any[]>([]);
  const [billingInfo, setBillingInfo] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  
  // Dialogs
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<any>(null);
  const [notes, setNotes] = useState('');
  
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'EMPLOYEE' });
  const [uploading, setUploading] = useState(false);
  

  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [newPasswordForUser, setNewPasswordForUser] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  
  const [isConfirmSuspensionOpen, setIsConfirmSuspensionOpen] = useState(false);
  const [userToToggle, setUserToToggle] = useState<any>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);

  // Plan change form
  const [selectedPlan, setSelectedPlan] = useState('');
  const [planChangeNotes, setPlanChangeNotes] = useState('');
  const [submittingPlanChange, setSubmittingPlanChange] = useState(false);

  // Document form
  const [docForm, setDocForm] = useState({ title: '', type: 'CONTRACT', url: '' });
  const [submittingDoc, setSubmittingDoc] = useState(false);

  // Support ticket form
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '' });
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const { formatAmount } = useCurrency();

  useEffect(() => {
    if (tenant?.id) {
      fetchUsers();
      fetchBillingAndDocs();
    }
  }, [tenant?.id]);

  const fetchUsers = async () => {
    try {
      const res = await tenantsService.getUsers(tenant.id);
      setUsers(Array.isArray(res) ? res : (res as any)?.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchBillingAndDocs = async () => {
    try {
      const [billRes, docsRes] = await Promise.all([
        tenantsService.getBillingHistory(tenant.id),
        tenantsService.getDocuments(tenant.id)
      ]);
      setBillingInfo((billRes as any).data || billRes);
      setDocuments((docsRes as any).data || docsRes);
    } catch (error) {
      console.error('Error fetching billing/docs:', error);
    }
  };

  const isModuleActive = (modId: string) => tenant.subscriptions?.some((s: any) => s.module === modId && s.isActive);
  const isModulePending = (modId: string) => requests.some((r: any) => r.clientTenantId === tenant.id && r.requestedModule === modId && r.status === 'PENDING');

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

  const handleAddUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.password) {
      toast.error('Complete todos los campos requeridos');
      return;
    }
    try {
      setUploading(true);
      const res = await tenantsService.addUser({ clientTenantId: tenant.id, ...userForm });
      
      if (res.data?.requiresApproval) {
        toast.success('Usuario creado exitosamente. A la espera de la aprobación del SuperAdmin para activarlo.');
      } else {
        toast.success('Usuario agregado correctamente');
      }
      
      setUserForm({ name: '', email: '', password: '', role: 'EMPLOYEE' });
      setIsUserDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al agregar usuario');
    } finally {
      setUploading(false);
    }
  };

  const toggleUserStatus = async (user: any) => {
    if (user.isActive) {
      if (user.id === currentUser?.id) return toast.error("No puedes suspender tu propia cuenta.");
      const activeUsers = users.filter(u => u.isActive);
      if (activeUsers.length <= 1) return toast.error("No se puede suspender al último usuario activo.");
      setUserToToggle(user);
      setIsConfirmSuspensionOpen(true);
    } else {
      executeToggleStatus(user.id, false);
    }
  };

  const handleDownloadInvoice = (inv: any) => {
    toast.success("Generando PDF de la factura...");
    try {
      const doc = new jsPDF({ format: 'letter', unit: 'mm' });
      
      // Branding / Header
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.rect(0, 0, 220, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("NOVAHUB", 15, 25);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Soluciones SaaS & ERP", 15, 32);

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("INVOICE", 150, 25);
      doc.setFontSize(10);
      doc.text(`# ${inv.number}`, 150, 32);

      // Info Client
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Facturado a:", 15, 55);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(tenant.name.toUpperCase(), 15, 62);
      if (tenant.industry) doc.text(tenant.industry, 15, 68);

      // Info Dates & Status
      doc.setFont("helvetica", "bold");
      doc.text("Fecha:", 150, 55);
      doc.setFont("helvetica", "normal");
      doc.text(new Date(inv.date).toLocaleDateString(), 150, 62);

      doc.setFont("helvetica", "bold");
      doc.text("Estado:", 150, 68);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(inv.status === 'PAID' ? 0 : 200, inv.status === 'PAID' ? 150 : 100, 0);
      doc.text(inv.status === 'PAID' ? 'PAGADO' : 'PENDIENTE', 165, 68);
      
      // Table Header
      doc.setFillColor(241, 245, 249);
      doc.rect(15, 80, 185, 10, 'F');
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "bold");
      doc.text("Descripción", 20, 87);
      doc.text("Cant.", 120, 87);
      doc.text("Precio", 150, 87);
      doc.text("Total", 180, 87);

      // Table Items
      doc.setFont("helvetica", "normal");
      let y = 100;
      if (inv.items && inv.items.length > 0) {
        inv.items.forEach((item: any) => {
          doc.text(item.description || 'Item', 20, y);
          doc.text(String(item.quantity || 1), 120, y);
          doc.text(`C$ ${Number(item.unitPrice || 0).toLocaleString()}`, 150, y);
          doc.text(`C$ ${Number(item.total || 0).toLocaleString()}`, 180, y);
          y += 10;
        });
      } else {
        doc.text("Cobro mensual de la suscripción", 20, y);
        doc.text("1", 120, y);
        doc.text(`C$ ${Number(inv.total || 0).toLocaleString()}`, 150, y);
        doc.text(`C$ ${Number(inv.total || 0).toLocaleString()}`, 180, y);
        y += 10;
      }

      // Totals
      doc.setDrawColor(200, 200, 200);
      doc.line(130, y + 5, 200, y + 5);
      
      doc.setFont("helvetica", "bold");
      doc.text("TOTAL:", 150, y + 15);
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(`C$ ${Number(inv.total || 0).toLocaleString()} NIO`, 170, y + 15);

      // Footer
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(150, 150, 150);
      doc.text("Gracias por confiar en NovaHub.", 105, 270, { align: 'center' });

      doc.save(`Factura_${inv.number}.pdf`);
    } catch (error) {
      console.error(error);
      toast.error("Error al generar el PDF");
    }
  };

  const handleRoleChange = async (userId: string, newRole: string, newCustomRoleId?: string | null) => {
    try {
      setUploading(true);
      await tenantsService.updateUser(tenant.id, userId, { 
        role: newRole, 
        customRoleId: newRole === 'ADMIN' ? null : newCustomRoleId 
      });
      toast.success('Rol actualizado');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al actualizar rol');
    } finally {
      setUploading(false);
    }
  };

  const executeToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      setIsTogglingStatus(true);
      await tenantsService.updateUser(tenant.id, userId, { isActive: !currentStatus });
      toast.success(currentStatus ? 'Usuario suspendido' : 'Usuario activado');
      fetchUsers();
      setIsConfirmSuspensionOpen(false);
      setUserToToggle(null);
    } catch (error) {
      toast.error('Error al actualizar estado');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleAdminChangePassword = async () => {
    if (!newPasswordForUser || newPasswordForUser.length < 6) return toast.error('Mínimo 6 caracteres');
    try {
      setUpdatingPassword(true);
      await usersService.changePassword(selectedUser.id, newPasswordForUser);
      toast.success('Contraseña actualizada');
      setIsChangePasswordDialogOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al cambiar contraseña');
    } finally {
      setUpdatingPassword(false);
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

  if (!tenant) return <div className="p-20 flex justify-center text-muted-foreground"><Clock className="animate-spin" /></div>;

  const activeUsersCount = users.filter(u => u.isActive).length;
  const baseQuota = billingInfo?.currentInvoiceEstimate?.baseUserQuota || 5;
  const extraUsers = billingInfo?.currentInvoiceEstimate?.extraUsers || 0;
  const extraUserPrice = billingInfo?.currentInvoiceEstimate?.extraUserPrice || 10;
  
  const isOverdue = billingInfo?.isOverdue || false;
  
  // Cálculo de Próximo Cobro (Día de Aniversario Forzado)
  const getNextDate = () => {
    const start = new Date(tenant.createdAt);
    const anniversaryDay = start.getDate();
    const now = new Date();
    
    // Determinar el mes objetivo (si ya pasamos el día de este mes, ir al siguiente)
    let targetMonth = now.getMonth();
    if (now.getDate() >= anniversaryDay) {
      targetMonth++;
    }
    
    const target = new Date(now.getFullYear(), targetMonth, anniversaryDay);
    
    // Manejo de meses cortos
    const lastDayOfTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    if (anniversaryDay > lastDayOfTarget) {
      target.setDate(lastDayOfTarget);
    }
    
    return target;
  };
  const nextDate = getNextDate();
  const diffTime = nextDate.getTime() - new Date().getTime();
  const daysToRenew = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'PENDING': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'SUSPENDED': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    }
  };

  return (
    <div className="w-full flex-1 p-4 md:p-6 lg:p-8 space-y-6">
      {/* Alertas Globales */}
      <AnimatePresence>
        {isOverdue && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start gap-4">
            <AlertTriangle className="size-6 text-rose-500 mt-1" />
            <div>
              <h3 className="font-bold text-rose-500">Saldo Pendiente</h3>
              <p className="text-sm text-rose-500/80">Tu cuenta presenta un saldo vencido. Por favor regulariza tu pago para evitar la suspensión del servicio.</p>
            </div>
            <Button size="sm" className="ml-auto bg-rose-500 hover:bg-rose-600 text-white font-bold">Pagar Ahora</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Premium */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
            <Building2 className="size-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter italic">MI SUSCRIPCIÓN</h1>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">CENTRO DE COMANDO TENANT - {tenant.name}</p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest px-4 py-1.5", getPlanColor(tenant.plan))}>
            Plan {tenant.plan}
          </Badge>
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Globe className="size-3" /> {tenant.slug}.novahub.io
          </span>
        </div>
      </motion.div>

      {/* Navegación Glassmorphism */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/20 border border-border/50 p-1.5 h-14 rounded-2xl mb-8 flex overflow-x-auto hide-scrollbar w-full justify-start md:justify-center gap-2">
          <TabsTrigger value="overview" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase text-[10px] tracking-widest gap-2">
            <Activity className="size-4" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase text-[10px] tracking-widest gap-2">
            <CreditCard className="size-4" /> Facturación
          </TabsTrigger>
          <TabsTrigger value="modules" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase text-[10px] tracking-widest gap-2">
            <Zap className="size-4" /> Módulos
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase text-[10px] tracking-widest gap-2">
            <Users className="size-4" /> Usuarios ({activeUsersCount})
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-xl px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold uppercase text-[10px] tracking-widest gap-2">
            <FileText className="size-4" /> Documentos
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            
            {/* --- TAB: OVERVIEW --- */}
            <TabsContent value="overview" className="space-y-6 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Resumen del Plan */}
                <Card className="bg-gradient-to-br from-card to-card/50 border-border/50 shadow-lg relative overflow-hidden md:col-span-2">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                  <CardContent className="p-8 relative z-10 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Suscripción Actual</p>
                        <h2 className="text-3xl font-bold tracking-tighter">Plan {billingInfo?.plan || tenant.plan}</h2>
                      </div>
                      <Badge className={cn("px-3 py-1 font-black uppercase", getStatusColor(tenant.implementationStatus))}>
                        {tenant.implementationStatus === 'ACTIVE' ? 'ACTIVO' : 
                         tenant.implementationStatus === 'PENDING' ? 'PENDIENTE' : 
                         tenant.implementationStatus === 'SUSPENDED' ? 'SUSPENDIDO' : 
                         tenant.implementationStatus}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Fecha de Inicio</p>
                        <p className="text-xl font-bold">{new Date(tenant.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Próximo Cobro</p>
                        <p className="text-xl font-bold flex items-center gap-2">
                          {nextDate.toLocaleDateString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5 italic">
                          ({daysToRenew > 0 ? `${daysToRenew} días restantes` : 'Vencido'})
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Costo Total Mensual</p>
                        <p className="text-2xl font-bold text-primary">{formatAmount(billingInfo?.currentInvoiceEstimate?.total || 0, 'USD')}</p>
                      </div>
                      <div className="md:col-span-4">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Capacidad de Usuarios</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all" 
                              style={{ width: `${Math.min(100, (activeUsersCount / baseQuota) * 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold">{activeUsersCount} / {baseQuota}</span>
                        </div>
                        {extraUsers > 0 && <p className="text-[10px] text-amber-500 mt-1 font-medium">+{extraUsers} licencias adicionales ({formatAmount(extraUserPrice, 'USD')}/u)</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="bg-card border-border/50 shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-sm font-black uppercase tracking-widest">Estado de Cuenta</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Módulos removidos por petición del usuario */}
                    <Button variant="outline" className="w-full justify-start h-12 rounded-xl hover:bg-primary/5 hover:text-primary border-border/50" onClick={() => setActiveTab('billing')}>
                      <CreditCard className="size-4 mr-3" /> Historial de Facturación
                    </Button>
                    <Button variant="outline" className="w-full justify-start h-12 rounded-xl hover:bg-primary/5 hover:text-primary border-border/50" onClick={() => setActiveTab('users')}>
                      <Users className="size-4 mr-3" /> Gestionar Usuarios
                    </Button>
                    <Button variant="outline" className="w-full justify-start h-12 rounded-xl hover:bg-primary/5 hover:text-primary border-border/50" onClick={() => { setSelectedPlan(''); setPlanChangeNotes(''); setIsUpgradeDialogOpen(true); }}>
                      <ArrowUpCircle className="size-4 mr-3" /> Solicitar Cambio de Plan
                    </Button>
                    <Button variant="outline" className="w-full justify-start h-12 rounded-xl hover:bg-primary/5 hover:text-primary border-border/50" onClick={() => {
                      setIsUserDialogOpen(true);
                    }}>
                      <UserPlus className="size-4 mr-3" /> Solicitar Usuario Extra
                    </Button>
                    <Button variant="outline" className="w-full justify-start h-12 rounded-xl hover:bg-primary/5 hover:text-primary border-border/50" onClick={() => setIsTicketDialogOpen(true)}>
                      <Ticket className="size-4 mr-3" /> Soporte Nova
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Detalle Granular de Precios (SI ESTÁ HABILITADO) */}
              {billingInfo?.showDetailedPricing && (
                <Card className="bg-card border-border/50 shadow-sm mt-6 overflow-hidden">
                  <CardHeader className="bg-primary/5 border-b border-primary/10">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                      <CreditCard className="size-4" /> Desglose Detallado de Suscripción
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border/40">
                            <th className="text-left p-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Concepto</th>
                            <th className="text-right p-4 font-black uppercase text-[10px] tracking-widest text-muted-foreground">Costo Mensual</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-border/40 hover:bg-muted/5 transition-colors">
                            <td className="p-4 font-bold italic">Costo Base Plan {billingInfo?.plan}</td>
                            <td className="p-4 text-right font-black">{formatAmount(billingInfo?.currentInvoiceEstimate?.basePlanCost || 0, 'USD')}</td>
                          </tr>
                          {billingInfo?.subscriptions?.filter((s: any) => Number(s.price) > 0).map((s: any) => (
                            <tr key={s.id} className="border-b border-border/40 hover:bg-muted/5 transition-colors">
                              <td className="p-4 font-medium">Módulo: {s.module.replace(/_/g, ' ')}</td>
                              <td className="p-4 text-right font-bold text-primary">{formatAmount(s.price, 'USD')}</td>
                            </tr>
                          ))}
                          {extraUsers > 0 && (
                            <tr className="border-b border-border/40 hover:bg-muted/5 transition-colors">
                              <td className="p-4 font-medium italic">Usuarios Extras ({extraUsers})</td>
                              <td className="p-4 text-right font-bold">{formatAmount(billingInfo?.currentInvoiceEstimate?.usersCost || 0, 'USD')}</td>
                            </tr>
                          )}
                          <tr className="bg-primary/5">
                            <td className="p-4 font-black uppercase text-xs tracking-tighter italic">Total Suscripción</td>
                            <td className="p-4 text-right font-black text-xl text-primary">{formatAmount(billingInfo?.currentInvoiceEstimate?.total || 0, 'USD')}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}


              {/* Implementación Timeline */}
              <Card className="bg-card border-border/50 shadow-sm mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="size-5 text-primary" />
                    Estado de Despliegue e Implementación
                  </CardTitle>
                  <CardDescription>Seguimiento de la configuración de tu entorno NovaHub</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative pt-8 pb-4">
                    {(() => {
                      const phases = [
                        { id: 'PENDING', label: 'Inicio' },
                        { id: 'CONFIG_INITIAL', label: 'Configuración' },
                        { id: 'DATA_MIGRATION', label: 'Migración' },
                        { id: 'TRAINING', label: 'Capacitación' },
                        { id: 'ACTIVE', label: 'Activación Total' }
                      ];
                      
                      const currentIndex = tenant.implementationStatus === 'SUSPENDED' ? 4 : Math.max(0, phases.findIndex(p => p.id === tenant.implementationStatus));
                      const progress = (currentIndex / (phases.length - 1)) * 100;
                      
                      return (
                        <>
                          <div className="absolute top-11 left-8 right-8 h-1 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn("h-full transition-all duration-500", 
                                tenant.implementationStatus === 'SUSPENDED' ? "bg-rose-500" : "bg-primary"
                              )} 
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="flex justify-between relative z-10 px-4">
                            {phases.map((phase, idx) => {
                              const isPast = idx < currentIndex;
                              const isCurrent = idx === currentIndex && tenant.implementationStatus !== 'SUSPENDED';
                              const isSuspended = tenant.implementationStatus === 'SUSPENDED';
                              const isFullyActive = tenant.implementationStatus === 'ACTIVE';
                              
                              return (
                                <div key={phase.id} className="flex flex-col items-center gap-2 w-16 md:w-20">
                                  <div className={cn("size-8 rounded-full flex items-center justify-center font-bold transition-all duration-500 z-10 border-[3px]", 
                                      isSuspended ? "bg-rose-500 border-rose-500 text-white shadow-md shadow-rose-500/20" : 
                                      isPast || isFullyActive ? "bg-primary border-primary text-white shadow-md shadow-primary/20" : 
                                      isCurrent ? "bg-background border-primary text-primary shadow-md shadow-primary/20" :
                                      "bg-muted border-muted text-muted-foreground"
                                    )}>
                                    {isSuspended ? <Check className="size-4" /> : 
                                     isPast || isFullyActive ? <Check className="size-4" /> : 
                                     isCurrent ? <Loader2 className="size-4 animate-spin" /> : 
                                     <div className="size-2 rounded-full bg-muted-foreground/30" />}
                                  </div>
                                  <span className={cn("text-[9px] md:text-[10px] font-bold text-center leading-tight transition-colors", 
                                    isCurrent ? "text-primary" : 
                                    isSuspended ? "text-rose-500" :
                                    isPast || isFullyActive ? "text-foreground" : "text-muted-foreground"
                                  )}>{phase.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div className={cn("mt-6 border rounded-xl p-4 text-sm transition-colors duration-500", 
                      tenant.implementationStatus === 'ACTIVE' ? "bg-primary/5 border-primary/10 text-muted-foreground" : 
                      tenant.implementationStatus === 'SUSPENDED' ? "bg-rose-500/5 border-rose-500/10 text-rose-600 dark:text-rose-400" : 
                      "bg-amber-500/5 border-amber-500/10 text-amber-600 dark:text-amber-400"
                    )}>
                    {tenant.implementationStatus === 'ACTIVE' ? (
                      <><strong className="text-foreground">Fase Actual: Activación Total.</strong> Tu plataforma está operando al 100%. Disfruta de todas las características de NovaHub ERP.</>
                    ) : tenant.implementationStatus === 'SUSPENDED' ? (
                      <><strong className="text-rose-600 dark:text-rose-500">Fase Actual: Suspendido.</strong> El entorno y sus servicios han sido suspendidos temporalmente.</>
                    ) : tenant.implementationStatus === 'TRAINING' ? (
                      <><strong className="text-amber-600 dark:text-amber-500">Fase Actual: Capacitación y Entrenamiento.</strong> El equipo está recibiendo la formación para usar el sistema.</>
                    ) : tenant.implementationStatus === 'DATA_MIGRATION' ? (
                      <><strong className="text-amber-600 dark:text-amber-500">Fase Actual: Migración de Datos.</strong> Estamos subiendo tu información histórica al nuevo sistema.</>
                    ) : tenant.implementationStatus === 'CONFIG_INITIAL' ? (
                      <><strong className="text-amber-600 dark:text-amber-500">Fase Actual: Configuración Inicial.</strong> Estamos ajustando los parámetros básicos de tu empresa.</>
                    ) : (
                      <><strong className="text-amber-600 dark:text-amber-500">Fase Actual: Pendiente de Inicio.</strong> La implementación está en cola para comenzar en breve.</>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Columna Izquierda: Resumen Financiero */}
                <div className="md:col-span-1 space-y-6">
                  {/* Próxima Factura Estimada */}
                  <Card className="bg-card border-border/50 shadow-sm h-fit">
                    <CardHeader className="bg-muted/30 border-b border-border/40">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Clock className="size-3" /> Próxima Factura Estimada
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <h2 className="text-5xl font-black tracking-tighter text-foreground text-center">{formatAmount(billingInfo?.currentInvoiceEstimate?.total || 0, 'USD')}</h2>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Plan Base ({tenant.plan})</span>
                          <span className="font-bold text-foreground">{formatAmount(billingInfo?.currentInvoiceEstimate?.basePlanCost || 0, 'USD')}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Usuarios Extras ({extraUsers})</span>
                          <span className="font-bold text-foreground">{formatAmount(billingInfo?.currentInvoiceEstimate?.usersCost || 0, 'USD')}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Módulos Adicionales</span>
                          <span className="font-bold text-foreground">{formatAmount(billingInfo?.currentInvoiceEstimate?.modulesCost || 0, 'USD')}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Saldo Pendiente (Solo si existe) */}
                  {billingInfo?.history?.some((h: any) => h.status !== 'PAID') && (
                    <Card className="bg-amber-500/5 border-amber-500/20 shadow-sm">
                      <CardHeader className="bg-amber-500/10 border-b border-amber-500/20">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
                          <AlertTriangle className="size-3" /> Saldo Pendiente Acumulado
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6">
                        <h2 className="text-4xl font-black tracking-tighter text-amber-700 text-center mb-4">
                          {formatAmount(
                            billingInfo.history
                              .filter((h: any) => h.status !== 'PAID')
                              .reduce((sum: number, inv: any) => sum + (inv.amount || inv.total || 0), 0),
                            'USD'
                          )}
                        </h2>
                        <div className="flex flex-col gap-2">
                          <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black italic uppercase tracking-tighter text-[10px] h-9 rounded-xl shadow-lg shadow-amber-500/20">
                            Pagar Deuda Total
                          </Button>
                          <p className="text-[9px] text-amber-600/70 text-center font-medium italic">
                            * Tienes {billingInfo.history.filter((h: any) => h.status !== 'PAID').length} facturas vencidas o pendientes.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Historial (Columna Derecha - Span 2) */}
                <Card className="bg-card border-border/50 shadow-sm md:col-span-2">
                  <CardHeader>
                    <CardTitle>Historial de Facturación</CardTitle>
                    <CardDescription>Consulta y descarga tus recibos mensuales.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {billingInfo?.history?.map((inv: any) => (
                        <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-muted/10 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <FileText className="size-5" />
                            </div>
                            <div>
                              <p className="font-bold">{inv.number}</p>
                              <p className="text-xs text-muted-foreground">Emitida el: {new Date(inv.date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <span className="font-bold text-lg">{formatAmount(inv.amount || inv.total || 0, 'USD')}</span>
                            {inv.status === 'PAID' ? (
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Pagado</Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Pendiente</Badge>
                            )}
                            {currentUser?.isPlatformAdmin && inv.status !== 'PAID' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={async () => {
                                  try {
                                    await tenantsService.markInvoiceAsPaid(inv.id);
                                    toast.success('Factura marcada como pagada');
                                    onRefresh();
                                    // Local refresh para la vista actual
                                    setBillingInfo((prev: any) => ({
                                      ...prev,
                                      history: prev.history.map((h: any) => h.id === inv.id ? { ...h, status: 'PAID' } : h)
                                    }));
                                  } catch (e) {
                                    toast.error('Error al actualizar estado de la factura');
                                  }
                                }} 
                                className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500 hover:text-white uppercase text-[9px] font-black tracking-widest px-3 ml-2"
                              >
                                Marcar Pagado
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="hover:text-primary" onClick={() => handleDownloadInvoice(inv)}>
                              <Download className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* --- TAB: MODULES --- */}
            <TabsContent value="modules" className="space-y-6 mt-0">
               {/* Modules Catalog */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                      "relative overflow-hidden transition-all duration-300 border-border/50 flex flex-col group shadow-sm",
                      isMainActive ? "bg-primary/5 border-primary/20 shadow-primary/5" : "bg-card hover:border-primary/30"
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
                                    {!subActive && !subPending && !currentUser?.isPlatformAdmin && (
                                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] uppercase font-bold text-primary hover:bg-primary/10" onClick={() => handleRequestClick(sub)}>
                                        Solicitar
                                      </Button>
                                    )}
                                  </div>
                                  
                                  {subPending && <Badge className="bg-amber-500/10 text-amber-500 border-none text-[9px] uppercase px-1.5 py-0">En Cola</Badge>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {!hasSubmodules && !isMainActive && !isMainPending && !currentUser?.isPlatformAdmin && (
                          <div className="mt-auto pt-6">
                            <Button variant="outline" className="w-full font-bold uppercase text-[10px] tracking-widest border-primary/20 text-primary hover:bg-primary/10" onClick={() => handleRequestClick(mod)}>
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

            {/* --- TAB: USERS --- */}
            <TabsContent value="users" className="space-y-6 mt-0">
               <div className="flex items-center justify-between bg-card border border-border/50 p-6 rounded-2xl shadow-sm">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Miembros de la Empresa</h3>
                  <p className="text-sm text-muted-foreground">Gestiona accesos y licencias activas ({activeUsersCount}/{baseQuota}).</p>
                </div>
                {!currentUser?.isPlatformAdmin && (
                  <Button className="bg-primary text-primary-foreground gap-2 font-bold px-6 rounded-xl shadow-lg shadow-primary/20" onClick={() => setIsUserDialogOpen(true)}>
                    <Plus className="size-5" /> Agregar Miembro
                  </Button>
                )}
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
                              {u.email}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          u.isActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                          (activeUsersCount >= baseQuota ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20")
                        )}>
                          {u.isActive ? 'Activo' : (activeUsersCount >= baseQuota ? 'Pendiente Activación' : 'Suspendido')}
                        </Badge>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-border/50">
                        <div className="flex flex-col gap-2 pt-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tipo</span>
                            {currentUser?.isPlatformAdmin || currentUser?.id === u.id ? (
                              <Badge variant="outline">{u.role === 'ADMIN' ? 'Admin' : 'Colaborador'}</Badge>
                            ) : (
                              <Select
                                disabled={uploading}
                                value={u.role}
                                onValueChange={(val) => handleRoleChange(u.id, val, u.customRoleId)}
                              >
                                <SelectTrigger className="h-7 text-[10px] w-28 bg-transparent border-border/40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ADMIN">Admin</SelectItem>
                                  <SelectItem value="EMPLOYEE">Colaborador</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          
                          {u.role === 'EMPLOYEE' && (
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Rol Asignado</span>
                              {currentUser?.isPlatformAdmin || currentUser?.id === u.id ? (
                                <Badge variant="secondary" className="text-[9px] bg-muted/50 border-transparent">
                                  {customRoles?.find(cr => cr.id === u.customRoleId)?.name || 'Sin rol'}
                                </Badge>
                              ) : (
                                <Select
                                  disabled={uploading}
                                  value={u.customRoleId || 'none'}
                                  onValueChange={(val) => handleRoleChange(u.id, 'EMPLOYEE', val === 'none' ? null : val)}
                                >
                                  <SelectTrigger className="h-7 text-[10px] w-36 bg-muted/30 border-border/40">
                                    <SelectValue placeholder="Rol..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Sin rol específico</SelectItem>
                                    {customRoles?.map(cr => (
                                      <SelectItem key={cr.id} value={cr.id}>{cr.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {!currentUser?.isPlatformAdmin && (
                          <div className="flex items-center gap-2 pt-4">
                            {u.role !== 'ADMIN' && (
                              <Button variant="outline" size="sm" className="flex-[0.5] hover:bg-orange-500/10 hover:text-orange-500 h-8 border-orange-500/20" onClick={() => { setSelectedUser(u); setIsChangePasswordDialogOpen(true); }}>
                                <KeyRound className="size-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className={cn("flex-1 text-[10px] font-black uppercase tracking-widest h-8", u.isActive ? "hover:bg-rose-500/10 hover:text-rose-500" : "hover:bg-emerald-500/10 hover:text-emerald-500")} onClick={() => toggleUserStatus(u)}>
                              {u.isActive ? 'Suspender' : 'Activar'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* --- TAB: DOCUMENTS --- */}
            <TabsContent value="documents" className="space-y-6 mt-0">
               <div className="flex items-center justify-between bg-card border border-border/50 p-6 rounded-2xl shadow-sm">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Repositorio de Documentos</h3>
                  <p className="text-sm text-muted-foreground">Contratos, políticas, SLA y comprobantes.</p>
                </div>
                <Button className="bg-primary text-primary-foreground gap-2 font-bold px-6 rounded-xl shadow-lg shadow-primary/20" onClick={() => { setDocForm({ title: '', type: 'CONTRACT', url: '' }); setIsDocDialogOpen(true); }}>
                  <Upload className="size-5" /> Agregar Documento
                </Button>
               </div>
               <Card className="bg-card border-border/50 shadow-sm">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {documents.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                          <FileText className="size-12 mx-auto mb-4 opacity-30" />
                          <p className="font-bold">Sin documentos</p>
                          <p className="text-sm">Agrega contratos, comprobantes o políticas.</p>
                        </div>
                      )}
                      {documents?.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 hover:bg-muted/10 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <Shield className="size-5" />
                            </div>
                            <div>
                              <p className="font-bold">{doc.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="text-[9px] uppercase font-bold">{doc.type}</Badge>
                                <span className="text-xs text-muted-foreground">• {new Date(doc.date).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.url && (
                              <Button variant="outline" size="sm" className="gap-2 font-bold uppercase text-[10px] tracking-widest" onClick={() => window.open(doc.url, '_blank')}>
                                <Download className="size-4" /> Ver
                              </Button>
                            )}
                            {currentUser?.isPlatformAdmin && (
                              <Button variant="ghost" size="icon" className="hover:text-rose-500 hover:bg-rose-500/10" onClick={async () => {
                                try {
                                  await tenantsService.deleteDocument(tenant.id, doc.id);
                                  toast.success('Documento eliminado');
                                  fetchBillingAndDocs();
                                } catch { toast.error('Error al eliminar'); }
                              }}>
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
            </TabsContent>

          </motion.div>
        </AnimatePresence>
      </Tabs>

      {/* Reused Dialogs (Request, User, Confirm) */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Módulo: {selectedModule?.label}</DialogTitle>
            <DialogDescription>
              Envía una solicitud para habilitar este módulo en tu empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notas Adicionales (Opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-primary text-primary-foreground" onClick={submitRequest}>Enviar Solicitud</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogos extraídos para brevedad */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle>Nuevo Miembro</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nombre</Label><Input value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} /></div>
            <div className="space-y-2">
              <Label>Tipo de Acceso</Label>
              <Select value={userForm.role} onValueChange={v => setUserForm({...userForm, role: v, customRoleId: v === 'ADMIN' ? null : userForm.customRoleId})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="EMPLOYEE">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {userForm.role === 'EMPLOYEE' && (
              <div className="space-y-2">
                <Label>Rol Asignado (Opcional)</Label>
                <Select value={userForm.customRoleId || 'none'} onValueChange={v => setUserForm({...userForm, customRoleId: v === 'none' ? null : v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar rol..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin rol específico</SelectItem>
                    {customRoles?.map(cr => (
                      <SelectItem key={cr.id} value={cr.id}>{cr.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2"><Label>Contraseña</Label><Input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddUser} disabled={uploading}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isChangePasswordDialogOpen} onOpenChange={setIsChangePasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cambiar Contraseña</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nueva Contraseña</Label><Input type="password" value={newPasswordForUser} onChange={(e) => setNewPasswordForUser(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangePasswordDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdminChangePassword} disabled={updatingPassword}>Actualizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isConfirmSuspensionOpen}
        onOpenChange={setIsConfirmSuspensionOpen}
        title={`¿Suspender a ${userToToggle?.name}?`}
        description="El usuario perderá acceso inmediato a todos los módulos."
        confirmLabel="Confirmar Suspensión"
        variant="destructive"
        loading={isTogglingStatus}
        onConfirm={() => userToToggle ? executeToggleStatus(userToToggle.id, true) : Promise.resolve()}
      />

      <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Cambio de Plan</DialogTitle>
            <DialogDescription>Selecciona el plan al que deseas migrar. La solicitud será revisada por el equipo de NovaHub.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Plan Actual</Label>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                <Badge className={cn('font-black uppercase', getPlanColor(tenant.plan))}>Plan {tenant.plan}</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nuevo Plan Deseado</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger><SelectValue placeholder="Seleccionar plan..." /></SelectTrigger>
                <SelectContent>
                  {['BASIC', 'PROFESSIONAL', 'ENTERPRISE'].filter(p => p !== tenant.plan).map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Motivo / Notas</Label>
              <Textarea value={planChangeNotes} onChange={e => setPlanChangeNotes(e.target.value)} placeholder="Ej: Necesitamos más usuarios y módulos avanzados..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpgradeDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!selectedPlan || submittingPlanChange} onClick={async () => {
              try {
                setSubmittingPlanChange(true);
                await subscriptionsService.createRequest({
                  clientTenantId: tenant.id,
                  requestedModule: 'CONFIG_SUBSCRIPTION',
                  notes: `Cambio de plan: ${tenant.plan} → ${selectedPlan}. ${planChangeNotes}`,
                  requestedPlan: selectedPlan,
                });
                toast.success('Solicitud de cambio de plan enviada correctamente');
                setIsUpgradeDialogOpen(false);
                onRefresh();
              } catch (e: any) {
                toast.error(e.response?.data?.message || 'Error al enviar solicitud');
              } finally {
                setSubmittingPlanChange(false);
              }
            }}>Enviar Solicitud</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTicketDialogOpen} onOpenChange={setIsTicketDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Ticket de Soporte</DialogTitle>
            <DialogDescription>Describe tu problema y nuestro equipo técnico te ayudará.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Asunto</Label>
              <Input value={ticketForm.subject} onChange={e => setTicketForm({...ticketForm, subject: e.target.value})} placeholder="Ej: Problemas con el módulo de ventas" />
            </div>
            <div className="space-y-2">
              <Label>Descripción detallada</Label>
              <Textarea value={ticketForm.description} onChange={e => setTicketForm({...ticketForm, description: e.target.value})} placeholder="Explica paso a paso el problema..." className="h-32" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTicketDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!ticketForm.subject || !ticketForm.description || submittingTicket} onClick={async () => {
              try {
                setSubmittingTicket(true);
                const { api } = await import('../../services/api');
                await api.post('/support-tickets', ticketForm);
                toast.success('Ticket creado correctamente. Nos contactaremos pronto.');
                setTicketForm({ subject: '', description: '' });
                setIsTicketDialogOpen(false);
              } catch (e: any) {
                toast.error(e.response?.data?.message || 'Error al crear ticket');
              } finally {
                setSubmittingTicket(false);
              }
            }}>Enviar Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Agregar Documento */}
      <Dialog open={isDocDialogOpen} onOpenChange={setIsDocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Documento</DialogTitle>
            <DialogDescription>Sube un contrato, comprobante, SLA o política.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={docForm.title} onChange={e => setDocForm({...docForm, title: e.target.value})} placeholder="Ej: Contrato de Servicio 2026" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Documento</Label>
              <Select value={docForm.type} onValueChange={v => setDocForm({...docForm, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONTRACT">Contrato</SelectItem>
                  <SelectItem value="SLA">SLA</SelectItem>
                  <SelectItem value="TERMS">Términos y Condiciones</SelectItem>
                  <SelectItem value="PRIVACY">Política de Privacidad</SelectItem>
                  <SelectItem value="RECEIPT">Comprobante</SelectItem>
                  <SelectItem value="LEGAL">Legal</SelectItem>
                  <SelectItem value="OTHER">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>URL del Documento</Label>
              <Input value={docForm.url} onChange={e => setDocForm({...docForm, url: e.target.value})} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDocDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!docForm.title || !docForm.url || submittingDoc} onClick={async () => {
              try {
                setSubmittingDoc(true);
                await tenantsService.createDocument(tenant.id, docForm);
                toast.success('Documento agregado');
                setIsDocDialogOpen(false);
                fetchBillingAndDocs();
              } catch (e: any) {
                toast.error(e.response?.data?.message || 'Error al agregar documento');
              } finally {
                setSubmittingDoc(false);
              }
            }}>Guardar Documento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
