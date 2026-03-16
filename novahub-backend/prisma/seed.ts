/**
 * NovaHub ERP — Seed Script Completo
 * Crea: NovaHubTenant, Partner, ClientTenant, Roles, Usuarios, y datos de negocio demo
 * Ejecutar: npm run seed
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Iniciando seed de NovaHub ERP...\n');

  // ─── 1. NovaHub Platform Tenant ───────────────────────────────────────────
  const novaHubTenant = await prisma.novaHubTenant.upsert({
    where: { id: 'novahub-main' },
    update: {},
    create: { id: 'novahub-main', name: 'NovaHub Platform', isActive: true },
  });
  console.log('✅ NovaHubTenant:', novaHubTenant.name);

  // ─── 2. Partner ───────────────────────────────────────────────────────────
  const partner = await prisma.partner.upsert({
    where: { email: 'partner@novahub.io' },
    update: {},
    create: {
      id: 'partner-demo',
      novaHubTenantId: novaHubTenant.id,
      name: 'NovaHub Demo Partner',
      email: 'partner@novahub.io',
      commissionRate: 0.1,
      maxClients: 50,
      isActive: true,
    },
  });
  console.log('✅ Partner:', partner.name);

  // ─── 3. ClientTenant ──────────────────────────────────────────────────────
  const clientTenant = await prisma.clientTenant.upsert({
    where: { slug: 'empresa-demo' },
    update: {},
    create: {
      id: 'client-demo-001',
      partnerId: partner.id,
      name: 'Empresa Demo S.A.',
      slug: 'empresa-demo',
      logo: null,
      primaryColor: '#10B981',
      industry: 'OTHER',
      plan: 'ENTERPRISE',
      isActive: true,
    },
  });
  console.log('✅ ClientTenant:', clientTenant.name);

  // ─── 4. Roles ─────────────────────────────────────────────────────────────
  const allPermissions = {
    ventas: { read: true, write: true, delete: true },
    compras: { read: true, write: true, delete: true },
    inventario: { read: true, write: true, delete: true },
    finanzas: { read: true, write: true, delete: true },
    rh: { read: true, write: true, delete: true },
    proyectos: { read: true, write: true, delete: true },
    herramientas: { read: true, write: true, delete: true },
    reportes: { read: true, write: true, delete: true },
    configuracion: { read: true, write: true, delete: true },
    roles: { read: true, write: true, delete: true },
  };

  for (const [id, name, desc, perms] of [
    ['role-admin-demo', 'Administrador', 'Acceso completo', allPermissions],
    ['role-manager-demo', 'Gerente', 'Gestión operativa', { ...allPermissions, configuracion: { read: false, write: false, delete: false }, roles: { read: false, write: false, delete: false } }],
    ['role-employee-demo', 'Empleado', 'Registro básico', { ...allPermissions, finanzas: { read: false, write: false, delete: false }, configuracion: { read: false, write: false, delete: false }, roles: { read: false, write: false, delete: false } }],
    ['role-viewer-demo', 'Observador', 'Solo lectura', Object.fromEntries(Object.keys(allPermissions).map(k => [k, { read: true, write: false, delete: false }]))],
  ] as const) {
    await prisma.role.upsert({
      where: { id },
      update: {},
      create: { id, clientTenantId: clientTenant.id, name, description: desc, permissions: perms },
    });
  }
  console.log('✅ 4 Roles creados');

  // ─── 5. Usuarios demo ─────────────────────────────────────────────────────
  const SALT = 10;
  const users = [
    { id: 'user-admin-001',    email: 'admin@empresa-demo.com',    name: 'Carlos López',   password: 'Admin2025!',    role: 'ADMIN'    },
    { id: 'user-manager-001',  email: 'gerente@empresa-demo.com',  name: 'María García',   password: 'Gerente2025!',  role: 'MANAGER'  },
    { id: 'user-employee-001', email: 'empleado@empresa-demo.com', name: 'Pedro Martínez', password: 'Empleado2025!', role: 'EMPLOYEE' },
    { id: 'user-viewer-001',   email: 'viewer@empresa-demo.com',   name: 'Ana Rodríguez',  password: 'Viewer2025!',   role: 'VIEWER'   },
  ];
  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, SALT);
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash },
      create: { id: u.id, clientTenantId: clientTenant.id, email: u.email, name: u.name, passwordHash, role: u.role as any, isActive: true },
    });
    console.log(`  👤 [${u.role}] ${created.email}  →  ${u.password}`);
  }

  // ─── 6. Categorías de productos ───────────────────────────────────────────
  const catElectronics = await prisma.category.upsert({
    where: { id: 'cat-electronics' },
    update: {},
    create: { id: 'cat-electronics', clientTenantId: clientTenant.id, name: 'Electrónicos', description: 'Computadoras y periféricos' },
  });
  const catAccesorios = await prisma.category.upsert({
    where: { id: 'cat-accesorios' },
    update: {},
    create: { id: 'cat-accesorios', clientTenantId: clientTenant.id, name: 'Accesorios', description: 'Accesorios para equipos' },
  });
  console.log('✅ Categorías:', catElectronics.name, '|', catAccesorios.name);

  // ─── 7. Productos ─────────────────────────────────────────────────────────
  const produktos = [
    { id: 'prod-001', code: 'PRD-001', name: 'Laptop HP ProBook 450', costPrice: 650, salePrice: 899, catId: catElectronics.id },
    { id: 'prod-002', code: 'PRD-002', name: 'Monitor Dell 24"',       costPrice: 180, salePrice: 249, catId: catElectronics.id },
    { id: 'prod-003', code: 'PRD-003', name: 'Teclado Mecánico Logitech', costPrice: 45, salePrice: 89, catId: catAccesorios.id },
    { id: 'prod-004', code: 'PRD-004', name: 'Mouse Inalámbrico MX',   costPrice: 20, salePrice: 38, catId: catAccesorios.id },
    { id: 'prod-005', code: 'PRD-005', name: 'Auriculares USB Pro',    costPrice: 35, salePrice: 65, catId: catAccesorios.id },
  ];
  for (const p of produktos) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id, clientTenantId: clientTenant.id, categoryId: p.catId,
        code: p.code, name: p.name, costPrice: p.costPrice, salePrice: p.salePrice,
        taxRate: 15, type: 'PRODUCT' as any, trackInventory: true, isActive: true,
      },
    });
  }
  console.log(`✅ ${produktos.length} Productos creados`);

  // ─── 8. Clientes ──────────────────────────────────────────────────────────
  const clientes = [
    { id: 'cust-001', code: 'CLI-001', name: 'Distribuidora Dos Pinos', email: 'compras@dospinos.com', type: 'COMPANY' },
    { id: 'cust-002', code: 'CLI-002', name: 'Grupo Pellas', email: 'finanzas@pellas.com', type: 'COMPANY' },
    { id: 'cust-003', code: 'CLI-003', name: 'Cervecería de Nicaragua', email: 'compras@cenic.com', type: 'COMPANY' },
    { id: 'cust-004', code: 'CLI-004', name: 'Juan Morales', email: 'jmorales@gmail.com', type: 'INDIVIDUAL' },
    { id: 'cust-005', code: 'CLI-005', name: 'Claro Nicaragua', email: 'proveedores@claro.com', type: 'COMPANY' },
  ];
  for (const c of clientes) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id, clientTenantId: clientTenant.id, code: c.code,
        name: c.name, email: c.email, type: c.type as any, status: 'ACTIVE' as any, creditLimit: 10000,
      },
    });
  }
  console.log(`✅ ${clientes.length} Clientes creados`);

  // ─── 9. Proveedores ───────────────────────────────────────────────────────
  for (const s of [
    { id: 'supp-001', code: 'PRV-001', name: 'HP Inc. Nicaragua', email: 'ventas@hp.com.ni' },
    { id: 'supp-002', code: 'PRV-002', name: 'Dell Technologies', email: 'ventas@dell.com.ni' },
    { id: 'supp-003', code: 'PRV-003', name: 'Logitech Distribuidora', email: 'orders@logitech.ni' },
  ]) {
    await prisma.supplier.upsert({
      where: { id: s.id },
      update: {},
      create: { id: s.id, clientTenantId: clientTenant.id, code: s.code, name: s.name, email: s.email, status: 'ACTIVE' as any },
    });
  }
  console.log('✅ 3 Proveedores creados');

  // ─── CUENTAS CONTABLES ─────────────────────────────────────────────────────
  const accounts = [
    { id: 'acct-001', code: '1000', name: 'Caja General', type: 'ASSET' },
    { id: 'acct-002', code: '1100', name: 'Banco BAC', type: 'ASSET' },
    { id: 'acct-003', code: '1200', name: 'Cuentas por Cobrar', type: 'ASSET' },
    { id: 'acct-004', code: '2000', name: 'Cuentas por Pagar', type: 'LIABILITY' },
    { id: 'acct-005', code: '3000', name: 'Capital Social', type: 'EQUITY' },
    { id: 'acct-006', code: '4000', name: 'Ingresos por Ventas', type: 'INCOME' },
    { id: 'acct-007', code: '4100', name: 'Ingresos por Servicios', type: 'INCOME' },
    { id: 'acct-008', code: '5000', name: 'Gastos Operativos', type: 'EXPENSE' },
    { id: 'acct-009', code: '5100', name: 'Gastos Administrativos', type: 'EXPENSE' },
    { id: 'acct-010', code: '5200', name: 'Gastos de Nómina', type: 'EXPENSE' },
  ];
  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { id: acc.id },
      update: {},
      create: { id: acc.id, clientTenantId: clientTenant.id, code: acc.code, name: acc.name, type: acc.type as any, balance: 0 },
    });
  }
  console.log(`✅ ${accounts.length} Cuentas contables creadas`);

  // ─── INGRESOS ────────────────────────────────────────────────────────────────
  const ingresos = [
    { id: 'inc-001', number: 'ING-001', source: 'Distribuidora Dos Pinos', amount: 12450, notes: 'Pago factura FAC-001' },
    { id: 'inc-002', number: 'ING-002', source: 'Cervecería de Nicaragua', amount: 15200, notes: 'Pago factura FAC-003' },
    { id: 'inc-003', number: 'ING-003', source: 'Venta mostrador', amount: 3500, notes: 'Ventas del día 15/03' },
    { id: 'inc-004', number: 'ING-004', source: 'Consultoría IT', amount: 2800, notes: 'Servicio de soporte técnico' },
    { id: 'inc-005', number: 'ING-005', source: 'Grupo Pellas', amount: 8750, notes: 'Abono a factura FAC-002' },
    { id: 'inc-006', number: 'ING-006', source: 'Venta online', amount: 1890, notes: 'Pedido #1234' },
    { id: 'inc-007', number: 'ING-007', source: 'Claro Nicaragua', amount: 4500, notes: 'Equipos de red' },
  ];
  for (const inc of ingresos) {
    await prisma.income.upsert({
      where: { id: inc.id },
      update: {},
      create: { 
        id: inc.id, clientTenantId: clientTenant.id, number: inc.number, 
        accountId: 'acct-006', source: inc.source, amount: inc.amount, 
        notes: inc.notes, date: new Date(), currency: 'USD' 
      },
    });
  }
  console.log(`✅ ${ingresos.length} Ingresos creados`);

  // Reference for expenses
  const account = { id: 'acct-008' };

  // ─── 10. Facturas de venta ────────────────────────────────────────────────
  const facturas = [
    { id: 'inv-001', number: 'FAC-001', custId: 'cust-001', sub: 10584, tax: 1866, total: 12450, status: 'PAID' },
    { id: 'inv-002', number: 'FAC-002', custId: 'cust-002', sub:  7458, tax: 1292, total:  8750, status: 'PENDING' },
    { id: 'inv-003', number: 'FAC-003', custId: 'cust-003', sub: 12992, tax: 2208, total: 15200, status: 'PAID' },
    { id: 'inv-004', number: 'FAC-004', custId: 'cust-005', sub:  8376, tax: 1424, total:  9800, status: 'OVERDUE' },
    { id: 'inv-005', number: 'FAC-005', custId: 'cust-004', sub:  3846, tax:  654, total:  4500, status: 'PENDING' },
  ];
  for (const inv of facturas) {
    await prisma.invoice.upsert({
      where: { id: inv.id },
      update: {},
      create: {
        id: inv.id, clientTenantId: clientTenant.id, number: inv.number,
        customerId: inv.custId, date: new Date(), dueDate: new Date(Date.now() + 30 * 86400000),
        subtotal: inv.sub, taxAmount: inv.tax, discountAmount: 0, total: inv.total,
        amountPaid: inv.status === 'PAID' ? inv.total : 0,
        balance: inv.status === 'PAID' ? 0 : inv.total,
        currency: 'USD', status: inv.status as any,
      },
    });
  }
  console.log(`✅ ${facturas.length} Facturas de venta creadas`);

  // ─── 11. Gastos ───────────────────────────────────────────────────────────
  const gastos = [
    { id: 'exp-001', number: 'GAS-001', desc: 'Alquiler de oficina Marzo 2026', amount: 1200, cat: 'RENT' },
    { id: 'exp-002', number: 'GAS-002', desc: 'Servicios de internet y teléfono', amount: 180, cat: 'UTILITIES' },
    { id: 'exp-003', number: 'GAS-003', desc: 'Publicidad en redes sociales', amount: 350, cat: 'MARKETING' },
    { id: 'exp-004', number: 'GAS-004', desc: 'Mantenimiento de equipos', amount: 220, cat: 'MAINTENANCE' },
    { id: 'exp-005', number: 'GAS-005', desc: 'Capacitación del personal', amount: 500, cat: 'TRAINING' },
  ];
  for (const g of gastos) {
    await prisma.expense.upsert({
      where: { id: g.id },
      update: {},
      create: { id: g.id, clientTenantId: clientTenant.id, number: g.number, accountId: account.id, description: g.desc, amount: g.amount, category: g.cat, date: new Date(), currency: 'USD', status: 'PAID' as any },
    });
  }
  console.log(`✅ ${gastos.length} Gastos creados`);

  // ─── GASTOS RECURRENTES ──────────────────────────────────────────────────────
  const gastosRecurrentes = [
    { id: 'rexp-001', desc: 'Alquiler de oficina', amount: 1200, freq: 'MONTHLY', cat: 'RENT' },
    { id: 'rexp-002', desc: 'Internet Claro 100Mbps', amount: 85, freq: 'MONTHLY', cat: 'UTILITIES' },
    { id: 'rexp-003', desc: 'Servicio de limpieza', amount: 150, freq: 'WEEKLY', cat: 'SERVICES' },
    { id: 'rexp-004', desc: 'Licencia Microsoft 365', amount: 299, freq: 'YEARLY', cat: 'SOFTWARE' },
    { id: 'rexp-005', desc: 'Seguro de equipos', amount: 450, freq: 'QUARTERLY', cat: 'INSURANCE' },
    { id: 'rexp-006', desc: 'Mantenimiento AC', amount: 80, freq: 'MONTHLY', cat: 'MAINTENANCE' },
  ];
  for (const gr of gastosRecurrentes) {
    await prisma.recurringExpense.upsert({
      where: { id: gr.id },
      update: {},
      create: { 
        id: gr.id, clientTenantId: clientTenant.id, accountId: 'acct-008',
        description: gr.desc, amount: gr.amount, frequency: gr.freq as any, 
        category: gr.cat, startDate: new Date(), status: 'ACTIVE' as any, currency: 'USD'
      },
    });
  }
  console.log(`✅ ${gastosRecurrentes.length} Gastos recurrentes creados`);

  // ─── 12. Empleados ────────────────────────────────────────────────────────
  // Skipping employee seed - use hr-seed.ts for HR module data
  console.log(`✅ Skipping employees (use hr-seed.ts for HR module)`);

  // ─── 13. Tickets de soporte ───────────────────────────────────────────────
  for (const t of [
    { id: 'tkt-001', number: 'TKT-001', subject: 'Falla en impresora de facturación', description: 'No imprime desde ayer.', status: 'OPEN', priority: 'HIGH' },
    { id: 'tkt-002', number: 'TKT-002', subject: 'Solicitud nuevo usuario', description: 'Crear usuario para nuevo vendedor.', status: 'IN_PROGRESS', priority: 'MEDIUM' },
    { id: 'tkt-003', number: 'TKT-003', subject: 'Actualizar contraseña bloqueada', description: 'Usuario no puede ingresar al sistema.', status: 'CLOSED', priority: 'LOW' },
  ]) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: { id: t.id, clientTenantId: clientTenant.id, number: t.number, subject: t.subject, description: t.description, status: t.status as any, priority: t.priority as any },
    });
  }
  console.log('✅ 3 Tickets de soporte creados');

  console.log('\n🎉 ¡Seed completo con datos de negocio demo!');
  console.log('─────────────────────────────────────────────────');
  console.log('  ClientTenant ID :', clientTenant.id);
  console.log('  Slug (para URL) : empresa-demo');
  console.log('  Clientes        :', clientes.length);
  console.log('  Productos       :', produktos.length);
  console.log('  Facturas        :', facturas.length);
  console.log('  Empleados       : (use hr-seed.ts)');
  console.log('─────────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
