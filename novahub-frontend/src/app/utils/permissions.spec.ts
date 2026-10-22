import assert from 'node:assert/strict';
import { test } from 'node:test';
import { approvalActionValue, getPermissionActionKeys, hydratePermissionActions, permissionValue, serializePermissionActions } from './permissions.ts';
import { getLegalCaseStatusPermissionAction, LEGAL_CASE_STATUS_OPTIONS } from './legalWorkflow.ts';
import { canShowInvoiceSubmitAction, getInvoicePaymentBalance, shouldSubmitExistingDraftBeforePayment } from './invoicePaymentWorkflow.ts';

test('legacy approve grants hydrate the new expense actions', () => {
  assert.equal(permissionValue({ approve: true }, 'submit'), true);
  assert.equal(permissionValue({ approve: true }, 'pay'), true);
  assert.equal(permissionValue({ approve: false }, 'pay'), false);
});

test('editing an old expense role shows inherited actions and persists granular overrides', () => {
  const hydrated = hydratePermissionActions({ module: 'PURCHASES_EXPENSES', approve: true }, 'PURCHASES_EXPENSES');
  assert.equal(hydrated.submit, true);
  assert.equal(hydrated.pay, true);

  const [saved] = serializePermissionActions([{ ...hydrated, submit: false }]);
  assert.equal(saved.approve, true);
  assert.equal(saved.submit, false);
  assert.equal(saved.pay, true);
});

test('expense roles separate cancellation from physical deletion and keep legacy delete access', () => {
  for (const module of ['PURCHASES_EXPENSES', 'FINANCIAL_EXPENSES']) {
    const actions = getPermissionActionKeys(module);
    assert.equal(actions.includes('cancel' as any), true, `${module} exposes cancellation`);
    assert.equal(actions.includes('delete' as any), true, `${module} keeps draft deletion as a separate action`);
    assert.equal(permissionValue({ module, delete: true }, 'cancel' as any, module), true, 'legacy roles retain cancellation');
    assert.equal(permissionValue({ module, delete: true, cancel: false }, 'cancel' as any, module), false, 'explicit cancellation denial wins');
    assert.equal(permissionValue({ module, cancel: true, delete: false }, 'delete', module), false, 'cancellation does not grant physical deletion');
  }
});

test('financial incomes do not offer physical deletion and recurring schedules expose cancellation', () => {
  assert.equal(getPermissionActionKeys('FINANCIAL_INCOMES').includes('delete' as any), false);

  for (const module of ['FINANCIAL_EXPENSES_REC', 'FINANCIAL_INCOMES_REC']) {
    const actions = getPermissionActionKeys(module);
    assert.equal(actions.includes('cancel' as any), true, `${module} exposes cancellation`);
    assert.equal(actions.includes('delete' as any), false, `${module} does not expose physical deletion`);

    const oldRole = hydratePermissionActions({ module, read: true, delete: true }, module);
    assert.equal(oldRole.cancel, true, `${module} keeps cancellation for old roles`);
    assert.equal(Object.hasOwn(oldRole, 'delete'), false, `${module} drops the ghost delete field`);

    const [saved] = serializePermissionActions([{ ...oldRole, cancel: false }]);
    assert.equal(saved.cancel, false, `${module} persists an explicit cancellation denial`);
    assert.equal(Object.hasOwn(saved, 'delete'), false, `${module} no longer serializes delete`);
  }
});

test('explicit granular values override the legacy approve value', () => {
  assert.equal(permissionValue({ approve: true, submit: false }, 'submit'), false);
  assert.equal(permissionValue({ approve: false, pay: true }, 'pay'), true);
});

test('frontend legacy aliases preserve explicit granular denials and grants', () => {
  assert.equal(approvalActionValue({ approve: true, canPay: false }, 'pay'), false);
  assert.equal(approvalActionValue({ approve: false, canSubmit: true }, 'submit'), true);
  assert.equal(approvalActionValue({ approve: true }, 'submit'), true);
});

test('other approval flows keep their current module behavior in the expenses pilot', () => {
  assert.equal(approvalActionValue({ approve: false, authorize: true }, 'authorize'), false);
  assert.equal(approvalActionValue({ authorize: true }, 'authorize'), true);
});

test('Legal matrix separates case transitions, assignment, notes, documents and chat from approve', () => {
  const actions = getPermissionActionKeys('LEGAL_CASES');
  const expected = [
    'startCase', 'requestCaseDocuments', 'returnCaseToPending', 'completeCase', 'cancelCase',
    'assignCase', 'addCaseNote', 'attachCaseDocument', 'sendCaseMessage',
  ];
  for (const action of expected) assert.equal(actions.includes(action as any), true, action);
  assert.equal(actions.includes('approve'), false);

  const legacy = { module: 'LEGAL_CASES', approve: true, edit: true };
  for (const action of expected.slice(0, 6)) {
    assert.equal(permissionValue(legacy, action as any, 'LEGAL_CASES'), true, action);
  }
  for (const action of expected.slice(6)) {
    assert.equal(permissionValue(legacy, action as any, 'LEGAL_CASES'), true, action);
  }
  assert.equal(permissionValue({ ...legacy, startCase: false }, 'startCase' as any, 'LEGAL_CASES'), false);
  assert.equal(permissionValue({ module: 'LEGAL_CASES', create: true }, 'assignCase' as any, 'LEGAL_CASES'), true);
  assert.equal(permissionValue({ module: 'LEGAL_CASES', create: true, assignCase: false }, 'assignCase' as any, 'LEGAL_CASES'), false);
  assert.equal(permissionValue({ ...legacy, sendCaseMessage: false }, 'sendCaseMessage' as any, 'LEGAL_CASES'), false);

  const hydrated = hydratePermissionActions(legacy, 'LEGAL_CASES');
  assert.equal(hydrated.startCase, true);
  assert.equal(hydrated.addCaseNote, true);
  const [saved] = serializePermissionActions([{ ...hydrated, startCase: false, addCaseNote: false }]);
  assert.equal(saved.startCase, false);
  assert.equal(saved.addCaseNote, false);
});

test('Legal case statuses map to one independent action each', () => {
  assert.deepEqual(LEGAL_CASE_STATUS_OPTIONS, ['PENDING', 'IN_PROGRESS', 'WAITING_DOCS', 'COMPLETED', 'CANCELLED']);
  assert.equal(getLegalCaseStatusPermissionAction('PENDING'), 'returnCaseToPending');
  assert.equal(getLegalCaseStatusPermissionAction('IN_PROGRESS'), 'startCase');
  assert.equal(getLegalCaseStatusPermissionAction('WAITING_DOCS'), 'requestCaseDocuments');
  assert.equal(getLegalCaseStatusPermissionAction('COMPLETED'), 'completeCase');
  assert.equal(getLegalCaseStatusPermissionAction('CANCELLED'), 'cancelCase');
  assert.equal(getLegalCaseStatusPermissionAction('INVALID'), undefined);
});

test('Activities matrix separates task, event, meeting and reminder workflow actions', () => {
  const legacyTasks = hydratePermissionActions({ module: 'ACTIVITIES_TASKS', read: true, edit: true, approve: true }, 'ACTIVITIES_TASKS');
  assert.equal(legacyTasks.startTask, true);
  assert.equal(legacyTasks.submit, true);
  assert.equal(legacyTasks.complete, true);
  assert.equal(legacyTasks.approve, true);
  assert.equal(legacyTasks.manageSubtasks, true);
  assert.equal(legacyTasks.reassign, true);

  const [savedTasks] = serializePermissionActions([{ ...legacyTasks, complete: false, approve: true }]);
  assert.equal(savedTasks.complete, false);
  assert.equal(savedTasks.approve, true);
  assert.equal(approvalActionValue(savedTasks, 'complete', 'ACTIVITIES_TASKS'), false);

  const legacyEvents = hydratePermissionActions({ module: 'ACTIVITIES_EVENTS', edit: true, approve: true }, 'ACTIVITIES_EVENTS');
  assert.equal(legacyEvents.complete, true);
  assert.equal(legacyEvents.manageGuests, true);
  assert.equal(getPermissionActionKeys('ACTIVITIES_EVENTS').includes('approve'), false);
  assert.equal(getPermissionActionKeys('ACTIVITIES_MEETINGS').includes('scheduleMeeting'), true);
  assert.equal(getPermissionActionKeys('ACTIVITIES_REMINDERS').includes('changeStatus'), true);
  assert.deepEqual(getPermissionActionKeys('ACTIVITIES_CALENDAR'), ['read', 'export']);
});

test('expense rows offer submit and pay instead of a generic approve control', () => {
  for (const module of ['PURCHASES_EXPENSES', 'FINANCIAL_EXPENSES']) {
    const actions = getPermissionActionKeys(module);
    assert.equal(actions.includes('submit'), true);
    assert.equal(actions.includes('pay'), true);
    assert.equal(actions.includes('approve'), false);
  }
});

test('serialization writes granular values only for modules that expose them', () => {
  const [purchaseExpense, salesClient] = serializePermissionActions([
    { module: 'PURCHASES_EXPENSES', approve: true },
    { module: 'SALES_CLIENTS', approve: true },
  ]);

  assert.equal(purchaseExpense.submit, true);
  assert.equal(purchaseExpense.pay, true);
  assert.equal(Object.hasOwn(salesClient, 'submit'), false);
  assert.equal(Object.hasOwn(salesClient, 'pay'), false);
});

test('legacy request roles hydrate each workflow action from its previous permission', () => {
  const hydrated = hydratePermissionActions({ module: 'PURCHASES_REQUESTS', approve: true, edit: true }, 'PURCHASES_REQUESTS');

  assert.equal(hydrated.submit, true);
  assert.equal(hydrated.approve, true);
  assert.equal(hydrated.cancel, true);
  assert.equal(hydrated.reject, true);
  assert.equal(hydrated.convert, true);
});

test('explicit request workflow values override their legacy permission', () => {
  const legacyRequest = { module: 'PURCHASES_REQUESTS', approve: true, edit: true };
  const limitedRequest = { ...legacyRequest, submit: false, cancel: false, reject: false, convert: false };

  for (const action of ['submit', 'cancel', 'reject', 'convert']) {
    assert.equal(permissionValue(limitedRequest, action as any), false);
  }
  assert.equal(permissionValue({ ...legacyRequest, reject: true }, 'reject' as any), true);
});

test('an explicit request action denial also overrides the legacy manage flag', () => {
  const permission = { module: 'PURCHASES_REQUESTS', manage: true, approve: true, cancel: false };
  assert.equal(approvalActionValue(permission, 'cancel', 'PURCHASES_REQUESTS'), false);
});

test('request role matrix exposes separate workflow actions and keeps them module-scoped', () => {
  const actions = getPermissionActionKeys('PURCHASES_REQUESTS');
  for (const action of ['submit', 'approve', 'cancel', 'reject', 'convert']) assert.equal(actions.includes(action as any), true);

  const [requests, salesClient] = serializePermissionActions([
    { module: 'PURCHASES_REQUESTS', approve: true },
    { module: 'SALES_CLIENTS', approve: true },
  ]);
  for (const action of ['submit', 'cancel', 'reject', 'convert']) assert.equal(typeof requests[action], 'boolean');
  for (const action of ['submit', 'cancel', 'reject', 'convert']) assert.equal(Object.hasOwn(salesClient, action), false);
});

test('other modules keep their current approval resolution', () => {
  assert.equal(approvalActionValue({ module: 'SALES_QUOTES', approve: true, reject: false }, 'reject', 'SALES_QUOTES'), true);
});

test('purchase workflow actions hydrate separately from the historical permissions', () => {
  assert.equal(permissionValue({ module: 'PURCHASES_RECEIPTS', approve: true }, 'receive' as any, 'PURCHASES_RECEIPTS'), true);
  assert.equal(permissionValue({ module: 'PURCHASES_RECEIPTS', approve: true, receive: false }, 'receive' as any, 'PURCHASES_RECEIPTS'), false);
  assert.equal(permissionValue({ module: 'PURCHASES_RECEIPTS', delete: true, cancelInvoice: false }, 'cancelInvoice' as any, 'PURCHASES_RECEIPTS'), false);
  assert.equal(permissionValue({ module: 'PURCHASES_ORDERS', delete: true }, 'reject' as any, 'PURCHASES_ORDERS'), true);
  assert.equal(permissionValue({ module: 'PURCHASES_RETURNS', approve: true, issue: false }, 'issue' as any, 'PURCHASES_RETURNS'), false);
  assert.equal(permissionValue({ module: 'PURCHASES_PAYMENTS', create: true, approve: true }, 'pay' as any, 'PURCHASES_PAYMENTS'), true);
  assert.equal(permissionValue({ module: 'PURCHASES_PAYMENTS', create: true, approve: true, pay: false }, 'pay' as any, 'PURCHASES_PAYMENTS'), false);
});

test('Compras matrix offers action-specific workflow controls', () => {
  const expectedByModule: Record<string, string[]> = {
    PURCHASES_ORDERS: ['submit', 'approve', 'reject'],
    PURCHASES_RECEIPTS: ['receive', 'cancel', 'cancelInvoice', 'retryInventory', 'registerInvoice'],
    PURCHASES_PAYMENTS: ['pay', 'cancel'],
    PURCHASES_RETURNS: ['issue', 'apply', 'void'],
    PURCHASES_EXPENSES_REC: ['pause', 'resume'],
    PURCHASES_INVOICES_REC: ['pause', 'resume', 'cancel'],
  };
  for (const [module, actions] of Object.entries(expectedByModule)) {
    const matrixActions = getPermissionActionKeys(module);
    for (const action of actions) assert.equal(matrixActions.includes(action as any), true, `${module}:${action}`);
  }
});

test('Ventas matrix exposes each confirmed business workflow instead of a blanket approval', () => {
  const expectedByModule: Record<string, string[]> = {
    SALES_QUOTES: ['submit', 'convert'],
    SALES_ORDERS: ['submit', 'approve', 'convert'],
    SALES_INVOICES: ['submit', 'pay', 'sendToCredit', 'sendToCash', 'cancel', 'createPaymentLink', 'reconcilePaymentLink', 'cancelPaymentLink'],
    SALES_PAYMENTS: ['pay', 'cancel'],
    SALES_RECURRING: ['pause', 'resume', 'cancel'],
    SALES_RETURNS: ['approve', 'process', 'reject'],
    SALES_CREDIT_NOTES: ['issue', 'send', 'pay', 'cancel'],
    RETAIL_POS: ['pay', 'reconcile', 'claim', 'release', 'confirm', 'deliver', 'cancel'],
    RETAIL_CASH_CONTROL: ['open', 'movement', 'count', 'close', 'resolve', 'configure'],
  };

  for (const [module, expectedActions] of Object.entries(expectedByModule)) {
    const actions = getPermissionActionKeys(module);
    for (const action of expectedActions) assert.equal(actions.includes(action as any), true, `${module}:${action}`);
  }
  assert.equal(getPermissionActionKeys('SALES_QUOTES').includes('approve'), false);
  assert.equal(getPermissionActionKeys('SALES_INVOICES').includes('approve'), false);
  assert.equal(getPermissionActionKeys('SALES_INVOICES').includes('delete'), true, 'borradores de factura sí se eliminan');
  assert.equal(getPermissionActionKeys('SALES_PAYMENTS').includes('approve'), false);
  assert.equal(getPermissionActionKeys('RETAIL_POS').includes('approve'), false);
  assert.equal(getPermissionActionKeys('RETAIL_CASH_CONTROL').includes('approve'), false);
  assert.equal(getPermissionActionKeys('SALES_ORDERS').includes('delete'), false);
  assert.equal(getPermissionActionKeys('SALES_CREDIT_NOTES').includes('delete'), false);
});

test('Facturas muestra registrar pago y conserva el permiso histórico de Pagos recibidos al editar roles', () => {
  const permissions = [
    { module: 'SALES_INVOICES', read: true },
    { module: 'SALES_PAYMENTS', read: true, pay: true },
  ];
  const invoice = hydratePermissionActions(permissions[0], 'SALES_INVOICES', permissions);
  assert.equal(invoice.pay, true);
  assert.equal(invoice.createPaymentLink, false);

  const [savedInvoice] = serializePermissionActions([{ ...invoice, pay: false }]);
  assert.equal(savedInvoice.pay, false);
  assert.equal(permissionValue(savedInvoice, 'pay' as any, 'SALES_INVOICES'), false);

  const explicitlyEnabled = hydratePermissionActions(
    { module: 'SALES_INVOICES', read: true, pay: false },
    'SALES_INVOICES',
    permissions,
  );
  assert.equal(explicitlyEnabled.pay, false);
});

test('la matriz migra permisos históricos de lotes y oculta acciones que no pertenecen a recepción', () => {
  const legacyPermissions = [
    { module: 'TRACKING_RECEPTION', read: true, create: true, approve: true },
    { module: 'TRACKING_BATCHES', read: true },
  ];
  const reception = hydratePermissionActions(legacyPermissions[0], 'TRACKING_RECEPTION', legacyPermissions);
  const batches = hydratePermissionActions(legacyPermissions[1], 'TRACKING_BATCHES', legacyPermissions);

  assert.equal(reception.receive, true, 'la recepción física conserva el permiso histórico de creación');
  assert.equal(Object.hasOwn(reception, 'create'), false, 'crear un lote no aparece en Recepción');
  assert.equal(Object.hasOwn(reception, 'confirm'), false, 'confirmar un lote no aparece en Recepción');
  assert.equal(batches.create, true, 'crear lotes conserva el permiso heredado');
  assert.equal(batches.confirm, true, 'confirmar lotes conserva la aprobación heredada');

  const explicitDenial = hydratePermissionActions(
    { module: 'TRACKING_BATCHES', read: true, create: false, confirm: false },
    'TRACKING_BATCHES',
    legacyPermissions,
  );
  assert.equal(explicitDenial.create, false, 'una decisión granular prevalece sobre la fila antigua');
  assert.equal(explicitDenial.confirm, false, 'una denegación granular prevalece sobre aprobar en Recepción');
});

test('el editor no ofrece eliminar cuando no hay una accion de usuario en la vista', () => {
  const cases = [
    ['SALES_QUOTES', 'cancel'],
    ['SALES_ORDERS', 'cancel'],
    ['SALES_RETURNS', 'reject'],
    ['SALES_CREDIT_NOTES', 'cancel'],
    ['PURCHASES_REQUESTS', 'cancel'],
  ] as const;

  for (const [module, action] of cases) {
    const hydrated = hydratePermissionActions({ module, read: true, delete: true }, module);
    assert.equal(hydrated[action], true, `${module} migrates old delete to ${action}`);
    assert.equal(Object.hasOwn(hydrated, 'delete'), false, `${module} does not expose physical delete`);

    const [saved] = serializePermissionActions([hydrated]);
    assert.equal(saved[action], true, `${module} saves the real workflow action`);
    assert.equal(Object.hasOwn(saved, 'delete'), false, `${module} drops the ghost delete option when saved`);
  }
});

test('Restaurante matrix exposes independent table, order, kitchen and configuration actions', () => {
  const expectedByModule: Record<string, string[]> = {
    RESTAURANT: ['configureRestaurant'],
    RESTAURANT_SALON: ['closeTable', 'changeTableStatus', 'shareQr', 'rotateQr'],
    RESTAURANT_ORDERS: ['addOrderItems', 'confirmOrder', 'sendToKitchen', 'startPreparation', 'markOrderReady', 'serveOrder', 'cancelOrder', 'pay', 'editDeliveryDetails', 'queueDelivery', 'startDeliveryPreparation', 'markDeliveryReady', 'dispatchDelivery', 'markDelivered', 'cancelDelivery'],
    RESTAURANT_KITCHEN: ['sendToKitchen', 'startPreparation', 'markKitchenReady', 'serveOrder', 'cancelKitchenTicket'],
  };

  for (const [module, actions] of Object.entries(expectedByModule)) {
    const matrixActions = getPermissionActionKeys(module);
    for (const action of actions) assert.equal(matrixActions.includes(action as any), true, `${module}:${action}`);
    assert.equal(matrixActions.includes('approve' as any), false, `${module} must not expose blanket approve`);
  }
  assert.equal(getPermissionActionKeys('RESTAURANT_TABLES').includes('approve' as any), false);
});

test('Restaurante legacy approve grants former operations but explicit granular denials win', () => {
  const orderActions = ['confirmOrder', 'sendToKitchen', 'startPreparation', 'markOrderReady', 'serveOrder', 'cancelOrder', 'pay', 'editDeliveryDetails', 'queueDelivery', 'startDeliveryPreparation', 'markDeliveryReady', 'dispatchDelivery', 'markDelivered', 'cancelDelivery'];
  const kitchenActions = ['sendToKitchen', 'startPreparation', 'markKitchenReady', 'serveOrder', 'cancelKitchenTicket'];
  for (const action of orderActions) {
    assert.equal(permissionValue({ module: 'RESTAURANT_ORDERS', approve: true }, action as any, 'RESTAURANT_ORDERS'), true, action);
    assert.equal(permissionValue({ module: 'RESTAURANT_ORDERS', approve: true, [action]: false }, action as any, 'RESTAURANT_ORDERS'), false, action);
    assert.equal(permissionValue({ module: 'RESTAURANT_ORDERS', approve: false, [action]: true }, action as any, 'RESTAURANT_ORDERS'), true, action);
  }
  for (const action of kitchenActions) {
    assert.equal(permissionValue({ module: 'RESTAURANT_KITCHEN', approve: true }, action as any, 'RESTAURANT_KITCHEN'), true, action);
    assert.equal(permissionValue({ module: 'RESTAURANT_KITCHEN', approve: true, [action]: false }, action as any, 'RESTAURANT_KITCHEN'), false, action);
  }
  assert.equal(permissionValue({ module: 'RESTAURANT_SALON', read: true }, 'shareQr' as any, 'RESTAURANT_SALON'), true);
  assert.equal(permissionValue({ module: 'RESTAURANT_SALON', read: true, shareQr: false }, 'shareQr' as any, 'RESTAURANT_SALON'), false);
  assert.equal(permissionValue({ module: 'RESTAURANT', edit: true }, 'configureRestaurant' as any, 'RESTAURANT'), true);
  assert.equal(permissionValue({ module: 'RESTAURANT', edit: true, configureRestaurant: false }, 'configureRestaurant' as any, 'RESTAURANT'), false);
});

test('Restaurante role serialization stores each workflow action independently', () => {
  const [orders, kitchen, salon, restaurant] = serializePermissionActions([
    { module: 'RESTAURANT_ORDERS', approve: true, pay: true, sendToKitchen: false },
    { module: 'RESTAURANT_KITCHEN', approve: true, markKitchenReady: false },
    { module: 'RESTAURANT_SALON', read: true, shareQr: false },
    { module: 'RESTAURANT', edit: true, configureRestaurant: true },
  ]);
  assert.equal(orders.pay, true);
  assert.equal(orders.sendToKitchen, false);
  assert.equal(kitchen.markKitchenReady, false);
  assert.equal(salon.shareQr, false);
  assert.equal(restaurant.configureRestaurant, true);
});

test('Sales legacy approval fallback is overridden by an explicit business action value', () => {
  assert.equal(permissionValue({ module: 'SALES_INVOICES', approve: true }, 'sendToCredit' as any), true);
  assert.equal(permissionValue({ module: 'SALES_INVOICES', approve: true, sendToCredit: false }, 'sendToCredit' as any), false);
  assert.equal(permissionValue({ module: 'RETAIL_POS', approve: true }, 'pay' as any), true);
  assert.equal(permissionValue({ module: 'RETAIL_POS', approve: true, pay: false }, 'pay' as any), false);
});

test('Inventory audit role matrix exposes individual workflow actions', () => {
  const actions = getPermissionActionKeys('INVENTORY_AUDITS');
  for (const action of ['start', 'close', 'approve', 'reopen', 'cancel']) {
    assert.equal(actions.includes(action as any), true, `INVENTORY_AUDITS:${action}`);
  }
  assert.equal(getPermissionActionKeys('INVENTORY_ADJUSTMENTS').includes('approve'), true);
});

test('Inventory audit granular actions hydrate old roles and explicit values win', () => {
  const legacy = { module: 'INVENTORY_AUDITS', approve: true, delete: true };
  for (const action of ['start', 'close', 'reopen']) {
    assert.equal(permissionValue(legacy, action as any, 'INVENTORY_AUDITS'), true, action);
  }
  assert.equal(permissionValue(legacy, 'cancel' as any, 'INVENTORY_AUDITS'), true);
  assert.equal(permissionValue({ ...legacy, start: false, close: false, reopen: false, cancel: false }, 'start' as any, 'INVENTORY_AUDITS'), false);
  assert.equal(permissionValue({ module: 'INVENTORY_AUDITS', start: true }, 'start' as any, 'INVENTORY_AUDITS'), true);

  const hydrated = hydratePermissionActions(legacy, 'INVENTORY_AUDITS');
  assert.equal(hydrated.start, true);
  assert.equal(hydrated.close, true);
  assert.equal(hydrated.reopen, true);
  assert.equal(hydrated.cancel, true);
  const [saved] = serializePermissionActions([{ ...hydrated, start: false }]);
  assert.equal(saved.start, false);
  assert.equal(saved.approve, true);
});

test('Tracking role matrix separates reception, imports, confirmations and billing actions', () => {
  const expected: Record<string, string[]> = {
    TRACKING_TRANSIT: ['lookup', 'sync', 'registerEvent'],
    TRACKING_RECEPTION: ['receive'],
    TRACKING_PACKAGES: ['import'],
    TRACKING_BATCHES: ['confirm'],
    TRACKING_RECONCILIATION: ['confirm'],
    TRACKING_BILLING: ['bill', 'deliver', 'send', 'issue', 'cancel'],
  };
  for (const [module, actions] of Object.entries(expected)) {
    const supported = getPermissionActionKeys(module);
    for (const action of actions) assert.equal(supported.includes(action as any), true, `${module}:${action}`);
    assert.equal(supported.includes('approve'), false, `${module} should not show generic approve`);
  }
  assert.equal(getPermissionActionKeys('TRACKING_BILLING').includes('delete'), false);
});

test('Tracking granular actions hydrate legacy permissions and explicit denials win', () => {
  const legacyByModule: Record<string, Record<string, unknown>> = {
    TRACKING_TRANSIT: { read: true, edit: true },
    TRACKING_RECEPTION: { create: true },
    TRACKING_PACKAGES: { create: true },
    TRACKING_BATCHES: { approve: true },
    TRACKING_RECONCILIATION: { approve: true },
    TRACKING_BILLING: { approve: true, delete: true },
  };
  const actionByModule: Record<string, string[]> = {
    TRACKING_TRANSIT: ['lookup', 'sync', 'registerEvent'],
    TRACKING_RECEPTION: ['receive'],
    TRACKING_PACKAGES: ['import'],
    TRACKING_BATCHES: ['confirm'],
    TRACKING_RECONCILIATION: ['confirm'],
    TRACKING_BILLING: ['bill', 'deliver', 'send', 'issue', 'cancel'],
  };

  for (const [module, legacy] of Object.entries(legacyByModule)) {
    const hydrated = hydratePermissionActions({ module, ...legacy }, module);
    for (const action of actionByModule[module]) {
      assert.equal(hydrated[action], true, `${module}:${action}`);
      assert.equal(permissionValue({ ...legacy, [action]: false }, action as any, module), false, `${module}:${action} denial`);
    }
    const [saved] = serializePermissionActions([{ ...hydrated, [actionByModule[module][0]]: false }]);
    assert.equal(saved[actionByModule[module][0]], false);
  }
});

test('Tracking package import fallback does not change import rules in other modules', () => {
  assert.equal(permissionValue({ module: 'TRACKING_PACKAGES', create: true }, 'import'), true);
  assert.equal(permissionValue({ module: 'TRACKING_PACKAGES', create: true, import: false }, 'import'), false);
  assert.equal(permissionValue({ module: 'CONFIG_PDF', import: true, approve: false }, 'import'), true);
});

test('Tracking invoice sharing is independent from billing and keeps legacy approve access', () => {
  assert.equal(permissionValue({ module: 'TRACKING_BILLING', approve: true }, 'send'), true);
  assert.equal(permissionValue({ module: 'TRACKING_BILLING', approve: true, send: false }, 'send'), false);
  assert.equal(permissionValue({ module: 'TRACKING_BILLING', approve: true, bill: false, send: true }, 'send'), true);
});

test('international imports expose actions for each operational area without generic approval', () => {
  const expected: Record<string, string[]> = {
    IMPORT_INTL: ['read'],
    IMPORT_INTL_ORIGIN: ['read', 'create', 'edit', 'delete', 'registerEvent', 'deliver', 'cancel'],
    IMPORT_INTL_CONTAINERS: ['read', 'create', 'edit', 'delete', 'assignPackages', 'unassignPackages', 'movePackages', 'consolidate', 'dispatch', 'sendToCustoms', 'cancel'],
    IMPORT_INTL_CUSTOMS: ['read', 'addExpense', 'close', 'closeByException', 'reopenContainer'],
    IMPORT_INTL_CONFIG: ['read', 'create', 'edit', 'delete'],
  };
  for (const [module, expectedActions] of Object.entries(expected)) {
    const actions = getPermissionActionKeys(module);
    for (const action of expectedActions) assert.equal(actions.includes(action as any), true, `${module}:${action}`);
    if (module !== 'IMPORT_INTL') assert.equal(actions.includes('approve'), false, `${module} should not show generic approve`);
  }
});

test('international import legacy actions hydrate from the parent and explicit denials win', () => {
  const legacyParent = { module: 'IMPORT_INTL', read: true, create: true, edit: true, delete: true, approve: true, closeByException: true, reopenContainer: true };
  const expectedByModule: Record<string, string[]> = {
    IMPORT_INTL_ORIGIN: ['read', 'create', 'edit', 'delete', 'registerEvent', 'deliver', 'cancel'],
    IMPORT_INTL_CONTAINERS: ['read', 'create', 'edit', 'delete', 'assignPackages', 'unassignPackages', 'movePackages', 'consolidate', 'dispatch', 'sendToCustoms', 'cancel'],
    IMPORT_INTL_CUSTOMS: ['read', 'addExpense', 'close', 'closeByException', 'reopenContainer'],
    IMPORT_INTL_CONFIG: ['read', 'create', 'edit', 'delete'],
  };
  for (const [module, actions] of Object.entries(expectedByModule)) {
    const hydrated = hydratePermissionActions(legacyParent, module);
    for (const action of actions) assert.equal(hydrated[action], true, `${module}:${action}`);
    const granular = { ...legacyParent, [actions.at(-1)!]: false };
    assert.equal(permissionValue(granular, actions.at(-1)! as any, module), false, `${module}:${actions.at(-1)} denial`);
  }
});

test('Sales role editor hydrates legacy approval into visible actions and saves explicit overrides', () => {
  const hydrated = hydratePermissionActions({ module: 'SALES_INVOICES', approve: true, create: true, edit: true }, 'SALES_INVOICES');
  assert.equal(hydrated.submit, true);
  assert.equal(hydrated.sendToCredit, true);
  assert.equal(hydrated.sendToCash, true);

  const [saved] = serializePermissionActions([{ ...hydrated, sendToCash: false }]);
  assert.equal(saved.approve, true);
  assert.equal(saved.sendToCredit, true);
  assert.equal(saved.sendToCash, false);
});

test('Contabilidad exposes granular actions across every accounting workflow area', () => {
  const expected: Record<string, string[]> = {
    ACCOUNTING_JOURNAL: ['post', 'void'],
    ACCOUNTING_HR_PAYMENT_REQUESTS: ['approve', 'reject', 'pay'],
    ACCOUNTING_EXCHANGE_DIFFERENCES: ['saveRun', 'createJournal', 'post', 'createReversal'],
    ACCOUNTING_ASSETS: ['generateProjection', 'processDepreciation'],
    ACCOUNTING_RECONCILIATION: ['updateBalance', 'autoMatch', 'addMovement', 'editMovement', 'matchMovement', 'complete'],
    ACCOUNTING_PERIODS: ['close', 'reopen', 'lock'],
    ACCOUNTING_INVOICE_AUDIT: ['audit', 'sendToCorrect', 'cancelInvoice', 'reissueInvoice', 'approveCancellation', 'rejectCancellation'],
  };

  for (const [module, actions] of Object.entries(expected)) {
    const supported = getPermissionActionKeys(module);
    for (const action of actions) assert.equal(supported.includes(action as any), true, `${module}:${action}`);
    if (module !== 'ACCOUNTING_HR_PAYMENT_REQUESTS') assert.equal(supported.includes('approve'), false, `${module} should not expose generic approve`);
  }
});

test('Contabilidad hydrates old permissions and an explicit granular denial wins', () => {
  const cases: Array<[string, string, Record<string, unknown>]> = [
    ['ACCOUNTING_JOURNAL', 'post', { approve: true }],
    ['ACCOUNTING_JOURNAL', 'void', { delete: true }],
    ['ACCOUNTING_HR_PAYMENT_REQUESTS', 'pay', { approve: true }],
    ['ACCOUNTING_HR_PAYMENT_REQUESTS', 'reject', { delete: true }],
    ['ACCOUNTING_EXCHANGE_DIFFERENCES', 'post', { approve: true }],
    ['ACCOUNTING_EXCHANGE_DIFFERENCES', 'createReversal', { create: true }],
    ['ACCOUNTING_ASSETS', 'generateProjection', { approve: true }],
    ['ACCOUNTING_ASSETS', 'processDepreciation', { approve: true }],
    ['ACCOUNTING_RECONCILIATION', 'autoMatch', { edit: true }],
    ['ACCOUNTING_RECONCILIATION', 'complete', { approve: true }],
    ['ACCOUNTING_PERIODS', 'close', { approve: true }],
    ['ACCOUNTING_PERIODS', 'reopen', { approve: true }],
    ['ACCOUNTING_PERIODS', 'lock', { approve: true }],
    ['ACCOUNTING_INVOICE_AUDIT', 'audit', { create: true }],
    ['ACCOUNTING_INVOICE_AUDIT', 'sendToCorrect', { edit: true }],
    ['ACCOUNTING_INVOICE_AUDIT', 'cancelInvoice', { approve: true }],
  ];

  for (const [module, action, legacy] of cases) {
    const role = { module, ...legacy };
    assert.equal(permissionValue(role, action as any, module), true, `${module}:${action} legacy fallback`);
    assert.equal(permissionValue({ ...role, [action]: false }, action as any, module), false, `${module}:${action} denial`);
    const hydrated = hydratePermissionActions(role, module);
    assert.equal(hydrated[action], true, `${module}:${action} role editor hydration`);
    const [saved] = serializePermissionActions([{ ...hydrated, [action]: false }]);
    assert.equal(saved[action], false, `${module}:${action} saved override`);
  }
});

test('Recursos Humanos exposes distinct workflow actions across the full module', () => {
  const expected: Record<string, string[]> = {
    HR_EMPLOYEES: ['submit', 'approve', 'reject', 'terminateEmployee', 'deleteEmployeeDocument'],
    HR_PAYROLL: ['process', 'requestPayment'],
    HR_LEAVES: ['approve', 'reject'],
    HR_TRAINING: ['enroll', 'start', 'complete', 'completeEnrollment', 'cancel', 'requestPayment'],
    HR_BENEFITS: ['assign', 'requestPayment'],
  };
  for (const [module, actions] of Object.entries(expected)) {
    const supported = getPermissionActionKeys(module);
    for (const action of actions) assert.equal(supported.includes(action as any), true, `${module}:${action}`);
    if (!['HR_EMPLOYEES', 'HR_LEAVES'].includes(module)) {
      assert.equal(supported.includes('approve'), false, `${module} should not expose generic approve`);
    }
  }
});

test('Recursos Humanos hydrates historical permissions and explicit action denials win', () => {
  const cases: Array<[string, string, Record<string, unknown>]> = [
    ['HR_EMPLOYEES', 'submit', { approve: true }],
    ['HR_EMPLOYEES', 'reject', { approve: true }],
    ['HR_PAYROLL', 'process', { approve: true }],
    ['HR_PAYROLL', 'requestPayment', { approve: true }],
    ['HR_LEAVES', 'reject', { approve: true }],
    ['HR_TRAINING', 'enroll', { create: true }],
    ['HR_TRAINING', 'start', { edit: true }],
    ['HR_TRAINING', 'complete', { approve: true }],
    ['HR_TRAINING', 'completeEnrollment', { approve: true }],
    ['HR_TRAINING', 'cancel', { edit: true }],
    ['HR_TRAINING', 'requestPayment', { approve: true }],
    ['HR_BENEFITS', 'assign', { create: true }],
    ['HR_BENEFITS', 'requestPayment', { approve: true }],
  ];

  for (const [module, action, legacy] of cases) {
    const role = { module, ...legacy };
    assert.equal(permissionValue(role, action as any, module), true, `${module}:${action} legacy fallback`);
    assert.equal(permissionValue({ ...role, [action]: false }, action as any, module), false, `${module}:${action} denial`);
    const hydrated = hydratePermissionActions(role, module);
    assert.equal(hydrated[action], true, `${module}:${action} role editor hydration`);
    const [saved] = serializePermissionActions([{ ...hydrated, [action]: false }]);
    assert.equal(saved[action], false, `${module}:${action} saved override`);
  }
});

test('Financiamiento role matrix separates review actions from application notes and documents', () => {
  const moduleActions = getPermissionActionKeys('FINANCING');
  for (const action of ['startReview', 'approve', 'reject', 'disburse', 'reopen']) {
    assert.equal(moduleActions.includes(action as any), true, `FINANCING:${action}`);
  }

  const applicationActions = getPermissionActionKeys('FINANCING_APPLICATIONS');
  assert.equal(applicationActions.includes('addNote' as any), true);
  assert.equal(applicationActions.includes('addDocument' as any), true);
  assert.equal(applicationActions.includes('approve'), false);
});

test('Financiamiento hydrates old approval/edit roles and persists independent overrides', () => {
  for (const action of ['startReview', 'reject', 'disburse', 'reopen']) {
    const legacy = { module: 'FINANCING', approve: true };
    assert.equal(permissionValue(legacy, action as any, 'FINANCING'), true, `${action} legacy approval`);
    const hydrated = hydratePermissionActions(legacy, 'FINANCING');
    assert.equal(hydrated[action], true, `${action} role editor hydration`);
    const [saved] = serializePermissionActions([{ ...hydrated, [action]: false }]);
    assert.equal(saved.approve, true);
    assert.equal(saved[action], false);
    assert.equal(permissionValue(saved, action as any, 'FINANCING'), false, `${action} explicit denial`);
  }

  for (const action of ['addNote', 'addDocument']) {
    const legacy = { module: 'FINANCING_APPLICATIONS', edit: true };
    assert.equal(permissionValue(legacy, action as any, 'FINANCING_APPLICATIONS'), true, `${action} legacy edit`);
    assert.equal(permissionValue({ ...legacy, [action]: false }, action as any, 'FINANCING_APPLICATIONS'), false, `${action} explicit denial`);
  }
});

test('Fuerza Comercial exposes dedicated prospect, route, presence and consent actions', () => {
  const actions = getPermissionActionKeys('FORCE_SALES');
  const expected = [
    'importProspects', 'updateProspect', 'changeStage', 'registerVisit', 'discardProspect', 'assignProspect',
    'attachEvidence', 'manageConsent', 'createRoute', 'editRoute', 'assignRoute', 'changeRouteStatus',
    'completeRouteStop', 'updatePresence', 'hidePresence', 'configureLocation', 'send',
  ];
  for (const action of expected) assert.equal(actions.includes(action as any), true, `FORCE_SALES:${action}`);
  assert.equal(actions.includes('approve'), false);
  assert.equal(actions.includes('delete'), false, 'prospect deletion is reserved for Super Admin and is not a custom-role permission');
});

test('Fuerza Comercial keeps legacy create/edit/send access until an explicit granular choice is saved', () => {
  const cases = [
    ['importProspects', { create: true }],
    ['updateProspect', { edit: true }],
    ['changeStage', { edit: true }],
    ['registerVisit', { edit: true }],
    ['discardProspect', { edit: true }],
    ['assignProspect', { edit: true }],
    ['attachEvidence', { edit: true }],
    ['manageConsent', { edit: true }],
    ['createRoute', { create: true }],
    ['editRoute', { edit: true }],
    ['assignRoute', { edit: true }],
    ['changeRouteStatus', { edit: true }],
    ['completeRouteStop', { edit: true }],
    ['updatePresence', { edit: true }],
    ['hidePresence', { edit: true }],
    ['configureLocation', { edit: true }],
    ['send', { send: true }],
  ] as const;

  for (const [action, legacy] of cases) {
    const role = { module: 'FORCE_SALES', ...legacy };
    assert.equal(permissionValue(role, action as any, 'FORCE_SALES'), true, `${action} fallback`);
    const hydrated = hydratePermissionActions(role, 'FORCE_SALES');
    assert.equal(hydrated[action], true, `${action} matrix hydration`);
    const [saved] = serializePermissionActions([{ ...hydrated, [action]: false }]);
    assert.equal(saved[action], false, `${action} saved override`);
    assert.equal(permissionValue(saved, action as any, 'FORCE_SALES'), false, `${action} explicit denial`);
  }
});

test('Hospedaje exposes every operational action separately and hides blanket approval', () => {
  const expectedByModule: Record<string, string[]> = {
    HOTEL_ROOMS: ['createRoomType', 'editRoomType', 'changeRoomTypeAvailability', 'createRoom', 'editRoom', 'changeRoomAvailability'],
    HOTEL_RESERVATIONS: ['checkIn', 'checkOut', 'payAtCheckout', 'cancelReservation', 'markNoShow', 'issueGuestLink', 'revokeGuestLink'],
  };
  for (const [module, actions] of Object.entries(expectedByModule)) {
    const matrixActions = getPermissionActionKeys(module);
    for (const action of actions) assert.equal(matrixActions.includes(action as any), true, `${module}:${action}`);
    assert.equal(matrixActions.includes('approve' as any), false, `${module} must not expose blanket approve`);
  }
});

test('Hospedaje hydrates legacy room and reservation permissions and explicit denials win', () => {
  const legacyRoomPermissions = hydratePermissionActions({ module: 'HOTEL_ROOMS', create: true, edit: true }, 'HOTEL_ROOMS');
  assert.equal(legacyRoomPermissions.createRoomType, true);
  assert.equal(legacyRoomPermissions.createRoom, true);
  assert.equal(legacyRoomPermissions.changeRoomAvailability, true);
  assert.equal(permissionValue({ module: 'HOTEL_ROOMS', edit: true, changeRoomAvailability: false }, 'changeRoomAvailability' as any), false);

  const legacyReservationPermissions = hydratePermissionActions({ module: 'HOTEL_RESERVATIONS', approve: true, edit: true }, 'HOTEL_RESERVATIONS');
  for (const action of ['checkIn', 'checkOut', 'payAtCheckout', 'cancelReservation', 'markNoShow', 'issueGuestLink', 'revokeGuestLink']) {
    assert.equal(legacyReservationPermissions[action], true, action);
  }
  const [saved] = serializePermissionActions([{ ...legacyReservationPermissions, checkIn: false, payAtCheckout: false }]);
  assert.equal(saved.checkIn, false);
  assert.equal(saved.payAtCheckout, false);
});

test('Proyectos exposes its operational actions by area and keeps legacy grants editable', () => {
  const expected: Record<string, string[]> = {
    PROJECTS_LIST: ['changeStatus', 'manageMembers', 'comment'],
    PROJECTS_TASKS: ['complete', 'changeStatus', 'reorder', 'comment', 'react', 'linkErp', 'autoPlan'],
    PROJECTS_MILESTONES: ['complete', 'changeStatus', 'updateProgress'],
    PROJECTS_QUOTATIONS: ['manageMaterials', 'sendToSuppliers', 'manualFill', 'reviewOverwrite', 'selectOffers'],
    PROJECTS_EXPENSES: ['createJournal', 'applyCostTemplate', 'approve', 'editPricing', 'syncPricing', 'manageCalculationMemory', 'deleteBudgetLine', 'deleteCost', 'deleteCostingLine'],
    PROJECTS_PROGRESS: ['recordProgress', 'editCurve', 'createCapture', 'deleteCapture', 'managePublicLinks'],
  };
  for (const [module, actions] of Object.entries(expected)) {
    const supported = getPermissionActionKeys(module);
    for (const action of actions) assert.equal(supported.includes(action as any), true, `${module}:${action}`);
  }
  assert.equal(getPermissionActionKeys('PROJECTS_QUOTATIONS').includes('delete'), false, 'quotation material removal is governed by manageMaterials, not a phantom delete option');

  const legacyTask = hydratePermissionActions({ module: 'PROJECTS_TASKS', read: true, edit: true }, 'PROJECTS_TASKS');
  assert.equal(legacyTask.complete, true);
  const [savedTask] = serializePermissionActions([{ ...legacyTask, complete: false }]);
  assert.equal(savedTask.complete, false);
  assert.equal(approvalActionValue(savedTask, 'complete', 'PROJECTS_TASKS'), false);

  const legacyExpenseDeletes = hydratePermissionActions({ module: 'PROJECTS_EXPENSES', delete: true }, 'PROJECTS_EXPENSES');
  for (const action of ['deleteBudgetLine', 'deleteCost', 'deleteCostingLine']) {
    assert.equal(legacyExpenseDeletes[action], true, `legacy delete grants ${action} until a granular choice is saved`);
  }
  const [savedExpenseDeletes] = serializePermissionActions([{ ...legacyExpenseDeletes, deleteCost: false }]);
  assert.equal(permissionValue(savedExpenseDeletes, 'deleteCost' as any, 'PROJECTS_EXPENSES'), false);

  const legacyCapture = hydratePermissionActions({ module: 'PROJECTS_DOCUMENTS', create: true }, 'PROJECTS_PROGRESS');
  assert.equal(legacyCapture.createCapture, true);
  const [savedProgress] = serializePermissionActions([{ ...legacyCapture, createCapture: false }]);
  assert.equal(savedProgress.createCapture, false);
});

test('Tickets exposes workflow actions by transition and keeps TICKETS_VIEW as a legacy alias', () => {
  const actions = getPermissionActionKeys('TICKETS_LIST');
  for (const action of ['startTicket', 'returnTicketToOpen', 'resolveTicket', 'closeTicket', 'reopenTicket', 'commentTicket']) {
    assert.equal(actions.includes(action as any), true, action);
  }
  assert.equal(actions.includes('deactivate' as any), true);
  assert.equal(actions.includes('approve'), false);
  assert.deepEqual(getPermissionActionKeys('TICKETS_VIEW'), actions);

  const legacy = hydratePermissionActions({ module: 'TICKETS_LIST', edit: true, create: true, approve: true }, 'TICKETS_LIST');
  for (const action of ['startTicket', 'returnTicketToOpen', 'resolveTicket', 'closeTicket', 'reopenTicket', 'commentTicket']) {
    assert.equal(legacy[action], true, action);
  }

  const [saved] = serializePermissionActions([{ ...legacy, resolveTicket: false, reopenTicket: false, returnTicketToOpen: false }]);
  assert.equal(saved.resolveTicket, false);
  assert.equal(saved.reopenTicket, false);
  assert.equal(saved.returnTicketToOpen, false);
  assert.equal(permissionValue(saved, 'resolveTicket' as any, 'TICKETS_LIST'), false);
  assert.equal(permissionValue(saved, 'reopenTicket' as any, 'TICKETS_LIST'), false);
  assert.equal(permissionValue(saved, 'returnTicketToOpen' as any, 'TICKETS_LIST'), false);
});

test('delete options in the role editor match the active view contract', () => {
  assert.deepEqual(getPermissionActionKeys('PURCHASES'), ['read', 'create'], 'the parent Compras view has no delete control');
  const supplierPricePermission = hydratePermissionActions({ module: 'PURCHASES', read: true, delete: true }, 'PURCHASES');
  assert.equal(Object.hasOwn(supplierPricePermission, 'delete'), false, 'supplier-price delete is not offered as a parent-view action');
  assert.equal(getPermissionActionKeys('ACCOUNTING_ASSETS').includes('delete'), false, 'accounting assets have no physical delete route');
  assert.equal(getPermissionActionKeys('DOCUMENTS_FOLDERS').includes('delete'), false, 'document folder view has no folder deletion action');
  assert.deepEqual(getPermissionActionKeys('FINANCIAL_BUDGET'), ['read', 'export'], 'financial budget view only reads and exports its data');
  const knowledgeBaseActions = getPermissionActionKeys('TICKETS_KNOWLEDGE_BASE');
  assert.equal(knowledgeBaseActions.includes('delete'), false);
  assert.equal(knowledgeBaseActions.includes('archive'), true);
  assert.equal(knowledgeBaseActions.includes('deactivate'), true);
  assert.equal(permissionValue({ module: 'TICKETS_KNOWLEDGE_BASE', delete: true, archive: false }, 'archive', 'TICKETS_KNOWLEDGE_BASE'), false);
  assert.equal(permissionValue({ module: 'TICKETS_KNOWLEDGE_BASE', delete: true, deactivate: false }, 'deactivate', 'TICKETS_KNOWLEDGE_BASE'), false);

  const serviceActions = getPermissionActionKeys('INVENTORY_SERVICES');
  assert.equal(serviceActions.includes('delete'), false);
  assert.equal(serviceActions.includes('deactivate'), true);

  const productActions = getPermissionActionKeys('INVENTORY_PRODUCTS');
  assert.equal(productActions.includes('delete'), true);
  assert.equal(productActions.includes('deactivate'), true);

  const cashControlActions = getPermissionActionKeys('RETAIL_CASH_CONTROL');
  assert.equal(cashControlActions.includes('delete'), false);
  assert.equal(cashControlActions.includes('deactivate'), true);
  assert.equal(getPermissionActionKeys('RETAIL_POS').includes('delete'), false);

  for (const module of ['HR_DEPARTMENTS', 'CONFIG_DEPARTMENTS', 'HR_BENEFITS']) {
    const actions = getPermissionActionKeys(module);
    assert.equal(actions.includes('delete'), false, `${module} must not expose soft deactivation as delete`);
    assert.equal(actions.includes('deactivate'), true, `${module} exposes deactivation`);
  }
  assert.equal(getPermissionActionKeys('HR_EMPLOYEES').includes('delete'), false, 'employee separation is a termination action, not physical deletion');
  assert.equal(getPermissionActionKeys('HR_EMPLOYEES').includes('terminateEmployee'), true);
  assert.equal(getPermissionActionKeys('HR_EMPLOYEES').includes('deleteEmployeeDocument'), true, 'employee documents have a separate physical delete action');
  assert.equal(approvalActionValue({ module: 'HR_EMPLOYEES', delete: true }, 'terminateEmployee', 'HR_EMPLOYEES'), true, 'legacy employee delete grants termination during migration');
  assert.equal(getPermissionActionKeys('HR_TRAINING').includes('delete'), false, 'platform-only video deletion is not granted from tenant role permissions');
  assert.equal(getPermissionActionKeys('PURCHASES_REQUESTS').includes('delete'), false, 'requests are cancelled through their workflow and do not expose physical deletion');
  assert.equal(getPermissionActionKeys('PURCHASES_REQUESTS').includes('deleteManagement'), true, 'draft purchase management deletion is separate from request cancellation');
  assert.equal(hydratePermissionActions({ module: 'PURCHASES_REQUESTS', read: true, delete: true }, 'PURCHASES_REQUESTS').deleteManagement, true, 'legacy delete grants management deletion until explicitly limited');
  assert.equal(permissionValue({ module: 'PURCHASES_REQUESTS', delete: true, deleteManagement: false }, 'deleteManagement', 'PURCHASES_REQUESTS'), false, 'explicit management-delete denial overrides legacy delete');
  const userActions = getPermissionActionKeys('CONFIG_USERS');
  assert.equal(userActions.includes('deactivate'), true, 'user suspension is separate');
  assert.equal(userActions.includes('delete'), false, 'user removal has no active UI action');
  assert.equal(getPermissionActionKeys('SALES_INVOICES').includes('pay'), true, 'invoice payment is a separate action');
  assert.equal(getPermissionActionKeys('SALES_INVOICES').includes('delete'), true, 'draft invoices retain a separate physical delete action');
  for (const module of ['SUPPORT_TECH']) {
    const actions = getPermissionActionKeys(module);
    assert.equal(actions.includes('delete'), false, `${module} does not expose delete as an active role-matrix action`);
    const hydrated = hydratePermissionActions({ module, read: true, delete: true }, module);
    assert.equal(Object.hasOwn(hydrated, 'delete'), false, `${module} drops its legacy delete value when the role is edited`);
    const [saved] = serializePermissionActions([{ ...hydrated, delete: true }]);
    assert.equal(Object.hasOwn(saved, 'delete'), false, `${module} does not offer this delete action through the current matrix`);
  }
  assert.equal(getPermissionActionKeys('TRACKING_BATCHES').includes('delete'), true, 'tracking batches have a physical delete action');
  for (const module of ['ASANA', 'ASANA_TASKS']) {
    const actions = getPermissionActionKeys(module);
    assert.equal(actions.includes('archive'), true, `${module} removes records from active lists while retaining history`);
    assert.equal(actions.includes('delete'), false, `${module} does not physically delete records`);
    const legacy = hydratePermissionActions({ module, read: true, delete: true }, module);
    assert.equal(legacy.archive, true, `${module} legacy delete keeps the old archive capability`);
    assert.equal(permissionValue({ module, delete: true, archive: false }, 'archive', module), false, `${module} explicit archive denial overrides legacy delete`);
    const [saved] = serializePermissionActions([{ ...legacy, delete: true }]);
    assert.equal(Object.hasOwn(saved, 'delete'), false, `${module} no longer saves a physical delete permission`);
  }
  for (const module of ['PURCHASES', 'NOTIFICATIONS_ALERTS', 'NOTIFICATIONS_MESSAGES', 'NOTIFICATIONS_PUSH']) {
    assert.equal(getPermissionActionKeys(module).includes('delete'), false, `${module} has no active delete control in the role editor`);
  }
  assert.equal(getPermissionActionKeys('HR_LEAVES').includes('delete'), true, 'pending leave requests have an explicit delete control');
  assert.equal(getPermissionActionKeys('ACCOUNTING_CHART').includes('delete'), true, 'account transfer deletion is separately permissioned');
  assert.equal(getPermissionActionKeys('ACCOUNTING_FISCAL').includes('delete'), true, 'fiscal backup deletion is a real action');
  assert.equal(permissionValue({ module: 'PURCHASES_INVOICES_REC', cancel: true }, 'delete', 'PURCHASES_INVOICES_REC'), false, 'cancelling a recurring invoice must not grant physical deletion');
  assert.equal(permissionValue({ module: 'PURCHASES_PROVIDERS', deactivate: true }, 'delete', 'PURCHASES_PROVIDERS'), false, 'deactivating a supplier must not grant physical deletion');
  assert.equal(permissionValue({ module: 'SALES_INVOICES', cancel: true }, 'delete', 'SALES_INVOICES'), false, 'requesting invoice cancellation must not grant draft deletion');
  assert.equal(permissionValue({ module: 'SALES_INVOICES', delete: true }, 'delete', 'SALES_INVOICES'), true, 'explicit delete permission remains effective');
  assert.equal(approvalActionValue({ module: 'PURCHASES_REQUESTS', delete: true }, 'cancel', 'PURCHASES_REQUESTS'), true, 'legacy request delete grants the new cancel action');
  assert.equal(approvalActionValue({ module: 'PURCHASES_REQUESTS', delete: true, cancel: false }, 'cancel', 'PURCHASES_REQUESTS'), false, 'an explicit cancel denial overrides legacy delete');
  assert.equal(getPermissionActionKeys('PURCHASES_PROVIDERS').includes('deactivate'), true, 'supplier availability has a dedicated action');
  assert.equal(getPermissionActionKeys('PURCHASES_PROVIDERS').includes('delete'), true, 'supplier physical deletion has a backed action');
  assert.equal(getPermissionActionKeys('PURCHASES_EXPENSES_REC').includes('cancel'), true, 'recurring expenses expose cancellation separately from deletion');
  assert.equal(getPermissionActionKeys('PURCHASES_EXPENSES_REC').includes('delete'), true, 'recurring expenses can be physically deleted only as a separate action');
  assert.equal(getPermissionActionKeys('ACCOUNTING_CONFIG').includes('deactivate'), true, 'tax catalog state changes are separate from physical deletion');
  assert.equal(getPermissionActionKeys('CONFIG_COMPANY').includes('delete'), true, 'company industries and documents have physical delete routes');
  assert.equal(getPermissionActionKeys('CONFIG_COMPANY').includes('deactivate'), false, 'no company deactivation action is exposed in the UI');
  for (const module of ['ACCOUNTING', 'PROJECTS', 'TICKETS', 'NOVACHAT', 'ACCOUNTING_HR_PAYMENT_REQUESTS']) {
    assert.equal(getPermissionActionKeys(module).includes('delete'), false, `${module} must not expose an unbacked delete action`);
  }
  assert.equal(permissionValue({ module: 'ACCOUNTING_HR_PAYMENT_REQUESTS', delete: true }, 'reject' as any, 'ACCOUNTING_HR_PAYMENT_REQUESTS'), true);

  const legacyArticle = hydratePermissionActions({ module: 'TICKETS_KNOWLEDGE_BASE', read: true, delete: true }, 'TICKETS_KNOWLEDGE_BASE');
  assert.equal(legacyArticle.archive, true);
  assert.equal(legacyArticle.deactivate, true);

  const legacyBenefit = hydratePermissionActions({ module: 'HR_BENEFITS', delete: true }, 'HR_BENEFITS');
  assert.equal(legacyBenefit.deactivate, true);
  assert.equal(permissionValue({ module: 'HR_BENEFITS', delete: true, deactivate: false }, 'deactivate'), false);

  const legacyEmployee = hydratePermissionActions({ module: 'HR_EMPLOYEES', delete: true }, 'HR_EMPLOYEES');
  assert.equal(legacyEmployee.terminateEmployee, true);
  assert.equal(legacyEmployee.deleteEmployeeDocument, true);
  assert.equal(permissionValue({ module: 'HR_EMPLOYEES', delete: true, terminateEmployee: false }, 'terminateEmployee'), false);
  assert.equal(permissionValue({ module: 'HR_EMPLOYEES', delete: true, deleteEmployeeDocument: false }, 'deleteEmployeeDocument' as any), false);

  const legacyIntlConfig = hydratePermissionActions({ module: 'IMPORT_INTL_CONFIG', delete: true }, 'IMPORT_INTL_CONFIG');
  assert.equal(legacyIntlConfig.deactivate, true);
  assert.equal(permissionValue({ module: 'IMPORT_INTL_CONFIG', delete: true, deactivate: false }, 'deactivate'), false);

  const legacyAccountingConfig = hydratePermissionActions({ module: 'ACCOUNTING_CONFIG', edit: true }, 'ACCOUNTING_CONFIG');
  assert.equal(legacyAccountingConfig.deactivate, true, 'legacy edit roles retain tax catalog activation changes');
  assert.equal(permissionValue({ module: 'ACCOUNTING_CONFIG', edit: true, deactivate: false }, 'deactivate'), false);

  const legacySuppliers = hydratePermissionActions({ module: 'PURCHASES_PROVIDERS', delete: true }, 'PURCHASES_PROVIDERS');
  assert.equal(legacySuppliers.deactivate, true, 'legacy supplier delete roles retain their former deactivation action');
  assert.equal(permissionValue({ module: 'PURCHASES_PROVIDERS', delete: true, deactivate: false }, 'deactivate'), false);

  const legacyRecurringExpenses = hydratePermissionActions({ module: 'PURCHASES_EXPENSES_REC', delete: true }, 'PURCHASES_EXPENSES_REC');
  assert.equal(legacyRecurringExpenses.cancel, true, 'legacy recurring expense delete roles retain their former cancellation action');
  assert.equal(permissionValue({ module: 'PURCHASES_EXPENSES_REC', delete: true, cancel: false }, 'cancel'), false);
});

test('tracking config exposes deactivation separately from editing and deletion', () => {
  const actions = getPermissionActionKeys('TRACKING_CONFIG');
  assert.equal(actions.includes('deactivate'), true);
  assert.equal(actions.includes('delete'), true);

  const legacy = hydratePermissionActions({ module: 'TRACKING_CONFIG', read: true, edit: true }, 'TRACKING_CONFIG');
  assert.equal(legacy.deactivate, true, 'existing edit roles retain availability changes until limited');

  const [saved] = serializePermissionActions([{ ...legacy, deactivate: false }]);
  assert.equal(permissionValue(saved, 'deactivate', 'TRACKING_CONFIG'), false, 'explicit denial overrides legacy edit');
  assert.equal(permissionValue(saved, 'delete', 'TRACKING_CONFIG'), false, 'deactivation does not grant physical deletion');
});

test('sales invoice and POS imports are separate actions with legacy create fallback', () => {
  for (const module of ['SALES_INVOICES', 'RETAIL_POS']) {
    assert.equal(getPermissionActionKeys(module).includes('import'), true, `${module}: import is in the role matrix`);
    assert.equal(permissionValue({ module, create: true }, 'import', module), true, `${module}: old create roles keep access`);
    assert.equal(permissionValue({ module, create: true, import: false }, 'import', module), false, `${module}: explicit denial wins`);
    assert.equal(permissionValue({ module, create: false, import: true }, 'import', module), true, `${module}: granular grant works`);
  }
});

test('an existing invoice draft is submitted before payment while a new draft is created and paid atomically', () => {
  assert.equal(shouldSubmitExistingDraftBeforePayment('invoice-1', 'DRAFT'), true);
  assert.equal(shouldSubmitExistingDraftBeforePayment('invoice-1', 'PENDING'), false);
  assert.equal(shouldSubmitExistingDraftBeforePayment(undefined, 'DRAFT'), false);
  assert.equal(getInvoicePaymentBalance({ status: 'DRAFT', total: 100, amountPaid: 25 }, 0), 75);
  assert.equal(getInvoicePaymentBalance({ status: 'PENDING', total: 100, amountPaid: 25 }, 75), 75);
  assert.equal(canShowInvoiceSubmitAction('DRAFT', true), true);
  assert.equal(canShowInvoiceSubmitAction('DRAFT', false), false);
  assert.equal(canShowInvoiceSubmitAction('PENDING', true), false);
});
