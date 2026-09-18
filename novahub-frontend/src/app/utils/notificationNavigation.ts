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
  departmentId?: string;
  positionId?: string;
  employeeId?: string;
  payrollId?: string;
  attendanceId?: string;
  leaveRequestId?: string;
  performanceReviewId?: string;
  reviewId?: string;
  trainingId?: string;
  benefitId?: string;
  documentId?: string;
  absenceTypeId?: string;
  payrollConfigId?: string;
  kpiDefinitionId?: string;
  kpiResultId?: string;
  paymentRequestId?: string;
  restaurantOrderId?: string;
  restaurantTableId?: string;
  kitchenTicketId?: string;
  menuCategoryId?: string;
  menuItemId?: string;
  shipmentId?: string;
  trackingEventId?: string;
  receptionPackageId?: string;
  receptionBatchId?: string;
  accountId?: string;
  incomeId?: string;
  financialExpenseId?: string;
  recurringIncomeId?: string;
  recurringExpenseId?: string;
  bankAccountId?: string;
  transactionId?: string;
  journalId?: string;
  periodId?: string;
  reconciliationId?: string;
  fixedAssetId?: string;
  fixedAssetCategoryId?: string;
  exchangeDifferenceRunId?: string;
  fiscalReportId?: string;
  invoiceAuditId?: string;
  budgetItemId?: string;
  expenseCategoryId?: string;
  taxCatalogId?: string;
  costCenterId?: string;
  activityId?: string;
  projectId?: string;
  milestoneId?: string;
  projectTaskId?: string;
  projectDocumentId?: string;
  ticketId?: string;
  supportTicketId?: string;
  legalCaseId?: string;
  legalReminderId?: string;
  financingApplicationId?: string;
  folderId?: string;
  contractId?: string;
  legalInvoiceId?: string;
  reportId?: string;
  conversationId?: string;
  channelId?: string;
  contactId?: string;
  agentId?: string;
  userId?: string;
  roleId?: string;
  subscriptionRequestId?: string;
  domainId?: string;
  branchId?: string;
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
  if (module === 'rh' || module === 'rrhh' || module === 'recursos-humanos') {
    const aliases: Record<string, string> = {
      'dashboard-hr': 'dashboard',
      'configuracion-nomina': 'config-nomina',
      'payroll-config': 'config-nomina',
      'tipos-ausencia': 'ausencias-config',
      'absence-types': 'ausencias-config',
      performance: 'evaluaciones',
      training: 'capacitaciones',
      benefits: 'beneficios',
    };
    return aliases[subModule] || subModule;
  }
  if (module === 'restaurante' || module === 'restaurant') {
    const aliases: Record<string, string> = {
      tables: 'salon',
      orders: 'comandas',
      kitchen: 'cocina',
      menu: 'carta',
      reports: 'reportes',
    };
    return aliases[subModule] || subModule;
  }
  if (module === 'tracking' || module === 'logistica' || module === 'logistics') {
    const aliases: Record<string, string> = {
      'tracking-recepcion': 'reception',
      'tracking-lotes': 'batches',
      'tracking-paquetes': 'packages',
      'tracking-conciliacion': 'reconciliation',
      'tracking-facturacion': 'billing',
      'tracking-configuracion': 'config',
    };
    return aliases[subModule] || subModule;
  }
  if (module === 'actividades' || module === 'activities') {
    const aliases: Record<string, string> = { tasks: 'tareas', events: 'eventos', reminders: 'recordatorios', calendar: 'calendario', meetings: 'reuniones' };
    return aliases[subModule] || subModule;
  }
  if (module === 'proyectos' || module === 'projects') {
    const aliases: Record<string, string> = { project: 'proyectos', tasks: 'tareas', milestones: 'hitos', budget: 'presupuesto', costs: 'costos', members: 'miembros', documents: 'documentos', activities: 'actividades' };
    return aliases[subModule] || subModule;
  }
  if (module === 'asesoria-legal' || module === 'legal') return subModule === 'case' ? 'casos' : subModule === 'reminder' ? 'recordatorios' : subModule;
  if (module === 'financiamiento-pyme' || module === 'financing') return subModule === 'applications' ? 'solicitudes' : subModule;
  if (module === 'soporte-tecnico' || module === 'support') return subModule === 'support-tickets' ? 'tickets' : subModule;
  if (module === 'novachat' || module === 'nova-chat') return subModule === 'conversations' ? 'conversaciones' : subModule;
  if (module === 'suscripciones' || module === 'mi-sucursal' || module === 'my-company') {
    const aliases: Record<string, string> = {
      company: 'empresa',
      users: 'usuarios',
      departments: 'departamentos',
      domain: 'dominio',
    };
    return aliases[subModule] || subModule;
  }
  return subModule;
};

const normalizeNavigation = (value: unknown): NotificationNavigation | null => {
  const navigation = asRecord(value);
  const rawModule = String(navigation.module || '').trim();
  if (!rawModule) return null;
  const moduleKey = rawModule.toLowerCase();
  const module = moduleKey === 'restaurant' ? 'restaurante' : moduleKey === 'logistica' || moduleKey === 'logistics' ? 'tracking' : rawModule;
  const subModule = canonicalSubModule(moduleKey, String(navigation.subModule || '').trim().toLowerCase());
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
      'departmentId',
      'positionId',
      'employeeId',
      'payrollId',
      'attendanceId',
      'leaveRequestId',
      'performanceReviewId',
      'reviewId',
      'trainingId',
      'benefitId',
      'documentId',
      'absenceTypeId',
      'payrollConfigId',
      'kpiDefinitionId',
      'kpiResultId',
      'paymentRequestId',
      'restaurantOrderId',
      'restaurantTableId',
      'kitchenTicketId',
      'menuCategoryId',
      'menuItemId',
      'shipmentId',
      'trackingEventId',
      'receptionPackageId',
      'receptionBatchId',
      'accountId',
      'incomeId',
      'financialExpenseId',
      'recurringIncomeId',
      'recurringExpenseId',
      'bankAccountId',
      'transactionId',
      'journalId',
      'journalEntryId',
      'periodId',
      'reconciliationId',
      'fixedAssetId',
      'fixedAssetCategoryId',
      'exchangeDifferenceRunId',
      'fiscalReportId',
      'invoiceAuditId',
      'budgetItemId',
      'expenseCategoryId',
      'taxCatalogId',
      'costCenterId',
      'activityId',
      'projectId',
      'milestoneId',
      'projectTaskId',
      'projectDocumentId',
      'ticketId',
      'supportTicketId',
      'legalCaseId',
      'legalReminderId',
      'financingApplicationId',
      'folderId',
      'contractId',
      'legalInvoiceId',
      'reportId',
      'conversationId',
      'channelId',
      'contactId',
      'agentId',
      'userId',
      'roleId',
      'subscriptionRequestId',
      'domainId',
    ]),
    number: firstValue(navigation, [
      'number',
      'entityNumber',
      'invoiceNumber',
      'orderNumber',
      'creditNumber',
      'documentNumber',
      'employeeNumber',
      'payrollNumber',
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
    departmentId: firstValue(navigation, ['departmentId']),
    positionId: firstValue(navigation, ['positionId']),
    employeeId: firstValue(navigation, ['employeeId']),
    payrollId: firstValue(navigation, ['payrollId']),
    attendanceId: firstValue(navigation, ['attendanceId']),
    leaveRequestId: firstValue(navigation, ['leaveRequestId']),
    performanceReviewId: firstValue(navigation, ['performanceReviewId', 'reviewId']),
    reviewId: firstValue(navigation, ['reviewId', 'performanceReviewId']),
    trainingId: firstValue(navigation, ['trainingId']),
    benefitId: firstValue(navigation, ['benefitId']),
    documentId: firstValue(navigation, ['documentId']),
    absenceTypeId: firstValue(navigation, ['absenceTypeId']),
    payrollConfigId: firstValue(navigation, ['payrollConfigId']),
    kpiDefinitionId: firstValue(navigation, ['kpiDefinitionId']),
    kpiResultId: firstValue(navigation, ['kpiResultId']),
    paymentRequestId: firstValue(navigation, ['paymentRequestId']),
    restaurantOrderId: firstValue(navigation, ['restaurantOrderId']),
    restaurantTableId: firstValue(navigation, ['restaurantTableId']),
    kitchenTicketId: firstValue(navigation, ['kitchenTicketId']),
    menuCategoryId: firstValue(navigation, ['menuCategoryId']),
    menuItemId: firstValue(navigation, ['menuItemId']),
    shipmentId: firstValue(navigation, ['shipmentId']),
    trackingEventId: firstValue(navigation, ['trackingEventId']),
    receptionPackageId: firstValue(navigation, ['receptionPackageId']),
    receptionBatchId: firstValue(navigation, ['receptionBatchId']),
    activityId: firstValue(navigation, ['activityId']),
    projectId: firstValue(navigation, ['projectId']),
    milestoneId: firstValue(navigation, ['milestoneId']),
    projectTaskId: firstValue(navigation, ['projectTaskId']),
    projectDocumentId: firstValue(navigation, ['projectDocumentId']),
    ticketId: firstValue(navigation, ['ticketId']),
    supportTicketId: firstValue(navigation, ['supportTicketId']),
    legalCaseId: firstValue(navigation, ['legalCaseId']),
    legalReminderId: firstValue(navigation, ['legalReminderId']),
    financingApplicationId: firstValue(navigation, ['financingApplicationId']),
    folderId: firstValue(navigation, ['folderId']),
    contractId: firstValue(navigation, ['contractId']),
    legalInvoiceId: firstValue(navigation, ['legalInvoiceId']),
    reportId: firstValue(navigation, ['reportId']),
    conversationId: firstValue(navigation, ['conversationId']),
    channelId: firstValue(navigation, ['channelId']),
    contactId: firstValue(navigation, ['contactId']),
    agentId: firstValue(navigation, ['agentId']),
    userId: firstValue(navigation, ['userId']),
    roleId: firstValue(navigation, ['roleId']),
    subscriptionRequestId: firstValue(navigation, ['subscriptionRequestId']),
    domainId: firstValue(navigation, ['domainId']),
    branchId: firstValue(navigation, ['branchId']),
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
    'departmentId',
    'positionId',
    'employeeId',
    'payrollId',
    'attendanceId',
    'leaveRequestId',
    'performanceReviewId',
    'reviewId',
    'trainingId',
    'benefitId',
    'documentId',
    'absenceTypeId',
    'payrollConfigId',
    'kpiDefinitionId',
    'kpiResultId',
    'paymentRequestId',
    'restaurantOrderId',
    'restaurantTableId',
    'kitchenTicketId',
    'menuCategoryId',
    'menuItemId',
    'shipmentId',
    'trackingEventId',
    'receptionPackageId',
    'receptionBatchId',
    'activityId',
    'projectId',
    'milestoneId',
    'projectTaskId',
    'projectDocumentId',
    'ticketId',
    'supportTicketId',
    'legalCaseId',
    'legalReminderId',
    'financingApplicationId',
    'folderId',
    'contractId',
    'legalInvoiceId',
    'reportId',
    'conversationId',
    'channelId',
    'contactId',
    'agentId',
    'userId',
    'roleId',
    'subscriptionRequestId',
    'domainId',
  ]);
  const number = firstValue(metadata, [
    'invoiceNumber',
    'orderNumber',
    'creditNumber',
    'entityNumber',
    'documentNumber',
    'employeeNumber',
    'payrollNumber',
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
    departmentId: firstValue(metadata, ['departmentId']),
    positionId: firstValue(metadata, ['positionId']),
    employeeId: firstValue(metadata, ['employeeId']),
    payrollId: firstValue(metadata, ['payrollId']),
    attendanceId: firstValue(metadata, ['attendanceId']),
    leaveRequestId: firstValue(metadata, ['leaveRequestId']),
    performanceReviewId: firstValue(metadata, ['performanceReviewId', 'reviewId']),
    reviewId: firstValue(metadata, ['reviewId', 'performanceReviewId']),
    trainingId: firstValue(metadata, ['trainingId']),
    benefitId: firstValue(metadata, ['benefitId']),
    documentId: firstValue(metadata, ['documentId']),
    absenceTypeId: firstValue(metadata, ['absenceTypeId']),
    payrollConfigId: firstValue(metadata, ['payrollConfigId']),
    kpiDefinitionId: firstValue(metadata, ['kpiDefinitionId']),
    kpiResultId: firstValue(metadata, ['kpiResultId']),
    paymentRequestId: firstValue(metadata, ['paymentRequestId']),
    restaurantOrderId: firstValue(metadata, ['restaurantOrderId']),
    restaurantTableId: firstValue(metadata, ['restaurantTableId']),
    kitchenTicketId: firstValue(metadata, ['kitchenTicketId']),
    menuCategoryId: firstValue(metadata, ['menuCategoryId']),
    menuItemId: firstValue(metadata, ['menuItemId']),
    shipmentId: firstValue(metadata, ['shipmentId']),
    trackingEventId: firstValue(metadata, ['trackingEventId']),
    receptionPackageId: firstValue(metadata, ['receptionPackageId']),
    receptionBatchId: firstValue(metadata, ['receptionBatchId']),
    accountId: firstValue(metadata, ['accountId']),
    incomeId: firstValue(metadata, ['incomeId']),
    financialExpenseId: firstValue(metadata, ['financialExpenseId', 'expenseId']),
    recurringIncomeId: firstValue(metadata, ['recurringIncomeId']),
    recurringExpenseId: firstValue(metadata, ['recurringExpenseId']),
    bankAccountId: firstValue(metadata, ['bankAccountId']),
    transactionId: firstValue(metadata, ['transactionId']),
    journalId: firstValue(metadata, ['journalId', 'journalEntryId']),
    periodId: firstValue(metadata, ['periodId']),
    reconciliationId: firstValue(metadata, ['reconciliationId']),
    fixedAssetId: firstValue(metadata, ['fixedAssetId', 'assetId']),
    fixedAssetCategoryId: firstValue(metadata, ['fixedAssetCategoryId']),
    exchangeDifferenceRunId: firstValue(metadata, ['exchangeDifferenceRunId', 'exchangeRunId']),
    fiscalReportId: firstValue(metadata, ['fiscalReportId']),
    invoiceAuditId: firstValue(metadata, ['invoiceAuditId', 'auditId']),
    budgetItemId: firstValue(metadata, ['budgetItemId']),
    expenseCategoryId: firstValue(metadata, ['expenseCategoryId']),
    taxCatalogId: firstValue(metadata, ['taxCatalogId']),
    costCenterId: firstValue(metadata, ['costCenterId']),
    activityId: firstValue(metadata, ['activityId']),
    projectId: firstValue(metadata, ['projectId']),
    milestoneId: firstValue(metadata, ['milestoneId']),
    projectTaskId: firstValue(metadata, ['projectTaskId']),
    projectDocumentId: firstValue(metadata, ['projectDocumentId']),
    ticketId: firstValue(metadata, ['ticketId']),
    supportTicketId: firstValue(metadata, ['supportTicketId']),
    legalCaseId: firstValue(metadata, ['legalCaseId']),
    legalReminderId: firstValue(metadata, ['legalReminderId']),
    financingApplicationId: firstValue(metadata, ['financingApplicationId']),
    folderId: firstValue(metadata, ['folderId']),
    contractId: firstValue(metadata, ['contractId']),
    legalInvoiceId: firstValue(metadata, ['legalInvoiceId']),
    reportId: firstValue(metadata, ['reportId']),
    conversationId: firstValue(metadata, ['conversationId']),
    channelId: firstValue(metadata, ['channelId']),
    contactId: firstValue(metadata, ['contactId']),
    agentId: firstValue(metadata, ['agentId']),
    userId: firstValue(metadata, ['userId']),
    roleId: firstValue(metadata, ['roleId']),
    subscriptionRequestId: firstValue(metadata, ['subscriptionRequestId']),
    domainId: firstValue(metadata, ['domainId']),
    branchId: firstValue(metadata, ['branchId']),
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
