const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
  try {
     const res = await prisma.customer.update({
        where: { id: "some-fake-id", clientTenantId: "fake-tenant" },
        data: {
           name: "test",
           type: "COMPANY",
           contactName: "",
           email: "",
           phone: "",
           status: "INACTIVE"
        }
     });
  } catch (e) {
     fs.writeFileSync('out.txt', e.message);
  } finally {
     await prisma.$disconnect();
  }
}
run();
