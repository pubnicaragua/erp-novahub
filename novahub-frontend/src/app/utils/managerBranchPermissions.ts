export type ManagerBranchViewOption = { id: string; parent: string };
export type ManagerBranchViewPermission = Record<string, unknown> & { module?: string };
export type ManagerBranchModulePolicy = { state?: unknown; viewIds?: unknown };

const CORE_BRANCH_VIEWS = new Set(['DASHBOARD']);
const NON_OPERATIONAL_BRANCH_VIEWS = new Set([
  'CONFIGURATION', 'CONFIG_USERS', 'CONFIG_ROLES', 'CONFIG_COMPANY', 'CONFIG_SECURITY',
  'CONFIG_BRANDING', 'CONFIG_PDF', 'CONFIG_CURRENCY', 'CONFIG_DOMAINS', 'CONFIG_DEPARTMENTS',
  'CONFIG_NOVA_PULSE', 'AUDIT_LOGS', 'SUBSCRIPTIONS', 'MY_COMPANY',
]);

function isOperationalBranchView(module: string) {
  return !NON_OPERATIONAL_BRANCH_VIEWS.has(module)
    && !module.startsWith('CONFIG_')
    && !module.startsWith('MANAGER_')
    && !module.startsWith('PLATFORM_');
}

/** Keeps the branch editor aligned with active subscriptions and inherited view limits. */
export function filterManagerBranchViewOptions<T extends ManagerBranchViewOption>(
  options: T[],
  enabledModules: unknown,
  modulePolicies: Record<string, ManagerBranchModulePolicy> = {},
  moduleViewOverrides: Array<Record<string, unknown>> = [],
): T[] {
  const enabled = new Set(Array.isArray(enabledModules)
    ? enabledModules.map((module) => String(module || '').trim().toUpperCase()).filter(Boolean)
    : []);

  return options.filter((option) => {
    const id = String(option.id || '').toUpperCase();
    const parent = String(option.parent || '').toUpperCase();
    if (!isOperationalBranchView(id)) return false;
    if (!enabled.has(parent) && !enabled.has(id) && !CORE_BRANCH_VIEWS.has(id)) return false;

    const policy = modulePolicies[parent];
    const state = String(policy?.state || 'VISIBLE').toUpperCase();
    if (state !== 'VISIBLE') return false;
    if (Array.isArray(policy?.viewIds) && !policy.viewIds.includes(id)) return false;

    return moduleViewOverrides.every((overrides) => {
      if (!Object.prototype.hasOwnProperty.call(overrides, parent)) return true;
      const views = overrides[parent];
      return Array.isArray(views) && views.includes(id);
    });
  });
}

/** Intersects the group, rubric, and branch module grants before editing access. */
export function filterManagerBranchViewOptionsForScopes<T extends ManagerBranchViewOption>(
  options: T[],
  groupModules: unknown,
  unitModules: unknown,
  branchModules: unknown,
  modulePolicies: Record<string, ManagerBranchModulePolicy> = {},
  overrides: { unit?: Record<string, unknown>; branch?: Record<string, unknown> } = {},
): T[] {
  const groupViews = new Set(filterManagerBranchViewOptions(options, groupModules, modulePolicies).map((view) => view.id));
  const unitViews = new Set(filterManagerBranchViewOptions(
    options,
    unitModules,
    modulePolicies,
    [overrides.unit || {}],
  ).map((view) => view.id));
  return filterManagerBranchViewOptions(
    options,
    branchModules,
    modulePolicies,
    [overrides.unit || {}, overrides.branch || {}],
  ).filter((view) => groupViews.has(view.id) && unitViews.has(view.id));
}

/** Checks the selected Manager branch views, including parent shells and their children. */
export function managerBranchCanReadView(
  permissions: ManagerBranchViewPermission[],
  module: string,
  relatedModules: string[] = [],
): boolean {
  const allowedModules = new Set([module, ...relatedModules]
    .map((item) => String(item || '').trim().toUpperCase())
    .filter(Boolean));
  return permissions.some((permission) => {
    const permissionModule = String(permission.module || '').trim().toUpperCase();
    return allowedModules.has(permissionModule)
      && (permission.read === true || permission.view === true || permission.canView === true);
  });
}
