import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsDateString, IsArray } from "class-validator";

export class CreateAccountDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] })
    @IsEnum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
    type: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    parentAccountId?: string;
}

export class CreateIncomeDto {
    @ApiProperty()
    @IsNumber()
    amount: number;

    @ApiProperty()
    @IsDateString()
    date: Date;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    accountId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    customerId?: string;
}

export class CreateExpenseDto {
    @ApiProperty()
    @IsNumber()
    amount: number;

    @ApiProperty()
    @IsDateString()
    date: Date;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    accountId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    supplierId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    category?: string;
}

export class CreateJournalEntryDto {
    @ApiProperty()
    @IsDateString()
    date: Date;

    @ApiProperty()
    @IsString()
    description: string;

    @ApiProperty({ type: 'array', items: { type: 'object' } })
    @IsArray()
    lines: any[];
}
