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
    let customerId = rest.customerId;
    if (!customerId || customerId.includes('temp-') || customerId.includes('new-')) {
      customerId = (await this.prisma.customer.findFirst({ where: { clientTenantId } }))?.id;
    }

    return this.prisma.estimate.create({
      data: {
        ...rest,
        customerId,
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

  async updateEstimate(id: string, data: any, clientTenantId: string) {
    return this.prisma.estimate.update({
      where: { id, clientTenantId },
      data: {
        ...data,
        ...(data.status && { status: toEnum(data.status) }),
      },
    });
  }

  async convertEstimateToOrder(id: string, clientTenantId: string) {
    const estimate = await this.prisma.estimate.findFirst({ where: { id, clientTenantId }, include: { items: true } });
    if (!estimate) throw new NotFoundException('Estimate not found');
    const order = await this.prisma.salesOrder.create({
      data: {
        number: genCode('ORD'),
        customerId: estimate.customerId,
        date: new Date(),
        subtotal: estimate.subtotal,
        taxAmount: estimate.taxAmount,
        discountAmount: estimate.discountAmount,
        total: estimate.total,
        currency: estimate.currency,
        notes: estimate.notes,
        status: 'CONFIRMED',
        clientTenantId,
      },
      include: { customer: true },
    });
    await this.prisma.estimate.update({ where: { id }, data: { status: 'APPROVED' } });
    return order;
  }

  async removeEstimate(id: string, clientTenantId: string) {
    return this.prisma.estimate.delete({ where: { id, clientTenantId } });
  }

  // ─── ÓRDENES DE VENTA ─────────────────────────────────────────────────────
  async createSalesOrder(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    let customerId = rest.customerId;
    if (!customerId || customerId.includes('temp-') || customerId.includes('new-')) {
      customerId = (await this.prisma.customer.findFirst({ where: { clientTenantId } }))?.id;
    }

    return this.prisma.salesOrder.create({
      data: {
        ...rest,
        customerId,
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

  async removeSalesOrder(id: string, clientTenantId: string) {
    return this.prisma.salesOrder.delete({ where: { id, clientTenantId } });
  }

  // ─── FACTURAS ─────────────────────────────────────────────────────────────
  async createInvoice(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    let customerId = rest.customerId;
    if (!customerId || customerId.includes('temp-') || customerId.includes('new-')) {
      customerId = (await this.prisma.customer.findFirst({ where: { clientTenantId } }))?.id;
    }

    return this.prisma.invoice.create({
      data: {
        ...rest,
        customerId,
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

  async markInvoicePaid(id: string, clientTenantId: string) {
    const inv = await this.prisma.invoice.findFirst({ where: { id, clientTenantId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'PAID', amountPaid: inv.total, balance: 0 },
    });
  }

  async removeInvoice(id: string, clientTenantId: string) {
    return this.prisma.invoice.delete({ where: { id, clientTenantId } });
  }

  // ─── PAGOS RECIBIDOS ──────────────────────────────────────────────────────
  async createPayment(data: any, clientTenantId: string) {
    let customerId = data.customerId;
    if (!customerId || customerId.includes('temp-') || customerId.includes('new-')) {
      customerId = (await this.prisma.customer.findFirst({ where: { clientTenantId } }))?.id;
    }
    return this.prisma.paymentReceived.create({
      data: {
        ...data,
        customerId,
        method: toEnum(data.method || 'CASH'),
        clientTenantId,
      },
    });
  }

  async findAllPayments(clientTenantId: string) {
    return this.prisma.paymentReceived.findMany({
      where: { clientTenantId },
      include: { customer: true, invoice: true },
      orderBy: { date: 'desc' },
    });
  }

  async updatePayment(id: string, data: any, clientTenantId: string) {
    return this.prisma.paymentReceived.update({
      where: { id, clientTenantId },
      data: {
        ...data,
        ...(data.method && { method: toEnum(data.method) }),
      },
    });
  }

  async removePayment(id: string, clientTenantId: string) {
    return this.prisma.paymentReceived.delete({ where: { id, clientTenantId } });
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
    let customerId = data.customerId;
    if (!customerId || customerId.includes('temp-') || customerId.includes('new-')) {
      customerId = (await this.prisma.customer.findFirst({ where: { clientTenantId } }))?.id;
    }
    return this.prisma.recurringInvoice.create({
      data: {
        ...data,
        customerId,
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
    let customerId = data.customerId;
    if (!customerId || customerId.includes('temp-') || customerId.includes('new-')) {
      customerId = (await this.prisma.customer.findFirst({ where: { clientTenantId } }))?.id;
    }
    return this.prisma.salesReturn.create({
      data: {
        ...data,
        customerId,
        number: data.number || genCode('DEV'),
        clientTenantId,
        status: data.status ? toEnum<ReturnStatus>(data.status) : ReturnStatus.PENDING,
      },
    });
  }

  async updateReturn(id: string, data: any, clientTenantId: string) {
    return this.prisma.salesReturn.update({
      where: { id, clientTenantId },
      data: {
        ...data,
        ...(data.status && { status: toEnum(data.status) }),
      },
    });
  }

  async removeReturn(id: string, clientTenantId: string) {
    return this.prisma.salesReturn.delete({ where: { id, clientTenantId } });
  }

  async approveReturn(id: string, clientTenantId: string) {
    return this.prisma.salesReturn.update({
      where: { id, clientTenantId },
      data: { status: toEnum<ReturnStatus>('approved') },
    });
  }
}
