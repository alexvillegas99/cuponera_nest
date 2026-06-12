import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  EstadoCampana,
  TipoAccion,
  TipoSegmento,
} from '../schema/campana.schema';

export class CreateCampanaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  titulo: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  cuerpo: string;

  @IsOptional()
  @IsString()
  imagenUrl?: string;

  @IsEnum(TipoSegmento)
  tipoSegmento: TipoSegmento;

  @IsOptional()
  @IsString()
  provinciaId?: string;

  @IsOptional()
  @IsString()
  ciudadId?: string;

  @IsOptional()
  @IsString()
  categoriaId?: string;

  @IsOptional()
  @IsString()
  topicCustom?: string;

  @IsOptional()
  @IsEnum(TipoAccion)
  tipoAccion?: TipoAccion;

  @IsOptional()
  @IsString()
  accionRefId?: string;

  @IsOptional()
  @IsString()
  accionUrl?: string;

  /** Si se omite, se considera envío inmediato (estado=ENVIADA). */
  @IsOptional()
  @IsISO8601()
  programadaPara?: string;

  /** Si true, queda como BORRADOR sin enviar. */
  @IsOptional()
  @IsBoolean()
  guardarBorrador?: boolean;

  /** Si true (default), envía push además de persistir entrega. */
  @IsOptional()
  @IsBoolean()
  enviarPush?: boolean;
}

export class UpdateCampanaDto extends CreateCampanaDto {
  @IsOptional()
  @IsEnum(EstadoCampana)
  estado?: EstadoCampana;
}
