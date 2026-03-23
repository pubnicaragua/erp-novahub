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

const SLA_PRIORITY_HOURS: Record<Priority, number> = {
  [Priority.LOW]: 72,
  [Priority.MEDIUM]: 24,
  [Priority.HIGH]: 8,
  [Priority.URGENT]: 4,
};

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
  private normalizeTicketStatus(value?: string): TicketStatus {
    const normalized = (value || TicketStatus.OPEN).toUpperCase();
    if (normalized in TicketStatus) return normalized as TicketStatus;
    return TicketStatus.OPEN;
  }

  private normalizePriority(value?: string): Priority {
    const normalized = (value || Priority.MEDIUM).toUpperCase();
    if (normalized in Priority) return normalized as Priority;
    return Priority.MEDIUM;
  }

  private parseDate(value?: string | Date | null): Date | null {
    if (value === undefined || value === null || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  private calculateSlaDueAt(referenceDate: Date, priority: Priority): Date {
    const hours = SLA_PRIORITY_HOURS[priority] ?? SLA_PRIORITY_HOURS[Priority.MEDIUM];
    return new Date(referenceDate.getTime() + hours * 60 * 60 * 1000);
  }

  private async validateAssignedUser(assignedToId: string | null | undefined, clientTenantId: string): Promise<string | null> {
    if (!assignedToId) return null;

    const user = await this.prisma.user.findFirst({
      where: { id: assignedToId, clientTenantId },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException('El agente asignado no existe en el tenant actual');
    }

    return user.id;
  }

  private async createTicketAudit(
    payload: {
      ticketId: string;
      clientTenantId: string;
      action: string;
      message?: string | null;
      actorId?: string | null;
      metadata?: any;
    },
    tx?: any,
  ) {
    const runner = tx || this.prisma;
    await runner.ticketAudit.create({
      data: {
        ticketId: payload.ticketId,
        clientTenantId: payload.clientTenantId,
        action: payload.action,
        message: payload.message ?? null,
        actorId: payload.actorId ?? null,
        metadata: payload.metadata ?? null,
      },
    } as any);
  }

  private async createUserNotification(userId: string | null | undefined, title: string, message: string, link?: string) {
    if (!userId) return;
    await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type: 'warning',
        link: link || null,
      },
    });
  }

  async createTicket(data: any, clientTenantId: string, actorId?: string) {
    const priority = this.normalizePriority(data.priority);
    const status = this.normalizeTicketStatus(data.status);
    const createdAt = new Date();
    const assignedToId = await this.validateAssignedUser(data.assignedToId, clientTenantId);
    const explicitSlaDueAt = this.parseDate(data.slaDueAt);
    const slaDueAt = explicitSlaDueAt || this.calculateSlaDueAt(createdAt, priority);

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          number: data.number || genCode('TKT'),
          subject: data.subject,
          description: data.description,
          customerId: data.customerId || null,
          status,
          priority,
          assignedToId,
          slaDueAt,
          clientTenantId,
        },
      } as any);

      await this.createTicketAudit(
        {
          ticketId: created.id,
          clientTenantId,
          action: 'TICKET_CREATED',
          message: `Ticket creado con prioridad ${priority}`,
          actorId: actorId || null,
          metadata: { status, priority, assignedToId, slaDueAt },
        },
        tx,
      );

      return created;
    });

    if (assignedToId) {
      await this.createUserNotification(
        assignedToId,
        `Nuevo ticket asignado (${ticket.number})`,
        `${ticket.subject}`,
        `/tickets/${ticket.id}`,
      );
    }

    return ticket;
  }

  async findAllTickets(clientTenantId: string) {
    return this.prisma.ticket.findMany({
      where: { clientTenantId },
      include: {
        _count: {
          select: { comments: true },
        },
      } as any,
      orderBy: { createdAt: 'desc' },
    } as any);
  }

  async findTicketById(id: string, clientTenantId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, clientTenantId },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, email: true } } },
        },
        audits: {
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
      } as any,
    } as any);

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} no encontrado`);
    }

    return ticket;
  }

  async updateTicket(id: string, data: any, clientTenantId: string, actorId?: string) {
    const current: any = await this.prisma.ticket.findFirst({
      where: { id, clientTenantId },
    });

    if (!current) {
      throw new NotFoundException(`Ticket ${id} no encontrado`);
    }

    const nextStatus = data.status ? this.normalizeTicketStatus(data.status) : current.status;
    const nextPriority = data.priority ? this.normalizePriority(data.priority) : current.priority;
    const nextAssignedToId = data.assignedToId !== undefined
      ? await this.validateAssignedUser(data.assignedToId, clientTenantId)
      : current.assignedToId;

    const statusChanged = nextStatus !== current.status;
    const priorityChanged = nextPriority !== current.priority;
    const assignedChanged = nextAssignedToId !== current.assignedToId;

    const explicitSlaDueAt = data.slaDueAt !== undefined ? this.parseDate(data.slaDueAt) : undefined;
    const recomputedSlaDueAt = priorityChanged ? this.calculateSlaDueAt(new Date(), nextPriority) : current.slaDueAt;
    const nextSlaDueAt = explicitSlaDueAt !== undefined ? explicitSlaDueAt : recomputedSlaDueAt;

    const shouldResetSlaMarkers = priorityChanged || explicitSlaDueAt !== undefined;
    const reopened =
      (nextStatus === TicketStatus.OPEN || nextStatus === TicketStatus.IN_PROGRESS)
      && (current.status === TicketStatus.RESOLVED || current.status === TicketStatus.CLOSED);

    const updated = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id, clientTenantId },
        data: {
          ...(data.subject !== undefined ? { subject: data.subject } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.customerId !== undefined ? { customerId: data.customerId || null } : {}),
          status: nextStatus,
          priority: nextPriority,
          assignedToId: nextAssignedToId,
          ...(nextSlaDueAt !== undefined ? { slaDueAt: nextSlaDueAt } : {}),
          ...(shouldResetSlaMarkers ? { slaBreachedAt: null, slaReminderSentAt: null } : {}),
          ...(nextStatus === TicketStatus.RESOLVED ? { resolvedAt: new Date(), closedAt: null } : {}),
          ...(nextStatus === TicketStatus.CLOSED ? { closedAt: new Date(), resolvedAt: current.resolvedAt ?? new Date() } : {}),
          ...(reopened ? { resolvedAt: null, closedAt: null } : {}),
        },
      } as any);

      if (statusChanged) {
        await this.createTicketAudit(
          {
            ticketId: id,
            clientTenantId,
            action: 'STATUS_CHANGED',
            message: `Estado: ${current.status} -> ${nextStatus}`,
            actorId: actorId || null,
            metadata: { from: current.status, to: nextStatus },
          },
          tx,
        );
      }

      if (priorityChanged) {
        await this.createTicketAudit(
          {
            ticketId: id,
            clientTenantId,
            action: 'PRIORITY_CHANGED',
            message: `Prioridad: ${current.priority} -> ${nextPriority}`,
            actorId: actorId || null,
            metadata: { from: current.priority, to: nextPriority, slaDueAt: nextSlaDueAt },
          },
          tx,
        );
      }

      if (assignedChanged) {
        await this.createTicketAudit(
          {
            ticketId: id,
            clientTenantId,
            action: 'ASSIGNED_CHANGED',
            message: `Asignación: ${current.assignedToId || 'sin asignar'} -> ${nextAssignedToId || 'sin asignar'}`,
            actorId: actorId || null,
            metadata: { from: current.assignedToId, to: nextAssignedToId },
          },
          tx,
        );
      }

      if (data.subject !== undefined && data.subject !== current.subject) {
        await this.createTicketAudit(
          {
            ticketId: id,
            clientTenantId,
            action: 'SUBJECT_UPDATED',
            message: 'Asunto actualizado',
            actorId: actorId || null,
          },
          tx,
        );
      }

      if (data.description !== undefined && data.description !== current.description) {
        await this.createTicketAudit(
          {
            ticketId: id,
            clientTenantId,
            action: 'DESCRIPTION_UPDATED',
            message: 'Descripción actualizada',
            actorId: actorId || null,
          },
          tx,
        );
      }

      if (explicitSlaDueAt !== undefined) {
        await this.createTicketAudit(
          {
            ticketId: id,
            clientTenantId,
            action: 'SLA_UPDATED',
            message: `SLA actualizado a ${nextSlaDueAt ? nextSlaDueAt.toISOString() : 'sin fecha'}`,
            actorId: actorId || null,
          },
          tx,
        );
      }

      return ticket;
    });

    if (assignedChanged && nextAssignedToId) {
      await this.createUserNotification(
        nextAssignedToId,
        `Ticket reasignado (${updated.number})`,
        `${updated.subject}`,
        `/tickets/${updated.id}`,
      );
    }

    return updated;
  }

  async removeTicket(id: string, clientTenantId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, clientTenantId },
      select: { id: true, number: true, subject: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} no encontrado`);
    }

    return this.prisma.ticket.delete({ where: { id, clientTenantId } });
  }

  async findTicketComments(ticketId: string, clientTenantId: string) {
    await this.findTicketById(ticketId, clientTenantId);
    return (this.prisma as any).ticketComment.findMany({
      where: { ticketId, clientTenantId },
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createTicketComment(ticketId: string, data: { message: string }, clientTenantId: string, actorId: string) {
    const ticket = await this.findTicketById(ticketId, clientTenantId);
    const message = (data?.message || '').toString().trim();

    if (!message) {
      throw new BadRequestException('El comentario no puede estar vacío');
    }

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await (tx as any).ticketComment.create({
        data: {
          ticketId,
          authorId: actorId,
          clientTenantId,
          message,
        },
        include: { author: { select: { id: true, name: true, email: true } } },
      } as any);

      await this.createTicketAudit(
        {
          ticketId,
          clientTenantId,
          action: 'COMMENT_ADDED',
          message: 'Se agregó un comentario',
          actorId,
          metadata: { commentId: created.id },
        },
        tx,
      );

      return created;
    });

    if (ticket.assignedToId && ticket.assignedToId !== actorId) {
      await this.createUserNotification(
        ticket.assignedToId,
        `Nuevo comentario en ${ticket.number}`,
        message.slice(0, 140),
        `/tickets/${ticket.id}`,
      );
    }

    return comment;
  }

  async findTicketAudit(ticketId: string, clientTenantId: string) {
    await this.findTicketById(ticketId, clientTenantId);
    return (this.prisma as any).ticketAudit.findMany({
      where: { ticketId, clientTenantId },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async runTicketSlaChecks() {
    const now = new Date();
    const reminderWindow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const tickets = await this.prisma.ticket.findMany({
      where: {
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
        slaDueAt: { not: null },
      },
      orderBy: { slaDueAt: 'asc' },
    } as any);

    let reminders = 0;
    let breaches = 0;

    for (const ticket of tickets as any[]) {
      if (!ticket.slaDueAt) continue;
      const dueAt = new Date(ticket.slaDueAt);

      if (dueAt.getTime() <= now.getTime() && !ticket.slaBreachedAt) {
        await this.prisma.$transaction(async (tx) => {
          await tx.ticket.update({
            where: { id: ticket.id, clientTenantId: ticket.clientTenantId },
            data: { slaBreachedAt: now },
          } as any);

          await this.createTicketAudit(
            {
              ticketId: ticket.id,
              clientTenantId: ticket.clientTenantId,
              action: 'SLA_BREACHED',
              message: `SLA vencido en ${dueAt.toISOString()}`,
              actorId: null,
              metadata: { dueAt: dueAt.toISOString() },
            },
            tx,
          );
        });

        await this.createUserNotification(
          ticket.assignedToId,
          `SLA vencido en ticket ${ticket.number}`,
          `${ticket.subject}`,
          `/tickets/${ticket.id}`,
        );
        breaches += 1;
        continue;
      }

      if (dueAt.getTime() <= reminderWindow.getTime() && !ticket.slaReminderSentAt) {
        await this.prisma.$transaction(async (tx) => {
          await tx.ticket.update({
            where: { id: ticket.id, clientTenantId: ticket.clientTenantId },
            data: { slaReminderSentAt: now },
          } as any);

          await this.createTicketAudit(
            {
              ticketId: ticket.id,
              clientTenantId: ticket.clientTenantId,
              action: 'SLA_REMINDER_SENT',
              message: `SLA próximo a vencer en ${dueAt.toISOString()}`,
              actorId: null,
              metadata: { dueAt: dueAt.toISOString() },
            },
            tx,
          );
        });

        await this.createUserNotification(
          ticket.assignedToId,
          `SLA próximo a vencer (${ticket.number})`,
          `Vence: ${dueAt.toISOString()}`,
          `/tickets/${ticket.id}`,
        );
        reminders += 1;
      }
    }

    return { scanned: tickets.length, reminders, breaches };
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
