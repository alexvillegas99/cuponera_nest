import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service';
import { Auth } from 'src/auth/decorators/auth.decorator';

@ApiTags('Auditoría')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly service: AuditoriaService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Buscar logs de auditoría con filtros' })
  buscar(
    @Query('modulo') modulo?: string,
    @Query('accion') accion?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('severidad') severidad?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.service.buscar({
      modulo,
      accion,
      usuarioId,
      severidad,
      desde,
      hasta,
      page: Number(page),
      limit: Number(limit),
    });
  }
}
