import { PrismaClient, SystemRole, EntityStatus, DocumentStatus, PaymentStatus, Frequency, RecurringStatus, ModuleType, TransferStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const TENANT_ID = 'client-demo-001';

async function main() {
  console.log('🌱 Iniciando seed de datos para Módulo de Compras...');

  // 1. Asegurar cuenta base para gastos
  const expenseAccount = await prisma.account.upsert({
    where: { id: 'acct-purchases-001' },
    update: {},
    create: {
      id: 'acct-purchases-001',
      clientTenantId: TENANT_ID,
      code: '5.1.01',
      name: 'Gastos Operativos',
      type: 'EXPENSE',
    },
  });

  // 2. Generar 50+ Proveedores
  console.log('📦 Generando proveedores...');
  const suppliers: any[] = [];
  const supplierNames = [
    'Suministros Industriales S.A.', 'Soluciones Tecnológicas Alfa', 'Distribuidora Central', 
    'Global Logistics SL', 'Papelería El Norte', 'Servicios de Limpieza Brillo', 
    'Mantenimiento General S.A.', 'Publicidad Creativa', 'Consultores de Negocios', 
    'Transportes Rápidos', 'Energía y Luz S.A.', 'Agua Pura del Valle', 
    'Seguridad Total', 'Catering Eventos Pro', 'Ferretería La Unión',
    'Papeles y Más', 'Equipos Médicos S.A.', 'Textiles Modernos', 'Plásticos del Sur',
    'Químicos Industriales', 'Herramientas Pro', 'Motores y Partes', 'Llantas del Pacífico',
    'Pinturas Continentales', 'Vidrios y Cristales', 'Aceros Estructurales', 'Ceras y Limpieza',
    'Uniformes de Nicaragua', 'Publicidad Exterior', 'Mensajería Global', 'Imprenta Nacional',
    'Muebles para Oficina', 'Aire Acondicionado Soluciones', 'Sistemas de Seguridad',
    'Insumos Cafeteros', 'Frutas y Verduras Fresh', 'Carnes de Calidad', 'Panadería Central',
    'Lácteos del Norte', 'Bebidas del Pacífico', 'Envases Plásticos', 'Cartones y Embalajes',
    'Etiquetas Pro', 'Suministros de Oficina Nicaragua', 'Tecnología Avanzada',
    'Soporte Técnico Especializado', 'Diseño Gráfico Moderno', 'Arquitectura y Construcción',
    'Seguros de Carga', 'Aduana y Logística Express', 'Almacenes Generales', 'Distribuidora de Repuestos'
  ];

  for (let i = 0; i < supplierNames.length; i++) {
    const s = await prisma.supplier.upsert({
      where: { id: `supp-seed-${i}` },
      update: {},
      create: {
        id: `supp-seed-${i}`,
        clientTenantId: TENANT_ID,
        code: `PRV-L-${String(i + 1).padStart(3, '0')}`,
        name: supplierNames[i],
        email: `contacto@${supplierNames[i].toLowerCase().replace(/\s+/g, '')}.com`,
        phone: `+505 8${Math.floor(1000000 + Math.random() * 9000000)}`,
        status: 'ACTIVE' as any,
        balance: Math.random() * 5000,
        address: 'Managua, Nicaragua',
        contactName: `Gestor ${i + 1}`,
      },
    });
    suppliers.push(s as any);
  }
  console.log(`✅ ${suppliers.length} Proveedores creados.`);

  // 3. Generar 100+ Gastos
  console.log('💸 Generando gastos...');
  const expenseCategories = ['RENT', 'UTILITIES', 'MARKETING', 'MAINTENANCE', 'TRAINING', 'SUPPLIES', 'TRAVEL'];
  for (let i = 0; i < 110; i++) {
    const supplier = suppliers[i % suppliers.length];
    await prisma.expense.upsert({
      where: { number: `GAS-S-${String(i + 1).padStart(4, '0')}` },
      update: {},
      create: {
        clientTenantId: TENANT_ID,
        number: `GAS-S-${String(i + 1).padStart(4, '0')}`,
        accountId: expenseAccount.id,
        supplierId: supplier.id,
        amount: 50 + Math.random() * 1500,
        currency: 'USD',
        category: expenseCategories[i % expenseCategories.length],
        description: `Gasto de ${expenseCategories[i % expenseCategories.length].toLowerCase()} #${i + 1}`,
        date: new Date(Date.now() - Math.random() * 90 * 86400000),
        status: 'PAID',
      },
    });
  }
  console.log('✅ 110 Gastos creados.');

  // 4. Generar 50+ Ordenes de Compra
  console.log('📝 Generando órdenes de compra...');
  const orderStatuses = ['DRAFT', 'SENT', 'APPROVED', 'CANCELLED'];
  for (let i = 0; i < 55; i++) {
    const supplier: any = suppliers[i % suppliers.length];
    const total = 500 + Math.random() * 5000;
    await (prisma.purchaseOrder as any).upsert({
      where: { number: `OC-S-${String(i + 1).padStart(4, '0')}` },
      update: {},
      create: {
        clientTenantId: TENANT_ID,
        number: `OC-S-${String(i + 1).padStart(4, '0')}`,
        supplierId: supplier.id,
        date: new Date(Date.now() - Math.random() * 60 * 86400000),
        expectedDelivery: new Date(Date.now() + Math.random() * 15 * 86400000),
        subtotal: total * 0.85,
        taxAmount: total * 0.15,
        total: total,
        currency: 'USD',
        status: orderStatuses[i % orderStatuses.length] as any,
        requestedBy: 'Carlos López',
        items: {
          create: [
            { description: 'Insumos de oficina lote A', quantity: 10, unitPrice: 50, total: 500 },
            { description: 'Servicios de consultoría externa', quantity: 1, unitPrice: total - 500, total: total - 500 }
          ]
        }
      }
    });
  }
  console.log('✅ 55 Órdenes de compra creadas.');

  // 5. Generar 30+ Facturas de Proveedor
  console.log('🧾 Generando facturas de proveedor...');
  const payStatuses: any[] = ['PENDING', 'PAID', 'OVERDUE', 'PARTIAL'];
  for (let i = 0; i < 35; i++) {
    const supplier: any = suppliers[i % suppliers.length];
    const total = 200 + Math.random() * 3000;
    const date = new Date(Date.now() - Math.random() * 45 * 86400000);
    const dueDate = new Date(date.getTime() + 30 * 86400000);
    await (prisma.supplierInvoice as any).upsert({
      where: { number: `FP-S-${String(i + 1).padStart(4, '0')}` },
      update: {},
      create: {
        clientTenantId: TENANT_ID,
        number: `FP-S-${String(i + 1).padStart(4, '0')}`,
        supplierId: supplier.id,
        date: date,
        dueDate: dueDate,
        subtotal: total * 0.85,
        taxAmount: total * 0.15,
        total: total,
        balance: total,
        currency: 'USD',
        status: payStatuses[i % payStatuses.length] as any,
        items: {
          create: [
            { description: 'Factura de suministros mensual', quantity: 1, unitPrice: total, total: total }
          ]
        }
      }
    });
  }
  console.log('✅ 35 Facturas de proveedor creadas.');

  console.log('🏁 Seed de Compras finalizado con éxito.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
