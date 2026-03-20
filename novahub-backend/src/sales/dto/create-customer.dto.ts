import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsEmail, IsNumber } from "class-validator";
import { CustomerType, EntityStatus } from "@prisma/client";

export class CreateCustomerDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    code?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ enum: CustomerType, default: CustomerType.COMPANY })
    @IsString()
    @IsOptional()
    type?: CustomerType | string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    email?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    taxId?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    address?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    city?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    country?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    contactName?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    contactEmail?: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    contactPhone?: string;

    @ApiProperty({ required: false })
    @IsNumber()
    @IsOptional()
    creditLimit?: number;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    notes?: string;

    @ApiProperty({ enum: EntityStatus, required: false })
    @IsString()
    @IsOptional()
    status?: EntityStatus | string;
}
