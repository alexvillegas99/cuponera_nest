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
import { ApiTags, ApiOperation, ApiResponse, ApiBody,ApiQuery  } from '@nestjs/swagger';
import { Categoria, CategoriaDocument } from './schema/categoria.schema';

@ApiTags('Categorías')
@Controller('categorias')
export class CategoriaController {
  constructor(
    @InjectModel(Categoria.name) private readonly categoriaModel: Model<CategoriaDocument>,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear una categoría' })
  @ApiBody({
    description: 'Datos para crear una categoría',
    schema: {
      example: {
        nombre: 'Restaurante',
        descripcion: 'Locales que sirven comida',
        icono: 'utensils',
        estado: true,
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Categoría creada',
    schema: {
      example: {
        _id: '66d63c8f8baf234aa11e9901',
        nombre: 'Restaurante',
        descripcion: 'Locales que sirven comida',
        icono: 'utensils',
        estado: true,
        createdAt: '2025-09-02T12:00:00.000Z',
        updatedAt: '2025-09-02T12:00:00.000Z',
      },
    },
  })
  create(@Body() body: any) {
    return this.categoriaModel.create(body);
  }

@Get()
@ApiOperation({ summary: 'Listar categorías' })
@ApiQuery({ name: 'q', required: false, type: String, description: 'Búsqueda por nombre' })
@ApiQuery({ name: 'estado', required: false, type: String, description: 'Estado true/false' })

  @ApiResponse({
    status: 200,
    description: 'Lista de categorías',
    schema: {
      example: [
        {
          _id: '66d63c8f8baf234aa11e9901',
          nombre: 'Restaurante',
          descripcion: 'Locales que sirven comida',
          icono: 'utensils',
          estado: true,
        },
        {
          _id: '66d63c8f8baf234aa11e9902',
          nombre: 'Cafetería',
          descripcion: 'Locales de café y snacks',
          icono: 'coffee',
          estado: true,
        },
      ],
    },
  })
  findAll(
    @Query('q') q?: string,
    @Query('estado') estado?: string,
  ) {
    const filter: any = {};
    if (q) filter.nombre = new RegExp(q, 'i');
    if (estado !== undefined) filter.estado = estado === 'true';
    return this.categoriaModel.find(filter).lean();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de categoría' })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la categoría',
    schema: {
      example: {
        _id: '66d63c8f8baf234aa11e9901',
        nombre: 'Restaurante',
        descripcion: 'Locales que sirven comida',
        icono: 'utensils',
        estado: true,
      },
    },
  })
  async findOne(@Param('id') id: string) {
    const doc = await this.categoriaModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Categoría no encontrada');
    return doc;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar categoría' })
  @ApiBody({
    description: 'Datos para actualizar una categoría',
    schema: {
      example: {
        nombre: 'Restaurante Gourmet',
        descripcion: 'Restaurantes de alta cocina',
        icono: 'utensils',
        estado: false,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Categoría actualizada',
    schema: {
      example: {
        _id: '66d63c8f8baf234aa11e9901',
        nombre: 'Restaurante Gourmet',
        descripcion: 'Restaurantes de alta cocina',
        icono: 'utensils',
        estado: false,
        updatedAt: '2025-09-02T12:10:00.000Z',
      },
    },
  })
  update(@Param('id') id: string, @Body() body: any) {
    return this.categoriaModel.findByIdAndUpdate(id, body, { new: true }).lean();
  }

  @Patch(':id/desactivar')
  @ApiOperation({ summary: 'Desactivar categoría' })
  deactivate(@Param('id') id: string) {
    return this.categoriaModel.findByIdAndUpdate(id, { estado: false }, { new: true }).lean();
  }

  @Patch(':id/activar')
  @ApiOperation({ summary: 'Activar categoría' })
  activate(@Param('id') id: string) {
    return this.categoriaModel.findByIdAndUpdate(id, { estado: true }, { new: true }).lean();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar categoría' })
  remove(@Param('id') id: string) {
    return this.categoriaModel.findByIdAndDelete(id).lean();
  }

  @Get('activas')
@ApiOperation({ summary: 'Listar categorías activas' })
findActivas() {
  return this.categoriaModel.find({ estado: true }).lean();
}
}
