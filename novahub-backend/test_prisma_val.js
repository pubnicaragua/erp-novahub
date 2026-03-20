const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function toEnum(val) {
  return val ? val.toUpperCase() : undefined;
}

async function run() {
  try {
     const data = {
        name: "test",
        type: "company",
        contactName: "",
        email: "",
        phone: "",
        status: "inactive"
     };
     
     const updateData = {
        ...data,
        ...(data.type && { type: await toEnum(data.type) }),
        ...(data.status && { status: await toEnum(data.status) }),
     };
     
     console.log("SENDING DATA TO PRISMA:", updateData);
     
     const res = await prisma.customer.update({
        where: { id: "00000000-0000-0000-0000-000000000000", clientTenantId: "11111111-1111-1111-1111-111111111111" },
        data: updateData
     });
  } catch (e) {
     console.error(e.message);
  } finally {
     await prisma.$disconnect();
  }
}
run();
