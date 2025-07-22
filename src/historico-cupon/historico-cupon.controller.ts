import { Controller, Post, Body, Get, Query, Param } from '@nestjs/common';
import { HistoricoCuponService } from './historico-cupon.service';
import { CreateHistoricoCuponDto } from './dto/create-historico-cupon.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('Histórico de Cupones')
@Controller('historico')
export class HistoricoCuponController {
  constructor(private readonly historicoService: HistoricoCuponService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un escaneo de cupón' })
  @ApiResponse({ status: 201, description: 'Escaneo registrado correctamente' })
  @ApiResponse({
    status: 400,
    description: 'Escaneo inválido o excede el límite',
  })
  registrarEscaneo(@Body() dto: CreateHistoricoCuponDto) {
    return this.historicoService.registrarEscaneo(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar historial de escaneos' })
  findAll() {
    return this.historicoService.findAll();
  }

  //por fecha inicio, fecha fin
  @Get('buscar-por-fechas')
  @ApiOperation({ summary: 'Buscar historial por fechas' })
  @ApiResponse({ status: 200, description: 'Historial encontrado' })
  @ApiResponse({ status: 404, description: 'No se encontraron registros' })
  buscarPorFechas(
    @Query('inicio') inicio: string,
    @Query('fin') fin: string,
    @Query('secuencial') secuencial?: string,
  ) {
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
  @ApiOperation({ summary: 'Buscar cupones por usuario' })
  @ApiResponse({ status: 200, description: 'Lista de cupones para el usuario' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async buscarPorIdDeUsuario(@Param('id') id: string) {
    return await this.historicoService.buscarPorIdDeUsuario(id);
  }

  @Post('validar/cupon/registro')
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
  async validarCuponPorId(@Body() body: { id: string; usuarioId: string }) {
    return await this.historicoService.validarCuponPorId(body);
  }

  @Post('usuario/fechas/dashboard')
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
  ) {
    return await this.historicoService.buscarPorIdDeUsuarioFechas(body);
  }
}
