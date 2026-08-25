import {
  createContext,
  useContext,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
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
  CalendarDays,
  CircleDollarSign,
  Receipt,
  Repeat2,
  CreditCard,
  Truck,
  Scale,
  Wallet,
  ListChecks,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { type ManagerGroup } from "../services/enterprise-groups.service";
import { safeGetItem, safeSetItem } from "../services/safe-storage";
import { persistThemeMode, readPersistedDarkMode } from "../utils/theme-mode";
import { Button } from "./ui/button";
import { BrandLogo } from "./BrandLogo";
import { cn } from "./ui/utils";
import { formatCurrencyDescriptor, getCurrencyMetadata } from "../utils/currency";
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
  MANAGER_SALES_VIEWS,
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
  supplierprices: Tags,
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
  subscriptions: Layers,
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

export type ManagerSection =
  | "overview"
  | "inventory"
  | "sales"
  | "purchases"
  | "finances"
  | "accounting"
  | "reports"
  | "hr"
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

type ManagerThemeState = {
  mode: "light" | "dark";
  preset: keyof typeof MANAGER_THEME_PRESETS;
};

const MANAGER_THEME_KEY = "novahub:manager-theme";
const MANAGER_SIDEBAR_COLLAPSED_KEY = "novahub:manager-sidebar-collapsed";
const ManagerShellNavigationContext = createContext({
  sidebarCollapsed: false,
});
export const useManagerShellNavigation = () =>
  useContext(ManagerShellNavigationContext);
const MANAGER_THEME_VARIABLES = [
  "--primary",
  "--accent",
  "--sidebar",
  "--sidebar-primary",
  "--sidebar-accent",
];
const MANAGER_THEME_PRESETS = {
  emerald: {
    label: "Esmeralda",
    primary: "oklch(0.65 0.2 155)",
    sidebar: "oklch(0.16 0.01 155)",
    accent: "oklch(0.22 0.02 155)",
  },
  indigo: {
    label: "Índigo",
    primary: "oklch(0.62 0.2 270)",
    sidebar: "oklch(0.15 0.02 270)",
    accent: "oklch(0.23 0.04 270)",
  },
  amber: {
    label: "Ámbar",
    primary: "oklch(0.72 0.17 80)",
    sidebar: "oklch(0.17 0.025 80)",
    accent: "oklch(0.24 0.04 80)",
  },
  rose: {
    label: "Rosa",
    primary: "oklch(0.64 0.2 20)",
    sidebar: "oklch(0.16 0.02 20)",
    accent: "oklch(0.23 0.04 20)",
  },
} as const;

interface ThemeTransition {
  finished: Promise<void>;
  skipTransition?: () => void;
}

type ThemeTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeTransition;
};

let activeManagerThemeTransition: ThemeTransition | null = null;
let managerThemeChangeVersion = 0;

function readManagerTheme(): ManagerThemeState {
  try {
    const saved = JSON.parse(
      safeGetItem(MANAGER_THEME_KEY) || "null",
    ) as Partial<ManagerThemeState> | null;
    const preset =
      saved?.preset && saved.preset in MANAGER_THEME_PRESETS
        ? saved.preset
        : "emerald";
    const globalMode = safeGetItem("erp-theme-mode");
    const mode = globalMode === "light" || globalMode === "dark"
      ? globalMode
      : saved?.mode === "light" || saved?.mode === "dark"
        ? saved.mode
        : readPersistedDarkMode() ? "dark" : "light";
    return {
      mode,
      preset: preset as ManagerThemeState["preset"],
    };
  } catch {
    return { mode: readPersistedDarkMode() ? "dark" : "light", preset: "emerald" };
  }
}

function applyManagerTheme(theme: ManagerThemeState) {
  const root = document.documentElement;
  const preset = MANAGER_THEME_PRESETS[theme.preset];
  root.classList.toggle("dark", theme.mode === "dark");
  root.style.setProperty("--primary", preset.primary);
  root.style.setProperty("--sidebar-primary", preset.primary);
  root.style.setProperty("--accent", preset.accent);
  root.style.setProperty("--sidebar", preset.sidebar);
  root.style.setProperty("--sidebar-accent", preset.accent);
}

function useManagerTheme() {
  const [theme, setTheme] = useState<ManagerThemeState>(readManagerTheme);

  useEffect(() => {
    const root = document.documentElement;
    const previousVariables = Object.fromEntries(
      MANAGER_THEME_VARIABLES.map((name) => [
        name,
        root.style.getPropertyValue(name),
      ]),
    );
    applyManagerTheme(theme);
    return () => {
      root.classList.toggle("dark", readPersistedDarkMode());
      MANAGER_THEME_VARIABLES.forEach((name) => {
        const value = previousVariables[name];
        if (value) root.style.setProperty(name, value);
        else root.style.removeProperty(name);
      });
    };
  }, []);

  useEffect(() => {
    applyManagerTheme(theme);
    safeSetItem(MANAGER_THEME_KEY, JSON.stringify(theme));
    persistThemeMode(theme.mode === "dark");
  }, [theme]);

  return { theme, setTheme };
}

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
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  reportCurrency: string;
  onReportCurrencyChange: (currency: string) => void;
  allowedSections?: ManagerSection[];
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
  selectedBranchId,
  onBranchChange,
  reportCurrency,
  onReportCurrencyChange,
  allowedSections,
}: ManagerShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => safeGetItem(MANAGER_SIDEBAR_COLLAPSED_KEY) === "true",
  );
  const [expandedSection, setExpandedSection] = useState<ManagerSection | null>(
    () => (section === "inventory" || section === "sales" || section === "purchases" || section === "finances" || section === "accounting" || section === "reports" || section === "hr" ? section : null),
  );
  const { user, logout } = useAuth();
  const { theme, setTheme } = useManagerTheme();
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

  useEffect(() => {
    if (section !== "inventory" && section !== "sales" && section !== "purchases" && section !== "finances" && section !== "accounting" && section !== "reports" && section !== "hr")
      setExpandedSection(null);
  }, [section]);

  const toggleTheme = (event?: MouseEvent<HTMLElement>) => {
    const root = document.documentElement;
    const transitionDocument = document as ThemeTransitionDocument;
    const nextDark = !root.classList.contains("dark");
    const requestVersion = ++managerThemeChangeVersion;
    const applyTheme = () => {
      if (requestVersion !== managerThemeChangeVersion) return;
      root.classList.toggle("dark", nextDark);
      flushSync(() =>
        setTheme((current) => ({
          ...current,
          mode: nextDark ? "dark" : "light",
        })),
      );
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

  const handleSectionClick = (next: ManagerSection) => {
    if (next === "inventory" || next === "sales" || next === "purchases" || next === "finances" || next === "accounting" || next === "reports" || next === "hr") {
      if (next === "inventory")
        onInventoryViewChange(MANAGER_INVENTORY_VIEWS.find((view) => view.id === "products")?.id || MANAGER_INVENTORY_VIEWS[0].id);
      if (next === "sales") onSalesViewChange(MANAGER_SALES_VIEWS[0].id);
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
    setExpandedSection(null);
    updateSection(next);
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
                  <option value="" disabled={section === "inventory"}>
                    {section === "inventory"
                      ? "Seleccionar rubro"
                      : "Todos los rubros"}
                  </option>
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
                  className="h-10 min-w-0 max-w-full rounded-xl border border-border bg-background px-3 text-sm sm:w-52"
                >
                  <option value="">Todas las sucursales</option>
                  {scopedBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {(section === "sales" || section === "purchases") && (
                  <div className="hidden items-center gap-0.5 rounded-xl border border-border bg-background p-0.5 md:flex" title="Moneda de referencia de ventas">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReportCurrencyChange(reportCurrency === "USD" ? "NIO" : "USD")}
                      className="h-8 gap-2 rounded-lg px-2.5 hover:bg-muted"
                      title={`Cambiar moneda de referencia · ${formatCurrencyDescriptor(reportCurrency)}`}
                    >
                      {reportCurrency === "USD" ? <CircleDollarSign className="size-4 text-emerald-500" /> : <Wallet className="size-4 text-orange-500" />}
                      <span className="text-xs font-bold">{getCurrencyMetadata(reportCurrency).code}</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-muted" aria-label="Cambiar moneda de referencia" title="Cambiar moneda de referencia">
                          <ChevronDown className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64 rounded-xl border-border/60 p-2">
                        <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Moneda de referencia</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onReportCurrencyChange("NIO")} className="gap-2 rounded-lg p-2.5 text-xs font-bold">
                          <Wallet className="size-4 text-orange-500" />
                          <span className="flex-1">{formatCurrencyDescriptor("NIO")}</span>
                          {reportCurrency === "NIO" && <span className="text-primary">Activo</span>}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onReportCurrencyChange("USD")} className="gap-2 rounded-lg p-2.5 text-xs font-bold">
                          <CircleDollarSign className="size-4 text-emerald-500" />
                          <span className="flex-1">{formatCurrencyDescriptor("USD")}</span>
                          {reportCurrency === "USD" && <span className="text-primary">Activo</span>}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-10 rounded-xl"
                  onClick={toggleTheme}
                  aria-label={
                    theme.mode === "dark"
                      ? "Activar modo claro"
                      : "Activar modo oscuro"
                  }
                  title={theme.mode === "dark" ? "Modo claro" : "Modo oscuro"}
                >
                  {theme.mode === "dark" ? (
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
            {section === "settings" ? (
              <ManagerThemeSettings
                theme={theme}
                onPresetChange={(preset) =>
                  setTheme((current) => ({ ...current, preset }))
                }
                onToggleTheme={toggleTheme}
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
}) {
  const { user } = useAuth();
  const groups = [...new Set(sections.map((item) => item.group))];
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
          "fixed left-0 top-0 z-50 h-screen w-[270px] border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          collapsed ? "lg:w-[72px]" : "lg:w-[270px]",
        )}
      >
        <div className="flex h-full flex-col">
          <div
            className={cn(
              "flex h-16 shrink-0 items-center overflow-visible border-b border-sidebar-border px-3",
              collapsed ? "justify-center" : "justify-between",
            )}
          >
            {collapsed ? (
              <div
                className="flex items-center justify-center"
                title={groupName || "Grupo empresarial"}
                aria-label={groupName || "Grupo empresarial"}
              >
                <BrandLogo
                  src={groupLogo}
                  alt={`Logo de ${groupName || "grupo empresarial"}`}
                  kind={groupLogo ? "group" : "platform"}
                  className="size-9 rounded-xl bg-sidebar-accent text-sidebar-foreground ring-0"
                  imageClassName="rounded-xl"
                />
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-3">
                <BrandLogo
                  src={groupLogo}
                  alt={`Logo de ${groupName || "grupo empresarial"}`}
                  kind={groupLogo ? "group" : "platform"}
                  className="size-10 rounded-xl bg-sidebar-accent text-sidebar-foreground ring-0"
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
                className="size-9 text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
                onClick={onClose}
                aria-label="Cerrar menú Manager"
              >
                <X className="size-5" />
              </Button>
            </div>
          </div>
          <TooltipProvider delayDuration={100}>
            <nav className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {groups.map((group) => (
                <div key={group} className="mb-3">
                  {!collapsed && (
                    <div className="flex px-3 pb-1 pt-4">
                      <span className="w-full border-b border-sidebar-border/50 pb-1 text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/60">
                        {group}
                      </span>
                    </div>
                  )}
                  {collapsed && <div className="pt-3" />}
                  <div className="space-y-0.5">
                    {sections
                      .filter((item) => item.group === group)
                      .map((item) => {
                        const Icon = item.icon;
                        const active = section === item.id;
                        const hasSubmenu =
                          item.id === "inventory" || item.id === "sales" || item.id === "purchases" || item.id === "finances" || item.id === "accounting" || item.id === "reports" || item.id === "hr";
                        const isExpanded = expandedSection === item.id;
                        const button = (
                          <button
                            type="button"
                            onClick={() => onSectionClick(item.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-all duration-150",
                              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                              collapsed && "justify-center",
                              active
                                ? "bg-sidebar-accent/80 text-sidebar-foreground shadow-sm font-semibold"
                                : "text-sidebar-foreground/70",
                            )}
                            aria-current={active ? "page" : undefined}
                            aria-label={collapsed ? item.label : undefined}
                          >
                            <Icon className="size-5 shrink-0" />
                            {!collapsed && (
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
                          !collapsed && (
                            <div className="ml-5 mt-0.5 max-h-[52vh] space-y-0.5 overflow-y-auto py-1 pl-3">
                              {(item.id === "inventory"
                                ? MANAGER_INVENTORY_VIEWS
                                : item.id === "sales"
                                  ? MANAGER_SALES_VIEWS
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
                                const isInventory = item.id === "inventory";
                                const isSales = item.id === "sales";
                                const isPurchases = item.id === "purchases";
                                const isFinances = item.id === "finances";
                                const isAccounting = item.id === "accounting";
                                const isReports = item.id === "reports";
                                const SubIcon = (isInventory
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
                                const subActive = isInventory
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
                                  if (isInventory) onInventoryViewChange(view.id as ManagerInventoryView);
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
                                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                                      subActive
                                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                                        : "text-sidebar-foreground/55",
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
                            {collapsed ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {button}
                                </TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  sideOffset={10}
                                  className="border-sidebar-border bg-sidebar-accent text-xs font-bold text-sidebar-foreground shadow-lg"
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
          <div className="shrink-0 border-t border-sidebar-border p-3">
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border border-sidebar-border/50 bg-sidebar-accent",
                collapsed ? "justify-center p-1.5" : "px-3 py-3",
              )}
              title={
                collapsed
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
                  <p className="truncate text-sm font-medium text-sidebar-foreground">
                    {user?.name || "Manager"}
                  </p>
                  <p className="truncate text-[11px] capitalize text-sidebar-foreground/50">
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
  theme,
  onPresetChange,
  onToggleTheme,
}: {
  theme: ManagerThemeState;
  onPresetChange: (preset: ManagerThemeState["preset"]) => void;
  onToggleTheme: (event?: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
          Panel de Control
        </p>
        <h2 className="truncate text-3xl font-black uppercase italic leading-none tracking-tighter sm:text-4xl">
          Configuración
        </h2>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tight">
                  Modo de color
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cambia entre claro y oscuro con la misma transición de las
                  sucursales.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full shrink-0 rounded-xl sm:w-auto"
                onClick={onToggleTheme}
              >
                {theme.mode === "dark" ? (
                  <Sun className="mr-2 size-4" />
                ) : (
                  <Moon className="mr-2 size-4" />
                )}
                {theme.mode === "dark" ? "Usar modo claro" : "Usar modo oscuro"}
              </Button>
            </div>
          </section>
          <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
            <div>
              <h3 className="text-lg font-black uppercase italic tracking-tight">
                Tema de la vista Manager
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Selecciona el acento visual del panel y su sidebar.
              </p>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Object.entries(MANAGER_THEME_PRESETS).map(([id, preset]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    onPresetChange(id as ManagerThemeState["preset"])
                  }
                  className={cn(
                    "flex min-w-0 items-center gap-3 rounded-2xl border p-4 text-left transition-colors",
                    theme.preset === id
                      ? "border-primary bg-primary/10"
                      : "border-border/60 hover:border-primary/50",
                  )}
                >
                  <span
                    className="size-10 shrink-0 rounded-xl shadow-inner"
                    style={{ background: preset.primary }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">
                      {preset.label}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Acento y navegación Manager
                    </span>
                  </span>
                  {theme.preset === id && (
                    <span className="shrink-0 text-sm font-black text-primary">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>
        <aside className="h-fit rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Settings2 className="size-5" />
          </div>
          <h3 className="mt-4 text-lg font-black uppercase italic tracking-tight">
            Alcance de esta configuración
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Estos ajustes se guardan para la consola Manager y no modifican la
            apariencia de las sucursales ni la personalización del portal de
            clientes.
          </p>
          <div className="mt-5 rounded-2xl border border-border/60 bg-background/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Estado actual
            </p>
            <p className="mt-2 text-sm font-bold">
              {theme.mode === "dark" ? "Modo oscuro" : "Modo claro"} ·{" "}
              {MANAGER_THEME_PRESETS[theme.preset].label}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
