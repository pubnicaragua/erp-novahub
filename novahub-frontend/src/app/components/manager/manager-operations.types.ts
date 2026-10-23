import {
  Activity,
  Banknote,
  CalendarDays,
  Cloud,
  FolderKanban,
  FileText,
  Hotel,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  Bell,
  Package,
  Plane,
  Scale,
  Ticket,
  Utensils,
  ListTodo,
  Calculator,
  Gauge,
  History,
  Camera,
  BookOpen,
  FileStack,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ManagerOperationsModule } from '../../services/enterprise-groups.service';

export type ManagerOperationView = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export type ManagerOperationDefinition = {
  id: ManagerOperationsModule;
  label: string;
  icon: LucideIcon;
  views: ManagerOperationView[];
};

export const MANAGER_OPERATION_DEFINITIONS: ManagerOperationDefinition[] = [
  {
    id: 'activities',
    label: 'Actividades',
    icon: Activity,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'activities', label: 'Actividades', icon: Activity },
      { id: 'calendar', label: 'Calendario', icon: CalendarDays },
      { id: 'meetings', label: 'Reuniones', icon: CalendarDays },
      { id: 'reminders', label: 'Recordatorios', icon: CalendarDays },
      { id: 'logs', label: 'Bitácora', icon: ListChecks },
    ],
  },
  {
    id: 'projects',
    label: 'Proyectos',
    icon: FolderKanban,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'projects', label: 'Proyectos', icon: FolderKanban },
      { id: 'tasks', label: 'Tareas', icon: ListChecks },
      { id: 'milestones', label: 'Hitos', icon: ListChecks },
      { id: 'costs', label: 'Costos', icon: Banknote },
      { id: 'budget', label: 'Presupuesto', icon: Banknote },
      { id: 'resources', label: 'Recursos', icon: Activity },
      { id: 'documents', label: 'Documentos', icon: Cloud },
      { id: 'activities', label: 'Actividades', icon: Activity },
      { id: 'quotes', label: 'Cotizaciones de materiales', icon: FileStack },
      { id: 'costing', label: 'Costeo 6D', icon: Calculator },
      { id: 'baselines', label: 'Líneas base', icon: ListChecks },
      { id: 'evm', label: 'EVM', icon: Gauge },
      { id: 'progress', label: 'Avances', icon: History },
      { id: 'evidence', label: 'Evidencias', icon: Camera },
      { id: 'memories', label: 'Memorias de cálculo', icon: BookOpen },
    ],
  },
  {
    id: 'tickets',
    label: 'Tickets',
    icon: Ticket,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'tickets', label: 'Tickets', icon: Ticket },
      { id: 'categories', label: 'Categorías', icon: ListChecks },
      { id: 'faqs', label: 'Base de conocimiento', icon: Cloud },
      { id: 'agents', label: 'Agentes', icon: Activity },
    ],
  },
  {
    id: 'documents',
    label: 'Nova Cloud',
    icon: Cloud,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'documents', label: 'Archivos', icon: Cloud },
      { id: 'reports', label: 'Reportes guardados', icon: ListChecks },
      { id: 'contracts', label: 'Contratos', icon: FileText },
      { id: 'invoices', label: 'Facturas legales', icon: Banknote },
      { id: 'folders', label: 'Carpetas', icon: FolderKanban },
    ],
  },
  {
    id: 'restaurant',
    label: 'Restaurante',
    icon: Utensils,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'orders', label: 'Comandas', icon: ListChecks },
      { id: 'kitchen', label: 'Cocina', icon: Utensils },
      { id: 'tables', label: 'Mesas', icon: Utensils },
      { id: 'menu', label: 'Carta', icon: Utensils },
      { id: 'reports', label: 'Reportes', icon: ListChecks },
    ],
  },
  {
    id: 'hotel',
    label: 'Hotel',
    icon: Hotel,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'rooms', label: 'Habitaciones', icon: Hotel },
      { id: 'calendar', label: 'Calendario', icon: CalendarDays },
      { id: 'reservations', label: 'Reservas', icon: ListChecks },
      { id: 'stays', label: 'Estadías', icon: ListChecks },
    ],
  },
  {
    id: 'logistics',
    label: 'Tracking de Importaciones',
    icon: Package,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'shipments', label: 'Envíos', icon: Package },
      { id: 'packages', label: 'Paquetes', icon: Package },
      { id: 'batches', label: 'Recepciones', icon: ListChecks },
      { id: 'reconciliation', label: 'Conciliación', icon: Scale },
      { id: 'billing', label: 'Facturación', icon: Banknote },
    ],
  },
  {
    id: 'intl-imports',
    label: 'Importaciones Internacionales',
    icon: Plane,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'origin', label: 'Origen', icon: Package },
      { id: 'containers', label: 'Contenedores', icon: ListChecks },
      { id: 'customs', label: 'Aduana y prorrateo', icon: Scale },
    ],
  },
  {
    id: 'asana',
    label: 'Asana',
    icon: ListTodo,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'boards', label: 'Tableros', icon: FolderKanban },
      { id: 'tasks', label: 'Tareas', icon: ListChecks },
    ],
  },
  {
    id: 'notifications',
    label: 'Notificaciones',
    icon: Bell,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'alerts', label: 'Alertas', icon: Bell },
      { id: 'push', label: 'Push', icon: Bell },
    ],
  },
  {
    id: 'financing',
    label: 'Financiamiento PYME',
    icon: Banknote,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'applications', label: 'Solicitudes', icon: ListChecks },
    ],
  },
  {
    id: 'legal',
    label: 'Asesoría legal',
    icon: Scale,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'cases', label: 'Casos', icon: Scale },
      { id: 'reminders', label: 'Recordatorios', icon: CalendarDays },
    ],
  },
  {
    id: 'novachat',
    label: 'Nova Suite',
    icon: MessageCircle,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'conversations', label: 'Conversaciones', icon: MessageCircle },
      { id: 'channels', label: 'Canales', icon: Cloud },
      { id: 'contacts', label: 'Contactos', icon: Activity },
      { id: 'agents', label: 'Agentes', icon: Activity },
    ],
  },
  {
    id: 'support',
    label: 'Soporte técnico',
    icon: Wrench,
    views: [
      { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
      { id: 'tickets', label: 'Tickets', icon: Ticket },
    ],
  },
];

export const MANAGER_OPERATION_VIEWS = Object.fromEntries(
  MANAGER_OPERATION_DEFINITIONS.map((definition) => [definition.id, definition.views]),
) as Record<ManagerOperationsModule, ManagerOperationView[]>;

