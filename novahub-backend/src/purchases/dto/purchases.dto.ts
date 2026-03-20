import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsOptional, IsEmail, IsEnum, IsDateString, IsArray, IsNumber } from "class-validator";
import { EntityStatus } from "@prisma/client";

export class CreateSupplierDto {
    @ApiProperty()
    @IsString()
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    taxId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ required: false, enum: EntityStatus, default: EntityStatus.ACTIVE })
    @IsOptional()
    @IsEnum(EntityStatus)
    status?: EntityStatus;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

export class CreatePurchaseOrderDto {
    @ApiProperty()
    @IsString()
    supplierId: string;

    @ApiProperty()
    @IsDateString()
    date: Date;

    @ApiProperty({ type: 'array', items: { type: 'object' } })
    @IsArray()
    items: any[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    currency?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    exchangeRate?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    baseTotal?: number;
}

export class CreatePurchaseReceiptDto {
    @ApiProperty()
    @IsString()
    purchaseOrderId: string;

    @ApiProperty()
    @IsDateString()
    date: Date;

    @ApiProperty({ type: 'array', items: { type: 'object' } })
    @IsArray()
    items: any[];
}

export class CreateSupplierInvoiceDto {
    @ApiProperty()
    @IsString()
    supplierId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    purchaseOrderId?: string;

    @ApiProperty()
    @IsString()
    number: string;

    @ApiProperty()
    @IsDateString()
    date: Date;

    @ApiProperty()
    @IsDateString()
    dueDate: Date;

    @ApiProperty()
    @IsNumber()
    total: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    currency?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    exchangeRate?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    baseTotal?: number;
}
