import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsString, IsOptional, IsEnum, IsDateString, IsNotEmpty, IsNumber } from "class-validator";

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
    @ApiProperty({ required: false, description: 'Nombre del documento (preferido)' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ required: false, description: 'Alias legacy para name' })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    mimeType?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    url?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    size?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    folder?: string;

    @ApiProperty({ required: false, description: 'Alias legacy para folder' })
    @IsOptional()
    @IsString()
    folderId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    uploadedById?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    projectId?: string;
}

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}

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
