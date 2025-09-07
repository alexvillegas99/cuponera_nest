// dto/upload-base64-image.dto.ts
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadBase64ImageDto {
  @IsString() @IsNotEmpty()
  image!: string; // puede ser data URL o base64 puro

  @IsOptional() @IsString() @MaxLength(200)
  route?: string; // carpeta lógica p.ej. 'cupones/2025'
}
