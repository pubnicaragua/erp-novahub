import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly DEFAULT_RATE = 36.5;

  constructor(private prisma: PrismaService) {}

  /**
   * Obtiene la tasa de cambio vigente para un tenant.
   * Si está en modo automático, intenta obtenerla del BCN (o caché).
   * Si está en modo manual, la busca en SystemSettings.
   */
  async getExchangeRate(clientTenantId: string): Promise<number> {
    // Buscamos si el modo automático está activo en SystemSettings
    const setting = await this.prisma.systemSetting.findFirst({
      where: {
        clientTenantId,
        group: 'FINANCY',
        key: 'exchange_rate_auto'
      }
    });

    const isAuto = setting ? setting.value === 'true' : true; // Por defecto automático

    if (isAuto) {
      return this.getAutomaticRate();
    }

    return this.getManualRate(clientTenantId);
  }

  /**
   * Obtiene la tasa manual guardada en la configuración del sistema.
   */
  private async getManualRate(clientTenantId: string): Promise<number> {
    const setting = await this.prisma.systemSetting.findFirst({
      where: {
        clientTenantId,
        group: 'FINANCY',
        key: 'manual_exchange_rate'
      }
    });

    return setting ? parseFloat(setting.value) : this.DEFAULT_RATE;
  }

  /**
   * Lógica para obtener la tasa del BCN (Simulada por ahora, o fetch real)
   */
  private async getAutomaticRate(): Promise<number> {
    try {
      // TODO: Implementar scraping o API del BCN
      // Por ahora devolvemos un valor aproximado o el default
      return this.DEFAULT_RATE; 
    } catch (error) {
      this.logger.error('Error fetching rate from BCN', error);
      return this.DEFAULT_RATE;
    }
  }

  /**
   * Actualiza la tasa manual para un tenant.
   */
  async updateManualRate(clientTenantId: string, rate: number) {
    const setting = await this.prisma.systemSetting.findFirst({
      where: { clientTenantId, key: 'manual_exchange_rate' }
    });

    if (setting) {
      return this.prisma.systemSetting.update({
        where: { id: setting.id },
        data: { value: rate.toString() }
      });
    } else {
      return this.prisma.systemSetting.create({
        data: {
          clientTenantId,
          group: 'FINANCY',
          key: 'manual_exchange_rate',
          value: rate.toString()
        }
      });
    }
  }
}
