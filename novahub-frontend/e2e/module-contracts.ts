export type E2eScenario =
  | 'happy-path'
  | 'validation-4xx'
  | 'permission-denied'
  | 'module-disabled'
  | 'cross-tenant'
  | 'branch-or-warehouse-scope'
  | 'idempotent-repeat'
  | 'transaction-rollback'
  | 'teardown';

export interface E2eModuleContract {
  moduleId: string;
  sourceController?: string;
  apiProbe?: { method: 'GET'; path: string };
  /** PENDIENTE identifica una garantía que el backend aún no expone. */
  idempotencyContract?: 'required' | 'pending' | 'not-applicable';
  /** Permite documentar la cobertura por operación cuando un módulo es mixto. */
  idempotencyOperations?: Readonly<Record<string, 'required' | 'pending' | 'not-applicable'>>;
  scope: 'tenant' | 'platform' | 'public' | 'ui-only';
  persistenceModels: readonly string[];
  invariants: readonly string[];
  scenarios: readonly E2eScenario[];
}

const BASE_SCENARIOS: readonly E2eScenario[] = [
  'happy-path',
  'validation-4xx',
  'permission-denied',
  'module-disabled',
  'cross-tenant',
  'branch-or-warehouse-scope',
  'idempotent-repeat',
  'transaction-rollback',
  'teardown',
];

/**
 * Contratos de prueba trazados a los controllers realmente existentes en
 * Backend/src. `apiProbe` solo es una lectura segura para confirmar el límite
 * HTTP; no sustituye el flujo mutante ni la aserción directa en Prisma.
 */
export const E2E_MODULE_CONTRACTS: readonly E2eModuleContract[] = [
  { moduleId: 'overview', apiProbe: { method: 'GET', path: '/auth/profile' }, scope: 'tenant', persistenceModels: ['ClientTenant'], invariants: ['tenant'], scenarios: BASE_SCENARIOS },
  { moduleId: 'inventario', sourceController: 'inventory/inventory.controller.ts', apiProbe: { method: 'GET', path: '/inventory/products' }, idempotencyContract: 'pending', idempotencyOperations: { 'products.create': 'pending', 'stock.update': 'pending', 'transfers.create': 'pending' }, scope: 'tenant', persistenceModels: ['Product', 'ProductVariant', 'Warehouse', 'InventoryLevel', 'InventoryMovement'], invariants: ['tenant', 'branch-or-warehouse', 'non-negative-stock', 'kardex'], scenarios: BASE_SCENARIOS },
  { moduleId: 'ventas', sourceController: 'sales/sales.controller.ts', apiProbe: { method: 'GET', path: '/sales/orders' }, idempotencyContract: 'required', idempotencyOperations: { 'estimates.create': 'required', 'orders.create': 'required', 'orders.convert-to-invoice': 'required', 'invoices.create': 'required', 'payments.create': 'required', 'returns.process': 'required', 'credit-notes.issue': 'required' }, scope: 'tenant', persistenceModels: ['Customer', 'SalesOrder', 'Invoice', 'PaymentReceived', 'JournalEntry'], invariants: ['tenant', 'branch-or-warehouse', 'state-transition', 'idempotency', 'balanced-accounting'], scenarios: BASE_SCENARIOS },
  { moduleId: 'restaurante', sourceController: 'restaurant/restaurant.controller.ts', apiProbe: { method: 'GET', path: '/restaurant/tables' }, idempotencyContract: 'pending', idempotencyOperations: { 'orders.create': 'pending', 'orders.send-to-kitchen': 'pending', 'orders.checkout': 'pending' }, scope: 'tenant', persistenceModels: ['RestaurantTable', 'RestaurantOrder', 'Invoice'], invariants: ['tenant', 'idempotency', 'cash-and-accounting'], scenarios: BASE_SCENARIOS },
  { moduleId: 'tracking', sourceController: 'tracking/tracking.controller.ts', apiProbe: { method: 'GET', path: '/tracking/shipments' }, idempotencyContract: 'pending', idempotencyOperations: { 'shipments.create': 'pending', 'events.create': 'pending', 'lookup': 'pending' }, scope: 'tenant', persistenceModels: ['TrackingShipment', 'TrackingEvent'], invariants: ['tenant', 'state-transition', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'compras', sourceController: 'purchases/purchases.controller.ts', apiProbe: { method: 'GET', path: '/purchases/orders' }, idempotencyContract: 'pending', idempotencyOperations: { 'orders.create': 'required', 'orders.approve': 'required', 'receipts.create': 'pending', 'receipts.update': 'required', 'receipts.approve': 'pending' }, scope: 'tenant', persistenceModels: ['Supplier', 'PurchaseOrder', 'PurchaseReceipt', 'SupplierInvoice', 'InventoryMovement', 'JournalEntry'], invariants: ['tenant', 'branch-or-warehouse', 'state-transition', 'kardex', 'balanced-accounting'], scenarios: BASE_SCENARIOS },
  { moduleId: 'finanzas', sourceController: 'financials/financials.controller.ts', apiProbe: { method: 'GET', path: '/financials/accounts' }, scope: 'tenant', persistenceModels: ['FinancialExpense', 'Income', 'BankAccount', 'CashRegister'], invariants: ['tenant', 'balanced-accounting', 'currency'], scenarios: BASE_SCENARIOS },
  { moduleId: 'rh', sourceController: 'hr/hr.controller.ts', apiProbe: { method: 'GET', path: '/hr/employees' }, scope: 'tenant', persistenceModels: ['Employee', 'Department', 'Payroll'], invariants: ['tenant', 'branch-scope', 'state-transition'], scenarios: BASE_SCENARIOS },
  { moduleId: 'clientes', sourceController: 'sales/sales.controller.ts', apiProbe: { method: 'GET', path: '/sales/customers' }, idempotencyContract: 'pending', idempotencyOperations: { 'customers.create': 'pending', 'customers.update': 'pending' }, scope: 'tenant', persistenceModels: ['Customer'], invariants: ['tenant', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'proveedores', sourceController: 'purchases/purchases.controller.ts', apiProbe: { method: 'GET', path: '/purchases/suppliers' }, idempotencyContract: 'pending', idempotencyOperations: { 'suppliers.create': 'pending', 'suppliers.update': 'pending' }, scope: 'tenant', persistenceModels: ['Supplier'], invariants: ['tenant', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'actividades', sourceController: 'activities/activities.controller.ts', apiProbe: { method: 'GET', path: '/activities/tasks' }, scope: 'tenant', persistenceModels: ['Activity', 'Task', 'Reminder', 'ActivityLog'], invariants: ['tenant', 'assignee-scope', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'proyectos', sourceController: 'projects/projects.controller.ts', apiProbe: { method: 'GET', path: '/projects' }, scope: 'tenant', persistenceModels: ['Project', 'Task', 'ProjectMilestone', 'ProjectCost'], invariants: ['tenant', 'branch-scope', 'idempotency', 'history'], idempotencyContract: 'pending', idempotencyOperations: { 'projects.create': 'required', 'projects.costs.create': 'pending' }, scenarios: BASE_SCENARIOS },
  { moduleId: 'fuerza-comercial', sourceController: 'force-sales/force-sales.controller.ts', apiProbe: { method: 'GET', path: '/force-sales/prospects' }, scope: 'platform', persistenceModels: ['SalesProspect'], invariants: ['platform-role', 'assignee-scope', 'global-catalog'], scenarios: BASE_SCENARIOS },
  { moduleId: 'tickets', sourceController: 'tools/tools.controller.ts', apiProbe: { method: 'GET', path: '/tools/tickets' }, scope: 'tenant', persistenceModels: ['Ticket', 'TicketComment', 'TicketAudit'], invariants: ['tenant', 'actor-scope', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'documentos', sourceController: 'documents/documents.controller.ts', apiProbe: { method: 'GET', path: '/documents/files' }, scope: 'tenant', persistenceModels: ['Document', 'TenantDocument'], invariants: ['tenant', 'ownership', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'notificaciones', sourceController: 'notifications/notifications.controller.ts', apiProbe: { method: 'GET', path: '/notifications/inbox' }, scope: 'tenant', persistenceModels: ['Notification'], invariants: ['tenant', 'recipient-scope', 'deduplication'], scenarios: BASE_SCENARIOS },
  { moduleId: 'transferencias', sourceController: 'inventory/inventory.controller.ts', apiProbe: { method: 'GET', path: '/inventory/transfers' }, scope: 'tenant', persistenceModels: ['Transfer', 'TransferItem', 'InventoryMovement', 'InventoryLevel'], invariants: ['tenant', 'branch-or-warehouse', 'non-negative-stock', 'atomicity'], scenarios: BASE_SCENARIOS },
  { moduleId: 'reportes', sourceController: 'sales/sales.controller.ts', apiProbe: { method: 'GET', path: '/sales/reports/summary' }, scope: 'tenant', persistenceModels: ['Invoice', 'PurchaseOrder', 'InventoryLevel', 'Employee'], invariants: ['tenant', 'branch-scope', 'read-consistency'], scenarios: BASE_SCENARIOS },
  { moduleId: 'configuracion', sourceController: 'branding/branding.controller.ts', apiProbe: { method: 'GET', path: '/branding/current' }, scope: 'tenant', persistenceModels: ['ClientTenant'], invariants: ['tenant', 'theme-tokens'], scenarios: BASE_SCENARIOS },
  { moduleId: 'suscripciones', sourceController: 'subscriptions/subscriptions.controller.ts', apiProbe: { method: 'GET', path: '/subscriptions/requests' }, scope: 'tenant', persistenceModels: ['ModuleSubscription', 'SubscriptionRequest'], invariants: ['tenant', 'module-entitlement', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'tenant-admin', sourceController: 'enterprise-groups/enterprise-groups.controller.ts', apiProbe: { method: 'GET', path: '/enterprise-groups/platform' }, scope: 'platform', persistenceModels: ['EnterpriseGroup', 'BusinessUnit', 'Branch'], invariants: ['platform-role', 'tenant-boundary', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'schema', scope: 'platform', persistenceModels: [], invariants: ['platform-role'], scenarios: BASE_SCENARIOS },
  { moduleId: 'financiamiento-pyme', sourceController: 'financing/financing.controller.ts', apiProbe: { method: 'GET', path: '/financing/applications' }, scope: 'tenant', persistenceModels: ['FinancingApplication', 'FinancingDocument'], invariants: ['tenant', 'state-transition', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'centro-capacitacion', sourceController: 'training/training.controller.ts', apiProbe: { method: 'GET', path: '/training-videos' }, scope: 'tenant', persistenceModels: ['ERPTrainingVideo'], invariants: ['tenant-or-public', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'soporte-tecnico', sourceController: 'support-tickets/support-tickets.controller.ts', apiProbe: { method: 'GET', path: '/support-tickets/my' }, scope: 'tenant', persistenceModels: ['SupportTicket'], invariants: ['tenant', 'actor-scope', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'contabilidad', sourceController: 'accounting/accounting.controller.ts', apiProbe: { method: 'GET', path: '/accounting/accounts' }, scope: 'tenant', persistenceModels: ['Account', 'JournalEntry', 'JournalEntryLine', 'AccountingConfig'], invariants: ['tenant', 'balanced-accounting', 'source-reference', 'period-lock'], scenarios: BASE_SCENARIOS },
  { moduleId: 'asesoria-legal', sourceController: 'legal/legal.controller.ts', apiProbe: { method: 'GET', path: '/legal/cases' }, scope: 'tenant', persistenceModels: ['LegalCase', 'LegalReminder'], invariants: ['tenant', 'ownership', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'novachat', sourceController: 'novachat/novachat.controller.ts', apiProbe: { method: 'GET', path: '/novachat/conversations' }, scope: 'tenant', persistenceModels: ['ChatConversation', 'ChatMessage'], invariants: ['tenant', 'recipient-scope', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'qa-console', sourceController: 'qa-console/qa-console.controller.ts', apiProbe: { method: 'GET', path: '/qa/checks' }, scope: 'platform', persistenceModels: ['QaCheck', 'QaFinding', 'QaComment'], invariants: ['platform-role', 'history'], scenarios: BASE_SCENARIOS },
  { moduleId: 'guia-implementacion', scope: 'platform', persistenceModels: [], invariants: ['platform-role'], scenarios: BASE_SCENARIOS },
] as const;
