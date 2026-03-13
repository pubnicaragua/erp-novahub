import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional, IsEnum } from "class-validator";
import { Priority } from "@prisma/client";

export class CreateTicketDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    subject: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    customerId: string;

    @ApiProperty({ enum: Priority, default: Priority.MEDIUM })
    @IsEnum(Priority)
    @IsOptional()
    priority?: Priority;
}
