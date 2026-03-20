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

  /** Prepara ítems para Órdenes de Compra (con productId, taxRate) */
  private prepareOrderItems(items: any[]) {
    return items.map(item => ({
      productId: item.productId || null,
      description: (item.description || '').trim(),
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      taxRate: Number(item.taxRate || 0),
      total: Number(item.total || (Number(item.quantity || 1) * Number(item.unitPrice || 0))),
    }));
  }

  /** Prepara ítems para Facturas de Proveedor (sin productId, con taxRate) */
  private prepareInvoiceItems(items: any[]) {
    return items.map(item => ({
      description: (item.description || '').trim(),
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      taxRate: Number(item.taxRate || 0),
      total: Number(item.total || (Number(item.quantity || 1) * Number(item.unitPrice || 0))),
    }));
  }

  /** Prepara ítems para Créditos y Recurrentes (sin productId, sin taxRate) */
  private prepareCreditItems(items: any[]) {
    return items.map(item => ({
      description: (item.description || '').trim(),
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0),
      total: Number(item.total || (Number(item.quantity || 1) * Number(item.unitPrice || 0))),
    }));
  }


  /** Prepara ítems para recibos (cantidad ordenada vs recibida) */
  private prepareReceiptItemsCreate(items: any[]) {
    return items.map(item => ({
      productId: item.productId || null,
      description: (item.description || '').trim(),
      quantityOrdered: Number(item.quantityOrdered || 0),
      quantityReceived: Number(item.quantityReceived || 0),
    }));
  }

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

    let calculatedSubtotal = Number(rest.subtotal || 0);
    let calculatedTaxAmount = Number(rest.taxAmount || 0);
    let calculatedTotal = Number(rest.total || 0);

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
        number: rest.number || genCode('PO'),
        supplierId: rest.supplierId,
        date: rest.date ? new Date(rest.date) : new Date(),
        expectedDelivery: rest.expectedDelivery ? new Date(rest.expectedDelivery) : null,
        subtotal: calculatedSubtotal,
        taxAmount: calculatedTaxAmount,
        total: calculatedTotal,
        currency,
        exchangeRate: Number(exchangeRate),
        baseTotal: Number(finalBaseTotal),
        status: toEnum(rest.status || 'DRAFT') as any,
        requestedBy: rest.requestedBy || 'Admin',
        notes: rest.notes,
        clientTenantId,
        ...(items?.length > 0 && { items: { create: this.prepareOrderItems(items) } }),
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
          number: rest.number || genCode('REC'),
          purchaseOrderId: rest.purchaseOrderId,
          supplierId: rest.supplierId,
          date: rest.date ? new Date(rest.date) : new Date(),
          notes: rest.notes,
          clientTenantId,
          status: toEnum(rest.status || 'RECEIVED') as any,
          ...(items?.length > 0 && { items: { create: this.prepareReceiptItemsCreate(items) } }),
        },
        include: { items: true },
      });

      if (rest.purchaseOrderId) {
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

    let calculatedSubtotal = Number(rest.subtotal || 0);
    let calculatedTaxAmount = Number(rest.taxAmount || 0);
    let calculatedTotal = Number(rest.total || 0);

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
          number: rest.number || genCode('FP'),
          supplierId: rest.supplierId,
          purchaseOrderId: rest.purchaseOrderId || null,
          date: rest.date ? new Date(rest.date) : new Date(),
          dueDate: rest.dueDate ? new Date(rest.dueDate) : new Date(),
          subtotal: calculatedSubtotal,
          taxAmount: calculatedTaxAmount,
          total: calculatedTotal,
          balance: calculatedTotal,
          status: toEnum(rest.status || 'PENDING') as any,
          clientTenantId,
          currency,
          exchangeRate: Number(exchangeRate),
          baseTotal: Number(finalBaseTotal),
          ...(items?.length > 0 && { items: { create: this.prepareInvoiceItems(items) } }),
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

    let calculatedTotal = Number(rest.total || 0);
    if (!calculatedTotal && items && items.length > 0) {
      calculatedTotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    }

    let finalBaseTotal = baseTotal;
    if (finalBaseTotal === undefined || finalBaseTotal === 0) {
      finalBaseTotal = currency === 'NIO' ? calculatedTotal : calculatedTotal * Number(exchangeRate);
    }

    return this.prisma.recurringSupplierInvoice.create({
      data: { 
        supplierId: rest.supplierId,
        frequency: toEnum(rest.frequency || 'MONTHLY') as any,
        startDate: rest.startDate ? new Date(rest.startDate) : new Date(),
        endDate: rest.endDate ? new Date(rest.endDate) : null,
        nextInvoiceDate: rest.nextInvoiceDate ? new Date(rest.nextInvoiceDate) : new Date(),
        total: calculatedTotal,
        clientTenantId,
        currency,
        exchangeRate: Number(exchangeRate),
        baseTotal: Number(finalBaseTotal),
        status: toEnum(rest.status || 'ACTIVE') as any,
        ...(items?.length > 0 && { items: { create: this.prepareCreditItems(items) } }),
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
          number: data.number || genCode('PM'),
          supplierId: data.supplierId,
          supplierInvoiceId: data.supplierInvoiceId || null,
          date: data.date ? new Date(data.date) : new Date(),
          amount: Number(data.amount),
          currency,
          exchangeRate: Number(exchangeRate),
          baseAmount: Number(baseAmount),
          method: toEnum(data.method || 'CASH') as any,
          reference: data.reference,
          notes: data.notes,
          clientTenantId,
        },
      });

      // Decrease supplier balance
      await prisma.supplier.update({
        where: { id: data.supplierId },
        data: { balance: { decrement: Number(data.amount) } }
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
              amountPaid: { increment: Number(data.amount) },
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

    let calculatedTotal = Number(rest.total || 0);
    if (!calculatedTotal && items && items.length > 0) {
      calculatedTotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
    }

    return this.prisma.$transaction(async (prisma) => {
      const credit = await prisma.supplierCredit.create({
        data: {
          number: rest.number || genCode('SC'),
          supplierId: rest.supplierId,
          supplierInvoiceId: rest.supplierInvoiceId || null,
          date: rest.date ? new Date(rest.date) : new Date(),
          total: calculatedTotal,
          status: toEnum(rest.status || 'DRAFT') as any,
          reason: rest.reason || '',
          clientTenantId,
          ...(items?.length > 0 && { items: { create: this.prepareCreditItems(items) } }),
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

    // Validate accountId
    let accountId = data.accountId;
    if (accountId) {
      const account = await this.prisma.account.findUnique({ where: { id: accountId } });
      if (!account) {
        const firstAccount = await this.prisma.account.findFirst({ where: { clientTenantId, type: 'EXPENSE' } });
        accountId = firstAccount?.id || accountId;
      }
    } else {
      const firstAccount = await this.prisma.account.findFirst({ where: { clientTenantId, type: 'EXPENSE' } });
      accountId = firstAccount?.id;
    }

    if (!accountId) throw new Error('Se requiere una cuenta contable válida para registrar gastos.');

    return this.prisma.expense.create({ 
      data: { 
        number: data.number || genCode('EXP'),
        accountId: accountId,
        supplierId: data.supplierId || null,
        date: data.date ? new Date(data.date) : new Date(),
        amount: Number(data.amount),
        currency,
        exchangeRate: Number(exchangeRate),
        baseAmount: Number(baseAmount),
        category: data.category || 'OTROS',
        description: data.description || '',
        reference: data.reference,
        status: toEnum(data.status || 'PENDING') as any,
        clientTenantId,
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
        accountId: data.accountId,
        supplierId: data.supplierId || null,
        frequency: toEnum(data.frequency || 'MONTHLY') as any,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: data.endDate ? new Date(data.endDate) : null,
        amount: Number(data.amount),
        currency,
        exchangeRate: Number(exchangeRate),
        baseAmount: Number(baseAmount),
        category: data.category || 'OTROS',
        description: data.description || '',
        status: toEnum(data.status || 'ACTIVE') as any,
        clientTenantId,
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
