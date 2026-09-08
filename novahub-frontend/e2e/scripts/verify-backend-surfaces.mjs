import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const frontendDir = process.cwd();
const backendDir = process.env.E2E_BACKEND_DIR?.trim()
  || path.resolve(frontendDir, '..', '..', 'Backend');
const sourceDir = path.join(backendDir, 'src');

/**
 * Clasificación intencional de cada controller del backend.
 * `uiModule` enlaza una superficie visible; las otras categorías evitan
 * ocultar endpoints de infraestructura o públicos detrás de un falso smoke UI.
 */
const SURFACE_CLASSIFICATION = {
  'src/accounting/accounting.controller.ts': { category: 'ui', uiModule: 'contabilidad' },
  'src/activities/activities.controller.ts': { category: 'ui', uiModule: 'actividades' },
  'src/ai/ai.controller.ts': { category: 'backend-only', reason: 'servicio auxiliar de IA' },
  'src/app.controller.ts': { category: 'infrastructure', reason: 'raíz de la aplicación' },
  'src/audit/audit.controller.ts': { category: 'backend-only', reason: 'auditoría consultable por dominio' },
  'src/auth/auth.controller.ts': { category: 'infrastructure', reason: 'autenticación y sesión' },
  'src/branding/branding.controller.ts': { category: 'ui', uiModule: 'configuracion' },
  'src/caja/caja.controller.ts': { category: 'ui', uiModule: 'ventas' },
  'src/country-config/country-config.controller.ts': { category: 'backend-only', reason: 'catálogo de configuración regional' },
  'src/documents/documents.controller.ts': { category: 'ui', uiModule: 'documentos' },
  'src/enterprise-groups/enterprise-groups.controller.ts': { category: 'ui', uiModule: 'tenant-admin' },
  'src/financials/financials.controller.ts': { category: 'ui', uiModule: 'finanzas' },
  'src/financing/financing.controller.ts': { category: 'ui', uiModule: 'financiamiento-pyme' },
  'src/fixed-assets/fixed-assets.controller.ts': { category: 'backend-only', reason: 'activos fijos sin superficie raíz propia' },
  'src/force-sales/force-sales.controller.ts': { category: 'ui', uiModule: 'fuerza-comercial' },
  'src/health/health.controller.ts': { category: 'infrastructure', reason: 'health checks' },
  'src/hr/hr.controller.ts': { category: 'ui', uiModule: 'rh' },
  'src/inventory/bank-account.controller.ts': { category: 'backend-only', reason: 'cuentas bancarias usadas por Finanzas/Caja' },
  'src/inventory/company-assets.controller.ts': { category: 'backend-only', reason: 'activos de empresa' },
  'src/inventory/inventory.controller.ts': { category: 'ui', uiModule: 'inventario' },
  'src/inventory/sucursal.controller.ts': { category: 'backend-only', reason: 'alcance operativo de sucursal' },
  'src/inventory/warehouse-supply.controller.ts': { category: 'backend-only', reason: 'abastecimiento de bodega' },
  'src/leads/leads.controller.ts': { category: 'backend-only', reason: 'compatibilidad de leads' },
  'src/legal/legal.controller.ts': { category: 'ui', uiModule: 'asesoria-legal' },
  'src/logistics/logistics.controller.ts': { category: 'backend-only', reason: 'logística auxiliar' },
  'src/master-console/master-console.controller.ts': { category: 'backend-only', reason: 'consola de plataforma' },
  'src/module-pricing/module-pricing.controller.ts': { category: 'backend-only', reason: 'precios de módulos de plataforma' },
  'src/notifications/notifications.controller.ts': { category: 'ui', uiModule: 'notificaciones' },
  'src/novachat/novachat.controller.ts': { category: 'ui', uiModule: 'novachat' },
  'src/pdf-document-designs/pdf-document-designs.controller.ts': { category: 'backend-only', reason: 'plantillas PDF' },
  'src/pdf-previews/pdf-previews.controller.ts': { category: 'backend-only', reason: 'previsualización PDF' },
  'src/projects/projects.controller.ts': { category: 'ui', uiModule: 'proyectos' },
  'src/public-access/public-access.controller.ts': { category: 'public', reason: 'acceso público controlado' },
  'src/purchases/purchases.controller.ts': { category: 'ui', uiModule: 'compras' },
  'src/qa-console/qa-console.controller.ts': { category: 'ui', uiModule: 'qa-console' },
  'src/restaurant/restaurant-public.controller.ts': { category: 'public', reason: 'menú/orden pública' },
  'src/restaurant/restaurant.controller.ts': { category: 'ui', uiModule: 'restaurante' },
  'src/roles/roles.controller.ts': { category: 'backend-only', reason: 'administración de roles embebida en Suscripciones' },
  'src/sales/sales.controller.ts': { category: 'ui', uiModule: 'ventas' },
  'src/storage/storage.controller.ts': { category: 'backend-only', reason: 'almacenamiento de archivos' },
  'src/subscriptions/subscriptions.controller.ts': { category: 'ui', uiModule: 'suscripciones' },
  'src/support-tickets/support-tickets.controller.ts': { category: 'ui', uiModule: 'soporte-tecnico' },
  'src/tenants/admin.controller.ts': { category: 'ui', uiModule: 'tenant-admin' },
  'src/tenants/tenants.controller.ts': { category: 'backend-only', reason: 'provisionamiento y administración de tenants' },
  'src/tools/tools.controller.ts': { category: 'infrastructure', reason: 'herramientas operativas' },
  'src/tracking/tracking.controller.ts': { category: 'ui', uiModule: 'tracking' },
  'src/training/training.controller.ts': { category: 'ui', uiModule: 'centro-capacitacion' },
  'src/users/users.controller.ts': { category: 'backend-only', reason: 'usuarios administrados por Suscripciones/Tenant Admin' },
  'src/ventas/ventas.controller.ts': { category: 'backend-only', reason: 'compatibilidad histórica de Ventas' },
};

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.name.endsWith('.controller.ts') ? [fullPath] : [];
  });
}

function normalizeRelative(filePath) {
  return path.relative(backendDir, filePath).replaceAll(path.sep, '/');
}

function extractControllerPrefix(source, relativePath) {
  const match = source.match(/@Controller\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/);
  if (!match) throw new Error(`No se encontró @Controller en ${relativePath}`);
  return String(match[1] || '').replace(/^\/+|\/+$/g, '');
}

function extractRoutes(source, prefix) {
  const routes = [];
  const routePattern = /^\s*@(Get|Post|Patch|Put|Delete|Options|Head|All)\s*(?:\(\s*(?:['"`]([^'"`]*)['"`])?\s*\))?/;
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(routePattern);
    if (!match) continue;
    const suffix = String(match[2] || '').replace(/^\/+|\/+$/g, '');
    routes.push(`/${[prefix, suffix].filter(Boolean).join('/')}`);
  }
  return routes;
}

const files = walk(sourceDir).sort();
const discovered = files.map((filePath) => {
  const relativePath = normalizeRelative(filePath);
  const classification = SURFACE_CLASSIFICATION[relativePath];
  if (!classification) throw new Error(`Controller sin clasificación E2E: ${relativePath}`);
  const source = fs.readFileSync(filePath, 'utf8');
  const prefix = extractControllerPrefix(source, relativePath);
  return { file: relativePath, ...classification, prefix, routes: extractRoutes(source, prefix) };
});

const staleClassifications = Object.keys(SURFACE_CLASSIFICATION)
  .filter((file) => !discovered.some((entry) => entry.file === file));
if (staleClassifications.length > 0) {
  throw new Error(`Clasificaciones sin controller: ${staleClassifications.join(', ')}`);
}

const byCategory = discovered.reduce((grouped, entry) => {
  grouped[entry.category] = [...(grouped[entry.category] || []), entry];
  return grouped;
}, {});
const report = {
  controllers: discovered.length,
  routes: discovered.reduce((count, entry) => count + entry.routes.length, 0),
  byCategory: Object.fromEntries(Object.entries(byCategory).map(([category, entries]) => [category, entries.length])),
  uiModules: [...new Set(discovered.filter((entry) => entry.uiModule).map((entry) => entry.uiModule))].sort(),
};
if (process.env.E2E_BACKEND_SURFACES_VERBOSE === '1') report.surfaces = discovered;
console.log(JSON.stringify(report, null, 2));
