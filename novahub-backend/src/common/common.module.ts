import { Global, Module } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [ExchangeRateService],
  exports: [ExchangeRateService],
})
export class CommonModule {}
