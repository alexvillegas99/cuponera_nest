import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoPromocionFlash } from '../schema/promocion-flash.schema';

export class CreatePromocionFlashDto {
  @ApiProperty({ example: 'Nuevo: Lomo saltado' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  titulo: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  descripcion?: string;

  /** Imagen en base64 (se sube a S3). Alternativa: imagenUrl ya subida. */
  @ApiProperty({ required: false, description: 'Imagen en base64 o data URL' })
  @IsOptional()
  @IsString()
  imagenBase64?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imagenUrl?: string;

  @ApiProperty({ required: false, enum: TipoPromocionFlash })
  @IsOptional()
  @IsEnum(TipoPromocionFlash)
  tipo?: TipoPromocionFlash;

  @ApiProperty({ required: false, example: 'NUEVO' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  etiqueta?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  precio?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  precioAntes?: number;

  @ApiProperty({ required: false, description: 'ISO date' })
  @IsOptional()
  @IsDateString()
  inicia?: string;

  @ApiProperty({ required: false, description: 'ISO date (máx +7 días)' })
  @IsOptional()
  @IsDateString()
  vence?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  canjeable?: boolean;

  @ApiProperty({ required: false, description: 'Stock total (null = ilimitado)' })
  @IsOptional()
  @IsNumber()
  cupos?: number;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  limitePorCliente?: number;
}
