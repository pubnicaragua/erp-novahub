import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ToolsService } from './tools.service';

@Injectable()
export class TicketsSlaScheduler {
  private readonly logger = new Logger(TicketsSlaScheduler.name);
  private isRunning = false;

  constructor(private readonly toolsService: ToolsService) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'ticket-sla-checker' })
  async execute() {
    if (this.isRunning) {
      this.logger.warn('Ticket SLA scheduler run skipped: previous run still active');
      return;
    }

    this.isRunning = true;

    try {
      const result = await this.toolsService.runTicketSlaChecks();
      this.logger.log(
        `Ticket SLA check completed: scanned=${result.scanned}, reminders=${result.reminders}, breaches=${result.breaches}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SLA scheduler error';
      this.logger.error(`Ticket SLA scheduler failed: ${message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
