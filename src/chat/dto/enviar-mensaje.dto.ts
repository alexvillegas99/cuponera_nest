import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EnviarMensajeDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  texto?: string;

  /** Base64 (data URL o sin prefijo) de imagen adjunta. */
  @IsOptional()
  @IsString()
  imagenBase64?: string;
}
