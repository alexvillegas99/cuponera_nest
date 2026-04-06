import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRolDto {
  @ApiProperty({ example: 'Vendedor' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({ example: 'Rol para vendedores con acceso limitado' })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ example: ['cupones.ver', 'cupones.crear'] })
  @IsArray()
  @IsString({ each: true })
  permisos: string[];

  @ApiPropertyOptional({ example: 'vendedor' })
  @IsString()
  @IsOptional()
  slug?: string;
}
