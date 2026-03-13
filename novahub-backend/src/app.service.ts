import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) { }

  async getHello() {
    // Intentamos una consulta simple a la DB
    // Nota: Si aún no tienes datos, esto devolverá un array vacío []
    const checkDb = await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'Nova Hub Online', database: 'Connected' };
  }
}