import React from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  ShoppingCart,
  ChevronDown,
  BarChart3,
  Settings,
  X,
  ShoppingBag,
  DollarSign,
  Users,
  Truck,
  Headphones,
  FolderOpen,
  FolderKanban,
  BellRing,
  LayoutDashboard,
  Building2,
  UserCircle,
  FileSpreadsheet,
  ClipboardList,
  ClipboardPen,
  FileText,
  FileCheck,

  ShieldCheck,
  CreditCard,
  RotateCcw,
  PackageCheck,
  BadgeDollarSign,
  BadgePercent,
  Wallet,
  Banknote,
  CalendarClock,
  FileMinus,
  FileOutput,
  Plus,
  Database,
  Zap,
  ListTodo,
  CalendarDays,
  Bell,
  HardDrive,
  Scale,
  AlertTriangle,
  MessageSquare,
  Send,
  Layers,
  Archive,
  History,
  Landmark,
  GraduationCap,
  LifeBuoy,
  BookOpen,
  Cloud,
  Calculator,
  Coins,
  BookOpenCheck,
  PieChart,
  TrendingUp,
  Calendar,
  FileBarChart,
  Settings2,
  TicketIcon,
  BriefcaseBusiness,
  Tags,
  ClipboardCheck,
  TrendingDown,
  ChefHat,
  MapPinned,
} from 'lucide-react';
import { cn } from './ui/utils';
import { useAuth, type Module } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { BrandLogo } from './BrandLogo';
import { NovaSuiteIcon } from './ui/NovaIcons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { HIDDEN_DEFERRED_SALES_VIEW_IDS, SIDEBAR_SUBMENU_MODULE_REQUIREMENTS, SIDEBAR_SUBMENU_PERMISSION_MODULES } from '../utils/sidebarPermissions';

interface SidebarProps {
  activeModule: Module | 'overview';
  activeSubModule?: string;
  onModuleChange: (module: Module, subModule?: string) => void;
  isOpen: boolean;
  isCollapsed?: boolean;
  onClose: () => void;
  onOverview: () => void;
}

interface SubMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  hasAdd?: boolean;
  hidden?: boolean;
}

interface MenuItem {
  id: Module | 'overview';
  label: string;
  icon: React.ReactNode;
  submenu?: SubMenuItem[];
  section?: string;
  superadminOnly?: boolean;
}

// La matriz de permisos y el sidebar deben consultar el mismo catálogo.
const SUBMENU_MODULE_REQUIREMENTS = SIDEBAR_SUBMENU_MODULE_REQUIREMENTS;

const menuItems: MenuItem[] = [
  {
    id: 'overview',
    label: 'Dashboard',
    icon: <LayoutDashboard className="size-5" />,
    section: 'General',
  },
  {
    id: 'ventas',
    label: 'Ventas',
    icon: <ShoppingBag className="size-5" />,
    section: 'Operaciones',
    submenu: [
      { id: 'clientes', label: 'Clientes', icon: <UserCircle className="size-4" /> },
      { id: 'estimaciones', label: 'Cotizaciones', icon: <FileSpreadsheet className="size-4" /> },
      { id: 'ordenes-venta', label: 'Órdenes de venta', icon: <ClipboardList className="size-4" />, hasAdd: true },
      { id: 'facturas', label: 'Facturas', icon: <FileText className="size-4" /> },
      { id: 'facturas-recurrentes', label: 'Facturas recurrentes', icon: <RotateCcw className="size-4" /> },
      { id: 'pagos-recibidos', label: 'Pagos recibidos', icon: <CreditCard className="size-4" /> },
      { id: 'devoluciones-venta', label: 'Notas de crédito', icon: <FileOutput className="size-4" /> },
      { id: 'notas-credito', label: 'Créditos', icon: <FileMinus className="size-4" /> },
      { id: 'listas-precios', label: 'Listas de precios', icon: <Tags className="size-4" /> },
      { id: 'entregas', label: 'Entregas', icon: <PackageCheck className="size-4" />, hidden: true },
      { id: 'facturacion-caja', label: 'Facturación por caja', icon: <Calculator className="size-4" /> },
      { id: 'control-caja', label: 'Control de Caja', icon: <Coins className="size-4" /> },
    ]
  },
  {
    id: 'compras',
    label: 'Compras',
    icon: <ShoppingCart className="size-5" />,
    submenu: [
      { id: 'solicitudes', label: 'Solicitudes', icon: <ClipboardPen className="size-4" /> },
      { id: 'proveedores', label: 'Proveedores', icon: <Truck className="size-4" />, hasAdd: true },
      { id: 'gastos', label: 'Gastos', icon: <Wallet className="size-4" /> },
      { id: 'gastos-recurrentes', label: 'Gastos recurrentes', icon: <CalendarClock className="size-4" /> },
      { id: 'ordenes-compra', label: 'Órdenes de compra', icon: <ClipboardList className="size-4" /> },
      { id: 'recepciones-compra', label: 'Recepciones de compra', icon: <PackageCheck className="size-4" /> },
      { id: 'facturas-proveedor-rec', label: 'Facturas de proveedor rec.', icon: <RotateCcw className="size-4" /> },
      { id: 'pagos-realizados', label: 'Pagos realizados', icon: <Banknote className="size-4" /> },
      { id: 'creditos-proveedor', label: 'Créditos del proveedor', icon: <BadgeDollarSign className="size-4" /> },
    ]
  },
  {
    id: 'restaurante',
    label: 'Restaurante POS',
    icon: <ChefHat className="size-5" />,
    section: 'Operaciones',
  },
  {
    id: 'inventario',
    label: 'Inventario de Mercancías',
    icon: <Package className="size-5" />,
    submenu: [
      { id: 'productos', label: 'Productos', icon: <Package className="size-4" /> },
      { id: 'servicios', label: 'Servicios', icon: <BriefcaseBusiness className="size-4" /> },
      { id: 'atributos', label: 'Atributos y Categoría', icon: <Tags className="size-4" /> },
      { id: 'almacenes', label: 'Bodegas', icon: <Archive className="size-4" /> },
      { id: 'transferencias', label: 'Transferencias', icon: <Truck className="size-4" /> },
      { id: 'ajustes', label: 'Ajustes', icon: <Scale className="size-4" /> },
      { id: 'auditorias', label: 'Auditorías', icon: <ClipboardCheck className="size-4" /> },
      { id: 'perdidas', label: 'Pérdidas', icon: <TrendingDown className="size-4" /> },
      { id: 'movimientos', label: 'Movimientos', icon: <History className="size-4" /> },
      { id: 'mobiliario-equipos', label: 'Mobiliario y Equipos', icon: <Building2 className="size-4" /> },
      { id: 'configuracion', label: 'Configuración', icon: <Settings2 className="size-4" /> },
    ]
  },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: <DollarSign className="size-5" />,
    section: 'Administración',
    submenu: [
      { id: 'resumen-financiero', label: 'Resumen Financiero', icon: <BarChart3 className="size-4" /> },
      { id: 'caja-bancos', label: 'Caja y Bancos', icon: <Landmark className="size-4" /> },
      { id: 'cuentas-cobrar', label: 'Cuentas por Cobrar', icon: <BarChart3 className="size-4" /> },
      { id: 'cuentas-pagar', label: 'Cuentas por Pagar', icon: <BarChart3 className="size-4" /> },
      { id: 'ingresos', label: 'Ingresos', icon: <TrendingUp className="size-4" /> },
      { id: 'egresos', label: 'Gastos', icon: <Wallet className="size-4" /> },
      { id: 'movimientos-recurrentes', label: 'Movimientos Recurrentes', icon: <RotateCcw className="size-4" /> },
      { id: 'calendario-financiero', label: 'Calendario Financiero', icon: <CalendarClock className="size-4" /> },
      { id: 'analisis-ingresos-gastos', label: 'Análisis de ingresos y gastos', icon: <BarChart3 className="size-4" /> },
      { id: 'balance-general', label: 'Balance General', icon: <Landmark className="size-4" /> },
      { id: 'perdidas', label: 'Pérdidas', icon: <TrendingDown className="size-4" /> },
    ]
  },
  {
    id: 'contabilidad',
    label: 'Contabilidad',
    icon: <BookOpen className="size-5" />,
    section: 'Administración',
    submenu: [
      { id: 'plan-cuentas', label: 'Plan de Cuentas', icon: <BookOpen className="size-4" /> },
      { id: 'diario', label: 'Libro Diario', icon: <FileText className="size-4" /> },
      { id: 'libro-mayor', label: 'Libro Mayor', icon: <BookOpenCheck className="size-4" /> },
      { id: 'balance-comprobacion', label: 'Balance de comprobación', icon: <Scale className="size-4" /> },
      { id: 'estado-resultados', label: 'Estado de Resultados', icon: <TrendingUp className="size-4" /> },
      { id: 'balance-general-contable', label: 'Balance General', icon: <PieChart className="size-4" /> },
      { id: 'flujo-efectivo', label: 'Flujo de Efectivo', icon: <DollarSign className="size-4" /> },
      { id: 'diferencias-cambiarias', label: 'Diferencias Cambiarias', icon: <BadgeDollarSign className="size-4" /> },
      { id: 'cambios-patrimonio', label: 'Cambios Patrimonio', icon: <FileSpreadsheet className="size-4" /> },
      { id: 'activos-fijos', label: 'Activos Fijos', icon: <Building2 className="size-4" /> },
      { id: 'libro-bancos', label: 'Libro Diario de Bancos', icon: <Landmark className="size-4" /> },
      { id: 'conciliacion', label: 'Conciliación bancaria', icon: <Landmark className="size-4" /> },
      { id: 'periodos', label: 'Períodos contables', icon: <Calendar className="size-4" /> },
      { id: 'reportes-fiscales', label: 'Reportes Fiscales', icon: <FileBarChart className="size-4" /> },
      { id: 'auditoria-facturas', label: 'Auditoría de Facturas', icon: <ClipboardCheck className="size-4" /> },
      { id: 'presupuestos', label: 'Presupuestos', icon: <Wallet className="size-4" /> },
      { id: 'categorias-gastos', label: 'Categorías Gastos', icon: <Tags className="size-4" /> },
      { id: 'solicitudes-pago', label: 'Solicitudes de pago RR. HH.', icon: <ClipboardCheck className="size-4" /> },
      { id: 'configuracion', label: 'Configuración', icon: <Settings2 className="size-4" /> },
    ]
  },
  {
    id: 'reportes',
    label: 'Reportes',
    icon: <BarChart3 className="size-5" />,
    submenu: [
      { id: 'reportes-ventas', label: 'Ventas', icon: <ShoppingCart className="size-4" /> },
      { id: 'reportes-compras', label: 'Compras', icon: <ShoppingCart className="size-4" /> },
      { id: 'reportes-financieros', label: 'Financiero', icon: <DollarSign className="size-4" /> },
      { id: 'reportes-inventario', label: 'Inventario de Mercancías', icon: <Package className="size-4" /> },
      { id: 'reportes-clientes', label: 'Clientes', icon: <Users className="size-4" /> },
      { id: 'reportes-proveedores', label: 'Proveedores', icon: <Truck className="size-4" /> },
      { id: 'reportes-rrhh', label: 'Recursos Humanos', icon: <Users className="size-4" /> },
      { id: 'reportes-suscripciones', label: 'Suscripciones', icon: <Layers className="size-4" /> },
    ]
  },
  {
    id: 'rh',
    label: 'Recursos Humanos',
    icon: <Users className="size-5" />,
    submenu: [
      { id: 'dashboard-hr', label: 'Dashboard', icon: <BarChart3 className="size-4" /> },
      { id: 'empleados', label: 'Empleados', icon: <Users className="size-4" /> },
      { id: 'departamentos', label: 'Departamentos', icon: <Building2 className="size-4" /> },
      { id: 'nominas', label: 'Nóminas', icon: <DollarSign className="size-4" /> },
      { id: 'comisiones', label: 'Comisiones', icon: <BadgePercent className="size-4" /> },
      { id: 'asistencia', label: 'Asistencia', icon: <CalendarClock className="size-4" /> },
      { id: 'ausencias', label: 'Vacaciones', icon: <CalendarClock className="size-4" /> },
      { id: 'evaluaciones', label: 'Desempeño', icon: <BarChart3 className="size-4" /> },
      { id: 'capacitaciones', label: 'Capacitación', icon: <FileCheck className="size-4" /> },
      { id: 'beneficios', label: 'Beneficios', icon: <Plus className="size-4" /> },
      { id: 'config-nomina', label: 'Configuración de nómina', icon: <Settings className="size-4" /> },
    ]
  },
  {
    id: 'actividades',
    label: 'Actividades',
    icon: <ClipboardList className="size-5" />,
    section: 'Herramientas',
    submenu: [
      { id: 'tareas', label: 'Tareas', icon: <ListTodo className="size-4" /> },
      { id: 'eventos', label: 'Eventos', icon: <CalendarDays className="size-4" /> },
      { id: 'recordatorios', label: 'Recordatorios', icon: <Bell className="size-4" /> },
      { id: 'bitacora', label: 'Bitácora', icon: <Database className="size-4" /> }
    ]
  },
  {
    id: 'proyectos',
    label: 'Proyectos',
    icon: <FolderKanban className="size-5" />,
    section: 'Herramientas',
  },
  {
    id: 'fuerza-comercial',
    label: 'Fuerza Comercial',
    icon: <MapPinned className="size-5" />,
    section: 'Comercial',
  },
  {
    id: 'tickets', 
    label: 'Tickets y Soporte', 
    icon: <Headphones className="size-5" />,
    submenu: [
      { id: 'tickets', label: 'Tickets', icon: <TicketIcon className="size-4" /> },
      { id: 'faqs', label: 'Base de Conocimiento', icon: <BookOpen className="size-4" /> },
      { id: 'agents', label: 'Agentes', icon: <Users className="size-4" /> }
    ]
  },
  {
    id: 'centro-capacitacion',
    label: 'Centro de capacitación',
    icon: <GraduationCap className="size-5" />,
    section: 'Ayuda',
  },
  { id: 'soporte-tecnico', label: 'Soporte técnico', icon: <LifeBuoy className="size-5" /> },
  { 
    id: 'asesoria-legal', 
    label: 'Asesoría legal',
    icon: <Scale className="size-5" />,
    submenu: [
      { id: 'cases', label: 'Casos', icon: <FileText className="size-4" /> },
      { id: 'reminders', label: 'Recordatorios', icon: <Bell className="size-4" /> }
    ]
  },
  { id: 'financiamiento-pyme', label: 'Financiamiento PYME', icon: <Landmark className="size-5" /> },
  { id: 'novachat', label: 'Nova Suite', icon: <NovaSuiteIcon className="size-5" /> },
  {
    id: 'documentos',
    label: 'Nova Cloud',
    icon: <FolderOpen className="size-4" />,
    submenu: [
      { id: 'archivos', label: 'Archivos', icon: <HardDrive className="size-4" /> },
      { id: 'contratos', label: 'Contratos', icon: <Scale className="size-4" /> },
      { id: 'doc-facturas', label: 'Facturas Legales', icon: <FileText className="size-4" /> },
      { id: 'doc-reportes', label: 'Reportes', icon: <BarChart3 className="size-4" /> },
      { id: 'nova-cloud-planes', label: 'Planes de Almacenamiento', icon: <Cloud className="size-4" /> }
    ]
  },
  {
    id: 'notificaciones',
    label: 'Notificaciones',
    icon: <BellRing className="size-5" />,
    submenu: [
      { id: 'alertas', label: 'Alertas', icon: <AlertTriangle className="size-4" /> },
      { id: 'mensajes', label: 'Mensajes', icon: <MessageSquare className="size-4" /> },
      { id: 'push', label: 'Push', icon: <Send className="size-4" /> }
    ]
  },
  { id: 'suscripciones', label: 'Mi Empresa', icon: <Zap className="size-5" />, section: 'Sistema' },
  { id: 'configuracion', label: 'Configuración', icon: <Settings className="size-5" /> },
];

/** Orden canónico de módulos: debe coincidir con el orden visual del sidebar. */
export const SIDEBAR_MODULE_ORDER: Array<Module | 'overview'> = menuItems.map((item) => item.id);

const platformMenuItems: MenuItem[] = [
  {
    id: 'overview',
    label: 'Master Console',
    icon: <LayoutDashboard className="size-5" />,
    section: 'NovaHub Platform',
  },
  {
    id: 'fuerza-comercial',
    label: 'Fuerza Comercial',
    icon: <MapPinned className="size-5" />,
    section: 'NovaHub Platform',
    superadminOnly: true,
  },
  {
    id: 'suscripciones',
    label: 'Grupos y cotizaciones',
    icon: <Building2 className="size-5" />,
  },
  {
    id: 'configuracion',
    label: 'Configuración global',
    icon: <Settings className="size-5" />,
    section: 'Ajustes',
  },
  {
    id: 'centro-capacitacion',
    label: 'Capacitación ERP',
    icon: <GraduationCap className="size-5" />,
    section: 'Ayuda',
  },
  { id: 'soporte-tecnico', label: 'Soporte técnico', icon: <LifeBuoy className="size-5" /> },
  { id: 'asesoria-legal', label: 'Asesoría legal', icon: <Scale className="size-5" /> },
  {
    id: 'qa-console',
    label: 'Validador ERP (QA)',
    icon: <ShieldCheck className="size-5" />,
    section: 'NovaHub Platform',
    superadminOnly: true,
  },
];

/** Orden del sidebar específico para usuarios de la plataforma NovaHub. */
export const PLATFORM_SIDEBAR_MODULE_ORDER: Array<Module | 'overview'> = platformMenuItems.map((item) => item.id);

export function Sidebar({ activeModule, activeSubModule, onModuleChange, isOpen, isCollapsed, onClose, onOverview }: SidebarProps) {
  const { hasAccess, canPerform, user } = useAuth();
  const { themeConfig } = useTheme();
  const workspaceName = user?.isPlatformAdmin
    ? 'NovaHub Platform'
    : (user?.sessionBranding?.name || user?.clientTenant?.name || themeConfig.tenantName || 'ERP Platform');
  const workspaceLogo = user?.isPlatformAdmin
    ? null
    : (user?.sessionBranding?.logo ?? user?.clientTenant?.logo ?? themeConfig.logo);
  const workspaceKind: 'group' | 'branch' | 'platform' = user?.isPlatformAdmin
    ? 'platform'
    : (user?.sessionBranding?.kind || (user?.clientTenant ? 'branch' : 'group'));
  const [isDesktopViewport, setIsDesktopViewport] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1024,
  );

  useEffect(() => {
    const handleViewportChange = () => setIsDesktopViewport(window.innerWidth >= 1024);
    handleViewportChange();
    window.addEventListener('resize', handleViewportChange);
    return () => window.removeEventListener('resize', handleViewportChange);
  }, []);

  // El estado persistido de escritorio no debe convertir el menú móvil en
  // una barra de iconos: en pantallas pequeñas siempre se muestran las
  // etiquetas y los submenús navegables.
  const sidebarCollapsed = Boolean(isCollapsed && isDesktopViewport);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set(activeModule && activeModule !== 'overview' ? [activeModule] : []));

  const [prevActiveModule, setPrevActiveModule] = useState(activeModule);
  if (prevActiveModule !== activeModule) {
    setPrevActiveModule(activeModule);
    if (activeModule && activeModule !== 'overview') {
      setExpandedMenus(new Set([activeModule]));
    }
  }

  const activeMenuArray = (user?.isPlatformAdmin ? platformMenuItems : menuItems).filter(
    (item) => !item.superadminOnly || user?.role === 'superadmin'
  );

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev => {
      if (prev.has(id)) return new Set();
      return new Set([id]);
    });
  };

  const handleMenuClick = (item: MenuItem) => {
    if (item.id === 'overview') {
      onOverview();
      if (window.innerWidth < 1024) onClose();
      return;
    }
    if (item.submenu) {
      if (sidebarCollapsed) {
        const visibleSubmenu = item.submenu.filter(subItem => !subItem.hidden && !HIDDEN_DEFERRED_SALES_VIEW_IDS.has(subItem.id) && hasSubmenuAccess(item.id, subItem.id));
        const currentSubmenu = activeModule === item.id
          ? visibleSubmenu.find(subItem => subItem.id === activeSubModule)
          : undefined;
        const targetSubmenu = currentSubmenu || visibleSubmenu[0];

        if (targetSubmenu) {
          onModuleChange(item.id as Module, targetSubmenu.id);
          if (window.innerWidth < 1024) onClose();
        }
        return;
      }

      toggleMenu(item.id);
    } else {
      onModuleChange(item.id as Module);
      if (window.innerWidth < 1024) onClose();
    }
  };

  const handleSubmenuClick = (parentId: Module, subId: string) => {
    onModuleChange(parentId, subId);
    if (window.innerWidth < 1024) onClose();
  };

  const buildModuleHref = (module: Module | 'overview', subModule?: string) => {
    const params = new URLSearchParams();
    if (module !== 'overview') params.set('m', module);
    if (subModule) params.set('sm', subModule);
    const query = params.toString();
    return `${window.location.pathname}${query ? `?${query}` : ''}`;
  };

  const handleNavigationLinkClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    handler: () => void,
  ) => {
    // Keep the browser's native behavior for Ctrl/Cmd-click, middle-click,
    // Shift-click and Alt-click, including "Abrir vínculo en otra pestaña".
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    handler();
  };

  const PARENT_MODULE_MAP: Record<string, string> = {
    ventas: 'SALES',
    compras: 'PURCHASES',
    inventario: 'INVENTORY',
    finanzas: 'FINANCIAL',
    rh: 'HR',
    'rrhh': 'HR',
    proyectos: 'PROJECTS',
    reportes: 'REPORTS',
    documentos: 'DOCUMENTS',
    actividades: 'ACTIVITIES',
    tickets: 'TICKETS',
    notificaciones: 'NOTIFICATIONS',
    contabilidad: 'ACCOUNTING',
    'financiamiento-pyme': 'FINANCING',
    'asesoria-legal': 'LEGAL',
    'centro-capacitacion': 'HR_TRAINING',
    'soporte-tecnico': 'SUPPORT_TECH',
    restaurante: 'RESTAURANT'
  };

  const hasSubmenuAccess = (parentId: Module | 'overview', subId: string) => {
    if (!user || parentId === 'overview') return false;
    const parentMod = PARENT_MODULE_MAP[parentId] || (parentId === 'inventario' ? 'INVENTORY' : null);
    
    // Check if parent or any of its submodules is active
    let isParentOrSubmoduleActive = false;
    if (parentMod) {
      if (user.enabledModules.includes(parentMod)) {
        isParentOrSubmoduleActive = true;
      } else {
        isParentOrSubmoduleActive = user.enabledModules.some(m => m.startsWith(`${parentMod}_`));
      }
    }
    
    if (parentMod && !isParentOrSubmoduleActive) return false;

    const requiredModules = SUBMENU_MODULE_REQUIREMENTS[`${parentId}:${subId}`] || SUBMENU_MODULE_REQUIREMENTS[subId];
    if (!requiredModules || requiredModules.length === 0) {
      return parentMod ? canPerform(parentMod, 'view') : false;
    }

    const hasRequired = requiredModules.some(mod => user.enabledModules.includes(mod));
    // La suscripción al módulo padre habilita todas sus vistas. La
    // suscripción granular (sin padre) solo habilita los submódulos
    // específicos contratados.
    const hasParentModule = Boolean(parentMod && user.enabledModules.includes(parentMod));
    const hasSubscription = hasRequired || hasParentModule;
    if (!hasSubscription) return false;

    // La suscripción habilita el módulo, pero el rol también debe tener
    // permiso de lectura sobre la vista concreta.
    const permissionModules = SIDEBAR_SUBMENU_PERMISSION_MODULES[`${parentId}:${subId}`]
      || SIDEBAR_SUBMENU_PERMISSION_MODULES[subId]
      || requiredModules;
    return permissionModules.some(mod => canPerform(mod, 'view'))
      || (parentMod ? canPerform(parentMod, 'view') : false);
  };

  const sectionHeaderIds = (() => {
    const headers = new Set<string>();
    let lastSection = '';
    for (const item of activeMenuArray) {
      if (item.id === 'overview') {
        if (!hasAccess('dashboard')) continue;
      } else if (!hasAccess(item.id as Module)) {
        continue;
      }
      const visibleSubmenu = item.submenu
        ? item.submenu.filter(subItem => !subItem.hidden && !HIDDEN_DEFERRED_SALES_VIEW_IDS.has(subItem.id) && hasSubmenuAccess(item.id, subItem.id))
        : undefined;
      if (item.submenu && (!visibleSubmenu || visibleSubmenu.length === 0)) continue;
      if (item.section && item.section !== lastSection) headers.add(item.id);
      if (item.section) lastSection = item.section;
    }
    return headers;
  })();

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-dvh max-h-[100dvh] min-h-0 w-[270px] overflow-hidden overscroll-none border-r border-sidebar-border bg-sidebar transition-all duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:sticky lg:translate-x-0',
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[270px]'
        )}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {/* Logo */}
          <div className={cn("flex h-16 items-center justify-between border-b border-sidebar-border px-3 overflow-visible", sidebarCollapsed && "lg:justify-center")}>
            <div className="flex items-center gap-3">
              <BrandLogo
                src={workspaceLogo}
                alt={`Logo de ${workspaceName}`}
                kind={workspaceKind}
                className="size-9 rounded-xl bg-sidebar-accent text-sidebar-accent-foreground ring-0 transition-all"
                imageClassName="rounded-xl"
              />
              {!sidebarCollapsed && (
                <div className="flex flex-col items-start leading-none overflow-hidden">
                  <span className="text-sm font-black tracking-tight text-sidebar-foreground truncate max-w-[130px]">
                    {workspaceName}
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/50 tracking-widest uppercase mt-0.5 truncate max-w-[130px]">
                    {user?.isPlatformAdmin ? 'NovaHub Platform' : user?.managerMode ? 'Modo supervisor' : 'NovaHub ERP'}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden"
              aria-label="Cerrar menú"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Navigation */}
          <div data-sidebar-navigation className="min-h-0 flex-1 touch-pan-y overscroll-contain overflow-y-auto py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] no-scrollbar">
            <TooltipProvider delayDuration={100}>
            <nav className="px-3 space-y-0.5">
              {activeMenuArray.map((item) => {
                if (item.id === 'overview') {
                  if (!hasAccess('dashboard')) return null;
                } else if (!hasAccess(item.id as Module)) {
                  return null;
                }
                const visibleSubmenu = item.submenu
                  ? item.submenu.filter(subItem => !subItem.hidden && !HIDDEN_DEFERRED_SALES_VIEW_IDS.has(subItem.id) && hasSubmenuAccess(item.id, subItem.id))
                  : undefined;

                if (item.submenu && (!visibleSubmenu || visibleSubmenu.length === 0)) return null;

                const isActive = activeModule === item.id;
                const isExpanded = expandedMenus.has(item.id);
                const showSection = sectionHeaderIds.has(item.id);
                const itemClassName = cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors duration-150',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                  isActive && !item.submenu
                    ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                    : isActive && item.submenu
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border'
                      : 'text-sidebar-foreground/70'
                );
                const itemHref = buildModuleHref(item.id as Module | 'overview');
                const itemClickHandler = () => handleMenuClick(item);

                return (
                  <React.Fragment key={item.id}>
                    {showSection && !sidebarCollapsed && (
                      <div className="px-3 pt-6 pb-2 flex">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/60 border-b border-sidebar-border/50 pb-1 w-full">
                          {item.section}
                        </span>
                      </div>
                    )}
                    {showSection && sidebarCollapsed && <div className="pt-4" />}
                    <div>
                      {sidebarCollapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {item.submenu ? (
                              <button onClick={itemClickHandler} className={itemClassName} aria-label={item.label}>
                                <span className="flex items-center justify-center shrink-0">{item.icon}</span>
                              </button>
                            ) : (
                              <a
                                href={itemHref}
                                onClick={(event) => handleNavigationLinkClick(event, itemClickHandler)}
                                className={itemClassName}
                                aria-label={item.label}
                                aria-current={isActive ? 'page' : undefined}
                              >
                                <span className="flex items-center justify-center shrink-0">{item.icon}</span>
                              </a>
                            )}
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={10} className="font-bold text-xs bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border shadow-lg">
                            {user?.role === 'partner' && item.id === 'clientes' ? 'Mis Clientes' : item.label}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        item.submenu ? (
                          <button onClick={itemClickHandler} className={itemClassName} aria-expanded={isExpanded}>
                            <span className="flex items-center justify-center shrink-0">{item.icon}</span>
                            <span className="flex-1 text-left truncate">
                              {user?.role === 'partner' && item.id === 'clientes' ? 'Mis Clientes' : item.label}
                            </span>
                            {visibleSubmenu && visibleSubmenu.length > 0 && (
                              <motion.span
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                                className="shrink-0"
                              >
                                <ChevronDown className="size-4 opacity-50" />
                              </motion.span>
                            )}
                          </button>
                        ) : (
                          <a
                            href={itemHref}
                            onClick={(event) => handleNavigationLinkClick(event, itemClickHandler)}
                            className={itemClassName}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            <span className="flex items-center justify-center shrink-0">{item.icon}</span>
                            <span className="flex-1 text-left truncate">
                              {user?.role === 'partner' && item.id === 'clientes' ? 'Mis Clientes' : item.label}
                            </span>
                          </a>
                        )
                      )}

                      <AnimatePresence>
                        {visibleSubmenu && visibleSubmenu.length > 0 && isExpanded && !sidebarCollapsed && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="ml-5 mt-0.5 space-y-0.5 border-l border-sidebar-border/40 pl-3 py-1">
                              {visibleSubmenu.map((subItem) => (
                                <a
                                  key={subItem.id}
                                  href={buildModuleHref(item.id as Module, subItem.id)}
                                  onClick={(event) => handleNavigationLinkClick(
                                    event,
                                    () => handleSubmenuClick(item.id as Module, subItem.id),
                                  )}
                                  className={cn(
                                    'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150',
                                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                                    activeModule === item.id && activeSubModule === subItem.id
                                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm'
                                      : 'text-sidebar-foreground/55'
                                  )}
                                  aria-current={activeModule === item.id && activeSubModule === subItem.id ? 'page' : undefined}
                                >
                                  {subItem.icon}
                                  <span className="flex-1 text-left truncate">{subItem.label}</span>
                                </a>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </React.Fragment>
                );
              })}
            </nav>
            </TooltipProvider>
          </div>

          {/* User Info Footer */}
          <div className="shrink-0 border-t border-sidebar-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div className={cn("flex items-center gap-3 rounded-xl bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border/50", sidebarCollapsed ? "p-1.5 justify-center" : "px-3 py-3")}>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                {user?.name.charAt(0)}
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
                    {user?.name}
                  </p>
                  <div className="flex">
                    <p className="truncate text-[11px] text-sidebar-accent-foreground capitalize odoo-highlight">
                      {user?.customRoleName || {
                        superadmin: 'Super Administrador',
                        partner: 'Partner',
                        admin: 'Administrador',
                        manager: 'Gerente',
                        employee: 'Empleado',
                        viewer: 'Solo Lectura',
                        user: 'Usuario',
                      }[user?.role?.toLowerCase() || ''] || user?.role}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
