import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import * as bcrypt from 'bcrypt';
import { SystemRole, BillingPlanType, IndustryType, AccountType, Prisma } from '@prisma/client';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  private async bootstrapDefaultAccounts(prisma: Prisma.TransactionClient, clientTenantId: string) {
    const existingAccounts = await prisma.account.count({ where: { clientTenantId } });
    if (existingAccounts > 0) return;

    await prisma.account.createMany({
      data: [
        {
          clientTenantId,
          code: '1000',
          name: 'Caja y Bancos',
          type: AccountType.ASSET,
          currency: 'NIO',
        },
        {
          clientTenantId,
          code: '1100',
          name: 'Cuentas por Cobrar',
          type: AccountType.ASSET,
          currency: 'NIO',
        },
        {
          clientTenantId,
          code: '2000',
          name: 'Cuentas por Pagar',
          type: AccountType.LIABILITY,
          currency: 'NIO',
        },
        {
          clientTenantId,
          code: '4000',
          name: 'Ingresos Operativos',
          type: AccountType.INCOME,
          currency: 'NIO',
        },
        {
          clientTenantId,
          code: '5000',
          name: 'Gastos Operativos',
          type: AccountType.EXPENSE,
          currency: 'NIO',
        },
      ],
    });
  }

  private toBillingPlanType(plan?: string): BillingPlanType {
    if (!plan) return BillingPlanType.BASIC;
    const upperPlan = plan.toUpperCase();
    if (Object.values(BillingPlanType).includes(upperPlan as BillingPlanType)) {
      return upperPlan as BillingPlanType;
    }
    return BillingPlanType.BASIC;
  }

  private toIndustryType(industry?: string): IndustryType {
    if (!industry) return IndustryType.OTHER;
    const upperIndustry = industry.toUpperCase();
    if (Object.values(IndustryType).includes(upperIndustry as IndustryType)) {
      return upperIndustry as IndustryType;
    }
    return IndustryType.OTHER;
  }

  private toSystemRole(role?: string): SystemRole {
    if (!role) return SystemRole.EMPLOYEE;

    const normalized = role
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');

    if (Object.values(SystemRole).includes(normalized as SystemRole)) {
      return normalized as SystemRole;
    }

    const aliases: Record<string, SystemRole> = {
      USER: SystemRole.EMPLOYEE,
      USUARIO: SystemRole.EMPLOYEE,
      EMPLEADO: SystemRole.EMPLOYEE,
      VENDEDOR: SystemRole.EMPLOYEE,
      ALMACENERO: SystemRole.EMPLOYEE,
      COMPRADOR: SystemRole.EMPLOYEE,
      CONTADOR: SystemRole.MANAGER,
      GERENTE: SystemRole.MANAGER,
      RH_MANAGER: SystemRole.MANAGER,
      RHMANAGER: SystemRole.MANAGER,
      SUPER_ADMIN: SystemRole.ADMIN,
      SUPERADMIN: SystemRole.ADMIN,
      VISOR: SystemRole.VIEWER,
    };

    return aliases[normalized] ?? SystemRole.EMPLOYEE;
  }

  private throwFriendlyPrismaError(error: any): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('El correo electrónico ya está en uso. Intenta con otro.');
      }
      if (error.code === 'P2003') {
        throw new BadRequestException('No se puede completar la operación por una relación de datos inválida.');
      }
    }

    throw error;
  }

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

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.clientTenant.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            plan: this.toBillingPlanType(dto.plan),
            industry: this.toIndustryType(dto.industry),
            logo: dto.logo,
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

        await this.bootstrapDefaultAccounts(tx, tenant.id);
        return tenant;
      });
    } catch (error: any) {
      this.throwFriendlyPrismaError(error);
    }
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
        industry: data.industry ? this.toIndustryType(data.industry) : undefined,
        plan: data.plan ? this.toBillingPlanType(data.plan) : undefined,
        logo: data.logo,
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

  async addUser(data: { clientTenantId: string; name: string; email: string; password: string; role: string; avatar?: string | null }) {
    const passwordHash = await bcrypt.hash(data.password, 10);

    try {
      return await this.prisma.user.create({
        data: {
          clientTenantId: data.clientTenantId,
          name: data.name,
          email: data.email,
          passwordHash: passwordHash,
          role: this.toSystemRole(data.role),
          avatar: data.avatar,
        },
      });
    } catch (error: any) {
      this.throwFriendlyPrismaError(error);
    }
  }

  async delete(id: string) {
    // Delete in transaction to avoid FK constraint issues
    await this.prisma.$transaction([
      this.prisma.user.deleteMany({ where: { clientTenantId: id } }),
      this.prisma.moduleSubscription.deleteMany({ where: { clientTenantId: id } }),
      this.prisma.subscriptionRequest.deleteMany({ where: { clientTenantId: id } }),
      this.prisma.clientTenant.delete({ where: { id } }),
    ]);
  }
}
