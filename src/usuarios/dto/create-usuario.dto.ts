import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RolUsuario } from '../enums/roles.enum';

export class CreateUsuarioDto {
  @ApiProperty({
    example: 'Juan Pérez',
    description: 'Nombre completo del usuario',
  })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({
    example: 'juan.perez@correo.com',
    description: 'Correo electrónico del usuario',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Cédula o RUC del usuario',
  })
  @IsNotEmpty()
  @IsString()
  identificacion: string;

  @ApiProperty({ example: 'admin', enum: RolUsuario })
  @IsOptional()
  @IsEnum(RolUsuario)
  rol: RolUsuario;

  @ApiProperty({
    example: true,
    description: 'Estado del usuario (activo/inactivo)',
  })
  @IsOptional()
  @IsBoolean()
  estado: boolean;
}
