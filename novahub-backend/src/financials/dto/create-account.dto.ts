import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsEnum, IsOptional } from "class-validator";
import { AccountType } from "@prisma/client";

export class CreateAccountDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ enum: AccountType })
    @IsEnum(AccountType)
    @IsNotEmpty()
    type: AccountType;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;
}
