import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsEmail } from "class-validator";
import { CustomerType, EntityStatus } from "@prisma/client";

export class CreateCustomerDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ enum: CustomerType, default: CustomerType.COMPANY })
    @IsEnum(CustomerType)
    @IsOptional()
    type?: CustomerType;

    @ApiProperty({ required: false })
    @IsEmail()
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
}
