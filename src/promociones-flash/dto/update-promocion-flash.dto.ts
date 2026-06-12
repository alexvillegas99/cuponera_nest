import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreatePromocionFlashDto } from './create-promocion-flash.dto';
import { EstadoPromocionFlash } from '../schema/promocion-flash.schema';

export class UpdatePromocionFlashDto extends PartialType(
  CreatePromocionFlashDto,
) {
  /** Permite pausar/reactivar (ACTIVA | PAUSADA). */
  @IsOptional()
  @IsEnum(EstadoPromocionFlash)
  estado?: EstadoPromocionFlash;
}
