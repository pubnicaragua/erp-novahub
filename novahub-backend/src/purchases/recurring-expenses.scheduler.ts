import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ExpenseStatus,
  Frequency,
  Prisma,
  RecurringExecutionStatus,
  RecurringExpense,
  RecurringStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const MAX_OCCURRENCES_PER_RUN = 24;

function addFrequency(date: Date, frequency: Frequency): Date {
  const next = new Date(date);
  switch (frequency) {
    case Frequency.WEEKLY:
      next.setDate(next.getDate() + 7);
      return next;
    case Frequency.MONTHLY:
      next.setMonth(next.getMonth() + 1);
      return next;
    case Frequency.QUARTERLY:
      next.setMonth(next.getMonth() + 3);
      return next;
    case Frequency.YEARLY:
      next.setFullYear(next.getFullYear() + 1);
      return next;
    default:
      return next;
  }
}

function buildAutoExpenseNumber(recurringExpenseId: string, dueDate: Date): string {
  const ymd = dueDate.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomUUID().slice(0, 4).toUpperCase();
  return `RXP-${ymd}-${recurringExpenseId.slice(0, 6).toUpperCase()}-${suffix}`;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return 'Unknown error while materializing recurring expense';
}

@Injectable()
export class RecurringExpensesScheduler {
  private readonly logger = new Logger(RecurringExpensesScheduler.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'materialize-recurring-expenses' })
  async materializeRecurringExpenses() {
    if (this.isRunning) {
      this.logger.warn('Previous run is still in progress. Skipping this tick.');
      return;
    }

    this.isRunning = true;
    const runDate = new Date();
    let recurringProcessed = 0;
    let expensesCreated = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const recurringExpenses = await this.prisma.recurringExpense.findMany({
        where: {
          status: RecurringStatus.ACTIVE,
          startDate: { lte: runDate },
          nextExecutionDate: { lte: runDate },
          OR: [{ endDate: null }, { endDate: { gte: runDate } }],
        },
        orderBy: { nextExecutionDate: 'asc' },
      });

      recurringProcessed = recurringExpenses.length;

      for (const recurringExpense of recurringExpenses) {
        const result = await this.processRecurringExpense(recurringExpense, runDate);
        expensesCreated += result.created;
        skipped += result.skipped;
        failed += result.failed;
      }

      this.logger.log(
        `Recurring expenses materialized: recurring=${recurringProcessed}, created=${expensesCreated}, skipped=${skipped}, failed=${failed}`,
      );
    } catch (error) {
      this.logger.error(`Failed recurring-expense cron run: ${formatError(error)}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async processRecurringExpense(recurringExpense: RecurringExpense, runDate: Date) {
    let created = 0;
    let skipped = 0;
    let failed = 0;
    let iterations = 0;

    const currentNextExecutionDate = recurringExpense.nextExecutionDate ?? recurringExpense.startDate;
    let nextExecutionDate = new Date(currentNextExecutionDate);

    while (
      nextExecutionDate.getTime() <= runDate.getTime() &&
      (!recurringExpense.endDate || nextExecutionDate.getTime() <= recurringExpense.endDate.getTime()) &&
      iterations < MAX_OCCURRENCES_PER_RUN
    ) {
      const outcome = await this.materializeOccurrence(recurringExpense, nextExecutionDate);

      if (outcome === 'created') created += 1;
      if (outcome === 'skipped') skipped += 1;
      if (outcome === 'failed') {
        failed += 1;
        break;
      }

      nextExecutionDate = addFrequency(nextExecutionDate, recurringExpense.frequency);
      iterations += 1;
    }

    const shouldExpire = !!recurringExpense.endDate && nextExecutionDate.getTime() > recurringExpense.endDate.getTime();
    const shouldUpdateNextExecution =
      nextExecutionDate.getTime() !== currentNextExecutionDate.getTime() || shouldExpire;

    if (shouldUpdateNextExecution) {
      await this.prisma.recurringExpense.update({
        where: { id: recurringExpense.id },
        data: {
          nextExecutionDate,
          ...(shouldExpire && { status: RecurringStatus.EXPIRED }),
        },
      });
    }

    if (iterations === MAX_OCCURRENCES_PER_RUN && nextExecutionDate.getTime() <= runDate.getTime()) {
      this.logger.warn(
        `Recurring expense ${recurringExpense.id} hit max iterations (${MAX_OCCURRENCES_PER_RUN}) in one run.`,
      );
    }

    return { created, skipped, failed };
  }

  private async materializeOccurrence(
    recurringExpense: RecurringExpense,
    dueDate: Date,
  ): Promise<'created' | 'skipped' | 'failed'> {
    const existing = await this.prisma.recurringExpenseExecution.findUnique({
      where: {
        recurringExpenseId_dueDate: {
          recurringExpenseId: recurringExpense.id,
          dueDate,
        },
      },
    });

    if (existing?.status === RecurringExecutionStatus.SUCCESS) {
      return 'skipped';
    }

    const amount = Number(recurringExpense.amount);
    const exchangeRate = Number(recurringExpense.exchangeRate ?? 1);
    const baseAmount =
      recurringExpense.baseAmount !== null && recurringExpense.baseAmount !== undefined
        ? Number(recurringExpense.baseAmount)
        : recurringExpense.currency === 'NIO'
          ? amount
          : amount * exchangeRate;

    try {
      await this.prisma.$transaction(async (tx) => {
        let executionId = existing?.id;

        if (!executionId) {
          const execution = await tx.recurringExpenseExecution.create({
            data: {
              recurringExpenseId: recurringExpense.id,
              clientTenantId: recurringExpense.clientTenantId,
              dueDate,
              status: RecurringExecutionStatus.PENDING,
            },
          });
          executionId = execution.id;
        } else {
          await tx.recurringExpenseExecution.update({
            where: { id: executionId },
            data: {
              status: RecurringExecutionStatus.PENDING,
              error: null,
              executedAt: new Date(),
            },
          });
        }

        const expense = await tx.expense.create({
          data: {
            number: buildAutoExpenseNumber(recurringExpense.id, dueDate),
            accountId: recurringExpense.accountId,
            supplierId: recurringExpense.supplierId,
            date: dueDate,
            amount,
            currency: recurringExpense.currency,
            exchangeRate,
            baseAmount,
            category: recurringExpense.category || 'OTROS',
            description: recurringExpense.description,
            reference: `AUTO-REXP:${recurringExpense.id}:${dueDate.toISOString().slice(0, 10)}`,
            status: ExpenseStatus.PENDING,
            clientTenantId: recurringExpense.clientTenantId,
          },
        });

        await tx.recurringExpenseExecution.update({
          where: { id: executionId },
          data: {
            status: RecurringExecutionStatus.SUCCESS,
            expenseId: expense.id,
            executedAt: new Date(),
            error: null,
          },
        });
      });

      return 'created';
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return 'skipped';
      }

      const errorMessage = formatError(error);
      this.logger.error(
        `Failed materializing recurring expense ${recurringExpense.id} for ${dueDate.toISOString()}: ${errorMessage}`,
      );

      try {
        const current = await this.prisma.recurringExpenseExecution.findUnique({
          where: {
            recurringExpenseId_dueDate: {
              recurringExpenseId: recurringExpense.id,
              dueDate,
            },
          },
        });

        if (!current) {
          await this.prisma.recurringExpenseExecution.create({
            data: {
              recurringExpenseId: recurringExpense.id,
              clientTenantId: recurringExpense.clientTenantId,
              dueDate,
              status: RecurringExecutionStatus.FAILED,
              error: errorMessage,
            },
          });
        } else if (current.status !== RecurringExecutionStatus.SUCCESS) {
          await this.prisma.recurringExpenseExecution.update({
            where: { id: current.id },
            data: {
              status: RecurringExecutionStatus.FAILED,
              error: errorMessage,
              executedAt: new Date(),
            },
          });
        }
      } catch (logError) {
        this.logger.error(`Failed writing recurring-expense execution log: ${formatError(logError)}`);
      }

      return 'failed';
    }
  }
}
