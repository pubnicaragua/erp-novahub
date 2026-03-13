import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEnum } from "class-validator";
import { ProductType } from "@prisma/client";

export class CreateProductDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ enum: ProductType, default: ProductType.PRODUCT })
    @IsEnum(ProductType)
    @IsOptional()
    type?: ProductType;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    price: number;
}
