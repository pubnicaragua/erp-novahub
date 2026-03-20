import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRateService } from '../common/exchange-rate.service';
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
  constructor(
    private prisma: PrismaService,
    private exchangeRateService: ExchangeRateService
  ) {}

  private async getDocumentCurrencyData(data: any, clientTenantId: string) {
    const currency = data.currency || 'NIO';
    const exchangeRate = data.exchangeRate || await this.exchangeRateService.getExchangeRate(clientTenantId);
    
    // Si la moneda es la base (NIO), el baseTotal es igual al total.
    // Si la moneda es USD, el baseTotal es total * exchangeRate.
    let baseTotal = data.baseTotal;
    if (baseTotal === undefined && data.total !== undefined) {
      baseTotal = currency === 'NIO' ? Number(data.total) : Number(data.total) * Number(exchangeRate);
    }

    return { currency, exchangeRate, baseTotal };
  }

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
    // Evitar actualizar campos protegidos o calculados
    const { id: _, clientTenantId: __, createdAt, updatedAt, balance, ...cleanData } = data;

    return this.prisma.customer.update({
      where: { id, clientTenantId },
      data: {
        ...cleanData,
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
      const firstCustomer = await this.prisma.customer.findFirst({ where: { clientTenantId } });
      if (firstCustomer) {
        customerId = firstCustomer.id;
      } else {
        const newCustomer = await this.createCustomer({ name: 'Cliente General' }, clientTenantId);
        customerId = newCustomer.id;
      }
    }

    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(data, clientTenantId);

    return this.prisma.estimate.create({
      data: {
        ...rest,
        customerId,
        number: rest.number || genCode('COT'),
        status: toEnum(rest.status || 'DRAFT'),
        clientTenantId,
        currency,
        exchangeRate,
        baseTotal,
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
    const { items, status, ...rest } = data;
    
    let itemsMutation = {};
    if (items && Array.isArray(items)) {
      itemsMutation = {
        items: {
          deleteMany: {},
          create: items.map(item => ({
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            taxRate: Number(item.taxRate || 0),
            discount: Number(item.discount || 0),
            total: Number(item.total || 0),
            productId: item.productId || null,
          }))
        }
      };
    }

    return this.prisma.estimate.update({
      where: { id, clientTenantId },
      data: {
        ...rest,
        ...(status && { status: toEnum(status) }),
        ...itemsMutation,
      },
      include: { items: true, customer: true }
    });
  }

  async convertEstimateToOrder(id: string, clientTenantId: string) {
    const estimate = await this.prisma.estimate.findFirst({ where: { id, clientTenantId }, include: { items: true } });
    if (!estimate) throw new NotFoundException('Estimate not found');

    // Build items payload from estimate items
    const itemsCreate = (estimate.items || []).map(item => ({
      productId: item.productId || null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discount: item.discount,
      total: item.total,
    }));

    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(estimate, clientTenantId);

    const orderData: any = {
      number: genCode('ORD'),
      customerId: estimate.customerId,
      estimateId: estimate.id,
      date: new Date(),
      subtotal: estimate.subtotal,
      taxAmount: estimate.taxAmount,
      discountAmount: estimate.discountAmount,
      total: estimate.total,
      currency,
      exchangeRate,
      baseTotal,
      notes: estimate.notes ? `[Desde Cotización ${estimate.number}] ${estimate.notes}` : `Generado desde Cotización ${estimate.number}`,
      status: 'PENDING_REVIEW',
      clientTenantId,
    };

    if (itemsCreate.length > 0) {
      orderData.items = { create: itemsCreate };
    }

    const order = await this.prisma.salesOrder.create({
      data: orderData,
      include: { items: true, customer: true },
    });
    await this.prisma.estimate.update({ where: { id }, data: { status: 'APPROVED' } });
    return order;
  }

  async removeEstimate(id: string, clientTenantId: string) {
    // First delete all items to avoid FK constraint errors
    await this.prisma.estimateItem.deleteMany({ where: { estimate: { id, clientTenantId } } });
    return this.prisma.estimate.delete({ where: { id, clientTenantId } });
  }

  // ─── ÓRDENES DE VENTA ─────────────────────────────────────────────────────
  async createSalesOrder(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    let customerId = rest.customerId;
    if (!customerId || customerId.includes('temp-') || customerId.includes('new-')) {
      const firstCustomer = await this.prisma.customer.findFirst({ where: { clientTenantId } });
      if (firstCustomer) {
        customerId = firstCustomer.id;
      } else {
        const newCustomer = await this.createCustomer({ name: 'Cliente General' }, clientTenantId);
        customerId = newCustomer.id;
      }
    }

    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(data, clientTenantId);

    return this.prisma.salesOrder.create({
      data: {
        ...rest,
        customerId,
        number: rest.number || genCode('ORD'),
        status: toEnum(rest.status || 'DRAFT'),
        clientTenantId,
        currency,
        exchangeRate,
        baseTotal,
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
    const { items, status, ...rest } = data;
    
    let itemsMutation = {};
    if (items && Array.isArray(items)) {
      itemsMutation = {
        items: {
          deleteMany: {},
          create: items.map(item => ({
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            taxRate: Number(item.taxRate || 0),
            discount: Number(item.discount || 0),
            total: Number(item.total || 0),
            productId: item.productId || null,
          }))
        }
      };
    }

    return this.prisma.salesOrder.update({
      where: { id, clientTenantId },
      data: {
        ...rest,
        ...(status && { status: toEnum(status) }),
        ...itemsMutation,
      },
      include: { items: true, customer: true }
    });
  }

  async removeSalesOrder(id: string, clientTenantId: string) {
    // First delete all items to avoid FK constraint errors
    await this.prisma.salesOrderItem.deleteMany({ where: { salesOrder: { id, clientTenantId } } });
    return this.prisma.salesOrder.delete({ where: { id, clientTenantId } });
  }

  // ─── FACTURAS ─────────────────────────────────────────────────────────────
  async createInvoice(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    let customerId = rest.customerId;
    if (!customerId || customerId.includes('temp-') || customerId.includes('new-')) {
      customerId = (await this.prisma.customer.findFirst({ where: { clientTenantId } }))?.id;
    }

    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(data, clientTenantId);

    return this.prisma.invoice.create({
      data: {
        ...rest,
        customerId,
        number: rest.number || genCode('FAC'),
        status: toEnum(rest.status || 'DRAFT'),
        paymentStatus: toEnum(rest.paymentStatus || 'PENDING'),
        clientTenantId,
        currency,
        exchangeRate,
        baseTotal,
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
    const currency = data.currency || 'NIO';
    const exchangeRate = data.exchangeRate || await this.exchangeRateService.getExchangeRate(clientTenantId);
    const baseAmount = data.baseAmount || (currency === 'NIO' ? Number(data.amount) : Number(data.amount) * Number(exchangeRate));

    return this.prisma.paymentReceived.create({
      data: {
        ...data,
        customerId,
        method: toEnum(data.method || 'CASH'),
        clientTenantId,
        currency,
        exchangeRate,
        baseAmount,
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
