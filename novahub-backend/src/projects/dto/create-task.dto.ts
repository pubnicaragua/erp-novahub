import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsDate } from "class-validator";
import { Type } from "class-transformer";
import { Priority, TaskStatus } from "@prisma/client";

export class CreateTaskDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ enum: TaskStatus, default: TaskStatus.PENDING })
    @IsEnum(TaskStatus)
    @IsOptional()
    status?: TaskStatus;

    @ApiProperty({ enum: Priority, default: Priority.MEDIUM })
    @IsEnum(Priority)
    @IsOptional()
    priority?: Priority;

    @ApiProperty({ required: false })
    @IsDate()
    @IsOptional()
    @Type(() => Date)
    dueDate?: Date;
}
