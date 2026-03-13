import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async create(data: any, clientTenantId: string) {
    return this.prisma.role.create({
      data: {
        ...data,
        clientTenantId,
      },
    });
  }

  async findAll(clientTenantId: string) {
    return this.prisma.role.findMany({
      where: { clientTenantId },
    });
  }

  async findOne(id: string, clientTenantId: string) {
    return this.prisma.role.findFirst({
      where: { id, clientTenantId },
    });
  }

  async update(id: string, clientTenantId: string, data: any) {
    return this.prisma.role.updateMany({
      where: { id, clientTenantId },
      data,
    });
  }

  async remove(id: string, clientTenantId: string) {
    return this.prisma.role.deleteMany({
      where: { id, clientTenantId },
    });
  }
}
