import { PrismaClient, AccountType, Frequency, RecurringStatus, ExpenseStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Starting Robust Finance Seed...');

  const tenant = await prisma.clientTenant.findFirst({ where: { slug: 'empresa-demo' } });
  if (!tenant) {
    console.error('❌ Tenant "empresa-demo" not found. Run main seed first.');
    return;
  }
  const tid = tenant.id;

  // 1. Ensure Accounts
  const accounts = [
    { id: 'acc-inc-001', code: 'INC-701', name: 'Ingresos por Ventas', type: AccountType.INCOME },
    { id: 'acc-exp-001', code: 'EXP-801', name: 'Gastos Operativos', type: AccountType.EXPENSE },
    { id: 'acc-bnk-001', code: 'BNK-101', name: 'Caja General', type: AccountType.ASSET }
  ];

  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { id: acc.id },
      update: {},
      create: { ...acc, clientTenantId: tid, balance: 0, currency: 'USD' }
    });
  }

  // 2. Clear existing entries to avoid duplicates during developement
  await prisma.income.deleteMany({ where: { clientTenantId: tid } });
  await prisma.expense.deleteMany({ where: { clientTenantId: tid } });
  await prisma.recurringExpense.deleteMany({ where: { clientTenantId: tid } });

  // 3. Generate 120 Incomes
  console.log('Generating 120 Incomes...');
  const sources = ['Venta Directa', 'Servicios Consultoría', 'Suscripción Mensual', 'Venta Hardware', 'Renovación Licencia'];
  const incomeItems: any[] = [];
  for (let i = 1; i <= 120; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 60)); // Last 60 days
    incomeItems.push({
      id: `inc-demo-${i}`,
      clientTenantId: tid,
      number: `INC-2024-${i.toString().padStart(4, '0')}`,
      accountId: 'acc-inc-001',
      date,
      amount: Math.floor(Math.random() * 5000) + 500,
      currency: 'USD',
      source: sources[Math.floor(Math.random() * sources.length)],
      notes: 'Seed: Registro de ingreso automático'
    });
  }
  await prisma.income.createMany({ data: incomeItems });

  // 4. Generate 90 Expenses
  console.log('Generating 90 Expenses...');
  const categories = ['MARKETING', 'RENT', 'UTILITIES', 'SALARY', 'HARDWARE', 'MAINTENANCE', 'OFFICE'];
  const descriptions = ['Pago de oficina', 'Campañas Ads Google', 'Servicio Internet Fibra', 'Compra de suministros', 'Mantenimiento Climas', 'Seguros operacionales'];
  const expenseItems: any[] = [];
  for (let i = 1; i <= 90; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 60));
    expenseItems.push({
      id: `exp-demo-${i}`,
      clientTenantId: tid,
      number: `EXP-2024-${i.toString().padStart(4, '0')}`,
      accountId: 'acc-exp-001',
      date,
      amount: Math.floor(Math.random() * 2000) + 100,
      currency: 'USD',
      category: categories[Math.floor(Math.random() * categories.length)],
      description: descriptions[Math.floor(Math.random() * descriptions.length)],
      status: ExpenseStatus.PAID
    });
  }
  await prisma.expense.createMany({ data: expenseItems });

  // 5. Generate 25 Recurring Expenses
  console.log('Generating 25 Recurring Expenses...');
  for (let i = 1; i <= 25; i++) {
    await prisma.recurringExpense.create({
      data: {
        id: `rexp-demo-${i}`,
        clientTenantId: tid,
        accountId: 'acc-exp-001',
        frequency: Frequency.MONTHLY,
        startDate: new Date('2024-01-01'),
        amount: Math.floor(Math.random() * 1000) + 200,
        currency: 'USD',
        category: categories[Math.floor(Math.random() * categories.length)],
        description: `Servicio Recurrente ${i}`,
        status: RecurringStatus.ACTIVE
      }
    });
  }

  console.log('✨ Finance Data Pulse: 200+ Records Synchronized!');
}

main().catch(e => {
  console.error('❌ Error seeding finance:', e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
