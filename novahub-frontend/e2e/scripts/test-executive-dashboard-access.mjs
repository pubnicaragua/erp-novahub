import assert from 'node:assert/strict';
import * as dashboardModel from '../../src/app/components/dashboard/executive-model.ts';

const { DEFAULT_PREFERENCES, INDICATORS, BLOCKS, dashboardItemsForAccess, isDashboardItemAllowed } = dashboardModel;
assert.equal(typeof isDashboardItemAllowed, 'function', 'the dashboard should expose its view permission rule');
assert.equal(typeof dashboardItemsForAccess, 'function', 'the dashboard should choose KPIs available to this role');

const indicator = (id) => INDICATORS.find((item) => item.id === id);
const block = (id) => BLOCKS.find((item) => item.id === id);
const grants = (...modules) => (module, action = 'view') => action === 'view' && modules.includes(module);
const grantsWithCosts = (...modules) => (module, action = 'view') => modules.includes(module) && (action === 'view' || action === 'viewCost');

assert.equal(isDashboardItemAllowed(indicator('totalRevenue'), grants('SALES_INVOICES')), true);
assert.equal(isDashboardItemAllowed(indicator('totalRevenue'), grants('INVENTORY_PRODUCTS')), false);
assert.equal(isDashboardItemAllowed(indicator('totalExpenses'), grants('PURCHASES_EXPENSES')), true);
assert.equal(isDashboardItemAllowed(indicator('inventoryAlerts'), grants('INVENTORY_PRODUCTS')), true);
assert.equal(isDashboardItemAllowed(indicator('inventoryAlerts'), grants('SALES_INVOICES')), false);
assert.equal(isDashboardItemAllowed(indicator('operatingResult'), grants('FINANCIAL_EXPENSES')), false);
assert.equal(isDashboardItemAllowed(indicator('operatingResult'), grants('SALES_INVOICES', 'PURCHASES_EXPENSES')), true);
assert.equal(isDashboardItemAllowed(indicator('grossMargin'), grants('SALES_INVOICES', 'INVENTORY_PRODUCTS')), false);
assert.equal(isDashboardItemAllowed(indicator('grossMargin'), grantsWithCosts('SALES_INVOICES', 'INVENTORY_PRODUCTS')), true);
assert.equal(isDashboardItemAllowed(indicator('topMarginProduct'), grants('SALES_INVOICES', 'INVENTORY_PRODUCTS', 'FINANCIAL_EXPENSES')), false);
assert.equal(isDashboardItemAllowed(block('trend'), grants('PURCHASES_EXPENSES')), true);
assert.equal(isDashboardItemAllowed(block('trend'), grants('FINANCIAL_EXPENSES')), false);
assert.equal(isDashboardItemAllowed(block('trend'), grants('INVENTORY_PRODUCTS')), false);
assert.equal(isDashboardItemAllowed(block('products'), grants('SALES_INVOICES', 'INVENTORY_PRODUCTS')), true);
assert.equal(isDashboardItemAllowed(block('products'), grants('INVENTORY_PRODUCTS')), false);
assert.deepEqual(
  dashboardItemsForAccess(INDICATORS, DEFAULT_PREFERENCES.indicators, grants('INVENTORY_PRODUCTS')).map(({ id }) => id),
  ['inventoryAlerts', 'outOfStock'],
);
assert.deepEqual(
  dashboardItemsForAccess(INDICATORS, [], grants('PURCHASES_EXPENSES')).map(({ id }) => id),
  ['totalExpenses'],
);
assert.deepEqual(dashboardItemsForAccess(INDICATORS, [], grants('FINANCIAL_EXPENSES')), []);
assert.deepEqual(dashboardItemsForAccess(INDICATORS, DEFAULT_PREFERENCES.indicators, grants('PURCHASES_ORDERS')), []);

console.log('Executive dashboard view permissions passed.');
