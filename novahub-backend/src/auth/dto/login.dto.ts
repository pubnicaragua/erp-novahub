import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class LoginDto {
    @ApiProperty({ example: 'admin@novahub.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'SecurePass123' })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;
}
