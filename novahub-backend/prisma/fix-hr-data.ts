import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🗑️  PASO 1: Eliminando TODOS los datos HR antiguos...\n');
  
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

  console.log('✅ Datos HR eliminados\n');
  
  // Get the correct tenant for Super Admin
  const correctTenant = await prisma.clientTenant.findUnique({
    where: { id: 'client-demo-001' }
  });

  if (!correctTenant) {
    console.log('❌ Tenant client-demo-001 no encontrado');
    process.exit(1);
  }

  console.log('✅ Tenant correcto encontrado:', correctTenant.name);
  console.log('\n🎯 Ahora ejecutando seed con el tenant correcto...\n');

  // Now run the seed with correct tenant
  const { exec } = require('child_process');
  exec('npx ts-node prisma/hr-seed-correct.ts', (error: any, stdout: any, stderr: any) => {
    if (error) {
      console.error('Error:', error);
      return;
    }
    console.log(stdout);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
