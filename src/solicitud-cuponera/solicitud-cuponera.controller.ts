import { AuthUsuario } from 'src/auth/decorators/auth.decorator';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
  @Auth()
  @ApiOperation({ summary: 'Crear solicitud de cuponera con comprobante' })
  create(@Body() dto: any, @GetUser() user: any) {
    // Un cliente solo puede pedir a su nombre (se ignora el `cliente` del body).
    if (user?.kind === 'CLIENTE') {
      // Campos internos que solo pone el servidor.
      const {
        estado, notaAdmin, cuponId, versionId, cuponRegaloId, comisionAcreditada,
        promotorId, montoComision, montoDescuento, montoFinal, porcentajeComision,
        porcentajeDescuento, _id, ...limpio
      } = dto ?? {};
      return this.service.create({ ...limpio, cliente: String(user._id) });
    }
    if (!(user?.permisos ?? []).includes('solicitudes.aprobar')) {
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }
    return this.service.create(dto);
  }

  @Get()
  @AuthUsuario('solicitudes.ver')
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
  @Auth()
  @ApiOperation({ summary: 'Solicitudes de un cliente' })
  findByCliente(@Param('clienteId') clienteId: string, @GetUser() user: any) {
    // Antes era público: con el id se veían nombre, correo, teléfono y montos.
    const propio = user?.kind === 'CLIENTE' && String(user._id) === String(clienteId);
    const admin =
      user?.kind !== 'CLIENTE' && (user?.permisos ?? []).includes('solicitudes.ver');
    if (!propio && !admin) {
      throw new ForbiddenException('No puedes ver estas solicitudes');
    }
    return this.service.findByCliente(clienteId);
  }

  @Get('admin/sin-cupon')
  @AuthUsuario('solicitudes.aprobar')
  @ApiOperation({ summary: 'Solicitudes aprobadas cuyo cupón no se pudo emitir' })
  sinCupon() {
    return this.service.sinCupon();
  }

  @Post(':id/emitir')
  @AuthUsuario('solicitudes.aprobar')
  @ApiOperation({ summary: 'Reintentar la emisión del cupón (solo si falló)' })
  emitir(@Param('id') id: string) {
    if (!/^[a-f0-9]{24}$/i.test(String(id))) throw new ForbiddenException('Id inválido');
    return this.service.reintentarEmision(id);
  }

  @Get(':id')
  @AuthUsuario('solicitudes.ver')
  @ApiOperation({ summary: 'Detalle de solicitud' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id/estado')
  @AuthUsuario('solicitudes.aprobar')
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
