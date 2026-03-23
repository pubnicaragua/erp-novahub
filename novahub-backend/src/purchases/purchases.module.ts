import { Module } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RecurringExpensesScheduler } from './recurring-expenses.scheduler';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [PurchasesService, RecurringExpensesScheduler],
  controllers: [PurchasesController],
  exports: [PurchasesService]
})
export class PurchasesModule {}
