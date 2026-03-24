import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionRequestDto } from './dto/create-subscription-request.dto';
import { UpdateSubscriptionStatusDto } from './dto/update-subscription-status.dto';
import { ToggleModuleSubscriptionDto } from './dto/toggle-module-subscription.dto';
import { ApprovalStatus, ModuleType } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  async createRequest(partnerId: string, dto: CreateSubscriptionRequestDto) {
    return this.prisma.subscriptionRequest.create({
      data: {
        partnerId,
        clientTenantId: dto.clientTenantId,
        requestedModule: dto.requestedModule as ModuleType,
        customPrice: dto.customPrice,
        notes: dto.notes,
        status: ApprovalStatus.PENDING,
      },
    });
  }

  async findAllRequests() {
    return this.prisma.subscriptionRequest.findMany({
      include: {
        partner: true,
        clientTenant: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPartnerRequests(partnerId: string) {
    return this.prisma.subscriptionRequest.findMany({
      where: { partnerId },
      include: { clientTenant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRequestStatus(id: string, dto: UpdateSubscriptionStatusDto) {
    const request = await this.prisma.subscriptionRequest.findUnique({
      where: { id },
    });

    if (!request) throw new NotFoundException('Solicitud no encontrada');

    const updatedRequest = await this.prisma.subscriptionRequest.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes,
      },
    });

    if (dto.status === ApprovalStatus.APPROVED) {
      // Create or Update ModuleSubscription
      await this.prisma.moduleSubscription.upsert({
        where: {
          clientTenantId_module: {
            clientTenantId: request.clientTenantId,
            module: request.requestedModule,
          },
        },
        create: {
          clientTenantId: request.clientTenantId,
          partnerId: request.partnerId,
          module: request.requestedModule,
          price: request.customPrice || 0,
          isActive: true,
        },
        update: {
          price: request.customPrice || 0,
          isActive: true,
        },
      });
    }

    return updatedRequest;
  }

  async getEnabledModules(clientTenantId: string) {
    const subs = await this.prisma.moduleSubscription.findMany({
      where: { clientTenantId, isActive: true },
    });
    return subs.map(s => s.module);
  }

  async toggleModuleStatus(partnerId: string | null, dto: ToggleModuleSubscriptionDto) {
    const tenant = await this.prisma.clientTenant.findUnique({
      where: { id: dto.clientTenantId },
      select: { id: true, partnerId: true },
    });

    if (!tenant) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const resolvedPartnerId = partnerId || tenant.partnerId;
    if (!resolvedPartnerId) {
      throw new BadRequestException('No se pudo determinar el partner responsable');
    }

    const existing = await this.prisma.moduleSubscription.findUnique({
      where: {
        clientTenantId_module: {
          clientTenantId: dto.clientTenantId,
          module: dto.module as ModuleType,
        },
      },
    });

    if (!existing && dto.isActive === false) {
      throw new NotFoundException('No existe una suscripción activa para desactivar');
    }

    return this.prisma.moduleSubscription.upsert({
      where: {
        clientTenantId_module: {
          clientTenantId: dto.clientTenantId,
          module: dto.module as ModuleType,
        },
      },
      create: {
        clientTenantId: dto.clientTenantId,
        partnerId: resolvedPartnerId,
        module: dto.module as ModuleType,
        isActive: dto.isActive,
        price: 0,
        notes: dto.notes,
      },
      update: {
        isActive: dto.isActive,
        notes: dto.notes,
      },
    });
  }
}
