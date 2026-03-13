import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function validateDemoUsers() {
  console.log('🔍 VALIDANDO USUARIOS DEMO Y MÓDULOS HABILITADOS\n');
  console.log('═════════════════════════════════════════════════\n');

  // 1. Buscar todos los usuarios demo
  const users = await prisma.user.findMany({
    where: {
      email: {
        contains: 'demo'
      }
    },
    include: {
      clientTenant: {
        include: {
          subscriptions: {
            where: { isActive: true }
          }
        }
      }
    },
    orderBy: { email: 'asc' }
  });

  console.log(`📊 Total usuarios encontrados: ${users.length}\n`);

  for (const user of users) {
    console.log(`┌─ 👤 ${user.name}`);
    console.log(`│  📧 Email: ${user.email}`);
    console.log(`│  🎭 Rol: ${user.role}`);
    console.log(`│  🏢 Tenant: ${user.clientTenant?.name || 'N/A'}`);
    console.log(`│  🔑 Tenant ID: ${user.clientTenantId}`);
    console.log(`│  ✅ Activo: ${user.isActive ? 'Sí' : 'No'}`);
    console.log(`│`);
    
    if (user.clientTenant?.subscriptions && user.clientTenant.subscriptions.length > 0) {
      console.log(`│  📦 MÓDULOS HABILITADOS (${user.clientTenant.subscriptions.length}):`);
      user.clientTenant.subscriptions.forEach(sub => {
        console.log(`│     ✓ ${sub.module} ${Number(sub.price) > 0 ? `($${sub.price})` : '(gratis)'}`);
      });
    } else {
      console.log(`│  ⚠️  SIN MÓDULOS HABILITADOS`);
    }
    console.log(`└─────────────────────────────────────────────\n`);
  }

  // 2. Verificar específicamente cliente@demo.com
  const clienteDemo = await prisma.user.findUnique({
    where: { email: 'cliente@demo.com' },
    include: {
      clientTenant: {
        include: {
          subscriptions: { where: { isActive: true } }
        }
      }
    }
  });

  if (clienteDemo) {
    console.log('✅ USUARIO cliente@demo.com ENCONTRADO');
    console.log(`   Nombre: ${clienteDemo.name}`);
    console.log(`   Rol: ${clienteDemo.role}`);
    console.log(`   Módulos: ${clienteDemo.clientTenant?.subscriptions.map(s => s.module).join(', ') || 'NINGUNO'}\n`);
  } else {
    console.log('❌ USUARIO cliente@demo.com NO EXISTE EN LA BD\n');
    console.log('💡 SOLUCIÓN: Usar gerente@empresa-demo.com en su lugar\n');
  }

  // 3. Verificar gerente@empresa-demo.com
  const gerenteDemo = await prisma.user.findUnique({
    where: { email: 'gerente@empresa-demo.com' },
    include: {
      clientTenant: {
        include: {
          subscriptions: { where: { isActive: true } }
        }
      }
    }
  });

  if (gerenteDemo) {
    console.log('✅ USUARIO gerente@empresa-demo.com ENCONTRADO');
    console.log(`   Nombre: ${gerenteDemo.name}`);
    console.log(`   Rol: ${gerenteDemo.role}`);
    console.log(`   Módulos: ${gerenteDemo.clientTenant?.subscriptions.map(s => s.module).join(', ') || 'NINGUNO'}\n`);
  }

  await prisma.$disconnect();
}

validateDemoUsers().catch(console.error);
