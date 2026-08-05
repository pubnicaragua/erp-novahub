import { useEffect, useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  Search,
  Bell,
  Menu,
  LogOut,
  User,
  Settings as SettingsIcon,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Globe,
  Wallet,
  Building2,
  Euro,
  CircleDollarSign,
  ShoppingCart,
  ChevronDown,
  Check,
  Clock3,
  TrendingUp
} from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { useAuth, type Module } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { navigateToNotification } from '../utils/notificationNavigation';
import { useCurrency } from '../contexts/CurrencyContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { cn } from './ui/utils';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { usersService } from '../services/users.service';
import { Lock } from 'lucide-react';
import { TrialCountdownBanner } from './auth/TrialCountdownBanner';
import { getPasswordError } from '../utils/accountValidation';

interface TopbarProps {
  onMenuClick: () => void;
  onNavigate: (module: Module) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'warning' | 'success';
}

interface ThemeViewTransition {
  finished: Promise<void>;
  skipTransition?: () => void;
}

type ThemeTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeViewTransition;
};

let activeThemeTransition: ThemeViewTransition | null = null;
let requestedDarkMode: boolean | null = null;
let themeChangeVersion = 0;

function getSavedDarkMode() {
  return localStorage.getItem('erp-theme-mode') !== 'light';
}

export function Topbar({ onMenuClick, onNavigate, isCollapsed, onToggleCollapse }: TopbarProps) {
  const { user, logout } = useAuth();
  const hasPosAccess = user?.enabledModules?.some(m => m === 'RETAIL_POS' || m === 'SALES_POS') ?? false;
  const { unreadCount, markAsRead, notifications } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ label: string; description: string; module: string; subModule: string; group: string }[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const SEARCH_CATALOG = [
    { label: 'Facturas de Venta', description: 'Emisión, cobro y anulación de facturas', module: 'ventas', subModule: 'facturas', keywords: ['factura', 'venta', 'cobro', 'cliente'], group: 'Ventas' },
    { label: 'Presupuestos', description: 'Cotizaciones y presupuestos a clientes', module: 'ventas', subModule: 'estimaciones', keywords: ['presupuesto', 'cotizacion', 'estimacion'], group: 'Ventas' },
    { label: 'Órdenes de Venta', description: 'Órdenes de venta y pedidos', module: 'ventas', subModule: 'ordenes-venta', keywords: ['orden', 'pedido', 'venta'], group: 'Ventas' },
    { label: 'Clientes', description: 'Registro y gestión de clientes', module: 'ventas', subModule: 'clientes', keywords: ['cliente', 'contacto'], group: 'Ventas' },
    { label: 'Pagos Recibidos', description: 'Cobros y pagos de clientes', module: 'ventas', subModule: 'pagos-recibidos', keywords: ['pago', 'cobro', 'recibido'], group: 'Ventas' },
    { label: 'Productos', description: 'Catálogo de productos y servicios', module: 'inventario', subModule: 'productos', keywords: ['producto', 'articulo', 'servicio', 'sku'], group: 'Inventario' },
    { label: 'Categorías', description: 'Categorías de productos', module: 'inventario', subModule: 'categorias', keywords: ['categoria', 'tipo'], group: 'Inventario' },
    { label: 'Movimientos', description: 'Entradas y salidas de inventario', module: 'inventario', subModule: 'movimientos', keywords: ['movimiento', 'entrada', 'salida'], group: 'Inventario' },
    { label: 'Ajustes de Stock', description: 'Ajustes manuales de inventario', module: 'inventario', subModule: 'ajustes', keywords: ['ajuste', 'stock'], group: 'Inventario' },
    { label: 'Transferencias', description: 'Movimientos entre almacenes', module: 'inventario', subModule: 'transferencias', keywords: ['transferencia', 'almacen'], group: 'Inventario' },
    { label: 'Proveedores', description: 'Registro y gestión de proveedores', module: 'compras', subModule: 'proveedores', keywords: ['proveedor', 'vendor'], group: 'Compras' },
    { label: 'Órdenes de Compra', description: 'Órdenes de compra a proveedores', module: 'compras', subModule: 'ordenes-compra', keywords: ['orden', 'compra', 'pedido'], group: 'Compras' },
    { label: 'Recepciones', description: 'Recepción de mercadería', module: 'compras', subModule: 'recepciones-compra', keywords: ['recepcion', 'entrada', 'mercaderia'], group: 'Compras' },
    { label: 'Facturas de Proveedor', description: 'Facturas recibidas de proveedores', module: 'compras', subModule: 'facturas-proveedor', keywords: ['factura', 'proveedor'], group: 'Compras' },
    { label: 'Pagos Realizados', description: 'Pagos a proveedores', module: 'compras', subModule: 'pagos-realizados', keywords: ['pago', 'proveedor'], group: 'Compras' },
    { label: 'Solicitudes de Compra', description: 'Solicitudes internas de compra', module: 'compras', subModule: 'solicitudes-compra', keywords: ['solicitud', 'requisicion'], group: 'Compras' },
    { label: 'Gestión de Compras', description: 'Aprobación y gestión de compras', module: 'compras', subModule: 'gestion-compras', keywords: ['gestion', 'aprobacion'], group: 'Compras' },
    { label: 'Gastos', description: 'Gastos operativos directos', module: 'compras', subModule: 'gastos', keywords: ['gasto', 'caja chica'], group: 'Compras' },
    { label: 'Plan de Cuentas', description: 'Catálogo de cuentas contables', module: 'contabilidad', subModule: 'cuentas', keywords: ['cuenta', 'contable', 'plan', 'catalogo'], group: 'Contabilidad' },
    { label: 'Asientos Contables', description: 'Diario y asientos contables', module: 'contabilidad', subModule: 'asientos', keywords: ['asiento', 'diario', 'contable'], group: 'Contabilidad' },
    { label: 'Balance General', description: 'Reporte de balance general', module: 'contabilidad', subModule: 'balance-general', keywords: ['balance', 'activo', 'pasivo'], group: 'Contabilidad' },
    { label: 'Diferencias Cambiarias', description: 'Valoración histórica y actual de saldos en moneda extranjera', module: 'contabilidad', subModule: 'diferencias-cambiarias', keywords: ['moneda', 'cambio', 'tasa', 'ganancia', 'perdida', 'revaluacion'], group: 'Contabilidad' },
    { label: 'Estado de Resultados', description: 'Pérdidas y ganancias', module: 'contabilidad', subModule: 'estado-resultados', keywords: ['resultado', 'ganancia', 'perdida'], group: 'Contabilidad' },
    { label: 'Conciliación Bancaria', description: 'Conciliación de cuentas bancarias', module: 'contabilidad', subModule: 'conciliacion', keywords: ['conciliacion', 'banco'], group: 'Contabilidad' },
    { label: 'Reportes Fiscales', description: 'IVA, IR, INSS, INATEC', module: 'contabilidad', subModule: 'reportes-fiscales', keywords: ['fiscal', 'iva', 'ir', 'inss', 'dgi'], group: 'Contabilidad' },
    { label: 'Resumen Financiero', description: 'Dashboard financiero con KPIs', module: 'finanzas', subModule: 'resumen-financiero', keywords: ['finanzas', 'resumen', 'dashboard'], group: 'Finanzas' },
    { label: 'Caja y Bancos', description: 'Saldo y movimientos de efectivo', module: 'finanzas', subModule: 'caja-bancos', keywords: ['caja', 'banco', 'efectivo'], group: 'Finanzas' },
    { label: 'CxC', description: 'Cuentas por cobrar', module: 'finanzas', subModule: 'cuentas-cobrar', keywords: ['cxc', 'cobrar', 'pendiente'], group: 'Finanzas' },
    { label: 'CxP', description: 'Cuentas por pagar', module: 'finanzas', subModule: 'cuentas-pagar', keywords: ['cxp', 'pagar', 'pendiente'], group: 'Finanzas' },
    { label: 'Empleados', description: 'Registro y expediente de empleados', module: 'rh', subModule: 'empleados', keywords: ['empleado', 'trabajador', 'colaborador'], group: 'RRHH' },
    { label: 'Nóminas', description: 'Procesamiento de nóminas', module: 'rh', subModule: 'nominas', keywords: ['nomina', 'salario', 'pago'], group: 'RRHH' },
    { label: 'Asistencia', description: 'Control de asistencia y marcaje', module: 'rh', subModule: 'asistencia', keywords: ['asistencia', 'marcaje', 'reloj'], group: 'RRHH' },
    { label: 'Ausencias', description: 'Solicitudes de permisos y vacaciones', module: 'rh', subModule: 'ausencias', keywords: ['ausencia', 'permiso', 'vacacion'], group: 'RRHH' },
    { label: 'Configuración', description: 'Ajustes generales del sistema', module: 'configuracion', subModule: undefined, keywords: ['configuracion', 'ajustes'], group: 'Sistema' },
  ];

  const getSearchResults = (query: string) => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return SEARCH_CATALOG
      .filter(entry => 
        entry.label.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.keywords.some(k => k.includes(q))
      )
      .slice(0, 12)
      .map(entry => ({ label: entry.label, description: entry.description, module: entry.module, subModule: entry.subModule || '', group: entry.group }));
  };

  const groupedResults = Object.entries(
    searchResults.reduce((acc: Record<string, typeof searchResults>, r) => {
      (acc[r.group] = acc[r.group] || []).push(r);
      return acc;
    }, {})
  );

  // Close search results on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleChangePassword = async () => {
    const passwordError = getPasswordError(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    if (!user?.id) return;

    try {
      setIsUpdatingPassword(true);
      await usersService.changePassword(user.id, newPassword);
      toast.success('Contraseña actualizada exitosamente');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al actualizar la contraseña');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogout = () => {
    logout();
    // En producción: redirect to login
  };

  const handleSettings = () => {
    onNavigate('configuracion');
  };

  const [isDark, setIsDark] = useState(getSavedDarkMode);

  useEffect(() => {
    const root = document.documentElement;
    const syncFromRoot = () => setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(syncFromRoot);

    const syncFromStorage = (event: StorageEvent) => {
      if (event.key !== 'erp-theme-mode') return;
      const nextDark = event.newValue !== 'light';
      root.classList.toggle('dark', nextDark);
      setIsDark(nextDark);
    };

    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', syncFromStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const toggleTheme = (event?: React.MouseEvent<HTMLElement>) => {
    const root = document.documentElement;
    const transitionDocument = document as ThemeTransitionDocument;
    // La clase del DOM es la fuente de verdad; así cada clic funciona aunque
    // React tenga una actualización pendiente o el tema cambie desde otra pestaña.
    const nextDark = !(requestedDarkMode ?? root.classList.contains('dark'));
    const requestVersion = ++themeChangeVersion;
    requestedDarkMode = nextDark;

    const applyTheme = () => {
      // Un callback de View Transitions puede ejecutarse después de un segundo
      // clic. Si ya existe una intención más reciente, no debe sobrescribirla.
      if (requestVersion !== themeChangeVersion) return;
      root.classList.toggle('dark', nextDark);
      localStorage.setItem('erp-theme-mode', nextDark ? 'dark' : 'light');
      flushSync(() => setIsDark(nextDark));
      requestedDarkMode = null;
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!transitionDocument.startViewTransition || reduceMotion) {
      applyTheme();
      return;
    }

    // Un segundo clic no espera a que termine la esfera: cancela solo el efecto
    // visual anterior y aplica la nueva intención inmediatamente.
    if (activeThemeTransition) {
      const previousTransition = activeThemeTransition;
      activeThemeTransition = null;
      delete root.dataset.themeTransition;
      previousTransition.skipTransition?.();
      applyTheme();
      return;
    }

    const bounds = event?.currentTarget.getBoundingClientRect();
    const x = bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2;
    const y = bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    root.style.setProperty('--theme-transition-x', `${x}px`);
    root.style.setProperty('--theme-transition-y', `${y}px`);
    root.style.setProperty('--theme-transition-radius', `${Math.ceil(radius)}px`);
    root.dataset.themeTransition = 'active';

    try {
      const transition = transitionDocument.startViewTransition(applyTheme);
      activeThemeTransition = transition;
      void transition.finished
        .catch(() => undefined)
        .finally(() => {
          if (activeThemeTransition === transition) {
            activeThemeTransition = null;
            delete root.dataset.themeTransition;
          }
        });
    } catch {
      activeThemeTransition = null;
      delete root.dataset.themeTransition;
      applyTheme();
    }
  };

  const { currency, toggleCurrency, currencyInteractionEnabled, valuationMode, setValuationMode, valuationModeLabel, showValuationLegend, setShowValuationLegend } = useCurrency();

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'superadmin': return <Badge className="bg-primary/10 text-primary border-primary/20 px-1 py-0 text-[10px]">SuperAdmin</Badge>;
      case 'partner': return <Badge className="bg-primary/10 text-primary border-primary/20 px-1 py-0 text-[10px]">Partner</Badge>;
      case 'admin': return <Badge className="bg-primary/10 text-primary border-primary/20 px-1 py-0 text-[10px]">Administrador</Badge>;
      default: return <Badge variant="outline" className="px-1 py-0 text-[10px] capitalize">{role}</Badge>;
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <TrialCountdownBanner />
      <header className="flex h-16 min-w-0 items-center gap-2 border-b border-border bg-background/95 px-3 sm:gap-3 sm:px-4 lg:gap-4 lg:px-6" >
      {/* Menu Toggle (Mobile) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="lg:hidden shrink-0"
        aria-label="Abrir menú"
      >
        <Menu className="size-5" />
      </Button>

      {/* Menu Toggle (Desktop) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        className="hidden lg:flex shrink-0 text-muted-foreground mr-2"
        aria-label="Contraer/Expandir menú"
      >
        {isCollapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
      </Button>

      {/* Search */}
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-4">
        {/* Tenancy Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-border/50">
          <Building2 className="size-3.5 text-primary" />
          <span className="text-xs font-medium truncate max-w-[120px]">{user?.tenantName || 'Nova Hub'}</span>
          {getRoleBadge(user?.role || '')}
        </div>

        <div className="relative min-w-0 w-12 shrink-0 transition-[width] duration-200 focus-within:w-48 sm:w-[min(32vw,20rem)] sm:focus-within:w-[min(32vw,20rem)] lg:w-full lg:max-w-sm" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar módulos, clientes, facturas..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchResults(getSearchResults(e.target.value));
            }}
            onFocus={() => searchQuery.trim() && setSearchResults(getSearchResults(searchQuery))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchResults.length > 0) {
                const first = searchResults[0];
                setSearchQuery('');
                setSearchResults([]);
                onNavigate(first.module as Module);
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('navigate-submodule', { detail: { subModule: first.subModule } }));
                }, 100);
              }
            }}
            aria-label="Buscar módulos, clientes o facturas"
            title="Buscar módulos, clientes o facturas"
            className="h-9 w-full min-w-0 border-border/40 bg-muted/20 pl-9 pr-2 text-xs placeholder:text-transparent focus:bg-background sm:pr-4 sm:placeholder:text-muted-foreground"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl z-50 py-2 max-h-80 overflow-y-auto">
              {groupedResults.map(([group, items]) => (
                <div key={group}>
                  <p className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{group}</p>
                  {items.map((item, i) => (
                    <button
                      key={`${item.label}-${i}`}
                      className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-accent transition-colors text-left"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        onNavigate(item.module as Module);
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('navigate-submodule', { detail: { subModule: item.subModule } }));
                        }, 100);
                      }}
                    >
                      <span className="size-6 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">{group[0]}</span>
                      <div>
                        <p className="font-medium text-foreground">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3 lg:gap-4">
        {hasPosAccess && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onNavigate('ventas');
              window.dispatchEvent(new CustomEvent('navigate-module', {
                detail: { module: 'ventas', subModule: 'facturacion-caja' }
              }));
            }}
            className="h-9 gap-2 px-3 border-border bg-card hover:bg-primary/10"
            title="Ir a Facturación por Caja"
            id="topbar-quick-caja"
          >
            <ShoppingCart className="size-4 text-primary" />
            <span className="text-xs font-bold hidden sm:inline">Caja</span>
          </Button>
        )}

        {/* Currency and valuation view */}
        <div className="hidden items-center gap-0.5 rounded-xl border border-border bg-card p-0.5 lg:flex" title="Moneda y modo de valoración">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCurrency}
            className="h-8 gap-2 rounded-lg px-2.5 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            title={currencyInteractionEnabled ? 'Cambiar moneda de visualización' : 'Cambio de moneda bloqueado por configuración'}
            disabled={!currencyInteractionEnabled}
          >
            {currency === 'USD' ? <CircleDollarSign className="size-4 text-emerald-500" /> : <Wallet className="size-4 text-orange-500" />}
            <span className="text-xs font-bold">{currency}</span>
            {showValuationLegend && <span className="hidden text-[9px] font-black uppercase tracking-wider text-muted-foreground xl:inline">{valuationModeLabel}</span>}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Cambiar modo de valoración" title="Cambiar modo de valoración">
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-xl border-border/60 p-2">
              <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Vista de importes
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setValuationMode('HISTORICAL')} className="items-start gap-3 rounded-lg p-3">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wide">
                    Histórico
                    {valuationMode === 'HISTORICAL' && <Check className="size-3.5 text-emerald-500" />}
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">Usa la tasa guardada en cada transacción. Recomendado para revisar documentos.</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setValuationMode('CURRENT')} className="items-start gap-3 rounded-lg p-3">
                <TrendingUp className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wide">
                    Actual
                    {valuationMode === 'CURRENT' && <Check className="size-3.5 text-emerald-500" />}
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">Convierte saldos en moneda extranjera con la tasa vigente. No modifica la transacción.</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1.5" />
              <DropdownMenuCheckboxItem
                checked={showValuationLegend}
                onCheckedChange={setShowValuationLegend}
                className="items-start gap-3 rounded-lg p-3 pl-8"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black uppercase tracking-wide">Mostrar detalle</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">Muestra Histórico/Actual y la diferencia cambiaria en los importes.</span>
                </span>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="hidden h-9 w-9 lg:inline-flex"
          aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="size-5" />
              {unreadCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0 text-[10px]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex justify-between items-center">
              <span>Notificaciones</span>
              <span className="text-xs text-muted-foreground font-normal cursor-pointer hover:underline" onClick={() => onNavigate('notificaciones')}>Ver todas</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex flex-col gap-1 p-2 max-h-[300px] overflow-y-auto">
              {unreadCount > 0 ? (
                notifications.filter(n => !n.read).slice(0, 5).map((n) => (
                  <DropdownMenuItem 
                    key={n.id} 
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer border-b border-border/50 last:border-0" 
                    onClick={() => {
                      void markAsRead(n.id);
                      navigateToNotification(n);
                    }}
                  >
                    <div className="flex items-center gap-2">
                       <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                       <span className="font-medium text-sm line-clamp-1">{n.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-4 line-clamp-2">
                      {n.message?.startsWith('TAREA:') ? n.message.split(':').slice(2).join(':') : 
                       n.message?.startsWith('RECORDATORIO:') ? n.message.split(':').slice(2).join(':') : 
                       n.message}
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem className="py-2 justify-center text-sm text-muted-foreground" onClick={() => onNavigate('notificaciones')}>
                  Sin notificaciones nuevas.
                </DropdownMenuItem>
              )}
              {unreadCount > 5 && (
                 <DropdownMenuItem className="py-2 justify-center text-xs text-primary font-medium" onClick={() => onNavigate('notificaciones')}>
                    Ver {unreadCount - 5} más
                 </DropdownMenuItem>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-3 px-2 ml-2 hover:bg-transparent focus-visible:ring-0" aria-label="Menú de usuario">
              <Avatar className="size-9 rounded-full border-2 border-primary/30">
                <AvatarImage src={user?.avatar} alt={user?.name} className="object-cover" />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user?.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start text-left lg:flex leading-tight">
                <span className="font-semibold text-[14px] text-foreground">{user?.name}</span>
                <span className="text-[12px] text-primary/80 font-medium capitalize">
                  {user?.role}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-1rem)] sm:w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigate('configuracion')}>
              <User className="mr-2 size-4 text-primary" />
              <span>Mi Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSettings}>
              <SettingsIcon className="mr-2 size-4 text-primary" />
              <span>Configuración</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowPasswordModal(true)}>
              <Lock className="mr-2 size-4 text-primary" />
              <span>Cambiar Contraseña</span>
            </DropdownMenuItem>
            <div className="lg:hidden">
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!currencyInteractionEnabled}
                onClick={toggleCurrency}
                className="gap-2"
              >
                {currency === 'USD' ? <CircleDollarSign className="size-4 text-emerald-500" /> : <Wallet className="size-4 text-orange-500" />}
                <span>Moneda: {currency}</span>
                <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cambiar</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setValuationMode(valuationMode === 'CURRENT' ? 'HISTORICAL' : 'CURRENT')}
                className="gap-2"
              >
                {valuationMode === 'CURRENT' ? <TrendingUp className="size-4 text-amber-500" /> : <Clock3 className="size-4 text-primary" />}
                <span>Vista: {valuationModeLabel}</span>
                <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cambiar</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowValuationLegend(!showValuationLegend)}
                className="gap-2"
              >
                <span className="size-4 rounded-full border border-current text-center text-[9px] font-black leading-[14px]">{showValuationLegend ? '✓' : ''}</span>
                <span>Detalle cambiario: {showValuationLegend ? 'Visible' : 'Oculto'}</span>
                <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cambiar</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme} className="gap-2">
                {isDark ? <Sun className="size-4 text-amber-500" /> : <Moon className="size-4 text-primary" />}
                <span>{isDark ? 'Tema claro' : 'Tema oscuro'}</span>
                <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cambiar</span>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-500/10 transition-colors">
              <LogOut className="mr-2 size-4 text-rose-500" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="size-5 text-primary" /> Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              Ingresa la nueva contraseña para tu cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nueva Contraseña</Label>
              <Input 
                type="password" 
                placeholder="8 caracteres, mayúscula, número y símbolo" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`rounded-xl ${getPasswordError(newPassword) ? 'border-destructive' : ''}`}
              />
              {getPasswordError(newPassword) && <p className="text-xs text-destructive">{getPasswordError(newPassword)}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)} disabled={isUpdatingPassword}>Cancelar</Button>
            <Button onClick={handleChangePassword} disabled={isUpdatingPassword || !!getPasswordError(newPassword)} className="bg-primary text-primary-foreground">
              {isUpdatingPassword ? 'Guardando...' : 'Guardar Contraseña'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
    </div>
  );
}
