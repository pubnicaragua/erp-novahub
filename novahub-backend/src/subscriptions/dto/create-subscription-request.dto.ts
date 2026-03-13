import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionRequestDto {
  @ApiProperty({ example: 'uuid-client-tenant', description: 'ID del Tenant Cliente' })
  @IsString()
  clientTenantId: string;

  @ApiProperty({ example: 'SALES', description: 'Módulo solicitado' })
  @IsString()
  requestedModule: string;

  @ApiProperty({ example: 49.99, description: 'Precio personalizado propuesto', required: false })
  @IsOptional()
  @IsNumber()
  customPrice?: number;

  @ApiProperty({ example: 'Solicitud para habilitar ventas', description: 'Notas adicionales', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
