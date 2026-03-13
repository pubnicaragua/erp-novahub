import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsEmail, IsOptional, IsEnum, IsDate } from "class-validator";
import { Type } from "class-transformer";

export class CreateEmployeeDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    employeeCode: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty()
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty()
    @IsDate()
    @IsNotEmpty()
    @Type(() => Date)
    hireDate: Date;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    jobTitle?: string;
}
