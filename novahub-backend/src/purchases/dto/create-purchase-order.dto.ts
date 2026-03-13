import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsNumber, IsDate, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreatePurchaseOrderItemDto {
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

export class CreatePurchaseOrderDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    supplierId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    number: string;

    @ApiProperty()
    @IsDate()
    @IsNotEmpty()
    @Type(() => Date)
    date: Date;

    @ApiProperty({ type: [CreatePurchaseOrderItemDto] })
    @ValidateNested({ each: true })
    @Type(() => CreatePurchaseOrderItemDto)
    items: CreatePurchaseOrderItemDto[];
}
