const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenant = await prisma.clientTenant.findFirst({
    where: { isActive: true },
  });

  if (!tenant) {
    fs.writeFileSync('err.txt', 'No se encontró ningún ClientTenant activo para asignar la cuenta.');
    return;
  }

  // Comprobar si ya existe
  const existing = await prisma.account.findFirst({
    where: { clientTenantId: tenant.id, code: '500-01' }
  });

  if (existing) {
    fs.writeFileSync('success.txt', 'La cuenta ya existe: ' + JSON.stringify(existing, null, 2));
    return;
  }

  const account = await prisma.account.create({
    data: {
      code: '500-01',
      name: 'Gastos Operativos',
      type: 'EXPENSE',
      clientTenantId: tenant.id,
      balance: 0,
      currency: 'NIO',
      isActive: true,
    },
  });
  
  fs.writeFileSync('success.txt', JSON.stringify(account, null, 2));
}

main()
  .catch((e) => {
    fs.writeFileSync('err.txt', String(e.stack || e));
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
