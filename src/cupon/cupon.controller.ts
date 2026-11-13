import { assertClienteOPermiso, clienteDeSesion, esCliente, tienePermiso } from 'src/common/security/propiedad';
import { GetUser } from 'src/auth/decorators';
import { AuthUsuario } from 'src/auth/decorators/auth.decorator';
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Delete,
  Patch,
  Query,
  ForbiddenException,
  NotFoundException,
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
import { Auth } from 'src/auth/decorators/auth.decorator';

@ApiTags('Cupones')
@Controller('cupones')
export class CuponController {
  constructor(private readonly cuponService: CuponService) {}

  @Post()
  @AuthUsuario('cupones.crear')
  @ApiOperation({ summary: 'Crear un cupón individual' })
  @ApiResponse({ status: 201, description: 'Cupón creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })

  async create(@Body() dto: any) {
    return await this.cuponService.create(dto);
  }

@Get()
@AuthUsuario('cupones.ver', 'dashboard.ver')
@ApiOperation({ summary: 'Listar cupones paginados' })
@ApiQuery({ name: 'page', required: false, example: 1 })
@ApiQuery({ name: 'limit', required: false, example: 10 })
@ApiQuery({ name: 'search', required: false, example: 'Cinthya' })
  async findAll(
  @Query('page') page = 1,
  @Query('limit') limit = 10,
  @Query('search') search?: string,
) {
  return await this.cuponService.findAll(+page, +limit, search);
}

@Get('admin/conteo-estados')
@AuthUsuario('cupones.ver', 'dashboard.ver')
@ApiOperation({ summary: 'Cantidad de cupones por estado (para el panel)' })
async conteoEstados() {
  return this.cuponService.conteoPorEstado();
}


  @Get(':id')
  @AuthUsuario('cupones.ver')
  @ApiOperation({ summary: 'Buscar cupón por ID' })
  @ApiResponse({ status: 200, description: 'Cupón encontrado' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  @ApiParam({ name: 'id', description: 'ID del cupón (MongoID)' })
  findById(@Param('id') id: string) {
    return this.cuponService.findById(id);
  }
 @Get('agregar/:id')
  @Auth()
  @ApiOperation({ summary: 'Buscar cupón por ID' })
  @ApiResponse({ status: 200, description: 'Cupón encontrado' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  @ApiParam({ name: 'id', description: 'ID del cupón (MongoID)' })
  findAgregarUsuarioResponsable(@Param('id') id: string, @GetUser() user: any) {
    // Ver un cupón físico antes de vincularlo: cualquier cliente con sesión.
    if (!esCliente(user) && !tienePermiso(user, 'cupones.ver')) {
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }
    return this.cuponService.findAgregarUsuarioCliente(id);
  }



  @Delete(':id')
  @AuthUsuario('cupones.eliminar')
  @ApiOperation({ summary: 'Eliminar cupón por ID' })
  @ApiResponse({ status: 200, description: 'Cupón eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Cupón no encontrado' })
  @ApiParam({ name: 'id', description: 'ID del cupón (MongoID)' })
  delete(@Param('id') id: string) {
    return this.cuponService.delete(id);
  }

  @Patch('activar')
  @AuthUsuario('cupones.activar')
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
  @AuthUsuario('cupones.activar')
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
  @AuthUsuario('cupones.lote')
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
  @Auth()
  @ApiOperation({ summary: 'Buscar cupones por ID de versión' })
  @ApiResponse({ status: 200, description: 'Lista de cupones para la versión' })
  @ApiResponse({ status: 404, description: 'Versión no encontrada' })
  @ApiParam({ name: 'versionId', description: 'ID de la versión de cuponera' })
  async findByVersionId(@Param('versionId') versionId: string) {
    return await this.cuponService.findByVersionId(versionId);
  }

  @Get('buscar/fecha')
  @Auth()
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
  @Auth()
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
    @GetUser() user: any,
    @Param('clienteId') clienteId: string,
    @Query('soloActivas') soloActivas = 'true',
  ) {
    assertClienteOPermiso(user, clienteId, 'cupones.ver');
    const list = await this.cuponService.obtenerCuponerasPorCliente(
      clienteId,
      soloActivas !== 'false',
    );
    return list;
  }

  @Get('clientes/:clienteId/disponibles/:usuarioId')
  @Auth()
  @ApiOperation({
    summary: 'Cupones disponibles de un cliente para canjear en un local',
  })
  findDisponiblesParaLocal(
    @Param('clienteId') clienteId: string,
    @Param('usuarioId') usuarioId: string,
    @GetUser() user: any,
  ) {
    assertClienteOPermiso(user, clienteId, 'cupones.ver');
    return this.cuponService.findDisponiblesParaLocal(clienteId, usuarioId);
  }

  @Get('clientes/:clienteId/locales-disponibles')
  @Auth()
  @ApiOperation({
    summary:
      'Ids de locales donde el cliente tiene cupón disponible para canjear',
  })
  findLocalesDisponibles(@Param('clienteId') clienteId: string, @GetUser() user: any) {
    assertClienteOPermiso(user, clienteId, 'cupones.ver');
    return this.cuponService.findLocalesDisponibles(clienteId);
  }

  @Get('clientes/:clienteId/cuponeras-paginado')
  @Auth()
  @ApiOperation({
    summary: 'Cuponeras del cliente (paginado, aditivo)',
  })
  listarCuponerasPaginado(
    @GetUser() user: any,
    @Param('clienteId') clienteId: string,
    @Query('soloActivas') soloActivas = 'true',
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    assertClienteOPermiso(user, clienteId, 'cupones.ver');
    return this.cuponService.obtenerCuponerasPorClientePaginado({
      clienteId,
      soloActivas: soloActivas !== 'false',
      q,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 30,
    });
  }

  @Post('clientes/:clienteId/cupones/:cuponId/asignar')
  @Auth()
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
    @GetUser() user: any,
  ) {
    // Antes era público: cualquiera podía asignar una cuponera física a OTRO
    // cliente. Ahora: el cliente solo a sí mismo; personal con cupones.asignar.
    const propio = user?.kind === 'CLIENTE' && String(user._id) === String(clienteId);
    const staff = user?.kind !== 'CLIENTE' && (user?.permisos ?? []).includes('cupones.asignar');
    if (!propio && !staff) throw new ForbiddenException('No puedes asignar este cupón a otra cuenta');
    return this.cuponService.asignarCuponACliente(cuponId, clienteId);
  }

  @Get('clientes/:clienteId/cuponeras')
  @Auth()
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
  async listarPorCliente(@Param('clienteId') clienteId: string, @GetUser() user: any) {
    assertClienteOPermiso(user, clienteId, 'cupones.ver');
    return this.cuponService.obtenerCuponesPorCliente(clienteId);
  }

  @Get(':id/detalle')
  @Auth()
async getDetalle(@Param('id') id: string, @GetUser() user: any) {
  // El cliente solo ve el detalle de SUS cupones.
  if (esCliente(user)) {
    const cupon: any = await this.cuponService.findById(id).catch(() => null);
    if (!cupon) throw new NotFoundException('Cupón no encontrado');
    const dueno = cupon?.cliente?._id ?? cupon?.cliente;
    if (String(dueno) !== String(user._id)) {
      throw new ForbiddenException('Este cupón no es tuyo');
    }
  } else if (!tienePermiso(user, 'cupones.ver')) {
    throw new ForbiddenException('No tienes permisos para realizar esta acción');
  }
  return this.cuponService.obtenerDetalleCupon(id);
}

  @Patch(':cuponId/abrir-regalo')
  @Auth()
  @ApiOperation({
    summary: 'El destinatario abre su regalo (marca regaloAbierto=true)',
  })
  @ApiParam({ name: 'cuponId', description: 'ID del cupón (MongoID)' })
  async abrirRegalo(
    @Param('cuponId') cuponId: string,
    @Body() body: { clienteId: string },
    @GetUser() user: any,
  ) {
    // El destinatario es quien tiene la sesión (no el id que llegue en el body):
    // así nadie puede abrir el regalo de otra persona.
    const clienteId =
      user?.kind === 'CLIENTE' ? String(user._id) : body?.clienteId;
    return this.cuponService.abrirRegalo(cuponId, clienteId);
  }

}
