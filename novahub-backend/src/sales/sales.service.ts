import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRateService } from '../common/exchange-rate.service';
import { CustomerType, EntityStatus, PaymentStatus, PaymentMethod, RecurringStatus, ReturnStatus, Frequency, CreditNoteStatus } from '@prisma/client';

/** Genera un código único tipo CLI-0001 */
function genCode(prefix: string): string {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

/** Normaliza el valor de un enum a UPPERCASE si viene en minúscula */
function toEnum<T extends string>(val: string): T {
  return val.toUpperCase() as T;
}

/** Calcula los totales a partir de los items */
function calculateTotalsFromItems(items: any[]): { subtotal: number; taxAmount: number; total: number } {
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unitPrice || 0);
    const discount = Number(item.discount || 0);
    const taxRate = Number(item.taxRate || 0);

    const lineSubtotal = qty * price - discount;
    const lineTax = lineSubtotal * (taxRate / 100);

    subtotal += lineSubtotal;
    taxAmount += lineTax;
  }

  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

/** Prepara items para escritura anidada (limpia campos extra) */
function prepareItemsCreate(items: any[]) {
  return items.map(item => ({
    productId: item.productId || null,
    description: (item.description || '').trim(),
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
    taxRate: Number(item.taxRate || 0),
    discount: Number(item.discount || 0),
    total: Number(item.total || (Number(item.quantity || 1) * Number(item.unitPrice || 0))),
  }));
}

/** Prepara items sin descuento (para ReturnItem, CreditNoteItem, RecurringInvoiceItem) */
function prepareSimpleItemsCreate(items: any[], includeProductId = true) {
  return items.map(item => ({
    ...(includeProductId && { productId: item.productId || null }),
    description: (item.description || '').trim(),
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
    ...(item.taxRate !== undefined && { taxRate: Number(item.taxRate || 0) }),
    total: Number(item.total || (Number(item.quantity || 1) * Number(item.unitPrice || 0))),
  }));
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
    
    let baseTotal = data.baseTotal;
    if (baseTotal === undefined && data.total !== undefined) {
      baseTotal = currency === 'NIO' ? Number(data.total) : Number(data.total) * Number(exchangeRate);
    }

    return { currency, exchangeRate, baseTotal };
  }

  private async resolveCustomerId(customerId: string | undefined, clientTenantId: string): Promise<string> {
    if (customerId && !customerId.includes('temp-') && !customerId.includes('new-')) {
      return customerId;
    }
    const first = await this.prisma.customer.findFirst({ where: { clientTenantId } });
    if (first) return first.id;
    const newCustomer = await this.prisma.customer.create({
      data: { code: genCode('CLI'), name: 'Cliente General', clientTenantId },
    });
    return newCustomer.id;
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
    const customerId = await this.resolveCustomerId(rest.customerId, clientTenantId);
    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(data, clientTenantId);

    // Auto-calculate if not provided
    let { subtotal, taxAmount, total } = rest;
    if (items?.length > 0 && (!subtotal && !total)) {
      const calc = calculateTotalsFromItems(items);
      subtotal = calc.subtotal;
      taxAmount = calc.taxAmount;
      total = calc.total;
    }

    return this.prisma.estimate.create({
      data: {
        ...rest,
        customerId,
        number: rest.number || genCode('COT'),
        status: toEnum(rest.status || 'DRAFT'),
        subtotal: Number(subtotal || 0),
        taxAmount: Number(taxAmount || 0),
        total: Number(total || 0),
        clientTenantId,
        currency,
        exchangeRate,
        baseTotal,
        ...(items?.length > 0 && { items: { create: prepareItemsCreate(items) } }),
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
          create: prepareItemsCreate(items),
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
    await this.prisma.estimateItem.deleteMany({ where: { estimate: { id, clientTenantId } } });
    return this.prisma.estimate.delete({ where: { id, clientTenantId } });
  }

  // ─── ÓRDENES DE VENTA ─────────────────────────────────────────────────────
  async createSalesOrder(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    const customerId = await this.resolveCustomerId(rest.customerId, clientTenantId);
    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(data, clientTenantId);

    let { subtotal, taxAmount, total } = rest;
    if (items?.length > 0 && (!subtotal && !total)) {
      const calc = calculateTotalsFromItems(items);
      subtotal = calc.subtotal;
      taxAmount = calc.taxAmount;
      total = calc.total;
    }

    return this.prisma.salesOrder.create({
      data: {
        ...rest,
        customerId,
        number: rest.number || genCode('ORD'),
        status: toEnum(rest.status || 'DRAFT'),
        subtotal: Number(subtotal || 0),
        taxAmount: Number(taxAmount || 0),
        total: Number(total || 0),
        clientTenantId,
        currency,
        exchangeRate,
        baseTotal,
        ...(items?.length > 0 && { items: { create: prepareItemsCreate(items) } }),
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
          create: prepareItemsCreate(items),
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
    await this.prisma.salesOrderItem.deleteMany({ where: { salesOrder: { id, clientTenantId } } });
    return this.prisma.salesOrder.delete({ where: { id, clientTenantId } });
  }

  async convertOrderToInvoice(id: string, clientTenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({ where: { id, clientTenantId }, include: { items: true } });
      if (!order) throw new NotFoundException('Sales order not found');

      const itemsCreate = (order.items || []).map(item => ({
        productId: item.productId || null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        discount: item.discount,
        total: item.total,
      }));

      const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(order, clientTenantId);

      const invoiceData: any = {
        number: genCode('FAC'),
        customerId: order.customerId,
        salesOrderId: order.id,
        date: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000), // +30 days
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        discountAmount: order.discountAmount,
        total: order.total,
        amountPaid: 0,
        balance: order.total,
        currency,
        exchangeRate,
        baseTotal,
        notes: order.notes ? `[Desde Orden ${order.number}] ${order.notes}` : `Generado desde Orden ${order.number}`,
        status: 'PENDING',
        clientTenantId,
      };

      if (itemsCreate.length > 0) {
        invoiceData.items = { create: itemsCreate };
      }

      const invoice = await tx.invoice.create({
        data: invoiceData,
        include: { items: true, customer: true },
      });

      // Update customer balance (increase what they owe)
      if (invoice.balance > 0) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: { balance: { increment: invoice.balance } },
        });
      }

      // Update order status
      await tx.salesOrder.update({ where: { id }, data: { status: 'SHIPPED' } });
      
      return invoice;
    });
  }

  // ─── FACTURAS ─────────────────────────────────────────────────────────────
  async createInvoice(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    const customerId = await this.resolveCustomerId(rest.customerId, clientTenantId);
    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(data, clientTenantId);

    // Auto-calculate totals from items if not provided
    let subtotal = Number(rest.subtotal || 0);
    let taxAmount = Number(rest.taxAmount || 0);
    let discountAmount = Number(rest.discountAmount || 0);
    let total = Number(rest.total || 0);

    if (items?.length > 0 && total === 0) {
      const calc = calculateTotalsFromItems(items);
      subtotal = calc.subtotal;
      taxAmount = calc.taxAmount;
      total = calc.total - discountAmount;
    }

    const balance = total - Number(rest.amountPaid || 0);

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          customerId,
          number: rest.number || genCode('FAC'),
          salesOrderId: rest.salesOrderId || null,
          date: new Date(rest.date),
          dueDate: rest.dueDate ? new Date(rest.dueDate) : new Date(Date.now() + 30 * 86400000),
          subtotal,
          taxAmount,
          discountAmount,
          total,
          amountPaid: Number(rest.amountPaid || 0),
          balance,
          currency,
          exchangeRate,
          baseTotal: baseTotal ?? (currency === 'NIO' ? total : total * Number(exchangeRate)),
          status: toEnum<PaymentStatus>(rest.status || 'PENDING'),
          notes: rest.notes || null,
          clientTenantId,
          ...(items?.length > 0 && { items: { create: prepareItemsCreate(items) } }),
        },
        include: { items: true, customer: true },
      });

      // Update customer balance (increase what they owe)
      if (balance > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { balance: { increment: balance } },
        });
      }

      return invoice;
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
    const { items, status, ...rest } = data;
    
    let itemsMutation = {};
    if (items && Array.isArray(items)) {
      itemsMutation = {
        items: {
          deleteMany: {},
          create: prepareItemsCreate(items),
        }
      };
    }

    return this.prisma.invoice.update({
      where: { id, clientTenantId },
      data: {
        ...rest,
        ...(status && { status: toEnum(status) }),
        ...itemsMutation,
      },
      include: { items: true, customer: true },
    });
  }

  async markInvoicePaid(id: string, clientTenantId: string) {
    const inv = await this.prisma.invoice.findFirst({ where: { id, clientTenantId } });
    if (!inv) throw new NotFoundException('Invoice not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: { status: 'PAID', amountPaid: inv.total, balance: 0 },
      });

      // Decrease customer balance
      const previousBalance = Number(inv.balance);
      if (previousBalance > 0) {
        await tx.customer.update({
          where: { id: inv.customerId },
          data: { balance: { decrement: previousBalance } },
        });
      }

      return updated;
    });
  }

  async removeInvoice(id: string, clientTenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findFirst({ where: { id, clientTenantId } });
      if (!inv) throw new NotFoundException('Invoice not found');

      // Restore customer balance if invoice had remaining balance
      const invBalance = Number(inv.balance);
      if (invBalance > 0) {
        await tx.customer.update({
          where: { id: inv.customerId },
          data: { balance: { decrement: invBalance } },
        });
      }

      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.delete({ where: { id } });
    });
  }

  // ─── PAGOS RECIBIDOS ──────────────────────────────────────────────────────
  async createPayment(data: any, clientTenantId: string) {
    const customerId = await this.resolveCustomerId(data.customerId, clientTenantId);
    const currency = data.currency || 'NIO';
    const exchangeRate = data.exchangeRate || await this.exchangeRateService.getExchangeRate(clientTenantId);
    const amount = Number(data.amount);
    const baseAmount = data.baseAmount || (currency === 'NIO' ? amount : amount * Number(exchangeRate));

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.paymentReceived.create({
        data: {
          number: data.number || genCode('PAG'),
          customerId,
          invoiceId: data.invoiceId || null,
          date: new Date(data.date),
          amount,
          currency,
          exchangeRate,
          baseAmount,
          method: toEnum<PaymentMethod>(data.method || 'CASH'),
          reference: data.reference || null,
          notes: data.notes || null,
          clientTenantId,
        },
        include: { customer: true, invoice: true },
      });

      // If linked to an invoice, update invoice balance
      if (data.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: data.invoiceId } });
        if (invoice) {
          const newAmountPaid = Number(invoice.amountPaid) + amount;
          const newBalance = Number(invoice.total) - newAmountPaid;

          await tx.invoice.update({
            where: { id: data.invoiceId },
            data: {
              amountPaid: newAmountPaid,
              balance: Math.max(0, newBalance),
              status: newBalance <= 0 ? 'PAID' : 'PARTIAL',
            },
          });
        }
      }

      // Decrease customer balance
      await tx.customer.update({
        where: { id: customerId },
        data: { balance: { decrement: amount } },
      });

      return payment;
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
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.paymentReceived.findFirst({ where: { id, clientTenantId } });
      if (!payment) throw new NotFoundException('Payment not found');

      // Reverse invoice balance
      if (payment.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
        if (invoice) {
          const newAmountPaid = Math.max(0, Number(invoice.amountPaid) - Number(payment.amount));
          const newBalance = Number(invoice.total) - newAmountPaid;
          await tx.invoice.update({
            where: { id: payment.invoiceId },
            data: {
              amountPaid: newAmountPaid,
              balance: newBalance,
              status: newAmountPaid === 0 ? 'PENDING' : 'PARTIAL',
            },
          });
        }
      }

      // Restore customer balance
      await tx.customer.update({
        where: { id: payment.customerId },
        data: { balance: { increment: Number(payment.amount) } },
      });

      return tx.paymentReceived.delete({ where: { id } });
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
    const { items, ...rest } = data;
    const customerId = await this.resolveCustomerId(rest.customerId, clientTenantId);
    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(data, clientTenantId);

    // Auto-calculate totals from items
    let subtotal = Number(rest.subtotal || 0);
    let taxAmount = Number(rest.taxAmount || 0);
    let total = Number(rest.total || 0);

    if (items?.length > 0 && total === 0) {
      const calc = calculateTotalsFromItems(items);
      subtotal = calc.subtotal;
      taxAmount = calc.taxAmount;
      total = calc.total;
    }

    const nextInvoiceDate = rest.nextInvoiceDate || rest.startDate;

    return this.prisma.recurringInvoice.create({
      data: {
        customerId,
        frequency: rest.frequency ? toEnum<Frequency>(rest.frequency) : Frequency.MONTHLY,
        startDate: new Date(rest.startDate),
        endDate: rest.endDate ? new Date(rest.endDate) : null,
        nextInvoiceDate: new Date(nextInvoiceDate),
        subtotal,
        taxAmount,
        total,
        currency,
        exchangeRate,
        baseTotal: baseTotal ?? (currency === 'NIO' ? total : total * Number(exchangeRate)),
        status: rest.status ? toEnum<RecurringStatus>(rest.status) : RecurringStatus.ACTIVE,
        clientTenantId,
        ...(items?.length > 0 && { items: { create: prepareSimpleItemsCreate(items) } }),
      },
      include: { items: true, customer: true },
    });
  }

  async updateRecurringInvoice(id: string, data: any, clientTenantId: string) {
    const { items, ...rest } = data;

    let itemsMutation = {};
    if (items && Array.isArray(items)) {
      itemsMutation = {
        items: {
          deleteMany: {},
          create: prepareSimpleItemsCreate(items),
        }
      };
    }

    return this.prisma.recurringInvoice.update({
      where: { id, clientTenantId },
      data: {
        ...rest,
        ...(rest.status && { status: toEnum(rest.status) }),
        ...(rest.frequency && { frequency: toEnum(rest.frequency) }),
        ...itemsMutation,
      },
      include: { items: true, customer: true },
    });
  }

  async setRecurringInvoiceStatus(id: string, status: string, clientTenantId: string) {
    return this.prisma.recurringInvoice.update({
      where: { id, clientTenantId },
      data: { status: toEnum<RecurringStatus>(status) },
    });
  }

  async removeRecurringInvoice(id: string, clientTenantId: string) {
    await this.prisma.recurringInvoiceItem.deleteMany({ where: { recurringInvoice: { id, clientTenantId } } });
    return this.prisma.recurringInvoice.delete({ where: { id, clientTenantId } });
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
    const { items, ...rest } = data;
    const customerId = await this.resolveCustomerId(rest.customerId, clientTenantId);

    // Auto-calculate total from items
    let total = Number(rest.total || 0);
    if (items?.length > 0 && total === 0) {
      total = items.reduce((acc: number, item: any) =>
        acc + Number(item.total || Number(item.quantity || 1) * Number(item.unitPrice || 0)),
        0
      );
    }

    return this.prisma.salesReturn.create({
      data: {
        number: rest.number || genCode('DEV'),
        customerId,
        invoiceId: rest.invoiceId,
        date: new Date(rest.date),
        total,
        reason: (rest.reason || '').trim(),
        status: rest.status ? toEnum<ReturnStatus>(rest.status) : ReturnStatus.PENDING,
        clientTenantId,
        ...(items?.length > 0 && { items: { create: prepareSimpleItemsCreate(items) } }),
      },
      include: { items: true, customer: true },
    });
  }

  async updateReturn(id: string, data: any, clientTenantId: string) {
    const { items, ...rest } = data;

    let itemsMutation = {};
    if (items && Array.isArray(items)) {
      itemsMutation = {
        items: {
          deleteMany: {},
          create: prepareSimpleItemsCreate(items),
        }
      };
    }

    return this.prisma.salesReturn.update({
      where: { id, clientTenantId },
      data: {
        ...rest,
        ...(rest.status && { status: toEnum(rest.status) }),
        ...itemsMutation,
      },
      include: { items: true, customer: true },
    });
  }

  async removeReturn(id: string, clientTenantId: string) {
    await this.prisma.salesReturnItem.deleteMany({ where: { salesReturn: { id, clientTenantId } } });
    return this.prisma.salesReturn.delete({ where: { id, clientTenantId } });
  }

  async approveReturn(id: string, clientTenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ret = await tx.salesReturn.findFirst({
        where: { id, clientTenantId },
        include: { items: true },
      });
      if (!ret) throw new NotFoundException('Sales return not found');

      // Approve the return
      await tx.salesReturn.update({
        where: { id },
        data: { status: 'APPROVED' },
      });

      // Auto-generate Credit Note
      const creditNote = await tx.creditNote.create({
        data: {
          number: genCode('NC'),
          customerId: ret.customerId,
          invoiceId: ret.invoiceId,
          salesReturnId: ret.id,
          date: new Date(),
          total: ret.total,
          status: 'ISSUED',
          reason: ret.reason || `Nota de crédito por devolución ${ret.number}`,
          clientTenantId,
          ...(ret.items.length > 0 && {
            items: {
              create: ret.items.map(item => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
              })),
            },
          }),
        },
      });

      // Adjust customer balance (reduce what they owe)
      await tx.customer.update({
        where: { id: ret.customerId },
        data: { balance: { decrement: Number(ret.total) } },
      });

      return { salesReturn: ret, creditNote };
    });
  }

  // ─── NOTAS DE CRÉDITO ────────────────────────────────────────────────────
  async findAllCreditNotes(clientTenantId: string) {
    return this.prisma.creditNote.findMany({
      where: { clientTenantId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCreditNote(data: any, clientTenantId: string) {
    const { items, ...rest } = data;

    let total = Number(rest.total || 0);
    if (items?.length > 0 && total === 0) {
      total = items.reduce((acc: number, item: any) =>
        acc + Number(item.total || Number(item.quantity || 1) * Number(item.unitPrice || 0)),
        0
      );
    }

    return this.prisma.creditNote.create({
      data: {
        number: rest.number || genCode('NC'),
        customerId: rest.customerId,
        invoiceId: rest.invoiceId || null,
        salesReturnId: rest.salesReturnId || null,
        date: new Date(rest.date),
        total,
        status: rest.status ? toEnum<CreditNoteStatus>(rest.status) : CreditNoteStatus.DRAFT,
        reason: (rest.reason || '').trim(),
        clientTenantId,
        ...(items?.length > 0 && {
          items: {
            create: items.map((item: any) => ({
              description: (item.description || '').trim(),
              quantity: Number(item.quantity || 1),
              unitPrice: Number(item.unitPrice || 0),
              total: Number(item.total || Number(item.quantity || 1) * Number(item.unitPrice || 0)),
            })),
          },
        }),
      },
      include: { items: true },
    });
  }

  async updateCreditNote(id: string, data: any, clientTenantId: string) {
    const { items, ...rest } = data;

    let itemsMutation = {};
    if (items && Array.isArray(items)) {
      itemsMutation = {
        items: {
          deleteMany: {},
          create: items.map((item: any) => ({
            description: (item.description || '').trim(),
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            total: Number(item.total || Number(item.quantity || 1) * Number(item.unitPrice || 0)),
          })),
        },
      };
    }

    return this.prisma.creditNote.update({
      where: { id, clientTenantId },
      data: {
        ...rest,
        ...(rest.status && { status: toEnum(rest.status) }),
        ...itemsMutation,
      },
      include: { items: true },
    });
  }

  async issueCreditNote(id: string, clientTenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const cn = await tx.creditNote.findFirst({ where: { id, clientTenantId } });
      if (!cn) throw new NotFoundException('Credit note not found');

      const updated = await tx.creditNote.update({
        where: { id },
        data: { status: 'ISSUED' },
      });

      // Reduce customer balance
      await tx.customer.update({
        where: { id: cn.customerId },
        data: { balance: { decrement: Number(cn.total) } },
      });

      return updated;
    });
  }

  async removeCreditNote(id: string, clientTenantId: string) {
    await this.prisma.creditNoteItem.deleteMany({ where: { creditNote: { id, clientTenantId } } });
    return this.prisma.creditNote.delete({ where: { id, clientTenantId } });
  }
}
