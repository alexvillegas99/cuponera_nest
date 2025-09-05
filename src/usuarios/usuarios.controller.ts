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
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { ComercioMiniResponse, PromoPrincipalDto } from './dto/comercio-detalle.dto';

@ApiTags('Usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear usuario' })
  @ApiBody({
    description: 'Datos para crear un usuario (incluye relaciones y detalles de promoción opcionales)',
    schema: {
      example: {
        nombre: 'Wellness & Spa',
        email: 'spa@ejemplo.com',
        identificacion: '1799999999',
        rol: 'STAFF',
        clave: 'MiClaveSegura123',
        estado: true,
        usuarioCreacion: '66d63c8f8baf234aa11e9000',
        ciudades: ['66d63c8f8baf234aa11e9876'],
        categorias: ['66d63c8f8baf234aa11e9901'],
        promocion: 'Spa Day Flash -40%',
        horarioAtencion: 'Lun-Dom 10:00–19:00',
        detallePromocion: {
          id: '4',
          title: 'Spa Day Flash -40%',
          placeName: 'Wellness & Spa',
          description: 'Relájate con un 40% de descuento en masajes.',
          imageUrl: 'https://.../restaurante.jpg',
          logoUrl: 'https://.../logo.png',
          isTwoForOne: false,
          tags: ['Relax', 'Salud', 'Descuento'],
          rating: 4.8,
          scheduleLabel: 'Hoy 10:00–19:00',
          distanceLabel: '3.1 km',
          startDate: '2025-09-02T15:00:00.000Z',
          endDate: '2025-09-02T19:00:00.000Z',
          isFlash: true,
          address: 'Parque Sucre, local 5'
        },
        detallePromocionesExtra: [
          { title: '2x1 Circuito Termal', placeName: 'Wellness & Spa' }
        ]
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado',
    schema: {
      example: {
        _id: '66d63c8f8baf234aa11e9001',
        nombre: 'Wellness & Spa',
        email: 'spa@ejemplo.com',
        identificacion: '1799999999',
        rol: 'STAFF',
        estado: true,
        usuarioCreacion: '66d63c8f8baf234aa11e9000',
        ciudades: ['Ambato'],           // ← nombres ya transformados
        categorias: ['Spa'],            // ← nombres ya transformados
        promocion: 'Spa Day Flash -40%',
        horarioAtencion: 'Lun-Dom 10:00–19:00',
        detallePromocion: { title: 'Spa Day Flash -40%', placeName: 'Wellness & Spa' },
        detallePromocionesExtra: [{ title: '2x1 Circuito Termal', placeName: 'Wellness & Spa' }],
        createdAt: '2025-09-02T12:00:00.000Z',
        updatedAt: '2025-09-02T12:00:00.000Z',
      },
    },
  })
  create(@Body() dto: any) {
    return this.usuariosService.create(dto);
  }


    @Get('por-ciudades')
@ApiOperation({
  summary: 'Listar usuarios que tienen promoción en una o varias ciudades',
  description:
    'Devuelve solo "detallePromocion", más arrays de nombres de "ciudades" y "categorias". ' +
    'Filtra usuarios que tengan alguna de las ciudades indicadas y que detallePromocion no sea nulo.',
})
@ApiResponse({
  status: 200,
  description: 'Usuarios con promociones activas en esas ciudades (campos reducidos)',
  schema: {
    example: [
      {
        _id: '68b68090af6e4afed306d1b0',
        detallePromocion: {
          title: 'Spa Day Flash -40%',
          placeName: 'Wellness & Spa',
          scheduleLabel: 'Lun-Dom 10:00–19:00',
          // ...
        },
        ciudades: ['Ambato', 'Riobamba'],
        categorias: ['Spa', 'Restaurante']
      }
    ],
  },
})
findByCiudadesConPromo(@Query('ciudades') ciudades: string) {
  // el query vendrá como "id1,id2,id3"
  const ciudadIds = ciudades.split(',').map((id) => id.trim()).filter(Boolean);
  console.log(ciudadIds)
  return this.usuariosService.findByCiudadesConPromo(ciudadIds);
}

  @Get()
  @ApiOperation({ summary: 'Listar usuarios' })
  @ApiResponse({
    status: 200,
    description: 'Listado con nombres en ciudades/categorias',
    schema: {
      example: [
        {
          _id: '66d63c8f8baf234aa11e9001',
          nombre: 'Wellness & Spa',
          email: 'spa@ejemplo.com',
          identificacion: '1799999999',
          rol: 'STAFF',
          estado: true,
          ciudades: ['Ambato', 'Quito'],
          categorias: ['Spa', 'Restaurante'],
          promocion: 'Spa Day Flash -40%',
          horarioAtencion: 'Lun-Dom 10:00–19:00',
        },
      ],
    },
  })
  findAll() {
    return this.usuariosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({
    status: 200,
    description: 'Usuario con nombres de ciudades y categorías',
  })
  findById(@Param('id') id: string) {
    return this.usuariosService.findById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar usuario' })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({ status: 200, description: 'Eliminado' })
  delete(@Param('id') id: string) {
    return this.usuariosService.delete(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar usuario' })
  @ApiParam({ name: 'id', required: true })
  @ApiBody({
    description: 'Campos a actualizar (hash de clave si se envía)',
    schema: {
      example: {
        nombre: 'Wellness & Spa Center',
        email: 'spa.center@ejemplo.com',
        clave: 'NuevaClave123',
        ciudades: ['66d63c8f8baf234aa11e9876'],
        categorias: ['66d63c8f8baf234aa11e9901', '66d63c8f8baf234aa11e9902'],
        promocion: 'Circuito termal -25%',
        horarioAtencion: 'Lun-Sab 09:00–18:00',
        detallePromocion: { title: 'Circuito termal -25%', placeName: 'Wellness & Spa' },
      },
    },
  })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.usuariosService.update(id, dto);
  }

  @Get('users-local/:id')
  @ApiOperation({ summary: 'Listar usuarios creados por un responsable' })
  @ApiParam({ name: 'id', description: 'ID del responsable (usuarioCreacion)' })
  findLocalById(@Param('id') id: string) {
    return this.usuariosService.buscarTodosLosUsuariosPorResponsable(id);
  }

  @Post('users-local/:id')
  @ApiOperation({ summary: 'Crear usuario asignando responsable (usuarioCreacion)' })
  @ApiParam({ name: 'id', description: 'ID del responsable' })
  @ApiBody({
    description: 'Datos de usuario (se setea usuarioCreacion y rol=STAFF)',
    schema: {
      example: {
        nombre: 'Local Plaza',
        email: 'local.plaza@ejemplo.com',
        identificacion: '1098765432',
        clave: 'Clave123',
        ciudades: ['66d63c8f8baf234aa11e9876'],
        categorias: ['66d63c8f8baf234aa11e9901'],
      },
    },
  })
  createUserWithLocal(@Param('id') id: string, @Body() dto: CreateUsuarioDto) {
    return this.usuariosService.createUserWithLocal(id, dto);
  }


@Get(':usuarioId/detalle-mini')
  async obtenerDetalleMini(@Param('usuarioId') usuarioId: string): Promise<ComercioMiniResponse> {
    return this.usuariosService.obtenerInformacionComercioMini(usuarioId);
  }

}
