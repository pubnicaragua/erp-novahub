export interface NotificationNavigation {
  module: string;
  subModule?: string;
  filter?: string;
  targetId?: string;
}

type NotificationLike = {
  title?: string | null;
  message?: string | null;
  content?: string | null;
  link?: string | null;
  metadata?: unknown;
};

const asRecord = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const normalizeNavigation = (value: unknown): NotificationNavigation | null => {
  const navigation = asRecord(value);
  const module = String(navigation.module || '').trim();
  if (!module) return null;
  const subModule = String(navigation.subModule || '').trim();
  const filter = navigation.filter ? String(navigation.filter) : undefined;
  return { module, subModule: subModule || undefined, filter };
};

export function getNotificationNavigation(notification: NotificationLike): NotificationNavigation {
  const metadata = asRecord(notification.metadata);
  const targetId = String(metadata.targetId || metadata.expenseId || metadata.entityId || '').trim() || undefined;
  const explicit = normalizeNavigation(metadata.navigation || metadata.route || metadata);
  if (explicit) return { ...explicit, targetId };

  const link = String(notification.link || '').toLowerCase();
  if (link.includes('ticket')) return { module: 'tickets', subModule: 'tickets' };
  if (link.includes('suscrip')) return { module: 'suscripciones' };
  if (link.includes('factur')) return { module: 'ventas', subModule: 'facturas' };

  const text = `${notification.title || ''} ${notification.message || notification.content || ''}`.toLowerCase();
  if (text.startsWith('tarea:') || text.includes('tarea asignada')) return { module: 'actividades', subModule: 'tareas' };
  if (text.startsWith('recordatorio:') || text.includes('recordatorio')) return { module: 'actividades', subModule: 'recordatorios' };
  if (text.includes('nómina') || text.includes('nomina') || text.includes('payroll')) return { module: 'rh', subModule: 'nominas' };
  if (text.includes('asistencia') || text.includes('marcado su entrada') || text.includes('marcado su salida')) return { module: 'rh', subModule: 'asistencia' };
  if (text.includes('gasto recurrente')) return { module: 'compras', subModule: 'gastos-recurrentes' };
  if (text.includes('factura recurrente')) return { module: 'ventas', subModule: 'facturas-recurrentes' };
  if (text.includes('factura') && text.includes('vencida')) return { module: 'finanzas', subModule: 'cuentas-cobrar' };
  if (text.includes('próximo cobro') || text.includes('proximo cobro') || text.includes('trial') || text.includes('suspendida por mora')) return { module: 'suscripciones' };

  return { module: 'notificaciones', subModule: 'alertas' };
}

export function navigateToNotification(notification: NotificationLike) {
  const navigation = getNotificationNavigation(notification);
  const metadata = asRecord(notification.metadata);
  const filter = asRecord(metadata.navigation || metadata)?.filter;
  const detail = filter ? { ...navigation, filter } : navigation;
  window.dispatchEvent(new CustomEvent('navigate-module', { detail }));
}
