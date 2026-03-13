import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional, IsNumber } from "class-validator";

export class CreateCategoryDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;
}

export class CreateProductDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    salePrice: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    costPrice?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    taxRate?: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    categoryId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    stock?: number;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class CreateWarehouseDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    parentId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    location?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    responsibleId?: string;
}

export class CreateLotDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    productId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    number: string;

    @ApiProperty({ required: false })
    @IsOptional()
    expirationDate?: Date;
}

export class CreateSeriesDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    productId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    number: string;
}

export class CreateAdjustmentDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    warehouseId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    reason: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({ type: 'array', items: { type: 'object' } })
    @IsNotEmpty()
    items: any[];
}
