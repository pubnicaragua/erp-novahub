/**
 * NovaHub ERP — Seed de Suscripciones
 * Activa todos los módulos y submódulos para client-demo-001
 * Ejecutar: npx ts-node prisma/subscriptions-seed.ts
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const CLIENT_TENANT_ID = 'client-demo-001';
const PARTNER_ID = 'partner-demo';

// Todos los módulos del enum ModuleType en Prisma
const ALL_MODULES = [
  'SALES',
  'PURCHASES',
  'INVENTORY',
  'FINANCIAL',
  'HR',
  'HR_EMPLOYEES',
  'HR_PAYROLL',
  'HR_ATTENDANCE',
  'HR_LEAVES',
  'HR_PERFORMANCE',
  'HR_TRAINING',
  'HR_BENEFITS',
  'PROJECTS',
  'CLIENTS',
  'PROVIDERS',
  'ACTIVITIES',
  'DOCUMENTS',
  'REPORTS',
  'CONFIGURATION',
];

async function main() {
  console.log('🌱 Seeding subscriptions for client-demo-001...\n');

  // Verificar qué módulos existen en el enum
  const existingModules: string[] = [];

  for (const module of ALL_MODULES) {
    try {
      await prisma.moduleSubscription.upsert({
        where: {
          clientTenantId_module: {
            clientTenantId: CLIENT_TENANT_ID,
            module: module as any,
          },
        },
        create: {
          clientTenantId: CLIENT_TENANT_ID,
          partnerId: PARTNER_ID,
          module: module as any,
          price: 0,
          isActive: true,
        },
        update: {
          isActive: true,
        },
      });
      existingModules.push(module);
      console.log(`  ✅ ${module}`);
    } catch (err: any) {
      console.log(`  ⚠️  ${module} — skipped (${err?.message?.split('\n')[0]})`);
    }
  }

  console.log(`\n🎉 Suscripciones activas: ${existingModules.length}/${ALL_MODULES.length}`);
  console.log('─────────────────────────────────────────────────');
  console.log('  Tenant: Empresa Demo S.A. (client-demo-001)');
  console.log('  Todos los módulos habilitados para demo users');
  console.log('─────────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    pool.end();
  });
