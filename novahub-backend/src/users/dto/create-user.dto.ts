import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsEmail, IsEnum, IsOptional, IsBoolean, MinLength } from "class-validator";
import { SystemRole } from "@prisma/client";

export class CreateUserDto {
    @ApiProperty({ example: 'uuid-del-tenant', description: 'ID del tenant al que pertenece el usuario' })
    @IsString()
    clientTenantId: string;

    @ApiProperty({ example: 'admin@novahub.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'SuperAdmin123' })
    @IsString()
    @MinLength(8)
    passwordHash: string; // Prisma model uses passwordHash instead of password

    @ApiProperty({ example: 'Juan Pérez' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
    @IsString()
    @IsOptional()
    avatar?: string;

    @ApiProperty({ enum: SystemRole, default: SystemRole.EMPLOYEE })
    @IsEnum(SystemRole)
    @IsOptional()
    role?: SystemRole;

    @ApiProperty({ default: true })
    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}