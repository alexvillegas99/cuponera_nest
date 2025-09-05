import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Delete,
  Patch,
  Query,
} from '@nestjs/common';
import { CuponService } from './cupon.service';
import { CreateCuponDto } from './dto/create-cupon.dto';
import { UpdateCuponDto } from './dto/update-cupon.dto';
import { CrearLoteCuponDto } from './dto/crear-lote-cupon.dto';

import {
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ActivarCuponDto } from './dto/activar-cupon.dto';

@ApiTags('Cupones')
@Controller('cupones')
export class CuponController {
  constructor(private readonly cuponService: CuponService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un cupón individual' })
  @ApiResponse({ status: 201, description: 'Cupón creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiBody({ type: CreateCuponDto })
  create(@Body() dto: CreateCuponDto) {
    return this.cuponService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los cupones' })
  @ApiResponse({ status: 200, description: 'Lista de cupones' })
  findAll() {
    return this.cuponService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar cupón por ID' })
  @ApiResponse({ status: 200, description: 'Cupón encontrado' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  @ApiParam({ name: 'id', description: 'ID del cupón (MongoID)' })
  findById(@Param('id') id: string) {
    return this.cuponService.findById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar cupón por ID' })
  @ApiResponse({ status: 200, description: 'Cupón eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  @ApiParam({ name: 'id', description: 'ID del cupón (MongoID)' })
  delete(@Param('id') id: string) {
    return this.cuponService.delete(id);
  }

  @Patch('activar')
  @ApiOperation({ summary: 'Activar un cupón por versión y secuencial' })
  @ApiResponse({ status: 200, description: 'Cupón activado correctamente' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  @ApiBody({
    type: ActivarCuponDto,
    description: 'Datos para activar el cupón por versión y secuencial',
  })
  activarPorSecuencial(@Body() body: ActivarCuponDto) {
    return this.cuponService.activarCuponPorSecuencial(
      body.versionId,
      body.secuencial,
      body.usuarioId,
    );
  }

  @Patch('desactivar')
  @ApiOperation({ summary: 'Desactivar un cupón por versión y secuencial' })
  @ApiResponse({ status: 200, description: 'Cupón desactivado correctamente' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  @ApiBody({
    type: ActivarCuponDto,
    description: 'Datos para activar el cupón por versión y secuencial',
  })
  desactivarPorSecuencial(@Body() body: any) {
    return this.cuponService.desactivarCuponPorSecuencial(
      body.versionId,
      body.secuencial,
    );
  }

  @Post('lote')
  @ApiOperation({
    summary: 'Generar un lote de cupones para una versión específica',
    description:
      'Genera múltiples cupones secuenciales para una versión. Por defecto, los cupones se crean inactivos.',
  })
  @ApiResponse({ status: 201, description: 'Cupones generados exitosamente' })
  @ApiBody({
    type: CrearLoteCuponDto,
    description:
      'versionId (obligatorio), cantidad (obligatorio), fechas opcionales',
  })
  generarLote(@Body() dto: CrearLoteCuponDto) {
    return this.cuponService.generarLote(dto.versionId, dto.cantidad);
  }

  //buscar por id de version

  @Get('version/:versionId')
  @ApiOperation({ summary: 'Buscar cupones por ID de versión' })
  @ApiResponse({ status: 200, description: 'Lista de cupones para la versión' })
  @ApiResponse({ status: 404, description: 'Versión no encontrada' })
  @ApiParam({ name: 'versionId', description: 'ID de la versión de cuponera' })
  async findByVersionId(@Param('versionId') versionId: string) {
    return await this.cuponService.findByVersionId(versionId);
  }

  @Get('buscar/fecha')
  @ApiOperation({ summary: 'Buscar cupones por rango de fechas' })
  @ApiResponse({ status: 200, description: 'Lista de cupones en el rango' })
  @ApiResponse({ status: 400, description: 'Fechas inválidas' })
  buscarPorFechas(@Query('inicio') inicio: string, @Query('fin') fin: string) {
    console.log('Buscar por fechas cupones:', inicio, fin);
    const fechaInicio = new Date(inicio);
    const fechaFin = new Date(fin);

    return this.cuponService.buscarPorFechas(fechaInicio, fechaFin);
  }

  @Get('clientes/buscar/:clienteId')
  @ApiOperation({
    summary: 'Listar cuponeras de un cliente (modo compacto)',
    description:
      'Devuelve las cuponeras (cupones asignados) del cliente. Usa el query `soloActivas=true|false` para filtrar por estado.',
  })
  @ApiParam({
    name: 'clienteId',
    description: 'ID del cliente (MongoID)',
    required: true,
  })
  @ApiQuery({
    name: 'soloActivas',
    required: false,
    description:
      'Si es "true" (por defecto), devuelve solo cuponeras activas. Con "false", devuelve todas.',
    example: 'true',
  })
  @ApiResponse({ status: 200, description: 'Listado obtenido correctamente' })
  @ApiResponse({
    status: 400,
    description: 'Parámetros inválidos (clienteId inválido)',
  })
  async listar(
    @Param('clienteId') clienteId: string,
    @Query('soloActivas') soloActivas = 'true',
  ) {
    const list = await this.cuponService.obtenerCuponerasPorCliente(
      clienteId,
      soloActivas !== 'false',
    );
    return list;
  }

  @Post('clientes/:clienteId/cupones/:cuponId/asignar')
  @ApiOperation({
    summary: 'Asignar un cupón específico a un cliente',
    description:
      'Asigna el cupón indicado al cliente. Falla si el cupón ya está asignado o no está disponible (por ejemplo, no está INACTIVO).',
  })
  @ApiParam({
    name: 'clienteId',
    description: 'ID del cliente (MongoID)',
    required: true,
  })
  @ApiParam({
    name: 'cuponId',
    description: 'ID del cupón (MongoID)',
    required: true,
  })
  @ApiResponse({ status: 201, description: 'Cupón asignado correctamente' })
  @ApiResponse({
    status: 200,
    description:
      'Cupón asignado correctamente (también válido si devuelves 200)',
  })
  @ApiResponse({
    status: 400,
    description: 'IDs inválidos o parámetros incorrectos',
  })
  @ApiResponse({
    status: 404,
    description: 'Cupón no encontrado (según reglas de asignación)',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto: cupón ya asignado o no disponible para asignar',
  })
  async asignar(
    @Param('clienteId') clienteId: string,
    @Param('cuponId') cuponId: string,
  ) {
    return this.cuponService.asignarCuponACliente(cuponId, clienteId);
  }

  @Get('clientes/:clienteId/cuponeras')
  @ApiOperation({
    summary: 'Listar cupones asignados a un cliente',
    description:
      'Devuelve todas las cuponeras (cupones) que están actualmente asignadas al cliente.',
  })
  @ApiParam({
    name: 'clienteId',
    description: 'ID del cliente (MongoID)',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Listado obtenido correctamente' })
  @ApiResponse({
    status: 400,
    description: 'Parámetros inválidos (clienteId inválido)',
  })
  async listarPorCliente(@Param('clienteId') clienteId: string) {
    return this.cuponService.obtenerCuponesPorCliente(clienteId);
  }

  @Get(':id/detalle')
async getDetalle(@Param('id') id: string) {
  return this.cuponService.obtenerDetalleCupon(id);
}

}
