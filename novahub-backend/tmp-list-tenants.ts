import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.clientTenant.findMany({
    take: 10,
    select: {
      id: true,
      name: true,
      slug: true,
      users: {
        select: {
          email: true,
          role: true
        }
      }
    }
  });
  console.log(JSON.stringify(tenants, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
