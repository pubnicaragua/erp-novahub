import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRateService } from '../common/exchange-rate.service';

function genCode(prefix: string): string {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

function toEnum<T extends string>(val: string): T {
  return val.toUpperCase() as T;
}

@Injectable()
export class PurchasesService {
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
    } else if (baseTotal === undefined && data.amount !== undefined) {
      // Para pagos o gastos que usan 'amount' en lugar de 'total'
      baseTotal = currency === 'NIO' ? Number(data.amount) : Number(data.amount) * Number(exchangeRate);
    }

    return { currency, exchangeRate, baseTotal };
  }

  // ─── PROVEEDORES ──────────────────────────────────────────────────────────
  async createSupplier(data: any, clientTenantId: string) {
    return this.prisma.supplier.create({
      data: {
        code: data.code || genCode('PRV'),
        name: data.name,
        taxId: data.taxId,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        country: data.country,
        contactName: data.contactName,
        paymentTerms: data.paymentTerms,
        status: (data.status?.toUpperCase() ?? 'ACTIVE') as any,
        clientTenantId,
      },
    });
  }

  async findAllSuppliers(clientTenantId: string) {
    return this.prisma.supplier.findMany({
      where: { clientTenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSupplier(id: string, data: any, clientTenantId: string) {
    return this.prisma.supplier.update({ where: { id, clientTenantId }, data });
  }

  async removeSupplier(id: string, clientTenantId: string) {
    return this.prisma.supplier.delete({ where: { id, clientTenantId } });
  }

  // ─── ÓRDENES DE COMPRA ────────────────────────────────────────────────────
  async createOrder(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(data, clientTenantId);

    return this.prisma.purchaseOrder.create({
      data: {
        ...rest,
        number: rest.number || genCode('PO'),
        status: toEnum(rest.status || 'DRAFT'),
        clientTenantId,
        currency,
        exchangeRate,
        baseTotal,
        ...(items?.length > 0 && { items: { create: items } }),
      },
      include: { items: true, supplier: true },
    });
  }

  async findAllOrders(clientTenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { clientTenantId },
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOrder(id: string, data: any, clientTenantId: string) {
    return this.prisma.purchaseOrder.update({
      where: { id, clientTenantId },
      data: {
        ...data,
        ...(data.status && { status: toEnum(data.status) }),
      },
    });
  }

  // ─── RECEPCIONES DE COMPRA ────────────────────────────────────────────────
  async createReceipt(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    return this.prisma.purchaseReceipt.create({
      data: {
        ...rest,
        number: rest.number || genCode('REC'),
        clientTenantId,
        ...(items?.length > 0 && { items: { create: items } }),
      },
      include: { items: true },
    });
  }

  async findAllReceipts(clientTenantId: string) {
    return this.prisma.purchaseReceipt.findMany({
      where: { clientTenantId },
      include: { purchaseOrder: { include: { supplier: true } }, items: true },
      orderBy: { date: 'desc' },
    });
  }

  // ─── FACTURAS DE PROVEEDOR ────────────────────────────────────────────────
  async createInvoice(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(data, clientTenantId);

    return this.prisma.supplierInvoice.create({
      data: {
        ...rest,
        number: rest.number || genCode('FP'),
        status: toEnum(rest.status || 'DRAFT'),
        paymentStatus: toEnum(rest.paymentStatus || 'PENDING'),
        clientTenantId,
        currency,
        exchangeRate,
        baseTotal,
        ...(items?.length > 0 && { items: { create: items } }),
      },
      include: { items: true, supplier: true },
    });
  }

  async findAllInvoices(clientTenantId: string) {
    return this.prisma.supplierInvoice.findMany({
      where: { clientTenantId },
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── FACTURAS RECURRENTES DE PROVEEDOR ────────────────────────────────────
  async createRecurringInvoice(data: any, clientTenantId: string) {
    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(data, clientTenantId);

    return this.prisma.recurringSupplierInvoice.create({
      data: { 
        ...data, 
        clientTenantId,
        currency,
        exchangeRate,
        baseTotal,
      },
    });
  }

  async findAllRecurringInvoices(clientTenantId: string) {
    return this.prisma.recurringSupplierInvoice.findMany({
      where: { clientTenantId },
      include: { supplier: true },
      orderBy: { nextInvoiceDate: 'asc' },
    });
  }

  // ─── PAGOS REALIZADOS ─────────────────────────────────────────────────────
  async createPayment(data: any, clientTenantId: string) {
    const { currency, exchangeRate, baseTotal: baseAmount } = await this.getDocumentCurrencyData(data, clientTenantId);

    return this.prisma.paymentMade.create({
      data: {
        ...data,
        method: toEnum(data.method || 'CASH'),
        clientTenantId,
        currency,
        exchangeRate,
        baseAmount,
      },
    });
  }

  async findAllPayments(clientTenantId: string) {
    return this.prisma.paymentMade.findMany({
      where: { clientTenantId },
      include: { supplier: true },
      orderBy: { date: 'desc' },
    });
  }

  // ─── CRÉDITOS DE PROVEEDOR ────────────────────────────────────────────────
  async createCredit(data: any, clientTenantId: string) {
    return this.prisma.supplierCredit.create({
      data: {
        ...data,
        number: data.number || genCode('SC'),
        clientTenantId,
      },
    });
  }

  async findAllCredits(clientTenantId: string) {
    return this.prisma.supplierCredit.findMany({
      where: { clientTenantId },
      include: { supplier: true },
      orderBy: { date: 'desc' },
    });
  }

  // ─── GASTOS ───────────────────────────────────────────────────────────────
  async createExpense(data: any, clientTenantId: string) {
    const { currency, exchangeRate, baseTotal: baseAmount } = await this.getDocumentCurrencyData(data, clientTenantId);

    return this.prisma.expense.create({ 
      data: { 
        ...data, 
        clientTenantId,
        currency,
        exchangeRate,
        baseAmount,
      } 
    });
  }

  async findAllExpenses(clientTenantId: string) {
    return this.prisma.expense.findMany({
      where: { clientTenantId },
      include: { account: true, supplier: true } as any,
      orderBy: { date: 'desc' },
    });
  }

  async updateExpense(id: string, data: any, clientTenantId: string) {
    return this.prisma.expense.update({ where: { id, clientTenantId }, data });
  }

  async removeExpense(id: string, clientTenantId: string) {
    return this.prisma.expense.delete({ where: { id, clientTenantId } });
  }

  // ─── GASTOS RECURRENTES ───────────────────────────────────────────────────
  async createRecurringExpense(data: any, clientTenantId: string) {
    const { currency, exchangeRate, baseTotal: baseAmount } = await this.getDocumentCurrencyData(data, clientTenantId);

    return this.prisma.recurringExpense.create({ 
      data: { 
        ...data, 
        clientTenantId,
        currency,
        exchangeRate,
        baseAmount,
      } 
    });
  }

  async findAllRecurringExpenses(clientTenantId: string) {
    return this.prisma.recurringExpense.findMany({
      where: { clientTenantId },
      include: { account: true, supplier: true } as any,
      orderBy: { createdAt: 'desc' },
    });
  }
}
