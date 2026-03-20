import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsOptional, IsEmail, IsEnum, IsDateString, IsArray, IsNumber, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { EntityStatus, PaymentMethod } from "@prisma/client";

// --- SUPPLIERS ---
export class CreateSupplierDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    code?: string;

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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    country?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    contactName?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    contact?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    paymentTerms?: string;

    @ApiProperty({ required: false, enum: EntityStatus, default: EntityStatus.ACTIVE })
    @IsOptional()
    @IsEnum(EntityStatus)
    status?: EntityStatus;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

// --- COMMON ITEM DTO ---
export class CreatePurchaseOrderItemDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    productId?: string;

    @ApiProperty()
    @IsString()
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
    taxRate?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;
}

// --- PURCHASE ORDERS ---
export class CreatePurchaseOrderDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    number?: string;

    @ApiProperty()
    @IsString()
    supplierId: string;

    @ApiProperty()
    @IsDateString()
    date: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    expectedDelivery?: string;

    @ApiProperty({ type: [CreatePurchaseOrderItemDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreatePurchaseOrderItemDto)
    items?: CreatePurchaseOrderItemDto[];

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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
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

    @ApiProperty()
    @IsString()
    requestedBy: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    status?: string;
}

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {}

// --- PURCHASE RECEIPTS ---
export class CreatePurchaseReceiptItemDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    productId?: string;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    quantityOrdered: number;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    quantityReceived: number;
}

export class CreatePurchaseReceiptDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    number?: string;

    @ApiProperty()
    @IsString()
    purchaseOrderId: string;

    @ApiProperty()
    @IsString()
    supplierId: string;

    @ApiProperty()
    @IsDateString()
    date: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({ type: [CreatePurchaseReceiptItemDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreatePurchaseReceiptItemDto)
    items?: CreatePurchaseReceiptItemDto[];
}

export class UpdatePurchaseReceiptDto extends PartialType(CreatePurchaseReceiptDto) {}

// --- SUPPLIER INVOICES ---
export class CreateSupplierInvoiceItemDto {
    @ApiProperty()
    @IsString()
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
    taxRate?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;
}

export class CreateSupplierInvoiceDto {
    @ApiProperty()
    @IsString()
    supplierId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    purchaseOrderId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    number?: string;

    @ApiProperty()
    @IsDateString()
    date: string;

    @ApiProperty()
    @IsDateString()
    dueDate: string;

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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
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
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    paymentStatus?: string;

    @ApiProperty({ type: [CreateSupplierInvoiceItemDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSupplierInvoiceItemDto)
    items?: CreateSupplierInvoiceItemDto[];
}

export class UpdateSupplierInvoiceDto extends PartialType(CreateSupplierInvoiceDto) {}

// --- RECURRING SUPPLIER INVOICES ---
export class CreateRecurringSupplierInvoiceItemDto {
    @ApiProperty()
    @IsString()
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

export class CreateRecurringSupplierInvoiceDto {
    @ApiProperty()
    @IsString()
    supplierId: string;

    @ApiProperty()
    @IsString()
    frequency: string;

    @ApiProperty()
    @IsDateString()
    startDate: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiProperty()
    @IsDateString()
    nextInvoiceDate: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
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
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({ type: [CreateRecurringSupplierInvoiceItemDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateRecurringSupplierInvoiceItemDto)
    items?: CreateRecurringSupplierInvoiceItemDto[];
}

export class UpdateRecurringSupplierInvoiceDto extends PartialType(CreateRecurringSupplierInvoiceDto) {}

// --- PAYMENTS MADE ---
export class CreatePaymentMadeDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    number?: string;

    @ApiProperty()
    @IsString()
    supplierId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    supplierInvoiceId?: string;

    @ApiProperty()
    @IsDateString()
    date: string;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    amount: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
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

    @ApiProperty({ enum: PaymentMethod })
    @IsEnum(PaymentMethod)
    method: PaymentMethod;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    reference?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdatePaymentMadeDto extends PartialType(CreatePaymentMadeDto) {}

// --- SUPPLIER CREDITS ---
export class CreateSupplierCreditItemDto {
    @ApiProperty()
    @IsString()
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

export class CreateSupplierCreditDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    number?: string;

    @ApiProperty()
    @IsString()
    supplierId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    supplierInvoiceId?: string;

    @ApiProperty()
    @IsDateString()
    date: string;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    total: number;

    @ApiProperty()
    @IsString()
    reason: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({ type: [CreateSupplierCreditItemDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateSupplierCreditItemDto)
    items?: CreateSupplierCreditItemDto[];
}

export class UpdateSupplierCreditDto extends PartialType(CreateSupplierCreditDto) {}

// --- EXPENSES ---
export class CreateExpenseDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    number?: string;

    @ApiProperty()
    @IsString()
    accountId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    supplierId?: string;

    @ApiProperty()
    @IsDateString()
    date: string;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    amount: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
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

    @ApiProperty()
    @IsString()
    category: string;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    reference?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    status?: string;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

// --- RECURRING EXPENSES ---
export class CreateRecurringExpenseDto {
    @ApiProperty()
    @IsString()
    accountId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    supplierId?: string;

    @ApiProperty()
    @IsString()
    frequency: string;

    @ApiProperty()
    @IsDateString()
    startDate: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    amount: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
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
    @IsOptional()
    @IsString()
    category?: string;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    status?: string;
}

export class UpdateRecurringExpenseDto extends PartialType(CreateRecurringExpenseDto) {}
