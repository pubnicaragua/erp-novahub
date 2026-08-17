import React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Palette, RotateCcw, Save, Upload, Eye, Check, Sparkles,
  Package, DollarSign, ShieldCheck, Building2, Globe,
  Plus, Settings2, KeyRound, Layers,
  Crown, Lock, CheckCircle2, AlertCircle, Copy, RefreshCw,
  Trash2, Edit2, Shield, ArrowRight, Server, Rocket,
  BarChart3, Info, Coins, TrendingUp, HandCoins, User as UserIcon,
  CalendarDays, Headphones, BellRing, FileText, Activity, Settings,
  BookOpen, Search, Landmark, Scale, GraduationCap, LifeBuoy, MessageSquare
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
import { brandingService } from '../services/branding.service';
import { api } from '../services/api';
import { toast } from 'sonner';
import { cn } from './ui/utils';
import { type RoleManagement, type Permission } from '../types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from './ui/dialog';
import { modulePricingService, type ModulePriceItem } from '../services/module-pricing.service';
import { CountriesView } from './admin/CountriesView';
import { SucursalesView } from './inventory/SucursalesView';
import { PdfDocumentCustomizer } from './configuracion/PdfDocumentCustomizer';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useTenantQuery, asList } from '../hooks/useTenantQuery';
import { hydratePermissionActions, permissionValue, PERMISSION_ACTION_DEFINITIONS, type PermissionMatrixAction } from '../utils/permissions';
import { PERMISSION_SUBMODULES, SIDEBAR_PERMISSION_PARENT_ALIASES } from '../utils/sidebarPermissions';

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
  { id: 'PURCHASES', label: 'Compras', icon: HandCoins, description: 'Proveedores y Órdenes de Compra' },
  { id: 'INVENTORY', label: 'Inventario de Mercancías', icon: Package, description: 'Stock, Almacenes y SKU' },
  { id: 'FINANCIAL', label: 'Finanzas', icon: DollarSign, description: 'Libro Mayor y Balance General' },
  { id: 'ACCOUNTING', label: 'Contabilidad', icon: BookOpen, description: 'Contabilidad General' },
  { id: 'HR', label: 'Recursos Humanos', icon: UserIcon, description: 'Nómina y Gestión de Empleados' },
  { id: 'ACTIVITIES', label: 'Actividades', icon: CalendarDays, description: 'Registro de Actividades' },
  { id: 'TICKETS', label: 'Tickets y Soporte', icon: Headphones, description: 'Soporte y Atención' },
  { id: 'HR_TRAINING', label: 'Centro de Capacitación', icon: GraduationCap, description: 'Cursos y Capacitaciones' },
  { id: 'SUPPORT_TECH', label: 'Soporte Técnico', icon: LifeBuoy, description: 'Soporte Técnico Especializado' },
  { id: 'LEGAL', label: 'Asesoría Legal', icon: Scale, description: 'Asesoría y Casos Legales' },
  { id: 'NOVACHAT', label: 'Nova Suite', icon: NovaSuiteIcon, description: 'Bandeja multicanal y comunicación unificada' },
  { id: 'DOCUMENTS', label: 'Documentos', icon: FileText, description: 'Gestión Documental' },
  { id: 'NOTIFICATIONS', label: 'Notificaciones', icon: BellRing, description: 'Alertas del sistema' },
  { id: 'REPORTS', label: 'Reportes', icon: BarChart3, description: 'Informes y Análisis' },
  { id: 'MY_COMPANY', label: 'Mi Empresa', icon: Building2, description: 'Empresa, plan, equipo, sucursales y dominio' },
  { id: 'CONFIGURATION', label: 'Configuración', icon: Settings, description: 'Ajustes del Sistema' },
];

// Submódulos para permisos ultra-granulares
export const SUBMODULES_FOR_PERMS = [
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

  // Compras
  { id: 'PURCHASES_PROVIDERS', label: 'Proveedores', parent: 'PURCHASES' },
  { id: 'PURCHASES_REQUESTS', label: 'Solicitudes de compra', parent: 'PURCHASES' },
  { id: 'PURCHASES_MANAGEMENT', label: 'Gestión de compras', parent: 'PURCHASES' },
  { id: 'PURCHASES_SUPPLIER_PRICES', label: 'Precios de proveedores', parent: 'PURCHASES' },
  { id: 'PURCHASES_EXPENSES', label: 'Gastos', parent: 'PURCHASES' },
  { id: 'PURCHASES_EXPENSES_REC', label: 'Gastos Recurrentes', parent: 'PURCHASES' },
  { id: 'PURCHASES_ORDERS', label: 'Órdenes de Compra', parent: 'PURCHASES' },
  { id: 'PURCHASES_RECEIPTS', label: 'Recepciones de Compra', parent: 'PURCHASES' },
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
  { id: 'FINANCIAL_ACCOUNTS', label: 'Cuentas financieras', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_JOURNAL', label: 'Diario financiero', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_LEDGER', label: 'Libro mayor financiero', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_BANK', label: 'Bancos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_BUDGET', label: 'Presupuestos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_REPORTS', label: 'Reportes financieros', parent: 'FINANCIAL' },

  // Inventario
  { id: 'INVENTORY_PRODUCTS', label: 'Productos', parent: 'INVENTORY' },
  { id: 'INVENTORY_SERVICES', label: 'Servicios', parent: 'INVENTORY' },
  { id: 'INVENTORY_WAREHOUSES', label: 'Almacenes', parent: 'INVENTORY' },
  { id: 'INVENTORY_TRANSFERS', label: 'Transferencias', parent: 'INVENTORY' },
  { id: 'INVENTORY_ADJUSTMENTS', label: 'Ajustes', parent: 'INVENTORY' },
  { id: 'INVENTORY_MOVEMENTS', label: 'Movimientos', parent: 'INVENTORY' },

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
  { id: 'REPORTS_SUBSCRIPTIONS', label: 'Suscripciones', parent: 'REPORTS' },
  
  // Mi Empresa
  { id: 'CONFIG_COMPANY', label: 'General', parent: 'MY_COMPANY' },
  { id: 'SUBSCRIPTIONS', label: 'Módulos y Plan', parent: 'MY_COMPANY' },
  { id: 'CONFIG_USERS', label: 'Mi Equipo', parent: 'MY_COMPANY' },
  { id: 'CONFIG_ROLES', label: 'Roles y permisos', parent: 'MY_COMPANY' },
  { id: 'COMPANY_BRANCHES', label: 'Sucursales', parent: 'MY_COMPANY' },
  { id: 'CONFIG_DOMAINS', label: 'Dominio propio', parent: 'MY_COMPANY' },

  // Configuración
  { id: 'CONFIG_BRANDING', label: 'Marca y Tema', parent: 'CONFIGURATION' },
  { id: 'CONFIG_SECURITY', label: 'Seguridad', parent: 'CONFIGURATION' },
  { id: 'CONFIG_CURRENCY', label: 'Moneda', parent: 'CONFIGURATION' },
  { id: 'CONFIG_PDF', label: 'Documentos PDF', parent: 'CONFIGURATION' },
  { id: 'CONFIG_TENANCY', label: 'Multiempresa', parent: 'CONFIGURATION' },
  { id: 'CONFIG_PLATFORM', label: 'Plataforma', parent: 'CONFIGURATION' },
  { id: 'CONFIG_COUNTRIES', label: 'Países', parent: 'CONFIGURATION' },
  { id: 'CONFIG_MODULE_PRICING', label: 'Precios de módulos', parent: 'CONFIGURATION' },

  // Contabilidad
  { id: 'ACCOUNTING_CHART', label: 'Plan de Cuentas', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_JOURNAL', label: 'Libro Diario', parent: 'ACCOUNTING' },
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
  const validHex = /^#[0-9a-fA-F]{6}$/.test(hexValue) ? hexValue : '#000000';

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/20">
      <label className="relative block size-10 shrink-0 cursor-pointer" title={`Elegir ${label.toLowerCase()}`}>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg border-2 border-border shadow-sm transition-transform hover:scale-105"
          style={{ backgroundColor: validHex }}
        />
        <input
          type="color"
          value={validHex}
          onChange={e => onHexChange(e.target.value)}
          aria-label={`Elegir ${label.toLowerCase()}`}
          className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
        />
      </label>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Input
        value={hexValue}
        onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onHexChange(e.target.value); }}
        onBlur={() => { if (!/^#[0-9a-fA-F]{6}$/.test(hexValue)) onHexChange(validHex); }}
        aria-label={`Código hexadecimal de ${label.toLowerCase()}`}
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
  { id: 'documentos-pdf', label: 'Documentos PDF', icon: FileText, scenario: ['superadmin', 'partner', 'client'] },
  { id: 'seguridad', label: 'Seguridad', icon: KeyRound, scenario: ['superadmin', 'partner', 'client'] },
  { id: 'tenancy', label: 'Multi-Tenancy', icon: Layers, scenario: ['superadmin', 'partner'] },
  { id: 'currency', label: 'Moneda & Cambio', icon: Coins, scenario: ['superadmin', 'partner', 'client'] },
  { id: 'plataforma', label: 'Plataforma', icon: Server, scenario: ['superadmin'] },
  { id: 'paises', label: 'Países', icon: Globe, scenario: ['superadmin'] },
  { id: 'precios', label: 'Precios Módulos', icon: DollarSign, scenario: ['superadmin'] },
];

const CONFIG_TAB_PERMISSIONS: Record<string, string> = {
  branding: 'CONFIG_BRANDING',
  'documentos-pdf': 'CONFIG_PDF',
  seguridad: 'CONFIG_SECURITY',
  tenancy: 'CONFIG_TENANCY',
  currency: 'CONFIG_CURRENCY',
  plataforma: 'CONFIG_PLATFORM',
  paises: 'CONFIG_COUNTRIES',
  precios: 'CONFIG_MODULE_PRICING',
};

// ---- Main Component ----
const PRICING_MODULES = [
  { category: 'Operaciones', modules: [
    { id: 'SALES', label: 'Ventas', icon: TrendingUp },
    { id: 'PURCHASES', label: 'Compras', icon: HandCoins },
    { id: 'INVENTORY', label: 'Inventario de Mercancías', icon: Package },
  ]},
  { category: 'Administración', modules: [
    { id: 'FINANCIAL', label: 'Finanzas', icon: DollarSign },
    { id: 'HR', label: 'Recursos Humanos', icon: UserIcon },
    { id: 'ACCOUNTING', label: 'Contabilidad', icon: BookOpen },
  ]},
  { category: 'Herramientas', modules: [
    { id: 'ACTIVITIES', label: 'Actividades', icon: CalendarDays },
    { id: 'DOCUMENTS', label: 'Documentos', icon: FileText },
    { id: 'NOTIFICATIONS', label: 'Notificaciones', icon: BellRing },
    { id: 'REPORTS', label: 'Reportes', icon: BarChart3 },
  ]},
  { category: 'Soporte', modules: [
    { id: 'TICKETS', label: 'Tickets y Soporte', icon: Headphones },
    { id: 'CONFIGURATION', label: 'Configuración', icon: Settings },
  ]},
];

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Edición',
  DELETE: 'Eliminación',
  PAYMENT: 'Pago',
  STATUS_CHANGE: 'Cambio de estado',
  LOGIN: 'Inicio de sesión',
  SESSION_TAKEOVER: 'Ingreso desde otra IP',
  AUDIT: 'Auditoría',
  SENT_TO_CORRECT: 'Enviado a corregir',
  CANCELLED: 'Anulación',
  REISSUE: 'Reemisión',
};

const AUDIT_MODULE_LABELS: Record<string, string> = {
  SALES: 'Ventas',
  PURCHASES: 'Compras',
  INVENTORY: 'Inventario',
  HR: 'Recursos Humanos',
  FINANCES: 'Finanzas',
  ACCOUNTING: 'Contabilidad',
  AUTH: 'Acceso',
  TOOLS: 'Soporte',
};

function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] || action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function auditDetailText(log: any): string {
  let details: any = log.details;
  if (typeof details === 'string' && details.trim().startsWith('{')) {
    try {
      details = JSON.parse(details);
    } catch {
      /* se queda como texto */
    }
  }
  if (details && typeof details === 'object') {
    if (details.ip && (log.action === 'SESSION_TAKEOVER' || log.action === 'LOGIN')) {
      return `desde IP ${details.ip}`;
    }
    if (details.message) return String(details.message).slice(0, 60);
    return JSON.stringify(details).slice(0, 60);
  }
  return String(details ?? '').slice(0, 60);
}

function auditModuleLabel(module: string) {
  return AUDIT_MODULE_LABELS[module] || module;
}

function auditTone(action: string): 'success' | 'warning' | 'info' | 'danger' {
  if (['LOGIN', 'PAYMENT'].includes(action)) return 'success';
  if (['SESSION_TAKEOVER'].includes(action)) return 'danger';
  if (['UPDATE', 'STATUS_CHANGE', 'AUDIT', 'SENT_TO_CORRECT'].includes(action)) return 'warning';
  if (['DELETE', 'CANCELLED'].includes(action)) return 'danger';
  return 'info';
}

function auditTimeAgo(iso?: string | null) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} día${days > 1 ? 's' : ''}`;
}

export function ConfiguracionPage({ initialTab = 'branding' }: { initialTab?: string }) {
  const { themeConfig, updateTheme, updateConfig, resetTheme } = useTheme();
  const { user, canPerform } = useAuth();
  const { refreshRate: refreshCurrencyContext } = useCurrency();
  const scenario = getScenario(user?.role);
  const visibleTabs = ALL_TABS.filter(t => {
    if (!t.scenario.includes(scenario)) return false;
    const permissionModule = CONFIG_TAB_PERMISSIONS[t.id];
    return !permissionModule || canPerform(permissionModule, 'view');
  });
  const canViewRoles = canPerform('CONFIG_ROLES', 'view');
  const canCreateRoles = canPerform('CONFIG_ROLES', 'create');
  const canEditRoles = canPerform('CONFIG_ROLES', 'edit');
  const canDeleteRoles = canPerform('CONFIG_ROLES', 'delete');
  const canViewCompany = canPerform('CONFIG_COMPANY', 'view');
  const canViewBranding = canPerform('CONFIG_BRANDING', 'view');
  const canViewTenancy = canPerform('CONFIG_TENANCY', 'view');
  const canViewCurrency = canPerform('CONFIG_CURRENCY', 'view');
  const canViewModulePricing = canPerform('CONFIG_MODULE_PRICING', 'view');
  const canViewWarehouses = canPerform('COMPANY_BRANCHES', 'view');
  const canCreateWarehouses = canPerform('COMPANY_BRANCHES', 'create');
  const canEditCompany = canPerform('CONFIG_COMPANY', 'edit');
  const canCreateCompany = canPerform('CONFIG_COMPANY', 'create');
  const canDeactivateCompany = canPerform('CONFIG_COMPANY', 'deactivate');
  const canEditBranding = canPerform('CONFIG_BRANDING', 'edit');
  const canEditSecurity = canPerform('CONFIG_SECURITY', 'edit');
  const canEditCurrency = canPerform('CONFIG_CURRENCY', 'edit');
  const canEditTenancy = canPerform('CONFIG_TENANCY', 'edit');
  const canEditPdf = canPerform('CONFIG_PDF', 'edit');
  const canCreatePdf = canPerform('CONFIG_PDF', 'create');
  const canDeletePdf = canPerform('CONFIG_PDF', 'delete');
  const canEditPlatform = canPerform('CONFIG_PLATFORM', 'edit');
  const canEditCountries = canPerform('CONFIG_COUNTRIES', 'edit');
  const canEditModulePricing = canPerform('CONFIG_MODULE_PRICING', 'edit');

  const tenantPermModules = React.useMemo(() => {
    if (!user) return [];
    

    return ALL_PERM_MODULES.filter(m => {
      const parentMod = 'parent' in m ? (m as any).parent : null;
      const permissionModules = Array.isArray(user.permissions) ? user.permissions.map(permission => String(permission.module).toUpperCase()) : [];
      if (parentMod === 'CONFIGURATION' && (
        user.enabledModules.includes('CONFIGURATION') ||
        permissionModules.includes('CONFIGURATION') ||
        permissionModules.includes('CONFIGURACION') ||
        user.isTenantAdmin
      )) return true;

      // Las subvistas internas no consumen una suscripción propia. Si el
      // tenant tiene habilitado el módulo padre o cualquier vista del grupo,
      // deben permanecer disponibles para configurar el rol.
      if (parentMod && (m as any).subscription === false) {
        const parentAliasesForInternal = SIDEBAR_PERMISSION_PARENT_ALIASES[parentMod] || [];
        if (
          user.enabledModules.includes(parentMod)
          || parentAliasesForInternal.some((alias) => user.enabledModules.includes(alias))
          || user.enabledModules.some((enabled) => enabled.startsWith(`${parentMod}_`))
          || permissionModules.includes(parentMod)
          || parentAliasesForInternal.some((alias) => permissionModules.includes(alias))
        ) return true;
      }

      // 1. Direct check
      if (user.enabledModules.includes(m.id)) return true;

      // Mi Empresa y Configuración son entradas únicas del sidebar; sus
      // pestañas internas conservan compatibilidad mediante el permiso padre.
      const directAliases = SIDEBAR_PERMISSION_PARENT_ALIASES[m.id] || [];
      const inheritedAliases = parentMod ? (SIDEBAR_PERMISSION_PARENT_ALIASES[parentMod] || []) : [];
      if ([...directAliases, ...inheritedAliases].some((alias) => user.enabledModules.includes(alias))) return true;

      // 2. Fallback check for submodules
      if (parentMod && user.enabledModules.includes(parentMod)) {
        return true;
      }

      // 3. Fallback check for main modules
      if (!parentMod && user.enabledModules.some(mod => mod.startsWith(`${m.id}_`))) {
        return true;
      }

      return false;
    });
  }, [user]);

  // Hex state for the color pickers
  const [primaryHex, setPrimaryHex] = useState(() => oklchToApproxHex(themeConfig.colors.primary));
  const [sidebarHex, setSidebarHex] = useState(() => oklchToApproxHex(themeConfig.colors.sidebar));
  const [accentHex, setAccentHex] = useState(() => oklchToApproxHex(themeConfig.colors.accent));
  const [sidebarFgHex, setSidebarFgHex] = useState(() => oklchToApproxHex(themeConfig.colors.sidebarForeground));
  const [primaryFgHex, setPrimaryFgHex] = useState(() => oklchToApproxHex(themeConfig.colors.primaryForeground));
  const [portalPrimaryHex, setPortalPrimaryHex] = useState('#10b981');
  const [portalAccentHex, setPortalAccentHex] = useState('#0f172a');
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
  const resolvedInitialTab = visibleTabs.find(tab => tab.id === initialTab)?.id || visibleTabs[0]?.id || 'branding';
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

  // Registro de Auditoría (datos reales del backend)
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
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

  useEffect(() => {
    if (activeTab !== 'seguridad') return;
    let active = true;
    setAuditLoading(true);
    api.get<any>('/audit/logs', { params: { page: auditPage, pageSize: 12, search: auditSearch || undefined } })
      .then((res: any) => {
        if (!active) return;
        const data = res?.data || res;
        setAuditLogs(Array.isArray(data?.items) ? data.items : []);
        setAuditTotal(Number(data?.total || 0));
      })
      .catch(() => { if (active) setAuditLogs([]); })
      .finally(() => { if (active) setAuditLoading(false); });
    return () => { active = false; };
  }, [activeTab, auditPage, auditSearch, auditRefreshKey]);

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

  // Tenancy state
  const [strictIsolation, setStrictIsolation] = useState(true);
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [apiAccess, setApiAccess] = useState(false);

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
      const raw = sessionStorage.getItem('novahub:implementation-setup-tour');
      if (raw) {
        try { const ctx = JSON.parse(raw); if (ctx.module === 'configuracion' && ctx.subModule === 'empresa') { sessionStorage.removeItem('novahub:implementation-setup-tour'); window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'overview' } })); return; } } catch {}
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al guardar la información');
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
    if (!canEditBranding) return;
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
      await refetchConfiguration();

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
    if (!canEditBranding) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoSave = async () => {
    if (!canEditBranding || !logoFile) return;
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
      await refetchConfiguration();
      toast.success('Logo guardado en Supabase Storage âœ“');
    } catch (error) {
      console.error('Logo upload error:', error);
      // Fallback to base64 if storage fails
      if (logoPreview) {
        updateConfig({ logo: logoPreview });
        await brandingService.update({ logo: logoPreview }).catch(() => { });
        await refetchConfiguration();
        toast.success('Logo aplicado localmente');
      } else {
        toast.error('Error al subir el logo');
      }
    } finally {
      setLogoUploading(false);
    }
  };

  const [roles, setRoles] = useState<RoleManagement[]>([]);
  // @ts-ignore
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [, setIsLoadingModules] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [pendingDeleteRole, setPendingDeleteRole] = useState<RoleManagement | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [sucursalModalOpen, setSucursalModalOpen] = useState(false);

  const fetchPricing = async () => {
    setPricingLoading(true);
    try {
      await refetchConfiguration();
    } catch { /* ignore */ }
    finally { setPricingLoading(false); }
  };

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

  const fetchWarehouses = async () => {
    try {
      await refetchConfiguration();
    } catch { /* ignore */ }
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
        const raw = sessionStorage.getItem('novahub:implementation-setup-tour');
        if (raw) {
          try { const ctx = JSON.parse(raw); if (ctx.module === 'configuracion' && ctx.subModule === 'currency') { sessionStorage.removeItem('novahub:implementation-setup-tour'); window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'overview' } })); return; } } catch {}
        }
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

  // Pricing state
  const [pricingData, setPricingData] = useState<ModulePriceItem[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingSearch, setPricingSearch] = useState('');
  const [pricingEdits, setPricingEdits] = useState<Record<string, number>>({});

  const { data: configurationData, refetch: refetchConfiguration } = useTenantQuery(
    ['configuration', user?.tenantId || 'current', scenario, canViewRoles, canViewCompany, canViewBranding, canViewCurrency, canViewModulePricing, canViewWarehouses],
    async (signal) => {
      const tenantId = user?.tenantId;
      const [branding, currency, industries, pricing, rolesData, warehouseData, modules] = await Promise.all([
        canViewBranding || canViewCompany || canViewTenancy ? brandingService.getCurrent(signal) : Promise.resolve(null),
        canViewCurrency ? api.get<any>('/tools/exchange-rate', { signal }) : Promise.resolve(null),
        tenantId && canViewCompany ? api.get<any>(`/tenants/${tenantId}/industries`, { signal }) : Promise.resolve([]),
        scenario === 'superadmin' && canViewModulePricing ? modulePricingService.getAll(signal) : Promise.resolve([]),
        // Los roles se administran exclusivamente desde Mi Empresa > Mi Equipo.
        Promise.resolve([]),
        tenantId && canViewWarehouses ? api.get<any>('/inventory/warehouses', { signal }) : Promise.resolve([]),
        tenantId && (user?.isTenantAdmin || canPerform('SUBSCRIPTIONS', 'view'))
          ? subscriptionsService.getEnabledModules(tenantId, undefined, signal)
          : Promise.resolve(user?.enabledModules || []),
      ]);
      return { branding, currency, industries, pricing, roles: rolesData, warehouses: warehouseData, modules };
    },
    { enabled: Boolean(user), onError: (error) => toast.error(error.message || 'Error cargando configuración') },
  );

  useEffect(() => {
    if (!configurationData) return;
    const branding = configurationData.branding as any;
    const currency = configurationData.currency as any;
    const industries = asList(configurationData.industries);
    const rolesList = asList(configurationData.roles);
    const warehouseList = asList(configurationData.warehouses);
    const pricingList = asList(configurationData.pricing);
    const modulesList = asList(configurationData.modules);

    if (branding?.primaryColor) setPrimaryHex(branding.primaryColor.startsWith('oklch') ? oklchToApproxHex(branding.primaryColor) : branding.primaryColor);
    if (branding?.sidebarColor) setSidebarHex(branding.sidebarColor.startsWith('oklch') ? oklchToApproxHex(branding.sidebarColor) : branding.sidebarColor);
    if (branding?.accentColor) setAccentHex(branding.accentColor.startsWith('oklch') ? oklchToApproxHex(branding.accentColor) : branding.accentColor);
    if (branding?.portalPrimaryColor) setPortalPrimaryHex(branding.portalPrimaryColor);
    if (branding?.portalAccentColor) setPortalAccentHex(branding.portalAccentColor);
    if (branding?.companyName) setCompanyName(branding.companyName);
    if (branding?.logo) setLogoPreview(branding.logo);
    if (branding?.industry) setCompanyIndustry(branding.industry);
    if (branding?.whiteLabel !== undefined) setWhiteLabel(branding.whiteLabel);
    if (branding) {
      updateTheme(generateThemeFromColor(
        branding.primaryColor?.startsWith('oklch') ? oklchToApproxHex(branding.primaryColor) : (branding.primaryColor || '#10b981'),
        branding.sidebarColor?.startsWith('oklch') ? oklchToApproxHex(branding.sidebarColor) : (branding.sidebarColor || '#0c1a12'),
        branding.accentColor?.startsWith('oklch') ? oklchToApproxHex(branding.accentColor) : (branding.accentColor || '#064e3b'),
      ));
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
    setPricingData(pricingList);
    setRoles(rolesList);
    setWarehouses(warehouseList);
    setEnabledModules(modulesList);
  }, [configurationData]);

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
      const existing = currentPerms.find(p => 
        p.module?.toUpperCase() === m.id.toUpperCase() ||
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
      await brandingService.update({
        portalPrimaryColor: portalPrimaryHex,
        portalAccentColor: portalAccentHex,
      });
      toast.success('Personalización del portal guardada', { description: 'El portal utiliza esta paleta oscura independientemente del tema de cada usuario.' });
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
    try {
      await rolesService.delete(role.id);
      toast.success('Rol eliminado');
      setPendingDeleteRole(null);
      fetchRoles();
    } catch { toast.error('Error al eliminar rol'); }
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
        permissions: normalizePermissions(cleanRole.permissions).map((p: any) => ({
          ...p,
          write: !!(p.create || p.edit || p.write), // compat con backend
        })),
        allowedModules: cleanRole.allowedModules || [],
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
    let newPerms = [...normalizePermissions(editingRole.permissions).map(p => ({ ...p }))];

    const targetPerm = newPerms.find(p => p.module === module) as any;
    if (!targetPerm) return;

    const newValue = !permissionValue(targetPerm, type);

    // Si se intenta desactivar leer, pero crear/editar/borrar siguen activos, no permitir.
    if (type === 'read' && newValue === false) {
      if (PERMISSION_ACTION_DEFINITIONS.some(({ key }) => key !== 'read' && permissionValue(targetPerm, key))) {
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
    const childModules = SUBMODULES_FOR_PERMS.filter(sub => sub.parent === module);
    
    if (childModules.length > 0) {
      // Es un PADRE â†’ propagar a todos los hijos
      childModules.forEach(child => {
        const childPerm = newPerms.find(p => p.module === child.id) as any;
        if (childPerm) {
          childPerm[type] = newValue;
          // Si se activa crear/editar/borrar en padre, también activar leer en hijos
          if (type !== 'read' && newValue === true) {
            childPerm.read = true;
          }
          // Si se desactiva leer en padre, desactivar todo en hijos
          if (type === 'read' && newValue === false) {
            PERMISSION_ACTION_DEFINITIONS.filter(({ key }) => key !== 'read').forEach(({ key }) => { childPerm[key] = false; });
            childPerm.write = false;
          }
        }
      });
    }

    // Verificar si es un submódulo (tiene parent)
    const submoduleDef = SUBMODULES_FOR_PERMS.find(sub => sub.id === module);
    if (submoduleDef) {
      // Es un HIJO â†’ recalcular el estado del padre
      const parentPerm = newPerms.find(p => p.module === submoduleDef.parent) as any;
      if (parentPerm) {
        const siblings = SUBMODULES_FOR_PERMS.filter(sub => sub.parent === submoduleDef.parent);
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

  return (
    <div className="space-y-6 p-4 md:p-8 pb-24 max-w-[1920px] mx-auto">

      {/* â”€â”€ HEADER â”€â”€ */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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

      {/* â”€â”€ TABS â”€â”€ */}
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

        {/* â•â•â•â•â•â•â•â•â•â• TAB: BRANDING â•â•â•â•â•â•â•â•â•â• */}
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
                    <Button onClick={handleSave} disabled={!canEditBranding} className="rounded-xl gap-2 font-bold">
                      <Save className="size-4" />Guardar Tema
                    </Button>
                    <Button variant="outline" onClick={handleReset} className="rounded-xl gap-2">
                      <RotateCcw className="size-4" />Restaurar
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="border-b border-border/30 bg-muted/10">
                  <CardTitle className="flex items-center gap-2 text-lg font-black"><Globe className="size-5 text-primary" />Personalización del portal del cliente</CardTitle>
                  <CardDescription>Define el color principal y el color de las tarjetas del enlace público.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <ColorField label="Color principal del portal" description="Botones, importes, enlaces y estados destacados" hexValue={portalPrimaryHex} onHexChange={setPortalPrimaryHex} />
                  <ColorField label="Color de las tarjetas" description="Fondos del encabezado, datos y documentos" hexValue={portalAccentHex} onHexChange={setPortalAccentHex} />
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
                        <p className="text-[10px] opacity-60">PNG, SVG, JPG · Max 2MB</p>
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
                      {['Dashboard', 'Ventas', 'Compras', 'Inventario de Mercancías'].map((item, i) => (
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

        {/* â•â•â•â•â•â•â•â•â•â• TAB: PERSONALIZACIÓN PDF â•â•â•â•â•â•â•â•â•â• */}
        <TabsContent value="documentos-pdf" className="space-y-6 mt-0">
          <PdfDocumentCustomizer
            tenantId={user?.tenantId}
            companyName={companyName || user?.tenantName || ''}
            corporateColor={themeConfig.colors.primary.startsWith('#') ? themeConfig.colors.primary : '#10b981'}
            logo={logoPreview || themeConfig.logo}
            canEdit={canEditPdf}
            canCreate={canCreatePdf}
            canDelete={canDeletePdf}
          />
        </TabsContent>

        {/* â•â•â•â•â•â•â•â•â•â• TAB: EMPRESA â•â•â•â•â•â•â•â•â•â• */}
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

        {/* Roles se administran únicamente en Mi Empresa â†’ Mi Equipo. */}
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
                                    const activePerms = permsArray.filter((p: any) => PERMISSION_ACTION_DEFINITIONS.some(({ key }) => permissionValue(p, key)) || p.write);
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
                                }} className="size-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 flex items-center justify-center text-rose-500 transition-all">
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Permissions Matrix */}
                          <div className="space-y-1.5 mb-5">
                            {(Array.isArray(role.permissions) ? role.permissions : (role.permissions ? Object.entries(role.permissions).map(([module, vals]: [string, any]) => ({ module, ...vals })) : [])).filter((p: any) => PERMISSION_ACTION_DEFINITIONS.some(({ key }) => permissionValue(p, key)) || p.write).slice(0, 4).map((p: any) => {
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
                              const active = permsArr.filter((p: any) => PERMISSION_ACTION_DEFINITIONS.some(({ key }) => permissionValue(p, key)) || p.write);
                              return active.length > 4 ? (
                                <p className="text-[10px] text-muted-foreground/50 italic pl-2">+ {active.length - 4} vistas más</p>
                              ) : null;
                            })()}
                          </div>

                          <button onClick={() => handleEditRole(role)} disabled={!canEditRoles}
                            className="w-full text-xs font-black uppercase tracking-widest py-2 rounded-xl border border-primary/20 text-primary hover:bg-primary/5 transition-all relative z-20">
                            Editar Permisos â†’
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

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 font-black"><Building2 className="size-5 text-primary" />Sucursales</CardTitle>
                    <CardDescription>Gestiona las sucursales de tu empresa</CardDescription>
                  </div>
                  {canCreateWarehouses && <Button onClick={() => { setSucursalModalOpen(true); fetchWarehouses(); }} className="rounded-xl gap-2 font-black text-xs uppercase tracking-widest h-10">
                    <Plus className="size-4" />Crear Sucursal
                  </Button>}
                </div>
              </CardHeader>
            </Card>
          </motion.div>

          <Dialog open={sucursalModalOpen} onOpenChange={setSucursalModalOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogTitle>Sucursales</DialogTitle>
              <SucursalesView
                permissionModule="COMPANY_BRANCHES"
                warehouses={warehouses}
                onRefresh={() => {}}
                isModal
                autoOpenCreate
              />
            </DialogContent>
          </Dialog>

          {/* Role Edit Dialog */}
          <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
            <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-hidden p-0 rounded-3xl border-none flex flex-col">
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
                  </div>
                </div>
                
                <div className="flex-1 rounded-2xl border border-border/40 overflow-hidden flex flex-col min-h-0 relative">
                  <div className="overflow-y-auto overflow-x-hidden flex-1" style={{ contain: 'paint' }}>
                    <table className="w-max min-w-[1900px] text-sm">
                      <thead className="bg-muted/95 backdrop-blur-md sticky top-0 z-[50] shadow-sm border-b border-border/50">
                        <tr>
                          <th className="text-left px-4 py-3 text-[10px] sm:text-xs font-black uppercase tracking-wider text-muted-foreground">Módulo</th>
                          {PERMISSION_ACTION_DEFINITIONS.map(({ key, label }) => <th key={key} className="w-[72px] px-0 py-3 text-center text-[10px] font-black text-muted-foreground sm:text-xs">{label}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {normalizePermissions(editingRole?.permissions).map((p) => {
                          const mod = tenantPermModules.find(m => m.id === p.module);
                          if (!mod) return null; // No renderizar si no tiene permisos
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
                                    </p>
                                    <p className="hidden lg:block text-[9px] text-muted-foreground truncate">{mod?.description || ''}</p>
                                  </div>
                                </div>
                              </td>
                              {PERMISSION_ACTION_DEFINITIONS.map(({ key }) => <td key={key} className="px-0 py-1.5 text-center"><div className="flex justify-center"><Switch disabled={!canEditRoles} checked={permissionValue(p, key)} onCheckedChange={() => togglePermission(p.module, key)} className="scale-[0.65] sm:scale-75" /></div></td>)}
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

        {/* â•â•â•â•â•â•â•â•â•â• TAB: SEGURIDAD â•â•â•â•â•â•â•â•â•â• */}
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
                  <CardTitle className="flex items-center gap-2 font-black"><BarChart3 className="size-5 text-primary" />Registro de Auditoría</CardTitle>
                  <CardDescription>Actividad real de los usuarios del sistema · {auditTotal} registro(s)</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="audit-log-search"
                        placeholder="Buscar por módulo, acción o detalle..."
                        className="h-9 pl-8 text-xs"
                        value={auditSearch}
                        onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.id === 'audit-log-search') {
                            setAuditRefreshKey(k => k + 1);
                          }
                        }}
                      />
                    </div>
                    <Button variant="outline" size="sm" className="h-9 w-9 shrink-0 rounded-lg" onClick={() => setAuditRefreshKey(k => k + 1)}
                      disabled={auditLoading} aria-label="Actualizar auditoría">
                      <RefreshCw className={`size-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {auditLoading && auditLogs.length === 0 ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-14 rounded-xl bg-muted/10 border border-border/30 animate-pulse" />
                        ))}
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <p className="p-6 text-center text-xs text-muted-foreground">Aún no hay actividad registrada.</p>
                    ) : (
                      auditLogs.map((log: any) => {
                        const tone = auditTone(log.action);
                        const dotColor = tone === 'success' ? 'bg-emerald-500' : tone === 'warning' ? 'bg-amber-500' : tone === 'danger' ? 'bg-rose-500' : 'bg-blue-500';
                        return (
                          <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/10 border border-border/30">
                            <div className={`size-2 rounded-full flex-shrink-0 ${dotColor}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold truncate">{auditActionLabel(log.action)} · {auditModuleLabel(log.module)}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {log.user?.name || log.user?.email || 'Sistema'}
                                {log.entity ? ` · ${log.entity.replace(/_/g, ' ').toLowerCase()}` : ''}
                                {auditDetailText(log) ? ` · ${auditDetailText(log)}` : ''}
                              </p>
                            </div>
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">{auditTimeAgo(log.createdAt)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {auditTotal > 12 && (
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[10px] text-muted-foreground">Página {auditPage} de {Math.max(1, Math.ceil(auditTotal / 12))}</p>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" className="h-8 gap-1 rounded-lg text-[10px] font-bold"
                          disabled={auditPage <= 1 || auditLoading} onClick={() => setAuditPage(p => Math.max(1, p - 1))}>
                          Anterior
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 gap-1 rounded-lg text-[10px] font-bold"
                          disabled={auditPage >= Math.ceil(auditTotal / 12) || auditLoading} onClick={() => setAuditPage(p => p + 1)}>
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </TabsContent>

        {/* â•â•â•â•â•â•â•â•â•â• TAB: MULTI-TENANCY â•â•â•â•â•â•â•â•â•â• */}
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
                    <Switch checked={value} onCheckedChange={locked || !canEditTenancy ? undefined : setter} disabled={locked || !canEditTenancy} />
                  </div>
                ))}
                <Button disabled={!canEditTenancy} className="w-full rounded-xl gap-2 font-bold h-11" onClick={() => { if (!canEditTenancy) return; brandingService.update({ whiteLabel }); toast.success('Configuración de tenancy guardada'); }}>
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

        {/* â•â•â•â•â•â•â•â•â•â• TAB: MONEDA & CAMBIO â•â•â•â•â•â•â•â•â•â• */}
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

        {/* â•â•â•â•â•â•â•â•â•â• TAB: DOMINIOS â•â•â•â•â•â•â•â•â•â• */}
        {false && <TabsContent value="dominios" className="space-y-6 mt-0">
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
        </TabsContent>}

        {/* â•â•â•â•â•â•â•â•â•â• TAB: PRECIOS (Super Admin only) â•â•â•â•â•â•â•â•â•â• */}
        <TabsContent value="precios" className="space-y-6 mt-0">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 font-black text-lg">
                      <DollarSign className="size-5 text-primary" />Precificación de Módulos
                    </CardTitle>
                    <CardDescription>Administrá los precios mensuales de cada módulo del ERP</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar módulo..." 
                        value={pricingSearch}
                        onChange={e => setPricingSearch(e.target.value)}
                        className="h-9 w-48 rounded-xl pl-9 text-xs" 
                      />
                    </div>
                    <Button 
                      onClick={async () => {
                        setPricingSaving(true);
                        try {
                          const entries = Object.entries(pricingEdits).map(([mod, price]) => ({ module: mod, price }));
                          if (entries.length > 0) {
                            await modulePricingService.bulkUpsert(entries);
                          }
                          setPricingEdits({});
                          await fetchPricing();
                          toast.success('Precios actualizados correctamente');
                        } catch {
                          toast.error('Error al guardar precios');
                        } finally {
                          setPricingSaving(false);
                        }
                      }}
                      disabled={!canEditModulePricing || pricingSaving || Object.keys(pricingEdits).length === 0}
                      className="rounded-xl gap-2 font-bold h-9 text-xs"
                    >
                      {pricingSaving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Guardar Cambios
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {pricingLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <RefreshCw className="size-8 animate-spin text-primary/30" />
                  </div>
                ) : (
                  <div className="space-y-8">
                    {PRICING_MODULES.map(group => {
                      const filtered = group.modules.filter(m => 
                        m.label.toLowerCase().includes(pricingSearch.toLowerCase())
                      );
                      if (filtered.length === 0) return null;
                      return (
                        <div key={group.category}>
                          <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 ml-1">
                            {group.category}
                          </h4>
                          <div className="rounded-2xl border border-border/40 overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/20">
                                <tr>
                                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground w-1/3">Módulo</th>
                                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Precio Mensual (USD)</th>
                                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Acción</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {filtered.map(mod => {
                                  const currentPrice = pricingEdits[mod.id] ?? pricingData.find(p => p.module === mod.id)?.price ?? 0;
                                  const hasChanged = pricingEdits[mod.id] !== undefined && pricingEdits[mod.id] !== pricingData.find(p => p.module === mod.id)?.price;
                                  return (
                                    <tr key={mod.id} className={cn('hover:bg-muted/10 transition-colors', hasChanged && 'bg-amber-500/5')}>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                            <mod.icon className="size-4 text-primary" />
                                          </div>
                                          <div>
                                            <p className="text-sm font-bold">{mod.label}</p>
                                            <p className="text-[10px] text-muted-foreground">{mod.id}</p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 max-w-[200px]">
                                          <span className="text-xs text-muted-foreground font-bold">$</span>
                                          <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={currentPrice}
                                            disabled={!canEditModulePricing}
                                            onChange={e => {
                                              const val = parseFloat(e.target.value) || 0;
                                              setPricingEdits(prev => ({ ...prev, [mod.id]: val }));
                                            }}
                                            className="h-9 rounded-xl text-sm font-bold w-28"
                                          />
                                          <span className="text-[10px] text-muted-foreground">/mes</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        {pricingData.find(p => p.module === mod.id)?.id ? (
                                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-black">
                                            Creado
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] font-black">
                                            Nuevo
                                          </Badge>
                                        )}
                                        {hasChanged && (
                                          <Badge className="ml-2 bg-blue-500/10 text-blue-500 border-blue-500/20 text-[9px] font-black">
                            Editado
                                          </Badge>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* â•â•â•â•â•â•â•â•â•â• TAB: PLATAFORMA (Super Admin only) â•â•â•â•â•â•â•â•â•â• */}
        <TabsContent value="paises" className="space-y-6 mt-0">
          <CountriesView canEdit={canEditCountries} />
        </TabsContent>
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
                    <Switch defaultChecked={value} disabled={!canEditPlatform} onCheckedChange={() => canEditPlatform && toast.success('Configuración actualizada')} />
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
