import { IsNotEmpty, IsMongoId, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHistoricoCuponDto {
  @ApiProperty({ example: '64fab456ddc0c9d1ed5a9e8', description: 'ID del cupón escaneado' })
  @IsNotEmpty()
  @IsMongoId()
  cupon: string;

  @ApiProperty({ example: '64fab4c1ddc0c9d1ed5a9f0', description: 'ID del usuario que escaneó el cupón' })
  @IsNotEmpty()
  @IsMongoId()
  usuario: string;


}
