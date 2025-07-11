import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVersionCuponeraDto {
  @ApiProperty({
    example: 'Edición Verano 2025',
    description: 'Nombre de la versión de cuponera',
  })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({
    example: true,
    description: 'Estado de la edición (activo/inactivo)',
  })
  @IsOptional()
  @IsBoolean()
  estado: boolean;

  @ApiProperty({
    example: 5,
    description: 'Número de veces que un cupón puede ser escaneado',
  })
  @IsNumber()
  @Min(1)
  numeroDeLocales: number;
}
