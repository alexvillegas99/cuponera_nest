import { PartialType } from '@nestjs/swagger';
import { CreateVersionCuponeraDto } from './create-version-cuponera.dto';

export class UpdateVersionCuponeraDto extends PartialType(CreateVersionCuponeraDto) {}
