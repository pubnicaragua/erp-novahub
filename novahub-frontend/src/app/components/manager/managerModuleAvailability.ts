import type { ManagerGroup } from '../../services/enterprise-groups.service';

export const MANAGER_SECTION_ENTERPRISE_MODULE: Record<string, string> = {
  overview: 'DASHBOARD', sales: 'SALES', purchases: 'PURCHASES', inventory: 'INVENTORY', finances: 'FINANCIAL',
  accounting: 'ACCOUNTING', reports: 'REPORTS', hr: 'HR', activities: 'ACTIVITIES', projects: 'PROJECTS',
  tickets: 'TICKETS', documents: 'DOCUMENTS', restaurant: 'RESTAURANT', logistics: 'TRACKING', financing: 'FINANCING',
  legal: 'LEGAL', novachat: 'NOVACHAT', support: 'SUPPORT_TECH', transfers: 'INVENTORY', catalog: 'INVENTORY', consolidated: 'ACCOUNTING',
};

const VIEW_IDS: Record<string, Record<string, string[]>> = {
  overview: { overview: ['DASHBOARD'] },
  inventory: {
    overview: ['INVENTORY_DASHBOARD', 'INVENTORY_PRODUCTS', 'INVENTORY_SERVICES', 'INVENTORY_WAREHOUSES', 'INVENTORY_TRANSFERS', 'INVENTORY_ADJUSTMENTS', 'INVENTORY_AUDITS', 'INVENTORY_LOSSES', 'INVENTORY_MOVEMENTS', 'INVENTORY_ASSETS'],
    branchInventory: ['INVENTORY_PRODUCTS'], corporateInventory: ['INVENTORY_PRODUCTS'], products: ['INVENTORY_PRODUCTS'],
    services: ['INVENTORY_SERVICES'], brands: ['INVENTORY_PRODUCTS'], warehouses: ['INVENTORY_WAREHOUSES'],
    corporateWarehouses: ['INVENTORY_WAREHOUSES'], transfers: ['INVENTORY_TRANSFERS'], adjustments: ['INVENTORY_ADJUSTMENTS'],
    audits: ['INVENTORY_AUDITS'], losses: ['INVENTORY_LOSSES'], movements: ['INVENTORY_MOVEMENTS'], assets: ['INVENTORY_ASSETS'],
  },
  sales: {
    overview: ['SALES_CLIENTS', 'SALES_QUOTES', 'SALES_ORDERS', 'SALES_INVOICES', 'RETAIL_POS', 'SALES_RECURRING', 'SALES_PAYMENTS', 'SALES_RETURNS', 'SALES_CREDIT_NOTES', 'RETAIL_CASH_CONTROL', 'SALES_PRICE_LISTS'],
    customers: ['SALES_CLIENTS'], 'customer-detail': ['SALES_CLIENTS', 'RETAIL_POS'], quotes: ['SALES_QUOTES'], orders: ['SALES_ORDERS'], invoices: ['SALES_INVOICES', 'RETAIL_POS'],
    recurring: ['SALES_RECURRING'], payments: ['SALES_PAYMENTS', 'RETAIL_POS'], creditnotes: ['SALES_RETURNS', 'RETAIL_POS'], credits: ['SALES_CREDIT_NOTES', 'RETAIL_POS'],
    deliveries: ['RETAIL_POS'], cash: ['RETAIL_CASH_CONTROL', 'RETAIL_POS'], 'invoice-series': ['SALES_INVOICES', 'RETAIL_POS'], pricelists: ['SALES_PRICE_LISTS'],
  },
  purchases: {
    overview: ['PURCHASES_PROVIDERS', 'PURCHASES_ORDERS', 'PURCHASES_RECEIPTS', 'PURCHASES_INVOICES_REC', 'PURCHASES_PAYMENTS', 'PURCHASES_RETURNS', 'PURCHASES_EXPENSES', 'PURCHASES_EXPENSES_REC', 'PURCHASES_REQUESTS'],
    suppliers: ['PURCHASES_PROVIDERS'], orders: ['PURCHASES_ORDERS'], receipts: ['PURCHASES_RECEIPTS'], recurring: ['PURCHASES_INVOICES_REC'],
    payments: ['PURCHASES_PAYMENTS'], credits: ['PURCHASES_RETURNS'], expenses: ['PURCHASES_EXPENSES'], recurringexpenses: ['PURCHASES_EXPENSES_REC'], requests: ['PURCHASES_REQUESTS'],
  },
  finances: {
    overview: ['FINANCIAL_DASHBOARD', 'FINANCIAL_BANK', 'FINANCIAL_RECEIVABLES', 'FINANCIAL_PAYABLES', 'FINANCIAL_INCOMES', 'FINANCIAL_EXPENSES', 'FINANCIAL_EXPENSES_REC', 'FINANCIAL_INCOMES_REC', 'FINANCIAL_CALENDAR', 'FINANCIAL_ANALYSIS', 'FINANCIAL_BALANCE', 'FINANCIAL_LOSSES'],
    cash: ['FINANCIAL_BANK', 'FINANCIAL_ACCOUNTS'], receivables: ['FINANCIAL_RECEIVABLES'], payables: ['FINANCIAL_PAYABLES'], income: ['FINANCIAL_INCOMES'],
    expenses: ['FINANCIAL_EXPENSES'], recurring: ['FINANCIAL_EXPENSES_REC', 'FINANCIAL_INCOMES_REC'], calendar: ['FINANCIAL_CALENDAR'], analysis: ['FINANCIAL_ANALYSIS'],
    balance: ['FINANCIAL_BALANCE'], losses: ['FINANCIAL_LOSSES'],
  },
  accounting: {
    overview: ['ACCOUNTING_CHART', 'ACCOUNTING_JOURNAL', 'ACCOUNTING_LEDGER', 'ACCOUNTING_TRIAL_BALANCE', 'ACCOUNTING_PROFIT_LOSS', 'ACCOUNTING_BALANCE_SHEET', 'ACCOUNTING_CASH_FLOW', 'ACCOUNTING_EXCHANGE_DIFFERENCES', 'ACCOUNTING_EQUITY', 'ACCOUNTING_ASSETS', 'ACCOUNTING_RECONCILIATION', 'ACCOUNTING_PERIODS', 'ACCOUNTING_FISCAL', 'ACCOUNTING_INVOICE_AUDIT', 'ACCOUNTING_BUDGET', 'ACCOUNTING_EXPENSE_CATEGORIES', 'ACCOUNTING_HR_PAYMENT_REQUESTS'],
    chart: ['ACCOUNTING_CHART'], journal: ['ACCOUNTING_JOURNAL'], ledger: ['ACCOUNTING_LEDGER'], trialBalance: ['ACCOUNTING_TRIAL_BALANCE'], profitLoss: ['ACCOUNTING_PROFIT_LOSS'],
    balanceSheet: ['ACCOUNTING_BALANCE_SHEET'], cashFlow: ['ACCOUNTING_CASH_FLOW'], exchange: ['ACCOUNTING_EXCHANGE_DIFFERENCES'], equity: ['ACCOUNTING_EQUITY'], assets: ['ACCOUNTING_ASSETS'],
    bankBook: ['ACCOUNTING_LEDGER'], reconciliation: ['ACCOUNTING_RECONCILIATION'], periods: ['ACCOUNTING_PERIODS'], fiscal: ['ACCOUNTING_FISCAL'],
    invoiceAudit: ['ACCOUNTING_INVOICE_AUDIT'], budgets: ['ACCOUNTING_BUDGET'], expenseCategories: ['ACCOUNTING_EXPENSE_CATEGORIES'], hrPaymentRequests: ['ACCOUNTING_HR_PAYMENT_REQUESTS'],
  },
  reports: { overview: ['REPORTS_SALES', 'REPORTS_PURCHASES', 'REPORTS_FINANCIAL', 'REPORTS_INVENTORY', 'REPORTS_CLIENTS', 'REPORTS_PROVIDERS', 'REPORTS_HR', 'REPORTS_SUBSCRIPTIONS'], sales: ['REPORTS_SALES'], purchases: ['REPORTS_PURCHASES'], financial: ['REPORTS_FINANCIAL'], inventory: ['REPORTS_INVENTORY'], customers: ['REPORTS_CLIENTS'], providers: ['REPORTS_PROVIDERS'], hr: ['REPORTS_HR'], subscriptions: ['REPORTS_SUBSCRIPTIONS'] },
  hr: {
    overview: ['HR_DASHBOARD', 'HR_EMPLOYEES', 'HR_DEPARTMENTS', 'HR_PAYROLL', 'HR_COMMISSIONS', 'HR_ATTENDANCE', 'HR_LEAVES', 'HR_PERFORMANCE', 'HR_BENEFITS'],
    employees: ['HR_EMPLOYEES'], departments: ['HR_DEPARTMENTS'], payroll: ['HR_PAYROLL'], commissions: ['HR_COMMISSIONS'], attendance: ['HR_ATTENDANCE'],
    leaves: ['HR_LEAVES'], performance: ['HR_PERFORMANCE'], kpi: ['HR_DASHBOARD'], benefits: ['HR_BENEFITS'],
  },
  activities: { overview: ['ACTIVITIES_TASKS', 'ACTIVITIES_EVENTS', 'ACTIVITIES_CALENDAR', 'ACTIVITIES_MEETINGS', 'ACTIVITIES_REMINDERS', 'ACTIVITIES_LOGS'], activities: ['ACTIVITIES_TASKS', 'ACTIVITIES_EVENTS'], calendar: ['ACTIVITIES_CALENDAR'], meetings: ['ACTIVITIES_MEETINGS'], reminders: ['ACTIVITIES_REMINDERS'], logs: ['ACTIVITIES_LOGS'] },
  projects: { overview: ['PROJECTS_LIST', 'PROJECTS_TASKS', 'PROJECTS_MILESTONES', 'PROJECTS_EXPENSES', 'PROJECTS_DOCUMENTS'], projects: ['PROJECTS_LIST'], tasks: ['PROJECTS_TASKS'], milestones: ['PROJECTS_MILESTONES'], costs: ['PROJECTS_EXPENSES'], budget: ['PROJECTS_EXPENSES'], resources: ['PROJECTS_LIST'], documents: ['PROJECTS_DOCUMENTS'], activities: ['PROJECTS_LIST'] },
  tickets: { overview: ['TICKETS_LIST', 'TICKETS_KNOWLEDGE_BASE', 'TICKETS_AGENTS'], tickets: ['TICKETS_LIST'], faqs: ['TICKETS_KNOWLEDGE_BASE'], agents: ['TICKETS_AGENTS'] },
  documents: { overview: ['DOCUMENTS_FILES', 'DOCUMENTS_REPORTS'], documents: ['DOCUMENTS_FILES'], reports: ['DOCUMENTS_REPORTS'] },
  restaurant: { overview: ['RESTAURANT_ORDERS', 'RESTAURANT_KITCHEN', 'RESTAURANT_SALON', 'RESTAURANT_MENU', 'RESTAURANT_REPORTS'], orders: ['RESTAURANT_ORDERS'], kitchen: ['RESTAURANT_KITCHEN'], tables: ['RESTAURANT_SALON'], menu: ['RESTAURANT_MENU'], reports: ['RESTAURANT_REPORTS'] },
  logistics: { overview: ['TRACKING_TRANSIT', 'TRACKING_RECEPTION', 'TRACKING_BATCHES', 'TRACKING_PACKAGES', 'TRACKING_RECONCILIATION', 'TRACKING_BILLING'], shipments: ['TRACKING_TRANSIT'], packages: ['TRACKING_PACKAGES'], batches: ['TRACKING_BATCHES', 'TRACKING_RECEPTION'], reconciliation: ['TRACKING_RECONCILIATION'], billing: ['TRACKING_BILLING'] },
  financing: { overview: ['FINANCING_APPLICATIONS'], applications: ['FINANCING_APPLICATIONS'] },
  legal: { overview: ['LEGAL_CASES', 'LEGAL_REMINDERS'], cases: ['LEGAL_CASES'], reminders: ['LEGAL_REMINDERS'] },
  transfers: { transfers: ['INVENTORY_TRANSFERS'] }, catalog: { catalog: ['INVENTORY_PRODUCTS'] },
  consolidated: { consolidated: ['ACCOUNTING_TRIAL_BALANCE', 'ACCOUNTING_PROFIT_LOSS', 'ACCOUNTING_BALANCE_SHEET', 'ACCOUNTING_CASH_FLOW'] },
};

const UNMAPPED_MANAGER_VIEWS: Record<string, Set<string>> = {
  sales: new Set(), purchases: new Set(['invoices', 'management']), tickets: new Set(['categories']),
  reports: new Set(), hr: new Set(['training']),
  novachat: new Set(['overview', 'conversations', 'channels', 'contacts', 'agents']), support: new Set(['overview', 'tickets']),
};

type ManagerViewRequirement = { moduleId: string; viewIds?: string[] };

function moduleSet(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean) : []);
}

function policyRestrictionsFor(
  moduleId: string,
  group: ManagerGroup,
  branch: ManagerGroup['branches'][number],
  unit: NonNullable<ManagerGroup['businessUnits']>[number] | undefined,
) {
  const groupPolicy = (group.modulePolicies || {})[moduleId];
  const groupViews = Array.isArray(groupPolicy?.viewIds) ? groupPolicy.viewIds.map((id) => String(id).toUpperCase()) : null;
  const unitViews = Array.isArray(unit?.moduleViewOverrides?.[moduleId]) ? unit!.moduleViewOverrides![moduleId].map((id) => String(id).toUpperCase()) : null;
  const branchViews = Array.isArray(branch.moduleViewOverrides?.[moduleId]) ? branch.moduleViewOverrides![moduleId].map((id) => String(id).toUpperCase()) : null;
  return { groupPolicy, groupViews, unitViews, branchViews, selective: groupViews !== null || unitViews !== null || branchViews !== null };
}

function managerViewRequirements(section: string, view: string): ManagerViewRequirement[] {
  const moduleId = MANAGER_SECTION_ENTERPRISE_MODULE[section];
  if (!moduleId) return [];
  const normalizedView = String(view || '').trim().toLowerCase();
  if (section === 'hr' && normalizedView === 'training') return [{ moduleId: 'HR_TRAINING' }];
  const viewIds = VIEW_IDS[section]?.[normalizedView];
  const requirements: ManagerViewRequirement[] = [{ moduleId, ...(viewIds ? { viewIds } : {}) }];
  if (section === 'reports') {
    const source: Record<string, ManagerViewRequirement[]> = {
      overview: [
        { moduleId: 'SALES', viewIds: ['SALES_INVOICES', 'RETAIL_POS', 'SALES_CLIENTS'] },
        { moduleId: 'PURCHASES', viewIds: ['PURCHASES_ORDERS', 'PURCHASES_PROVIDERS'] },
        { moduleId: 'FINANCIAL', viewIds: ['FINANCIAL_INCOMES', 'FINANCIAL_EXPENSES'] },
        { moduleId: 'INVENTORY', viewIds: ['INVENTORY_PRODUCTS'] },
        { moduleId: 'HR', viewIds: ['HR_EMPLOYEES', 'HR_PAYROLL', 'HR_ATTENDANCE', 'HR_LEAVES'] },
        { moduleId: 'MY_COMPANY', viewIds: ['SUBSCRIPTIONS'] },
      ],
      sales: [{ moduleId: 'SALES', viewIds: ['SALES_INVOICES', 'RETAIL_POS'] }],
      purchases: [{ moduleId: 'PURCHASES', viewIds: ['PURCHASES_ORDERS'] }],
      financial: [{ moduleId: 'FINANCIAL', viewIds: ['FINANCIAL_INCOMES', 'FINANCIAL_EXPENSES'] }],
      inventory: [{ moduleId: 'INVENTORY', viewIds: ['INVENTORY_PRODUCTS'] }],
      customers: [{ moduleId: 'SALES', viewIds: ['SALES_CLIENTS'] }],
      providers: [{ moduleId: 'PURCHASES', viewIds: ['PURCHASES_PROVIDERS'] }],
      hr: [{ moduleId: 'HR', viewIds: ['HR_EMPLOYEES', 'HR_PAYROLL', 'HR_ATTENDANCE', 'HR_LEAVES'] }],
      subscriptions: [{ moduleId: 'MY_COMPANY', viewIds: ['SUBSCRIPTIONS'] }],
    };
    requirements.push(...(source[normalizedView] || []));
  }
  return requirements;
}

function isRequirementAvailable(group: ManagerGroup, branch: ManagerGroup['branches'][number], requirement: ManagerViewRequirement, section: string, view: string): boolean {
  const { moduleId, viewIds } = requirement;
  if (!moduleSet(group.enabledModules).has(moduleId)) return false;
  const { groupPolicy, groupViews, unitViews, branchViews, selective } = policyRestrictionsFor(
    moduleId,
    group,
    branch,
    group.businessUnits?.find((candidate) => candidate.id === branch.businessUnitId),
  );
  if (String(groupPolicy?.state || 'VISIBLE').toUpperCase() !== 'VISIBLE') return false;
  const unit = group.businessUnits?.find((candidate) => candidate.id === branch.businessUnitId);
  if (unit?.isActive === false) return false;
  const accepts = (values: unknown) => {
    const enabled = moduleSet(values);
    return enabled.has(moduleId) || Boolean(viewIds?.some((id) => enabled.has(id)));
  };
  if (Array.isArray(unit?.enabledModules) && unit.enabledModules.length && !accepts(unit.enabledModules)) return false;
  if (!accepts(branch.enabledModules)) return false;
  if (!viewIds && selective) return false;
  if (!viewIds?.length) return true;
  const viewName = String(view || '').trim().toLowerCase();
  if (viewName === 'overview' && selective && UNMAPPED_MANAGER_VIEWS[section]?.size) return false;
  if (UNMAPPED_MANAGER_VIEWS[section]?.has(viewName)) return false;
  return [groupViews, unitViews, branchViews].every((allowed) => allowed === null || viewIds.every((id) => allowed.includes(id)));
}

export function canViewManagerEnterpriseView(
  group: ManagerGroup | undefined,
  section: string,
  view: string,
  scope?: { branchId?: string; businessUnitId?: string },
): boolean {
  if (!group) return false;
  const requirements = managerViewRequirements(section, view);
  if (!requirements.length) return false;
  const scopedBranches = group.branches.filter((branch) => branch.isActive !== false
    && (!scope?.branchId || branch.id === scope.branchId)
    && (!scope?.businessUnitId || branch.businessUnitId === scope.businessUnitId));
  return scopedBranches.some((branch) => requirements.every((requirement) => isRequirementAvailable(group, branch, requirement, section, view)));
}

export function allowedManagerEnterpriseViews(
  group: ManagerGroup | undefined,
  section: string,
  viewIds: string[],
  scope?: { branchId?: string; businessUnitId?: string },
): string[] {
  return viewIds.filter((view) => canViewManagerEnterpriseView(group, section, view, scope));
}
