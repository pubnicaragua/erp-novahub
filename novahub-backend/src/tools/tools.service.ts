import { Injectable } from '@nestjs/common';
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

  async getExchangeRate(clientTenantId: string) {
    const tenant: any = await this.prisma.clientTenant.findUnique({
      where: { id: clientTenantId },
      select: { exchangeRateAuto: true, baseCurrency: true } as any
    });

    const rate = await this.exchangeRateService.getExchangeRate(clientTenantId);
    
    return {
      rate,
      auto: tenant?.exchangeRateAuto ?? true,
      baseCurrency: tenant?.baseCurrency ?? 'NIO'
    };
  }

  async updateExchangeRate(clientTenantId: string, data: { rate?: number; auto?: boolean }) {
    if (data.auto !== undefined) {
      await this.prisma.clientTenant.update({
        where: { id: clientTenantId },
        data: { exchangeRateAuto: data.auto } as any
      });
    }

    if (data.rate !== undefined) {
      await this.exchangeRateService.updateManualRate(clientTenantId, data.rate);
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
  async createDocument(data: any, clientTenantId: string) {
    return this.prisma.document.create({
      data: { ...data, clientTenantId },
    });
  }

  async findAllDocuments(clientTenantId: string) {
    return this.prisma.document.findMany({
      where: { clientTenantId },
      orderBy: { id: 'desc' },
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
