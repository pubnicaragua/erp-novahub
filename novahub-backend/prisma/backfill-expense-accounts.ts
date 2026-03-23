import 'dotenv/config';
import { PrismaClient, AccountType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL o DIRECT_URL es requerido para ejecutar el backfill.');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenants = await prisma.clientTenant.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  let created = 0;

  for (const tenant of tenants) {
    const hasExpenseAccount = await prisma.account.count({
      where: { clientTenantId: tenant.id, type: AccountType.EXPENSE, isActive: true },
    });

    if (hasExpenseAccount > 0) continue;

    await prisma.account.create({
      data: {
        clientTenantId: tenant.id,
        code: '5000',
        name: 'Gastos Operativos',
        type: AccountType.EXPENSE,
        currency: 'NIO',
        isActive: true,
      },
    });

    created += 1;
    console.log(`Created EXPENSE account for tenant: ${tenant.name} (${tenant.id})`);
  }

  console.log(`Backfill completed. Accounts created: ${created}`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
