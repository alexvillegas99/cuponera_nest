import { IsMongoId, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivarCuponDto {
  @ApiProperty({ example: '64fabcd123abc123abc123ab' })
  @IsMongoId()
  versionId: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  secuencial: number;

  @ApiProperty({ example: '64fa123456abcdef65432100' })
  @IsMongoId()
  usuarioId: string;
}
