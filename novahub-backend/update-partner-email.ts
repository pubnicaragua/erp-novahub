import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🔄 Actualizando email del partner...');

  // Update partner email
  const updatedPartner = await prisma.partner.updateMany({
    where: { email: 'partner@demo.com' },
    data: { email: 'luissolis@soliscomercialni.com' }
  });

  console.log(`✅ ${updatedPartner.count} partner(s) actualizados`);

  // Update user email
  const updatedUser = await prisma.user.updateMany({
    where: { email: 'partner@demo.com' },
    data: { 
      email: 'luissolis@soliscomercialni.com',
      name: 'Luis Solis'
    }
  });

  console.log(`✅ ${updatedUser.count} usuario(s) actualizados`);
  console.log('✅ Email del partner actualizado exitosamente');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
