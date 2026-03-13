import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // Check Super Admin user
  const adminUser = await prisma.user.findFirst({
    where: { 
      OR: [
        { email: 'admin@novahub.io' },
        { email: { contains: 'admin' } }
      ]
    },
    include: { clientTenant: true }
  });

  console.log('\n🔍 Usuario Super Admin:');
  console.log('Email:', adminUser?.email);
  console.log('Tenant ID:', adminUser?.clientTenantId);
  console.log('Tenant Name:', adminUser?.clientTenant?.name);
  console.log('Tenant Slug:', adminUser?.clientTenant?.slug);

  // Check where HR data was created
  const empCount = await prisma.employee.count();
  const firstEmp = await prisma.employee.findFirst({
    include: { clientTenant: true }
  });

  console.log('\n📊 Datos de RH:');
  console.log('Total empleados en BD:', empCount);
  console.log('Primer empleado - Tenant ID:', firstEmp?.clientTenantId);
  console.log('Primer empleado - Tenant Name:', firstEmp?.clientTenant?.name);
  console.log('Primer empleado - Tenant Slug:', firstEmp?.clientTenant?.slug);

  console.log('\n❌ PROBLEMA IDENTIFICADO:');
  if (adminUser?.clientTenantId !== firstEmp?.clientTenantId) {
    console.log('⚠️  El usuario está en un tenant diferente al de los datos!');
    console.log('   Usuario tenant:', adminUser?.clientTenantId);
    console.log('   Datos tenant:', firstEmp?.clientTenantId);
    console.log('\n✅ SOLUCIÓN: Re-ejecutar seed con tenant correcto:', adminUser?.clientTenantId);
  } else {
    console.log('✅ Los datos están en el tenant correcto');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
