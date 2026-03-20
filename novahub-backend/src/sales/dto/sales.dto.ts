import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsDateString, IsOptional, IsArray, IsNumber, ValidateNested, Min, IsEnum } from "class-validator";
import { Type } from "class-transformer";
import { CreateCustomerDto } from "./create-customer.dto";

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

// ─── ESTIMATE ────────────────────────────────────────────────────────────

export class CreateEstimateItemDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    productId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    quantity: number;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiProperty({ required: false, default: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    taxRate?: number;

    @ApiProperty({ required: false, default: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    discount?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;
}

export class CreateEstimateDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @ApiProperty()
    @IsDateString()
    date: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    expiryDate?: string;

    @ApiProperty({ type: [CreateEstimateItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateEstimateItemDto)
    items: CreateEstimateItemDto[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    number?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    currency?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    subtotal?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    taxAmount?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    discountAmount?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    exchangeRate?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    baseTotal?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;
}

// ─── SALES ORDER ─────────────────────────────────────────────────────────

export class CreateSalesOrderItemDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    productId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    quantity: number;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiProperty({ required: false, default: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    taxRate?: number;

    @ApiProperty({ required: false, default: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    discount?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;
}

export class CreateSalesOrderDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @ApiProperty()
    @IsDateString()
    date: string;

    @ApiProperty({ type: [CreateSalesOrderItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSalesOrderItemDto)
    items: CreateSalesOrderItemDto[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    number?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    currency?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    subtotal?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    taxAmount?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    discountAmount?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    exchangeRate?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    baseTotal?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;
}

// ─── PAYMENT RECEIVED ────────────────────────────────────────────────────

export class CreatePaymentDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    invoiceId?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    number?: string;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    amount: number;

    @ApiProperty()
    @IsDateString()
    date: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    method: string;

    @ApiProperty({ required: false, default: 'NIO' })
    @IsString()
    @IsOptional()
    currency?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    exchangeRate?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    baseAmount?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    reference?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    notes?: string;
}

// ─── RECURRING INVOICE ───────────────────────────────────────────────────

export class CreateRecurringInvoiceItemDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    productId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    quantity: number;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiProperty({ required: false, default: 0 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    taxRate?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;
}

export class CreateRecurringInvoiceDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    frequency: string;

    @ApiProperty()
    @IsDateString()
    startDate: string;

    @ApiProperty({ required: false })
    @IsDateString()
    @IsOptional()
    endDate?: string;

    @ApiProperty({ required: false })
    @IsDateString()
    @IsOptional()
    nextInvoiceDate?: string;

    @ApiProperty({ type: [CreateRecurringInvoiceItemDto], required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateRecurringInvoiceItemDto)
    @IsOptional()
    items?: CreateRecurringInvoiceItemDto[];

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    subtotal?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    taxAmount?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;

    @ApiProperty({ required: false, default: 'NIO' })
    @IsString()
    @IsOptional()
    currency?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    exchangeRate?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    baseTotal?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    status?: string;
}

// ─── SALES RETURN ────────────────────────────────────────────────────────

export class CreateSalesReturnItemDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    productId?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    quantity: number;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;
}

export class CreateSalesReturnDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    invoiceId: string;

    @ApiProperty()
    @IsDateString()
    date: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    reason: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    number?: string;

    @ApiProperty({ type: [CreateSalesReturnItemDto], required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSalesReturnItemDto)
    @IsOptional()
    items?: CreateSalesReturnItemDto[];

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    status?: string;
}

// ─── CREDIT NOTE ─────────────────────────────────────────────────────────

export class CreateCreditNoteItemDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    quantity: number;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;
}

export class CreateCreditNoteDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    invoiceId?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    salesReturnId?: string;

    @ApiProperty()
    @IsDateString()
    date: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    reason: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    number?: string;

    @ApiProperty({ type: [CreateCreditNoteItemDto], required: false })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateCreditNoteItemDto)
    @IsOptional()
    items?: CreateCreditNoteItemDto[];

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    status?: string;
}
