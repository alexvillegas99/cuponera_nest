import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SolicitudCuponeraService } from './solicitud-cuponera.service';

@ApiTags('Solicitudes Cuponera')
@Controller('solicitudes-cuponera')
export class SolicitudCuponeraController {
  constructor(private readonly service: SolicitudCuponeraService) {}

  @Post()
  @ApiOperation({ summary: 'Crear solicitud de cuponera con comprobante' })
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar solicitudes (admin)' })
  findAll(
    @Query('estado') estado?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.findAll({
      estado,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get('cliente/:clienteId')
  @ApiOperation({ summary: 'Solicitudes de un cliente' })
  findByCliente(@Param('clienteId') clienteId: string) {
    return this.service.findByCliente(clienteId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de solicitud' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Aprobar o rechazar solicitud' })
  updateEstado(
    @Param('id') id: string,
    @Body() body: { estado: string; notaAdmin?: string },
  ) {
    return this.service.updateEstado(id, body.estado as any, body.notaAdmin);
  }
}
