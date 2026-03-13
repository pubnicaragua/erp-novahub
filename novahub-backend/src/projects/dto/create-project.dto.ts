import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional, IsDate, IsNumber } from "class-validator";
import { Type } from "class-transformer";

export class CreateProjectDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty()
    @IsDate()
    @IsNotEmpty()
    @Type(() => Date)
    startDate: Date;

    @ApiProperty({ required: false })
    @IsDate()
    @IsOptional()
    @Type(() => Date)
    endDate?: Date;

    @ApiProperty({ default: 0 })
    @IsNumber()
    @IsOptional()
    budget?: number;
}
