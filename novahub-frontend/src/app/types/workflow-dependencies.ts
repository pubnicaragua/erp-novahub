export type WorkflowDependencyState =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'forbidden'
  | 'out_of_scope'
  | 'error';

export interface WorkflowLookupOption {
  id: string;
  code?: string | null;
  name: string;
  status?: string | null;
  [key: string]: unknown;
}

export interface WorkflowDependencyResult<T extends WorkflowLookupOption = WorkflowLookupOption> {
  state: WorkflowDependencyState;
  data: T[];
  message?: string;
  code?: string;
}

export interface WorkflowDependencyContract {
  key: string;
  consumerPermissions: ReadonlyArray<{ module: string; action: string }>;
  lookupEndpoint: string;
  backendAction: string;
  lookupFields: readonly string[];
  conditionalFields?: Readonly<{ when: string; fields: readonly string[] }>;
  scope: 'TENANT' | 'DOCUMENT_WAREHOUSE' | 'BRANCH';
  required: boolean;
  messages: Record<'loading' | 'empty' | 'forbidden' | 'outOfScope' | 'error', string>;
  errorCodes: readonly string[];
}

export const WORKFLOW_DEPENDENCIES: Record<string, WorkflowDependencyContract> = {
  PURCHASE_REQUEST_APPROVAL_SUPPLIER: {
    key: 'PURCHASE_REQUEST_APPROVAL_SUPPLIER',
    consumerPermissions: [{ module: 'PURCHASES_REQUESTS', action: 'read' }, { module: 'PURCHASES_REQUESTS', action: 'approve' }],
    lookupEndpoint: '/purchases/lookups/suppliers',
    backendAction: 'purchases.requests.approve',
    lookupFields: ['id', 'code', 'name', 'status'],
    scope: 'TENANT',
    required: true,
    messages: {
      loading: 'Cargando proveedores autorizados para este flujo...',
      empty: 'No hay proveedores activos disponibles para la solicitud y el alcance actual.',
      forbidden: 'No tienes permiso para consultar proveedores en este flujo.',
      outOfScope: 'El proveedor o la solicitud están fuera del alcance actual.',
      error: 'No se pudo consultar el catálogo de proveedores. Reintenta antes de aprobar.',
    },
    errorCodes: ['DEPENDENCY_FORBIDDEN', 'DEPENDENCY_OUT_OF_SCOPE', 'DEPENDENCY_EMPTY', 'DEPENDENCY_UNAVAILABLE'],
  },
  PURCHASE_PAYMENT_SUPPLIER_INVOICE: {
    key: 'PURCHASE_PAYMENT_SUPPLIER_INVOICE',
    consumerPermissions: [{ module: 'PURCHASES_PAYMENTS', action: 'read' }],
    lookupEndpoint: '/purchases/lookups/invoices',
    backendAction: 'purchases.payments.create',
    lookupFields: ['id', 'number', 'supplierId', 'supplierName', 'total', 'balance', 'currency', 'dueDate', 'status'],
    scope: 'DOCUMENT_WAREHOUSE',
    required: true,
    messages: {
      loading: 'Cargando facturas de proveedor disponibles...',
      empty: 'No hay facturas de proveedor pendientes dentro del alcance actual.',
      forbidden: 'No tienes permiso para consultar facturas de proveedor para este pago.',
      outOfScope: 'La factura de proveedor está fuera del alcance de la bodega o sucursal.',
      error: 'No se pudo consultar el catálogo de facturas de proveedor.',
    },
    errorCodes: ['DEPENDENCY_FORBIDDEN', 'DEPENDENCY_OUT_OF_SCOPE', 'DEPENDENCY_EMPTY', 'DEPENDENCY_UNAVAILABLE'],
  },
  FINANCE_SOURCE_DOCUMENT_READ: {
    key: 'FINANCE_SOURCE_DOCUMENT_READ',
    consumerPermissions: [{ module: 'FINANCIAL', action: 'read' }],
    lookupEndpoint: '/financials/source-documents/lookup',
    backendAction: 'financials.source.read',
    lookupFields: [
      'id', 'number', 'date', 'dueDate', 'status', 'total', 'balance',
      'currency', 'exchangeRate', 'customerId', 'customerCode', 'customerName',
      'supplierId', 'supplierCode', 'supplierName', 'origin',
    ],
    scope: 'BRANCH',
    required: false,
    messages: {
      loading: 'Cargando documentos de origen autorizados...',
      empty: 'No hay documentos de origen disponibles para esta sucursal.',
      forbidden: 'La lectura del módulo origen es necesaria para mostrar este detalle financiero.',
      outOfScope: 'El documento de origen está fuera de la sucursal actual.',
      error: 'No se pudo consultar el detalle del documento de origen.',
    },
    errorCodes: ['SOURCE_READ_REQUIRED', 'DEPENDENCY_OUT_OF_SCOPE', 'DEPENDENCY_UNAVAILABLE'],
  },
  SUPPLIER_LOOKUP: {
    key: 'SUPPLIER_LOOKUP',
    consumerPermissions: [{ module: 'PURCHASES_PROVIDERS', action: 'read' }, { module: 'PURCHASES_REQUESTS', action: 'read' }, { module: 'PURCHASES_ORDERS', action: 'read' }, { module: 'PURCHASES_RECEIPTS', action: 'read' }, { module: 'PURCHASES_PAYMENTS', action: 'read' }, { module: 'PURCHASES_RETURNS', action: 'read' }, { module: 'PURCHASES_EXPENSES', action: 'read' }, { module: 'PURCHASES_EXPENSES_REC', action: 'read' }, { module: 'PROJECTS_EXPENSES', action: 'read' }, { module: 'TRACKING_RECONCILIATION', action: 'read' }],
    lookupEndpoint: '/purchases/lookups/suppliers',
    backendAction: 'purchases.lookup.suppliers',
    lookupFields: ['id', 'code', 'name', 'status'],
    scope: 'TENANT',
    required: true,
    messages: { loading: 'Cargando proveedores autorizados...', empty: 'No hay proveedores activos disponibles.', forbidden: 'No tienes permiso para consultar proveedores en este flujo.', outOfScope: 'El proveedor está fuera de la empresa activa.', error: 'No se pudo consultar el catálogo de proveedores.' },
    errorCodes: ['DEPENDENCY_FORBIDDEN', 'DEPENDENCY_OUT_OF_SCOPE', 'DEPENDENCY_EMPTY', 'DEPENDENCY_UNAVAILABLE'],
  },
  CUSTOMER_LOOKUP: {
    key: 'CUSTOMER_LOOKUP',
    consumerPermissions: [{ module: 'SALES_CLIENTS', action: 'read' }, { module: 'SALES_QUOTES', action: 'read' }, { module: 'SALES_ORDERS', action: 'read' }, { module: 'SALES_INVOICES', action: 'read' }, { module: 'SALES_PAYMENTS', action: 'read' }, { module: 'SALES_RETURNS', action: 'read' }, { module: 'SALES_RECURRING', action: 'read' }, { module: 'SALES_CREDIT_NOTES', action: 'read' }, { module: 'TICKETS', action: 'read' }, { module: 'TICKETS_LIST', action: 'read' }, { module: 'TRACKING_RECEPTION', action: 'read' }, { module: 'TRACKING_BATCHES', action: 'read' }, { module: 'TRACKING_BILLING', action: 'read' }, { module: 'ACTIVITIES_EVENTS', action: 'read' }, { module: 'RESTAURANT_ORDERS', action: 'read' }, { module: 'PROJECTS', action: 'read' }, { module: 'PROJECTS_LIST', action: 'read' }, { module: 'PROJECTS_TASKS', action: 'read' }, { module: 'PROJECTS_EXPENSES', action: 'read' }],
    lookupEndpoint: '/sales/customers/lookup',
    backendAction: 'sales.lookup.customers',
    lookupFields: ['id', 'code', 'name', 'status'],
    conditionalFields: { when: 'purpose=TRACKING_WHATSAPP', fields: ['phone'] },
    scope: 'TENANT',
    required: true,
    messages: { loading: 'Cargando clientes autorizados...', empty: 'No hay clientes activos disponibles.', forbidden: 'No tienes permiso para consultar clientes en este flujo.', outOfScope: 'El cliente está fuera de la empresa activa.', error: 'No se pudo consultar el catálogo de clientes.' },
    errorCodes: ['DEPENDENCY_FORBIDDEN', 'DEPENDENCY_OUT_OF_SCOPE', 'DEPENDENCY_EMPTY', 'DEPENDENCY_UNAVAILABLE'],
  },
  PRODUCT_LOOKUP: {
    key: 'PRODUCT_LOOKUP',
    consumerPermissions: [{ module: 'INVENTORY_PRODUCTS', action: 'read' }, { module: 'INVENTORY_SERVICES', action: 'read' }, { module: 'SALES_QUOTES', action: 'read' }, { module: 'SALES_ORDERS', action: 'read' }, { module: 'SALES_INVOICES', action: 'read' }, { module: 'SALES_RECURRING', action: 'read' }, { module: 'SALES_RETURNS', action: 'read' }, { module: 'SALES_CREDIT_NOTES', action: 'read' }, { module: 'PURCHASES_ORDERS', action: 'read' }, { module: 'PURCHASES_RECEIPTS', action: 'read' }, { module: 'PURCHASES_INVOICES_REC', action: 'read' }, { module: 'PURCHASES_RETURNS', action: 'read' }, { module: 'TICKETS', action: 'read' }, { module: 'TICKETS_LIST', action: 'read' }],
    lookupEndpoint: '/inventory/products/lookup',
    backendAction: 'inventory.lookup.products',
    lookupFields: ['id', 'code', 'name', 'categoryId', 'category', 'type', 'taxRate', 'isActive', 'variants', 'stockLevels', 'commercialNote'],
    conditionalFields: { when: 'purpose=PURCHASES', fields: ['costPrice'] },
    scope: 'DOCUMENT_WAREHOUSE',
    required: true,
    messages: { loading: 'Cargando productos autorizados...', empty: 'No hay productos activos disponibles para el alcance actual.', forbidden: 'No tienes permiso para consultar productos en este flujo.', outOfScope: 'El producto no está disponible en la bodega o sucursal seleccionada.', error: 'No se pudo consultar el catálogo de productos.' },
    errorCodes: ['DEPENDENCY_FORBIDDEN', 'DEPENDENCY_OUT_OF_SCOPE', 'DEPENDENCY_EMPTY', 'DEPENDENCY_UNAVAILABLE'],
  },
  ASSIGNEE_LOOKUP: {
    key: 'ASSIGNEE_LOOKUP',
    consumerPermissions: [{ module: 'CONFIG_USERS', action: 'read' }, { module: 'ACTIVITIES_TASKS', action: 'read' }, { module: 'ACTIVITIES_REMINDERS', action: 'read' }, { module: 'ACTIVITIES_EVENTS', action: 'read' }, { module: 'PROJECTS_TASKS', action: 'read' }, { module: 'TICKETS_LIST', action: 'read' }, { module: 'TICKETS_AGENTS', action: 'read' }, { module: 'TRACKING_RECEPTION', action: 'read' }, { module: 'TRACKING_BATCHES', action: 'read' }, { module: 'TRACKING_PACKAGES', action: 'read' }],
    lookupEndpoint: '/users/lookups/assignees',
    backendAction: 'users.lookup.assignees',
    lookupFields: ['id', 'name', 'userType', 'role', 'isActive', 'department'],
    scope: 'TENANT',
    required: true,
    messages: { loading: 'Cargando usuarios asignables...', empty: 'No hay usuarios activos disponibles.', forbidden: 'No tienes permiso para consultar usuarios asignables.', outOfScope: 'El usuario está fuera de la empresa activa.', error: 'No se pudo consultar los usuarios asignables.' },
    errorCodes: ['DEPENDENCY_FORBIDDEN', 'DEPENDENCY_OUT_OF_SCOPE', 'DEPENDENCY_EMPTY', 'DEPENDENCY_UNAVAILABLE'],
  },
  DEPARTMENT_LOOKUP: {
    key: 'DEPARTMENT_LOOKUP',
    consumerPermissions: [{ module: 'HR_DEPARTMENTS', action: 'read' }, { module: 'CONFIG_DEPARTMENTS', action: 'read' }, { module: 'HR_EMPLOYEES', action: 'read' }, { module: 'ACTIVITIES_REMINDERS', action: 'read' }],
    lookupEndpoint: '/hr/lookups/departments',
    backendAction: 'hr.lookup.departments',
    lookupFields: ['id', 'code', 'name', 'type', 'status'],
    scope: 'TENANT',
    required: true,
    messages: { loading: 'Cargando departamentos autorizados...', empty: 'No hay departamentos activos disponibles.', forbidden: 'No tienes permiso para consultar departamentos en este flujo.', outOfScope: 'El departamento está fuera de la empresa activa.', error: 'No se pudo consultar el catálogo de departamentos.' },
    errorCodes: ['DEPENDENCY_FORBIDDEN', 'DEPENDENCY_OUT_OF_SCOPE', 'DEPENDENCY_EMPTY', 'DEPENDENCY_UNAVAILABLE'],
  },
  POSITION_LOOKUP: {
    key: 'POSITION_LOOKUP',
    consumerPermissions: [{ module: 'HR_DEPARTMENTS', action: 'read' }, { module: 'CONFIG_DEPARTMENTS', action: 'read' }, { module: 'HR_EMPLOYEES', action: 'read' }],
    lookupEndpoint: '/hr/lookups/positions',
    backendAction: 'hr.lookup.positions',
    lookupFields: ['id', 'code', 'title', 'departmentId', 'department', 'status'],
    scope: 'TENANT',
    required: true,
    messages: { loading: 'Cargando puestos autorizados...', empty: 'No hay puestos activos disponibles.', forbidden: 'No tienes permiso para consultar puestos en este flujo.', outOfScope: 'El puesto está fuera de la empresa activa.', error: 'No se pudo consultar el catálogo de puestos.' },
    errorCodes: ['DEPENDENCY_FORBIDDEN', 'DEPENDENCY_OUT_OF_SCOPE', 'DEPENDENCY_EMPTY', 'DEPENDENCY_UNAVAILABLE'],
  },
  ACCOUNT_LOOKUP: {
    key: 'ACCOUNT_LOOKUP',
    consumerPermissions: [{ module: 'FINANCIAL_ACCOUNTS', action: 'read' }, { module: 'FINANCIAL_EXPENSES', action: 'read' }, { module: 'FINANCIAL_INCOMES', action: 'read' }, { module: 'ACTIVITIES_EVENTS', action: 'read' }, { module: 'ACTIVITIES_CALENDAR', action: 'read' }, { module: 'ACTIVITIES_MEETINGS', action: 'read' }, { module: 'PROJECTS_EXPENSES', action: 'read' }],
    lookupEndpoint: '/financials/accounts/lookup',
    backendAction: 'financials.lookup.accounts',
    lookupFields: ['id', 'code', 'name', 'type', 'subtype', 'isActive', 'acceptsPostings'],
    scope: 'TENANT',
    required: true,
    messages: { loading: 'Cargando cuentas contables autorizadas...', empty: 'No hay cuentas posteables activas disponibles.', forbidden: 'No tienes permiso para consultar cuentas en este flujo.', outOfScope: 'La cuenta no pertenece a la empresa activa.', error: 'No se pudo consultar el catálogo de cuentas.' },
    errorCodes: ['DEPENDENCY_FORBIDDEN', 'DEPENDENCY_OUT_OF_SCOPE', 'DEPENDENCY_EMPTY', 'DEPENDENCY_UNAVAILABLE'],
  },
  PURCHASE_ORDER_LOOKUP: {
    key: 'PURCHASE_ORDER_LOOKUP',
    consumerPermissions: [{ module: 'PURCHASES_ORDERS', action: 'read' }, { module: 'PURCHASES_RECEIPTS', action: 'read' }, { module: 'TRACKING_RECONCILIATION', action: 'read' }, { module: 'TRACKING_RECEPTION', action: 'read' }, { module: 'TRACKING_BATCHES', action: 'read' }],
    lookupEndpoint: '/purchases/lookups/orders',
    backendAction: 'purchases.lookup.orders',
    lookupFields: ['id', 'number', 'status', 'date', 'supplierId', 'supplier', 'warehouseId'],
    scope: 'DOCUMENT_WAREHOUSE',
    required: true,
    messages: { loading: 'Cargando órdenes de compra autorizadas...', empty: 'No hay órdenes de compra disponibles para el alcance actual.', forbidden: 'No tienes permiso para consultar órdenes de compra en este flujo.', outOfScope: 'La orden de compra está fuera de la bodega o sucursal seleccionada.', error: 'No se pudo consultar el catálogo de órdenes de compra.' },
    errorCodes: ['DEPENDENCY_FORBIDDEN', 'DEPENDENCY_OUT_OF_SCOPE', 'DEPENDENCY_EMPTY', 'DEPENDENCY_UNAVAILABLE'],
  },
  RESTAURANT_REGISTER_LOOKUP: {
    key: 'RESTAURANT_REGISTER_LOOKUP',
    consumerPermissions: [{ module: 'RESTAURANT_ORDERS', action: 'read' }, { module: 'RETAIL_POS', action: 'read' }, { module: 'RETAIL_CASH_CONTROL', action: 'read' }],
    lookupEndpoint: '/caja/registers/lookup',
    backendAction: 'restaurant.checkout',
    lookupFields: ['id', 'name', 'isActive', 'warehouseId'],
    scope: 'BRANCH',
    required: true,
    messages: { loading: 'Cargando cajas autorizadas...', empty: 'No hay cajas activas disponibles para el cierre.', forbidden: 'No tienes permiso para consultar la caja necesaria para cerrar la orden.', outOfScope: 'La caja está fuera de la sucursal o alcance actual.', error: 'No se pudo consultar las cajas disponibles.' },
    errorCodes: ['DEPENDENCY_FORBIDDEN', 'DEPENDENCY_OUT_OF_SCOPE', 'DEPENDENCY_EMPTY', 'DEPENDENCY_UNAVAILABLE'],
  },
};

export const WORKFLOW_DEPENDENCY_KEYS = Object.freeze(
  Object.fromEntries(Object.keys(WORKFLOW_DEPENDENCIES).map((key) => [key, key])) as {
    [key: string]: string;
  },
);

export function workflowDependencyState(input: {
  isLoading?: boolean;
  isError?: boolean;
  data?: unknown;
  forbidden?: boolean;
  outOfScope?: boolean;
}): WorkflowDependencyState {
  if (input.isLoading) return 'loading';
  if (input.forbidden) return 'forbidden';
  if (input.outOfScope) return 'out_of_scope';
  if (input.isError) return 'error';
  const values = Array.isArray(input.data) ? input.data : (input.data as any)?.data;
  return Array.isArray(values) && values.length > 0 ? 'ready' : 'empty';
}
