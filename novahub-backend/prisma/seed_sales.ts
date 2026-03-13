import { PrismaClient, CustomerType, EntityStatus, DocumentStatus, SalesOrderStatus, PaymentStatus, Frequency, RecurringStatus, ReturnStatus, PaymentMethod } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Cerando datos de prueba...');

  // 1. Buscar un tenant existente (o crear uno si no hay ninguno)
  let tenant = await prisma.clientTenant.findFirst();
  if (!tenant) {
    const partner = await prisma.partner.findFirst();
    if (!partner) {
      console.error('❌ No hay Partner en la base de datos. Crea uno primero.');
      return;
    }
    tenant = await prisma.clientTenant.create({
      data: {
        name: 'Empresa Demo',
        slug: 'demo',
        partnerId: partner.id,
        industry: 'TECHNOLOGY',
      }
    });
  }

  const tid = tenant.id;

  // 2. Crear Clientes
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: 'seed-cli-1' },
      update: {},
      create: {
        id: 'seed-cli-1',
        clientTenantId: tid,
        code: 'CLI-001',
        name: 'Soluciones Tecnológicas S.A.',
        email: 'contacto@soltec.com',
        phone: '+505 8888-1111',
        status: EntityStatus.ACTIVE,
        balance: 1500.50,
      }
    }),
    prisma.customer.upsert({
      where: { id: 'seed-cli-2' },
      update: {},
      create: {
        id: 'seed-cli-2',
        clientTenantId: tid,
        code: 'CLI-002',
        name: 'Distribuidora Global',
        email: 'ventas@global.ni',
        phone: '+505 2222-3333',
        status: EntityStatus.ACTIVE,
        balance: 0,
      }
    })
  ]);

  // 3. Crear Facturas Recurrentes
  await prisma.recurringInvoice.upsert({
    where: { id: 'seed-rec-1' },
    update: {},
    create: {
      id: 'seed-rec-1',
      clientTenantId: tid,
      customerId: customers[0].id,
      frequency: Frequency.MONTHLY,
      startDate: new Date(),
      nextInvoiceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 500,
      taxAmount: 75,
      total: 575,
      status: RecurringStatus.ACTIVE,
    }
  });

  // 4. Crear Devoluciones
  // Necesitamos una factura primero para la devolución
  try {
     const invoice = await prisma.invoice.create({
      data: {
        clientTenantId: tid,
        customerId: customers[0].id,
        number: 'FAC-TEST-001',
        date: new Date(),
        dueDate: new Date(),
        subtotal: 100,
        taxAmount: 15,
        total: 115,
        balance: 115,
        status: PaymentStatus.PENDING,
      }
    });

    await prisma.salesReturn.create({
      data: {
        clientTenantId: tid,
        customerId: customers[0].id,
        invoiceId: invoice.id,
        number: 'DEV-001',
        date: new Date(),
        total: 115,
        reason: 'Producto defectuoso',
        status: ReturnStatus.PENDING,
      }
    });
  } catch (e) {
    console.log('Skipping invoice creation if FAC-TEST-001 already exists');
  }

  console.log('✅ Seeding completado con éxito.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
