import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function checkUsers() {
  console.log('--- Diagnosticando Usuarios ---');
  const users = await prisma.user.findMany({
    include: { clientTenant: true }
  });
  
  for (const u of users) {
    console.log(`Email: ${u.email}, Role: ${u.role}, Tenant: ${u.clientTenant?.name || 'N/A'}`);
    // Check if password 'demo123' matches
    const isMatch = await bcrypt.compare('demo123', u.passwordHash);
    console.log(`  Password 'demo123' matches: ${isMatch}`);
  }
}

checkUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
