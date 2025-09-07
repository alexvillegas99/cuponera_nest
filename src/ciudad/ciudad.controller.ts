import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Ciudad, CiudadDocument } from './schema/ciudad.schema';

@ApiTags('Ciudades')
@Controller('ciudades')
export class CiudadController {
  constructor(
    @InjectModel(Ciudad.name) private readonly ciudadModel: Model<CiudadDocument>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear una ciudad' })
  @ApiBody({
    description: 'Datos para crear una ciudad',
    schema: {
      example: {
        nombre: 'Ambato',
        estado: true,
        geo: { lat: -1.24908, lng: -78.61675 },
        visibleParaRegistro:true
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Ciudad creada correctamente',
    schema: {
      example: {
        _id: '66d63c8f8baf234aa11e9876',
        nombre: 'Ambato',
        estado: true,
        geo: { lat: -1.24908, lng: -78.61675 },
        createdAt: '2025-09-02T12:00:00.000Z',
        updatedAt: '2025-09-02T12:00:00.000Z',
      },
    },
  })
  create(@Body() body: any) {
    return this.ciudadModel.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'Listar ciudades' })
  @ApiResponse({
    status: 200,
    description: 'Lista de ciudades',
    schema: {
      example: {
        items: [
          { _id: '66d63c8f8baf234aa11e9876', nombre: 'Ambato', estado: true },
          { _id: '66d63c8f8baf234aa11e9880', nombre: 'Quito', estado: true },
        ],
        total: 2,
        page: 1,
        limit: 50,
      },
    },
  })
  findAll(
    @Query('q') q?: string,
    @Query('estado') estado?: string,
    @Query('limit') limit = '50',
    @Query('page') page = '1',
  ) {
    const filter: any = {};
    if (q) filter.nombre = new RegExp(q, 'i');
    if (estado !== undefined) filter.estado = estado === 'true';
    return this.ciudadModel
      .find(filter)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una ciudad' })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la ciudad',
    schema: {
      example: {
        _id: '66d63c8f8baf234aa11e9876',
        nombre: 'Ambato',
        estado: true,
        geo: { lat: -1.24908, lng: -78.61675 },
      },
    },
  })
  async findOne(@Param('id') id: string) {
    const doc = await this.ciudadModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Ciudad no encontrada');
    return doc;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una ciudad' })
  @ApiBody({
    description: 'Datos para actualizar una ciudad',
    schema: {
      example: {
        nombre: 'Ambato Centro',
        estado: false,
        geo: { lat: -1.25, lng: -78.61 },
      },
    },
  })
  update(@Param('id') id: string, @Body() body: any) {
    return this.ciudadModel.findByIdAndUpdate(id, body, { new: true }).lean();
  }

  @Patch(':id/desactivar')
  @ApiOperation({ summary: 'Desactivar una ciudad' })
  deactivate(@Param('id') id: string) {
    return this.ciudadModel.findByIdAndUpdate(id, { estado: false }, { new: true }).lean();
  }

  @Patch(':id/activar')
  @ApiOperation({ summary: 'Activar una ciudad' })
  activate(@Param('id') id: string) {
    return this.ciudadModel.findByIdAndUpdate(id, { estado: true }, { new: true }).lean();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar ciudad (hard delete)' })
  remove(@Param('id') id: string) {
    return this.ciudadModel.findByIdAndDelete(id).lean();
  }
 

  @Get('ciudades/registro')
  findCiudadesParaRegistro() {
  return this.ciudadModel.find({ visibleParaRegistro: true }).lean();
}

  @Get('ciudades/filtro/promociones')
  findCiudadesParaFiltroPromociones() {
  return this.ciudadModel.find({ estado: true }).lean();
}

}
