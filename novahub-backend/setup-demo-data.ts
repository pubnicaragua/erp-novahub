import { PrismaClient, SystemRole, BillingPlanType, IndustryType, ModuleType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Iniciando siembra de datos de demostración...');

  const passwordHash = await bcrypt.hash('admin123', 10);
  console.log('Hash generado para "admin123":', passwordHash);

  // 1. NovaHub Admin Tenant & User (Super Admin Context)
  const adminTenantId = 'nova-hub-admin-id'; // Must match AuthContext logic
  const adminUserId = 'admin-001';

  console.log('--- Creando NovaHub Admin Context ---');
  const masterTenant = await prisma.novaHubTenant.upsert({
    where: { id: 'nh-master-id' },
    update: {},
    create: {
      id: 'nh-master-id',
      name: 'NovaHub Headquarters',
    }
  });

  // Use slug to avoid unique constraint issues
  const adminTenant = await prisma.clientTenant.upsert({
    where: { slug: 'novahub-admin' },
    update: { id: adminTenantId },
    create: {
      id: adminTenantId,
      name: 'NovaHub System Admin',
      slug: 'novahub-admin',
      partnerId: (await getOrCreateDefaultPartner()).id,
      plan: BillingPlanType.ENTERPRISE,
    }
  });

  await prisma.user.upsert({
    where: { id: adminUserId },
    update: {
      email: 'superadmin@novahub.com',
      passwordHash: passwordHash,
      role: SystemRole.ADMIN,
      clientTenantId: adminTenant.id,
    },
    create: {
      id: adminUserId,
      email: 'superadmin@novahub.com',
      passwordHash: passwordHash,
      name: 'Super Admin',
      role: SystemRole.ADMIN,
      clientTenantId: adminTenant.id,
    }
  });

  // 2. Partner Demo
  const partnerId = 'partner-demo';
  const partnerUserId = 'partner-demo-001';
  
  console.log('--- Creando Partner Demo ---');
  const partner = await prisma.partner.upsert({
    where: { id: partnerId },
    update: { email: 'partner@demo.com' },
    create: {
      id: partnerId,
      name: 'Socio Estratégico Demo',
      email: 'partner@demo.com',
      novaHubTenantId: masterTenant.id,
    }
  });

  const partnerTenant = await prisma.clientTenant.upsert({
    where: { slug: 'partner-demo' },
    update: { partnerId: partner.id },
    create: {
      id: 'partner-tenant-id',
      name: 'Partner Workspace',
      slug: 'partner-demo',
      partnerId: partner.id,
      plan: BillingPlanType.PROFESSIONAL,
    }
  });

  await prisma.user.upsert({
    where: { id: partnerUserId },
    update: {
      email: 'partner@demo.com',
      passwordHash: passwordHash,
      role: SystemRole.PARTNER,
      clientTenantId: partnerTenant.id,
    },
    create: {
      id: partnerUserId,
      email: 'partner@demo.com',
      passwordHash: passwordHash,
      name: 'Luis Solis',
      role: SystemRole.PARTNER,
      clientTenantId: partnerTenant.id,
    }
  });

  // 3. Clientes Demo Variados
  console.log('--- Creando Clientes Demo Variados ---');
  
  const demos = [
    { 
      id: 'tenant-arch-001', 
      name: 'Arcadia Estudio Arquitectura', 
      slug: 'arcadia-estudio', 
      industry: IndustryType.ARCHITECTURE,
      plan: BillingPlanType.ENTERPRISE,
      modules: [ModuleType.PROJECTS, ModuleType.SALES, ModuleType.FINANCIAL]
    },
    { 
      id: 'tenant-retail-001', 
      name: 'Celulares & Más Rivas', 
      slug: 'celulares-rivas', 
      industry: IndustryType.RETAIL,
      plan: BillingPlanType.PROFESSIONAL,
      modules: [ModuleType.INVENTORY, ModuleType.SALES, ModuleType.FINANCIAL, ModuleType.PURCHASES]
    }
  ];

  for (const info of demos) {
    const tenant = await prisma.clientTenant.upsert({
      where: { slug: info.slug },
      update: { industry: info.industry, plan: info.plan },
      create: {
        id: info.id,
        name: info.name,
        slug: info.slug,
        partnerId: partner.id,
        plan: info.plan,
        industry: info.industry,
      }
    });

    for (const mod of info.modules) {
      await prisma.moduleSubscription.upsert({
        where: { clientTenantId_module: { clientTenantId: tenant.id, module: mod } },
        update: { isActive: true },
        create: {
          clientTenantId: tenant.id,
          module: mod,
          isActive: true,
          partnerId: partner.id,
          price: 49.99
        }
      });
    }
  }

  // 4. Cliente Demo Estándar (Match original request)
  const clientTenantId = 'client-demo-001';
  const clientUserId = 'client-demo-001';
  const clientTenant = await prisma.clientTenant.upsert({
    where: { slug: 'empresa-demo' },
    update: { id: clientTenantId },
    create: {
      id: clientTenantId,
      name: 'Empresa Demo S.A.',
      slug: 'empresa-demo',
      partnerId: partner.id,
      plan: BillingPlanType.PROFESSIONAL,
      industry: IndustryType.SERVICES,
    }
  });

  await prisma.user.upsert({
    where: { id: clientUserId },
    update: {
      email: 'cliente@demo.com',
      passwordHash: passwordHash,
      role: SystemRole.MANAGER,
    },
    create: {
      id: clientUserId,
      email: 'cliente@demo.com',
      passwordHash: passwordHash,
      name: 'Gerente Demo',
      role: SystemRole.MANAGER,
      clientTenantId: clientTenant.id,
    }
  });

  // Habilitar módulos para el Partner y Cliente estándar
  const standardModules = [ModuleType.SALES, ModuleType.INVENTORY, ModuleType.FINANCIAL];
  for (const module of standardModules) {
    await prisma.moduleSubscription.upsert({
      where: { clientTenantId_module: { clientTenantId, module } },
      update: { isActive: true },
      create: {
        clientTenantId,
        module,
        isActive: true,
        partnerId: partner.id,
        price: 25.00
      }
    });
  }

  console.log('✅ Siembra completada con éxito.');
}

async function getOrCreateDefaultPartner() {
  const masterPartnerId = 'master-partner-id';
  return await prisma.partner.upsert({
    where: { id: masterPartnerId },
    update: {},
    create: {
      id: masterPartnerId,
      name: 'Internal NovaHub Partner',
      email: 'internal@novahub.com',
      novaHubTenantId: 'nh-master-id',
    }
  });
}

main()
  .catch((e) => {
    console.error('❌ Error durante la siembra:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
