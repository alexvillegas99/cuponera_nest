import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { SolicitudCuponeraService } from './solicitud-cuponera.service';

@ApiTags('Solicitudes Cuponera')
@Controller('solicitudes-cuponera')
export class SolicitudCuponeraController {
  constructor(
    private readonly service: SolicitudCuponeraService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear solicitud de cuponera con comprobante' })
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Get()
  @Auth()
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
  @Auth()
  @ApiOperation({ summary: 'Detalle de solicitud' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id/estado')
  @Auth()
  @ApiOperation({ summary: 'Aprobar o rechazar solicitud' })
  async updateEstado(
    @Param('id') id: string,
    @Body() body: { estado: string; notaAdmin?: string },
    @GetUser() user: any,
  ) {
    const result = await this.service.updateEstado(id, body.estado as any, body.notaAdmin);
    this.auditoria.registrarDesdeUsuario(user, {
      accion: `solicitud.${body.estado.toLowerCase()}`,
      modulo: 'solicitudes',
      descripcion: `Solicitud ${body.estado}: ${id}`,
      recursoId: id,
      recursoTipo: 'SolicitudCuponera',
      datosNuevos: { estado: body.estado, notaAdmin: body.notaAdmin },
      severidad: 'critical',
    });
    return result;
  }
}
