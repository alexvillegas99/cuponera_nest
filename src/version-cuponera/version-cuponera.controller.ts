import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { VersionCuponeraService } from './version-cuponera.service';
import { CreateVersionCuponeraDto } from './dto/create-version-cuponera.dto';

@ApiTags('Versiones Cuponera')
@Controller('versiones')
export class VersionCuponeraController {
  constructor(private readonly versionService: VersionCuponeraService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una versión de cuponera' })
  @ApiBody({
    description: 'Datos para crear la versión (con ciudades disponibles opcionales)',
    schema: {
      example: {
        nombre: 'Enjoy 2025 – Q4',
        estado: true,
        numeroDeLocales: 120,
        ciudadesDisponibles: [
          '66d63c8f8baf234aa11e9876',
          '66d63c8f8baf234aa11e9880'
        ]
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Versión creada',
    schema: {
      example: {
        _id: '66d63c8f8baf234aa11ea111',
        nombre: 'Enjoy 2025 – Q4',
        estado: true,
        numeroDeLocales: 120,
        ciudadesDisponibles: ['Ambato', 'Quito'], // ← nombres
        createdAt: '2025-09-02T12:00:00.000Z',
        updatedAt: '2025-09-02T12:00:00.000Z',
      },
    },
  })
  create(@Body() dto: CreateVersionCuponeraDto) {
    return this.versionService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar versiones de cuponera' })
  @ApiResponse({
    status: 200,
    description: 'Listado con ciudades como nombres',
    schema: {
      example: [
        {
          _id: '66d63c8f8baf234aa11ea111',
          nombre: 'Enjoy 2025 – Q4',
          estado: true,
          numeroDeLocales: 120,
          ciudadesDisponibles: ['Ambato', 'Quito'],
        },
      ],
    },
  })
  findAll() {
    return this.versionService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener versión por ID' })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({
    status: 200,
    description: 'Versión con ciudades como nombres',
    schema: {
      example: {
        _id: '66d63c8f8baf234aa11ea111',
        nombre: 'Enjoy 2025 – Q4',
        estado: true,
        numeroDeLocales: 120,
        ciudadesDisponibles: ['Ambato', 'Quito'],
      },
    },
  })
  findById(@Param('id') id: string) {
    return this.versionService.findById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar versión' })
  @ApiParam({ name: 'id', required: true })
  delete(@Param('id') id: string) {
    return this.versionService.delete(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar versión' })
  @ApiParam({ name: 'id', required: true })
  @ApiBody({
    description: 'Campos a actualizar',
    schema: {
      example: {
        nombre: 'Enjoy 2025 – Q4 (actualizado)',
        numeroDeLocales: 140,
        ciudadesDisponibles: ['66d63c8f8baf234aa11e9876'], // ids
        estado: false,
      },
    },
  })
  update(@Param('id') id: string, @Body() dto: CreateVersionCuponeraDto) {
    return this.versionService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @ApiOperation({ summary: 'Desactivar versión (estado=false)' })
  @ApiParam({ name: 'id', required: true })
  desactivar(@Param('id') id: string) {
    return this.versionService.update(id, { estado: false } as any);
  }

  @Patch(':id/activar')
  @ApiOperation({ summary: 'Activar versión (estado=true)' })
  @ApiParam({ name: 'id', required: true })
  activar(@Param('id') id: string) {
    return this.versionService.update(id, { estado: true } as any);
  }
}
