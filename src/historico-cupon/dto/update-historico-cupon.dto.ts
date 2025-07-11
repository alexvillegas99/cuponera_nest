import { PartialType } from '@nestjs/swagger';
import { CreateHistoricoCuponDto } from './create-historico-cupon.dto';

export class UpdateHistoricoCuponDto extends PartialType(CreateHistoricoCuponDto) {}
