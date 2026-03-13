import { IsString, IsNotEmpty, IsEmail, IsOptional, IsEnum } from 'class-validator';
import { BillingPlanType, IndustryType } from '@prisma/client';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsEnum(BillingPlanType)
  plan?: BillingPlanType;

  @IsOptional()
  @IsEnum(IndustryType)
  industry?: IndustryType;

  // Initial Admin User info
  @IsEmail()
  adminEmail: string;

  @IsString()
  @IsNotEmpty()
  adminName: string;

  @IsOptional()
  @IsString()
  logo?: string;
}
