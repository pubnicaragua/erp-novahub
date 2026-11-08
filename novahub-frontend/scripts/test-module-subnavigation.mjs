import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');
const app = await source('../src/app/App.tsx');
const sidebar = await source('../src/app/components/Sidebar.tsx');
const tracking = await source('../src/app/components/TrackingPage.tsx');
const intlImports = await source('../src/app/components/intl-imports/IntlImportsPage.tsx');
const activities = await source('../src/app/components/ActividadesPage.tsx');
const tickets = await source('../src/app/components/TicketsPage.tsx');
const organization = await source('../src/app/components/organizacion/OrganizacionPage.tsx');
const marketing = await source('../src/app/components/marketing/MarketingPage.tsx');
const projects = await source('../src/app/components/ProyectosPage.tsx');
const projectDetail = await source('../src/app/components/proyectos/ProyectoDetalleView.tsx');
const training = await source('../src/app/components/help/TrainingHubView.tsx');
const technicalSupport = await source('../src/app/components/help/SoporteTecnicoView.tsx');
const technicalSupportAdmin = await source('../src/app/components/help/SoporteTecnicoAdminView.tsx');
const sharedSubnavigation = await source('../src/app/components/ui/ModuleSubnavigation.tsx');
const { getSidebarAwareNavigationClass } = await import('../src/app/utils/sidebarNavigation.mjs').catch(() => ({}));

assert.equal(typeof getSidebarAwareNavigationClass, 'function', 'sidebar-aware navigation helper exists');
assert.equal(getSidebarAwareNavigationClass(true), '', 'collapsed sidebar leaves the in-page navigation visible');
assert.equal(getSidebarAwareNavigationClass(false), 'lg:hidden', 'expanded desktop sidebar hides duplicate navigation while mobile remains available');
assert.equal(getSidebarAwareNavigationClass(undefined), '', 'missing sidebar state keeps standalone navigation visible');

for (const moduleId of ['tracking', 'intl-imports', 'actividades', 'tickets', 'organizacion', 'marketing', 'proyectos', 'centro-capacitacion']) {
  const escapedId = moduleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const casePattern = new RegExp(`case '${escapedId}':[\\s\\S]{0,260}isSidebarCollapsed=\\{isCollapsed\\}`);
  assert.match(app, casePattern, `${moduleId} receives the desktop sidebar collapse state`);
}

assert.match(sharedSubnavigation, /getSidebarAwareNavigationClass\(isSidebarCollapsed\)/, 'the shared navigation applies the sidebar visibility rule');

for (const [name, component] of [
  ['Tracking', tracking],
  ['Importaciones Internacionales', intlImports],
  ['Organización', organization],
  ['Marketing', marketing],
]) {
  assert.match(component, /<ModuleSubnavigation\b/, `${name} uses the shared subnavigation component`);
}

for (const [name, component] of [
  ['Actividades', activities],
  ['Gestión de tickets', tickets],
  ['Proyectos', projectDetail],
  ['Centro de capacitación', training],
  ['Soporte técnico', technicalSupport],
  ['Soporte técnico administrador', technicalSupportAdmin],
]) {
  assert.match(component, /<ModuleSubnavigation\b/, `${name} uses the shared subnavigation component`);
  assert.match(component, /isSidebarCollapsed=\{isSidebarCollapsed\}/, `${name} passes the sidebar state to the shared visibility rule`);
}

for (const [name, component] of [['Organización', organization], ['Marketing', marketing]]) {
  assert.match(component, /items=\{VIEW_TABS\.filter/, `${name} limits navigation choices to permitted views`);
  assert.match(component, /onSubModuleChange\?\.\(/, `${name} synchronizes tab changes with the active submodule`);
}

assert.match(projects, /isSidebarCollapsed=\{isSidebarCollapsed\}/, 'Project details receive the sidebar collapse state');
assert.match(sidebar, /TRAINING_SUBMODULES[\s\S]*?ALL[\s\S]*?SALES[\s\S]*?PURCHASES[\s\S]*?INVENTORY[\s\S]*?FINANCIAL[\s\S]*?HR[\s\S]*?ACTIVITIES[\s\S]*?CONFIGURATION/, 'Training sidebar destinations mirror every current category');
assert.match(sidebar, /SUPPORT_CUSTOMER_SUBMODULES[\s\S]*?BUG[\s\S]*?HELP[\s\S]*?FEATURE[\s\S]*?SUPPORT_ADMIN_SUBMODULES[\s\S]*?OPEN[\s\S]*?IN_PROGRESS[\s\S]*?RESOLVED[\s\S]*?CLOSED/, 'Technical support destinations mirror customer categories and administrator statuses');
assert.match(sidebar, /isSubmenuVisibleForCurrentRole/, 'Technical support sidebar filters are role aware');
assert.match(technicalSupport, /activeSubModule \|\| 'ALL'/, 'Customer support filters initialize from the active sidebar submodule');
assert.match(technicalSupportAdmin, /activeSubModule \|\| 'ALL'/, 'Administrator support filters initialize from the active sidebar submodule');
assert.match(technicalSupport, /CATEGORIES\.some\(\(category\) => category\.id === activeSubModule\)/, 'Customer support rejects administrator-only sidebar submodules');
assert.match(technicalSupportAdmin, /STATUS_OPTIONS\.includes\(activeSubModule\)/, 'Administrator support rejects customer-only sidebar submodules');

console.log('module subnavigation sidebar visibility and destination contracts are present');
