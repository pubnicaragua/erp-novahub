import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function genCode(prefix: string): string {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

function toEnum<T extends string>(val: string): T {
  return val.toUpperCase() as T;
}

@Injectable()
export class FinancialsService {
  private readonly DEFAULT_EXCHANGE_RATE = 36.5;

  constructor(private prisma: PrismaService) {}

  private normalizeCurrency(value?: string): 'NIO' | 'USD' {
    return (value || '').toUpperCase() === 'USD' ? 'USD' : 'NIO';
  }

  private toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private resolveExchangeRate(value: unknown): number {
    const parsed = this.toNumber(value, this.DEFAULT_EXCHANGE_RATE);
    return parsed > 0 ? parsed : this.DEFAULT_EXCHANGE_RATE;
  }

  private resolveBaseAmount(
    amount: number,
    currency: 'NIO' | 'USD',
    exchangeRate: number,
    providedBaseAmount?: unknown,
  ): number {
    if (providedBaseAmount !== undefined && providedBaseAmount !== null && providedBaseAmount !== '') {
      return this.toNumber(providedBaseAmount, 0);
    }
    return currency === 'NIO' ? amount : amount * exchangeRate;
  }

  // ─── CUENTAS CONTABLES ────────────────────────────────────────────────────
  async createAccount(data: any, clientTenantId: string) {
    const { parentAccountId, ...rest } = data;
    return this.prisma.account.create({
      data: {
        ...rest,
        ...(rest.type && { type: toEnum(rest.type) as any }),
        parentId: rest.parentId ?? parentAccountId ?? null,
        clientTenantId,
      },
    });
  }

  async findAllAccounts(clientTenantId: string) {
    return this.prisma.account.findMany({
      where: { clientTenantId },
      orderBy: { code: 'asc' },
    });
  }

  async updateAccount(id: string, data: any, clientTenantId: string) {
    const { parentAccountId, ...rest } = data;
    return this.prisma.account.update({
      where: { id, clientTenantId },
      data: {
        ...rest,
        ...(rest.type && { type: toEnum(rest.type) as any }),
        ...(parentAccountId !== undefined && { parentId: parentAccountId || null }),
      },
    });
  }

  // ─── INGRESOS ─────────────────────────────────────────────────────────────
  async createIncome(data: any, clientTenantId: string) {
    const amount = this.toNumber(data.amount, 0);
    const currency = this.normalizeCurrency(data.currency);
    const exchangeRate = this.resolveExchangeRate(data.exchangeRate);
    const baseAmount = this.resolveBaseAmount(amount, currency, exchangeRate, data.baseAmount);
    const source = (data.source || data.description || 'Ingreso').toString().trim();

    return this.prisma.income.create({
      data: {
        number: data.number || genCode('INC'),
        accountId: data.accountId,
        date: data.date ? new Date(data.date) : new Date(),
        amount,
        currency,
        exchangeRate,
        baseAmount,
        source,
        notes: data.notes ?? null,
        clientTenantId,
      },
      include: { account: true },
    });
  }

  async findAllIncome(clientTenantId: string) {
    return this.prisma.income.findMany({
      where: { clientTenantId },
      include: { account: true },
      orderBy: { date: 'desc' },
    });
  }

  async updateIncome(id: string, data: any, clientTenantId: string) {
    const current = await this.prisma.income.findFirst({
      where: { id, clientTenantId },
      select: { amount: true, currency: true, exchangeRate: true, source: true },
    });

    const nextAmount = data.amount !== undefined ? this.toNumber(data.amount, 0) : this.toNumber(current?.amount, 0);
    const nextCurrency = data.currency !== undefined ? this.normalizeCurrency(data.currency) : this.normalizeCurrency(current?.currency);
    const nextExchangeRate = data.exchangeRate !== undefined
      ? this.resolveExchangeRate(data.exchangeRate)
      : this.resolveExchangeRate(current?.exchangeRate);
    const nextBaseAmount = this.resolveBaseAmount(nextAmount, nextCurrency, nextExchangeRate, data.baseAmount);

    return this.prisma.income.update({
      where: { id, clientTenantId },
      data: {
        ...(data.accountId !== undefined && { accountId: data.accountId }),
        ...(data.date !== undefined && { date: data.date ? new Date(data.date) : undefined }),
        amount: nextAmount,
        currency: nextCurrency,
        exchangeRate: nextExchangeRate,
        baseAmount: nextBaseAmount,
        ...(data.source !== undefined || data.description !== undefined
          ? { source: (data.source || data.description || current?.source || 'Ingreso').toString().trim() }
          : {}),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: { account: true },
    });
  }

  async removeIncome(id: string, clientTenantId: string) {
    return this.prisma.income.delete({ where: { id, clientTenantId } });
  }

  // ─── GASTOS ───────────────────────────────────────────────────────────────
  async createExpense(data: any, clientTenantId: string) {
    const amount = this.toNumber(data.amount, 0);
    const currency = this.normalizeCurrency(data.currency);
    const exchangeRate = this.resolveExchangeRate(data.exchangeRate);
    const baseAmount = this.resolveBaseAmount(amount, currency, exchangeRate, data.baseAmount);

    return this.prisma.expense.create({
      data: {
        number: data.number || genCode('EXP'),
        accountId: data.accountId,
        supplierId: data.supplierId ?? null,
        date: data.date ? new Date(data.date) : new Date(),
        amount,
        currency,
        exchangeRate,
        baseAmount,
        category: data.category || 'OTROS',
        description: data.description || 'Gasto',
        reference: data.reference ?? null,
        status: toEnum(data.status || 'PENDING') as any,
        clientTenantId,
      },
      include: { account: true, supplier: true } as any,
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
    const current = await this.prisma.expense.findFirst({
      where: { id, clientTenantId },
      select: { amount: true, currency: true, exchangeRate: true },
    });

    const nextAmount = data.amount !== undefined ? this.toNumber(data.amount, 0) : this.toNumber(current?.amount, 0);
    const nextCurrency = data.currency !== undefined ? this.normalizeCurrency(data.currency) : this.normalizeCurrency(current?.currency);
    const nextExchangeRate = data.exchangeRate !== undefined
      ? this.resolveExchangeRate(data.exchangeRate)
      : this.resolveExchangeRate(current?.exchangeRate);
    const nextBaseAmount = this.resolveBaseAmount(nextAmount, nextCurrency, nextExchangeRate, data.baseAmount);

    return this.prisma.expense.update({
      where: { id, clientTenantId },
      data: {
        ...(data.accountId !== undefined && { accountId: data.accountId }),
        ...(data.supplierId !== undefined && { supplierId: data.supplierId || null }),
        ...(data.date !== undefined && { date: data.date ? new Date(data.date) : undefined }),
        amount: nextAmount,
        currency: nextCurrency,
        exchangeRate: nextExchangeRate,
        baseAmount: nextBaseAmount,
        ...(data.category !== undefined && { category: data.category || 'OTROS' }),
        ...(data.description !== undefined && { description: data.description || 'Gasto' }),
        ...(data.reference !== undefined && { reference: data.reference || null }),
        ...(data.status && { status: toEnum(data.status) as any }),
      },
      include: { account: true, supplier: true } as any,
    });
  }

  async removeExpense(id: string, clientTenantId: string) {
    return this.prisma.expense.delete({ where: { id, clientTenantId } });
  }

  // ─── GASTOS RECURRENTES ───────────────────────────────────────────────────
  async createRecurringExpense(data: any, clientTenantId: string) {
    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const amount = this.toNumber(data.amount, 0);
    const currency = this.normalizeCurrency(data.currency);
    const exchangeRate = this.resolveExchangeRate(data.exchangeRate);
    const baseAmount = this.resolveBaseAmount(amount, currency, exchangeRate, data.baseAmount);

    return this.prisma.recurringExpense.create({
      data: {
        accountId: data.accountId,
        supplierId: data.supplierId ?? null,
        frequency: toEnum(data.frequency || 'MONTHLY') as any,
        startDate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        amount,
        currency,
        exchangeRate,
        baseAmount,
        category: data.category || 'OTROS',
        description: data.description || 'Gasto recurrente',
        nextExecutionDate: startDate,
        status: toEnum(data.status || 'ACTIVE') as any,
        clientTenantId,
      },
      include: { account: true, supplier: true } as any,
    });
  }

  async findAllRecurringExpenses(clientTenantId: string) {
    return this.prisma.recurringExpense.findMany({
      where: { clientTenantId },
      include: { account: true, supplier: true } as any,
      orderBy: { nextExecutionDate: 'asc' },
    });
  }

  async updateRecurringExpense(id: string, data: any, clientTenantId: string) {
    const current = await this.prisma.recurringExpense.findFirst({
      where: { id, clientTenantId },
      select: { amount: true, currency: true, exchangeRate: true, category: true, description: true },
    });

    const nextAmount = data.amount !== undefined ? this.toNumber(data.amount, 0) : this.toNumber(current?.amount, 0);
    const nextCurrency = data.currency !== undefined ? this.normalizeCurrency(data.currency) : this.normalizeCurrency(current?.currency);
    const nextExchangeRate = data.exchangeRate !== undefined
      ? this.resolveExchangeRate(data.exchangeRate)
      : this.resolveExchangeRate(current?.exchangeRate);
    const nextBaseAmount = this.resolveBaseAmount(nextAmount, nextCurrency, nextExchangeRate, data.baseAmount);

    const updateData: any = {
      ...(data.accountId !== undefined && { accountId: data.accountId }),
      ...(data.supplierId !== undefined && { supplierId: data.supplierId || null }),
      ...(data.frequency && { frequency: toEnum(data.frequency) as any }),
      ...(data.status && { status: toEnum(data.status) as any }),
      ...(data.startDate && { startDate: new Date(data.startDate) }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      amount: nextAmount,
      currency: nextCurrency,
      exchangeRate: nextExchangeRate,
      baseAmount: nextBaseAmount,
      ...(data.category !== undefined && { category: data.category || current?.category || 'OTROS' }),
      ...(data.description !== undefined && { description: data.description || current?.description || 'Gasto recurrente' }),
    };

    if (data.startDate && data.nextExecutionDate === undefined) {
      updateData.nextExecutionDate = new Date(data.startDate);
    } else if (data.nextExecutionDate) {
      updateData.nextExecutionDate = new Date(data.nextExecutionDate);
    }

    return this.prisma.recurringExpense.update({
      where: { id, clientTenantId },
      data: updateData,
      include: { account: true, supplier: true } as any,
    });
  }

  async removeRecurringExpense(id: string, clientTenantId: string) {
    return this.prisma.recurringExpense.delete({ where: { id, clientTenantId } });
  }

  // ─── ASIENTOS CONTABLES ───────────────────────────────────────────────────
  async createJournalEntry(data: any, clientTenantId: string) {
    const { lines, ...rest } = data;
    return this.prisma.journalEntry.create({
      data: {
        ...rest,
        number: rest.number || genCode('JNL'),
        clientTenantId,
        ...(lines?.length > 0 && { lines: { create: lines } }),
      },
      include: { lines: true },
    });
  }

  async findAllJournalEntries(clientTenantId: string) {
    return this.prisma.journalEntry.findMany({
      where: { clientTenantId },
      include: { lines: true },
      orderBy: { date: 'desc' },
    });
  }

  // ─── TRANSACCIONES ────────────────────────────────────────────────────────
  async findAllTransactions(clientTenantId: string) {
    return this.prisma.transaction.findMany({
      where: { clientTenantId },
      orderBy: { date: 'desc' },
    });
  }

  // ─── BALANCE GENERAL ──────────────────────────────────────────────────────
  async getBalance(clientTenantId: string) {
    const [incomeRows, expenseRows, invoiceRows] = await Promise.all([
      this.prisma.income.findMany({
        where: { clientTenantId },
        select: { amount: true, currency: true, exchangeRate: true, baseAmount: true },
      }),
      this.prisma.expense.findMany({
        where: { clientTenantId },
        select: { amount: true, currency: true, exchangeRate: true, baseAmount: true },
      }),
      this.prisma.invoice.findMany({
        where: { clientTenantId },
        select: { total: true, currency: true, exchangeRate: true, baseTotal: true },
      }),
    ]);

    const totalIncome = incomeRows.reduce((acc, row) => {
      const amount = this.toNumber(row.amount, 0);
      const currency = this.normalizeCurrency(row.currency as string);
      const exchangeRate = this.resolveExchangeRate(row.exchangeRate);
      const baseAmount = this.resolveBaseAmount(amount, currency, exchangeRate, row.baseAmount);
      return acc + baseAmount;
    }, 0);

    const totalExpenses = expenseRows.reduce((acc, row) => {
      const amount = this.toNumber(row.amount, 0);
      const currency = this.normalizeCurrency(row.currency as string);
      const exchangeRate = this.resolveExchangeRate(row.exchangeRate);
      const baseAmount = this.resolveBaseAmount(amount, currency, exchangeRate, row.baseAmount);
      return acc + baseAmount;
    }, 0);

    const invoiceRevenue = invoiceRows.reduce((acc, row) => {
      const amount = this.toNumber(row.total, 0);
      const currency = this.normalizeCurrency(row.currency as string);
      const exchangeRate = this.resolveExchangeRate(row.exchangeRate);
      const baseAmount = this.resolveBaseAmount(amount, currency, exchangeRate, row.baseTotal);
      return acc + baseAmount;
    }, 0);

    return {
      totalIncome,
      totalExpenses,
      invoiceRevenue,
      netBalance: totalIncome + invoiceRevenue - totalExpenses,
      baseCurrency: 'NIO',
      generatedAt: new Date().toISOString(),
    };
  }
}
