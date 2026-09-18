import {
  createContext,
  useMemo,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  Banknote,
  BarChart3,
  BookOpen,
  Boxes,
  ArrowDownToLine,
  ArrowRightLeft,
  Building2,
  ClipboardCheck,
  ChevronDown,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  ShieldCheck,
  Settings2,
  Sun,
  Tags,
  TrendingDown,
  TrendingUp,
  Wrench,
  Users,
  Warehouse,
  X,
  Landmark,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingCart,
  UserRound,
  FileText,
  FileCog,
  ClipboardList,
  Cloud,
  FolderKanban,
  CalendarDays,
  CircleDollarSign,
  Bell,
  Receipt,
  Repeat2,
  RefreshCw,
  CreditCard,
  Truck,
  Scale,
  Wallet,
  ListChecks,
  MessageCircle,
  Ticket,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCurrency, type CurrencyDisplayMode } from "../contexts/CurrencyContext";
import { useTheme, type ThemeConfig } from "../contexts/ThemeContext";
import { brandingService, type ThemePaletteMode } from "../services/branding.service";
import { type ManagerGroup, type ManagerOperationsModule } from "../services/enterprise-groups.service";
import { safeGetItem, safeSetItem } from "../services/safe-storage";
import { persistThemeMode, readPersistedDarkMode } from "../utils/theme-mode";
import { Button } from "./ui/button";
import { BrandLogo } from "./BrandLogo";
import { cn } from "./ui/utils";
import { notificationsService, subscribeToManagerNotificationEvents } from "../services/notifications.service";
import { playNotificationSound } from "../utils/notificationSound";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrencyDescriptor, getCurrencyMetadata } from "../utils/currency";
import { getReadableForeground } from "../utils/color-contrast";
import { THEME_PRESETS, type ThemePreset } from "../constants/themePresets";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  MANAGER_INVENTORY_VIEWS,
  type ManagerInventoryView,
} from "./manager/manager-inventory.types";
import {
  VISIBLE_MANAGER_SALES_VIEWS,
  type ManagerSalesView,
} from "./manager/manager-sales.types";
import {
  MANAGER_PURCHASES_VIEWS,
  type ManagerPurchasesView,
} from "./manager/manager-purchases.types";
import {
  MANAGER_FINANCE_VIEWS,
  type ManagerFinanceView,
} from "./manager/manager-finance.types";
import {
  MANAGER_ACCOUNTING_VIEWS,
  type ManagerAccountingView,
} from "./manager/manager-accounting.types";
import {
  MANAGER_REPORTS_VIEWS,
  type ManagerReportsView,
} from "./manager/manager-reports.types";
import {
  MANAGER_HR_VIEWS,
  type ManagerHrView,
} from "./manager/manager-hr.types";
import { MANAGER_OPERATION_VIEWS } from "./manager/manager-operations.types";

const MANAGER_INVENTORY_VIEW_ICONS: Record<ManagerInventoryView, LucideIcon> = {
  overview: LayoutDashboard,
  branchInventory: Package,
  corporateInventory: Warehouse,
  products: Package,
  services: Wrench,
  warehouses: Warehouse,
  corporateWarehouses: Warehouse,
  transfers: ArrowRightLeft,
  adjustments: ArrowDownToLine,
  audits: ClipboardCheck,
  losses: TrendingDown,
  movements: History,
  assets: Boxes,
};

const MANAGER_SALES_VIEW_ICONS: Record<ManagerSalesView, LucideIcon> = {
  overview: LayoutDashboard,
  customers: UserRound,
  quotes: FileText,
  orders: ClipboardList,
  invoices: Receipt,
  recurring: Repeat2,
  payments: CreditCard,
  creditnotes: FileText,
  credits: CreditCard,
  deliveries: Truck,
  cash: Landmark,
  'invoice-series': FileCog,
  pricelists: ListChecks,
};

const MANAGER_PURCHASES_VIEW_ICONS: Record<ManagerPurchasesView, LucideIcon> = {
  overview: LayoutDashboard,
  suppliers: Users,
  orders: ClipboardList,
  receipts: Package,
  invoices: Receipt,
  recurring: Repeat2,
  payments: CreditCard,
  credits: CreditCard,
  expenses: Receipt,
  recurringexpenses: Repeat2,
  requests: ClipboardCheck,
  management: FileText,
};

const MANAGER_FINANCE_VIEW_ICONS: Record<ManagerFinanceView, LucideIcon> = {
  overview: LayoutDashboard,
  cash: Landmark,
  receivables: TrendingUp,
  payables: TrendingDown,
  income: TrendingUp,
  expenses: Wallet,
  recurring: Repeat2,
  calendar: CalendarDays,
  analysis: BarChart3,
  balance: Landmark,
  losses: TrendingDown,
};

const MANAGER_ACCOUNTING_VIEW_ICONS: Record<ManagerAccountingView, LucideIcon> = {
  overview: LayoutDashboard,
  chart: BookOpen,
  journal: FileText,
  ledger: BookOpen,
  trialBalance: Scale,
  profitLoss: TrendingDown,
  balanceSheet: BarChart3,
  cashFlow: Wallet,
  exchange: ArrowRightLeft,
  equity: FileText,
  assets: Boxes,
  bankBook: Landmark,
  reconciliation: ClipboardCheck,
  periods: CalendarDays,
  fiscal: FileText,
  invoiceAudit: ClipboardCheck,
  budgets: BarChart3,
  expenseCategories: Tags,
  hrPaymentRequests: ClipboardCheck,
};

const MANAGER_REPORTS_VIEW_ICONS: Record<ManagerReportsView, LucideIcon> = {
  overview: LayoutDashboard,
  sales: ShoppingCart,
  purchases: Truck,
  financial: Wallet,
  inventory: Boxes,
  customers: UserRound,
  providers: Users,
  hr: UserRound,
  subscriptions: CreditCard,
};

const MANAGER_HR_VIEW_ICONS: Record<ManagerHrView, LucideIcon> = {
  overview: LayoutDashboard,
  employees: Users,
  departments: Building2,
  payroll: Wallet,
  commissions: TrendingUp,
  attendance: ClipboardCheck,
  leaves: CalendarDays,
  performance: BarChart3,
  kpi: TrendingUp,
  training: BookOpen,
  benefits: ShieldCheck,
};

const isManagerOperationSection = (section: ManagerSection): section is ManagerOperationsModule =>
  Boolean(MANAGER_OPERATION_VIEWS[section as ManagerOperationsModule]);

export type ManagerSection =
  | "overview"
  | "inventory"
  | "sales"
  | "purchases"
  | "finances"
  | "accounting"
  | "reports"
  | "hr"
  | "activities"
  | "projects"
  | "tickets"
  | "documents"
  | "restaurant"
  | "logistics"
  | "financing"
  | "legal"
  | "novachat"
  | "support"
  | "users"
  | "managers"
  | "settings"
  | "catalog"
  | "consolidated"
  | "transfers";

export const MANAGER_SECTIONS: Array<{
  id: ManagerSection;
  label: string;
  icon: LucideIcon;
  group: string;
}> = [
  { id: "overview", label: "Resumen", icon: LayoutDashboard, group: "General" },
  { id: "sales", label: "Ventas", icon: ShoppingCart, group: "Consolidado" },
  { id: "purchases", label: "Compras", icon: Truck, group: "Consolidado" },
  { id: "inventory", label: "Inventario", icon: Boxes, group: "Consolidado" },
  { id: "finances", label: "Finanzas", icon: Wallet, group: "Consolidado" },
  {
    id: "accounting",
    label: "Contabilidad",
    icon: Landmark,
    group: "Consolidado",
  },
  { id: "reports", label: "Reportes", icon: BarChart3, group: "Consolidado" },
  { id: "hr", label: "Recursos Humanos", icon: Users, group: "Consolidado" },
  { id: "activities", label: "Actividades", icon: Activity, group: "Operaciones" },
  { id: "projects", label: "Proyectos", icon: FolderKanban, group: "Operaciones" },
  { id: "tickets", label: "Tickets", icon: Ticket, group: "Operaciones" },
  { id: "documents", label: "Documentos", icon: Cloud, group: "Operaciones" },
  { id: "restaurant", label: "Restaurante", icon: Utensils, group: "Operaciones" },
  { id: "logistics", label: "Logística", icon: Package, group: "Operaciones" },
  { id: "financing", label: "Financiamiento PYME", icon: Banknote, group: "Operaciones" },
  { id: "legal", label: "Asesoría legal", icon: Scale, group: "Operaciones" },
  { id: "novachat", label: "NovaChat", icon: MessageCircle, group: "Operaciones" },
  { id: "support", label: "Soporte técnico", icon: Wrench, group: "Operaciones" },
  {
    id: "transfers",
    label: "Transferencias",
    icon: ArrowRightLeft,
    group: "Operaciones",
  },
  {
    id: "catalog",
    label: "Catálogo compartido",
    icon: Tags,
    group: "Operaciones",
  },
  { id: "users", label: "Usuarios", icon: Users, group: "Administración" },
  {
    id: "managers",
    label: "Accesos Manager",
    icon: ShieldCheck,
    group: "Administración",
  },
  { id: "settings", label: "Configuración", icon: Settings2, group: "Sistema" },
];

const MANAGER_SIDEBAR_COLLAPSED_KEY = "novahub:manager-sidebar-collapsed";
const ManagerShellNavigationContext = createContext({
  sidebarCollapsed: false,
});
export const useManagerShellNavigation = () =>
  useContext(ManagerShellNavigationContext);
export type ManagerSettingsView = "theme" | "audit";

interface ThemeTransition {
  finished: Promise<void>;
  skipTransition?: () => void;
}

type ThemeTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeTransition;
};

let activeManagerThemeTransition: ThemeTransition | null = null;

type ManagerShellProps = {
  children: ReactNode;
  section: ManagerSection;
  onSectionChange: (section: ManagerSection) => void;
  group?: ManagerGroup;
  branches: Array<{ id: string; name: string; businessUnitId?: string | null }>;
  businessUnits: Array<{ id: string; name: string; isActive?: boolean }>;
  selectedBusinessUnitId: string;
  onBusinessUnitChange: (businessUnitId: string) => void;
  inventoryView: ManagerInventoryView;
  onInventoryViewChange: (view: ManagerInventoryView) => void;
  salesView: ManagerSalesView;
  onSalesViewChange: (view: ManagerSalesView) => void;
  purchasesView: ManagerPurchasesView;
  onPurchasesViewChange: (view: ManagerPurchasesView) => void;
  financeView: ManagerFinanceView;
  onFinanceViewChange: (view: ManagerFinanceView) => void;
  accountingView: ManagerAccountingView;
  onAccountingViewChange: (view: ManagerAccountingView) => void;
  reportView: ManagerReportsView;
  onReportViewChange: (view: ManagerReportsView) => void;
  hrView: ManagerHrView;
  onHrViewChange: (view: ManagerHrView) => void;
  operationViews: Partial<Record<ManagerOperationsModule, string>>;
  onOperationViewChange: (module: ManagerOperationsModule, view: string) => void;
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  reportCurrency: string;
  onReportCurrencyChange: (currency: string) => void;
  allowedSections?: ManagerSection[];
  settingsView?: ManagerSettingsView;
  onSettingsViewChange?: (view: ManagerSettingsView) => void;
  canViewAudit?: boolean;
};

export function ManagerShell({
  children,
  section,
  onSectionChange,
  group,
  branches,
  businessUnits,
  selectedBusinessUnitId,
  onBusinessUnitChange,
  inventoryView,
  onInventoryViewChange,
  salesView,
  onSalesViewChange,
  purchasesView,
  onPurchasesViewChange,
  financeView,
  onFinanceViewChange,
  accountingView,
  onAccountingViewChange,
  reportView,
  onReportViewChange,
  hrView,
  onHrViewChange,
  operationViews,
  onOperationViewChange,
  selectedBranchId,
  onBranchChange,
  onReportCurrencyChange,
  allowedSections,
  settingsView = "theme",
  onSettingsViewChange,
  canViewAudit = true,
}: ManagerShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => safeGetItem(MANAGER_SIDEBAR_COLLAPSED_KEY) === "true",
  );
  const [expandedSection, setExpandedSection] = useState<ManagerSection | null>(
    () => (section === "inventory" || section === "sales" || section === "purchases" || section === "finances" || section === "accounting" || section === "reports" || section === "hr" || isManagerOperationSection(section) ? section : null),
  );
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { currency, displayMode, setDisplayMode, displayModeLabel } = useCurrency();
  const { themeConfig, updateTheme, resetTheme } = useTheme();
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">(
    () => (document.documentElement.classList.contains("dark") || readPersistedDarkMode() ? "dark" : "light"),
  );
  const activePresetName = useMemo(() => {
    const currentPrimary = String(themeConfig.colors.primary || '').toLowerCase();
    return THEME_PRESETS.find((preset) => preset.primary.toLowerCase() === currentPrimary)?.name || null;
  }, [themeConfig.colors.primary]);
  const managerBranding = user?.sessionBranding?.kind === "group" ? user.sessionBranding : undefined;
  const displayGroupName = group?.name || managerBranding?.name || "Grupo empresarial";
  const displayGroupLogo = group?.logo ?? managerBranding?.logo ?? null;
  const visibleSections = allowedSections
    ? MANAGER_SECTIONS.filter((item) => allowedSections.includes(item.id))
    : MANAGER_SECTIONS;
  const scopedBranches = selectedBusinessUnitId
    ? branches.filter(
        (branch) => branch.businessUnitId === selectedBusinessUnitId,
      )
    : branches;
  const managerNotificationsQuery = useQuery({
    queryKey: ["manager-notifications", group?.id, user?.id],
    queryFn: ({ signal }) => notificationsService.getManagerInbox(group!.id, signal),
    enabled: Boolean(group?.id && user?.id),
    // SSE is the primary delivery channel. The visibility recovery below
    // catches up after a browser suspends the tab.
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
  const managerNotifications = managerNotificationsQuery.data || [];
  const unreadManagerNotifications = managerNotifications.filter((notification) => !notification.read);
  const managerNotificationIdsRef = useRef<Set<string> | null>(null);
  const managerNotificationScopeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!group?.id || !user?.id) return undefined;
    const identity = `${group.id}:${user.id}`;
    return subscribeToManagerNotificationEvents(identity, group.id, (event) => {
      if (event.reason !== 'created' && event.reason !== 'updated') return;
      void queryClient.invalidateQueries({
        queryKey: ["manager-notifications", group.id, user.id],
        refetchType: 'active',
      });
      void queryClient.invalidateQueries({
        queryKey: ["manager-hr-module", group.id],
        refetchType: 'active',
      });
      void queryClient.invalidateQueries({
        queryKey: ["manager-finance-module", group.id],
        refetchType: 'active',
      });
      void queryClient.invalidateQueries({
        queryKey: ["manager-accounting-module", group.id],
        refetchType: 'active',
      });
      void queryClient.invalidateQueries({
        queryKey: ["manager-operations", group.id],
        refetchType: 'active',
      });
    });
  }, [group?.id, queryClient, user?.id]);

  useEffect(() => {
    if (!group?.id || !user?.id) return undefined;
    const recoverAfterVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void queryClient.invalidateQueries({
        queryKey: ["manager-notifications", group.id, user.id],
        refetchType: 'active',
      });
      void queryClient.invalidateQueries({
        queryKey: ["manager-hr-module", group.id],
        refetchType: 'active',
      });
      void queryClient.invalidateQueries({
        queryKey: ["manager-finance-module", group.id],
        refetchType: 'active',
      });
      void queryClient.invalidateQueries({
        queryKey: ["manager-accounting-module", group.id],
        refetchType: 'active',
      });
      void queryClient.invalidateQueries({
        queryKey: ["manager-operations", group.id],
        refetchType: 'active',
      });
    };
    document.addEventListener('visibilitychange', recoverAfterVisibility);
    return () => document.removeEventListener('visibilitychange', recoverAfterVisibility);
  }, [group?.id, queryClient, user?.id]);

  const markManagerNotificationRead = async (id: string) => {
    if (!group?.id) return;
    await notificationsService.markManagerAsRead(group.id, id);
    await managerNotificationsQuery.refetch();
  };

  const openManagerNotification = (notification: { id: string; metadata?: unknown }) => {
    void markManagerNotificationRead(notification.id);
    const metadata = notification.metadata && typeof notification.metadata === 'object' && !Array.isArray(notification.metadata)
      ? notification.metadata as { navigation?: { module?: string; subModule?: string; filter?: string } }
      : {};
    if (metadata.navigation?.module !== 'manager') return;
    const filter = String(metadata.navigation.filter || '').toLowerCase();
    const subModule = String(metadata.navigation.subModule || '').toLowerCase();
    if (subModule === 'rh' || subModule === 'rrhh' || subModule === 'recursos-humanos') {
      const view = ['employees', 'departments', 'payroll', 'commissions', 'attendance', 'leaves', 'performance', 'kpi', 'training', 'benefits'].includes(filter)
        ? filter as Parameters<typeof onHrViewChange>[0]
        : 'overview';
      onSectionChange('hr');
      onHrViewChange(view);
      return;
    }
    if (subModule === 'restaurant' || subModule === 'restaurante') {
      const view = ['orders', 'kitchen', 'tables', 'menu', 'reports'].includes(filter) ? filter : 'overview';
      onSectionChange('restaurant');
      onOperationViewChange('restaurant', view);
      return;
    }
    if (subModule === 'finanzas' || subModule === 'finance' || subModule === 'financials') {
      const financeView: ManagerFinanceView = ({
        cash: 'cash', bancos: 'cash', 'caja-bancos': 'cash', 'cuentas-cobrar': 'receivables', receivables: 'receivables',
        'cuentas-pagar': 'payables', payables: 'payables', ingresos: 'income', income: 'income',
        gastos: 'expenses', expenses: 'expenses', recurrentes: 'recurring', 'ingresos-recurrentes': 'recurring',
        'gastos-recurrentes': 'recurring', calendario: 'calendar', analysis: 'analysis', analisis: 'analysis',
        balance: 'balance', 'balance-general': 'balance', perdidas: 'losses', losses: 'losses',
      } as Record<string, ManagerFinanceView>)[filter] || 'overview';
      onSectionChange('finances');
      onFinanceViewChange(financeView);
      return;
    }
    if (subModule === 'contabilidad' || subModule === 'accounting') {
      const accountingView: ManagerAccountingView = ({
        cuentas: 'chart', chart: 'chart', 'plan-cuentas': 'chart', asientos: 'journal', diario: 'journal', journal: 'journal',
        mayor: 'ledger', ledger: 'ledger', 'balance-comprobacion': 'trialBalance', 'estado-resultados': 'profitLoss',
        'balance-general': 'balanceSheet', 'balance-general-contable': 'balanceSheet', 'flujo-efectivo': 'cashFlow',
        'diferencias-cambiarias': 'exchange', exchange: 'exchange', 'cambios-patrimonio': 'equity', equity: 'equity',
        'activos-fijos': 'assets', assets: 'assets', 'libro-bancos': 'bankBook', bancos: 'bankBook',
        conciliacion: 'reconciliation', conciliaciones: 'reconciliation', periodos: 'periods', 'reportes-fiscales': 'fiscal', fiscal: 'fiscal',
        'auditoria-facturas': 'invoiceAudit', 'invoice-audit': 'invoiceAudit', presupuestos: 'budgets', budgets: 'budgets',
        'centros-costos': 'budgets', 'categorias-gastos': 'expenseCategories', 'solicitudes-pago': 'hrPaymentRequests',
      } as Record<string, ManagerAccountingView>)[filter] || 'overview';
      onSectionChange('accounting');
      onAccountingViewChange(accountingView);
      return;
    }
    onSectionChange('inventory');
    onInventoryViewChange(filter === 'transfers' ? 'transfers' : 'adjustments');
  };

  useEffect(() => {
    if (!managerNotificationsQuery.isFetched) return;

    const scope = `${group?.id || ""}:${user?.id || ""}`;
    const currentIds = new Set(managerNotifications.map((notification) => notification.id));

    // The first response only establishes the baseline; the sound is reserved
    // for notifications that arrive after the Manager has opened the panel.
    if (managerNotificationScopeRef.current !== scope) {
      managerNotificationScopeRef.current = scope;
      managerNotificationIdsRef.current = currentIds;
      return;
    }

    const newUnreadNotifications = managerNotifications.filter(
      (notification) => !notification.read && !managerNotificationIdsRef.current?.has(notification.id),
    );
    managerNotificationIdsRef.current = currentIds;
    newUnreadNotifications.forEach((notification) => {
      playNotificationSound();
      toast.info(notification.title || 'Nueva notificación del Manager', {
        description: notification.message || 'Tienes una novedad pendiente de revisar.',
        duration: 6_000,
        position: 'top-right',
        action: { label: 'Abrir', onClick: () => openManagerNotification(notification) },
      });
    });
  }, [group?.id, managerNotificationScopeRef, managerNotifications, managerNotificationsQuery.isFetched, user?.id]);

  const toggleTheme = (event?: MouseEvent<HTMLElement>) => {
    const root = document.documentElement;
    const transitionDocument = document as ThemeTransitionDocument;
    const nextDark = !root.classList.contains("dark");
    const applyTheme = () => {
      root.classList.toggle("dark", nextDark);
      setThemeMode(nextDark ? "dark" : "light");
      persistThemeMode(nextDark);
    };
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!transitionDocument.startViewTransition || reduceMotion) {
      applyTheme();
      return;
    }
    if (activeManagerThemeTransition) {
      const previousTransition = activeManagerThemeTransition;
      activeManagerThemeTransition = null;
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
    root.style.setProperty("--theme-transition-x", `${x}px`);
    root.style.setProperty("--theme-transition-y", `${y}px`);
    root.style.setProperty(
      "--theme-transition-radius",
      `${Math.ceil(radius)}px`,
    );
    root.dataset.themeTransition = "active";
    try {
      const transition = transitionDocument.startViewTransition(applyTheme);
      activeManagerThemeTransition = transition;
      void transition.finished
        .catch(() => undefined)
        .finally(() => {
          if (activeManagerThemeTransition === transition) {
            activeManagerThemeTransition = null;
            delete root.dataset.themeTransition;
          }
        });
    } catch {
      activeManagerThemeTransition = null;
      delete root.dataset.themeTransition;
      applyTheme();
    }
  };

  const updateSection = (next: ManagerSection) => {
    onSectionChange(next);
    setSidebarOpen(false);
  };

  const updateCurrencyDisplay = (mode: CurrencyDisplayMode) => {
    setDisplayMode(mode);
    if (mode !== "DEFAULT" && mode !== "ORIGINAL") onReportCurrencyChange(mode);
  };

  const handleSectionClick = (next: ManagerSection) => {
    if (next === "inventory" || next === "sales" || next === "purchases" || next === "finances" || next === "accounting" || next === "reports" || next === "hr") {
      if (next === "inventory")
        onInventoryViewChange(MANAGER_INVENTORY_VIEWS.find((view) => view.id === "products")?.id || MANAGER_INVENTORY_VIEWS[0].id);
      if (next === "sales") onSalesViewChange(VISIBLE_MANAGER_SALES_VIEWS[0].id);
      if (next === "purchases") onPurchasesViewChange(MANAGER_PURCHASES_VIEWS[0].id);
      if (next === "finances") onFinanceViewChange(MANAGER_FINANCE_VIEWS[0].id);
      if (next === "accounting") onAccountingViewChange(MANAGER_ACCOUNTING_VIEWS[0].id);
      if (next === "reports") onReportViewChange(MANAGER_REPORTS_VIEWS[0].id);
      if (next === "hr") onHrViewChange(MANAGER_HR_VIEWS[0].id);
      if (sidebarCollapsed) {
        if (section !== next) updateSection(next);
        setExpandedSection(next);
        return;
      }
      if (section !== next) updateSection(next);
      setExpandedSection((current) => (current === next ? null : next));
      return;
    }
    if (next === "settings") {
      if (section !== next) updateSection(next);
      setExpandedSection((current) => (current === next ? null : next));
      return;
    }
    if (isManagerOperationSection(next)) {
      onOperationViewChange(next, MANAGER_OPERATION_VIEWS[next][0]?.id || 'overview');
      if (sidebarCollapsed) {
        if (section !== next) updateSection(next);
        setExpandedSection(next);
        return;
      }
      if (section !== next) updateSection(next);
      setExpandedSection((current) => (current === next ? null : next));
      return;
    }
    setExpandedSection(null);
    updateSection(next);
  };

  const saveSharedTheme = async () => {
    if (isSavingTheme) return;
    setIsSavingTheme(true);
    try {
      await brandingService.updateTheme({ paletteMode: themeConfig.paletteMode, colors: themeConfig.colors });
      toast.success("Tema actualizado correctamente");
    } catch (error) {
      console.error("Error guardando el tema del Manager:", error);
      toast.error("No se pudo guardar el tema");
    } finally {
      setIsSavingTheme(false);
    }
  };

  const resetSharedTheme = async () => {
    resetTheme();
    try {
      await brandingService.updateTheme(null);
      toast.info("Tema personal restaurado al predeterminado");
    } catch (error) {
      console.error("Error restaurando el tema del Manager:", error);
      toast.error("No se pudo restaurar el tema");
    }
  };

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      safeSetItem(MANAGER_SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  return (
    <ManagerShellNavigationContext.Provider value={{ sidebarCollapsed }}>
      <div className="manager-shell h-screen overflow-hidden bg-background text-foreground">
        <ManagerSidebar
          collapsed={sidebarCollapsed}
          open={sidebarOpen}
          section={section}
          onSectionClick={handleSectionClick}
          expandedSection={expandedSection}
          onClose={() => setSidebarOpen(false)}
          groupName={displayGroupName}
          groupLogo={displayGroupLogo}
          sections={visibleSections}
          settingsView={settingsView}
          onSettingsViewChange={onSettingsViewChange}
          canViewAudit={canViewAudit}
          inventoryView={inventoryView}
          onInventoryViewChange={onInventoryViewChange}
          salesView={salesView}
          onSalesViewChange={onSalesViewChange}
          purchasesView={purchasesView}
          onPurchasesViewChange={onPurchasesViewChange}
          financeView={financeView}
          onFinanceViewChange={onFinanceViewChange}
          accountingView={accountingView}
          onAccountingViewChange={onAccountingViewChange}
          reportView={reportView}
          onReportViewChange={onReportViewChange}
          hrView={hrView}
          onHrViewChange={onHrViewChange}
          operationViews={operationViews}
          onOperationViewChange={onOperationViewChange}
        />
        <div
          className={cn(
            "flex h-screen min-h-0 min-w-0 flex-col transition-[padding] duration-300",
            sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-[270px]",
          )}
        >
          <header className="shrink-0 border-b border-border/60 bg-card/90 backdrop-blur-xl">
            <div className="flex min-h-16 w-full min-w-0 flex-wrap items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 lg:gap-4 lg:px-6">
                  <Button
                variant="outline"
                size="icon"
                className="size-10 shrink-0 rounded-xl lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menú Manager"
              >
                <Menu className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden shrink-0 text-muted-foreground mr-2 lg:flex"
                onClick={toggleSidebarCollapsed}
                aria-label={
                  sidebarCollapsed
                    ? "Expandir menú Manager"
                    : "Colapsar menú Manager"
                }
                title={
                  sidebarCollapsed
                    ? "Expandir menú Manager"
                    : "Colapsar menú Manager"
                }
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="size-5" />
                ) : (
                  <PanelLeftClose className="size-5" />
                )}
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-black uppercase tracking-tight">
                    {displayGroupName}
                  </p>
                </div>
              </div>
              <div className="order-3 flex w-full min-w-0 flex-col gap-2 sm:order-none sm:w-auto sm:flex-row sm:items-center">
                <select
                  aria-label="Filtrar rubro"
                  value={selectedBusinessUnitId}
                  onChange={(event) => onBusinessUnitChange(event.target.value)}
                  className="h-10 min-w-0 max-w-full rounded-xl border border-border bg-background px-3 text-sm sm:w-48"
                >
                  <option value="">Todos los rubros</option>
                  {businessUnits
                    .filter((unit) => unit.isActive !== false)
                    .map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                </select>
                <select
                  aria-label="Filtrar sucursal"
                  value={selectedBranchId}
                  onChange={(event) => onBranchChange(event.target.value)}
                  disabled={!branches.length}
                  className="h-10 min-w-0 max-w-full rounded-xl border border-border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50 sm:w-52"
                >
                  <option value="">
                    {branches.length ? "Todas las sucursales" : "Sin sucursales disponibles"}
                  </option>
                  {scopedBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className="flex items-center gap-0.5 rounded-xl border border-border bg-background p-0.5" title="Moneda de presentación del Manager">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateCurrencyDisplay(displayMode === "ORIGINAL" ? "NIO" : displayMode === "NIO" ? "USD" : "ORIGINAL")}
                      className="h-8 gap-2 rounded-lg px-2.5 hover:bg-muted"
                      title={`Cambiar moneda de presentación · ${displayModeLabel}`}
                    >
                      {displayMode === "ORIGINAL" ? <FileText className="size-4 text-primary" /> : displayMode === "USD" ? <CircleDollarSign className="size-4 text-emerald-500" /> : <Wallet className="size-4 text-orange-500" />}
                      <span className="text-xs font-bold">{displayMode === "ORIGINAL" ? "ORIGINAL" : displayMode === "DEFAULT" ? currency : getCurrencyMetadata(displayMode).code}</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Cambiar moneda de presentación" title="Cambiar moneda de presentación">
                          <ChevronDown className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64 rounded-xl border-border/60 p-2">
                        <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Moneda de presentación</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => updateCurrencyDisplay("ORIGINAL")} className="gap-2 rounded-lg p-2.5 text-xs font-bold">
                          <FileText className="size-4 text-primary" />
                          <span className="flex-1">Original · sin equivalente</span>
                          {displayMode === "ORIGINAL" && <span className="text-primary">Activo</span>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateCurrencyDisplay("NIO")} className="gap-2 rounded-lg p-2.5 text-xs font-bold">
                          <Wallet className="size-4 text-orange-500" />
                          <span className="flex-1">{formatCurrencyDescriptor("NIO")}</span>
                          {(displayMode === "NIO" || (displayMode === "DEFAULT" && currency === "NIO")) && <span className="text-primary">Activo</span>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateCurrencyDisplay("USD")} className="gap-2 rounded-lg p-2.5 text-xs font-bold">
                          <CircleDollarSign className="size-4 text-emerald-500" />
                          <span className="flex-1">{formatCurrencyDescriptor("USD")}</span>
                          {(displayMode === "USD" || (displayMode === "DEFAULT" && currency === "USD")) && <span className="text-primary">Activo</span>}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative size-10 rounded-xl"
                      aria-label="Notificaciones del Manager"
                      title="Notificaciones del Manager"
                    >
                      <Bell className="size-5" />
                      {unreadManagerNotifications.length > 0 && (
                        <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white ring-2 ring-background">
                          {unreadManagerNotifications.length > 9 ? '9+' : unreadManagerNotifications.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1rem)] rounded-xl p-2">
                    <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Notificaciones del Manager
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="max-h-80 overflow-y-auto">
                      {managerNotifications.length === 0 ? (
                        <p className="px-3 py-6 text-center text-xs text-muted-foreground">No hay notificaciones nuevas.</p>
                      ) : managerNotifications.slice(0, 8).map((notification) => (
                        <DropdownMenuItem
                          key={notification.id}
                          className="items-start gap-2 rounded-lg p-3"
                          onClick={() => openManagerNotification(notification)}
                        >
                          <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${notification.read ? 'bg-muted text-muted-foreground' : 'bg-amber-100 text-amber-700'}`}>
                            <Bell className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold">{notification.title}</span>
                            <span className="mt-0.5 block line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{notification.message}</span>
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-xl"
                  onClick={toggleTheme}
                  aria-label={
                    themeMode === "dark"
                      ? "Activar modo claro"
                      : "Activar modo oscuro"
                  }
                  title={themeMode === "dark" ? "Modo claro" : "Modo oscuro"}
                >
                  {themeMode === "dark" ? (
                    <Sun className="size-5" />
                  ) : (
                    <Moon className="size-5" />
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="ml-1 h-10 gap-2 rounded-xl border-l border-border/60 pl-3 pr-1 hover:bg-muted/60 focus-visible:ring-1"
                      aria-label="Menú de usuario Manager"
                    >
                      <div className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">
                        {String(user?.name || "M")
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="hidden min-w-0 flex-col items-start text-left leading-tight xl:flex">
                        <span className="max-w-32 truncate text-xs font-black">
                          {user?.name || "Manager"}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-primary">
                          Manager global
                        </span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-64 max-w-[calc(100vw-1rem)] rounded-xl"
                  >
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium">
                          {user?.name || "Manager"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user?.email || "Acceso Manager"}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={logout}
                      className="text-red-600 transition-colors focus:bg-red-500/10 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                    >
                      <LogOut className="mr-2 size-4 text-rose-500" />
                      <span>Cerrar sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>
          <main
            className={cn(
              "min-h-0 flex-1 overflow-x-hidden overflow-y-auto mx-auto w-full max-w-[1700px] min-w-0",
              section === "inventory" || section === "sales" || section === "purchases" || section === "finances" || section === "accounting"
                ? "p-0"
                : "p-4 sm:p-5 lg:p-7",
            )}
          >
            {section === "settings" && settingsView === "theme" ? (
              <ManagerThemeSettings
                themeConfig={themeConfig}
                themeMode={themeMode}
                activePresetName={activePresetName}
                onPresetChange={(preset) => {
                  updateTheme({
                    primary: preset.primary,
                    primaryForeground: getReadableForeground(preset.primary),
                    accent: preset.accent,
                    accentForeground: getReadableForeground(preset.accent),
                    sidebar: preset.sidebar,
                    sidebarForeground: getReadableForeground(preset.sidebar),
                    sidebarPrimary: preset.primary,
                    sidebarAccent: preset.accent,
                  }, themeConfig.paletteMode);
                }}
                onPaletteModeChange={(mode) => updateTheme({}, mode)}
                onToggleTheme={toggleTheme}
                onSaveTheme={saveSharedTheme}
                isSavingTheme={isSavingTheme}
                onResetTheme={resetSharedTheme}
              />
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </ManagerShellNavigationContext.Provider>
  );
}

function ManagerSidebar({
  collapsed,
  open,
  section,
  onSectionClick,
  expandedSection,
  onClose,
  groupName,
  groupLogo,
  sections = MANAGER_SECTIONS,
  settingsView = "theme",
  onSettingsViewChange,
  canViewAudit = true,
  inventoryView,
  onInventoryViewChange,
  salesView,
  onSalesViewChange,
  purchasesView,
  onPurchasesViewChange,
  financeView,
  onFinanceViewChange,
  accountingView,
  onAccountingViewChange,
  reportView,
  onReportViewChange,
  hrView,
  onHrViewChange,
  operationViews,
  onOperationViewChange,
}: {
  collapsed: boolean;
  open: boolean;
  section: ManagerSection;
  onSectionClick: (section: ManagerSection) => void;
  expandedSection: ManagerSection | null;
  onClose: () => void;
  groupName?: string;
  groupLogo?: string | null;
  sections?: typeof MANAGER_SECTIONS;
  settingsView?: ManagerSettingsView;
  onSettingsViewChange?: (view: ManagerSettingsView) => void;
  canViewAudit?: boolean;
  inventoryView: ManagerInventoryView;
  onInventoryViewChange: (view: ManagerInventoryView) => void;
  salesView: ManagerSalesView;
  onSalesViewChange: (view: ManagerSalesView) => void;
  purchasesView: ManagerPurchasesView;
  onPurchasesViewChange: (view: ManagerPurchasesView) => void;
  financeView: ManagerFinanceView;
  onFinanceViewChange: (view: ManagerFinanceView) => void;
  accountingView: ManagerAccountingView;
  onAccountingViewChange: (view: ManagerAccountingView) => void;
  reportView: ManagerReportsView;
  onReportViewChange: (view: ManagerReportsView) => void;
  hrView: ManagerHrView;
  onHrViewChange: (view: ManagerHrView) => void;
  operationViews: Partial<Record<ManagerOperationsModule, string>>;
  onOperationViewChange: (module: ManagerOperationsModule, view: string) => void;
}) {
  const { user } = useAuth();
  const groups = [...new Set(sections.map((item) => item.group))];
  const [isDesktopViewport, setIsDesktopViewport] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 1024,
  );

  useEffect(() => {
    const handleViewportChange = () => setIsDesktopViewport(window.innerWidth >= 1024);
    handleViewportChange();
    window.addEventListener("resize", handleViewportChange);
    return () => window.removeEventListener("resize", handleViewportChange);
  }, []);

  const sidebarCollapsed = Boolean(collapsed && isDesktopViewport);
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden",
          open ? "block" : "hidden",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-dvh max-h-[100dvh] w-[270px] overflow-hidden overscroll-none border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          sidebarCollapsed ? "lg:w-[72px]" : "lg:w-[270px]",
        )}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div
            className={cn(
              "flex h-16 shrink-0 items-center overflow-visible border-b border-sidebar-border px-3",
              sidebarCollapsed ? "justify-center" : "justify-between",
            )}
          >
            {sidebarCollapsed ? (
              <div
                className="flex items-center justify-center"
                title={groupName || "Grupo empresarial"}
                aria-label={groupName || "Grupo empresarial"}
              >
                <BrandLogo
                  src={groupLogo}
                  alt={`Logo de ${groupName || "grupo empresarial"}`}
                  kind={groupLogo ? "group" : "platform"}
                  className="size-9 rounded-xl bg-sidebar-accent text-sidebar-accent-foreground ring-0"
                  imageClassName="rounded-xl"
                />
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-3">
                <BrandLogo
                  src={groupLogo}
                  alt={`Logo de ${groupName || "grupo empresarial"}`}
                  kind={groupLogo ? "group" : "platform"}
                  className="size-10 rounded-xl bg-sidebar-accent text-sidebar-accent-foreground ring-0"
                  imageClassName="rounded-xl"
                />
                <div className="flex min-w-0 flex-col items-start overflow-hidden leading-none">
                  <span className="max-w-[150px] truncate text-sm font-black tracking-tight text-sidebar-foreground">
                    {groupName || "Grupo empresarial"}
                  </span>
                  <span className="mt-1 max-w-[150px] truncate text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
                    Panel de Control
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-sidebar-foreground hover:bg-primary/10 hover:text-primary lg:hidden"
                onClick={onClose}
                aria-label="Cerrar menú Manager"
              >
                <X className="size-5" />
              </Button>
            </div>
          </div>
          <TooltipProvider delayDuration={100}>
            <nav data-sidebar-navigation className="no-scrollbar min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {groups.map((group) => (
                <div key={group} className="mb-3">
                  {!sidebarCollapsed && (
                    <div className="flex px-3 pb-1 pt-4">
                      <span className="w-full border-b border-sidebar-border/50 pb-1 text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/60">
                        {group}
                      </span>
                    </div>
                  )}
                  {sidebarCollapsed && <div className="pt-3" />}
                  <div className="space-y-0.5">
                    {sections
                      .filter((item) => item.group === group)
                      .map((item) => {
                        const Icon = item.icon;
                        const active = section === item.id;
                        const hasSubmenu =
                          item.id === "inventory" || item.id === "sales" || item.id === "purchases" || item.id === "finances" || item.id === "accounting" || item.id === "reports" || item.id === "hr" || isManagerOperationSection(item.id) || item.id === "settings";
                        const isExpanded = expandedSection === item.id;
                        const button = (
                          <button
                            type="button"
                            onClick={() => onSectionClick(item.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-150",
                              active
                                ? "hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                              sidebarCollapsed && "justify-center",
                              active
                                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-semibold"
                                : "text-sidebar-foreground/70",
                            )}
                            aria-current={active ? "page" : undefined}
                            aria-label={sidebarCollapsed ? item.label : undefined}
                          >
                            <Icon className="size-5 shrink-0" />
                            {!sidebarCollapsed && (
                              <>
                                <span className="flex-1 truncate text-left">
                                  {item.label}
                                </span>
                                {hasSubmenu && (
                                  <ChevronDown
                                    className={cn(
                                      "size-4 shrink-0 opacity-50 transition-transform",
                                      isExpanded && "rotate-180",
                                    )}
                                  />
                                )}
                              </>
                            )}
                          </button>
                        );
                        const submenu = active &&
                          hasSubmenu &&
                          isExpanded &&
                          !sidebarCollapsed && (
                            <div className="ml-5 mt-0.5 max-h-[52vh] space-y-0.5 overflow-y-auto py-1 pl-3">
                              {item.id === "settings" ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onSettingsViewChange?.("theme")}
                                    aria-current={settingsView === "theme" ? "page" : undefined}
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150",
                                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                                      settingsView === "theme"
                                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    )}
                                  >
                                    <Tags className="size-4 shrink-0" />
                                    <span className="flex-1 truncate text-left">Temas</span>
                                  </button>
                                  {canViewAudit && (
                                    <button
                                      type="button"
                                      onClick={() => onSettingsViewChange?.("audit")}
                                      aria-current={settingsView === "audit" ? "page" : undefined}
                                      className={cn(
                                        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                                        settingsView === "audit"
                                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                      )}
                                    >
                                      <History className="size-4 shrink-0" />
                                      <span className="flex-1 truncate text-left">Logs y auditoría</span>
                                    </button>
                                  )}
                                </>
                              ) : (isManagerOperationSection(item.id)
                                ? MANAGER_OPERATION_VIEWS[item.id]
                                : item.id === "inventory"
                                ? MANAGER_INVENTORY_VIEWS
                                : item.id === "sales"
                                  ? VISIBLE_MANAGER_SALES_VIEWS
                                  : item.id === "purchases"
                                    ? MANAGER_PURCHASES_VIEWS
                                    : item.id === "finances"
                                      ? MANAGER_FINANCE_VIEWS
                                      : item.id === "accounting"
                                        ? MANAGER_ACCOUNTING_VIEWS
                                        : item.id === "reports"
                                          ? MANAGER_REPORTS_VIEWS
                                          : MANAGER_HR_VIEWS
                              ).map((view) => {
                                const isOperation = isManagerOperationSection(item.id);
                                const isInventory = item.id === "inventory";
                                const isSales = item.id === "sales";
                                const isPurchases = item.id === "purchases";
                                const isFinances = item.id === "finances";
                                const isAccounting = item.id === "accounting";
                                const isReports = item.id === "reports";
                                const SubIcon = (isOperation
                                  ? (view as { icon?: LucideIcon }).icon
                                  : isInventory
                                    ? MANAGER_INVENTORY_VIEW_ICONS[view.id as ManagerInventoryView]
                                  : isSales
                                    ? MANAGER_SALES_VIEW_ICONS[view.id as ManagerSalesView]
                                    : isPurchases
                                      ? MANAGER_PURCHASES_VIEW_ICONS[view.id as ManagerPurchasesView]
                                      : isFinances
                                        ? MANAGER_FINANCE_VIEW_ICONS[view.id as ManagerFinanceView]
                                        : isAccounting
                                          ? MANAGER_ACCOUNTING_VIEW_ICONS[view.id as ManagerAccountingView]
                                  : isReports
                                            ? MANAGER_REPORTS_VIEW_ICONS[view.id as ManagerReportsView]
                                            : MANAGER_HR_VIEW_ICONS[view.id as ManagerHrView]) || FileText;
                                const subActive = isOperation
                                  ? (operationViews[item.id] || 'overview') === view.id
                                  : isInventory
                                    ? inventoryView === view.id
                                  : isSales
                                    ? salesView === view.id
                                    : isPurchases
                                      ? purchasesView === view.id
                                      : isFinances
                                        ? financeView === view.id
                                        : isAccounting
                                          ? accountingView === view.id
                                          : isReports
                                            ? reportView === view.id
                                            : hrView === view.id;
                                const selectView = () => {
                                  if (isOperation) onOperationViewChange(item.id, view.id);
                                  else if (isInventory) onInventoryViewChange(view.id as ManagerInventoryView);
                                  else if (isSales) onSalesViewChange(view.id as ManagerSalesView);
                                  else if (isPurchases) onPurchasesViewChange(view.id as ManagerPurchasesView);
                                  else if (isFinances) onFinanceViewChange(view.id as ManagerFinanceView);
                                  else if (isAccounting) onAccountingViewChange(view.id as ManagerAccountingView);
                                  else if (isReports) onReportViewChange(view.id as ManagerReportsView);
                                  else onHrViewChange(view.id as ManagerHrView);
                                };
                                return (
                                  <button
                                    key={view.id}
                                    type="button"
                                    onClick={selectView}
                                    aria-current={
                                      subActive ? "page" : undefined
                                    }
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150",
                                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                                      subActive
                                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    )}
                                  >
                                    <SubIcon className="size-4 shrink-0" />
                                    <span className="flex-1 truncate text-left">
                                      {view.label}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        return (
                          <div key={item.id}>
                            {sidebarCollapsed ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {button}
                                </TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  sideOffset={10}
                                  className="border-sidebar-border bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground shadow-lg"
                                >
                                  {item.label}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              button
                            )}
                            {submenu}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </nav>
          </TooltipProvider>
          <div className="shrink-0 border-t border-sidebar-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border border-sidebar-border/50 bg-sidebar-accent text-sidebar-accent-foreground",
                sidebarCollapsed ? "justify-center p-1.5" : "px-3 py-3",
              )}
              title={
                sidebarCollapsed
                  ? `${user?.name || "Manager"} · Acceso Manager`
                  : undefined
              }
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-sm">
                {String(user?.name || "M")
                  .charAt(0)
                  .toUpperCase()}
              </div>
              {!collapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
                    {user?.name || "Manager"}
                  </p>
                  <p className="truncate text-[11px] capitalize text-sidebar-accent-foreground">
                    Acceso Manager
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function ManagerThemeSettings({
  themeConfig,
  themeMode,
  activePresetName,
  onPresetChange,
  onPaletteModeChange,
  onToggleTheme,
  onSaveTheme,
  isSavingTheme,
  onResetTheme,
}: {
  themeConfig: ThemeConfig;
  themeMode: "light" | "dark";
  activePresetName: string | null;
  onPresetChange: (preset: ThemePreset) => void;
  onPaletteModeChange: (mode: ThemePaletteMode) => void;
  onToggleTheme: (event?: MouseEvent<HTMLElement>) => void;
  onSaveTheme: () => void;
  isSavingTheme: boolean;
  onResetTheme: () => void;
}) {
  const isComplete = themeConfig.paletteMode === "complete";
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Panel de Control</p>
        <h2 className="truncate text-3xl font-black uppercase italic leading-none tracking-tighter sm:text-4xl">Configuración</h2>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tight">Modo de color</h3>
                <p className="mt-1 text-sm text-muted-foreground">Cambia entre claro y oscuro con la misma transición de las sucursales.</p>
              </div>
              <Button type="button" variant="outline" className="w-full shrink-0 rounded-xl sm:w-auto" onClick={onToggleTheme}>
                {themeMode === "dark" ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
                {themeMode === "dark" ? "Usar modo claro" : "Usar modo oscuro"}
              </Button>
            </div>
          </section>
          <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
            <div>
              <h3 className="text-lg font-black uppercase italic tracking-tight">Paletas de color</h3>
              <p className="mt-1 text-sm text-muted-foreground">Las mismas paletas y modos de aplicación disponibles en la configuración de sucursal.</p>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {THEME_PRESETS.map((preset) => (
                <button key={preset.name} type="button" onClick={() => onPresetChange(preset)} aria-pressed={activePresetName === preset.name}
                  className={cn("flex min-w-0 items-center gap-3 rounded-2xl border p-4 text-left transition-colors", activePresetName === preset.name ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/50")}>
                  <span className="size-10 shrink-0 rounded-xl shadow-inner" style={{ background: preset.primary }} />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-black">{preset.name}</span><span className="mt-1 block text-xs text-muted-foreground">{preset.description}</span></span>
                  {activePresetName === preset.name && <span className="shrink-0 text-sm font-black text-primary">✓</span>}
                </button>
              ))}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Modo de aplicación de la paleta">
              <button type="button" role="radio" aria-checked={!isComplete} onClick={() => onPaletteModeChange("details")}
                className={cn("rounded-xl border p-3 text-left transition-colors", !isComplete ? "border-primary bg-background shadow-sm" : "border-border/60 hover:border-primary/40")}>
                <span className="text-sm font-bold">{!isComplete ? "✓ " : ""}Modo detalles</span>
                <span className="mt-1 block text-xs text-muted-foreground">Cambia los elementos internos; el sidebar se mantiene neutral según el modo.</span>
              </button>
              <button type="button" role="radio" aria-checked={isComplete} onClick={() => onPaletteModeChange("complete")}
                className={cn("rounded-xl border p-3 text-left transition-colors", isComplete ? "border-primary bg-background shadow-sm" : "border-border/60 hover:border-primary/40")}>
                <span className="text-sm font-bold">{isComplete ? "✓ " : ""}Modo completo</span>
                <span className="mt-1 block text-xs text-muted-foreground">Aplica también la tonalidad de la paleta al sidebar.</span>
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" className="rounded-xl" onClick={onSaveTheme} disabled={isSavingTheme}>
                {isSavingTheme ? <RefreshCw className="mr-2 size-4 animate-spin" /> : null}
                {isSavingTheme ? "Guardando…" : "Guardar tema"}
              </Button>
              <Button type="button" variant="outline" className="rounded-xl" onClick={onResetTheme}>Restaurar predeterminado</Button>
            </div>
          </section>
        </div>
        <aside className="h-fit rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Settings2 className="size-5" /></div>
          <h3 className="mt-4 text-lg font-black uppercase italic tracking-tight">Alcance de esta configuración</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Manager y sucursales comparten la preferencia visual de este usuario. El modo detalles conserva el sidebar neutro en claro y oscuro.</p>
          <div className="mt-5 rounded-2xl border border-border/60 bg-background/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado actual</p>
            <p className="mt-2 text-sm font-bold">{themeMode === "dark" ? "Modo oscuro" : "Modo claro"} · {isComplete ? "Modo completo" : "Modo detalles"}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
