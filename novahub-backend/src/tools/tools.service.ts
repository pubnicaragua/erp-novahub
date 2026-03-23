import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRateService } from '../common/exchange-rate.service';
import { TicketStatus, Priority, ActivityType, TaskStatus } from '@prisma/client';

function genCode(prefix: string): string {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

function toEnum<T extends string>(val: string): T {
  return val.toUpperCase() as T;
}

@Injectable()
export class ToolsService {
  constructor(
    private prisma: PrismaService,
    private exchangeRateService: ExchangeRateService
  ) {}

  private readonly FINANCE_SETTINGS_GROUP = 'FINANCY';

  private async getTenantSetting(clientTenantId: string, key: string): Promise<string | null> {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { clientTenantId, group: this.FINANCE_SETTINGS_GROUP, key },
    });
    return setting?.value ?? null;
  }

  private async upsertTenantSetting(clientTenantId: string, key: string, value: string): Promise<void> {
    const existing = await this.prisma.systemSetting.findFirst({
      where: { clientTenantId, group: this.FINANCE_SETTINGS_GROUP, key },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.systemSetting.update({
        where: { id: existing.id },
        data: { value },
      });
      return;
    }

    await this.prisma.systemSetting.create({
      data: {
        clientTenantId,
        group: this.FINANCE_SETTINGS_GROUP,
        key,
        value,
      },
    });
  }

  async getExchangeRate(clientTenantId: string) {
    const tenant: any = await this.prisma.clientTenant.findUnique({
      where: { id: clientTenantId },
      include: { partner: true }
    });

    const rate = await this.exchangeRateService.getExchangeRate(clientTenantId);

    const autoSetting = await this.getTenantSetting(clientTenantId, 'exchange_rate_auto');
    const displayCurrencySetting = await this.getTenantSetting(clientTenantId, 'display_currency');
    const allowCurrencySwitchSetting = await this.getTenantSetting(clientTenantId, 'allow_currency_switch');

    const auto = autoSetting !== null
      ? autoSetting === 'true'
      : (tenant?.partner?.exchangeRateAuto ?? true);

    const baseCurrency = (tenant?.partner?.baseCurrency ?? 'NIO') === 'USD' ? 'USD' : 'NIO';
    const displayCurrency = (displayCurrencySetting === 'USD' || displayCurrencySetting === 'NIO')
      ? displayCurrencySetting
      : baseCurrency;
    const allowCurrencySwitch = allowCurrencySwitchSetting !== null
      ? allowCurrencySwitchSetting === 'true'
      : true;
    
    return {
      rate,
      auto,
      baseCurrency,
      displayCurrency,
      allowCurrencySwitch,
    };
  }

  async updateExchangeRate(
    clientTenantId: string,
    data: {
      rate?: number;
      auto?: boolean;
      displayCurrency?: 'USD' | 'NIO';
      allowCurrencySwitch?: boolean;
    },
  ) {
    if (data.auto !== undefined) {
      const tenant = await this.prisma.clientTenant.findUnique({ where: { id: clientTenantId }});
      if (tenant && tenant.partnerId) {
        await this.prisma.partner.update({
          where: { id: tenant.partnerId },
          data: { exchangeRateAuto: data.auto }
        });
      }
      await this.upsertTenantSetting(clientTenantId, 'exchange_rate_auto', data.auto ? 'true' : 'false');
    }

    if (data.rate !== undefined) {
      await this.exchangeRateService.updateManualRate(clientTenantId, data.rate);
    }

    if (data.displayCurrency !== undefined) {
      const normalizedDisplayCurrency = data.displayCurrency === 'USD' ? 'USD' : 'NIO';
      await this.upsertTenantSetting(clientTenantId, 'display_currency', normalizedDisplayCurrency);
    }

    if (data.allowCurrencySwitch !== undefined) {
      await this.upsertTenantSetting(
        clientTenantId,
        'allow_currency_switch',
        data.allowCurrencySwitch ? 'true' : 'false',
      );
    }

    return this.getExchangeRate(clientTenantId);
  }

  // ─── TICKETS ──────────────────────────────────────────────────────────────
  async createTicket(data: any, clientTenantId: string) {
    return this.prisma.ticket.create({
      data: {
        number: data.number || genCode('TKT'),
        subject: data.subject,
        description: data.description,
        status: (data.status?.toUpperCase() as TicketStatus) || TicketStatus.OPEN,
        priority: (data.priority?.toUpperCase() as Priority) || Priority.MEDIUM,
        assignedToId: data.assignedToId || null,
        clientTenantId,
      },
    });
  }

  async findAllTickets(clientTenantId: string) {
    return this.prisma.ticket.findMany({
      where: { clientTenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTicketById(id: string, clientTenantId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, clientTenantId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} no encontrado`);
    }

    return ticket;
  }

  async updateTicket(id: string, data: any, clientTenantId: string) {
    return this.prisma.ticket.update({
      where: { id, clientTenantId },
      data: {
        ...data,
        ...(data.status && { status: data.status.toUpperCase() as TicketStatus }),
        ...(data.priority && { priority: data.priority.toUpperCase() as Priority }),
      },
    });
  }

  async removeTicket(id: string, clientTenantId: string) {
    return this.prisma.ticket.delete({ where: { id, clientTenantId } });
  }

  // ─── DOCUMENTOS ───────────────────────────────────────────────────────────
  private toInt(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, Math.round(parsed));
  }

  private normalizeDocumentPayload(data: any, uploadedById: string) {
    const name = (data?.name || data?.title || 'Documento sin nombre').toString().trim();
    const url = (data?.url || '').toString().trim();
    const mimeType = (data?.mimeType || data?.type || 'application/octet-stream').toString().trim();

    return {
      name,
      url,
      size: this.toInt(data?.size, 0),
      mimeType,
      folder: data?.folder ?? data?.folderId ?? null,
      uploadedById: data?.uploadedById || uploadedById,
      projectId: data?.projectId ?? null,
    };
  }

  async createDocument(data: any, clientTenantId: string, userId: string) {
    const payload = this.normalizeDocumentPayload(data, userId);

    if (!payload.url) {
      throw new BadRequestException('El documento requiere una URL');
    }

    return this.prisma.document.create({
      data: { ...payload, clientTenantId },
    });
  }

  async findAllDocuments(clientTenantId: string) {
    return this.prisma.document.findMany({
      where: { clientTenantId },
      orderBy: { id: 'desc' },
    });
  }

  async findDocumentById(id: string, clientTenantId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, clientTenantId },
    });

    if (!document) {
      throw new NotFoundException(`Documento ${id} no encontrado`);
    }

    return document;
  }

  async updateDocument(id: string, data: any, clientTenantId: string, userId: string) {
    const payload = this.normalizeDocumentPayload(data, userId);
    return this.prisma.document.update({
      where: { id, clientTenantId },
      data: {
        ...(data?.name !== undefined || data?.title !== undefined ? { name: payload.name } : {}),
        ...(data?.url !== undefined ? { url: payload.url } : {}),
        ...(data?.size !== undefined ? { size: payload.size } : {}),
        ...(data?.mimeType !== undefined || data?.type !== undefined ? { mimeType: payload.mimeType } : {}),
        ...(data?.folder !== undefined || data?.folderId !== undefined ? { folder: payload.folder } : {}),
        ...(data?.uploadedById !== undefined ? { uploadedById: payload.uploadedById } : {}),
        ...(data?.projectId !== undefined ? { projectId: payload.projectId } : {}),
      },
    });
  }

  async removeDocument(id: string, clientTenantId: string) {
    return this.prisma.document.delete({ where: { id, clientTenantId } });
  }

  // ─── ACTIVIDADES ──────────────────────────────────────────────────────────
  async createActivity(data: any, clientTenantId: string) {
    return this.prisma.activity.create({
      data: {
        title: data.title,
        type: (data.type?.toUpperCase() as ActivityType) || ActivityType.TASK,
        status: (data.status?.toUpperCase() as TaskStatus) || TaskStatus.PENDING,
        description: data.description || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        assignedToId: data.assignedToId,  // required — must come from frontend
        clientTenantId,
      },
    });
  }

  async findAllActivities(clientTenantId: string) {
    return this.prisma.activity.findMany({
      where: { clientTenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateActivity(id: string, data: any, clientTenantId: string) {
    return this.prisma.activity.update({
      where: { id, clientTenantId },
      data: {
        ...data,
        ...(data.type && { type: toEnum(data.type) }),
        ...(data.status && { status: toEnum(data.status) }),
        ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
      },
    });
  }

  async removeActivity(id: string, clientTenantId: string) {
    return this.prisma.activity.delete({ where: { id, clientTenantId } });
  }

  // ─── NOTIFICACIONES ───────────────────────────────────────────────────────
  async findAllNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
    });
  }

  async readNotification(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async readAllNotifications(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
