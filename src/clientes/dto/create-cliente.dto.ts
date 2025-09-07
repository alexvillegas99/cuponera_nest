// src/clientes/dto/create-cliente.dto.ts
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TipoIdentificacion } from '../schema/cliente.schema';


export class CreateClienteDto {
  @IsString() @MinLength(2)
  nombres: string;

  @IsString() @MinLength(2)
  apellidos: string;

  @IsEnum(TipoIdentificacion)
  tipoIdentificacion: TipoIdentificacion;

  @IsString()
  identificacion: string;

  @IsEmail()
  email: string;

  @IsOptional() @IsString()
  telefono?: string;

  @IsOptional() @IsString()
  direccion?: string;

  @IsOptional()
  fechaNacimiento?: Date;

  // opcional si registras con clave
  @IsOptional() @IsString() @MinLength(6)jkjk
  password?: string;
  
}
