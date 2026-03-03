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
import { CategoriaService } from './categoria.service';

@ApiTags('Categorías')
@Controller('categorias')
export class CategoriaController {
  constructor(private readonly categoriaService: CategoriaService) {}

  @Post()
  create(@Body() body: any) {
    return this.categoriaService.create(body);
  }

  @Get()
  findAll(
    @Query('q') q?: string,
    @Query('estado') estado?: string,
  ) {
    return this.categoriaService.findAll(q, estado);
  }

  @Get('activas')
  findActivas() {
    return this.categoriaService.findActivas();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriaService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.categoriaService.update(id, body);
  }

  @Patch(':id/activar')
  activate(@Param('id') id: string) {
    return this.categoriaService.activar(id);
  }

  @Patch(':id/desactivar')
  deactivate(@Param('id') id: string) {
    return this.categoriaService.desactivar(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriaService.remove(id);
  }
}
