import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsNumber, IsDate, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreateInvoiceItemDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    quantity: number;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    unitPrice: number;
}

export class CreateInvoiceDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    number: string;

    @ApiProperty()
    @IsDate()
    @IsNotEmpty()
    @Type(() => Date)
    date: Date;

    @ApiProperty()
    @IsDate()
    @IsNotEmpty()
    @Type(() => Date)
    dueDate: Date;

    @ApiProperty({ type: [CreateInvoiceItemDto] })
    @ValidateNested({ each: true })
    @Type(() => CreateInvoiceItemDto)
    items: CreateInvoiceItemDto[];
}
