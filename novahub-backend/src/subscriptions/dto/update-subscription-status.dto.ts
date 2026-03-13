import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma/client';

export class UpdateSubscriptionStatusDto {
  @ApiProperty({ enum: ApprovalStatus, example: 'APPROVED' })
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @ApiProperty({ example: 'Precio acordado con el cliente', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
