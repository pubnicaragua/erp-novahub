import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ModuleType } from '@prisma/client';

export class ToggleModuleSubscriptionDto {
  @ApiProperty({ example: 'b7f0a0c2-aaaa-bbbb-cccc-1234567890ab' })
  @IsString()
  clientTenantId: string;

  @ApiProperty({ enum: ModuleType, example: 'FINANCIAL' })
  @IsEnum(ModuleType)
  module: ModuleType;

  @ApiProperty({ example: false })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ required: false, example: 'Desactivación directa por Super Admin' })
  @IsOptional()
  @IsString()
  notes?: string;
}
