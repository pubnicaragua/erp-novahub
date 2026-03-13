import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import * as bcrypt from 'bcrypt';
import { SystemRole } from '@prisma/client';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async create(partnerId: string, dto: CreateTenantDto) {
    const existing = await this.prisma.clientTenant.findUnique({
      where: { slug: dto.slug },
      include: { users: true }
    });

    if (existing) {
      if (existing.isActive === false) {
        // If it exists but is inactive (archived), we delete it to allow re-creation
        // A "Real Delete" to avoid 409 conflict
        await this.prisma.$transaction([
          this.prisma.user.deleteMany({ where: { clientTenantId: existing.id } }),
          this.prisma.moduleSubscription.deleteMany({ where: { clientTenantId: existing.id } }),
          this.prisma.subscriptionRequest.deleteMany({ where: { clientTenantId: existing.id } }),
          this.prisma.clientTenant.delete({ where: { id: existing.id } }),
        ]);
      } else {
        throw new ConflictException('Ya existe una empresa activa con ese slug');
      }
    }

    const passwordHash = await bcrypt.hash('admin123', 10);

    return this.prisma.clientTenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        plan: dto.plan,
        industry: dto.industry,
        partnerId: partnerId,
        users: {
          create: {
            email: dto.adminEmail,
            name: dto.adminName,
            passwordHash: passwordHash,
            role: SystemRole.ADMIN,
          },
        },
      },
      include: {
        users: true,
      },
    });
  }

  async findAll(partnerId?: string) {
    return this.prisma.clientTenant.findMany({
      where: {
        ...(partnerId ? { partnerId } : {}),
        isActive: true,
      },
      include: {
        _count: {
          select: { users: true, subscriptions: true },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          }
        },
        subscriptions: {
          where: { isActive: true }
        },
        subscriptionRequests: {
          where: { status: 'PENDING' }
        }
      },
    });
  }

  findOne(id: string) {
    return this.prisma.clientTenant.findUnique({
      where: { id },
      include: {
        subscriptions: true,
        subscriptionRequests: true,
        users: true,
      },
    });
  }

  async getPartnerIdByUser(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { clientTenant: { include: { partner: true } } }
    });
    return user?.clientTenant?.partner?.id || null;
  }

  async getFirstPartner() {
    return this.prisma.partner.findFirst({
      where: { isActive: true }
    });
  }

  async update(id: string, data: any) {
    return this.prisma.clientTenant.update({
      where: { id },
      data: {
        name: data.name,
        industry: data.industry,
        plan: data.plan,
        isActive: data.isActive,
      },
    });
  }

  async archive(id: string) {
    return this.prisma.clientTenant.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
