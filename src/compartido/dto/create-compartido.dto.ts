// src/compartidos/dto/create-compartido.dto.ts
import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { CanalCompartir } from '../enum/canal.enum';

export class CreateCompartidoDto {
  @IsMongoId() clienteId!: string;
  @IsMongoId() usuarioId!: string;

  @IsEnum(CanalCompartir)
  canal!: CanalCompartir;

  @IsOptional()
  @IsString()
  telefonoDestino?: string;

  @IsOptional()
  @IsString()
  mensaje?: string;

  @IsOptional()
  @IsString()
  origen?: 'comercio' | 'cupon';

  @IsOptional()
  @IsMongoId()
  origenId?: string;
}

export class ResumenCompartidosDto {
  total!: number;
  porCanal!: Record<string, number>;
}
