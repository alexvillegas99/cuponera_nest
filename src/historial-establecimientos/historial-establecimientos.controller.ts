import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators';
import { HistorialEstablecimientosService } from './historial-establecimientos.service';

@ApiTags('Historial Establecimientos')
@Controller('historial-establecimientos')
export class HistorialEstablecimientosController {
  constructor(private readonly svc: HistorialEstablecimientosService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Listar historial de cambios en establecimientos' })
  @ApiQuery({ name: 'estado', required: false, enum: ['pendiente', 'aprobado', 'revertido'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('estado') estado?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '15',
  ) {
    return this.svc.findAll({
      estado,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get('pendientes/count')
  @Auth()
  @ApiOperation({ summary: 'Contar cambios pendientes de revisión' })
  contarPendientes() {
    return this.svc.contarPendientes().then((count) => ({ count }));
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Obtener un registro del historial por ID' })
  findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Patch(':id/aprobar')
  @Auth()
  @ApiOperation({ summary: 'Aprobar cambio — los datos editados se conservan' })
  aprobar(@Param('id') id: string, @GetUser() user: any) {
    return this.svc.aprobar(id, user);
  }

  @Patch(':id/revertir')
  @Auth()
  @ApiOperation({ summary: 'Revertir cambio — restaura los datos anteriores al establecimiento' })
  revertir(@Param('id') id: string, @GetUser() user: any) {
    return this.svc.revertir(id, user);
  }
}
