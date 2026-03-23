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
  constructor(private prisma: PrismaService) {}

  // ─── CUENTAS CONTABLES ────────────────────────────────────────────────────
  async createAccount(data: any, clientTenantId: string) {
    return this.prisma.account.create({ data: { ...data, clientTenantId } });
  }

  async findAllAccounts(clientTenantId: string) {
    return this.prisma.account.findMany({
      where: { clientTenantId },
      orderBy: { code: 'asc' },
    });
  }

  async updateAccount(id: string, data: any, clientTenantId: string) {
    return this.prisma.account.update({ where: { id, clientTenantId }, data });
  }

  // ─── INGRESOS ─────────────────────────────────────────────────────────────
  async createIncome(data: any, clientTenantId: string) {
    return this.prisma.income.create({ data: { ...data, clientTenantId } });
  }

  async findAllIncome(clientTenantId: string) {
    return this.prisma.income.findMany({
      where: { clientTenantId },
      orderBy: { date: 'desc' },
    });
  }

  async updateIncome(id: string, data: any, clientTenantId: string) {
    return this.prisma.income.update({ where: { id, clientTenantId }, data });
  }

  async removeIncome(id: string, clientTenantId: string) {
    return this.prisma.income.delete({ where: { id, clientTenantId } });
  }

  // ─── GASTOS ───────────────────────────────────────────────────────────────
  async createExpense(data: any, clientTenantId: string) {
    return this.prisma.expense.create({ data: { ...data, clientTenantId } });
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
    const startDate = data.startDate ? new Date(data.startDate) : new Date();

    return this.prisma.recurringExpense.create({
      data: {
        ...data,
        frequency: toEnum(data.frequency || 'MONTHLY') as any,
        startDate,
        endDate: data.endDate ? new Date(data.endDate) : null,
        nextExecutionDate: startDate,
        status: toEnum(data.status || 'ACTIVE') as any,
        clientTenantId,
      },
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
    const updateData: any = {
      ...data,
      ...(data.frequency && { frequency: toEnum(data.frequency) as any }),
      ...(data.status && { status: toEnum(data.status) as any }),
      ...(data.startDate && { startDate: new Date(data.startDate) }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
    };

    if (data.startDate && data.nextExecutionDate === undefined) {
      updateData.nextExecutionDate = new Date(data.startDate);
    } else if (data.nextExecutionDate) {
      updateData.nextExecutionDate = new Date(data.nextExecutionDate);
    }

    return this.prisma.recurringExpense.update({ where: { id, clientTenantId }, data: updateData });
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
    const [income, expenses, invoices] = await Promise.all([
      this.prisma.income.aggregate({
        where: { clientTenantId },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { clientTenantId },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { clientTenantId },
        _sum: { total: true },
      }),
    ]);

    const totalIncome = Number(income._sum.amount ?? 0);
    const totalExpenses = Number(expenses._sum.amount ?? 0);
    const invoiceRevenue = Number(invoices._sum.total ?? 0);

    return {
      totalIncome,
      totalExpenses,
      invoiceRevenue,
      netBalance: totalIncome + invoiceRevenue - totalExpenses,
      generatedAt: new Date().toISOString(),
    };
  }
}
