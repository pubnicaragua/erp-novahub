import { Module } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { TicketsSlaScheduler } from './tickets-sla.scheduler';

@Module({
  providers: [ToolsService, TicketsSlaScheduler],
  controllers: [ToolsController]
})
export class ToolsModule {}
