import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ComentarioService } from './comentario.service';

@ApiTags('Comentarios')
@Controller('comentarios')
export class ComentarioController {
  constructor(private readonly comentariosService: ComentarioService) {}

  @Post()
  @ApiOperation({ summary: 'Crear comentario y actualizar promedio del usuario' })
  @ApiBody({
    type: Object,
    examples: {
      ejemplo: {
        summary: 'Comentario de un cliente',
        value: {
          usuarioId: '68b68090af6e4afed306d1b0',
          clienteId: '68b68090af6e4afed306d1c2',
          texto: 'Excelente atención y muy buen ambiente.',
          calificacion: 5,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Comentario creado',
    schema: {
      example: {
        _id: '68b68090af6e4afed306d2aa',
        usuario: '68b68090af6e4afed306d1b0',
        autor: '68b68090af6e4afed306d1c2',
        texto: 'Excelente atención y muy buen ambiente.',
        calificacion: 5,
        createdAt: '2025-09-02T15:00:00.000Z',
        updatedAt: '2025-09-02T15:00:00.000Z',
      },
    },
  })
crear(@Body() dto: { usuarioId: string; clienteId: string; texto: string; calificacion: number; }) {
  return this.comentariosService.crearComentario(dto);
}

  @Get('usuario/:usuarioId')
  @ApiOperation({ summary: 'Listar comentarios de un usuario (paginado)' })
  @ApiParam({ name: 'usuarioId', description: 'ID del usuario dueño del local/promo' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'page', required: false, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'Lista de comentarios',
    schema: {
      example: {
        items: [
          {
            _id: '68b68090af6e4afed306d2aa',
            usuario: '68b68090af6e4afed306d1b0',
            autor: { _id: '68b68090af6e4afed306d1c2', nombre: 'Juan', email: 'juan@ej.com' },
            texto: 'Excelente atención',
            calificacion: 5,
            createdAt: '2025-09-02T15:00:00.000Z',
          },
        ],
        total: 1,
        page: 0,
        limit: 20,
      },
    },
  })
  listarPorUsuario(
    @Param('usuarioId') usuarioId: string,
    @Query() query: any,
  ) {
    const { limit = 20, page = 0 } = query;
    return this.comentariosService.listarComentariosPorUsuario(usuarioId, page, limit);
  }

  @Delete(':comentarioId')
  @ApiOperation({ summary: 'Eliminar comentario y recalcular promedio del usuario' })
  @ApiParam({ name: 'comentarioId', description: 'ID del comentario' })
  @ApiResponse({ status: 200, description: 'Eliminado', schema: { example: { ok: true } } })
  eliminar(@Param('comentarioId') comentarioId: string) {
    return this.comentariosService.eliminarComentario(comentarioId);
  }

  @Put(':comentarioId')
@ApiOperation({ summary: 'Actualizar comentario por ID y recalcular promedio del usuario' })
@ApiParam({ name: 'comentarioId', description: 'ID del comentario' })
@ApiBody({
  schema: {
    example: {
      texto: 'Actualizo mi feedback después de la segunda visita',
      calificacion: 4
    },
  },
})
@ApiResponse({
  status: 200,
  description: 'Comentario actualizado',
  schema: {
    example: {
      _id: '68b68090af6e4afed306d2aa',
      usuario: '68b68090af6e4afed306d1b0',
      autor: { _id: '68b68090af6e4afed306d1c2', nombres: 'Juan', apellidos: 'Pérez', email: 'juan@ej.com' },
      texto: 'Actualizo mi feedback después de la segunda visita',
      calificacion: 4,
      createdAt: '2025-09-02T15:00:00.000Z',
      updatedAt: '2025-09-02T16:10:00.000Z',
    },
  },
})
actualizarPorId(
  @Param('comentarioId') comentarioId: string,
  @Body() body: { texto?: string; calificacion?: number },
) {
  return this.comentariosService.actualizarComentarioPorId(comentarioId, body);
}
}
