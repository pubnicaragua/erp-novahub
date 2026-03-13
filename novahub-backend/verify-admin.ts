import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function verify() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({
    where: { email: 'superadmin@novahub.com' }
  });

  if (!user) {
    console.log('User not found!');
  } else {
    console.log('User found:', user.email);
    console.log('Role:', user.role);
    console.log('TenantID:', user.clientTenantId);
    const match = await bcrypt.compare('admin123', user.passwordHash);
    console.log('Password "admin123" match:', match);
  }
  await prisma.$disconnect();
}

verify();
