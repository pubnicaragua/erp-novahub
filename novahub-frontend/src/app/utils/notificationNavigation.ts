export interface NotificationNavigation {
  module: string;
  subModule?: string;
  filter?: string;
  targetId?: string;
  number?: string;
  invoiceId?: string;
  orderId?: string;
  creditNoteId?: string;
  taskId?: string;
  reminderId?: string;
  eventId?: string;
  requestId?: string;
  queueId?: string;
  sessionId?: string;
  productId?: string;
  productCode?: string;
  expenseId?: string;
  holdId?: string;
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

const firstValue = (metadata: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = String(metadata[key] ?? '').trim();
    if (value) return value;
  }
  return undefined;
};

const extractTarget = (metadata: Record<string, any>): Partial<NotificationNavigation> => {
  const targetId = firstValue(metadata, [
    'targetId',
    'entityId',
    'invoiceId',
    'orderId',
    'creditNoteId',
    'creditId',
    'taskId',
    'reminderId',
    'eventId',
    'requestId',
    'queueId',
    'sessionId',
    'holdId',
    'expenseId',
    'productId',
  ]);
  const number = firstValue(metadata, [
    'invoiceNumber',
    'orderNumber',
    'creditNumber',
    'documentNumber',
    'number',
    'productCode',
    'code',
  ]);

  return {
    targetId,
    number,
    invoiceId: firstValue(metadata, ['invoiceId']),
    orderId: firstValue(metadata, ['orderId']),
    creditNoteId: firstValue(metadata, ['creditNoteId']),
    taskId: firstValue(metadata, ['taskId']),
    reminderId: firstValue(metadata, ['reminderId']),
    eventId: firstValue(metadata, ['eventId']),
    requestId: firstValue(metadata, ['requestId']),
    queueId: firstValue(metadata, ['queueId']),
    sessionId: firstValue(metadata, ['sessionId']),
    productId: firstValue(metadata, ['productId']),
    productCode: firstValue(metadata, ['productCode']),
    expenseId: firstValue(metadata, ['expenseId']),
    holdId: firstValue(metadata, ['holdId']),
  };
};

const withTarget = (navigation: NotificationNavigation, target: Partial<NotificationNavigation>) => ({
  ...navigation,
  ...Object.fromEntries(Object.entries(target).filter(([, value]) => Boolean(value))),
});

export function getNotificationNavigation(notification: NotificationLike): NotificationNavigation {
  const metadata = asRecord(notification.metadata);
  const target = extractTarget(metadata);
  const explicit = normalizeNavigation(metadata.navigation || metadata.route || metadata);
  if (explicit) return withTarget(explicit, target);

  const link = String(notification.link || '').toLowerCase();
  if (link.includes('ticket')) return withTarget({ module: 'tickets', subModule: 'tickets' }, target);
  if (link.includes('suscrip')) return withTarget({ module: 'suscripciones' }, target);
  if (link.includes('factur')) return withTarget({ module: 'ventas', subModule: 'facturas' }, target);

  const text = `${notification.title || ''} ${notification.message || notification.content || ''}`.toLowerCase();
  if (text.startsWith('tarea:') || text.includes('tarea asignada')) return withTarget({ module: 'actividades', subModule: 'tareas' }, target);
  if (text.startsWith('recordatorio:') || text.includes('recordatorio')) return withTarget({ module: 'actividades', subModule: 'recordatorios' }, target);
  if (text.includes('nómina') || text.includes('nomina') || text.includes('payroll')) return withTarget({ module: 'rh', subModule: 'nominas' }, target);
  if (text.includes('asistencia') || text.includes('marcado su entrada') || text.includes('marcado su salida')) return withTarget({ module: 'rh', subModule: 'asistencia' }, target);
  if (text.includes('gasto recurrente')) return withTarget({ module: 'compras', subModule: 'gastos-recurrentes' }, target);
  if (text.includes('factura recurrente')) return withTarget({ module: 'ventas', subModule: 'facturas-recurrentes' }, target);
  if (text.includes('factura') && text.includes('vencida')) return withTarget({ module: 'finanzas', subModule: 'cuentas-cobrar' }, target);
  if (text.includes('próximo cobro') || text.includes('proximo cobro') || text.includes('trial') || text.includes('suspendida por mora')) return withTarget({ module: 'suscripciones' }, target);

  return withTarget({ module: 'notificaciones', subModule: 'alertas' }, target);
}

export function navigateToNotification(notification: NotificationLike) {
  const navigation = getNotificationNavigation(notification);
  const detail = { ...navigation };
  if (navigation.subModule === 'entregas' && navigation.targetId) {
    try {
      sessionStorage.setItem('pending-pos-hold-focus', navigation.targetId);
    } catch {
      // El foco es opcional; la navegación sigue funcionando sin almacenamiento local.
    }
  }
  window.dispatchEvent(new CustomEvent('navigate-module', { detail }));
}
