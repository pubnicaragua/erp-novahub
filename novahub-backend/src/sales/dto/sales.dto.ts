import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsDateString, IsOptional, IsArray, IsNumber } from "class-validator";
import { CreateCustomerDto } from "./create-customer.dto";

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class CreateEstimateDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @ApiProperty()
    @IsDateString()
    date: Date;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsDateString()
    expiryDate?: Date;

    @ApiProperty({ type: 'array', items: { type: 'object' } })
    @IsArray()
    items: any[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;
}

export class CreateSalesOrderDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    customerId: string;

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
}

export class CreatePaymentDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    invoiceId: string;

    @ApiProperty()
    @IsNumber()
    amount: number;

    @ApiProperty()
    @IsDateString()
    date: Date;

    @ApiProperty()
    @IsString()
    paymentMethod: string;
}
