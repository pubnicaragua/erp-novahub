import React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Palette, RotateCcw, Save, Upload, Eye, Check, Sparkles,
  Package, DollarSign, ShieldCheck, Building2,
  Plus, Settings2, KeyRound,
  Crown, Lock, CheckCircle2, AlertCircle, Copy, RefreshCw,
  Trash2, Edit2, Shield,
  BarChart3, Info, Coins, TrendingUp, HandCoins, User as UserIcon,
  CalendarDays, Headphones, BellRing, FileText, Activity, Settings, MapPinned, ChevronDown,
  BookOpen, Landmark, Scale, GraduationCap, LifeBuoy, Utensils, Ship, Globe, MessageCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { useTheme, type BrandColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { NovaSuiteIcon } from './ui/NovaIcons';
import { useCurrency } from '../contexts/CurrencyContext';
import { rolesService } from '../services/roles.service';
import { subscriptionsService } from '../services/subscriptions.service';
import { brandingService, type ThemePaletteMode } from '../services/branding.service';
import { api } from '../services/api';
import { toast } from 'sonner';
import { cn } from './ui/utils';
import { type RoleManagement, type Permission } from '../types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from './ui/dialog';
import { PdfDocumentCustomizer } from './configuracion/PdfDocumentCustomizer';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useTenantQuery, asList } from '../hooks/useTenantQuery';
import { allowedModulesFromPermissions, hydratePermissionActions, permissionValue, PERMISSION_ACTION_DEFINITIONS, SENSITIVE_PERMISSION_ACTION_DEFINITIONS, serializePermissionActions, supportsInventoryCostPermission, supportsPermissionAction, type PermissionMatrixAction } from '../utils/permissions';
import {
  HIDDEN_PERMISSION_MODULE_IDS,
  LEGACY_VIEW_PERMISSION_ALIASES,
  SIDEBAR_PERMISSION_PARENT_ALIASES,
  SIDEBAR_PERMISSION_PARENT_ORDER,
} from '../utils/sidebarPermissions';
import { PERMISSION_SUBMODULES } from '../utils/sidebarPermissions';
import { getReadableForeground } from '../utils/color-contrast';
import { formatExchangeRate } from '../utils/currency';
import { optimizeImageFile } from '../utils/image-optimization';
import { FastColorInput } from './ui/FastColorInput';
import { AuditoriaPage } from './AuditoriaPage';
import { THEME_PRESETS, type ThemePreset } from '../constants/themePresets';
import { NovaPulseView } from './configuracion/NovaPulseView';

export const normalizePermissions = (perms: any): any[] => {
  if (Array.isArray(perms)) return perms;
  if (perms && typeof perms === 'object') {
    return Object.entries(perms).map(([module, vals]: [string, any]) => ({
      module,
      ...(typeof vals === 'object' ? vals : {}),
    }));
  }
  return [];
};

export type ExtendedPermission = Permission & { create?: boolean; edit?: boolean; };
export type ExtendedRoleManagement = Omit<RoleManagement, 'permissions'> & { permissions: ExtendedPermission[] };

const AVAILABLE_MODULES = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: BarChart3, description: 'Vista general con KPIs y resumen del negocio' },
  { id: 'FINANCING', label: 'Financiamiento PYME', icon: Landmark, description: 'Financiamiento y Créditos' },
  { id: 'SALES', label: 'Ventas', icon: TrendingUp, description: 'Cotizaciones, Facturación y Clientes' },
  { id: 'RESTAURANT', label: 'Restaurante POS', icon: Utensils, description: 'Salón, carta, cocina y comandas' },
  { id: 'TRACKING', label: 'Tracking de Importaciones', icon: Ship, description: 'Envíos de agencia por código de tracking' },
  { id: 'PURCHASES', label: 'Compras', icon: HandCoins, description: 'Proveedores y Órdenes de Compra' },
  { id: 'INVENTORY', label: 'Inventario de Mercancías', icon: Package, description: 'Stock, Almacenes y SKU' },
  { id: 'FINANCIAL', label: 'Finanzas', icon: DollarSign, description: 'Libro Mayor y Balance General' },
  { id: 'ACCOUNTING', label: 'Contabilidad', icon: BookOpen, description: 'Contabilidad General' },
  { id: 'HR', label: 'Recursos Humanos', icon: UserIcon, description: 'Nómina y Gestión de Empleados' },
  { id: 'ACTIVITIES', label: 'Actividades', icon: CalendarDays, description: 'Registro de Actividades' },
  { id: 'FORCE_SALES', label: 'Fuerza Comercial', icon: MapPinned, description: 'Prospección, rutas, visitas y seguimiento comercial' },
  { id: 'TICKETS', label: 'Gestión de tickets', icon: Headphones, description: 'Soporte y Atención' },
  { id: 'HR_TRAINING', label: 'Centro de Capacitación', icon: GraduationCap, description: 'Cursos y Capacitaciones' },
  { id: 'SUPPORT_TECH', label: 'Soporte Técnico', icon: LifeBuoy, description: 'Soporte Técnico Especializado' },
  { id: 'LEGAL', label: 'Asesoría Legal', icon: Scale, description: 'Asesoría y Casos Legales' },
  { id: 'NOVACHAT', label: 'Nova Suite', icon: NovaSuiteIcon, description: 'Bandeja multicanal y comunicación unificada' },
  { id: 'DOCUMENTS', label: 'Documentos', icon: FileText, description: 'Gestión Documental' },
  { id: 'NOTIFICATIONS', label: 'Notificaciones', icon: BellRing, description: 'Alertas del sistema' },
  { id: 'REPORTS', label: 'Reportes', icon: BarChart3, description: 'Informes y Análisis' },
  { id: 'MY_COMPANY', label: 'Mi Empresa', icon: Building2, description: 'Empresa, plan, equipo, roles, departamentos y dominio' },
  { id: 'CONFIGURATION', label: 'Configuración', icon: Settings, description: 'Ajustes del Sistema' },
];

// Submódulos para permisos ultra-granulares
export const LEGACY_SUBMODULES_FOR_PERMS = [
  // Ventas
  { id: 'SALES_CLIENTS', label: 'Clientes', parent: 'SALES' },
  { id: 'SALES_QUOTES', label: 'Cotizaciones', parent: 'SALES' },
  { id: 'SALES_ORDERS', label: 'Órdenes de Venta', parent: 'SALES' },
  { id: 'SALES_INVOICES', label: 'Facturas', parent: 'SALES' },
  { id: 'SALES_RECURRING', label: 'Facturas Recurrentes', parent: 'SALES' },
  { id: 'SALES_PAYMENTS', label: 'Pagos Recibidos', parent: 'SALES' },
  { id: 'SALES_RETURNS', label: 'Notas de Crédito', parent: 'SALES' },
  { id: 'SALES_CREDIT_NOTES', label: 'Créditos', parent: 'SALES' },
  { id: 'SALES_PRICE_LISTS', label: 'Listas de precios', parent: 'SALES' },
  { id: 'RETAIL_POS', label: 'Facturación por Caja', parent: 'SALES' },

  // Restaurante POS: las operaciones comparten la acción genérica Aprobar.
  { id: 'RESTAURANT_TABLES', label: 'Salón y mesas', parent: 'RESTAURANT' },
  { id: 'RESTAURANT_MENU', label: 'Carta', parent: 'RESTAURANT' },
  { id: 'RESTAURANT_KITCHEN', label: 'Comandas y cocina', parent: 'RESTAURANT' },
  { id: 'RESTAURANT_REPORTS', label: 'Reportes restaurante', parent: 'RESTAURANT' },

  // Compras
  { id: 'PURCHASES_PROVIDERS', label: 'Proveedores', parent: 'PURCHASES' },
  { id: 'PURCHASES_REQUESTS', label: 'Solicitudes de compra', parent: 'PURCHASES' },
  { id: 'PURCHASES_EXPENSES', label: 'Gastos', parent: 'PURCHASES' },
  { id: 'PURCHASES_EXPENSES_REC', label: 'Gastos Recurrentes', parent: 'PURCHASES' },
  { id: 'PURCHASES_ORDERS', label: 'Órdenes de Compra', parent: 'PURCHASES' },
  { id: 'PURCHASES_RECEIPTS', label: 'Recepciones de Compra', parent: 'PURCHASES' },
  { id: 'PURCHASES_INVOICES_REC', label: 'Compras Recurrentes', parent: 'PURCHASES' },
  { id: 'PURCHASES_PAYMENTS', label: 'Pagos Realizados', parent: 'PURCHASES' },
  { id: 'PURCHASES_RETURNS', label: 'Créditos del proveedor', parent: 'PURCHASES' },

  // Recursos Humanos
  { id: 'HR_DASHBOARD', label: 'Dashboard HR', parent: 'HR' },
  { id: 'HR_EMPLOYEES', label: 'Empleados', parent: 'HR' },
  { id: 'HR_PAYROLL', label: 'Nóminas', parent: 'HR' },
  { id: 'HR_COMMISSIONS', label: 'Comisiones', parent: 'HR' },
  { id: 'HR_ATTENDANCE', label: 'Asistencia', parent: 'HR' },
  { id: 'HR_LEAVES', label: 'Vacaciones', parent: 'HR' },
  { id: 'HR_PERFORMANCE', label: 'Desempeño', parent: 'HR' },
  { id: 'HR_TRAINING', label: 'Capacitación', parent: 'HR' },
  { id: 'HR_BENEFITS', label: 'Beneficios', parent: 'HR' },
  { id: 'HR_PAYROLL_CONFIG', label: 'Config Nómina', parent: 'HR' },

  // Finanzas
  { id: 'FINANCIAL_DASHBOARD', label: 'Dashboard', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_RECEIVABLES', label: 'Cuentas por Cobrar', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_PAYABLES', label: 'Cuentas por Pagar', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_INCOMES', label: 'Ingresos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_EXPENSES', label: 'Gastos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_EXPENSES_REC', label: 'Gastos Recurrentes', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_INCOMES_REC', label: 'Ingresos Recurrentes', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_BALANCE', label: 'Balance General', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_ACCOUNTS', label: 'Cuentas financieras', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_JOURNAL', label: 'Diario financiero', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_LEDGER', label: 'Libro mayor financiero', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_BANK', label: 'Bancos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_BUDGET', label: 'Presupuestos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_REPORTS', label: 'Reportes financieros', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_CALENDAR', label: 'Calendario Financiero', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_ANALYSIS', label: 'Análisis de ingresos y gastos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_LOSSES', label: 'Pérdidas', parent: 'FINANCIAL' },

  // Inventario
  { id: 'INVENTORY_PRODUCTS', label: 'Productos', parent: 'INVENTORY' },
  { id: 'INVENTORY_SERVICES', label: 'Servicios', parent: 'INVENTORY' },
  { id: 'INVENTORY_ATTRIBUTES', label: 'Atributos y categorías', parent: 'INVENTORY' },
  { id: 'INVENTORY_WAREHOUSES', label: 'Almacenes', parent: 'INVENTORY' },
  { id: 'INVENTORY_TRANSFERS', label: 'Transferencias', parent: 'INVENTORY' },
  { id: 'INVENTORY_ADJUSTMENTS', label: 'Ajustes', parent: 'INVENTORY' },
  { id: 'INVENTORY_MOVEMENTS', label: 'Movimientos', parent: 'INVENTORY' },
  { id: 'INVENTORY_AUDITS', label: 'Auditorías', parent: 'INVENTORY' },
  { id: 'INVENTORY_LOSSES', label: 'Pérdidas', parent: 'INVENTORY' },
  { id: 'INVENTORY_ASSETS', label: 'Mobiliario y equipos', parent: 'INVENTORY' },
  { id: 'INVENTORY_CONFIG', label: 'Configuración de inventario', parent: 'INVENTORY' },

  // Asesoría legal
  { id: 'LEGAL_CASES', label: 'Casos legales', parent: 'LEGAL' },
  { id: 'LEGAL_REMINDERS', label: 'Recordatorios legales', parent: 'LEGAL' },

  // Actividades
  { id: 'ACTIVITIES_TASKS', label: 'Tareas', parent: 'ACTIVITIES' },
  { id: 'ACTIVITIES_EVENTS', label: 'Eventos', parent: 'ACTIVITIES' },
  { id: 'ACTIVITIES_REMINDERS', label: 'Recordatorios', parent: 'ACTIVITIES' },
  { id: 'ACTIVITIES_LOGS', label: 'Bitácora', parent: 'ACTIVITIES' },
  { id: 'ACTIVITIES_CALENDAR', label: 'Calendario', parent: 'ACTIVITIES' },
  { id: 'ACTIVITIES_MEETINGS', label: 'Reuniones', parent: 'ACTIVITIES' },

  // Documentos
  { id: 'DOCUMENTS_FILES', label: 'Archivos', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_CONTRACTS', label: 'Contratos', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_INVOICES', label: 'Facturas Legales', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_REPORTS', label: 'Reportes', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_FOLDERS', label: 'Carpetas', parent: 'DOCUMENTS' },

  // Notificaciones
  { id: 'NOTIFICATIONS_ALERTS', label: 'Alertas', parent: 'NOTIFICATIONS' },
  { id: 'NOTIFICATIONS_MESSAGES', label: 'Mensajes', parent: 'NOTIFICATIONS' },
  { id: 'NOTIFICATIONS_PUSH', label: 'Push', parent: 'NOTIFICATIONS' },

  // Gestión de tickets
  { id: 'TICKETS_VIEW', label: 'Tickets', parent: 'TICKETS' },

  // Tickets y soporte
  { id: 'TICKETS_KNOWLEDGE_BASE', label: 'Base de conocimiento', parent: 'TICKETS' },
  { id: 'TICKETS_AGENTS', label: 'Agentes', parent: 'TICKETS' },

  // Reportes
  { id: 'REPORTS_SALES', label: 'Ventas', parent: 'REPORTS' },
  { id: 'REPORTS_PURCHASES', label: 'Compras', parent: 'REPORTS' },
  { id: 'REPORTS_FINANCIAL', label: 'Financiero', parent: 'REPORTS' },
  { id: 'REPORTS_INVENTORY', label: 'Inventario de Mercancías', parent: 'REPORTS' },
  { id: 'REPORTS_CLIENTS', label: 'Clientes', parent: 'REPORTS' },
  { id: 'REPORTS_PROVIDERS', label: 'Proveedores', parent: 'REPORTS' },
  { id: 'REPORTS_HR', label: 'Recursos Humanos', parent: 'REPORTS' },
  
  // Mi Empresa
  { id: 'CONFIG_COMPANY', label: 'Datos generales', parent: 'MY_COMPANY' },
  { id: 'SUBSCRIPTIONS', label: 'Módulos y Plan', parent: 'MY_COMPANY' },
  { id: 'CONFIG_USERS', label: 'Mi Equipo', parent: 'MY_COMPANY' },
  { id: 'CONFIG_ROLES', label: 'Roles y permisos', parent: 'MY_COMPANY' },
  { id: 'CONFIG_DEPARTMENTS', label: 'Departamentos', parent: 'MY_COMPANY' },
  { id: 'CONFIG_DOMAINS', label: 'Dominio propio', parent: 'MY_COMPANY' },

  // Configuración
  { id: 'CONFIG_BRANDING', label: 'Marca y Tema', parent: 'CONFIGURATION' },
  { id: 'CONFIG_SECURITY', label: 'Seguridad', parent: 'CONFIGURATION' },
  { id: 'CONFIG_CURRENCY', label: 'Moneda y cambio', parent: 'CONFIGURATION' },
  { id: 'CONFIG_PDF', label: 'Documentos PDF', parent: 'CONFIGURATION' },

  // Contabilidad
  { id: 'ACCOUNTING_CHART', label: 'Plan de Cuentas', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_JOURNAL', label: 'Libro Diario', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_HR_PAYMENT_REQUESTS', label: 'Solicitudes de pago RR. HH.', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_TRIAL_BALANCE', label: 'Balance de Comprobación', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_PROFIT_LOSS', label: 'Estado de Resultados', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_BALANCE_SHEET', label: 'Balance General', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_CASH_FLOW', label: 'Flujo de Efectivo', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_RECONCILIATION', label: 'Conciliación Bancaria', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_PERIODS', label: 'Períodos Contables', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_FISCAL', label: 'Reportes Fiscales', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_LEDGER', label: 'Libro Mayor', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_EXCHANGE_DIFFERENCES', label: 'Diferencias Cambiarias', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_EQUITY', label: 'Cambios Patrimonio', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_ASSETS', label: 'Activos Fijos', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_BUDGET', label: 'Presupuestos', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_EXPENSE_CATEGORIES', label: 'Categorías de gastos', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_CONFIG', label: 'Configuración contable', parent: 'ACCOUNTING' },
];

// El editor de roles usa el mismo registro que el sidebar. Se conserva el
// arreglo histórico anterior arriba solo para compatibilidad con datos viejos.
export const SUBMODULES_FOR_PERMS = PERMISSION_SUBMODULES.map((item) => ({ ...item }));

// Fusionar para la lista de permisos anidando los submódulos justo debajo de
// sus padres. El orden de los padres sale del sidebar, no de un catálogo
// histórico de configuración.
const AVAILABLE_MODULES_BY_ID = new Map(AVAILABLE_MODULES.map((module) => [module.id, module]));
export const ALL_PERM_MODULES = SIDEBAR_PERMISSION_PARENT_ORDER.flatMap((moduleId) => {
  const mod = AVAILABLE_MODULES_BY_ID.get(moduleId);
  if (!mod) return [];
  return [
    mod,
    ...SUBMODULES_FOR_PERMS
      .filter(sub => sub.parent === mod.id)
      .map(s => ({ ...s, icon: Activity, description: `Vista de ${mod.label}` })),
  ];
});

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
const colorPresets: ThemePreset[] = THEME_PRESETS;

function generateThemeFromColor(hex: string, sidebarHex: string, accentHex: string): BrandColors {
  // Mantener el hex elegido por el usuario evita que una conversión a OKLCH
  // y su posterior aproximación cambien el color después de recargar.
  const primary = normalizeHexColor(hex, '#10b981');
  const sidebar = normalizeHexColor(sidebarHex, '#0c1a12');
  const accent = normalizeHexColor(accentHex, '#064e3b');

  return {
    primary,
    primaryForeground: getReadableForeground(primary),
    accent,
    accentForeground: getReadableForeground(accent),
    sidebar,
    sidebarForeground: getReadableForeground(sidebar),
    sidebarPrimary: primary,
    sidebarAccent: accent,
  };
}

function normalizeHexColor(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

function hexWithAlpha(value: string, alpha: string): string {
  const hex = normalizeHexColor(value, '#000000');
  return `${hex}${alpha}`;
}

// ---- Color Picker Component ----
interface ColorFieldProps {
  label: string;
  description: string;
  hexValue: string;
  onHexChange: (hex: string) => void;
  displayColor?: string;
  displayValue?: string;
  readOnly?: boolean;
}

function ColorField({ label, description, hexValue, onHexChange, displayColor, displayValue, readOnly = false }: ColorFieldProps) {
  const validHex = /^#[0-9a-fA-F]{6}$/.test(hexValue) ? hexValue : '#000000';
  const [draftHex, setDraftHex] = useState(hexValue);

  useEffect(() => {
    setDraftHex(hexValue);
  }, [hexValue]);

  return (
    <div className={cn('flex items-center gap-4 rounded-lg border border-border/50 p-3 transition-colors', readOnly ? 'bg-muted/10' : 'hover:bg-muted/20')}>
      <label className={cn('relative block size-10 shrink-0', readOnly ? 'cursor-default' : 'cursor-pointer')} title={readOnly ? `${label} definido por el modo detalles` : `Elegir ${label.toLowerCase()}`}>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg border-2 border-border shadow-sm transition-transform hover:scale-105"
          style={{ backgroundColor: displayColor || validHex }}
        />
        <FastColorInput
          value={validHex}
          onChange={value => onHexChange(value)}
          disabled={readOnly}
          aria-label={`Elegir ${label.toLowerCase()}`}
          className={cn('absolute inset-0 z-10 size-full opacity-0', !readOnly && 'cursor-pointer')}
        />
      </label>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Input
        value={displayValue || draftHex}
        disabled={readOnly}
        onChange={e => {
          if (readOnly) return;
          const next = e.target.value;
          if (/^#[0-9a-fA-F]{0,6}$/.test(next)) {
            setDraftHex(next);
            if (/^#[0-9a-fA-F]{6}$/.test(next)) onHexChange(next);
          }
        }}
        onBlur={() => {
          if (!/^#[0-9a-fA-F]{6}$/.test(draftHex)) {
            setDraftHex(validHex);
            onHexChange(validHex);
          }
        }}
        aria-label={`Código hexadecimal de ${label.toLowerCase()}`}
        className="w-28 font-mono text-xs"
      />
    </div>
  );
}

interface SidebarPreviewProps {
  companyName: string;
  logo?: string | null;
  primaryHex: string;
  primaryForeground: string;
  paletteMode: ThemePaletteMode;
  sidebarHex: string;
  sidebarForeground: string;
  sidebarAccentHex: string;
  sidebarAccentForeground: string;
}

function SidebarPreview({
  companyName,
  logo,
  primaryHex,
  primaryForeground,
  paletteMode,
  sidebarHex,
  sidebarForeground,
  sidebarAccentHex,
  sidebarAccentForeground,
}: SidebarPreviewProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isComplete = paletteMode === 'complete';
  const previewSidebarBackground = isComplete ? sidebarHex : 'var(--sidebar-neutral)';
  const previewSidebarForeground = isComplete ? sidebarForeground : 'var(--sidebar-neutral-foreground)';
  const previewSidebarAccent = isComplete ? sidebarAccentHex : 'var(--sidebar-neutral-accent)';
  const previewSidebarAccentForeground = isComplete ? sidebarAccentForeground : 'var(--sidebar-neutral-accent-foreground)';
  const borderColor = isComplete ? hexWithAlpha(sidebarForeground, '35') : 'var(--sidebar-neutral-border)';
  const mutedForeground = isComplete
    ? hexWithAlpha(sidebarForeground, 'a6')
    : 'color-mix(in srgb, var(--sidebar-neutral-foreground) 65%, transparent)';
  const previewItems = [
    { label: 'Dashboard', icon: BarChart3 },
    { label: 'Ventas', icon: TrendingUp },
    { label: 'Compras', icon: HandCoins },
    { label: 'Inventario', icon: Package },
    { label: 'Configuración', icon: Settings2 },
  ];

  return (
    <Card className="overflow-hidden border-border/50 shadow-sm">
      <CardHeader className="border-b border-border/30 bg-muted/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg font-black">
              <Eye className="size-5 text-primary" />Previsualización del Sidebar
            </CardTitle>
            <CardDescription>
              {isComplete
                ? 'Así se verá el menú con la tonalidad completa de la paleta.'
                : 'Así se verá el menú con el sidebar neutral y los colores internos de la paleta.'}
            </CardDescription>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(value => !value)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Mostrar sidebar expandido' : 'Mostrar sidebar contraído'}
          >
            {collapsed ? 'Expandir' : 'Contraer'}
            <ChevronDown className={cn('size-3.5 transition-transform', collapsed && '-rotate-90')} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex min-h-[310px] overflow-hidden rounded-2xl border border-border/60 bg-muted/20 shadow-inner">
          <aside
            className={cn('flex shrink-0 flex-col transition-[width] duration-300', collapsed ? 'w-[68px]' : 'w-[208px]')}
            style={{ backgroundColor: previewSidebarBackground, color: previewSidebarForeground }}
            aria-label="Previsualización del menú lateral"
          >
            <div className="flex min-h-16 items-center gap-2 border-b px-3" style={{ borderColor }}>
              {logo ? (
                <img src={logo} alt="Logo de la empresa" className="size-8 shrink-0 rounded-lg object-contain" />
              ) : (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-black" style={{ backgroundColor: primaryHex, color: primaryForeground }}>
                  {(companyName || 'N').trim().charAt(0).toUpperCase()}
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0 leading-none">
                  <p className="truncate text-xs font-black">{companyName || 'Mi Empresa'}</p>
                  <p className="mt-1 truncate text-[9px] uppercase tracking-widest" style={{ color: mutedForeground }}>NovaHub ERP</p>
                </div>
              )}
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-hidden p-2" aria-label="Elementos de ejemplo del sidebar">
              <p className={cn('px-2 pb-1 pt-2 text-[9px] font-black uppercase tracking-[0.18em]', collapsed && 'text-center')} style={{ color: mutedForeground }}>
                {collapsed ? '•••' : 'Operaciones'}
              </p>
              {previewItems.map(({ label, icon: Icon }, index) => (
                <div
                  key={label}
                  className={cn('flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-semibold', collapsed && 'justify-center px-0')}
                  style={index === 0
                    ? { backgroundColor: primaryHex, color: primaryForeground }
                    : { color: mutedForeground }}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </div>
              ))}
            </nav>

            <div className="border-t p-2" style={{ borderColor }}>
              <div className={cn('flex items-center gap-2 rounded-lg p-2', collapsed && 'justify-center')} style={{ backgroundColor: previewSidebarAccent, color: previewSidebarAccentForeground }}>
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black" style={{ backgroundColor: primaryHex, color: primaryForeground }}>R</div>
                {!collapsed && <span className="truncate text-[10px] font-bold">Usuario activo</span>}
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="h-2.5 w-28 rounded-full bg-foreground/10" />
                <div className="h-2 w-40 max-w-full rounded-full bg-foreground/5" />
              </div>
              <div className="size-8 shrink-0 rounded-lg" style={{ backgroundColor: primaryHex }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[primaryHex, sidebarAccentHex, sidebarHex, primaryHex].map((color, index) => (
                <div key={`${color}-${index}`} className="h-16 rounded-xl border border-border/40 bg-background/80 p-2">
                  <div className="h-2 w-2/3 rounded-full" style={{ backgroundColor: color }} />
                  <div className="mt-3 h-2 w-1/2 rounded-full bg-foreground/10" />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-lg px-2.5 py-1.5 text-[10px] font-black" style={{ backgroundColor: primaryHex, color: primaryForeground }}>Activo</span>
              <span className="rounded-lg px-2.5 py-1.5 text-[10px] font-black" style={{ backgroundColor: sidebarAccentHex, color: sidebarAccentForeground }}>Acento</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-bold text-muted-foreground">
          <span className="rounded-full border border-border/60 px-2.5 py-1">Fondo: {isComplete ? sidebarHex : 'Neutral'}</span>
          <span className="rounded-full border border-border/60 px-2.5 py-1">Primario: {primaryHex}</span>
          <span className="rounded-full border border-border/60 px-2.5 py-1">Acento: {sidebarAccentHex}</span>
        </div>
      </CardContent>
    </Card>
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
  { id: 'documentos-pdf', label: 'Documentos PDF', icon: FileText, scenario: ['superadmin', 'partner', 'client'] },
  { id: 'seguridad', label: 'Seguridad', icon: KeyRound, scenario: ['superadmin', 'partner', 'client'] },
  { id: 'auditoria', label: 'Logs y auditoría', icon: Activity, scenario: ['superadmin', 'partner', 'client'] },
  { id: 'currency', label: 'Moneda & Cambio', icon: Coins, scenario: ['superadmin', 'partner', 'client'] },
  { id: 'nova-pulse', label: 'Nova Pulse', icon: MessageCircle, scenario: ['superadmin', 'partner', 'client'] },
];

const CONFIG_TAB_PERMISSIONS: Record<string, string> = {
  branding: 'CONFIG_BRANDING',
  'documentos-pdf': 'CONFIG_PDF',
  seguridad: 'CONFIG_SECURITY',
  auditoria: 'AUDIT_LOGS',
  currency: 'CONFIG_CURRENCY',
  'nova-pulse': 'CONFIG_NOVA_PULSE',
};

export function ConfiguracionPage({ initialTab = 'branding' }: { initialTab?: string }) {
  const { themeConfig, updateTheme, updateConfig, resetTheme } = useTheme();
  const { user, userBranches, canPerform } = useAuth();
  const { refreshRate: refreshCurrencyContext } = useCurrency();
  const scenario = getScenario(user?.role);
  const visibleTabs = ALL_TABS.filter(t => {
    if (!t.scenario.includes(scenario)) return false;
    if (t.id === 'branding' && user?.isPlatformAdmin) return false;
    const permissionModule = CONFIG_TAB_PERMISSIONS[t.id];
    return !permissionModule || canPerform(permissionModule, 'view');
  });
  const canViewRoles = canPerform('CONFIG_ROLES', 'view');
  const canCreateRoles = canPerform('CONFIG_ROLES', 'create');
  const canEditRoles = canPerform('CONFIG_ROLES', 'edit');
  const canDeleteRoles = canPerform('CONFIG_ROLES', 'delete');
  const canViewCompany = canPerform('CONFIG_COMPANY', 'view');
  const canViewBranding = canPerform('CONFIG_BRANDING', 'view');
  const canViewCurrency = canPerform('CONFIG_CURRENCY', 'view');
  const canEditCompany = canPerform('CONFIG_COMPANY', 'edit');
  const canCreateCompany = canPerform('CONFIG_COMPANY', 'create');
  const canDeactivateCompany = canPerform('CONFIG_COMPANY', 'deactivate');
  const canEditBranding = canPerform('CONFIG_BRANDING', 'edit');
  const canEditSecurity = canPerform('CONFIG_SECURITY', 'edit');
  const canEditCurrency = canPerform('CONFIG_CURRENCY', 'edit');
  const canEditPdf = canPerform('CONFIG_PDF', 'edit');
  const canCreatePdf = canPerform('CONFIG_PDF', 'create');
  const canDeletePdf = canPerform('CONFIG_PDF', 'delete');
  const canEditNovaPulse = canPerform('CONFIG_NOVA_PULSE', 'edit');
  const canSendNovaPulse = canPerform('CONFIG_NOVA_PULSE', 'send');

  // La API de suscripciones devuelve el alcance efectivo de la sucursal
  // (grupo + unidad). Mientras carga, usamos el alcance de la sesión para no
  // dejar la matriz vacía y luego sustituimos la lista por la respuesta
  // autoritativa del backend.
  const [enabledModules, setEnabledModules] = useState<string[]>(() => user?.enabledModules || []);
  const [enabledModulesLoaded, setEnabledModulesLoaded] = useState(false);

  useEffect(() => {
    setEnabledModules(user?.enabledModules || []);
    setEnabledModulesLoaded(false);
  }, [user?.tenantId]);

  const tenantPermModules = React.useMemo(() => {
    if (!user) return [];
    const normalize = (value: unknown) => String(value || '').trim().toUpperCase();
    const sessionModules = (enabledModulesLoaded ? enabledModules : user.enabledModules)
      .map(normalize)
      .filter(Boolean);
    const enabled = new Set(sessionModules);
    const hasSalesScope = enabled.has('SALES') || sessionModules.some((candidate) => candidate.startsWith('SALES_'));
    const hasParentScope = (moduleId: string) => enabled.has(moduleId)
      || sessionModules.some((candidate) => candidate.startsWith(`${moduleId}_`));

    return ALL_PERM_MODULES
      .filter(m => !HIDDEN_PERMISSION_MODULE_IDS.has(String(m.id).toUpperCase()))
      .filter(m => {
        const moduleId = normalize(m.id);
        const parentMod = 'parent' in m ? normalize((m as any).parent) : null;
        const directAliases = [
          ...(SIDEBAR_PERMISSION_PARENT_ALIASES[moduleId] || []),
          ...(LEGACY_VIEW_PERMISSION_ALIASES[moduleId] || []),
        ];
        const hasDirectAccess = enabled.has(moduleId)
          || directAliases.some((alias) => enabled.has(normalize(alias)))
          || (['RETAIL_POS', 'RETAIL_CASH_CONTROL'].includes(moduleId) && hasSalesScope);

        // Dashboard y los permisos administrativos internos pertenecen a la
        // sucursal aunque no tengan una fila de suscripción operativa.
        if (moduleId === 'DASHBOARD') return true;
        if (parentMod === 'CONFIGURATION' && (
          user.isTenantAdmin
          || enabled.has('CONFIGURATION')
        )) return true;
        if (parentMod === 'MY_COMPANY' && (
          enabled.has('MY_COMPANY')
          || user.isTenantAdmin
        )) return true;

        // Las vistas marcadas como internas comparten el alcance del módulo
        // padre; no son módulos facturables independientes.
        if (parentMod && (m as any).subscription === false && hasParentScope(parentMod)) return true;
        if (hasDirectAccess) return true;
        if (parentMod && enabled.has(parentMod)) return true;

        // Un padre se conserva cuando la sucursal recibió solo una o varias
        // vistas hijas. Los hermanos que no están en el alcance no entran.
        return !parentMod && sessionModules.some((candidate) => candidate.startsWith(`${moduleId}_`));
      });
  }, [enabledModules, enabledModulesLoaded, user]);

  const tenantPermModuleIds = React.useMemo(
    () => new Set(tenantPermModules.map((module) => String(module.id).toUpperCase())),
    [tenantPermModules],
  );

  const isPermissionActionAvailable = (moduleId: string, action: PermissionMatrixAction) => action === 'viewCost'
    ? supportsInventoryCostPermission(moduleId)
    : supportsPermissionAction(moduleId, action);

  // Hex state for the color pickers
  const [primaryHex, setPrimaryHex] = useState(() => oklchToApproxHex(themeConfig.colors.primary));
  const [sidebarHex, setSidebarHex] = useState(() => oklchToApproxHex(themeConfig.colors.sidebar));
  const [accentHex, setAccentHex] = useState(() => oklchToApproxHex(themeConfig.colors.accent));
  const [sidebarFgHex, setSidebarFgHex] = useState(() => oklchToApproxHex(themeConfig.colors.sidebarForeground));
  const [primaryFgHex, setPrimaryFgHex] = useState(() => oklchToApproxHex(themeConfig.colors.primaryForeground));
  const [portalPrimaryHex, setPortalPrimaryHex] = useState('#10b981');
  const [portalAccentHex, setPortalAccentHex] = useState('#0f172a');
  const [portalTextHex, setPortalTextHex] = useState('#f8fafc');
  const [paletteMode, setPaletteMode] = useState<ThemePaletteMode>(() => themeConfig.paletteMode);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('OTHER');
  const [industryOptions, setIndustryOptions] = useState<{ id?: string; code: string; name: string; isDefault: boolean }[]>([]);
  const [newIndustryName, setNewIndustryName] = useState('');
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const themeDraftDirtyRef = useRef(false);
  const [showAddIndustry, setShowAddIndustry] = useState(false);
  const resolvedInitialTab = visibleTabs.find(tab => tab.id === initialTab)?.id || visibleTabs[0]?.id || 'auditoria';
  const [activeTab, setActiveTab] = useState(resolvedInitialTab);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveTab(resolvedInitialTab);
  }, [resolvedInitialTab]);

  // Security state
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('480');
  const [ipWhitelist, setIpWhitelist] = useState('');
  const [singleSession, setSingleSession] = useState(true);

  const canViewSecuritySettings = canPerform('CONFIG_SECURITY', 'view');

  useEffect(() => {
    if (!canViewSecuritySettings) return;
    let active = true;
    api.get<any>('/tools/security-settings')
      .then((res: any) => {
        if (!active) return;
        const data = res?.data || res;
        if (typeof data?.singleSession === 'boolean') setSingleSession(data.singleSession);
        if (data?.sessionTimeoutMinutes) setSessionTimeout(String(data.sessionTimeoutMinutes));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [canViewSecuritySettings]);

  const handleToggleSingleSession = (value: boolean) => {
    setSingleSession(value);
    api.patch('/tools/security-settings', { singleSession: value })
      .then(() => toast.success(value ? 'Sesión única por dispositivo activada' : 'Sesión única por dispositivo desactivada'))
      .catch(() => { setSingleSession(!value); toast.error('No se pudo actualizar la configuración de sesión'); });
  };

  const handleSaveSessionTimeout = () => {
    api.patch('/tools/security-settings', { sessionTimeoutMinutes: Number(sessionTimeout) })
      .then(() => toast.success('Tiempo de expiración de sesión guardado'))
      .catch(() => toast.error('No se pudo guardar el tiempo de sesión'));
  };

  // Currency & Exchange Rate state
  const [exchangeRateAuto, setExchangeRateAuto] = useState(true);
  const [manualRate, setManualRate] = useState('36.50');
  const [currentBackendRate, setCurrentBackendRate] = useState<number | null>(null);
  const [baseCurrencySetting, setBaseCurrencySetting] = useState<'NIO' | 'USD'>('NIO');
  const [displayCurrencySetting, setDisplayCurrencySetting] = useState<'NIO' | 'USD'>('NIO');
  const [allowCurrencySwitch, setAllowCurrencySwitch] = useState(true);
  const [isSavingCurrency, setIsSavingCurrency] = useState(false);

  // New role dialog state (removed unused)

  const fetchIndustries = async () => {
    try {
      await refetchConfiguration();
    } catch (error) {
      console.error('Error fetching industries:', error);
    }
  };

  const handleAddIndustry = async () => {
    if (!canCreateCompany || !newIndustryName.trim() || !user?.tenantId) return;
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
    if (!canDeactivateCompany || !user?.tenantId) return;
    try {
      await api.delete(`/tenants/${user.tenantId}/industries/${id}`);
      toast.success('Industria eliminada');
      await fetchIndustries();
    } catch (error) {
      toast.error('Error al eliminar industria');
    }
  };

  const handleSaveCompanyInfo = async () => {
    if (!canEditCompany) return;
    try {
      updateConfig({ tenantName: companyName });
      await brandingService.update({
        companyName,
        industry: companyIndustry,
      });
      await refetchConfiguration();
      toast.success('Información corporativa guardada');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al guardar la información');
    }
  };

  const applyPreset = useCallback((preset: ThemePreset) => {
    setPrimaryHex(preset.primary);
    setSidebarHex(preset.sidebar);
    setAccentHex(preset.accent);

    setPrimaryFgHex(getReadableForeground(preset.primary));
    setSidebarFgHex(getReadableForeground(preset.sidebar));
    setActivePreset(preset.name);
    themeDraftDirtyRef.current = true;
  }, []);

  const selectPaletteMode = (mode: ThemePaletteMode) => {
    setPaletteMode(mode);
    themeDraftDirtyRef.current = true;
  };

  const handleSave = async () => {
    if (!canEditBranding || isSavingTheme) return;
    setIsSavingTheme(true);
    try {
      const colors = generateThemeFromColor(primaryHex, sidebarHex, accentHex);
      // El color manual debe conservarse tal como lo eligió el usuario. La
      // accesibilidad se puede advertir en la interfaz, pero no debe cambiar
      // silenciosamente el valor que se está guardando.
      const selectedPrimaryFgHex = normalizeHexColor(primaryFgHex, getReadableForeground(colors.primary));
      const selectedSidebarFgHex = normalizeHexColor(sidebarFgHex, getReadableForeground(colors.sidebar));
      setPrimaryFgHex(selectedPrimaryFgHex);
      setSidebarFgHex(selectedSidebarFgHex);
      colors.primaryForeground = selectedPrimaryFgHex;
      colors.sidebarForeground = selectedSidebarFgHex;

      await brandingService.update({
        userTheme: { paletteMode, colors },
      });
      updateTheme(colors, paletteMode);
      themeDraftDirtyRef.current = false;
      await refetchConfiguration();

      toast.success('Tema actualizado correctamente', {
        description: `Los cambios se guardaron para ${user?.name || user?.email || 'este usuario'}`,
      });
    } catch (error) {
      console.error('Error saving theme:', error);
      toast.error('Error al guardar el tema en el servidor');
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleReset = async () => {
    if (!canEditBranding) return;
    resetTheme();
    setPrimaryHex('#10b981');
    setSidebarHex('#0c1a12');
    setAccentHex('#064e3b');
    setPaletteMode('details');
    setPrimaryFgHex(getReadableForeground('#10b981'));
    setSidebarFgHex(getReadableForeground('#0c1a12'));
    setActivePreset('Esmeralda');
    try {
      await brandingService.update({ userTheme: null });
      themeDraftDirtyRef.current = false;
      await refetchConfiguration();
      toast.info('Tema personal restaurado al predeterminado');
    } catch (error) {
      console.error('Error resetting theme:', error);
      toast.error('No se pudo restablecer el tema personal');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEditBranding) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const inferredMime = extension === 'jpg' || extension === 'jpeg'
      ? 'image/jpeg'
      : extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : extension === 'gif'
            ? 'image/gif'
            : extension === 'avif'
              ? 'image/avif'
              : file.type;
    const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
    if (!allowedMimeTypes.has(inferredMime)) {
      toast.error('Usa un logo PNG, JPG, WEBP, GIF o AVIF');
      return;
    }
    e.currentTarget.value = '';
    try {
      const normalizedFile = file.type === inferredMime
        ? file
        : new File([file], file.name, { type: inferredMime });
      const optimizedFile = await optimizeImageFile(normalizedFile, {
        maxOutputBytes: 1.5 * 1024 * 1024,
        maxDimension: 1600,
      });
      setLogoFile(optimizedFile);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(optimizedFile);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo optimizar el logo');
    }
  };

  const handleLogoSave = async () => {
    if (!canEditBranding || !logoFile) return;
    setLogoUploading(true);
    try {
      if (!user?.tenantId) throw new Error('No hay una sucursal activa para guardar el logo');
      const logoUrl = await uploadLogoToStorage(logoFile, user.tenantId);
      updateConfig({ logo: logoUrl });
      await brandingService.update({ logo: logoUrl });
      await refetchConfiguration();
      toast.success('Logo guardado en Supabase Storage ✓');
    } catch (error) {
      console.error('Logo upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Error al subir el logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const [roles, setRoles] = useState<RoleManagement[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [pendingDeleteRole, setPendingDeleteRole] = useState<RoleManagement | null>(null);

  const fetchRoles = async () => {
    setIsLoadingRoles(true);
    try {
      await refetchConfiguration();
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const handleSaveCurrencySettings = async () => {
    if (!canEditCurrency) return;
    setIsSavingCurrency(true);
    try {
      const resp = await api.post<{
        rate: number;
        auto: boolean;
        baseCurrency?: 'NIO' | 'USD';
        displayCurrency?: 'NIO' | 'USD';
        allowCurrencySwitch?: boolean;
      }>('/tools/exchange-rate', {
        auto: exchangeRateAuto,
        rate: exchangeRateAuto ? undefined : parseFloat(manualRate),
        baseCurrency: baseCurrencySetting,
        displayCurrency: displayCurrencySetting,
        allowCurrencySwitch,
      });
      if (resp) {
      setCurrentBackendRate(resp.rate);
        setBaseCurrencySetting(resp.baseCurrency === 'USD' ? 'USD' : 'NIO');
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

  // @ts-ignore
  const handleToggleModule = async (moduleId: string) => {
    toast.info('La gestión de módulos se realiza desde la pestaña de Suscripciones para garantizar el registro de auditoría.');
  };

  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Partial<ExtendedRoleManagement> | null>(null);

  const { data: configurationData, refetch: refetchConfiguration } = useTenantQuery(
    ['configuration', user?.tenantId || 'current', scenario, canViewRoles, canViewCompany, canViewBranding, canViewCurrency],
    async (signal) => {
      const tenantId = user?.tenantId;
      const [branding, currency, industries, rolesData, modules] = await Promise.all([
        canViewBranding || canViewCompany ? brandingService.getCurrent(signal) : Promise.resolve(null),
        canViewCurrency ? api.get<any>('/tools/exchange-rate', { signal }) : Promise.resolve(null),
        tenantId && canViewCompany ? api.get<any>(`/tenants/${tenantId}/industries`, { signal }) : Promise.resolve([]),
        // Los roles se administran exclusivamente desde Mi Empresa > Mi Equipo.
        Promise.resolve([]),
        // La matriz de roles necesita el alcance completo de la sucursal,
        // aunque quien administra roles no tenga permiso para editar el plan.
        // El endpoint solo permite consultar el tenant propio.
        tenantId && (user?.isTenantAdmin || canViewRoles)
          ? subscriptionsService.getEnabledModules(tenantId, undefined, signal)
          : Promise.resolve(user?.enabledModules || []),
      ]);
      return { branding, currency, industries, roles: rolesData, modules };
    },
    { enabled: Boolean(user), onError: (error) => toast.error(error.message || 'Error cargando configuración') },
  );

  useEffect(() => {
    if (!configurationData) return;
    const branding = configurationData.branding as any;
    const currency = configurationData.currency as any;
    const industries = asList(configurationData.industries);
    const rolesList = asList(configurationData.roles);
    const modulesList = asList(configurationData.modules);

    const userThemeColors = branding?.userTheme?.colors || {};
    const resolvedPaletteMode: ThemePaletteMode = branding?.userTheme?.paletteMode === 'complete'
      ? 'complete'
      : branding?.userTheme?.paletteMode === 'details'
        ? 'details'
        : themeConfig.paletteMode;
    const resolvedPrimary = userThemeColors.primary || branding?.primaryColor;
    const resolvedSidebar = userThemeColors.sidebar || branding?.sidebarColor;
    const resolvedAccent = userThemeColors.accent || branding?.accentColor;
    const resolvedPrimaryForeground = userThemeColors.primaryForeground;
    const resolvedSidebarForeground = userThemeColors.sidebarForeground;
    if (!themeDraftDirtyRef.current) {
      if (resolvedPrimary) setPrimaryHex(resolvedPrimary.startsWith('oklch') ? oklchToApproxHex(resolvedPrimary) : resolvedPrimary);
      if (resolvedSidebar) setSidebarHex(resolvedSidebar.startsWith('oklch') ? oklchToApproxHex(resolvedSidebar) : resolvedSidebar);
      if (resolvedAccent) setAccentHex(resolvedAccent.startsWith('oklch') ? oklchToApproxHex(resolvedAccent) : resolvedAccent);
      if (resolvedPrimaryForeground) setPrimaryFgHex(resolvedPrimaryForeground.startsWith('oklch') ? oklchToApproxHex(resolvedPrimaryForeground) : resolvedPrimaryForeground);
      if (resolvedSidebarForeground) setSidebarFgHex(resolvedSidebarForeground.startsWith('oklch') ? oklchToApproxHex(resolvedSidebarForeground) : resolvedSidebarForeground);
      setPaletteMode(resolvedPaletteMode);
    }
    if (branding?.portalPrimaryColor) setPortalPrimaryHex(branding.portalPrimaryColor);
    if (branding?.portalAccentColor) setPortalAccentHex(branding.portalAccentColor);
    const configuredPortalText = branding?.portalTextColor || branding?.userTheme?.colors?.primaryForeground;
    if (typeof configuredPortalText === 'string' && configuredPortalText) setPortalTextHex(configuredPortalText.startsWith('oklch') ? oklchToApproxHex(configuredPortalText) : configuredPortalText);
    else if (branding?.portalAccentColor) setPortalTextHex(getReadableForeground(branding.portalAccentColor));
    if (branding?.companyName) setCompanyName(branding.companyName);
    if (branding) setLogoPreview(branding.logo || null);
    if (branding?.industry) setCompanyIndustry(branding.industry);
    // El tema personal tiene prioridad sobre los colores corporativos. Si aún
    // no existe, la marca del tenant se usa como fallback visual.
    if (!themeDraftDirtyRef.current && branding && (resolvedPrimary || resolvedSidebar || resolvedAccent || resolvedPrimaryForeground || resolvedSidebarForeground)) {
      const serverColors: Partial<BrandColors> = {};
      if (resolvedPrimary) {
        serverColors.primary = resolvedPrimary;
      }
      if (resolvedSidebar) {
        serverColors.sidebar = resolvedSidebar;
      }
      if (resolvedAccent) {
        serverColors.accent = resolvedAccent;
      }
      if (resolvedPrimary) {
        serverColors.sidebarPrimary = userThemeColors.sidebarPrimary || resolvedPrimary;
      }
      if (resolvedAccent) {
        serverColors.sidebarAccent = userThemeColors.sidebarAccent || resolvedAccent;
      }
      if (userThemeColors.primaryForeground) {
        serverColors.primaryForeground = userThemeColors.primaryForeground;
      }
      if (userThemeColors.accentForeground) {
        serverColors.accentForeground = userThemeColors.accentForeground;
      }
      if (userThemeColors.sidebarForeground) {
        serverColors.sidebarForeground = userThemeColors.sidebarForeground;
      }
      if (userThemeColors.sidebarPrimary) {
        serverColors.sidebarPrimary = userThemeColors.sidebarPrimary;
      }
      if (userThemeColors.sidebarAccent) {
        serverColors.sidebarAccent = userThemeColors.sidebarAccent;
      }
      updateTheme(serverColors, resolvedPaletteMode);
    }
    if (currency) {
      setExchangeRateAuto(currency.auto !== false);
      setCurrentBackendRate(currency.rate ?? null);
      setBaseCurrencySetting(currency.baseCurrency === 'USD' ? 'USD' : 'NIO');
      if (currency.auto === false && currency.rate !== undefined) setManualRate(String(currency.rate));
      setDisplayCurrencySetting(currency.displayCurrency === 'USD' ? 'USD' : (currency.baseCurrency === 'USD' ? 'USD' : 'NIO'));
      setAllowCurrencySwitch(currency.allowCurrencySwitch !== false);
    }
    setIndustryOptions(industries);
    setRoles(rolesList);
    setEnabledModules(modulesList);
    setEnabledModulesLoaded(true);
  }, [configurationData]);

  const corporateLogo = (configurationData?.branding as any)?.logo || (logoFile ? logoPreview : null) || themeConfig.logo || null;

  const handleCreateRole = () => {
    if (!canCreateRoles) {
      toast.error('No tienes permisos para crear roles');
      return;
    }
    setEditingRole({
      name: '',
      description: '',
      permissions: tenantPermModules.map(m => hydratePermissionActions({}, m.id)) as any,
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
    const currentPerms = normalizePermissions(role.permissions);
    const fullPerms = tenantPermModules.map(m => {
      // Buscar permiso existente (ignorando mayúsculas/minúsculas y buscando por ID o Label)
      const moduleCandidates = [m.id, ...(LEGACY_VIEW_PERMISSION_ALIASES[m.id] || [])]
        .map((candidate) => String(candidate).toUpperCase());
      const existing = currentPerms.find(p => 
        moduleCandidates.includes(String(p.module || '').toUpperCase()) ||
        p.module?.toUpperCase() === m.label.toUpperCase()
      ) as any;
      
      if (existing) {
        return hydratePermissionActions(existing, m.id) as any;
      }
      
      return hydratePermissionActions({}, m.id) as any;
    });
    
    setEditingRole({
      ...role,
      permissions: fullPerms
    });
    setIsRoleDialogOpen(true);
  };

  const handleSavePortalBranding = async () => {
    if (!canEditBranding) return;
    try {
      const selectedPortalTextHex = normalizeHexColor(portalTextHex, getReadableForeground(portalAccentHex));
      setPortalTextHex(selectedPortalTextHex);
      await brandingService.update({
        portalPrimaryColor: portalPrimaryHex,
        portalAccentColor: portalAccentHex,
        portalTextColor: selectedPortalTextHex,
      });
      toast.success('Personalización del portal guardada', { description: 'El texto y sus variantes se derivan del color seleccionado y se aplican también a las fechas.' });
    } catch (error) {
      console.error('Error saving public portal branding:', error);
      toast.error('No se pudo guardar la personalización del portal');
    }
  };

  const confirmDeleteRole = async () => {
    if (!pendingDeleteRole || !canDeleteRoles) return;
    const role = pendingDeleteRole;
    if (!user?.isPlatformAdmin && (role as any).clientTenantId && (role as any).clientTenantId !== user?.tenantId) {
      toast.error('No puedes eliminar roles de otra empresa');
      setPendingDeleteRole(null);
      return;
    }
    const linkedUsers = Number((role as any)._count?.users || 0);
    if (linkedUsers > 0) {
      toast.error(`No se puede eliminar el rol porque tiene ${linkedUsers} usuario${linkedUsers === 1 ? '' : 's'} vinculados.`);
      setPendingDeleteRole(null);
      return;
    }
    try {
      await rolesService.delete(role.id);
      toast.success('Rol eliminado');
      setPendingDeleteRole(null);
      fetchRoles();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al eliminar rol');
    }
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
      
      const mergedPermissions = normalizePermissions(cleanRole.permissions).reduce((result: any[], permission: any) => {
        // TICKETS_VIEW es el identificador histórico; la vista real del
        // sidebar se guarda ahora como TICKETS_LIST.
        const module = permission.module === 'TICKETS_VIEW' ? 'TICKETS_LIST' : permission.module;
        const existing = result.find((item) => item.module === module);
        if (!existing) {
          result.push({ ...permission, module });
          return result;
        }
        [...PERMISSION_ACTION_DEFINITIONS, ...SENSITIVE_PERMISSION_ACTION_DEFINITIONS].forEach(({ key: action }) => {
          existing[action] = Boolean(existing[action] || permissionValue(permission, action));
        });
        existing.write = Boolean(existing.write || permission.write);
        return result;
      }, []);
      const permissions = serializePermissionActions(mergedPermissions)
        .filter((p: any) => {
          const module = String(p.module || '').toUpperCase();
          // El backend es la autoridad del alcance de la sucursal. No
          // eliminamos permisos por un catálogo de módulos que puede estar
          // desactualizado mientras se edita el rol.
          return !HIDDEN_PERMISSION_MODULE_IDS.has(module);
        })
        .map((p: any) => ({ ...p }));
      const payload = {
        name: cleanRole.name,
        description: cleanRole.description || '',
        // Asegurar compatibilidad: el backend usa 'write', el frontend granular usa 'create'/'edit'
        permissions,
        allowedModules: allowedModulesFromPermissions(permissions),
        clientTenantId: user?.tenantId
      };

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

  const togglePermission = (module: string, type: PermissionMatrixAction) => {
    if (!editingRole) return;
    if (!isPermissionActionAvailable(module, type)) return;
    let newPerms = [...normalizePermissions(editingRole.permissions).map(p => ({ ...p }))];

    const targetPerm = newPerms.find(p => p.module === module) as any;
    if (!targetPerm) return;

    const newValue = !permissionValue(targetPerm, type);

    // Si se intenta desactivar leer, pero crear/editar/borrar siguen activos, no permitir.
    if (type === 'read' && newValue === false) {
      if ([...PERMISSION_ACTION_DEFINITIONS, ...SENSITIVE_PERMISSION_ACTION_DEFINITIONS].some(({ key }) => key !== 'read' && permissionValue(targetPerm, key))) {
        return; // Bloquear
      }
    }

    // Aplicar el cambio al módulo clickeado
    targetPerm[type] = newValue;
    // Si se activa crear, editar o borrar, asegurar que se active leer.
    if (type !== 'read' && newValue === true) {
      targetPerm.read = true;
    }

    // Verificar si es un módulo padre (tiene hijos en SUBMODULES_FOR_PERMS)
    const childModules = SUBMODULES_FOR_PERMS.filter(sub => sub.parent === module && tenantPermModuleIds.has(sub.id));
    
    if (childModules.length > 0) {
      // Es un PADRE → propagar a todos los hijos
      childModules.forEach(child => {
        if (!isPermissionActionAvailable(child.id, type)) return;
        const childPerm = newPerms.find(p => p.module === child.id) as any;
        if (childPerm) {
          childPerm[type] = newValue;
          // Si se activa crear/editar/borrar en padre, también activar leer en hijos
          if (type !== 'read' && newValue === true) {
            childPerm.read = true;
          }
          // Si se desactiva leer en padre, desactivar todo en hijos
          if (type === 'read' && newValue === false) {
            [...PERMISSION_ACTION_DEFINITIONS, ...SENSITIVE_PERMISSION_ACTION_DEFINITIONS].filter(({ key }) => key !== 'read').forEach(({ key }) => { childPerm[key] = false; });
            childPerm.write = false;
          }
        }
      });
    }

    // Verificar si es un submódulo (tiene parent)
    const submoduleDef = SUBMODULES_FOR_PERMS.find(sub => sub.id === module);
    if (submoduleDef) {
      // Es un HIJO → recalcular el estado del padre
      const parentPerm = newPerms.find(p => p.module === submoduleDef.parent) as any;
      if (parentPerm) {
        const siblings = SUBMODULES_FOR_PERMS.filter(sub => sub.parent === submoduleDef.parent && tenantPermModuleIds.has(sub.id));
        const siblingPerms: any[] = siblings.map(s => newPerms.find(p => p.module === s.id)).filter(Boolean);
        
        // El padre está ON solo si TODOS los hijos tienen ese permiso ON
        parentPerm[type] = siblingPerms.length > 0 && siblingPerms.every(sp => !!sp[type]);
        
        // Recalcular también 'read' del padre
        if (type !== 'read') {
          parentPerm.read = siblingPerms.length > 0 && siblingPerms.every(sp => !!sp.read);
        }
      }
    }

    setEditingRole({ ...editingRole, permissions: newPerms });
  };

  const previewPrimaryForeground = normalizeHexColor(primaryFgHex, getReadableForeground(primaryHex));
  const previewSidebarForeground = normalizeHexColor(sidebarFgHex, getReadableForeground(sidebarHex));
  const previewAccentForeground = getReadableForeground(accentHex);

  return (
    <div className="space-y-6 p-4 pb-24 md:mx-auto md:max-w-[1920px] md:px-8 md:pt-4">

      {/* —— TABS —— */}
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
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-black"><Sparkles className="size-5 text-primary" />Paletas de Color <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Sidebar: {paletteMode === 'complete' ? 'Completo' : 'Detalles'}</Badge></CardTitle>
                  <CardDescription>Selecciona una paleta y define si se aplica solo al contenido o también al sidebar.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {colorPresets.map(preset => (
                      <button key={preset.name} onClick={() => applyPreset(preset)}
                        type="button"
                        disabled={!canEditBranding}
                        aria-pressed={activePreset === preset.name}
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
                  {activePreset && (
                    <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4" role="radiogroup" aria-label="Modo de aplicación de la paleta">
                      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs font-black uppercase tracking-widest text-foreground">Aplicación: {activePreset}</p>
                        <p className="text-xs text-muted-foreground">Esta elección se conserva al guardar y recargar.</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          role="radio"
                          aria-checked={paletteMode === 'details'}
                          disabled={!canEditBranding}
                          onClick={() => selectPaletteMode('details')}
                          className={cn(
                            'rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            paletteMode === 'details' ? 'border-primary bg-background shadow-sm' : 'border-border/60 hover:border-primary/40',
                          )}
                        >
                          <span className="flex items-center gap-2 text-sm font-bold"><span className={cn('flex size-4 items-center justify-center rounded-full border', paletteMode === 'details' && 'border-primary bg-primary text-primary-foreground')}>
                            {paletteMode === 'details' && <Check className="size-3" />}
                          </span>Modo detalles</span>
                          <span className="mt-1 block pl-6 text-xs text-muted-foreground">Cambia los elementos internos. Sidebar blanco en claro y oscuro en dark mode.</span>
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={paletteMode === 'complete'}
                          disabled={!canEditBranding}
                          onClick={() => selectPaletteMode('complete')}
                          className={cn(
                            'rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            paletteMode === 'complete' ? 'border-primary bg-background shadow-sm' : 'border-border/60 hover:border-primary/40',
                          )}
                        >
                          <span className="flex items-center gap-2 text-sm font-bold"><span className={cn('flex size-4 items-center justify-center rounded-full border', paletteMode === 'complete' && 'border-primary bg-primary text-primary-foreground')}>
                            {paletteMode === 'complete' && <Check className="size-3" />}
                          </span>Modo completo</span>
                          <span className="mt-1 block pl-6 text-xs text-muted-foreground">Aplica también la tonalidad de la paleta al sidebar.</span>
                        </button>
                      </div>
                    </div>
                  )}
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
                  <ColorField label="Color Primario" description="Botones, enlaces y elementos activos" hexValue={primaryHex} readOnly={!canEditBranding} onHexChange={v => { setPrimaryHex(v); setActivePreset(null); themeDraftDirtyRef.current = true; }} />
                  <ColorField label="Texto sobre Primario" description="Color del texto en botones primarios" hexValue={primaryFgHex} readOnly={!canEditBranding} onHexChange={v => { setPrimaryFgHex(v); setActivePreset(null); themeDraftDirtyRef.current = true; }} />
                  <ColorField label="Color de Acento" description="Elementos secundarios y hovers" hexValue={accentHex} readOnly={!canEditBranding} onHexChange={v => { setAccentHex(v); setActivePreset(null); themeDraftDirtyRef.current = true; }} />
                  <Separator className="my-2" />
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Colores del Sidebar</p>
                  <ColorField
                    label="Fondo del Sidebar"
                    description={paletteMode === 'details' ? 'No se aplica en detalles: blanco en claro y neutral oscuro en dark mode.' : 'Color de fondo del menú lateral'}
                    hexValue={sidebarHex}
                    displayColor={paletteMode === 'details' ? 'var(--sidebar-neutral)' : undefined}
                    displayValue={paletteMode === 'details' ? 'Neutral del tema' : undefined}
                    readOnly={!canEditBranding || paletteMode === 'details'}
                    onHexChange={v => { setSidebarHex(v); setActivePreset(null); themeDraftDirtyRef.current = true; }}
                  />
                  <ColorField
                    label="Texto del Sidebar"
                    description={paletteMode === 'details' ? 'No se aplica en detalles: texto oscuro en claro y claro en dark mode.' : 'Color del texto en el menú lateral'}
                    hexValue={sidebarFgHex}
                    displayColor={paletteMode === 'details' ? 'var(--sidebar-neutral-foreground)' : undefined}
                    displayValue={paletteMode === 'details' ? 'Neutral del tema' : undefined}
                    readOnly={!canEditBranding || paletteMode === 'details'}
                    onHexChange={v => { setSidebarFgHex(v); setActivePreset(null); themeDraftDirtyRef.current = true; }}
                  />
                  <div className="flex gap-3 pt-2">
                    <Button data-testid="configuration-theme-save" onClick={handleSave} disabled={!canEditBranding || isSavingTheme} className="rounded-xl gap-2 font-bold">
                      {isSavingTheme ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                      {isSavingTheme ? 'Guardando...' : 'Guardar Tema'}
                    </Button>
                    <Button variant="outline" onClick={handleReset} disabled={!canEditBranding} className="rounded-xl gap-2">
                      <RotateCcw className="size-4" />Restaurar
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/10">
                  <CardTitle className="flex items-center gap-2 text-lg font-black"><Globe className="size-5 text-primary" />Personalización del portal del cliente</CardTitle>
                  <CardDescription>Define la paleta del enlace público. El texto secundario se deriva del color de fuente seleccionado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <ColorField label="Color principal del portal" description="Botones, importes, enlaces y estados destacados" hexValue={portalPrimaryHex} readOnly={!canEditBranding} onHexChange={setPortalPrimaryHex} />
                  <ColorField label="Color de las tarjetas" description="Fondos del encabezado, datos y documentos" hexValue={portalAccentHex} readOnly={!canEditBranding} onHexChange={setPortalAccentHex} />
                  <ColorField label="Color del texto del portal" description="Texto normal, fechas, etiquetas y variantes derivadas para estados secundarios" hexValue={portalTextHex} readOnly={!canEditBranding} onHexChange={setPortalTextHex} />
                  <Button onClick={handleSavePortalBranding} disabled={!canEditBranding} className="rounded-xl gap-2 font-bold"><Save className="size-4" />Guardar portal</Button>
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
                    onClick={() => canEditBranding && logoInputRef.current?.click()}
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
                        <p className="text-[10px] opacity-60">PNG, JPG, WEBP · originales hasta 10 MB; se optimizan</p>
                      </div>
                    )}
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" disabled={!canEditBranding} onChange={handleLogoUpload} />
                  {logoFile && (
                    <Button onClick={handleLogoSave} disabled={logoUploading || !canEditBranding} className="w-full rounded-xl gap-2 font-bold">
                      {logoUploading ? <><RefreshCw className="size-4 animate-spin" />Subiendo...</> : <><Save className="size-4" />Guardar en Supabase</>}
                    </Button>
                  )}
                </CardContent>
              </Card>

              <SidebarPreview
                companyName={companyName}
                logo={logoPreview}
                primaryHex={primaryHex}
                primaryForeground={previewPrimaryForeground}
                paletteMode={paletteMode}
                sidebarHex={sidebarHex}
                sidebarForeground={previewSidebarForeground}
                sidebarAccentHex={accentHex}
                sidebarAccentForeground={previewAccentForeground}
              />
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="nova-pulse" className="space-y-6 mt-0">
          <NovaPulseView canEdit={canEditNovaPulse} canSend={canSendNovaPulse} />
        </TabsContent>

        {/* ══════════ TAB: PERSONALIZACIÓN PDF ══════════ */}
        <TabsContent value="documentos-pdf" className="space-y-6 mt-0">
          <PdfDocumentCustomizer
            tenantId={user?.tenantId}
            branchName={userBranches.find((branch) => branch.id === user?.clientTenantId)?.name || user?.clientTenant?.name || user?.tenantName || ''}
            companyName={companyName || user?.tenantName || ''}
            corporateColor={themeConfig.colors.primary.startsWith('#') ? themeConfig.colors.primary : '#10b981'}
            logo={corporateLogo}
            canEdit={canEditPdf}
            canCreate={canCreatePdf}
            canDelete={canDeletePdf}
          />
        </TabsContent>

        {/* ══════════ TAB: EMPRESA ══════════ */}
        {false && <TabsContent value="empresa" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><Building2 className="size-5 text-primary" />Datos Corporativos</CardTitle>
                <CardDescription>Información principal de tu empresa en Nova Hub</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre de la Empresa</Label>
                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} disabled={!canEditCompany} placeholder="Ej: Empresa Demo S.A." className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Slug / Identificador</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground font-mono bg-muted px-3 py-2 rounded-lg">novahub.io/</span>
                    <Input value={companySlug || user?.tenantId || ''} onChange={e => setCompanySlug(e.target.value)} disabled={!canEditCompany} className="rounded-xl h-11 font-mono" placeholder="empresa-demo" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Identificador único de tu instancia en la plataforma</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Industria</Label>
                  <div className="space-y-2">
                    <select value={companyIndustry} onChange={e => setCompanyIndustry(e.target.value)} disabled={!canEditCompany}
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {industryOptions.length > 0 ? (
                        <>
                          <optgroup label="Predeterminadas">
                            {industryOptions.filter(o => o.isDefault).map(o => (
                              <option key={o.code} value={o.code}>{o.name}</option>
                            ))}
                          </optgroup>
                          {industryOptions.some(o => !o.isDefault) && (
                            <optgroup label="Personalizadas">
                              {industryOptions.filter(o => !o.isDefault).map(o => (
                                <option key={o.code} value={o.code}>{o.name}</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      ) : (
                        <>
                          <option value="RETAIL">Comercio / Retail</option>
                          <option value="SERVICES">Servicios Profesionales</option>
                          <option value="OTHER">Otro</option>
                        </>
                      )}
                    </select>
                    {/* Custom industry entries with delete */}
                    {industryOptions.filter(o => !o.isDefault).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {industryOptions.filter(o => !o.isDefault).map(o => (
                          <Badge key={o.id} variant="secondary" className="gap-1 pr-1 text-[10px] font-bold">
                            {o.name}
                            {canDeactivateCompany && <button onClick={() => o.id && handleDeleteIndustry(o.id)}
                              className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors">
                              <Trash2 className="size-2.5" />
                            </button>}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {/* Add new industry inline */}
                    {showAddIndustry && canCreateCompany ? (
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
                      <button onClick={() => canCreateCompany && setShowAddIndustry(true)}
                        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-bold transition-colors">
                        <Plus className="size-3.5" />Agregar nueva industria
                      </button>
                    )}
                  </div>
                </div>
                <Button onClick={handleSaveCompanyInfo} disabled={!canEditCompany} className="w-full rounded-xl gap-2 font-bold h-11">
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
        </TabsContent>}

        {/* Roles se administran únicamente en Mi Empresa → Mi Equipo. */}
        {false && <TabsContent value="roles" className="space-y-6 mt-0">
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
                                    const permsArray = Array.isArray(role.permissions) ? role.permissions : (role.permissions ? Object.entries(role.permissions).map(([module, vals]: [string, any]) => ({ module, ...vals })) : []);
                                    const activePerms = permsArray.filter((p: any) => !HIDDEN_PERMISSION_MODULE_IDS.has(String(p.module || '').toUpperCase()) && (PERMISSION_ACTION_DEFINITIONS.some(({ key }) => permissionValue(p, key)) || p.write));
                                    const parentModules = new Set(activePerms.map((p: any) => {
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
                                  setPendingDeleteRole(role);
                                }} disabled={Number((role as any)._count?.users || 0) > 0} title={Number((role as any)._count?.users || 0) > 0 ? 'No se puede eliminar porque tiene usuarios vinculados' : 'Eliminar rol'} className="size-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center text-rose-500 transition-all disabled:cursor-not-allowed disabled:opacity-40">
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Permissions Matrix */}
                          <div className="space-y-1.5 mb-5">
                            {(Array.isArray(role.permissions) ? role.permissions : (role.permissions ? Object.entries(role.permissions).map(([module, vals]: [string, any]) => ({ module, ...vals })) : [])).filter((p: any) => !HIDDEN_PERMISSION_MODULE_IDS.has(String(p.module || '').toUpperCase()) && (PERMISSION_ACTION_DEFINITIONS.some(({ key }) => permissionValue(p, key)) || p.write)).slice(0, 4).map((p: any) => {
                              const mod = tenantPermModules.find(m => m.id === p.module);
                              if (!mod) return null;
                              return (
                                <div key={p.module} className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg hover:bg-muted/20">
                                  <span className="font-bold text-muted-foreground truncate mr-2">{mod?.label || p.module}</span>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black', permissionValue(p, 'read') ? 'bg-blue-500/15 text-blue-500' : 'bg-muted/30 text-muted-foreground/30')}>L</span>
                                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black', permissionValue(p, 'create') ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted/30 text-muted-foreground/30')}>C</span>
                                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black', permissionValue(p, 'edit') ? 'bg-amber-500/15 text-amber-500' : 'bg-muted/30 text-muted-foreground/30')}>E</span>
                                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black', permissionValue(p, 'delete') ? 'bg-rose-500/15 text-rose-500' : 'bg-muted/30 text-muted-foreground/30')}>B</span>
                                  </div>
                                </div>
                              );
                            })}
                            {(() => {
                              const permsArr = Array.isArray(role.permissions) ? role.permissions : (role.permissions ? Object.entries(role.permissions).map(([module, vals]: [string, any]) => ({ module, ...vals })) : []);
                              const active = permsArr.filter((p: any) => !HIDDEN_PERMISSION_MODULE_IDS.has(String(p.module || '').toUpperCase()) && (PERMISSION_ACTION_DEFINITIONS.some(({ key }) => permissionValue(p, key)) || p.write));
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
            <DialogContent className="!w-[calc(100vw-2rem)] !max-w-[min(94vw,1200px)] max-h-[90vh] overflow-hidden p-0 rounded-3xl border-none flex flex-col">
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border/30 bg-muted/10 flex-shrink-0">
                <div>
                  <DialogTitle className="text-lg font-black">{editingRole?.id ? 'Editar Rol' : 'Nuevo Rol'}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">Define nombre y matriz de permisos</DialogDescription>
                </div>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-shrink-0">
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

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-shrink-0 mt-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Matriz de Permisos por Módulo</Label>
                  <div className="flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-widest">
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500 inline-block" />Leer</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500 inline-block" />Crear</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500 inline-block" />Editar</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-rose-500 inline-block" />Eliminar</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-violet-500 inline-block" />Importar</span>
                     <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-cyan-500 inline-block" />Exportar</span>
                     <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-rose-500 inline-block" />Costo solo en Inventario</span>
                  </div>
                </div>
                
                <div className="flex-1 rounded-2xl border border-border/40 overflow-hidden flex flex-col min-h-0 relative">
                  <div className="min-w-0 flex-1 overflow-auto" style={{ contain: 'paint' }}>
                    <table className="w-max min-w-[1200px] text-sm">
                      <thead className="bg-muted/95 backdrop-blur-md sticky top-0 z-[50] shadow-sm border-b border-border/50">
                        <tr>
                          <th className="text-left px-4 py-3 text-[10px] sm:text-xs font-black uppercase tracking-wider text-muted-foreground">Módulo</th>
                          {PERMISSION_ACTION_DEFINITIONS.map(({ key, label }) => <th key={key} className="w-[72px] px-0 py-3 text-center text-[10px] font-black text-muted-foreground sm:text-xs">{label}</th>)}
                          <th className="sticky right-0 z-[60] w-[92px] border-l border-border/50 bg-muted/95 px-0 py-3 text-center text-[10px] font-black text-rose-600 shadow-[-6px_0_10px_-10px_hsl(var(--foreground)/0.5)] sm:text-xs" title="Solo habilita la visualización de costos de Inventario">Ver costo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {normalizePermissions(editingRole?.permissions).filter((p) => !HIDDEN_PERMISSION_MODULE_IDS.has(String(p.module || '').toUpperCase())).map((p) => {
                          const mod = tenantPermModules.find(m => m.id === p.module);
                          if (!mod) return null; // No renderizar si no tiene permisos
                          const isSubmodule = mod && 'parent' in mod;
                          const isInventoryPermission = supportsInventoryCostPermission(p.module);
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
                                    </p>
                                    <p className="hidden lg:block text-[9px] text-muted-foreground truncate">{mod?.description || ''}</p>
                                  </div>
                                </div>
                              </td>
                              {PERMISSION_ACTION_DEFINITIONS.map(({ key }) => <td key={key} className="px-0 py-1.5 text-center"><div className="flex justify-center">{!isPermissionActionAvailable(p.module, key) ? <span className="text-muted-foreground/30" aria-label="No aplica">—</span> : <Switch disabled={!canEditRoles} checked={permissionValue(p, key)} onCheckedChange={() => togglePermission(p.module, key)} className="scale-[0.65] sm:scale-75" />}</div></td>)}
                              <td className="sticky right-0 z-10 border-l border-border/50 bg-card px-0 py-1.5 text-center shadow-[-6px_0_10px_-10px_hsl(var(--foreground)/0.5)]"><div className="flex justify-center">{!isInventoryPermission ? <span className="text-muted-foreground/30" aria-label="No aplica">—</span> : <Switch disabled={!canEditRoles} checked={permissionValue(p, 'viewCost')} onCheckedChange={() => togglePermission(p.module, 'viewCost')} aria-label={`Ver costo en ${mod?.label || p.module}`} className="scale-[0.65] sm:scale-75 data-[state=checked]:bg-rose-500" />}</div></td>
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
        </TabsContent>}

        {/* ══════════ TAB: SEGURIDAD ══════════ */}
        <TabsContent value="seguridad" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 font-black"><Shield className="size-5 text-primary" />Autenticación & Acceso</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {[
                  { label: 'Sesión única por dispositivo', desc: 'Cierra la sesión de otros equipos cuando inicias sesión desde uno nuevo', value: singleSession, setter: handleToggleSingleSession, tag: 'Activo' },
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
                    <Switch checked={value} onCheckedChange={setter} disabled={!canEditSecurity} />
                  </div>
                ))}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tiempo de Expiración de Sesión</Label>
                  <div className="flex items-center gap-3">
                    <select value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)} disabled={!canEditSecurity}
                      className="flex h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="15">15 minutos</option>
                      <option value="30">30 minutos</option>
                      <option value="60">1 hora</option>
                      <option value="240">4 horas</option>
                      <option value="480">8 horas</option>
                      <option value="1440">24 horas</option>
                    </select>
                    <Button disabled={!canEditSecurity} className="rounded-xl h-11 gap-2 font-bold" onClick={handleSaveSessionTimeout}>
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
                  <textarea value={ipWhitelist} onChange={e => setIpWhitelist(e.target.value)} disabled={!canEditSecurity} rows={4} placeholder={'192.168.1.0/24\n10.0.0.1\n203.0.113.5'}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <Button disabled={!canEditSecurity} className="w-full rounded-xl gap-2 font-bold" variant="outline" onClick={() => toast.success('Lista de IPs actualizada')}>
                    <CheckCircle2 className="size-4" />Actualizar Whitelist
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/10">
                  <CardTitle className="flex items-center gap-2 font-black"><Activity className="size-5 text-primary" />Logs y auditoría</CardTitle>
                  <CardDescription>Consulta el historial completo en su propia pestaña de Configuración.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => setActiveTab('auditoria')}>
                    <Activity className="mr-2 size-4" />Abrir logs y auditoría
                  </Button>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </TabsContent>

        {/* ══════════ TAB: LOGS Y AUDITORÍA ══════════ */}
        <TabsContent value="auditoria" className="mt-0">
          <AuditoriaPage />
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
                    <Switch checked={exchangeRateAuto} onCheckedChange={setExchangeRateAuto} disabled={!canEditCurrency} />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border/40">
                    <span className="text-xs font-bold text-muted-foreground">Tasa Actual del Sistema</span>
                    <span className="text-lg font-black text-primary">
                      {currentBackendRate ? `C$ ${formatExchangeRate(currentBackendRate)}` : '---'}
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
                            <Input value={manualRate} onChange={e => setManualRate(e.target.value)} disabled={!canEditCurrency} type="number" step="0.01" className="pl-9 rounded-xl h-11 font-mono" />
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
                      <p className="text-sm font-bold">{baseCurrencySetting === 'USD' ? 'Dólar estadounidense (USD)' : 'Córdoba Nicaragüense (NIO)'}</p>
                    </div>
                    <select
                      value={baseCurrencySetting}
                      onChange={(e) => setBaseCurrencySetting(e.target.value === 'USD' ? 'USD' : 'NIO')}
                      disabled={!canEditCurrency}
                      className="h-9 rounded-lg border border-input bg-background px-2 text-xs font-black uppercase tracking-widest"
                      aria-label="Moneda base contable de la empresa"
                    >
                      <option value="NIO">NIO</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <p className="text-[10px] font-semibold text-amber-600">
                    La moneda base pertenece a esta empresa. Después de registrar movimientos contables no debe cambiarse sin una migración controlada.
                  </p>

                  <div className="p-4 rounded-xl border border-border/30 bg-background/70 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Permitir Cambio de Moneda</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Si se desactiva, nadie podrá cambiar `NIO/USD` desde la barra superior.
                        </p>
                      </div>
                      <Switch checked={allowCurrencySwitch} onCheckedChange={setAllowCurrencySwitch} disabled={!canEditCurrency} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        {allowCurrencySwitch ? 'Moneda Global Inicial' : 'Moneda Bloqueada del Sistema'}
                      </Label>
                      <select
                        value={displayCurrencySetting}
                        onChange={(e) => setDisplayCurrencySetting(e.target.value === 'USD' ? 'USD' : 'NIO')}
                        disabled={!canEditCurrency}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-xs font-black uppercase tracking-widest"
                      >
                        <option value="NIO">NIO (Córdoba)</option>
                        <option value="USD">USD (Dólar)</option>
                      </select>
                    </div>
                  </div>

                  <Button onClick={handleSaveCurrencySettings} disabled={isSavingCurrency || !canEditCurrency} className="w-full rounded-xl gap-2 font-black h-11">
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

      </Tabs>
      <ConfirmDialog
        open={Boolean(pendingDeleteRole)}
        onOpenChange={open => { if (!open) setPendingDeleteRole(null); }}
        title="¿Eliminar rol?"
        description={pendingDeleteRole ? `El rol «${pendingDeleteRole.name}» se eliminará y esta acción no se puede deshacer.` : undefined}
        confirmLabel="Eliminar rol"
        variant="destructive"
        onConfirm={confirmDeleteRole}
      />
    </div>
  );
}
