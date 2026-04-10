import { IsNotEmpty, IsMongoId, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHistoricoCuponDto {
  @ApiProperty({ example: '64fab456ddc0c9d1ed5a9e8', description: 'ID del cupón escaneado' })
  @IsNotEmpty()
  @IsMongoId()
  cupon: string;

  @ApiProperty({ example: '64fab4c1ddc0c9d1ed5a9f0', description: 'ID del admin-local responsable (para validación y anti-duplicado)' })
  @IsNotEmpty()
  @IsMongoId()
  usuario: string;

  @ApiProperty({ example: '64fab4c1ddc0c9d1ed5a9f1', description: 'ID del usuario que físicamente escaneó el QR', required: false })
  @IsOptional()
  @IsMongoId()
  escaneadoPor?: string;
}
