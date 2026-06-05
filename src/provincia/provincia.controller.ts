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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ProvinciaService } from './provincia.service';

@ApiTags('Provincias')
@Controller('provincias')
export class ProvinciaController {
  constructor(private readonly provinciaService: ProvinciaService) {}

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Crear una provincia' })
  create(@Body() body: any) {
    return this.provinciaService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'Listar provincias con filtros' })
  findAll(@Query('q') q?: string, @Query('estado') estado?: string) {
    return this.provinciaService.findAll(q, estado);
  }

  @Get('activas')
  @ApiOperation({ summary: 'Provincias activas' })
  findActivas() {
    return this.provinciaService.findActivas();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener provincia por ID' })
  findOne(@Param('id') id: string) {
    return this.provinciaService.findById(id);
  }

  @Patch(':id')
  @Auth()
  @ApiOperation({ summary: 'Actualizar provincia' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.provinciaService.update(id, body);
  }

  @Patch(':id/activar')
  @Auth()
  activar(@Param('id') id: string) {
    return this.provinciaService.activar(id);
  }

  @Patch(':id/desactivar')
  @Auth()
  desactivar(@Param('id') id: string) {
    return this.provinciaService.desactivar(id);
  }

  @Delete(':id')
  @Auth()
  @ApiOperation({ summary: 'Eliminar provincia' })
  remove(@Param('id') id: string) {
    return this.provinciaService.remove(id);
  }
}
