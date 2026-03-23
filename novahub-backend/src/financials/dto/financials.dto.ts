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

    @ApiProperty({ enum: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] })
    @IsEnum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'])
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

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    source?: string;

    @ApiProperty({ required: false, description: 'Alias legacy para source' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    accountId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiProperty({ required: false, enum: ['NIO', 'USD'] })
    @IsOptional()
    @IsString()
    currency?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    exchangeRate?: number;
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

    @ApiProperty({ required: false, enum: ['NIO', 'USD'] })
    @IsOptional()
    @IsString()
    currency?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    exchangeRate?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    reference?: string;
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
