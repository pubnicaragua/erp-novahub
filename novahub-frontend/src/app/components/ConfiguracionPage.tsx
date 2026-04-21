import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Palette, RotateCcw, Save, Upload, Eye, Check, Paintbrush, Sparkles,
  Package, ShoppingBag, DollarSign, Briefcase, ShieldCheck, Building2, Globe,
  ShoppingCart, UserCheck, Users, Plus, Settings2, KeyRound, Layers,
  Crown, Lock, CheckCircle2, AlertCircle, Copy, RefreshCw,
  Trash2, Edit2, Shield, ArrowRight, Server, Rocket,
  BarChart3, Info, Coins, TrendingUp, HandCoins, User as UserIcon,
  CalendarDays, Headphones, BellRing, FileText, Activity, Settings
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { useTheme, type BrandColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { rolesService } from '../services/roles.service';
import { subscriptionsService } from '../services/subscriptions.service';
import { brandingService } from '../services/branding.service';
import { api } from '../services/api';
import { toast } from 'sonner';
import { cn } from './ui/utils';
import { type RoleManagement, type Permission } from '../types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from './ui/select';

const AVAILABLE_MODULES = [
  { id: 'SALES', label: 'Ventas', icon: TrendingUp, description: 'Cotizaciones, Facturación y Clientes' },
  { id: 'INVENTORY', label: 'Inventario', icon: Package, description: 'Stock, Almacenes y SKU' },
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

// Submódulos para permisos ultra-granulares
export const SUBMODULES_FOR_PERMS = [
  // Ventas
  { id: 'SALES_CLIENTS', label: 'Clientes', parent: 'SALES' },
  { id: 'SALES_QUOTES', label: 'Estimaciones', parent: 'SALES' },
  { id: 'SALES_ORDERS', label: 'Órdenes de Venta', parent: 'SALES' },
  { id: 'SALES_INVOICES', label: 'Facturas', parent: 'SALES' },
  { id: 'SALES_RECURRING', label: 'Facturas Recurrentes', parent: 'SALES' },
  { id: 'SALES_PAYMENTS', label: 'Pagos Recibidos', parent: 'SALES' },
  { id: 'SALES_RETURNS', label: 'Devoluciones de Venta', parent: 'SALES' },
  { id: 'SALES_CREDIT_NOTES', label: 'Notas de Crédito', parent: 'SALES' },

  // Compras
  { id: 'PURCHASES_PROVIDERS', label: 'Proveedores', parent: 'PURCHASES' },
  { id: 'PURCHASES_EXPENSES', label: 'Gastos', parent: 'PURCHASES' },
  { id: 'PURCHASES_EXPENSES_REC', label: 'Gastos Recurrentes', parent: 'PURCHASES' },
  { id: 'PURCHASES_ORDERS', label: 'Órdenes de Compra', parent: 'PURCHASES' },
  { id: 'PURCHASES_RECEIPTS', label: 'Recepciones de Compra', parent: 'PURCHASES', status: 'pending' },
  { id: 'PURCHASES_INVOICES', label: 'Facturas de Proveedor', parent: 'PURCHASES' },
  { id: 'PURCHASES_INVOICES_REC', label: 'Facturas de Proveedor Rec.', parent: 'PURCHASES' },
  { id: 'PURCHASES_PAYMENTS', label: 'Pagos Realizados', parent: 'PURCHASES' },
  { id: 'PURCHASES_RETURNS', label: 'Créditos de Proveedor', parent: 'PURCHASES' },

  // Recursos Humanos
  { id: 'HR_DASHBOARD', label: 'Dashboard HR', parent: 'HR' },
  { id: 'HR_EMPLOYEES', label: 'Empleados', parent: 'HR' },
  { id: 'HR_PAYROLL', label: 'Nóminas', parent: 'HR' },
  { id: 'HR_ATTENDANCE', label: 'Asistencia', parent: 'HR' },
  { id: 'HR_LEAVES', label: 'Vacaciones', parent: 'HR' },
  { id: 'HR_PERFORMANCE', label: 'Desempeño', parent: 'HR' },
  { id: 'HR_TRAINING', label: 'Capacitación', parent: 'HR' },
  { id: 'HR_BENEFITS', label: 'Beneficios', parent: 'HR' },
  { id: 'HR_PAYROLL_CONFIG', label: 'Config Nómina', parent: 'HR' },

  // Finanzas
  { id: 'FINANCIAL_DASHBOARD', label: 'Dashboard', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_INCOMES', label: 'Ingresos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_EXPENSES', label: 'Gastos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_EXPENSES_REC', label: 'Gastos Recurrentes', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_INCOMES_REC', label: 'Ingresos Recurrentes', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_BALANCE', label: 'Balance General', parent: 'FINANCIAL' },

  // Inventario
  { id: 'INVENTORY_DASHBOARD', label: 'Dashboard', parent: 'INVENTORY' },
  { id: 'INVENTORY_PRODUCTS', label: 'Productos', parent: 'INVENTORY' },
  { id: 'INVENTORY_WAREHOUSES', label: 'Almacenes', parent: 'INVENTORY' },
  { id: 'INVENTORY_TRANSFERS', label: 'Transferencias', parent: 'INVENTORY' },
  { id: 'INVENTORY_ADJUSTMENTS', label: 'Ajustes', parent: 'INVENTORY' },
  { id: 'INVENTORY_MOVEMENTS', label: 'Movimientos', parent: 'INVENTORY' },

  // Actividades
  { id: 'ACTIVITIES_TASKS', label: 'Tareas', parent: 'ACTIVITIES' },
  { id: 'ACTIVITIES_EVENTS', label: 'Eventos', parent: 'ACTIVITIES' },
  { id: 'ACTIVITIES_REMINDERS', label: 'Recordatorios', parent: 'ACTIVITIES' },
  { id: 'ACTIVITIES_LOGS', label: 'Bitácora', parent: 'ACTIVITIES' },

  // Documentos
  { id: 'DOCUMENTS_FILES', label: 'Archivos', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_CONTRACTS', label: 'Contratos', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_INVOICES', label: 'Facturas Legales', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_REPORTS', label: 'Reportes', parent: 'DOCUMENTS' },

  // Notificaciones
  { id: 'NOTIFICATIONS_ALERTS', label: 'Alertas', parent: 'NOTIFICATIONS' },
  { id: 'NOTIFICATIONS_MESSAGES', label: 'Mensajes', parent: 'NOTIFICATIONS' },
  { id: 'NOTIFICATIONS_PUSH', label: 'Push', parent: 'NOTIFICATIONS' },

  // Reportes
  { id: 'REPORTS_SALES', label: 'Ventas', parent: 'REPORTS' },
  { id: 'REPORTS_PURCHASES', label: 'Compras', parent: 'REPORTS' },
  { id: 'REPORTS_FINANCIAL', label: 'Financiero', parent: 'REPORTS' },
  { id: 'REPORTS_INVENTORY', label: 'Inventario', parent: 'REPORTS' },
  { id: 'REPORTS_CLIENTS', label: 'Clientes', parent: 'REPORTS' },
  { id: 'REPORTS_PROVIDERS', label: 'Proveedores', parent: 'REPORTS' },
  { id: 'REPORTS_HR', label: 'Recursos Humanos', parent: 'REPORTS' },
  { id: 'REPORTS_SUBSCRIPTIONS', label: 'Suscripciones', parent: 'REPORTS' },
  
  // Configuración
  { id: 'CONFIG_COMPANY', label: 'Empresa', parent: 'CONFIGURATION' },
  { id: 'CONFIG_BRANDING', label: 'Marca y Tema', parent: 'CONFIGURATION' },
  { id: 'CONFIG_USERS', label: 'Usuarios', parent: 'CONFIGURATION' },
  { id: 'CONFIG_ROLES', label: 'Roles y Permisos', parent: 'CONFIGURATION' },
  { id: 'CONFIG_SECURITY', label: 'Seguridad', parent: 'CONFIGURATION' },
  { id: 'CONFIG_CURRENCY', label: 'Moneda', parent: 'CONFIGURATION' },
  { id: 'CONFIG_SUBSCRIPTION', label: 'Suscripción', parent: 'CONFIGURATION' },
  { id: 'CONFIG_TENANCY', label: 'Multi-Tenancy', parent: 'CONFIGURATION' },
  { id: 'CONFIG_PLATFORM', label: 'Plataforma', parent: 'CONFIGURATION' },
  { id: 'CONFIG_DOMAINS', label: 'Dominios', parent: 'CONFIGURATION' },
];


// Fusionar para la lista de permisos anidando los submódulos justo debajo de sus padres
export const ALL_PERM_MODULES = AVAILABLE_MODULES.flatMap(mod => [
  mod,
  ...SUBMODULES_FOR_PERMS
    .filter(sub => sub.parent === mod.id)
    .map(s => ({ ...s, icon: Activity, description: `Vista de ${mod.label}` }))
]);

// ---- Hex / OKLCH conversion helpers ----
function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToOklch(r: number, g: number, b: number): string {
  const lr = linearize(r), lg = linearize(g), lb = linearize(b);
  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l = Math.cbrt(l_), m = Math.cbrt(m_), s = Math.cbrt(s_);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bv = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const C = Math.sqrt(a * a + bv * bv);
  let h = Math.atan2(bv, a) * 180 / Math.PI;
  if (h < 0) h += 360;
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${h.toFixed(3)})`;
}

function hexToOklch(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToOklch(r, g, b);
}

function oklchToApproxHex(oklch: string): string {
  // Simple approximation - extract lightness and hue for a rough color
  const match = oklch.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  if (!match) return '#6366f1';
  const L = parseFloat(match[1]);
  const C = parseFloat(match[2]);
  const h = parseFloat(match[3]);

  // Very rough conversion back
  const hRad = h * Math.PI / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.2914855480 * b;

  const l3 = l * l * l, m3 = m * m * m, s3 = s * s * s;

  let rr = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let gg = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let bb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  const delinearize = (c: number) => c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  rr = Math.round(Math.min(255, Math.max(0, delinearize(rr) * 255)));
  gg = Math.round(Math.min(255, Math.max(0, delinearize(gg) * 255)));
  bb = Math.round(Math.min(255, Math.max(0, delinearize(bb) * 255)));

  return `#${rr.toString(16).padStart(2, '0')}${gg.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`;
}

// ---- Color Presets ----
interface ColorPreset {
  name: string;
  description: string;
  primary: string;
  sidebar: string;
  accent: string;
}

const colorPresets: ColorPreset[] = [
  { name: 'Emerald Default', description: 'Tema predeterminado Nova Hub', primary: '#10b981', sidebar: '#0c1a12', accent: '#064e3b' },
  { name: 'Blue Corporate', description: 'Azul corporativo profesional', primary: '#2563eb', sidebar: '#0f172a', accent: '#1e3a5f' },
  { name: 'Indigo', description: 'Indigo clasico', primary: '#6366f1', sidebar: '#1a1a2e', accent: '#312e81' },
  { name: 'Rose', description: 'Rosa premium', primary: '#f43f5e', sidebar: '#1a0a10', accent: '#4c0519' },
  { name: 'Amber', description: 'Dorado ejecutivo', primary: '#f59e0b', sidebar: '#1a1408', accent: '#451a03' },
  { name: 'Violet', description: 'Violeta real', primary: '#8b5cf6', sidebar: '#150e24', accent: '#3b0764' },
  { name: 'Teal', description: 'Teal moderno', primary: '#14b8a6', sidebar: '#0a1a18', accent: '#042f2e' },
  { name: 'Orange', description: 'Naranja energico', primary: '#f97316', sidebar: '#1a1008', accent: '#431407' },
];

function generateThemeFromColor(hex: string, sidebarHex: string, accentHex: string): BrandColors {
  // Always use white foreground on primary for readability on colored buttons
  const fgColor = '#ffffff';
  const [sr, sg, sb] = hexToRgb(sidebarHex);
  const sBrightness = (sr * 299 + sg * 587 + sb * 114) / 1000;
  const sFgColor = sBrightness > 0.5 ? '#1a1a1a' : '#f5f5f5';

  return {
    primary: hexToOklch(hex),
    primaryForeground: hexToOklch(fgColor),
    accent: hexToOklch(accentHex),
    accentForeground: hexToOklch('#f5f5f5'),
    sidebar: hexToOklch(sidebarHex),
    sidebarForeground: hexToOklch(sFgColor),
    sidebarPrimary: hexToOklch(hex),
    sidebarAccent: hexToOklch(accentHex),
  };
}

// ---- Color Picker Component ----
interface ColorFieldProps {
  label: string;
  description: string;
  hexValue: string;
  onHexChange: (hex: string) => void;
}

function ColorField({ label, description, hexValue, onHexChange }: ColorFieldProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/20">
      <div className="relative">
        <input
          type="color"
          value={hexValue}
          onChange={e => onHexChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div
          className="size-10 rounded-lg border-2 border-border shadow-sm cursor-pointer transition-transform hover:scale-105"
          style={{ backgroundColor: hexValue }}
        />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Input
        value={hexValue}
        onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onHexChange(e.target.value); }}
        className="w-28 font-mono text-xs"
      />
    </div>
  );
}

// ---- Storage Upload Helper ----
async function uploadLogoToStorage(file: File, tenantId: string): Promise<string> {
  const { storageService } = await import('../services/storage.service');
  const url = await storageService.uploadTenantLogo(file, tenantId);
  return url;
}

// ---- Scenario detection ----
function getScenario(role?: string): 'superadmin' | 'partner' | 'client' {
  if (!role) return 'client';
  const r = role.toLowerCase();
  if (r === 'superadmin') return 'superadmin';
  if (r === 'partner') return 'partner';
  return 'client'; // admin, manager, employee are all client scenario
}

// ---- TAB CONFIG per scenario ----
interface TabDef { id: string; label: string; icon: React.ElementType; scenario: ('superadmin' | 'partner' | 'client')[] }
const ALL_TABS: TabDef[] = [
  { id: 'branding', label: 'Marca & Tema', icon: Palette, scenario: ['superadmin', 'partner', 'client'] },
  { id: 'empresa', label: 'Mi Empresa', icon: Building2, scenario: ['superadmin', 'partner', 'client'] },
  { id: 'roles', label: 'Roles & Permisos', icon: ShieldCheck, scenario: ['superadmin', 'partner', 'client'] },
  { id: 'seguridad', label: 'Seguridad', icon: KeyRound, scenario: ['superadmin', 'partner', 'client'] },
  { id: 'tenancy', label: 'Multi-Tenancy', icon: Layers, scenario: ['superadmin', 'partner'] },
  { id: 'currency', label: 'Moneda & Cambio', icon: Coins, scenario: ['superadmin', 'partner', 'client'] },
  { id: 'plataforma', label: 'Plataforma', icon: Server, scenario: ['superadmin'] },
  { id: 'dominios', label: 'Dominios', icon: Globe, scenario: ['superadmin', 'partner', 'client'] },
];

// ---- Main Component ----
export function ConfiguracionPage({ initialTab = 'branding' }: { initialTab?: string }) {
  const { themeConfig, updateTheme, updateConfig, resetTheme } = useTheme();
  const { user, canPerform } = useAuth();
  const { refreshRate: refreshCurrencyContext } = useCurrency();
  const scenario = getScenario(user?.role);
  const visibleTabs = ALL_TABS.filter(t => {
    if (!t.scenario.includes(scenario)) return false;
    if (t.id === 'roles' && !canPerform('roles', 'view')) return false;
    return true;
  });
  const canViewRoles = canPerform('roles', 'view');
  const canCreateRoles = canPerform('roles', 'create');
  const canEditRoles = canPerform('roles', 'edit');
  const canDeleteRoles = canPerform('roles', 'delete');

  // Hex state for the color pickers
  const [primaryHex, setPrimaryHex] = useState(() => oklchToApproxHex(themeConfig.colors.primary));
  const [sidebarHex, setSidebarHex] = useState(() => oklchToApproxHex(themeConfig.colors.sidebar));
  const [accentHex, setAccentHex] = useState(() => oklchToApproxHex(themeConfig.colors.accent));
  const [sidebarFgHex, setSidebarFgHex] = useState(() => oklchToApproxHex(themeConfig.colors.sidebarForeground));
  const [primaryFgHex, setPrimaryFgHex] = useState(() => oklchToApproxHex(themeConfig.colors.primaryForeground));
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('OTHER');
  const [industryOptions, setIndustryOptions] = useState<{ id?: string; code: string; name: string; isDefault: boolean }[]>([]);
  const [newIndustryName, setNewIndustryName] = useState('');
  const [showAddIndustry, setShowAddIndustry] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Security state
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('480');
  const [ipWhitelist, setIpWhitelist] = useState('');

  // Tenancy state
  const [strictIsolation, setStrictIsolation] = useState(true);
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [apiAccess, setApiAccess] = useState(false);
  const [apiKey] = useState('nh_live_' + Math.random().toString(36).slice(2, 18).toUpperCase());

  // Currency & Exchange Rate state
  const [exchangeRateAuto, setExchangeRateAuto] = useState(true);
  const [manualRate, setManualRate] = useState('36.50');
  const [currentBackendRate, setCurrentBackendRate] = useState<number | null>(null);
  const [displayCurrencySetting, setDisplayCurrencySetting] = useState<'NIO' | 'USD'>('NIO');
  const [allowCurrencySwitch, setAllowCurrencySwitch] = useState(true);
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);

  // New role dialog state (removed unused)

  // Load branding and currency on mount
  useEffect(() => {
    fetchBranding();
    fetchCurrencySettings();
    if (user?.tenantId) fetchIndustries();
  }, []);

  const fetchIndustries = async () => {
    if (!user?.tenantId) return;
    try {
      const data = await api.get<{ id?: string; code: string; name: string; isDefault: boolean }[]>(`/tenants/${user.tenantId}/industries`);
      if (data) setIndustryOptions(data);
    } catch (error) {
      console.error('Error fetching industries:', error);
    }
  };

  const handleAddIndustry = async () => {
    if (!newIndustryName.trim() || !user?.tenantId) return;
    try {
      const code = newIndustryName.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      await api.post(`/tenants/${user.tenantId}/industries`, { name: newIndustryName.trim(), code });
      toast.success('Industria agregada correctamente');
      setNewIndustryName('');
      setShowAddIndustry(false);
      await fetchIndustries();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al agregar industria');
    }
  };

  const handleDeleteIndustry = async (id: string) => {
    if (!user?.tenantId) return;
    try {
      await api.delete(`/tenants/${user.tenantId}/industries/${id}`);
      toast.success('Industria eliminada');
      await fetchIndustries();
    } catch (error) {
      toast.error('Error al eliminar industria');
    }
  };

  const fetchCurrencySettings = async () => {
    try {
      const data = await api.get<{
        rate: number;
        auto: boolean;
        baseCurrency?: 'NIO' | 'USD';
        displayCurrency?: 'NIO' | 'USD';
        allowCurrencySwitch?: boolean;
      }>('/tools/exchange-rate');
      if (data) {
        setExchangeRateAuto(data.auto);
        setCurrentBackendRate(data.rate);
        if (!data.auto) {
          setManualRate(data.rate.toString());
        }
        setDisplayCurrencySetting(data.displayCurrency === 'USD' ? 'USD' : (data.baseCurrency === 'USD' ? 'USD' : 'NIO'));
        setAllowCurrencySwitch(data.allowCurrencySwitch !== false);
      }
    } catch (error) {
      console.error('Error fetching currency settings:', error);
    }
  };

  const fetchBranding = async () => {
    try {
      const b = await brandingService.getCurrent();
      if (b.primaryColor) setPrimaryHex(b.primaryColor.startsWith('oklch') ? oklchToApproxHex(b.primaryColor) : b.primaryColor);
      if (b.sidebarColor) setSidebarHex(b.sidebarColor.startsWith('oklch') ? oklchToApproxHex(b.sidebarColor) : b.sidebarColor);
      if (b.accentColor) setAccentHex(b.accentColor.startsWith('oklch') ? oklchToApproxHex(b.accentColor) : b.accentColor);
      if (b.companyName) setCompanyName(b.companyName);
      if (b.logo) setLogoPreview(b.logo);
      if (b.whiteLabel !== undefined) setWhiteLabel(b.whiteLabel);
      updateTheme(generateThemeFromColor(
        b.primaryColor?.startsWith('oklch') ? oklchToApproxHex(b.primaryColor) : (b.primaryColor || '#10b981'),
        b.sidebarColor?.startsWith('oklch') ? oklchToApproxHex(b.sidebarColor) : (b.sidebarColor || '#0c1a12'),
        b.accentColor?.startsWith('oklch') ? oklchToApproxHex(b.accentColor) : (b.accentColor || '#064e3b'),
      ));
    } catch (error) {
      console.error('Error fetching branding:', error);
    }
  };

  const applyPreset = useCallback((preset: ColorPreset) => {
    setPrimaryHex(preset.primary);
    setSidebarHex(preset.sidebar);
    setAccentHex(preset.accent);

    // Always use white text on primary buttons
    setPrimaryFgHex('#ffffff');
    setSidebarFgHex('#f5f5f5');
    setActivePreset(preset.name);
  }, []);

  const handleSave = async () => {
    try {
      const colors = generateThemeFromColor(primaryHex, sidebarHex, accentHex);
      colors.primaryForeground = hexToOklch(primaryFgHex);
      colors.sidebarForeground = hexToOklch(sidebarFgHex);

      updateTheme(colors);

      await brandingService.update({
        primaryColor: primaryHex,
        sidebarColor: sidebarHex,
        accentColor: accentHex,
        logo: themeConfig.logo || undefined
      });

      toast.success('Marca actualizada correctamente', {
        description: `Los cambios se guardaron para nivel: ${user?.role.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Error saving theme:', error);
      toast.error('Error al guardar el tema en el servidor');
    }
  };

  const handleReset = () => {
    resetTheme();
    setPrimaryHex('#10b981');
    setSidebarHex('#0c1a12');
    setAccentHex('#064e3b');
    setPrimaryFgHex('#ffffff');
    setSidebarFgHex('#f5f5f5');
    setActivePreset('Emerald Default');
    toast.info('Tema restaurado al predeterminado');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoSave = async () => {
    if (!logoFile) return;
    setLogoUploading(true);
    try {
      let logoUrl: string;
      if (user?.tenantId) {
        logoUrl = await uploadLogoToStorage(logoFile, user.tenantId);
      } else {
        logoUrl = logoPreview || '';
      }
      updateConfig({ logo: logoUrl });
      await brandingService.update({ logo: logoUrl });
      toast.success('Logo guardado en Supabase Storage ✓');
    } catch (error) {
      console.error('Logo upload error:', error);
      // Fallback to base64 if storage fails
      if (logoPreview) {
        updateConfig({ logo: logoPreview });
        await brandingService.update({ logo: logoPreview }).catch(() => { });
        toast.success('Logo aplicado localmente');
      } else {
        toast.error('Error al subir el logo');
      }
    } finally {
      setLogoUploading(false);
    }
  };

  const [roles, setRoles] = useState<RoleManagement[]>([]);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [isLoadingModules, setIsLoadingModules] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  useEffect(() => {
    if (user?.tenantId && canViewRoles) {
      fetchRoles();
    }
    if (user?.tenantId) fetchEnabledModules();
  }, [user?.tenantId, canViewRoles]);

  const fetchRoles = async () => {
    setIsLoadingRoles(true);
    try {
      console.log('[Config] Fetching roles for tenant:', user?.tenantId);
      const res = await rolesService.getAll({ clientTenantId: user?.tenantId });
      let rolesList = Array.isArray(res) ? res : (res as any)?.data || [];
      
      console.log('[Config] Roles received:', rolesList.length);
      
      if (!user?.isPlatformAdmin) {
        rolesList = rolesList.filter((r: any) => r.clientTenantId === user?.tenantId);
      }
      
      setRoles(rolesList);
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const fetchEnabledModules = async () => {
    if (!user?.tenantId) return;
    setIsLoadingModules(true);
    try {
      const res = await subscriptionsService.getEnabledModules(user.tenantId);
      setEnabledModules(res);
    } catch (error) {
      console.error('Error fetching modules:', error);
    } finally {
      setIsLoadingModules(false);
    }
  };

  const handleSaveCompanyInfo = async () => {
    try {
      updateConfig({ tenantName: companyName });
      await brandingService.update({ companyName });
      toast.success('Información guardada');
    } catch (error) {
      toast.error('Error al guardar la información en el servidor');
    }
  };

  const handleSaveCurrencySettings = async () => {
    setIsSavingCurrency(true);
    try {
      const resp = await api.post<{
        rate: number;
        auto: boolean;
        displayCurrency?: 'NIO' | 'USD';
        allowCurrencySwitch?: boolean;
      }>('/tools/exchange-rate', {
        auto: exchangeRateAuto,
        rate: exchangeRateAuto ? undefined : parseFloat(manualRate),
        displayCurrency: displayCurrencySetting,
        allowCurrencySwitch,
      });
      if (resp) {
        setCurrentBackendRate(resp.rate);
        setDisplayCurrencySetting(resp.displayCurrency === 'USD' ? 'USD' : 'NIO');
        setAllowCurrencySwitch(resp.allowCurrencySwitch !== false);
        await refreshCurrencyContext();
        toast.success('Configuración de moneda actualizada');
      }
    } catch (error) {
      toast.error('Error al guardar configuración de moneda');
    } finally {
      setIsSavingCurrency(false);
    }
  };

  const handleToggleModule = async (moduleId: string) => {
    toast.info('La gestión de módulos se realiza desde la pestaña de Suscripciones para garantizar el registro de auditoría.');
  };

  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Partial<RoleManagement> | null>(null);

  const handleCreateRole = () => {
    if (!canCreateRoles) {
      toast.error('No tienes permisos para crear roles');
      return;
    }
    setEditingRole({
      name: '',
      description: '',
      permissions: ALL_PERM_MODULES.map(m => ({
        module: m.id,
        read: true,
        create: false,
        edit: false,
        delete: false
      })),
      tenantId: user?.tenantId
    });
    setIsRoleDialogOpen(true);
  };

  const handleEditRole = (role: RoleManagement) => {
    if (!canEditRoles) {
      toast.error('No tienes permisos para editar roles');
      return;
    }
    if (!user?.isPlatformAdmin && (role as any).clientTenantId && (role as any).clientTenantId !== user?.tenantId) {
      toast.error('No puedes editar roles de otra empresa');
      return;
    }
    // Asegurar que el rol tenga todos los módulos actuales
    const currentPerms = role.permissions || [];
    const fullPerms = ALL_PERM_MODULES.map(m => {
      // Buscar permiso existente (ignorando mayúsculas/minúsculas y buscando por ID o Label)
      const existing = currentPerms.find(p => 
        p.module?.toUpperCase() === m.id.toUpperCase() ||
        p.module?.toUpperCase() === m.label.toUpperCase()
      );
      
      if (existing) {
        return { 
          module: m.id, 
          read: !!existing.read, 
          create: existing.create !== undefined ? !!existing.create : !!existing.write,
          edit: existing.edit !== undefined ? !!existing.edit : !!existing.write,
          delete: !!existing.delete 
        };
      }
      
      return { module: m.id, read: false, create: false, edit: false, delete: false };
    });
    
    setEditingRole({
      ...role,
      permissions: fullPerms
    });
    setIsRoleDialogOpen(true);
  };

  const handleSaveRole = async () => {
    const isEditing = !!editingRole?.id;
    if (isEditing && !canEditRoles) {
      toast.error('No tienes permisos para editar roles');
      return;
    }
    if (!isEditing && !canCreateRoles) {
      toast.error('No tienes permisos para crear roles');
      return;
    }
    if (!editingRole?.name) {
      toast.error('El nombre del rol es obligatorio');
      return;
    }

    try {
      // Limpiar el objeto de envío para eliminar campos innecesarios o automáticos
      const { id, _count, createdAt, updatedAt, ...cleanRole } = editingRole as any;
      
      const payload = {
        name: cleanRole.name,
        description: cleanRole.description || '',
        // Asegurar compatibilidad: el backend usa 'write', el frontend granular usa 'create'/'edit'
        permissions: (Array.isArray(cleanRole.permissions) ? cleanRole.permissions : []).map((p: any) => ({
          ...p,
          write: !!(p.create || p.edit || p.write), // compat con backend
        })),
        allowedModules: cleanRole.allowedModules || [],
        clientTenantId: user?.tenantId
      };

      console.log('Guardando rol con payload:', payload);

      if (editingRole.id) {
        await rolesService.update(editingRole.id, payload);
        toast.success('Rol actualizado con éxito');
      } else {
        await rolesService.create(payload);
        toast.success('Nuevo rol creado correctamente');
      }
      setIsRoleDialogOpen(false);
      fetchRoles();
    } catch (error: any) {
      console.error('Error al guardar rol:', error);
      toast.error(error.response?.data?.message || 'Error al guardar el rol');
    }
  };

  const togglePermission = (module: string, type: 'read' | 'write' | 'create' | 'edit' | 'delete') => {
    if (!editingRole) return;
    let newPerms = [...(Array.isArray(editingRole.permissions) ? editingRole.permissions : []).map(p => ({ ...p }))];

    const targetPerm = newPerms.find(p => p.module === module);
    if (!targetPerm) return;

    const newValue = !targetPerm[type];

    // Si se intenta desactivar leer, pero crear/editar/borrar siguen activos, no permitir.
    if (type === 'read' && newValue === false) {
      if (targetPerm.create || targetPerm.edit || targetPerm.delete || targetPerm.write) {
        return; // Bloquear
      }
    }

    // Aplicar el cambio al módulo clickeado
    targetPerm[type] = newValue;
    // Si se activa crear, editar o borrar, asegurar que se active leer.
    if ((type === 'create' || type === 'edit' || type === 'delete') && newValue === true) {
      targetPerm.read = true;
    }

    // Verificar si es un módulo padre (tiene hijos en SUBMODULES_FOR_PERMS)
    const childModules = SUBMODULES_FOR_PERMS.filter(sub => sub.parent === module);
    
    if (childModules.length > 0) {
      // Es un PADRE → propagar a todos los hijos
      childModules.forEach(child => {
        const childPerm = newPerms.find(p => p.module === child.id);
        if (childPerm) {
          childPerm[type] = newValue;
          // Si se activa crear/editar/borrar en padre, también activar leer en hijos
          if ((type === 'create' || type === 'edit' || type === 'delete') && newValue === true) {
            childPerm.read = true;
          }
          // Si se desactiva leer en padre, desactivar todo en hijos
          if (type === 'read' && newValue === false) {
            childPerm.create = false;
            childPerm.edit = false;
            childPerm.delete = false;
            childPerm.write = false;
          }
        }
      });
    }

    // Verificar si es un submódulo (tiene parent)
    const submoduleDef = SUBMODULES_FOR_PERMS.find(sub => sub.id === module);
    if (submoduleDef) {
      // Es un HIJO → recalcular el estado del padre
      const parentPerm = newPerms.find(p => p.module === submoduleDef.parent);
      if (parentPerm) {
        const siblings = SUBMODULES_FOR_PERMS.filter(sub => sub.parent === submoduleDef.parent);
        const siblingPerms = siblings.map(s => newPerms.find(p => p.module === s.id)).filter(Boolean);
        
        // El padre está ON solo si TODOS los hijos tienen ese permiso ON
        parentPerm[type] = siblingPerms.length > 0 && siblingPerms.every(sp => !!sp![type]);
        
        // Recalcular también 'read' del padre
        if (type !== 'read') {
          parentPerm.read = siblingPerms.length > 0 && siblingPerms.every(sp => !!sp!.read);
        }
      }
    }

    setEditingRole({ ...editingRole, permissions: newPerms });
  };

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 max-w-[1920px] mx-auto">

      {/* ── HEADER ── */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-2 md:gap-3 uppercase italic">
            <Settings2 className="size-6 md:size-9 text-primary" />
            Configuración <span className="text-primary">Sistema</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              {scenario === 'superadmin' ? 'Super Admin Console' : scenario === 'partner' ? 'Partner Panel' : 'Mi Configuración'}
            </Badge>
            <span className="text-muted-foreground/40 text-xs font-medium">
              {user?.name}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── TABS ── */}
      <Tabs value={activeTab} className="space-y-6" onValueChange={setActiveTab}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex flex-wrap gap-1.5 rounded-2xl border border-border/40">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                  <Icon className="size-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </motion.div>

        {/* ══════════ TAB: BRANDING ══════════ */}
        <TabsContent value="branding" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Left: Presets + Colors */}
            <div className="xl:col-span-2 space-y-6">
              {/* Presets */}
              <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-border/30 bg-muted/10">
                  <CardTitle className="flex items-center gap-2 text-lg font-black"><Sparkles className="size-5 text-primary" />Paletas de Color</CardTitle>
                  <CardDescription>Aplica un esquema completo con un solo click</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {colorPresets.map(preset => (
                      <button key={preset.name} onClick={() => applyPreset(preset)}
                        className={cn('relative flex flex-col items-center gap-3 rounded-2xl border-2 p-4 transition-all hover:shadow-xl hover:-translate-y-0.5',
                          activePreset === preset.name ? 'border-primary shadow-lg shadow-primary/20 bg-primary/5' : 'border-border/50 hover:border-primary/30')}>
                        {activePreset === preset.name && (
                          <div className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                            <Check className="size-3.5" />
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          <div className="size-7 rounded-full border-2 border-white/20 shadow-sm" style={{ backgroundColor: preset.primary }} />
                          <div className="size-7 rounded-full border-2 border-white/20 shadow-sm" style={{ backgroundColor: preset.sidebar }} />
                          <div className="size-7 rounded-full border-2 border-white/20 shadow-sm" style={{ backgroundColor: preset.accent }} />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-black">{preset.name}</p>
                          <p className="text-[10px] text-muted-foreground">{preset.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Custom Colors */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/10">
                  <CardTitle className="flex items-center gap-2 text-lg font-black"><Palette className="size-5 text-primary" />Colores Personalizados</CardTitle>
                  <CardDescription>Ajusta cada color individualmente</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Colores Principales</p>
                  <ColorField label="Color Primario" description="Botones, enlaces y elementos activos" hexValue={primaryHex} onHexChange={v => { setPrimaryHex(v); setActivePreset(null); }} />
                  <ColorField label="Texto sobre Primario" description="Color del texto en botones primarios" hexValue={primaryFgHex} onHexChange={v => { setPrimaryFgHex(v); setActivePreset(null); }} />
                  <ColorField label="Color de Acento" description="Elementos secundarios y hovers" hexValue={accentHex} onHexChange={v => { setAccentHex(v); setActivePreset(null); }} />
                  <Separator className="my-2" />
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Colores del Sidebar</p>
                  <ColorField label="Fondo del Sidebar" description="Color de fondo del menú lateral" hexValue={sidebarHex} onHexChange={v => { setSidebarHex(v); setActivePreset(null); }} />
                  <ColorField label="Texto del Sidebar" description="Color del texto en el menú lateral" hexValue={sidebarFgHex} onHexChange={v => { setSidebarFgHex(v); setActivePreset(null); }} />
                  <div className="flex gap-3 pt-2">
                    <Button onClick={handleSave} className="rounded-xl gap-2 font-bold">
                      <Save className="size-4" />Guardar Tema
                    </Button>
                    <Button variant="outline" onClick={handleReset} className="rounded-xl gap-2">
                      <RotateCcw className="size-4" />Restaurar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Live Preview + Logo */}
            <div className="space-y-6">
              {/* Logo Upload */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/10">
                  <CardTitle className="flex items-center gap-2 text-lg font-black"><Upload className="size-5 text-primary" />Logo Corporativo</CardTitle>
                  <CardDescription>Almacenado en Supabase Storage</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className={cn('relative flex flex-col items-center justify-center h-40 rounded-2xl border-2 border-dashed cursor-pointer transition-all group',
                      logoPreview ? 'border-primary/40 bg-primary/5' : 'border-border/50 hover:border-primary/40 hover:bg-primary/5')}>
                    {logoPreview ? (
                      <>
                        <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-6 rounded-2xl" />
                        <div className="absolute inset-0 bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <p className="text-white text-xs font-bold">Cambiar logo</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="size-10 opacity-30" />
                        <p className="text-xs font-bold">Click para subir logo</p>
                        <p className="text-[10px] opacity-60">PNG, SVG, JPG · Max 2MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  {logoFile && (
                    <Button onClick={handleLogoSave} disabled={logoUploading} className="w-full rounded-xl gap-2 font-bold">
                      {logoUploading ? <><RefreshCw className="size-4 animate-spin" />Subiendo...</> : <><Save className="size-4" />Guardar en Supabase</>}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Live Preview */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/10">
                  <CardTitle className="flex items-center gap-2 text-lg font-black"><Eye className="size-5 text-primary" />Vista Previa</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="rounded-xl overflow-hidden border border-border shadow-lg" style={{ backgroundColor: sidebarHex }}>
                    <div className="p-3 border-b" style={{ borderColor: `${sidebarFgHex}20` }}>
                      <div className="flex items-center gap-2">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="size-8 object-contain rounded" />
                        ) : (
                          <div className="size-8 rounded-lg flex items-center justify-center font-black text-sm" style={{ backgroundColor: primaryHex, color: primaryFgHex }}>N</div>
                        )}
                        <div>
                          <p className="text-xs font-bold" style={{ color: sidebarFgHex }}>{companyName || 'Mi Empresa'}</p>
                          <p className="text-[9px] opacity-50" style={{ color: sidebarFgHex }}>Dashboard ERP</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 space-y-1">
                      {['Dashboard', 'Ventas', 'Compras', 'Inventario'].map((item, i) => (
                        <div key={item} className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                          style={i === 0 ? { backgroundColor: primaryHex, color: primaryFgHex } : { color: `${sidebarFgHex}99` }}>
                          {item}
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t space-y-2" style={{ borderColor: `${sidebarFgHex}20` }}>
                      <div className="flex gap-2">
                        <button className="flex-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-all" style={{ backgroundColor: primaryHex, color: primaryFgHex }}>Primario</button>
                        <button className="flex-1 rounded-lg px-2 py-1 text-[10px] font-bold transition-all" style={{ backgroundColor: accentHex, color: sidebarFgHex }}>Acento</button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </TabsContent>

        {/* ══════════ TAB: EMPRESA ══════════ */}
        <TabsContent value="empresa" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><Building2 className="size-5 text-primary" />Datos Corporativos</CardTitle>
                <CardDescription>Información principal de tu empresa en Nova Hub</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre de la Empresa</Label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ej: Empresa Demo S.A." className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Slug / Identificador</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-mono bg-muted px-3 py-2 rounded-lg">novahub.io/</span>
                    <Input value={companySlug || user?.tenantId || ''} onChange={e => setCompanySlug(e.target.value)} className="rounded-xl h-11 font-mono" placeholder="empresa-demo" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Identificador único de tu instancia en la plataforma</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Industria</Label>
                  <div className="space-y-2">
                    <Select value={companyIndustry} onValueChange={setCompanyIndustry}>
                      <SelectTrigger className="h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 shadow-sm">
                        <SelectValue placeholder="Seleccionar industria" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/50 shadow-2xl">
                        {industryOptions.length > 0 ? (
                          <>
                            <SelectGroup>
                              <SelectLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Predeterminadas</SelectLabel>
                              {industryOptions.filter(o => o.isDefault).map(o => (
                                <SelectItem key={o.code} value={o.code} className="font-bold text-xs">{o.name}</SelectItem>
                              ))}
                            </SelectGroup>
                            {industryOptions.some(o => !o.isDefault) && (
                              <SelectGroup>
                                <SelectLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Personalizadas</SelectLabel>
                                {industryOptions.filter(o => !o.isDefault).map(o => (
                                  <SelectItem key={o.code} value={o.code} className="font-bold text-xs">{o.name}</SelectItem>
                                ))}
                              </SelectGroup>
                            )}
                          </>
                        ) : (
                          <>
                            <SelectItem value="RETAIL" className="font-bold text-xs">Comercio / Retail</SelectItem>
                            <SelectItem value="SERVICES" className="font-bold text-xs">Servicios Profesionales</SelectItem>
                            <SelectItem value="OTHER" className="font-bold text-xs">Otro</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {/* Custom industry entries with delete */}
                    {industryOptions.filter(o => !o.isDefault).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {industryOptions.filter(o => !o.isDefault).map(o => (
                          <Badge key={o.id} variant="secondary" className="gap-1 pr-1 text-[10px] font-bold">
                            {o.name}
                            <button onClick={() => o.id && handleDeleteIndustry(o.id)}
                              className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors">
                              <Trash2 className="size-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    {/* Add new industry inline */}
                    {showAddIndustry ? (
                      <div className="flex gap-2">
                        <Input
                          value={newIndustryName}
                          onChange={e => setNewIndustryName(e.target.value)}
                          placeholder="Ej: Logística y Transporte"
                          className="rounded-xl h-9 text-xs flex-1"
                          onKeyDown={e => e.key === 'Enter' && handleAddIndustry()}
                          autoFocus
                        />
                        <Button size="sm" onClick={handleAddIndustry} className="rounded-xl h-9 gap-1 text-xs font-bold">
                          <Check className="size-3" />Agregar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowAddIndustry(false); setNewIndustryName(''); }} className="rounded-xl h-9 text-xs">
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddIndustry(true)}
                        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-bold transition-colors">
                        <Plus className="size-3.5" />Agregar nueva industria
                      </button>
                    )}
                  </div>
                </div>
                <Button onClick={handleSaveCompanyInfo} className="w-full rounded-xl gap-2 font-bold h-11">
                  <Save className="size-4" />Guardar Información
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><Info className="size-5 text-primary" />Detalles del Tenant</CardTitle>
                <CardDescription>Información técnica de tu instancia</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {[
                  { label: 'Tenant ID', value: user?.tenantId || 'N/A', mono: true },
                  { label: 'Usuario ID', value: user?.id || 'N/A', mono: true },
                  { label: 'Rol del Sistema', value: user?.role?.toUpperCase() || 'N/A', mono: false },
                  { label: 'Email', value: user?.email || 'N/A', mono: false },
                  { label: 'Escenario', value: scenario.toUpperCase(), mono: false },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30">
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-bold', mono && 'font-mono')}>{value}</span>
                      {mono && (
                        <button onClick={() => { navigator.clipboard.writeText(value); toast.success('Copiado'); }}
                          className="text-muted-foreground hover:text-primary transition-colors">
                          <Copy className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Plan Badge */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-primary">Plan Actual</p>
                    <p className="text-2xl font-black mt-0.5">Enterprise</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Crown className="size-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ══════════ TAB: ROLES ══════════ */}
        <TabsContent value="roles" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 font-black"><ShieldCheck className="size-5 text-primary" />Gestión de Roles & Permisos</CardTitle>
                    <CardDescription>Define niveles de acceso por módulo para cada rol de usuario</CardDescription>
                  </div>
                  <Button onClick={handleCreateRole} disabled={!canCreateRoles} className="rounded-xl gap-2 font-black text-xs uppercase tracking-widest h-10">
                    <Plus className="size-4" />Nuevo Rol
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoadingRoles ? (
                  <div className="flex items-center justify-center h-40">
                    <RefreshCw className="size-8 animate-spin text-primary/30" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {(roles || []).map((role: RoleManagement) => {
                      const roleColors: Record<string, string> = {
                        'Administrador': 'from-violet-500 to-purple-600',
                        'Gerente': 'from-blue-500 to-indigo-600',
                        'Empleado': 'from-emerald-500 to-teal-600',
                        'Observador': 'from-slate-400 to-slate-500',
                      };
                      const gradient = roleColors[role.name] || 'from-primary to-primary/80';
                      return (
                        <div key={role.id}
                          className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-lg transition-all p-5">
                          <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-all pointer-events-none" />

                          {/* Role Header */}
                          <div className="flex items-start justify-between mb-5">
                            <div className="flex items-center gap-3">
                              <div className={`size-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg text-white font-black text-lg`}>
                                {role.name?.charAt(0) || 'R'}
                              </div>
                              <div>
                                <h4 className="font-black text-base tracking-tight">{role.name}</h4>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                  {(() => {
                                    const activePerms = (Array.isArray(role.permissions) ? role.permissions : []).filter((p: Permission) => p.read || p.create || p.edit || p.delete || p.write);
                                    const parentModules = new Set(activePerms.map((p: Permission) => {
                                      const sub = SUBMODULES_FOR_PERMS.find(s => s.id === p.module);
                                      return sub ? sub.parent : p.module;
                                    }));
                                    return `${parentModules.size} módulos activos`;
                                  })()}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1 transition-all relative z-20">
                              <button onClick={() => handleEditRole(role)} disabled={!canEditRoles}
                                className="size-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-all">
                                <Edit2 className="size-3.5" />
                              </button>
                              {!['Administrador', 'Admin'].includes(role.name) && canDeleteRoles && (
                                <button onClick={async () => {
                                  if (!confirm(`¿Eliminar el rol "${role.name}"?`)) return;
                                  if (!user?.isPlatformAdmin && (role as any).clientTenantId && (role as any).clientTenantId !== user?.tenantId) {
                                    toast.error('No puedes eliminar roles de otra empresa');
                                    return;
                                  }
                                  try { await rolesService.delete(role.id); toast.success('Rol eliminado'); fetchRoles(); }
                                  catch { toast.error('Error al eliminar rol'); }
                                }} className="size-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center text-rose-500 transition-all">
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Permissions Matrix */}
                          <div className="space-y-1.5 mb-5">
                            {(Array.isArray(role.permissions) ? role.permissions : []).filter((p: Permission) => p.read || p.create || p.edit || p.delete || p.write).slice(0, 4).map((p: Permission) => {
                              const mod = ALL_PERM_MODULES.find(m => m.id === p.module);
                              return (
                                <div key={p.module} className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg hover:bg-muted/20">
                                  <span className="font-bold text-muted-foreground truncate mr-2">{mod?.label || p.module}</span>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black', p.read ? 'bg-blue-500/15 text-blue-500' : 'bg-muted/30 text-muted-foreground/30')}>L</span>
                                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black', (p.create || p.write) ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted/30 text-muted-foreground/30')}>C</span>
                                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black', (p.edit || p.write) ? 'bg-amber-500/15 text-amber-500' : 'bg-muted/30 text-muted-foreground/30')}>E</span>
                                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black', p.delete ? 'bg-rose-500/15 text-rose-500' : 'bg-muted/30 text-muted-foreground/30')}>B</span>
                                  </div>
                                </div>
                              );
                            })}
                            {(() => {
                              const active = (Array.isArray(role.permissions) ? role.permissions : []).filter((p: Permission) => p.read || p.create || p.edit || p.delete || p.write);
                              return active.length > 4 ? (
                                <p className="text-[10px] text-muted-foreground/50 italic pl-2">+ {active.length - 4} vistas más</p>
                              ) : null;
                            })()}
                          </div>

                          <button onClick={() => handleEditRole(role)} disabled={!canEditRoles}
                            className="w-full text-xs font-black uppercase tracking-widest py-2 rounded-xl border border-primary/20 text-primary hover:bg-primary/5 transition-all relative z-20">
                            Editar Permisos →
                          </button>
                        </div>
                      );
                    })}

                    {/* Add New Role Card */}
                    <button onClick={handleCreateRole} disabled={!canCreateRoles}
                      className="group flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 border-dashed border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all min-h-[200px]">
                      <div className="size-12 rounded-xl bg-muted/20 group-hover:bg-primary/10 flex items-center justify-center transition-all">
                        <Plus className="size-6 text-muted-foreground group-hover:text-primary transition-all" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-black uppercase tracking-widest">Nuevo Rol</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Crear rol personalizado</p>
                      </div>
                    </button>

                    {roles.length === 0 && (
                      <div className="col-span-full py-16 text-center border-2 border-dashed border-border/30 rounded-2xl">
                        <ShieldCheck className="size-12 mx-auto text-muted-foreground/10 mb-3" />
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/30">Sin roles configurados</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Role Edit Dialog */}
          <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
            <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-hidden p-0 rounded-3xl border-none flex flex-col">
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border/30 bg-muted/10 flex-shrink-0">
                <div>
                  <DialogTitle className="text-lg font-black">{editingRole?.id ? 'Editar Rol' : 'Nuevo Rol'}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">Define nombre y matriz de permisos</DialogDescription>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-3 sm:p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre del Rol *</Label>
                    <Input placeholder="Ej: Gerente de Ventas" className="rounded-xl h-11"
                      value={editingRole?.name || ''} onChange={e => setEditingRole({ ...editingRole, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Descripción</Label>
                    <Input placeholder="Descripción del rol" className="rounded-xl h-11"
                      value={editingRole?.description || ''} onChange={e => setEditingRole({ ...editingRole, description: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Matriz de Permisos por Módulo</Label>
                    <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-widest">
                      <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500 inline-block" />Leer</span>
                      <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500 inline-block" />Crear</span>
                      <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500 inline-block" />Editar</span>
                      <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-rose-500 inline-block" />Borrar</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/40 overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm table-fixed min-w-[320px] sm:min-w-full">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="text-left px-2 sm:px-3 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider text-muted-foreground">Módulo</th>
                          <th className="px-0 py-2 text-center text-[10px] sm:text-xs font-black text-blue-500 w-[52px] sm:w-[72px]">Leer</th>
                          <th className="px-0 py-2 text-center text-[10px] sm:text-xs font-black text-emerald-500 w-[52px] sm:w-[72px]">Crear</th>
                          <th className="px-0 py-2 text-center text-[10px] sm:text-xs font-black text-amber-500 w-[52px] sm:w-[72px]">Editar</th>
                          <th className="px-0 py-2 text-center text-[10px] sm:text-xs font-black text-rose-500 w-[52px] sm:w-[72px]">Borrar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {(Array.isArray(editingRole?.permissions) ? editingRole.permissions : []).map((p) => {
                          const mod = ALL_PERM_MODULES.find(m => m.id === p.module);
                          const isSubmodule = mod && 'parent' in mod;
                          const Icon = mod?.icon;
                          
                          return (
                            <tr key={p.module} className={cn(
                              "hover:bg-muted/10 transition-colors",
                              isSubmodule ? "bg-muted/5 opacity-90" : "bg-card"
                            )}>
                              <td className="px-2 sm:px-3 py-1.5">
                                <div className={cn("flex items-center gap-2", isSubmodule && "pl-4 sm:pl-6")}>
                                  <div className={cn(
                                    "hidden sm:flex size-7 rounded-lg items-center justify-center flex-shrink-0",
                                    isSubmodule ? "bg-muted/20" : "bg-primary/10"
                                  )}>
                                    {Icon && <Icon className={cn("size-3.5", isSubmodule ? "text-muted-foreground" : "text-primary")} />}
                                  </div>
                                  <div className="min-w-0">
                                    <p className={cn("font-bold leading-tight truncate", isSubmodule ? "text-[10px] sm:text-xs" : "text-xs sm:text-sm")}>
                                      {mod?.label || p.module}
                                      {isSubmodule && <span className="ml-1 text-[8px] font-black text-muted-foreground/50 uppercase">SUB</span>}
                                      {(mod as any)?.status === 'pending' && <Badge variant="outline" className="ml-2 text-[7px] py-0 px-1 border-muted-foreground/30 text-muted-foreground/50">Próximamente</Badge>}
                                    </p>
                                    <p className="hidden lg:block text-[9px] text-muted-foreground truncate">{mod?.description || ''}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-0 py-1.5 text-center">
                                <div className="flex justify-center"><Switch disabled={!canEditRoles || (mod as any)?.status === 'pending'} checked={!!p.read} onCheckedChange={() => togglePermission(p.module, 'read')} className="scale-[0.65] sm:scale-75" /></div>
                              </td>
                              <td className="px-0 py-1.5 text-center">
                                <div className="flex justify-center"><Switch disabled={!canEditRoles || (mod as any)?.status === 'pending'} checked={!!p.create} onCheckedChange={() => togglePermission(p.module, 'create')} className="scale-[0.65] sm:scale-75" /></div>
                              </td>
                              <td className="px-0 py-1.5 text-center">
                                <div className="flex justify-center"><Switch disabled={!canEditRoles || (mod as any)?.status === 'pending'} checked={!!p.edit} onCheckedChange={() => togglePermission(p.module, 'edit')} className="scale-[0.65] sm:scale-75" /></div>
                              </td>
                              <td className="px-0 py-1.5 text-center">
                                <div className="flex justify-center"><Switch disabled={!canEditRoles || (mod as any)?.status === 'pending'} checked={!!p.delete} onCheckedChange={() => togglePermission(p.module, 'delete')} className="scale-[0.65] sm:scale-75" /></div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex gap-3 p-6 border-t border-border/30 bg-muted/10 mt-0">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsRoleDialogOpen(false)}>Cancelar</Button>
                <Button disabled={!(editingRole?.id ? canEditRoles : canCreateRoles)} className="flex-1 rounded-xl gap-2 font-black" onClick={handleSaveRole}>
                  <Save className="size-4" />Guardar Rol
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ══════════ TAB: SEGURIDAD ══════════ */}
        <TabsContent value="seguridad" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><Shield className="size-5 text-primary" />Autenticación & Acceso</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {[
                  { label: 'Autenticación de Dos Factores (2FA)', desc: 'Protege el acceso con un segundo factor de verificación', value: twoFaEnabled, setter: setTwoFaEnabled, tag: 'Recomendado' },
                  { label: 'Forzar 2FA para Administradores', desc: 'Todos los usuarios admin deben activar 2FA obligatoriamente', value: false, setter: () => { }, tag: 'Enterprise' },
                  { label: 'Inicio de Sesión con Google SSO', desc: 'Permite autenticación con cuentas corporativas de Google', value: false, setter: () => { }, tag: 'Próximo' },
                ].map(({ label, desc, value, setter, tag }) => (
                  <div key={label} className="flex items-center justify-between p-4 rounded-xl border border-border/40 hover:border-border/70 transition-all bg-card">
                    <div className="space-y-0.5 flex-1 mr-4">
                      <div className="flex items-center gap-2">
                        <Label className="font-bold text-sm cursor-pointer">{label}</Label>
                        <Badge variant="outline" className="text-[9px] font-black uppercase">{tag}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch checked={value} onCheckedChange={setter} />
                  </div>
                ))}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tiempo de Expiración de Sesión</Label>
                  <div className="flex items-center gap-3">
                    <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                      <SelectTrigger className="h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-primary/20 shadow-sm">
                        <SelectValue placeholder="Seleccionar tiempo" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/50 shadow-2xl">
                        <SelectItem value="15" className="font-bold text-xs">15 minutos</SelectItem>
                        <SelectItem value="30" className="font-bold text-xs">30 minutos</SelectItem>
                        <SelectItem value="60" className="font-bold text-xs">1 hora</SelectItem>
                        <SelectItem value="240" className="font-bold text-xs">4 horas</SelectItem>
                        <SelectItem value="480" className="font-bold text-xs">8 horas</SelectItem>
                        <SelectItem value="1440" className="font-bold text-xs">24 horas</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button className="rounded-xl h-11 gap-2 font-bold" onClick={() => toast.success('Configuración guardada')}>
                      <Save className="size-4" />Guardar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/10">
                  <CardTitle className="flex items-center gap-2 font-black"><Lock className="size-5 text-primary" />Control de Acceso por IP</CardTitle>
                  <CardDescription>Permite solo conexiones desde IPs autorizadas</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <textarea value={ipWhitelist} onChange={e => setIpWhitelist(e.target.value)} rows={4} placeholder={'192.168.1.0/24\n10.0.0.1\n203.0.113.5'}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <Button className="w-full rounded-xl gap-2 font-bold" variant="outline" onClick={() => toast.success('Lista de IPs actualizada')}>
                    <CheckCircle2 className="size-4" />Actualizar Whitelist
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/10">
                  <CardTitle className="flex items-center gap-2 font-black"><BarChart3 className="size-5 text-primary" />Registro de Auditoría</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-3">
                  {[
                    { action: 'Login exitoso', user: user?.email || 'admin@novahub.com', time: 'Hace 2 min', type: 'success' },
                    { action: 'Rol editado', user: user?.email || 'admin@novahub.com', time: 'Hace 15 min', type: 'warning' },
                    { action: 'Branding actualizado', user: user?.email || 'admin@novahub.com', time: 'Hace 1h', type: 'info' },
                    { action: 'Usuario creado', user: 'partner@novahub.io', time: 'Hace 3h', type: 'success' },
                  ].map(({ action, user: u, time, type }, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-border/30">
                      <div className={cn('size-2 rounded-full flex-shrink-0',
                        type === 'success' ? 'bg-emerald-500' : type === 'warning' ? 'bg-amber-500' : 'bg-blue-500')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{action}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{u}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{time}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </TabsContent>

        {/* ══════════ TAB: MULTI-TENANCY ══════════ */}
        <TabsContent value="tenancy" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><Layers className="size-5 text-primary" />Configuración de Tenancy</CardTitle>
                <CardDescription>Ajustes de aislamiento y jerarquía del sistema multi-tenant</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {[
                  { label: 'Aislamiento Estricto de Datos', desc: 'Garantiza que ningún dato sea visible entre tenants, incluso en reportes globales', value: strictIsolation, setter: setStrictIsolation, locked: true },
                  { label: 'White Label Branding', desc: 'Remueve las menciones de "NovaHub" y usa solo tu marca corporativa', value: whiteLabel, setter: setWhiteLabel, locked: false },
                  { label: 'Acceso a API REST', desc: 'Habilita el endpoint REST para integraciones externas de tus clientes', value: apiAccess, setter: setApiAccess, locked: false },
                ].map(({ label, desc, value, setter, locked }) => (
                  <div key={label} className="flex items-center justify-between p-4 rounded-xl border border-border/40 hover:border-border/70 transition-all">
                    <div className="flex-1 mr-4">
                      <div className="flex items-center gap-2">
                        <Label className="font-bold text-sm">{label}</Label>
                        {locked && <Lock className="size-3 text-muted-foreground" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    <Switch checked={value} onCheckedChange={locked ? undefined : setter} disabled={locked} />
                  </div>
                ))}
                <Button className="w-full rounded-xl gap-2 font-bold h-11" onClick={() => { brandingService.update({ whiteLabel }); toast.success('Configuración de tenancy guardada'); }}>
                  <Save className="size-4" />Guardar Configuración
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><Server className="size-5 text-primary" />Infraestructura</CardTitle>
                <CardDescription>Estado de la plataforma y recursos</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {[
                  { label: 'Base de Datos', value: 'PostgreSQL 15 · Supabase', status: 'ok' },
                  { label: 'Almacenamiento', value: 'Supabase Storage · CDN activo', status: 'ok' },
                  { label: 'Autenticación', value: 'JWT RS256 · 24h TTL', status: 'ok' },
                  { label: 'API Backend', value: 'NestJS · localhost:3000', status: 'ok' },
                  { label: 'Aislamiento Tenants', value: 'clientTenantId por query', status: 'ok' },
                  { label: 'Dominio Frontend', value: 'Vite · localhost:5173', status: 'ok' },
                ].map(({ label, value, status }) => (
                  <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-muted/10 border border-border/30">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</p>
                      <p className="text-sm font-bold mt-0.5">{value}</p>
                    </div>
                    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black',
                      status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500')}>
                      <div className={cn('size-1.5 rounded-full', status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
                      {status === 'ok' ? 'Activo' : 'Atención'}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ══════════ TAB: MONEDA & CAMBIO ══════════ */}
        <TabsContent value="currency" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><Coins className="size-5 text-primary" />Moneda & Tasa de Cambio</CardTitle>
                <CardDescription>Configura como el sistema gestiona NIO vs USD</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-black uppercase tracking-widest text-primary">Tasa de Cambio Automática (BCN)</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Sincroniza diariamente con el Banco Central de Nicaragua</p>
                    </div>
                    <Switch checked={exchangeRateAuto} onCheckedChange={setExchangeRateAuto} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/40">
                    <span className="text-xs font-bold text-muted-foreground">Tasa Actual del Sistema</span>
                    <span className="text-lg font-black text-primary">
                      {currentBackendRate ? `C$ ${currentBackendRate.toFixed(4)}` : '---'}
                    </span>
                  </div>
                </div>

                <AnimatePresence>
                  {!exchangeRateAuto && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tasa de Cambio Manual</Label>
                        <div className="flex gap-3">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">C$</span>
                            <Input value={manualRate} onChange={e => setManualRate(e.target.value)} type="number" step="0.01" className="pl-9 rounded-xl h-11 font-mono" />
                          </div>
                        </div>
                        <p className="text-[10px] text-amber-600 font-bold italic">* Esta tasa se aplicará a todas las conversiones manuales del sistema</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Moneda Base Contable</p>
                      <p className="text-sm font-bold">Córdoba Nicaragüense (NIO)</p>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black uppercase">Fijo</Badge>
                  </div>

                  <div className="p-4 rounded-xl border border-border/30 bg-background/70 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Permitir Cambio de Moneda</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Si se desactiva, nadie podrá cambiar `NIO/USD` desde la barra superior.
                        </p>
                      </div>
                      <Switch checked={allowCurrencySwitch} onCheckedChange={setAllowCurrencySwitch} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        {allowCurrencySwitch ? 'Moneda Global Inicial' : 'Moneda Bloqueada del Sistema'}
                      </Label>
                      <Select
                        value={displayCurrencySetting}
                        onValueChange={(val) => setDisplayCurrencySetting(val === 'USD' ? 'USD' : 'NIO')}
                      >
                        <SelectTrigger className="h-11 w-full rounded-xl border border-input bg-background px-3 text-xs font-black uppercase tracking-widest shadow-sm">
                          <SelectValue placeholder="Seleccionar moneda" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border/50 shadow-2xl">
                          <SelectItem value="NIO" className="font-black text-xs uppercase">NIO (Córdoba)</SelectItem>
                          <SelectItem value="USD" className="font-black text-xs uppercase">USD (Dólar)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button onClick={handleSaveCurrencySettings} disabled={isSavingCurrency} className="w-full rounded-xl gap-2 font-black h-11">
                    {isSavingCurrency ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Guardar Configuración
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><Info className="size-5 text-primary" />Información sobre Multimoneda</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-blue-500 font-black text-xs">1</div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <strong className="text-foreground">Base en Córdobas:</strong> Toda la contabilidad y reportes del sistema se calculan en base a NIO para cumplir con regulaciones locales.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-blue-500 font-black text-xs">2</div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <strong className="text-foreground">Soporte USD:</strong> Puedes emitir facturas, órdenes y pagos en Dólares. El sistema guardará el equivalente en Córdobas usando la tasa de cambio del momento.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 text-blue-500 font-black text-xs">3</div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <strong className="text-foreground">Modo Híbrido:</strong> Al usar el modo automático, el sistema consulta al BCN cada madrugada. Si prefieres control total, usa el modo manual.
                    </p>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <p className="text-[11px] text-amber-600 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                    <AlertCircle className="size-3" /> IMPORTANTE
                  </p>
                  <p className="text-[11px] leading-relaxed text-amber-700/80">
                    Cambiar la tasa de cambio manual no afectará transacciones ya realizadas. Las transacciones mantienen guardada la tasa con la que fueron creadas originalmente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ══════════ TAB: DOMINIOS ══════════ */}
        <TabsContent value="dominios" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50 shadow-sm mb-6">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><Globe className="size-5 text-primary" />Dominios Personalizados</CardTitle>
                <CardDescription>Accede a Nova Hub con tu propio dominio corporativo</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/15 rounded-xl">
                      <Rocket className="size-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-black text-base">Dominio Personalizado · Próximamente</p>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        Pronto podrás acceder al ERP con tu propia URL corporativa, por ejemplo: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">erp.tuempresa.com</code>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Subdominio Nova Hub (Activo)</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/20 border border-border/40">
                      <Globe className="size-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-mono text-sm">{user?.tenantId || 'empresa-demo'}.novahub.io</span>
                    </div>
                    <Button variant="outline" className="rounded-xl h-11 gap-2">
                      <Copy className="size-4" />Copiar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {[
                    { title: 'Subdominio Gratis', price: 'Incluido', desc: 'empresa.novahub.io', current: true, features: ['SSL automático', 'CDN global', 'Soporte técnico'] },
                    { title: 'Dominio Propio', price: '$29/mes', desc: 'erp.tuempresa.com', current: false, features: ['Tu dominio corporativo', 'SSL personalizado', 'Redirección automática', 'DNS configurado'] },
                    { title: 'White Label Total', price: 'Enterprise', desc: 'app.tuempresa.com', current: false, features: ['Sin mención a NovaHub', 'Branding completo', 'Email corporativo', 'Support dedicado'] },
                  ].map(({ title, price, desc, current, features }) => (
                    <div key={title} className={cn('relative p-5 rounded-2xl border transition-all',
                      current ? 'border-primary/40 bg-primary/5 shadow-lg' : 'border-border/50 hover:border-primary/20')}>
                      {current && <div className="absolute -top-2 left-4 px-3 py-0.5 bg-primary text-primary-foreground text-[10px] font-black rounded-full uppercase tracking-widest">Activo</div>}
                      <div className="mt-2">
                        <p className="font-black text-base">{title}</p>
                        <p className="text-2xl font-black text-primary mt-1">{price}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-1">{desc}</p>
                      </div>
                      <div className="space-y-2 mt-4">
                        {features.map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs">
                            <CheckCircle2 className="size-3.5 text-primary flex-shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                      <Button className="w-full mt-4 rounded-xl font-bold" variant={current ? 'outline' : 'default'} disabled={!current && price !== '$29/mes'}
                        onClick={() => current ? toast.info('Ya estás usando este plan') : toast.info('Próximamente disponible')}>
                        {current ? 'Plan Actual' : price === 'Enterprise' ? <><Rocket className="size-3.5 mr-1" />Contactar</> : <><ArrowRight className="size-3.5 mr-1" />Activar</>}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ══════════ TAB: PLATAFORMA (Super Admin only) ══════════ */}
        <TabsContent value="plataforma" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black">
                  <Crown className="size-5 text-violet-500" />
                  Control de Plataforma
                  <Badge className="bg-violet-500/10 text-violet-500 border-violet-500/20 text-[9px] font-black">SUPER ADMIN</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {[
                  { label: 'Modo Mantenimiento', desc: 'Bloquea el acceso de todos los tenants temporalmente', value: false },
                  { label: 'Logs de Acceso Global', desc: 'Registra todas las acciones de todos los tenants', value: true },
                  { label: 'Feature Flags Beta', desc: 'Habilita funcionalidades en fase beta para testing', value: false },
                  { label: 'Notificaciones de Sistema', desc: 'Muestra banners de mantenimiento a los usuarios', value: false },
                ].map(({ label, desc, value }) => (
                  <div key={label} className="flex items-center justify-between p-4 rounded-xl border border-violet-500/10 bg-violet-500/5 hover:bg-violet-500/10 transition-all">
                    <div className="flex-1 mr-4">
                      <Label className="font-bold text-sm">{label}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    <Switch defaultChecked={value} onCheckedChange={() => toast.success('Configuración actualizada')} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><BarChart3 className="size-5 text-violet-500" />Estadísticas Globales</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Total Tenants', value: '1', color: 'from-violet-500 to-purple-600' },
                    { label: 'Partners Activos', value: '1', color: 'from-blue-500 to-indigo-600' },
                    { label: 'Usuarios Totales', value: '6', color: 'from-emerald-500 to-teal-600' },
                    { label: 'Módulos Activos', value: '10', color: 'from-amber-500 to-orange-600' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`p-5 rounded-2xl bg-gradient-to-br ${color} text-white`}>
                      <p className="text-3xl font-black">{value}</p>
                      <p className="text-xs font-bold uppercase tracking-widest mt-1 opacity-80">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
