import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MANAGER_OPERATION_BY_SECTION,
  MANAGER_OPERATION_DEFINITIONS,
} from '../../src/app/components/manager/manager-operations.types.ts';
import { MANAGER_SALES_VIEWS } from '../../src/app/components/manager/manager-sales.types.ts';
import { MANAGER_PURCHASES_VIEWS } from '../../src/app/components/manager/manager-purchases.types.ts';
import { MANAGER_INVENTORY_VIEWS } from '../../src/app/components/manager/manager-inventory.types.ts';
import { MANAGER_FINANCE_VIEWS } from '../../src/app/components/manager/manager-finance.types.ts';
import { MANAGER_ACCOUNTING_VIEWS } from '../../src/app/components/manager/manager-accounting.types.ts';
import { MANAGER_HR_VIEWS } from '../../src/app/components/manager/manager-hr.types.ts';
import { MANAGER_REPORTS_VIEWS, MANAGER_REPORT_SOURCES } from '../../src/app/components/manager/manager-reports.types.ts';

const backendRoot = new URL('../../../../Backend/src/enterprise-groups/', import.meta.url);
const backendService = await readFile(new URL('enterprise-groups.service.ts', backendRoot), 'utf8');
const backendAvailability = await readFile(new URL('manager-module-availability.ts', backendRoot), 'utf8');
const frontendRoot = new URL('../../src/app/components/', import.meta.url);
const managerPage = await readFile(new URL('ManagerPage.tsx', frontendRoot), 'utf8');
const managerShell = await readFile(new URL('ManagerShell.tsx', frontendRoot), 'utf8');

function methodBody(methodName) {
  const start = backendService.indexOf(`async ${methodName}(`);
  assert.notEqual(start, -1, `Backend method ${methodName} must exist`);
  const nextAsync = backendService.indexOf('\n  async ', start + 1);
  const nextPrivate = backendService.indexOf('\n  private ', start + 1);
  const ends = [nextAsync, nextPrivate].filter((index) => index !== -1);
  return backendService.slice(start, ends.length ? Math.min(...ends) : undefined);
}

function backendAllowedViews(methodName) {
  const method = methodBody(methodName);
  const match = method.match(/const allowedViews\s*=\s*(?:new Set\()?([\s\S]*?\])\)?;/);
  assert.ok(match, `Backend ${methodName} must declare its accepted view catalog`);
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(([, view]) => view);
}

function viewIds(views) {
  return views.map(({ id }) => id);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasDedicatedViewDispatch(methodName, method, view) {
  if (methodName === 'getInventoryModule' && view === 'corporateWarehouses') {
    return /requestedViewValue\s*===\s*['"]corporateWarehouses['"]/.test(method);
  }
  if (methodName === 'getSalesModule' && view === 'cash') {
    return /view\s*!==\s*['"]cash['"]/.test(method);
  }
  const escaped = escapeRegex(view);
  return new RegExp(`\\bview\\s*===\\s*['"]${escaped}['"]`).test(method)
    || new RegExp(`\\[[^\\]]*['"]${escaped}['"][^\\]]*\\]\\.includes\\(view\\)`).test(method)
    || new RegExp(`\\b${escaped}:\\s*\\{\\s*model:`).test(method);
}

const operationStart = backendService.indexOf('async getManagerOperationsModule(');
assert.notEqual(operationStart, -1, 'Backend Manager operations endpoint must exist');
const operationCatalogStart = backendService.indexOf('const modules: Record<string, { permission: string; views: string[] }> = {', operationStart);
const operationCatalogEnd = backendService.indexOf('\n    };', operationCatalogStart);
assert.ok(operationCatalogStart !== -1 && operationCatalogEnd !== -1, 'Backend operations catalog must exist');
const operationCatalogText = backendService.slice(operationCatalogStart, operationCatalogEnd);
const operationCatalog = new Map();
for (const match of operationCatalogText.matchAll(/(?:^|\n)\s*['"]?([^'":]+)['"]?: \{ permission: ['"]([^'"]+)['"], views: \[([^\]]*)\] \}/g)) {
  operationCatalog.set(match[1].trim(), [...match[3].matchAll(/['"]([^'"]+)['"]/g)].map(([, view]) => view));
}

const operationImplementationStart = backendService.indexOf("if (!scope.branchIds.length) return paginate([]);", operationCatalogEnd);
const operationMethodEnd = backendService.indexOf('\n  private slugify(', operationStart);
const operationImplementation = backendService.slice(operationImplementationStart, operationMethodEnd);
const overviewStart = operationImplementation.indexOf("if (view === 'overview') {");
const overviewEnd = operationImplementation.indexOf("if (module === 'activities' && ['activities'", overviewStart);
assert.ok(overviewStart !== -1 && overviewEnd !== -1, 'Every operations module must have a distinct overview dispatch');
const operationOverview = operationImplementation.slice(overviewStart, overviewEnd);

for (const definition of MANAGER_OPERATION_DEFINITIONS) {
  assert.equal(
    MANAGER_OPERATION_BY_SECTION[definition.id],
    definition.id,
    `Manager section ${definition.id} must route to its consolidated view`,
  );
  assert.deepEqual(
    operationCatalog.get(definition.id),
    viewIds(definition.views),
    `${definition.id} frontend navigation and backend API views must match`,
  );
  assert.ok(operationOverview.includes(`module === '${definition.id}'`), `${definition.id} needs an implemented overview`);

  for (const { id: view } of definition.views.filter(({ id }) => id !== 'overview')) {
    const module = escapeRegex(definition.id);
    const viewPattern = escapeRegex(view);
    const singleView = new RegExp(`module\\s*===\\s*['"]${module}['"]\\s*&&\\s*view\\s*===\\s*['"]${viewPattern}['"]`);
    const groupedView = new RegExp(`module\\s*===\\s*['"]${module}['"]\\s*&&\\s*\\[[^\\]]*['"]${viewPattern}['"][^\\]]*\\]\\.includes\\(view\\)`);
    const moduleOnlyView = definition.id === 'financing' && view === 'applications'
      && new RegExp(`module\\s*===\\s*['"]${module}['"]`).test(operationImplementation);
    assert.ok(singleView.test(operationImplementation) || groupedView.test(operationImplementation) || moduleOnlyView,
      `${definition.id}/${view} is accepted by the API but has no module-specific data dispatch`);
  }
}

const operationComponent = await readFile(new URL('manager/ManagerOperationsModule.tsx', frontendRoot), 'utf8');
assert.match(managerShell, /MANAGER_OPERATION_VIEWS\[item\.id\]/, 'Manager navigation must derive operation subvistas from the operation catalog');
assert.match(managerPage, /MANAGER_OPERATION_BY_SECTION\[section\]/, 'Manager page must resolve all operation sections through the canonical map');
assert.match(managerPage, /<ManagerOperationsView[\s\S]*?view=\{activeOperationView\}/, 'Every operation section must mount the shared consolidated view with its selected subview');
assert.match(operationComponent, /getOperationsModule\(groupId, \{ module: definition\.id, view: activeView/, 'The selected operation subview must reach its backend query');
assert.match(operationComponent, /<DataTable module=\{definition\.id\} view=\{activeView\}/, 'Every operation subview must reach the generic tabular renderer');
assert.match(operationComponent, /<Cards module=\{definition\.id\} view=\{activeView\}/, 'Every operation subview must reach the responsive card renderer');
assert.match(operationComponent, /No se pudo cargar el módulo\./, 'Operation query failures must be visible to the manager');
assert.match(operationComponent, /Sin registros/, 'Successful empty operation queries must render an explicit empty state');
assert.match(operationComponent, /No hay indicadores para el alcance seleccionado\./, 'Successful empty overview queries must render an explicit empty state');
assert.match(managerPage, /Sin sucursales habilitadas en este alcance/, 'Unavailable scopes must render an explicit empty-scope state');

const dedicatedModules = [
  { section: 'sales', componentName: 'ManagerSalesModule', component: 'ManagerSalesModule.tsx', method: 'getSalesModule', views: MANAGER_SALES_VIEWS, skipApiViews: ['invoice-series'] },
  { section: 'purchases', componentName: 'ManagerPurchasesModule', component: 'ManagerPurchasesModule.tsx', method: 'getPurchasesModule', views: MANAGER_PURCHASES_VIEWS },
  { section: 'inventory', componentName: 'ManagerInventoryModule', component: 'ManagerInventoryModule.tsx', method: 'getInventoryModule', views: MANAGER_INVENTORY_VIEWS },
  { section: 'finances', componentName: 'ManagerFinanceModule', component: 'ManagerFinanceModule.tsx', method: 'getFinanceModule', views: MANAGER_FINANCE_VIEWS },
  { section: 'accounting', componentName: 'ManagerAccountingModule', component: 'ManagerAccountingModule.tsx', method: 'getAccountingModule', views: MANAGER_ACCOUNTING_VIEWS },
  { section: 'hr', componentName: 'ManagerHRModule', component: 'ManagerHRModule.tsx', method: 'getHrModule', views: MANAGER_HR_VIEWS },
  { section: 'reports', componentName: 'ManagerReportsModule', component: 'ManagerReportsModule.tsx', method: 'getReportsModule', views: MANAGER_REPORTS_VIEWS },
];

for (const { section, componentName, component, method, views, skipApiViews = [] } of dedicatedModules) {
  assert.match(managerPage, new RegExp(`section === ['"]${section}['"][\\s\\S]*?<${componentName}`),
    `Manager section ${section} must mount its dedicated view`);
  const componentSource = await readFile(new URL(`manager/${component}`, frontendRoot), 'utf8');
  assert.match(componentSource, new RegExp(`enterpriseGroupsService\\.${method}\\(groupId, \\{[^}]*view`), `${section} must query its selected subview`);
  assert.match(componentSource, /view === 'overview'/, `${section} must render a distinct overview`);
  assert.match(componentSource, /view=\{view\}/, `${section} must pass the selected view into its data renderer`);
  assert.match(componentSource, /isLoading|isFetching/, `${section} must display a loading state while its view is queried`);
  assert.match(componentSource, /error|isError/, `${section} must expose query failures instead of rendering a blank view`);

  if (section === 'reports') {
    const backendSourceCatalog = backendAvailability.match(/export const MANAGER_REPORT_SOURCE_SECTIONS\s*=\s*\[([\s\S]*?)\]\s*as const;/);
    assert.ok(backendSourceCatalog, 'Backend report source catalog must exist');
    const backendSources = [...backendSourceCatalog[1].matchAll(/['"]([^'"]+)['"]/g)].map(([, id]) => id);
    assert.deepEqual(backendSources, MANAGER_REPORT_SOURCES.map(({ id }) => id), 'Report source modules must match between frontend and backend');
    const expectedReportViews = [...['overview', 'sales', 'purchases', 'financial', 'inventory', 'customers', 'providers', 'hr', 'subscriptions'], ...backendSources.map((source) => `source-${source}`)];
    assert.deepEqual(viewIds(views), expectedReportViews, 'Manager report navigation must include all backend report views');
    assert.match(componentSource, /sourceView:[^,]*effectiveSourceView/, 'A source report must pass its selected subview to the API');
    assert.match(componentSource, /sourceModule:[^,]*sourceSection/, 'A source report must pass its selected module to the API');
  } else {
    const frontendViews = viewIds(views).filter((view) => !skipApiViews.includes(view));
    assert.deepEqual(backendAllowedViews(method), frontendViews, `${section} frontend and backend view catalogs must match`);
    const backendMethod = methodBody(method);
    for (const view of frontendViews.filter((view) => view !== 'overview')) {
      assert.ok(hasDedicatedViewDispatch(method, backendMethod, view),
        `${section}/${view} is accepted by the backend but has no dedicated query dispatch`);
    }
  }
}

const reportsMethod = methodBody('getReportsModule');
for (const view of viewIds(MANAGER_REPORTS_VIEWS).filter((view) => !view.startsWith('source-') && view !== 'overview')) {
  assert.ok(hasDedicatedViewDispatch('getReportsModule', reportsMethod, view),
    `reports/${view} is accepted by the backend but has no dedicated report query`);
}
assert.match(reportsMethod, /view\.startsWith\(['"]source-['"]\)/, 'Report source views must route to their source module query');
assert.match(reportsMethod, /managerReportSourceViewIds\(sourceSection\)/, 'Report source subviews must be validated against the source catalog');

const salesComponent = await readFile(new URL('manager/ManagerSalesModule.tsx', frontendRoot), 'utf8');
const invoiceSeriesComponent = await readFile(new URL('manager/ManagerInvoiceSeriesSettings.tsx', frontendRoot), 'utf8');
assert.match(salesComponent, /<ManagerInvoiceSeriesSettings/, 'Sales invoice-series is a dedicated settings view, not a sales list endpoint');
assert.match(invoiceSeriesComponent, /getManagerInvoiceSeriesConfiguration/, 'Sales invoice-series must have its own configuration query');
assert.match(backendAvailability, /MANAGER_REPORT_SOURCE_SECTIONS/, 'Backend availability must derive report-source access from its catalog');
assert.match(managerPage, /availableManagerViews\[activeOperationModule\]/, 'Operation modules must receive backend-authorized subviews');

console.log(`Manager consolidation routing passed: ${MANAGER_OPERATION_DEFINITIONS.length} operation modules, ${MANAGER_OPERATION_DEFINITIONS.reduce((sum, item) => sum + item.views.length, 0)} operation views, and ${dedicatedModules.length} dedicated modules.`);
