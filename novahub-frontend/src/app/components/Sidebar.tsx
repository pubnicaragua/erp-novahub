import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  ChevronDown,
  BarChart3,
  ShoppingCart,
  ArrowLeftRight,
  Shield,
  Settings,
  X,
  ShoppingBag,
  DollarSign,
  Users,
  Truck,
  Activity,
  Headphones,
  FolderOpen,
  BellRing,
  LayoutDashboard,
  UserCircle,
  FileSpreadsheet,
  ClipboardList,
  FileText,
  FileCheck,
  CreditCard,
  RotateCcw,
  PackageCheck,
  Receipt,
  BadgeDollarSign,
  Wallet,
  Banknote,
  CalendarClock,
  FileInput,
  FileMinus,
  FileOutput,
  Plus,
  Database,
  Zap,
} from 'lucide-react';
import { cn } from './ui/utils';
import { useAuth, type Module } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { NovaHubLogo } from './NovaHubLogo';

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
}

interface MenuItem {
  id: Module | 'overview';
  label: string;
  icon: React.ReactNode;
  submenu?: SubMenuItem[];
  section?: string;
}

const SUBMENU_MODULE_REQUIREMENTS: Record<string, string[]> = {
  clientes: ['CLIENTS', 'SALES', 'SALES_CLIENTS'],
  estimaciones: ['SALES', 'SALES_QUOTES'],
  'ordenes-venta': ['SALES', 'SALES_ORDERS'],
  facturas: ['SALES', 'SALES_INVOICES'],
  'facturas-recurrentes': ['SALES', 'SALES_INVOICES'],
  'pagos-recibidos': ['SALES', 'SALES_PAYMENTS'],
  'devoluciones-venta': ['SALES', 'SALES_RETURNS'],
  'notas-credito': ['SALES', 'SALES_CREDIT_NOTES'],
  proveedores: ['PROVIDERS', 'PURCHASES', 'PURCHASES_PROVIDERS'],
  gastos: ['PURCHASES', 'FINANCIAL', 'PURCHASES_INVOICES'],
  'gastos-recurrentes': ['PURCHASES', 'FINANCIAL', 'PURCHASES_INVOICES'],
  'ordenes-compra': ['PURCHASES', 'PURCHASES_ORDERS'],
  'recepciones-compra': ['PURCHASES', 'PURCHASES_RECEIPTS'],
  'facturas-proveedor': ['PURCHASES', 'PURCHASES_INVOICES'],
  'facturas-proveedor-rec': ['PURCHASES', 'PURCHASES_INVOICES'],
  'pagos-realizados': ['PURCHASES', 'PURCHASES_PAYMENTS', 'FINANCIAL'],
  'creditos-proveedor': ['PURCHASES', 'PURCHASES_RETURNS'],
};

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
      { id: 'estimaciones', label: 'Estimaciones', icon: <FileSpreadsheet className="size-4" /> },
      { id: 'ordenes-venta', label: 'Ordenes de venta', icon: <ClipboardList className="size-4" />, hasAdd: true },
      { id: 'facturas', label: 'Facturas', icon: <FileText className="size-4" /> },
      { id: 'facturas-recurrentes', label: 'Facturas recurrentes', icon: <RotateCcw className="size-4" /> },
      { id: 'pagos-recibidos', label: 'Pagos recibidos', icon: <CreditCard className="size-4" /> },
      { id: 'devoluciones-venta', label: 'Devoluciones de venta', icon: <FileOutput className="size-4" /> },
      { id: 'notas-credito', label: 'Notas de credito', icon: <FileMinus className="size-4" /> },
    ]
  },
  {
    id: 'compras',
    label: 'Compras',
    icon: <ShoppingCart className="size-5" />,
    submenu: [
      { id: 'proveedores', label: 'Proveedores', icon: <Truck className="size-4" />, hasAdd: true },
      { id: 'gastos', label: 'Gastos', icon: <Wallet className="size-4" /> },
      { id: 'gastos-recurrentes', label: 'Gastos recurrentes', icon: <CalendarClock className="size-4" /> },
      { id: 'ordenes-compra', label: 'Ordenes de compra', icon: <ClipboardList className="size-4" /> },
      { id: 'recepciones-compra', label: 'Recepciones de compra', icon: <PackageCheck className="size-4" /> },
      { id: 'facturas-proveedor', label: 'Facturas de proveedor', icon: <FileInput className="size-4" /> },
      { id: 'facturas-proveedor-rec', label: 'Facturas de proveedor rec.', icon: <RotateCcw className="size-4" /> },
      { id: 'pagos-realizados', label: 'Pagos realizados', icon: <Banknote className="size-4" /> },
      { id: 'creditos-proveedor', label: 'Creditos del proveedor', icon: <BadgeDollarSign className="size-4" /> },
    ]
  },
  { id: 'inventario', label: 'Inventario', icon: <Package className="size-5" /> },
  {
    id: 'finanzas',
    label: 'Finanzas',
    icon: <DollarSign className="size-5" />,
    section: 'Administracion',
    submenu: [
      { id: 'ingresos', label: 'Ingresos', icon: <Receipt className="size-4" /> },
      { id: 'egresos', label: 'Gastos', icon: <Wallet className="size-4" /> },
      { id: 'gastos-recurrentes', label: 'Gastos recurrentes', icon: <CalendarClock className="size-4" /> },
      { id: 'balance', label: 'Balance General', icon: <BarChart3 className="size-4" /> },
    ]
  },
  {
    id: 'rh',
    label: 'Recursos Humanos',
    icon: <Users className="size-5" />,
    submenu: [
      { id: 'empleados', label: 'Empleados', icon: <Users className="size-4" /> },
      { id: 'nominas', label: 'Nóminas', icon: <DollarSign className="size-4" /> },
      { id: 'asistencia', label: 'Asistencia', icon: <CalendarClock className="size-4" /> },
      { id: 'ausencias', label: 'Vacaciones', icon: <CalendarClock className="size-4" /> },
      { id: 'evaluaciones', label: 'Desempeño', icon: <BarChart3 className="size-4" /> },
      { id: 'capacitaciones', label: 'Capacitación', icon: <FileCheck className="size-4" /> },
      { id: 'beneficios', label: 'Beneficios', icon: <Plus className="size-4" /> },
    ]
  },
  { id: 'actividades', label: 'Actividades', icon: <Activity className="size-5" />, section: 'Herramientas' },
  { id: 'tickets', label: 'Tickets y Soporte', icon: <Headphones className="size-5" /> },
  { id: 'documentos', label: 'Documentos', icon: <FolderOpen className="size-4" /> },
  { id: 'notificaciones', label: 'Notificaciones', icon: <BellRing className="size-5" /> },
  { id: 'reportes', label: 'Reportes', icon: <BarChart3 className="size-5" />, section: 'Sistema' },
  { id: 'suscripciones', label: 'Suscripciones', icon: <Zap className="size-5" /> },
  { id: 'configuracion', label: 'Configuracion', icon: <Settings className="size-5" /> },
];

export function Sidebar({ activeModule, activeSubModule, onModuleChange, isOpen, isCollapsed, onClose, onOverview }: SidebarProps) {
  const { hasAccess, user } = useAuth();
  const { themeConfig } = useTheme();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set(['ventas', 'compras']));

  const toggleMenu = (id: string) => {
    if (isCollapsed) return; // Disallow expanding submenus while collapsed, or you could auto-expand the sidebar
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMenuClick = (item: MenuItem) => {
    if (item.id === 'overview') {
      onOverview();
      if (window.innerWidth < 1024) onClose();
      return;
    }
    if (item.submenu) {
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

  const hasSubmenuAccess = (parentId: Module | 'overview', subId: string) => {
    if (!user || parentId === 'overview') return false;
    if (user.role === 'admin' && subId in SUBMENU_MODULE_REQUIREMENTS) {
      // Admin también respeta módulos habilitados del tenant.
      return SUBMENU_MODULE_REQUIREMENTS[subId].some(mod => user.enabledModules.includes(mod));
    }

    const requiredModules = SUBMENU_MODULE_REQUIREMENTS[subId];
    if (!requiredModules || requiredModules.length === 0) return true;
    return requiredModules.some(mod => user.enabledModules.includes(mod));
  };

  let lastSection = '';

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
          'fixed left-0 top-0 z-50 h-screen w-[270px] border-r border-sidebar-border bg-sidebar transition-all duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:sticky lg:translate-x-0',
          isCollapsed ? 'lg:w-[72px]' : 'lg:w-[270px]'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
            <div className="flex items-center gap-3">
              {themeConfig.logo ? (
                <img src={themeConfig.logo} alt="Company Logo" className={cn("max-h-9 object-contain transition-all", isCollapsed ? "max-w-9" : "max-w-16")} />
              ) : (
                <NovaHubLogo size={isCollapsed ? 36 : 38} />
              )}
              {!isCollapsed && (
                <div className="flex flex-col items-start leading-none overflow-hidden">
                  <span className="text-sm font-black tracking-tight text-sidebar-foreground truncate max-w-[130px]">
                    Nova<span className="text-emerald-500">Hub</span>
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/50 tracking-widest uppercase mt-0.5 truncate max-w-[130px]">
                    {themeConfig.tenantName || 'ERP Platform'}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
              aria-label="Cerrar menu"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Navigation */}
          <div className="flex-1 min-h-0 overflow-y-auto py-3 no-scrollbar">
            <nav className="px-3 space-y-0.5">
              {menuItems.map((item) => {
                if (item.id !== 'overview' && !hasAccess(item.id as Module)) return null;
                const visibleSubmenu = item.submenu
                  ? item.submenu.filter(subItem => hasSubmenuAccess(item.id, subItem.id))
                  : undefined;

                const isActive = activeModule === item.id;
                const isExpanded = expandedMenus.has(item.id);
                const showSection = item.section && item.section !== lastSection;
                if (item.section) lastSection = item.section;

                return (
                  <React.Fragment key={item.id}>
                    {showSection && !isCollapsed && (
                      <div className="px-3 pt-6 pb-2 flex">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/60 border-b border-sidebar-border/50 pb-1 w-full">
                          {item.section}
                        </span>
                      </div>
                    )}
                    {showSection && isCollapsed && <div className="pt-4" />}
                    <div>
                      <button
                        onClick={() => handleMenuClick(item)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-150',
                          'hover:bg-sidebar-accent hover:text-sidebar-foreground',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                          isActive && !item.submenu
                            ? 'bg-[#048833] text-white shadow-sm font-semibold'
                            : isActive && item.submenu
                              ? 'bg-sidebar-accent/80 text-sidebar-foreground'
                              : 'text-sidebar-foreground/70'
                        )}
                      >
                        <span className="flex items-center justify-center shrink-0">
                          {item.icon}
                        </span>
                        {!isCollapsed && (
                          <>
                            <span className={cn("flex-1 text-left truncate", item.label === 'Notificaciones' && "odoo-highlight w-fit flex-none")}>
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
                          </>
                        )}
                      </button>

                      <AnimatePresence>
                        {visibleSubmenu && visibleSubmenu.length > 0 && isExpanded && !isCollapsed && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="ml-5 mt-0.5 space-y-0.5 border-l border-sidebar-border/40 pl-3 py-1">
                              {visibleSubmenu.map((subItem) => (
                                <button
                                  key={subItem.id}
                                  onClick={() => handleSubmenuClick(item.id as Module, subItem.id)}
                                  className={cn(
                                    'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150',
                                    'hover:bg-sidebar-accent hover:text-sidebar-foreground',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                                    activeModule === item.id && activeSubModule === subItem.id
                                      ? 'bg-sidebar-primary/20 text-sidebar-foreground font-medium'
                                      : 'text-sidebar-foreground/55'
                                  )}
                                >
                                  {subItem.icon}
                                  <span className="flex-1 text-left truncate">{subItem.label}</span>
                                  {subItem.hasAdd && (
                                    <Plus className="size-3.5 opacity-40 hover:opacity-100 transition-opacity" />
                                  )}
                                </button>
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
          </div>

          {/* User Info Footer */}
          <div className="border-t border-sidebar-border p-3">
            <div className={cn("flex items-center gap-3 rounded-xl bg-[#111111] border border-border", isCollapsed ? "p-1.5 justify-center" : "px-3 py-3")}>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#048833] text-sm font-bold text-white shadow-sm">
                {user?.name.charAt(0)}
              </div>
              {!isCollapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-sidebar-foreground">
                    {user?.name}
                  </p>
                  <div className="flex">
                    <p className="truncate text-[11px] text-sidebar-foreground/50 capitalize odoo-highlight">
                      {user?.role}
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
