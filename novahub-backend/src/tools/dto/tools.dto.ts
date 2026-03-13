import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsOptional, IsEnum, IsDateString, IsNotEmpty } from "class-validator";

export class CreateTicketDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    subject: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    description: string;

    @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], default: 'MEDIUM' })
    @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    @IsOptional()
    priority?: string;

    @ApiProperty({ enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], required: false })
    @IsOptional()
    @IsEnum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
    status?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    assignedToId?: string;
}

export class UpdateTicketDto extends PartialType(CreateTicketDto) {}

export class CreateDocumentDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    url?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    folderId?: string;
}

export class CreateActivityDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty()
    @IsDateString()
    dueDate: string;

    @ApiProperty({ enum: ['MEETING', 'CALL', 'EMAIL', 'TASK', 'OTHER'] })
    @IsEnum(['MEETING', 'CALL', 'EMAIL', 'TASK', 'OTHER'])
    type: string;

    @ApiProperty({ enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], required: false })
    @IsOptional()
    @IsEnum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
    status?: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    assignedToId: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    relatedTo?: string;
}
