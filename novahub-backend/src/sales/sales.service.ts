import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerType, EntityStatus, PaymentMethod, RecurringStatus, ReturnStatus, Frequency } from '@prisma/client';

/** Genera un código único tipo CLI-0001 */
function genCode(prefix: string): string {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

/** Normaliza el valor de un enum a UPPERCASE si viene en minúscula */
function toEnum<T extends string>(val: string): T {
  return val.toUpperCase() as T;
}

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  // ─── CLIENTES ─────────────────────────────────────────────────────────────
  async createCustomer(data: any, clientTenantId: string) {
    return this.prisma.customer.create({
      data: {
        code: data.code || genCode('CLI'),
        name: data.name,
        type: (data.type?.toUpperCase() as CustomerType) || CustomerType.COMPANY,
        taxId: data.taxId,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        creditLimit: data.creditLimit ? Number(data.creditLimit) : 0,
        notes: data.notes,
        status: (data.status?.toUpperCase() as EntityStatus) || EntityStatus.ACTIVE,
        clientTenantId,
      },
    });
  }

  async findAllCustomers(clientTenantId: string) {
    return this.prisma.customer.findMany({
      where: { clientTenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCustomer(id: string, data: any, clientTenantId: string) {
    return this.prisma.customer.update({
      where: { id, clientTenantId },
      data: {
        ...data,
        ...(data.type && { type: toEnum(data.type) }),
        ...(data.status && { status: toEnum(data.status) }),
      },
    });
  }

  async removeCustomer(id: string, clientTenantId: string) {
    return this.prisma.customer.delete({ where: { id, clientTenantId } });
  }

  // ─── COTIZACIONES (ESTIMATES) ──────────────────────────────────────────────
  async createEstimate(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    return this.prisma.estimate.create({
      data: {
        ...rest,
        number: rest.number || genCode('COT'),
        status: toEnum(rest.status || 'DRAFT'),
        clientTenantId,
        ...(items?.length > 0 && { items: { create: items } }),
      },
      include: { items: true, customer: true },
    });
  }

  async findAllEstimates(clientTenantId: string) {
    return this.prisma.estimate.findMany({
      where: { clientTenantId },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── ÓRDENES DE VENTA ─────────────────────────────────────────────────────
  async createSalesOrder(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    return this.prisma.salesOrder.create({
      data: {
        ...rest,
        number: rest.number || genCode('ORD'),
        status: toEnum(rest.status || 'DRAFT'),
        clientTenantId,
        ...(items?.length > 0 && { items: { create: items } }),
      },
      include: { items: true, customer: true },
    });
  }

  async findAllSalesOrders(clientTenantId: string) {
    return this.prisma.salesOrder.findMany({
      where: { clientTenantId },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSalesOrder(id: string, data: any, clientTenantId: string) {
    return this.prisma.salesOrder.update({
      where: { id, clientTenantId },
      data: {
        ...data,
        ...(data.status && { status: toEnum(data.status) }),
      },
    });
  }

  // ─── FACTURAS ─────────────────────────────────────────────────────────────
  async createInvoice(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    return this.prisma.invoice.create({
      data: {
        ...rest,
        number: rest.number || genCode('FAC'),
        status: toEnum(rest.status || 'DRAFT'),
        paymentStatus: toEnum(rest.paymentStatus || 'PENDING'),
        clientTenantId,
        ...(items?.length > 0 && { items: { create: items } }),
      },
      include: { items: true, customer: true },
    });
  }

  async findAllInvoices(clientTenantId: string) {
    return this.prisma.invoice.findMany({
      where: { clientTenantId },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateInvoice(id: string, data: any, clientTenantId: string) {
    return this.prisma.invoice.update({
      where: { id, clientTenantId },
      data: {
        ...data,
        ...(data.status && { status: toEnum(data.status) }),
        ...(data.paymentStatus && { paymentStatus: toEnum(data.paymentStatus) }),
      },
    });
  }

  // ─── PAGOS RECIBIDOS ──────────────────────────────────────────────────────
  async createPayment(data: any, clientTenantId: string) {
    return this.prisma.paymentReceived.create({
      data: {
        ...data,
        method: toEnum(data.method || 'CASH'),
        clientTenantId,
      },
    });
  }

  async findAllPayments(clientTenantId: string) {
    return this.prisma.paymentReceived.findMany({
      where: { clientTenantId },
      include: { customer: true },
      orderBy: { date: 'desc' },
    });
  }

  // ─── FACTURAS RECURRENTES ─────────────────────────────────────────────────
  async findAllRecurringInvoices(clientTenantId: string) {
    return this.prisma.recurringInvoice.findMany({
      where: { clientTenantId },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRecurringInvoice(data: any, clientTenantId: string) {
    return this.prisma.recurringInvoice.create({
      data: {
        ...data,
        clientTenantId,
        status: data.status ? toEnum<RecurringStatus>(data.status) : RecurringStatus.ACTIVE,
        frequency: data.frequency ? toEnum<Frequency>(data.frequency) : Frequency.MONTHLY,
      },
    });
  }

  async updateRecurringInvoice(id: string, data: any, clientTenantId: string) {
    return this.prisma.recurringInvoice.update({
      where: { id, clientTenantId },
      data: {
        ...data,
        ...(data.status && { status: toEnum(data.status) }),
        ...(data.frequency && { frequency: toEnum(data.frequency) }),
      },
    });
  }

  async setRecurringInvoiceStatus(id: string, status: string, clientTenantId: string) {
    return this.prisma.recurringInvoice.update({
      where: { id, clientTenantId },
      data: { status: toEnum<RecurringStatus>(status) },
    });
  }

  // ─── DEVOLUCIONES ──────────────────────────────────────────────────────────
  async findAllReturns(clientTenantId: string) {
    return this.prisma.salesReturn.findMany({
      where: { clientTenantId },
      include: { items: true, customer: true },
      orderBy: { date: 'desc' },
    });
  }

  async createReturn(data: any, clientTenantId: string) {
    return this.prisma.salesReturn.create({
      data: {
        ...data,
        clientTenantId,
        status: data.status ? toEnum<ReturnStatus>(data.status) : ReturnStatus.PENDING,
      },
    });
  }

  async approveReturn(id: string, clientTenantId: string) {
    return this.prisma.salesReturn.update({
      where: { id, clientTenantId },
      data: { status: toEnum<ReturnStatus>('approved') },
    });
  }
}
