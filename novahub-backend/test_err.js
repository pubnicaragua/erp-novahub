const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function run() {
  try {
     const res = await prisma.customer.update({
        where: { id: "asdf", clientTenantId: "asdf" },
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
     fs.writeFileSync('err.log', e.message);
  } finally {
     await prisma.$disconnect();
  }
}
run();
