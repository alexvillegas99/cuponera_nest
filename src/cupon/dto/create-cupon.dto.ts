import {
  IsNotEmpty,
  IsBoolean,
  IsNumber,
  Min,
  IsMongoId,
  IsDateString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EstadoCupon } from '../enum/estados_cupon';

export class CreateCuponDto {
  @ApiProperty({
    example: '64fa8b345ddc0c9d1ed5a9e2',
    description: 'ID de la versión/cuponera',
  })
  @IsNotEmpty()
  @IsMongoId()
  version: string;

  @ApiProperty({
    example: 1,
    description: 'Número secuencial dentro de la cuponera',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  secuencial: number;

  @ApiProperty({
    example: EstadoCupon.INACTIVO,
    enum: EstadoCupon,
    description: 'Estado del cupón: inactivo, activo o bloqueado',
  })
    @IsOptional()
  @IsEnum(EstadoCupon)
  estado: EstadoCupon;

  @ApiProperty({
    example: '2025-07-01T00:00:00Z',
    description: 'Fecha desde la cual el cupón es válido (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  fechaActivacion?: string;

  @ApiProperty({
    example: '2025-07-31T23:59:59Z',
    description: 'Fecha de vencimiento del cupón (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @ApiProperty({
    example: '64fab4c1ddc0c9d1ed5a9f0',
    required: false,
    description: 'ID del usuario que activó el cupón',
  })
  @IsOptional()
  @IsMongoId()
  usuarioActivador?: string;
}
