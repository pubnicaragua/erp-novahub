import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🔍 Verificando tenant del usuario Super Admin...\n');

  // Find Super Admin user
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@novahub.io' },
    include: { clientTenant: true }
  });

  if (!adminUser) {
    console.log('❌ No se encontró el usuario Super Admin');
    process.exit(1);
  }

  console.log('✅ Usuario encontrado:');
  console.log('   Email:', adminUser.email);
  console.log('   Tenant ID:', adminUser.clientTenantId);
  console.log('   Tenant Name:', adminUser.clientTenant?.name);
  console.log('   Tenant Slug:', adminUser.clientTenant?.slug);

  // Delete existing HR data
  console.log('\n🗑️  Eliminando datos HR antiguos...');
  
  await prisma.employeeDocument.deleteMany({});
  await prisma.employeeBenefit.deleteMany({});
  await prisma.benefit.deleteMany({});
  await prisma.employeeTraining.deleteMany({});
  await prisma.training.deleteMany({});
  await prisma.performanceReview.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.payroll.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.position.deleteMany({});
  await prisma.department.deleteMany({});

  console.log('✅ Datos HR eliminados');
  console.log('\n📝 Usa este tenant ID en el seed:', adminUser.clientTenantId);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
