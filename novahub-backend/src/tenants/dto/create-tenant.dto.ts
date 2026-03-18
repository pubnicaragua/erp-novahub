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
  @IsString()
  plan?: string;

  @IsOptional()
  @IsString()
  industry?: string;

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
