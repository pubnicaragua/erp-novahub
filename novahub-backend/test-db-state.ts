import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany();
  console.log('--- ACCOUNTS ---');
  console.log(JSON.stringify(accounts, null, 2));

  const incomes = await prisma.income.findMany({
    include: { account: true }
  });
  console.log('\n--- INCOMES ---');
  console.log(JSON.stringify(incomes, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
