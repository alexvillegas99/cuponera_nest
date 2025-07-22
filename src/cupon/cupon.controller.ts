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

}
