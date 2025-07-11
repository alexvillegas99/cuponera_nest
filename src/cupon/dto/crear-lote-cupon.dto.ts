import { IsMongoId, IsNumber, Min, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CrearLoteCuponDto {
  @ApiProperty({ example: '64fa8b345ddc0c9d1ed5a9e2' })
  @IsMongoId()
  versionId: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  cantidad: number;


}
