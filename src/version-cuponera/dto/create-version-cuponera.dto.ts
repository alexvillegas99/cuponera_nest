import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVersionCuponeraDto {
  @ApiProperty({
    example: 'Edición Verano 2025',
    description: 'Nombre de la versión de cuponera',
  })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Estado de la edición (activo/inactivo)',
  })
  @IsOptional()
  @IsBoolean()
  estado?: boolean;

  @ApiPropertyOptional({ example: 'Cuponera de verano con descuentos' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ example: '25.00' })
  @IsOptional()
  @IsString()
  precio?: string;

  @ApiPropertyOptional({ example: ['66d63c8f8baf234aa11e9876'] })
  @IsOptional()
  @IsArray()
  ciudadesDisponibles?: string[];

  @ApiPropertyOptional({
    example: ['66d63c8f8baf234aa11e0001'],
    description: 'Provincias completas (se expanden a sus ciudades)',
  })
  @IsOptional()
  @IsArray()
  provinciasDisponibles?: string[];
}
