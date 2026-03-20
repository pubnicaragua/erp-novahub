import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsNumber, IsOptional, ValidateNested, IsArray, IsDateString, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateInvoiceItemDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    productId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    quantity: number;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiProperty({ required: false, default: 0 })
    @IsNumber()
    @Min(0)
    @IsOptional()
    taxRate?: number;

    @ApiProperty({ required: false, default: 0 })
    @IsNumber()
    @Min(0)
    @IsOptional()
    discount?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    total?: number;
}

export class CreateInvoiceDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    number?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    salesOrderId?: string;

    @ApiProperty()
    @IsDateString()
    date: string;

    @ApiProperty({ required: false })
    @IsDateString()
    @IsOptional()
    dueDate?: string;

    @ApiProperty({ type: [CreateInvoiceItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateInvoiceItemDto)
    items: CreateInvoiceItemDto[];

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    subtotal?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    taxAmount?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    discountAmount?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    total?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    amountPaid?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    balance?: number;

    @ApiProperty({ required: false, default: 'NIO' })
    @IsString()
    @IsOptional()
    currency?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    exchangeRate?: number;

    @ApiProperty({ required: false })
    @IsNumber()
    @Min(0)
    @IsOptional()
    baseTotal?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    status?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    notes?: string;
}
