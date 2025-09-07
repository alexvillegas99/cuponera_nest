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

// ─────────────────────────────────────────────────────────────
// NUEVO: Elegibilidad para comentar (por query)
@Get('eligibilidad')
@ApiOperation({ summary: 'Verifica si el cliente puede comentar en el usuario/local' })
@ApiQuery({ name: 'usuarioId', required: true, description: 'ID del usuario/local' })
@ApiQuery({ name: 'clienteId', required: true, description: 'ID del cliente (autor)' })
elegibilidad(@Query('usuarioId') usuarioId: string, @Query('clienteId') clienteId: string) {
  return this.comentariosService.elegibilidad(usuarioId, clienteId);
}

// ─────────────────────────────────────────────────────────────
// NUEVO: Obtener MI comentario (clienteId por query)
@Get('mio/:usuarioId')
@ApiOperation({ summary: 'Obtiene tu propio comentario en un usuario/local' })
@ApiParam({ name: 'usuarioId', description: 'ID del usuario/local' })
@ApiQuery({ name: 'clienteId', required: true, description: 'ID del cliente (autor)' })
obtenerMiComentario(@Param('usuarioId') usuarioId: string, @Query('clienteId') clienteId: string) {
  return this.comentariosService.obtenerMiComentario(usuarioId, clienteId);
}

// ─────────────────────────────────────────────────────────────
// NUEVO: Crear/editar MI comentario (clienteId en el body)
@Put('mio/:usuarioId')
@ApiOperation({ summary: 'Crea o actualiza tu comentario (1 por local)' })
@ApiParam({ name: 'usuarioId', description: 'ID del usuario/local' })
@ApiBody({
  schema: {
    example: {
      clienteId: '68b68090af6e4afed306d1c2',
      texto: 'Muy buen ambiente',
      calificacion: 5
    },
  },
})
upsertMiComentario(
  @Param('usuarioId') usuarioId: string,
  @Body() body: { clienteId: string; texto?: string; calificacion?: number },
) {
  const { clienteId, ...rest } = body;
  return this.comentariosService.upsertMiComentario(usuarioId, clienteId, rest);
}

// ─────────────────────────────────────────────────────────────
// NUEVO: Eliminar MI comentario (clienteId por query)
@Delete('mio/:usuarioId')
@ApiOperation({ summary: 'Elimina tu comentario en un usuario/local' })
@ApiParam({ name: 'usuarioId', description: 'ID del usuario/local' })
@ApiQuery({ name: 'clienteId', required: true, description: 'ID del cliente (autor)' })
eliminarMiComentario(@Param('usuarioId') usuarioId: string, @Query('clienteId') clienteId: string) {
  return this.comentariosService.eliminarMiComentario(usuarioId, clienteId);
}



}
