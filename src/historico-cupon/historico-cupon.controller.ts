import { Controller, Post, Body, Get, Query, Param, Logger, ForbiddenException } from '@nestjs/common';
import { HistoricoCuponService } from './historico-cupon.service';
import { CreateHistoricoCuponDto } from './dto/create-historico-cupon.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Auth, AuthUsuario } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators';

@ApiTags('Histórico de Cupones')
@Controller('historico')
export class HistoricoCuponController {
  private readonly logger = new Logger(HistoricoCuponController.name);
  constructor(private readonly historicoService: HistoricoCuponService) {}

  /**
   * El canje y sus datos solo los ve/registra el personal de ESE local.
   * admin (o rol global con establecimientos.ver) → cualquier local.
   */
  private esLecturaGlobal(user: any) {
    const rol = String(user?.rol ?? '').toLowerCase();
    return (
      rol === 'admin' ||
      (rol !== 'admin-local' && rol !== 'staff' && (user?.permisos ?? []).includes('establecimientos.ver'))
    );
  }

  /**
   * escritura=true (canjear/validar): solo admin puede hacerlo en cualquier
   * local; un permiso de lectura (p. ej. vendedor) no habilita canjear.
   */
  private async assertMismoLocal(user: any, usuarioLocalId: string, escritura = false) {
    const rol = String(user?.rol ?? '').toLowerCase();
    const global = escritura ? rol === 'admin' : this.esLecturaGlobal(user);
    if (global) return;
    if (!usuarioLocalId) throw new ForbiddenException('Falta el local');
    const miLocal = rol === 'staff' && user?.usuarioCreacion ? String(user.usuarioCreacion) : String(user?._id);
    const suLocal = await this.historicoService.localRaiz(usuarioLocalId).catch(() => null);
    if (!suLocal || suLocal !== miLocal) {
      throw new ForbiddenException('Este cupón se gestiona desde otro local');
    }
  }

  @Post()
  @AuthUsuario()
  @ApiOperation({ summary: 'Registrar un escaneo de cupón' })
  @ApiResponse({ status: 201, description: 'Escaneo registrado correctamente' })
  @ApiResponse({
    status: 400,
    description: 'Escaneo inválido o excede el límite',
  })
  async registrarEscaneo(@Body() dto: CreateHistoricoCuponDto, @GetUser() user: any) {
    await this.assertMismoLocal(user, dto.usuario, true);
    // Quién escaneó lo dice la sesión, no el body.
    return this.historicoService.registrarEscaneo({ ...dto, escaneadoPor: String(user._id) });
  }

  @Get()
  @AuthUsuario()
  @ApiOperation({ summary: 'Listar historial de escaneos' })
  findAll(@GetUser() user: any) {
    if (!this.esLecturaGlobal(user)) throw new ForbiddenException('Solo administración');
    return this.historicoService.findAll();
  }

  //por fecha inicio, fecha fin
  @Get('buscar-por-fechas')
  @AuthUsuario()
  @ApiOperation({ summary: 'Buscar historial por fechas' })
  @ApiResponse({ status: 200, description: 'Historial encontrado' })
  @ApiResponse({ status: 404, description: 'No se encontraron registros' })
  buscarPorFechas(
    @Query('inicio') inicio: string,
    @Query('fin') fin: string,
    @Query('secuencial') secuencial?: string,
    @GetUser() user?: any,
  ) {
    if (!this.esLecturaGlobal(user)) throw new ForbiddenException('Solo administración');
    console.log('Buscar por fechas:', inicio, fin, secuencial);
    const fechaInicio = new Date(inicio);
    const fechaFin = new Date(fin);
    const sec = secuencial !== undefined ? Number(secuencial) : undefined;

    return this.historicoService.buscarPorFechasEcuador(
      fechaInicio,
      fechaFin,
      sec,
    );
  }

  @Get('get/usuario/:id')
  @AuthUsuario()
  @ApiOperation({ summary: 'Buscar cupones por usuario' })
  @ApiResponse({ status: 200, description: 'Lista de cupones para el usuario' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async buscarPorIdDeUsuario(@Param('id') id: string, @GetUser() user: any) {
    await this.assertMismoLocal(user, id);
    return await this.historicoService.buscarPorIdDeUsuario(id);
  }

  @Post('validar/cupon/registro')
  @AuthUsuario()
  @ApiOperation({ summary: 'Validar cupón por ID antes de registrar' })
  @ApiResponse({
    status: 200,
    description: 'Cupón válido para registro',
  })
  @ApiResponse({
    status: 400,
    description: 'Cupón inválido o no se puede registrar',
  })
  @ApiBody({
    description: 'Datos del cupón y usuario para validar',
    type: Object,
    examples: {
      example: {
        value: {
          id: '60c72b2f9b1d8c001c8e4f1a',
          usuarioId: '60c72b2f9b1d8c001c8e4f1b',
        },
        summary: 'Datos del cupón y usuario',
      },
    },
  })
  async validarCuponPorId(@Body() body: { id: string; usuarioId: string }, @GetUser() user: any) {
    await this.assertMismoLocal(user, body?.usuarioId, true);
    this.logger.log(`[validarCuponPorId] body recibido: ${JSON.stringify(body)}`);
    try {
      const result = await this.historicoService.validarCuponPorId(body);
      this.logger.log(`[validarCuponPorId] resultado: valido=${result?.valido} message="${result?.message}"`);
      return result;
    } catch (e) {
      this.logger.error(`[validarCuponPorId] excepcion: ${e?.message}`, e?.stack);
      throw e;
    }
  }

  @Post('usuario/fechas/dashboard')
  @AuthUsuario()
  @ApiOperation({ summary: 'Buscar cupones por usuario' })
  @ApiResponse({ status: 200, description: 'Lista de cupones para el usuario' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  @ApiBody({
    description: 'Buscar cupones por usuario y fechas',
    type: Object,
    examples: {
      example: {
        value: {
          id: '60c72b2f9b1d8c001c8e4f1a',
          fechaInicio: '2023-01-01',
          fechaFin: '2023-12-31',
        },
        summary: 'Datos del usuario y rango de fechas',
      },
    },
  })
  async buscarPorIdDeUsuarioFechas(
    @Body() body: { id: string; fechaInicio: string; fechaFin: string },
    @GetUser() user: any,
  ) {
    await this.assertMismoLocal(user, body?.id);
    return await this.historicoService.buscarPorIdDeUsuarioFechas(body);
  }
}
