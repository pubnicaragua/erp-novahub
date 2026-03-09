import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsNumber, IsDate, IsEnum, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreateVentaItemDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    descripcion: string;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    cantidad: number;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    precioUnitario: number;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    descuento?: number;
}

export class CreateVentaDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    clienteId: string;

    @ApiProperty()
    @IsDate()
    @IsNotEmpty()
    fecha: Date;

    @ApiProperty()
    @IsDate()
    @IsOptional()
    fechaEntrega?: Date;

    @ApiProperty()
    @IsEnum(['PENDIENTE', 'CONFIRMADA', 'EN_PROGRESO', 'ENVIADA', 'CANCELADA'])
    @IsOptional()
    estado?: string;

    @ApiProperty({ type: [CreateVentaItemDto] })
    @ValidateNested({ each: true })
    @Type(() => CreateVentaItemDto)
    items: CreateVentaItemDto[];
}
