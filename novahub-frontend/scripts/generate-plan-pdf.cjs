const { PDFDocument, rgb, StandardFonts, PDFName } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const PRIMARY = rgb(0.13, 0.15, 0.23);    // #22273a dark navy
const ACCENT  = rgb(0.30, 0.55, 0.85);    // #4d8cd9 blue
const GRAY    = rgb(0.45, 0.48, 0.55);    // gray text
const LGRAY   = rgb(0.93, 0.94, 0.96);    // light gray bg
const WHITE   = rgb(1, 1, 1);
const BLACK   = rgb(0, 0, 0);
const RED_ACCENT = rgb(0.85, 0.25, 0.25);

async function generatePDF() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const W = 595.28;  // A4 width
  const H = 841.89;  // A4 height
  const ML = 55;     // margin left
  const MR = 55;
  const MT = 65;
  const MB = 65;
  const CW = W - ML - MR; // content width

  let page = pdf.addPage([W, H]);
  let y = MT;

  function newPage() {
    page = pdf.addPage([W, H]);
    y = MT;
    drawFooter(page);
  }

  function drawFooter(p) {
    p.drawText('NovaHub ERP — Plan Técnico', {
      x: ML, y: 35, size: 8, font: italicFont, color: GRAY,
    });
    p.drawText(`Página ${pdf.getPageCount()}`, {
      x: W - MR - 40, y: 35, size: 8, font, color: GRAY,
    });
    p.drawLine({ start: { x: ML, y: 48 }, end: { x: W - MR, y: 48 }, thickness: 0.5, color: LGRAY });
  }

  function checkPage(needed) {
    if (y + needed > H - MB) {
      newPage();
    }
  }

  function drawTitle(text, opts = {}) {
    const size = opts.size || 22;
    checkPage(size + 20);
    page.drawText(text, { x: ML, y, size, font: boldFont, color: PRIMARY });
    y -= 4;
    page.drawLine({ start: { x: ML, y }, end: { x: ML + (opts.lineWidth || 180), y }, thickness: 2, color: ACCENT });
    y -= size + 12;
  }

  function drawSection(text) {
    const size = 14;
    checkPage(size + 16);
    page.drawRectangle({ x: ML - 5, y: y - 2, width: CW + 10, height: size + 10, color: rgb(0.95, 0.96, 0.98) });
    page.drawText(text, { x: ML + 5, y, size, font: boldFont, color: ACCENT });
    y -= size + 14;
  }

  function drawSubsection(text) {
    const size = 11;
    checkPage(size + 12);
    page.drawText(text, { x: ML, y, size, font: boldFont, color: PRIMARY });
    y -= size + 8;
  }

  function drawBody(text, opts = {}) {
    const size = opts.size || 10;
    const maxWidth = opts.maxWidth || CW;
    const lines = wrapText(text, font, size, maxWidth);
    checkPage(lines.length * (size + 3));
    for (const line of lines) {
      page.drawText(line, { x: opts.x || ML, y, size, font: opts.font || font, color: opts.color || BLACK });
      y -= size + 3;
    }
    if (opts.afterSpacing) y -= opts.afterSpacing;
  }

  function drawBullet(text, indent = 0) {
    const size = 10;
    checkPage(size + 6);
    page.drawText('•', { x: ML + indent, y, size, font: boldFont, color: ACCENT });
    const lines = wrapText(text, font, size, CW - indent - 15);
    for (let i = 0; i < lines.length; i++) {
      page.drawText(lines[i], { x: ML + indent + 12, y, size, font, color: BLACK });
      y -= size + 3;
    }
    y -= 2;
  }

  function drawTable(headers, rows) {
    const size = 9;
    const colW = CW / headers.length;
    const rowH = 18;
    const totalH = (rows.length + 1) * rowH + 10;
    checkPage(totalH);

    // Header bg
    page.drawRectangle({
      x: ML, y: y - 2, width: CW, height: rowH,
      color: PRIMARY,
    });
    headers.forEach((h, i) => {
      page.drawText(h, {
        x: ML + i * colW + 5, y: y + 4, size, font: boldFont, color: WHITE,
      });
    });
    y -= rowH;

    rows.forEach((row, ri) => {
      const bgColor = ri % 2 === 0 ? WHITE : LGRAY;
      page.drawRectangle({
        x: ML, y: y - 2, width: CW, height: rowH,
        color: bgColor,
      });
      row.forEach((cell, ci) => {
        const cellText = String(cell).substring(0, 50);
        page.drawText(cellText, {
          x: ML + ci * colW + 5, y: y + 4, size, font, color: BLACK,
        });
      });
      y -= rowH;
    });
    y -= 8;
  }

  function wrapText(text, f, size, maxW) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const w of words) {
      const test = current ? current + ' ' + w : w;
      const tw = f.widthOfTextAtSize(test, size);
      if (tw > maxW && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  // ─────────────────────────────────────────────
  // COVER PAGE
  // ─────────────────────────────────────────────
  // Dark background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PRIMARY });

  // Accent bar top
  page.drawRectangle({ x: 0, y: H - 8, width: W, height: 8, color: ACCENT });

  // Title
  page.drawText('NOVAHUB ERP', {
    x: ML, y: H - 180, size: 38, font: boldFont, color: WHITE,
  });
  page.drawText('Plan Tecnico', {
    x: ML, y: H - 220, size: 28, font, color: rgb(0.6, 0.75, 1),
  });
  page.drawText('Grupo Empresarial + Sucursales', {
    x: ML, y: H - 255, size: 18, font: italicFont, color: rgb(0.5, 0.65, 0.9),
  });

  // Line
  page.drawLine({ start: { x: ML, y: H - 275 }, end: { x: ML + 200, y: H - 275 }, thickness: 2, color: ACCENT });

  // Subtitle
  const coverItems = [
    'Mejora de mensajes de error (403)',
    'Arquitectura de Grupo Empresarial',
    'Sistema de sucursales multi-tenant',
    'Transferencias inter-sucursal',
    'Dashboard consolidado',
  ];
  let cy = H - 310;
  for (const item of coverItems) {
    page.drawText(item, { x: ML + 15, y: cy, size: 12, font, color: rgb(0.75, 0.82, 0.95) });
    page.drawText('>', { x: ML, y: cy, size: 12, font: boldFont, color: ACCENT });
    cy -= 22;
  }

  // Date and version
  page.drawText('Fecha: 18 de Agosto 2026', {
    x: ML, y: 120, size: 11, font, color: rgb(0.6, 0.7, 0.85),
  });
  page.drawText('Version: 1.0', {
    x: ML, y: 102, size: 11, font, color: rgb(0.6, 0.7, 0.85),
  });
  page.drawText('NovaHub ERP — Backend NestJS + Prisma | Frontend React', {
    x: ML, y: 80, size: 9, font: italicFont, color: rgb(0.5, 0.6, 0.75),
  });

  // Accent bar bottom
  page.drawRectangle({ x: 0, y: 0, width: W, height: 8, color: ACCENT });

  // ─────────────────────────────────────────────
  // TABLE OF CONTENTS
  // ─────────────────────────────────────────────
  newPage();
  drawTitle('Indice');
  const toc = [
    ['FASE 1', 'Mejora de Mensajes de Error'],
    ['  1.1', 'Labels de permisos faltantes'],
    ['  1.2', 'Labels de modulos faltantes'],
    ['  1.3', 'Corregir error path en GET query'],
    ['  1.4', 'Limpiar codigo muerto (Axios)'],
    ['FASE 2', 'Arquitectura Grupo Empresarial / Sucursales'],
    ['  2.1', 'Schema: Jerarquia padre-hijo en ClientTenant'],
    ['  2.2', 'Guard de acceso cruzado para managers'],
    ['  2.3', 'Endpoint de dashboard consolidado'],
    ['  2.4', 'Endpoint de listado de sucursales'],
    ['  2.5', 'Transferencias inter-sucursal'],
    ['  2.6', 'Vista Manager del Grupo Empresarial'],
    ['  2.7', 'Integracion en App.tsx'],
    ['  2.8', 'Flag isGroupAdmin en AuthContext'],
    ['  2.9', 'Sidebar para grupo empresarial'],
    ['FASE 3', 'Migracion y Deploy'],
    ['  3.1', 'Migracion Prisma idempotente'],
    ['  3.2', 'Regenerar Prisma Client'],
    ['  3.3', 'Verificar TypeScript'],
    ['  3.4', 'Build frontend'],
  ];
  for (const [num, title] of toc) {
    const isPhase = num.startsWith('FASE');
    checkPage(20);
    const x = isPhase ? ML : ML + 15;
    page.drawText(num, {
      x, y, size: isPhase ? 11 : 10, font: isPhase ? boldFont : font,
      color: isPhase ? ACCENT : BLACK,
    });
    page.drawText(title, {
      x: x + (isPhase ? 90 : 50), y, size: isPhase ? 11 : 10,
      font: isPhase ? boldFont : font, color: isPhase ? PRIMARY : GRAY,
    });
    y -= isPhase ? 20 : 17;
  }

  // ─────────────────────────────────────────────
  // FASE 1: MEJORAS DE ERROR
  // ─────────────────────────────────────────────
  newPage();
  drawTitle('FASE 1: Mejora de Mensajes de Error');
  drawBody('Los errores de permisos (403) llegan al frontend como "Cannot POST /api/hr/payment-requests" sin contexto util. El backend si envia mensajes claros pero el frontend los pierde en ciertos caminos. Esta fase corrige la experiencia de usuario para errores de autorizacion.');
  y -= 8;

  drawSection('1.1 Labels de Permisos Faltantes');
  drawBody('Archivo: erp-novahub/novahub-frontend/src/app/services/api.ts');
  drawBody('El mapa PERMISSION_LABELS solo cubre read, write, create, update, delete, approve. Se agregan:');
  y -= 4;

  drawTable(
    ['Accion', 'Label en Espanol'],
    [
      ['submit', 'enviar'],
      ['reject', 'rechazar'],
      ['pay', 'pagar'],
      ['apply', 'aplicar'],
      ['manage', 'gestionar'],
      ['confirm', 'confirmar'],
      ['process', 'procesar'],
      ['cancel', 'anular'],
      ['authorize', 'autorizar'],
      ['reopen', 'reabrir'],
      ['close', 'cerrar'],
      ['duplicate', 'duplicar'],
      ['convert', 'convertir'],
      ['assign', 'asignar'],
      ['download', 'descargar'],
      ['generate', 'generar'],
      ['send', 'enviar'],
      ['print', 'imprimir'],
      ['export', 'exportar'],
      ['import', 'importar'],
      ['deactivate', 'desactivar'],
      ['reverse', 'revertir'],
      ['reconcile', 'conciliar'],
      ['any', 'realizar esta accion'],
    ]
  );

  drawSection('1.2 Labels de Modulos Faltantes');
  drawBody('El mapa MODULE_LABELS no tiene modulos de RRHH y Contabilidad. Se agregan:');
  drawTable(
    ['Codigo', 'Label'],
    [
      ['HR', 'Recursos Humanos'],
      ['HR_PAYROLL', 'Nomina'],
      ['HR_TRAINING', 'Capacitaciones'],
      ['HR_BENEFITS', 'Beneficios'],
      ['ACCOUNTING', 'Contabilidad'],
      ['ACCOUNTING_JOURNAL', 'Asientos Contables'],
      ['ACCOUNTING_HR_PAYMENT_REQUESTS', 'Solicitudes de Pago RRHH'],
    ]
  );

  drawSection('1.3 Corregir Error Path en GET Query');
  drawBody('Archivo: SolicitudesPagoRRHHView.tsx (Linea 300)');
  drawBody('El componente muestra un mensaje generico y descarta el error real de la API. Cambiar para mostrar query.error.message cuando este disponible:');
  drawBody('Antes: "No se pudieron cargar las solicitudes. Revisa tu acceso a Contabilidad."', { font: italicFont, color: GRAY });
  drawBody('Despues: {query.error?.message || "No se pudieron cargar las solicitudes. Verifica tus permisos."}', { font: italicFont, color: GRAY });
  y -= 4;

  drawSection('1.4 Limpiar Codigo Muerto');
  drawBody('Archivo: SolicitudesPagoRRHHView.tsx (Linea 174)');
  drawBody('error?.response?.data?.message es patron Axios pero se usa fetch. El fallback funciona por error.message, pero es dead code. Simplificar a solo error?.message.');

  // ─────────────────────────────────────────────
  // FASE 2
  // ─────────────────────────────────────────────
  newPage();
  drawTitle('FASE 2: Arquitectura Grupo Empresarial / Sucursales');

  drawSection('Contexto y Decisiones');
  drawBody('Decisiones tomadas en la reunion del 18 de Agosto 2026:');
  drawBullet('Grupo = Tenant padre: Un ClientTenant "padre" con multiples ClientTenant "hijos" (sucursales)');
  drawBullet('Inventario por sucursal: Cada sucursal tiene sus productos y bodegas independientes');
  drawBullet('Manager solo lectura + reportes: El manager del grupo ve datos consolidados pero no opera');
  drawBullet('Clientes separados: Cada sucursal tiene su propia base de clientes');
  y -= 6;

  drawSection('2.1 Schema: Jerarquia padre-hijo en ClientTenant');
  drawBody('Archivo: BackendERPNH/prisma/schema.prisma');
  drawBody('Se agrega campo parentTenantId al modelo ClientTenant:');
  y -= 4;
  drawTable(
    ['Campo', 'Tipo', 'Descripcion'],
    [
      ['parentTenantId', 'String?', 'FK al tenant padre (Grupo Empresarial)'],
      ['parentTenant', 'ClientTenant?', 'Relacion inverse al padre'],
      ['children', 'ClientTenant[]', 'Relacion a tenants hijos (sucursales)'],
    ]
  );
  drawBody('Un Grupo Empresarial es un ClientTenant sin parentTenantId (es raiz). Una Sucursal es un ClientTenant con parentTenantId apuntando al grupo. El campo es nullable para compatibilidad con tenants existentes.');
  y -= 4;
  drawSubsection('Migracion SQL idempotente:');
  drawBody('ALTER TABLE "ClientTenant" ADD COLUMN IF NOT EXISTS "parentTenantId" UUID;', { font: await pdf.embedFont(StandardFonts.Courier), size: 8.5 });
  drawBody('ALTER TABLE "ClientTenant" ADD CONSTRAINT IF NOT EXISTS "ClientTenant_parentTenantId_fkey"', { font: await pdf.embedFont(StandardFonts.Courier), size: 8.5 });
  drawBody('  FOREIGN KEY ("parentTenantId") REFERENCES "ClientTenant"("id") ON DELETE SET NULL;', { font: await pdf.embedFont(StandardFonts.Courier), size: 8.5 });

  drawSection('2.2 Guard de Acceso Cruzado para Managers');
  drawBody('Archivo nuevo: BackendERPNH/src/common/guards/tenant-scope.guard.ts');
  drawBody('Guard/middleware que permite a usuarios del tenant padre acceder a datos de tenants hijos (solo lectura):');
  drawBullet('Si el usuario es SUPER_ADMIN -> acceso total (ya existe)');
  drawBullet('Si el usuario tiene parentTenantId === null (es grupo) -> puede leer datos de sus children');
  drawBullet('Si el usuario es un tenant normal -> solo su propio clientTenantId (ya existe)');
  y -= 4;
  drawBody('El guard debe:');
  drawBullet('Verificar que el usuario tenga role admin o manager en el tenant padre');
  drawBullet('Permitir queries con ?tenantId=xxx donde xxx es un child del tenant padre');
  drawBullet('Bloquear escritura (solo GET permitido para datos cruzados)');
  drawBullet('Registrar auditoria de acceso cruzado');

  drawSection('2.3 Endpoint de Dashboard Consolidado');
  drawBody('Endpoint: GET /api/tenants/group-dashboard?period=month');
  drawBody('Retorna KPIs agregados de todos los tenants hijos del grupo:');
  drawBullet('Total ingresos (suma de todos los hijos)');
  drawBullet('Total gastos');
  drawBullet('Total ordenes de venta');
  drawBullet('Inventario total (suma de stock por producto)');
  drawBullet('Top productos vendidos (agregados)');
  drawBullet('Alertas de inventario por sucursal');
  drawBullet('Ranking de sucursales por facturacion');
  y -= 4;
  drawSubsection('Metodo en tenants.service.ts:');
  drawBody('getGroupDashboard(parentTenantId, period):');
  drawBullet('1. Buscar todos los ClientTenant donde parentTenantId = X');
  drawBullet('2. Para cada hijo, ejecutar la logica de getDashboard() del caja service');
  drawBullet('3. Agregar resultados en un dashboard consolidado');
  drawBullet('4. Retornar con identificacion de sucursal en cada registro');

  drawSection('2.4 Endpoint de Listado de Sucursales');
  drawBody('Endpoint: GET /api/tenants/group-branches');
  drawBody('Retorna lista de tenants hijos con:');
  drawTable(
    ['Campo', 'Tipo', 'Descripcion'],
    [
      ['id', 'String', 'ID del tenant hijo'],
      ['name', 'String', 'Nombre de la sucursal'],
      ['slug', 'String', 'Slug unico'],
      ['isActive', 'Boolean', 'Estado de la sucursal'],
      ['ingresosMes', 'Number', 'Ingresos del mes actual'],
      ['ordenesCount', 'Number', 'Ordenes de venta del mes'],
      ['stockBajo', 'Number', 'Productos con stock bajo'],
      ['enabledModules', 'String[]', 'Modulos habilitados'],
    ]
  );

  // ─────────────────────────────────────────────
  // 2.5 Transferencias inter-sucursal
  // ─────────────────────────────────────────────
  newPage();
  drawSection('2.5 Transferencias Inter-Sucursal');
  drawBody('Archivo: BackendERPNH/prisma/schema.prisma');
  drawBody('Se extiende el modelo Transfer para soportar transferencias entre tenants:');
  y -= 4;
  drawTable(
    ['Campo Nuevo', 'Tipo', 'Descripcion'],
    [
      ['interTenantTransferId', 'String?', 'ID del transfer espejo en el otro tenant'],
      ['sourceTenantId', 'String?', 'Tenant origen (transferencias inter-tenant)'],
      ['destTenantId', 'String?', 'Tenant destino (transferencias inter-tenant)'],
    ]
  );

  drawSubsection('Logica de transferencia inter-sucursal:');
  drawBullet('1. Usuario en Sucursal A crea transferencia hacia Sucursal B');
  drawBullet('2. Se crean DOS registros Transfer:');
  drawBullet('   En Sucursal A: fromId=warehouse_A, status=COMPLETED, tipo OUT', 15);
  drawBullet('   En Sucursal B: toId=warehouse_B, status=PENDING, tipo IN', 15);
  drawBullet('   Ambos vinculados por interTenantTransferId', 15);
  drawBullet('3. Al completar la transferencia en Sucursal B:');
  drawBullet('   Se decrementa stock en Sucursal A (ya hecho al crear)', 15);
  drawBullet('   Se incrementa stock en Sucursal B', 15);
  drawBullet('   Se generan asientos contables en ambas sucursales', 15);
  y -= 4;

  drawSubsection('Endpoint nuevo:');
  drawBody('POST /inventory/transfers/inter-tenant');
  const mono = await pdf.embedFont(StandardFonts.Courier);
  drawBody('{ sourceTenantId, destTenantId, fromWarehouseId, toWarehouseId,', { font: mono, size: 8.5 });
  drawBody('  items: [{ variantId, quantity }], notes? }', { font: mono, size: 8.5 });

  // ─────────────────────────────────────────────
  // 2.6-2.9 Frontend
  // ─────────────────────────────────────────────
  drawSection('2.6 Vista Manager del Grupo Empresarial');
  drawBody('Archivo nuevo: erp-novahub/novahub-frontend/src/app/components/GroupManagerDashboard.tsx');
  drawBody('Componente principal que muestra:');
  drawBullet('Header: Nombre del grupo empresarial + selector de periodo');
  drawBullet('KPIs consolidados: 4 tarjetas (Ingresos Totales, Gastos, Ordenes, Margen)');
  drawBullet('Tabla de sucursales: Nombre, Ingresos, Ordenes, Stock Bajo, Estado');
  drawBullet('Grafico de barras: Ingresos por sucursal');
  drawBullet('Top productos agregados: Los mas vendidos en todo el grupo');
  drawBullet('Alertas consolidadas: Productos sin stock, stock bajo por sucursal');
  drawBullet('Detalle de sucursal: Al hacer clic, muestra dashboard individual (read-only)');
  y -= 4;

  drawSection('2.7 Integracion en App.tsx');
  drawBody('Se agrega routing para el rol de grupo empresarial en el modulo overview:');
  drawBody('if (user?.isGroupAdmin) -> GroupManagerDashboard', { font: mono, size: 8.5 });
  y -= 4;

  drawSection('2.8 Flag isGroupAdmin en AuthContext');
  drawBody('Archivo: AuthContext.tsx');
  drawBody('En createUserObject, se agrega:');
  drawBody('const isGroupAdmin = !isPlatformAdmin && userData.hasChildren === true;', { font: mono, size: 8.5 });
  drawBody('El backend debe retornar hasChildren: true en la respuesta de login cuando el tenant tiene hijos.');

  drawSection('2.9 Sidebar para Grupo Empresarial');
  drawBody('Archivo: Sidebar.tsx');
  drawBody('Se crea un tercer conjunto de menus para el rol de grupo:');
  drawTable(
    ['Menu Item', 'Modulo', 'Icono'],
    [
      ['Dashboard Grupo', 'overview', 'LayoutDashboard'],
      ['Sucursales', 'sucursales', 'Building2'],
      ['Reportes Consolidados', 'reportes', 'BarChart3'],
      ['Transferencias', 'inventario', 'ArrowLeftRight'],
      ['Configuracion', 'configuracion', 'Settings'],
    ]
  );

  // ─────────────────────────────────────────────
  // FASE 3: Migracion y Deploy
  // ─────────────────────────────────────────────
  newPage();
  drawTitle('FASE 3: Migracion y Deploy');

  drawSection('3.1 Migracion Prisma Idempotente');
  drawBody('La migracion usa IF NOT EXISTS para ser idempotente y segura:');
  drawBody('-- Agregar parentTenantId', { font: mono, size: 8.5, color: GRAY });
  drawBody('ALTER TABLE "ClientTenant" ADD COLUMN IF NOT EXISTS "parentTenantId" UUID;', { font: mono, size: 8.5 });
  drawBody('ALTER TABLE "ClientTenant" ADD CONSTRAINT IF NOT EXISTS', { font: mono, size: 8.5 });
  drawBody('  "ClientTenant_parentTenantId_fkey"', { font: mono, size: 8.5 });
  drawBody('  FOREIGN KEY ("parentTenantId") REFERENCES "ClientTenant"("id") ON DELETE SET NULL;', { font: mono, size: 8.5 });
  y -= 4;
  drawBody('-- Agregar campos de transfer inter-tenant', { font: mono, size: 8.5, color: GRAY });
  drawBody('ALTER TABLE "Transfer" ADD COLUMN IF NOT EXISTS "interTenantTransferId" TEXT;', { font: mono, size: 8.5 });
  drawBody('ALTER TABLE "Transfer" ADD COLUMN IF NOT EXISTS "sourceTenantId" TEXT;', { font: mono, size: 8.5 });
  drawBody('ALTER TABLE "Transfer" ADD COLUMN IF NOT EXISTS "destTenantId" TEXT;', { font: mono, size: 8.5 });

  drawSection('3.2 Regenerar Prisma Client');
  drawBody('Comando: npx prisma generate');
  drawBody('Esto regenera el Prisma Client con los nuevos campos del schema.');

  drawSection('3.3 Verificar TypeScript');
  drawBody('Comando: npx tsc --noEmit');
  drawBody('Verificar que no hay errores nuevos (solo los pre-existentes en spec/seed).');

  drawSection('3.4 Build Frontend');
  drawBody('Comando: cd erp-novahub/novahub-frontend && npm run build');
  drawBody('Compilar el frontend con los nuevos componentes (GroupManagerDashboard, etc.).');

  // ─────────────────────────────────────────────
  // RESUMEN DE ARCHIVOS
  // ─────────────────────────────────────────────
  newPage();
  drawTitle('Resumen de Archivos');

  drawSection('Archivos a Modificar');
  drawTable(
    ['Archivo', 'Fase', 'Accion'],
    [
      ['api.ts (frontend)', '1.1, 1.2', 'Agregar permission/module labels'],
      ['SolicitudesPagoRRHHView.tsx', '1.3, 1.4', 'Corregir error path + limpiar dead code'],
      ['schema.prisma', '2.1, 2.5', 'Agregar parentTenantId + campos Transfer'],
      ['tenants.service.ts', '2.3, 2.4', 'Metodos getGroupDashboard, getGroupBranches'],
      ['tenants.controller.ts', '2.3, 2.4', 'Endpoints group-dashboard, group-branches'],
      ['inventory.service.ts', '2.5', 'Metodo createInterTenantTransfer'],
      ['inventory.controller.ts', '2.5', 'Endpoint POST /transfers/inter-tenant'],
      ['App.tsx', '2.7', 'Routing para grupo empresarial'],
      ['AuthContext.tsx', '2.8', 'Flag isGroupAdmin'],
      ['Sidebar.tsx', '2.9', 'Menu para grupo empresarial'],
    ]
  );

  drawSection('Archivos Nuevos');
  drawTable(
    ['Archivo', 'Fase', 'Descripcion'],
    [
      ['tenant-scope.guard.ts', '2.2', 'Guard de acceso cruzado para managers'],
      ['GroupManagerDashboard.tsx', '2.6', 'Vista manager del grupo empresarial'],
      ['migracion SQL', '3.1', 'Migracion idempotente DDL'],
    ]
  );

  // ─────────────────────────────────────────────
  // DIAGRAMA DE ARQUITECTURA
  // ─────────────────────────────────────────────
  newPage();
  drawTitle('Diagrama de Arquitectura');
  drawBody('Estructura jerarquica del modelo Grupo Empresarial / Sucursales:');
  y -= 10;

  // Draw architecture diagram
  const boxW = 160;
  const boxH = 35;
  const centerX = ML + CW / 2;

  // NovaHub Platform
  page.drawRectangle({
    x: centerX - boxW / 2, y: y - boxH, width: boxW, height: boxH,
    color: PRIMARY, borderRadius: 4,
  });
  page.drawText('NovaHub Platform', {
    x: centerX - 55, y: y - 22, size: 11, font: boldFont, color: WHITE,
  });
  y -= boxH + 20;

  // Line down
  page.drawLine({
    start: { x: centerX, y: y + 15 },
    end: { x: centerX, y },
    thickness: 1.5, color: ACCENT,
  });

  // Grupo Empresarial
  page.drawRectangle({
    x: centerX - boxW / 2, y: y - boxH, width: boxW, height: boxH,
    color: ACCENT, borderRadius: 4,
  });
  page.drawText('Grupo Empresarial', {
    x: centerX - 55, y: y - 22, size: 11, font: boldFont, color: WHITE,
  });
  page.drawText('(Tenant Padre)', {
    x: centerX - 40, y: y - 32, size: 8, font, color: rgb(0.8, 0.9, 1),
  });
  y -= boxH + 15;

  // Branches line
  const branchY = y;
  const branchCount = 3;
  const branchSpacing = CW / (branchCount + 1);
  const branchStartX = ML + branchSpacing;

  // Horizontal line
  page.drawLine({
    start: { x: branchStartX, y: branchY + 15 },
    end: { x: branchStartX + (branchCount - 1) * branchSpacing, y: branchY + 15 },
    thickness: 1.5, color: ACCENT,
  });

  const sucursalNames = ['Sucursal Managua', 'Sucursal Leon', 'Sucursal Masaya'];
  for (let i = 0; i < branchCount; i++) {
    const bx = branchStartX + i * branchSpacing;
    // Vertical line
    page.drawLine({
      start: { x: bx, y: branchY + 15 },
      end: { x: bx, y: branchY },
      thickness: 1.5, color: ACCENT,
    });

    // Sucursal box
    page.drawRectangle({
      x: bx - 65, y: branchY - boxH, width: 130, height: boxH,
      color: rgb(0.2, 0.6, 0.35), borderRadius: 4,
    });
    page.drawText(sucursalNames[i], {
      x: bx - 45, y: branchY - 22, size: 9, font: boldFont, color: WHITE,
    });
    page.drawText('(Tenant Hijo)', {
      x: bx - 30, y: branchY - 32, size: 7, font, color: rgb(0.8, 1, 0.85),
    });

    // Sub-items
    const subY = branchY - boxH - 18;
    const subItems = ['Bodegas', 'Clientes', 'Facturacion'];
    for (let j = 0; j < subItems.length; j++) {
      page.drawText('• ' + subItems[j], {
        x: bx - 45, y: subY - j * 13, size: 8, font, color: GRAY,
      });
    }
  }

  // Inter-tenant arrows
  const arrowY = branchY - boxH - 70;
  page.drawLine({
    start: { x: branchStartX - 30, y: arrowY },
    end: { x: branchStartX + 2 * branchSpacing + 30, y: arrowY },
    thickness: 1, color: RED_ACCENT,
  });
  page.drawText('Transferencias Inter-Sucursal (bidireccionales)', {
    x: branchStartX - 20, y: arrowY - 15, size: 9, font: italicFont, color: RED_ACCENT,
  });

  // Legend
  const legY = arrowY - 50;
  page.drawRectangle({ x: ML, y: legY - 3, width: 12, height: 12, color: PRIMARY });
  page.drawText('Tenant Padre (Grupo Empresarial)', { x: ML + 20, y: legY - 2, size: 9, font, color: GRAY });
  page.drawRectangle({ x: ML + 220, y: legY - 3, width: 12, height: 12, color: ACCENT });
  page.drawText('Tenant Hijo (Sucursal)', { x: ML + 240, y: legY - 2, size: 9, font, color: GRAY });
  page.drawRectangle({ x: ML + 410, y: legY - 3, width: 12, height: 12, color: rgb(0.2, 0.6, 0.35) });
  page.drawText('Operacion', { x: ML + 430, y: legY - 2, size: 9, font, color: GRAY });

  // ─────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────
  const outPath = path.join(__dirname, '..', 'PLAN_Grupo_Empresarial_Sucursales.pdf');
  const bytes = await pdf.save();
  fs.writeFileSync(outPath, bytes);
  console.log(`PDF generado: ${outPath}`);
  console.log(`Paginas: ${pdf.getPageCount()}`);
}

generatePDF().catch(console.error);
