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
    const { id: _, clientTenantId: __, createdAt, updatedAt, balance, contact, ...cleanData } = data;
    return this.prisma.supplier.update({ 
      where: { id, clientTenantId }, 
      data: {
        ...cleanData,
        ...(data.status && { status: toEnum(data.status) })
      } 
    });
  }

  async removeSupplier(id: string, clientTenantId: string) {
    return this.prisma.supplier.delete({ where: { id, clientTenantId } });
  }

  // ─── ÓRDENES DE COMPRA ────────────────────────────────────────────────────
  async createOrder(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(data, clientTenantId);

    let calculatedSubtotal = rest.subtotal || 0;
    let calculatedTaxAmount = rest.taxAmount || 0;
    let calculatedTotal = rest.total || 0;

    if (!calculatedTotal && items && items.length > 0) {
      calculatedSubtotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
      calculatedTaxAmount = items.reduce((sum, item) => sum + ((Number(item.quantity) * Number(item.unitPrice)) * (Number(item.taxRate || 0) / 100)), 0);
      calculatedTotal = calculatedSubtotal + calculatedTaxAmount;
    }
    
    let finalBaseTotal = baseTotal;
    if (finalBaseTotal === undefined || finalBaseTotal === 0) {
      finalBaseTotal = currency === 'NIO' ? calculatedTotal : calculatedTotal * Number(exchangeRate);
    }

    return this.prisma.purchaseOrder.create({
      data: {
        ...rest,
        number: rest.number || genCode('PO'),
        subtotal: calculatedSubtotal,
        taxAmount: calculatedTaxAmount,
        total: calculatedTotal,
        status: toEnum(rest.status || 'DRAFT'),
        clientTenantId,
        currency,
        exchangeRate,
        baseTotal: finalBaseTotal,
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

  async findOrderById(id: string, clientTenantId: string) {
    return this.prisma.purchaseOrder.findFirst({ where: { id, clientTenantId }, include: { items: true, supplier: true } });
  }

  async removeOrder(id: string, clientTenantId: string) {
    return this.prisma.purchaseOrder.delete({ where: { id, clientTenantId } });
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

    return this.prisma.$transaction(async (prisma) => {
      const receipt = await prisma.purchaseReceipt.create({
        data: {
          ...rest,
          number: rest.number || genCode('REC'),
          clientTenantId,
          status: toEnum(rest.status || 'RECEIVED'),
          ...(items?.length > 0 && { items: { create: items } }),
        },
        include: { items: true },
      });

      if (rest.purchaseOrderId) {
        // Optional: Update purchase order status to received if needed
        await prisma.purchaseOrder.update({
          where: { id: rest.purchaseOrderId },
          data: { status: 'RECEIVED' }
        });
      }

      return receipt;
    });
  }

  async findAllReceipts(clientTenantId: string) {
    return this.prisma.purchaseReceipt.findMany({
      where: { clientTenantId },
      include: { purchaseOrder: { include: { supplier: true } }, items: true, supplier: true },
      orderBy: { date: 'desc' },
    });
  }

  async findReceiptById(id: string, clientTenantId: string) {
    return this.prisma.purchaseReceipt.findFirst({ where: { id, clientTenantId }, include: { items: true, supplier: true } });
  }

  async removeReceipt(id: string, clientTenantId: string) {
    return this.prisma.purchaseReceipt.delete({ where: { id, clientTenantId } });
  }

  // ─── FACTURAS DE PROVEEDOR ────────────────────────────────────────────────
  async createInvoice(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(data, clientTenantId);

    let calculatedSubtotal = rest.subtotal || 0;
    let calculatedTaxAmount = rest.taxAmount || 0;
    let calculatedTotal = rest.total || 0;

    if (!calculatedTotal && items && items.length > 0) {
      calculatedSubtotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
      calculatedTaxAmount = items.reduce((sum, item) => sum + ((Number(item.quantity) * Number(item.unitPrice)) * (Number(item.taxRate || 0) / 100)), 0);
      calculatedTotal = calculatedSubtotal + calculatedTaxAmount;
    }
    
    let finalBaseTotal = baseTotal;
    if (finalBaseTotal === undefined || finalBaseTotal === 0) {
      finalBaseTotal = currency === 'NIO' ? calculatedTotal : calculatedTotal * Number(exchangeRate);
    }

    return this.prisma.$transaction(async (prisma) => {
      const invoice = await prisma.supplierInvoice.create({
        data: {
          ...rest,
          number: rest.number || genCode('FP'),
          subtotal: calculatedSubtotal,
          taxAmount: calculatedTaxAmount,
          total: calculatedTotal,
          balance: calculatedTotal,
          status: toEnum(rest.status || 'DRAFT'),
          paymentStatus: toEnum(rest.paymentStatus || 'PENDING'),
          clientTenantId,
          currency,
          exchangeRate,
          baseTotal: finalBaseTotal,
          ...(items?.length > 0 && { items: { create: items } }),
        },
        include: { items: true, supplier: true },
      });

      // Increase supplier balance
      await prisma.supplier.update({
        where: { id: rest.supplierId },
        data: { balance: { increment: calculatedTotal } }
      });

      return invoice;
    });
  }

  async findAllInvoices(clientTenantId: string) {
    return this.prisma.supplierInvoice.findMany({
      where: { clientTenantId },
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findInvoiceById(id: string, clientTenantId: string) {
    return this.prisma.supplierInvoice.findFirst({ where: { id, clientTenantId }, include: { items: true, supplier: true } });
  }

  async updateInvoice(id: string, data: any, clientTenantId: string) {
    return this.prisma.supplierInvoice.update({ where: { id, clientTenantId }, data });
  }

  async removeInvoice(id: string, clientTenantId: string) {
    return this.prisma.$transaction(async (prisma) => {
      const invoice = await prisma.supplierInvoice.findUnique({ where: { id, clientTenantId } });
      if (!invoice) return null;

      // Revert supplier balance
      await prisma.supplier.update({
        where: { id: invoice.supplierId },
        data: { balance: { decrement: invoice.total } }
      });

      return prisma.supplierInvoice.delete({ where: { id } });
    });
  }

  // ─── FACTURAS RECURRENTES DE PROVEEDOR ────────────────────────────────────
  async createRecurringInvoice(data: any, clientTenantId: string) {
    const { items, ...rest } = data;
    const { currency, exchangeRate, baseTotal } = await this.getDocumentCurrencyData(rest, clientTenantId);

    let calculatedTotal = rest.total || 0;
    if (!calculatedTotal && items && items.length > 0) {
      calculatedTotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    }

    let finalBaseTotal = baseTotal;
    if (finalBaseTotal === undefined || finalBaseTotal === 0) {
      finalBaseTotal = currency === 'NIO' ? calculatedTotal : calculatedTotal * Number(exchangeRate);
    }

    return this.prisma.recurringSupplierInvoice.create({
      data: { 
        ...rest,
        total: calculatedTotal,
        clientTenantId,
        currency,
        exchangeRate,
        baseTotal: finalBaseTotal,
        status: toEnum(rest.status || 'ACTIVE'),
        ...(items?.length > 0 && { items: { create: items } }),
      },
      include: { items: true, supplier: true }
    });
  }

  async findAllRecurringInvoices(clientTenantId: string) {
    return this.prisma.recurringSupplierInvoice.findMany({
      where: { clientTenantId },
      include: { supplier: true },
      orderBy: { nextInvoiceDate: 'asc' },
    });
  }

  async updateRecurringInvoice(id: string, data: any, clientTenantId: string) {
    return this.prisma.recurringSupplierInvoice.update({ where: { id, clientTenantId }, data });
  }

  async removeRecurringInvoice(id: string, clientTenantId: string) {
    return this.prisma.recurringSupplierInvoice.delete({ where: { id, clientTenantId } });
  }

  // ─── PAGOS REALIZADOS ─────────────────────────────────────────────────────
  async createPayment(data: any, clientTenantId: string) {
    const { currency, exchangeRate, baseTotal: baseAmount } = await this.getDocumentCurrencyData(data, clientTenantId);

    return this.prisma.$transaction(async (prisma) => {
      const payment = await prisma.paymentMade.create({
        data: {
          ...data,
          number: data.number || genCode('PM'),
          method: toEnum(data.method || 'CASH'),
          clientTenantId,
          currency,
          exchangeRate,
          baseAmount,
        },
      });

      // Decrease supplier balance
      await prisma.supplier.update({
        where: { id: data.supplierId },
        data: { balance: { decrement: data.amount } }
      });

      // If supplierInvoiceId is provided, decrease invoice balance
      if (data.supplierInvoiceId) {
        const invoice = await prisma.supplierInvoice.findUnique({ where: { id: data.supplierInvoiceId, clientTenantId } });
        if (invoice) {
          const newBalance = Number(invoice.balance) - Number(data.amount);
          await prisma.supplierInvoice.update({
            where: { id: data.supplierInvoiceId },
            data: { 
              balance: Math.max(0, newBalance),
              amountPaid: { increment: data.amount },
              status: newBalance <= 0 ? 'PAID' : 'PARTIAL'
            }
          });
        }
      }

      return payment;
    });
  }

  async findAllPayments(clientTenantId: string) {
    return this.prisma.paymentMade.findMany({
      where: { clientTenantId },
      include: { supplier: true },
      orderBy: { date: 'desc' },
    });
  }

  async updatePayment(id: string, data: any, clientTenantId: string) {
    return this.prisma.paymentMade.update({ where: { id, clientTenantId }, data });
  }

  async removePayment(id: string, clientTenantId: string) {
    return this.prisma.$transaction(async (prisma) => {
      const payment = await prisma.paymentMade.findUnique({ where: { id, clientTenantId } });
      if (!payment) return null;

      // Revert supplier balance (increase)
      await prisma.supplier.update({
        where: { id: payment.supplierId },
        data: { balance: { increment: payment.amount } }
      });

      // Revert invoice balance if applicable
      if (payment.supplierInvoiceId) {
        await prisma.supplierInvoice.update({
          where: { id: payment.supplierInvoiceId },
          data: { 
            balance: { increment: payment.amount },
            amountPaid: { decrement: payment.amount },
            status: 'PARTIAL' // Simplificación: vuelve a parcial
          }
        });
      }

      return prisma.paymentMade.delete({ where: { id } });
    });
  }

  // ─── CRÉDITOS DE PROVEEDOR ────────────────────────────────────────────────
  async createCredit(data: any, clientTenantId: string) {
    const { items, ...rest } = data;

    let calculatedTotal = rest.total || 0;
    if (!calculatedTotal && items && items.length > 0) {
      calculatedTotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    }

    return this.prisma.$transaction(async (prisma) => {
      const credit = await prisma.supplierCredit.create({
        data: {
          ...rest,
          total: calculatedTotal,
          number: rest.number || genCode('SC'),
          status: toEnum(rest.status || 'DRAFT'),
          clientTenantId,
          ...(items?.length > 0 && { items: { create: items } }),
        },
        include: { items: true, supplier: true }
      });

      // Decrease supplier balance
      await prisma.supplier.update({
        where: { id: rest.supplierId },
        data: { balance: { decrement: calculatedTotal } }
      });

      return credit;
    });
  }

  async findAllCredits(clientTenantId: string) {
    return this.prisma.supplierCredit.findMany({
      where: { clientTenantId },
      include: { supplier: true },
      orderBy: { date: 'desc' },
    });
  }

  async updateCredit(id: string, data: any, clientTenantId: string) {
    return this.prisma.supplierCredit.update({ where: { id, clientTenantId }, data });
  }

  async removeCredit(id: string, clientTenantId: string) {
    return this.prisma.$transaction(async (prisma) => {
      const credit = await prisma.supplierCredit.findUnique({ where: { id, clientTenantId } });
      if (!credit) return null;

      // Revert supplier balance (increase)
      await prisma.supplier.update({
        where: { id: credit.supplierId },
        data: { balance: { increment: credit.total } }
      });

      return prisma.supplierCredit.delete({ where: { id } });
    });
  }

  // ─── GASTOS ───────────────────────────────────────────────────────────────
  async createExpense(data: any, clientTenantId: string) {
    const { currency, exchangeRate, baseTotal: baseAmount } = await this.getDocumentCurrencyData(data, clientTenantId);

    return this.prisma.expense.create({ 
      data: { 
        ...data, 
        number: data.number || genCode('EXP'),
        status: toEnum(data.status || 'PENDING'),
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
        status: toEnum(data.status || 'ACTIVE'),
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

  async updateRecurringExpense(id: string, data: any, clientTenantId: string) {
    return this.prisma.recurringExpense.update({ where: { id, clientTenantId }, data });
  }

  async removeRecurringExpense(id: string, clientTenantId: string) {
    return this.prisma.recurringExpense.delete({ where: { id, clientTenantId } });
  }
}
