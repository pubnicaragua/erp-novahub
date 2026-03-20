// insert-expense-account.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Buscando un ClientTenant en la base de datos...');
  const tenant = await prisma.clientTenant.findFirst({
    where: { isActive: true },
  });

  if (!tenant) {
    console.error('No se encontró ningún ClientTenant activo para asignar la cuenta.');
    return;
  }

  console.log('Creando cuenta contable de tipo EXPENSE (Egreso)...');
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

  console.log('¡Cuenta contable creada con éxito!');
  console.log(account);
}

main()
  .catch((e) => {
    console.error('Error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
