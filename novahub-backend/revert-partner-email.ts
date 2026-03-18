import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🔄 Revirtiendo email del partner a partner@demo.com...');

  // Revert partner email
  const updatedPartner = await prisma.partner.updateMany({
    where: { email: 'luissolis@soliscomercialni.com' },
    data: { email: 'partner@demo.com' }
  });

  console.log(`✅ ${updatedPartner.count} partner(s) revertidos`);

  // Revert user email but keep display name
  const updatedUser = await prisma.user.updateMany({
    where: { email: 'luissolis@soliscomercialni.com' },
    data: { 
      email: 'partner@demo.com'
      // name stays as 'Luis Solis' for display
    }
  });

  console.log(`✅ ${updatedUser.count} usuario(s) revertidos`);
  console.log('✅ Email del partner revertido a partner@demo.com para login demo');
  console.log('ℹ️  El nombre de display permanece como "Luis Solis"');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
