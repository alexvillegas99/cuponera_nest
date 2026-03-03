import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { CiudadService } from './ciudad.service';

@ApiTags('Ciudades')
@Controller('ciudades')
export class CiudadController {
  constructor(private readonly ciudadService: CiudadService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una ciudad' })
  @ApiBody({
    schema: {
      example: {
        nombre: 'Ambato',
        estado: true,
        geo: { lat: -1.24908, lng: -78.61675 },
        visibleParaRegistro: true,
      },
    },
  })
  create(@Body() body: any) {
    return this.ciudadService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'Listar ciudades con filtros' })
  findAll(
    @Query('q') q?: string,
    @Query('estado') estado?: string,
    @Query('limit') limit = '50',
    @Query('page') page = '1',
  ) {
    return this.ciudadService.findAll({
      q,
      estado,
      limit: Number(limit),
      page: Number(page),
    });
  }

  @Get('registro')
  @ApiOperation({ summary: 'Ciudades visibles para registro' })
  findParaRegistro() {
    return this.ciudadService.findParaRegistro();
  }

  @Get('promociones')
  @ApiOperation({ summary: 'Ciudades activas para promociones' })
  findParaPromociones() {
    return this.ciudadService.findParaPromociones();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener ciudad por ID' })
  findOne(@Param('id') id: string) {
    return this.ciudadService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar ciudad' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.ciudadService.update(id, body);
  }

  @Patch(':id/activar')
  activar(@Param('id') id: string) {
    return this.ciudadService.activar(id);
  }

  @Patch(':id/desactivar')
  desactivar(@Param('id') id: string) {
    return this.ciudadService.desactivar(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar ciudad' })
  remove(@Param('id') id: string) {
    return this.ciudadService.remove(id);
  }
}
