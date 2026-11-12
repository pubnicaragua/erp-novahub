import {
  BarChart3, BookOpen, Briefcase, Building2, CalendarDays, Folder, DollarSign, FileText, Home, Lightbulb, Mail,
  Megaphone, Phone, Settings, Server, ShieldCheck, ShoppingCart, Sparkles, Star, Truck, Users, Wrench,
  type LucideIcon,
} from 'lucide-react';

/** Iconos que se pueden elegir para una categoría. Las claves son las mismas que valida el backend. */
export const CATEGORY_ICON_OPTIONS: Array<{ key: string; label: string; Icon: LucideIcon }> = [
  { key: 'folder', label: 'Carpeta', Icon: Folder },
  { key: 'megaphone', label: 'Redes y comunicación', Icon: Megaphone },
  { key: 'lightbulb', label: 'Ideas', Icon: Lightbulb },
  { key: 'book', label: 'Seguimiento', Icon: BookOpen },
  { key: 'briefcase', label: 'Gestión', Icon: Briefcase },
  { key: 'wrench', label: 'Mantenimiento', Icon: Wrench },
  { key: 'users', label: 'Personas', Icon: Users },
  { key: 'server', label: 'Sistemas', Icon: Server },
  { key: 'cog', label: 'Operaciones', Icon: Settings },
  { key: 'building', label: 'Infraestructura', Icon: Building2 },
  { key: 'truck', label: 'Entregas', Icon: Truck },
  { key: 'phone', label: 'Llamadas', Icon: Phone },
  { key: 'chart', label: 'Reportes', Icon: BarChart3 },
  { key: 'shield', label: 'Seguridad', Icon: ShieldCheck },
  { key: 'star', label: 'Importante', Icon: Star },
  { key: 'calendar', label: 'Calendario', Icon: CalendarDays },
  { key: 'file', label: 'Documentos', Icon: FileText },
  { key: 'mail', label: 'Correo', Icon: Mail },
  { key: 'cart', label: 'Compras', Icon: ShoppingCart },
  { key: 'dollar', label: 'Finanzas', Icon: DollarSign },
  { key: 'home', label: 'Inicio', Icon: Home },
  { key: 'sparkles', label: 'Otros', Icon: Sparkles },
];

const ICONS = new Map(CATEGORY_ICON_OPTIONS.map((option) => [option.key, option.Icon]));

export function getCategoryIcon(key?: string | null): LucideIcon {
  return (key && ICONS.get(key)) || Folder;
}

export interface CategoryColorStyle {
  /** Fondo suave + texto: etiquetas y cuadro del icono. */
  chip: string;
  /** Punto sólido para el selector de color. */
  dot: string;
  /** Borde de la tarjeta de la categoría activa. */
  ring: string;
}

// Clases escritas completas: Tailwind no genera las que se arman con plantillas.
const COLORS: Record<string, CategoryColorStyle> = {
  slate: { chip: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', dot: 'bg-slate-500', ring: 'border-slate-500/50' },
  blue: { chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-300', dot: 'bg-blue-500', ring: 'border-blue-500/50' },
  emerald: { chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', dot: 'bg-emerald-500', ring: 'border-emerald-500/50' },
  amber: { chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500', ring: 'border-amber-500/50' },
  rose: { chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-300', dot: 'bg-rose-500', ring: 'border-rose-500/50' },
  violet: { chip: 'bg-violet-500/10 text-violet-600 dark:text-violet-300', dot: 'bg-violet-500', ring: 'border-violet-500/50' },
  cyan: { chip: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300', dot: 'bg-cyan-500', ring: 'border-cyan-500/50' },
  orange: { chip: 'bg-orange-500/10 text-orange-600 dark:text-orange-300', dot: 'bg-orange-500', ring: 'border-orange-500/50' },
  pink: { chip: 'bg-pink-500/10 text-pink-600 dark:text-pink-300', dot: 'bg-pink-500', ring: 'border-pink-500/50' },
  teal: { chip: 'bg-teal-500/10 text-teal-600 dark:text-teal-300', dot: 'bg-teal-500', ring: 'border-teal-500/50' },
};

export const CATEGORY_COLOR_KEYS = Object.keys(COLORS);

const NEUTRAL: CategoryColorStyle = { chip: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/50', ring: 'border-primary/50' };

export function getCategoryColor(key?: string | null): CategoryColorStyle {
  return (key && COLORS[key]) || NEUTRAL;
}
