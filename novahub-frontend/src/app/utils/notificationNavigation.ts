export interface NotificationNavigation {
  module: string;
  subModule?: string;
  section?: 'dashboard' | 'session' | 'history';
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
  registerId?: string;
  productId?: string;
  productCode?: string;
  expenseId?: string;
  holdId?: string;
  attributeId?: string;
  categoryId?: string;
  brandId?: string;
  warehouseId?: string;
  transferId?: string;
  adjustmentId?: string;
  auditId?: string;
  movementId?: string;
  assetId?: string;
}

type NotificationLike = {
  title?: string | null;
  message?: string | null;
  content?: string | null;
  link?: string | null;
  metadata?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
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

const canonicalSubModule = (module: string, subModule: string) => {
  if (module === 'ventas' && subModule === 'cotizaciones') return 'estimaciones';
  if (module === 'compras' && subModule === 'solicitudes-compra') return 'solicitudes';
  if (module === 'compras' && subModule === 'ordenes-compra') return 'ordenes';
  if (module === 'compras' && subModule === 'gastos-recurrentes') return 'gastos-rec';
  if (module === 'compras' && subModule === 'facturas-recurrentes') return 'facturas-rec';
  return subModule;
};

const normalizeNavigation = (value: unknown): NotificationNavigation | null => {
  const navigation = asRecord(value);
  const module = String(navigation.module || '').trim();
  if (!module) return null;
  const subModule = canonicalSubModule(module.toLowerCase(), String(navigation.subModule || '').trim().toLowerCase());
  const filter = navigation.filter ? String(navigation.filter) : undefined;
  const section = ['dashboard', 'session', 'history'].includes(String(navigation.section || '').trim())
    ? String(navigation.section).trim() as NotificationNavigation['section']
    : undefined;
  return {
    module,
    subModule: subModule || undefined,
    filter,
    section,
    targetId: firstValue(navigation, [
      'targetId',
      'entityId',
      'invoiceId',
      'orderId',
      'creditNoteId',
      'requestId',
      'queueId',
      'sessionId',
      'registerId',
      'cashRegisterId',
      'expenseId',
      'productId',
      'attributeId',
      'categoryId',
      'brandId',
      'warehouseId',
      'transferId',
      'adjustmentId',
      'auditId',
      'movementId',
      'assetId',
    ]),
    number: firstValue(navigation, [
      'number',
      'entityNumber',
      'invoiceNumber',
      'orderNumber',
      'creditNumber',
      'documentNumber',
      'productCode',
      'code',
    ]),
    invoiceId: firstValue(navigation, ['invoiceId']),
    orderId: firstValue(navigation, ['orderId']),
    creditNoteId: firstValue(navigation, ['creditNoteId']),
    requestId: firstValue(navigation, ['requestId']),
    queueId: firstValue(navigation, ['queueId']),
    sessionId: firstValue(navigation, ['sessionId']),
    registerId: firstValue(navigation, ['registerId', 'cashRegisterId']),
    productId: firstValue(navigation, ['productId']),
    productCode: firstValue(navigation, ['productCode']),
    expenseId: firstValue(navigation, ['expenseId']),
    holdId: firstValue(navigation, ['holdId']),
    attributeId: firstValue(navigation, ['attributeId']),
    categoryId: firstValue(navigation, ['categoryId']),
    brandId: firstValue(navigation, ['brandId']),
    warehouseId: firstValue(navigation, ['warehouseId']),
    transferId: firstValue(navigation, ['transferId']),
    adjustmentId: firstValue(navigation, ['adjustmentId']),
    auditId: firstValue(navigation, ['auditId']),
    movementId: firstValue(navigation, ['movementId']),
    assetId: firstValue(navigation, ['assetId']),
  };
};

const firstValue = (metadata: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = String(metadata[key] ?? '').trim();
    if (value) return value;
  }
  return undefined;
};

const extractTarget = (metadata: Record<string, unknown>): Partial<NotificationNavigation> => {
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
    'cashRegisterId',
    'registerId',
    'holdId',
    'expenseId',
    'productId',
    'attributeId',
    'categoryId',
    'brandId',
    'warehouseId',
    'transferId',
    'adjustmentId',
    'auditId',
    'movementId',
    'assetId',
  ]);
  const number = firstValue(metadata, [
    'invoiceNumber',
    'orderNumber',
    'creditNumber',
    'entityNumber',
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
    registerId: firstValue(metadata, ['registerId', 'cashRegisterId']),
    productId: firstValue(metadata, ['productId']),
    productCode: firstValue(metadata, ['productCode']),
    expenseId: firstValue(metadata, ['expenseId']),
    holdId: firstValue(metadata, ['holdId']),
    attributeId: firstValue(metadata, ['attributeId']),
    categoryId: firstValue(metadata, ['categoryId']),
    brandId: firstValue(metadata, ['brandId']),
    warehouseId: firstValue(metadata, ['warehouseId']),
    transferId: firstValue(metadata, ['transferId']),
    adjustmentId: firstValue(metadata, ['adjustmentId']),
    auditId: firstValue(metadata, ['auditId']),
    movementId: firstValue(metadata, ['movementId']),
    assetId: firstValue(metadata, ['assetId']),
  };
};

const withTarget = (navigation: NotificationNavigation, target: Partial<NotificationNavigation>) => ({
  ...navigation,
  ...Object.fromEntries(Object.entries(target).filter(([, value]) => Boolean(value))),
});

export function getNotificationNavigation(notification: NotificationLike): NotificationNavigation {
  const metadata = asRecord(notification.metadata);
  const target = extractTarget(metadata);
  const link = String(notification.link || '').toLowerCase();
  const ticketIdFromLink = link.match(/\/tickets\/([^/?#]+)/)?.[1];
  const text = `${notification.title || ''} ${notification.message || notification.content || ''}`.toLowerCase();

  // Este aviso lo genera el ciclo de facturación del tenant, no las cuentas
  // por cobrar del negocio. La metadata antigua apuntaba a Finanzas, por lo
  // que corregimos el destino en el cliente hasta que llegue una ruta nueva.
  if (
    String(notification.title || '').trim().toLowerCase() === 'facturas vencidas'
    && (text.includes('suspensión del servicio') || text.includes('suspension del servicio'))
  ) {
    return withTarget({ module: 'suscripciones' }, target);
  }

  const explicit = normalizeNavigation(metadata.navigation || metadata.route || metadata);
  if (explicit) return withTarget(explicit, { ...target, targetId: target.targetId || ticketIdFromLink });

  if (link.includes('ticket')) {
    return withTarget({ module: 'tickets', subModule: 'tickets' }, {
      ...target,
      targetId: target.targetId || ticketIdFromLink,
    });
  }
  if (link.includes('suscrip')) return withTarget({ module: 'suscripciones' }, target);
  if (link.includes('factur')) return withTarget({ module: 'ventas', subModule: 'facturas' }, target);

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
  window.dispatchEvent(new CustomEvent('navigate-module', { detail }));
}
