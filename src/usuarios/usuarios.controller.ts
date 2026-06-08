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
import {
  ComercioMiniResponse,
  PromoPrincipalDto,
} from './dto/comercio-detalle.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { HistorialEstablecimientosService } from 'src/historial-establecimientos/historial-establecimientos.service';

@ApiTags('Usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly auditoria: AuditoriaService,
    private readonly historialSvc: HistorialEstablecimientosService,
  ) {}

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Crear usuario' })
  @ApiBody({
    description:
      'Datos para crear un usuario (incluye relaciones y detalles de promoción opcionales)',
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
          address: 'Parque Sucre, local 5',
        },
        detallePromocionesExtra: [
          { title: '2x1 Circuito Termal', placeName: 'Wellness & Spa' },
        ],
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
        ciudades: ['Ambato'], // ← nombres ya transformados
        categorias: ['Spa'], // ← nombres ya transformados
        promocion: 'Spa Day Flash -40%',
        horarioAtencion: 'Lun-Dom 10:00–19:00',
        detallePromocion: {
          title: 'Spa Day Flash -40%',
          placeName: 'Wellness & Spa',
        },
        detallePromocionesExtra: [
          { title: '2x1 Circuito Termal', placeName: 'Wellness & Spa' },
        ],
        createdAt: '2025-09-02T12:00:00.000Z',
        updatedAt: '2025-09-02T12:00:00.000Z',
      },
    },
  })
  async create(@Body() dto: any, @GetUser() user: any) {
    // Si el creador es vendedor, siempre usar su propio ID como usuarioCreacion
    const permisos: string[] = user?.permisos ?? [];
    const esVendedor =
      permisos.includes('establecimientos.editar') &&
      !permisos.includes('dashboard.ver');
    if (esVendedor || !dto.usuarioCreacion) {
      dto.usuarioCreacion = user._id;
    }
    const result = await this.usuariosService.create(dto);
    this.auditoria.registrarDesdeUsuario(user, {
      accion: 'usuario.crear',
      modulo: 'usuarios',
      descripcion: `Usuario creado: ${dto.nombre} (${dto.email})`,
      recursoId: result._id?.toString(),
      recursoTipo: 'Usuario',
      datosNuevos: { nombre: dto.nombre, email: dto.email, rol: dto.rol },
      severidad: 'critical',
    });
    return result;
  }
  @Get('establecimientos')
  @Auth()
  @ApiOperation({ summary: 'Listado de establecimientos' })
  findEstablecimientos(
    @Query('page') page = '1',
    @Query('limit') limit = '12',
    @Query('q') q = '',
    @GetUser() user: any,
  ) {
    return this.usuariosService.findEstablecimientos({
      page: Number(page),
      limit: Number(limit),
      q,
    });
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
    description:
      'Usuarios con promociones activas en esas ciudades (campos reducidos)',
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
          categorias: ['Spa', 'Restaurante'],
        },
      ],
    },
  })
  findByCiudadesConPromo(@Query('ciudades') ciudades: string) {
    if (!ciudades) {
      return [];
    }

    const ids = ciudades
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(ids);
    return this.usuariosService.findByCiudadesConPromo(ids);
  }

  @Get('por-provincia')
  @ApiOperation({
    summary: 'Listar usuarios con promoción en TODA una provincia',
    description: 'Expande la provincia a sus ciudades y devuelve los locales con promo.',
  })
  findByProvinciaConPromo(@Query('provincia') provincia: string) {
    if (!provincia) return [];
    return this.usuariosService.findByProvinciaConPromo(provincia);
  }

  @Get('promos')
  @ApiOperation({
    summary: 'Locales con promoción (paginado, aditivo)',
    description:
      'Paginado por provincia(s)/ciudad(es), con búsqueda por nombre (q), Hoy (isToday) y Flash (isFlash). ' +
      'Devuelve { data, total, page, limit, hasMore }. No reemplaza a por-provincia/por-ciudades.',
  })
  findPromosPaginado(
    @Query('provincias') provincias?: string,
    @Query('ciudades') ciudades?: string,
    @Query('localIds') localIds?: string,
    @Query('q') q?: string,
    @Query('isToday') isToday?: string,
    @Query('isFlash') isFlash?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usuariosService.findPromosPaginado({
      provincias,
      ciudades,
      localIds,
      q,
      isToday: isToday === 'true',
      isFlash: isFlash === 'true',
      lat: lat != null && lat !== '' ? Number(lat) : undefined,
      lng: lng != null && lng !== '' ? Number(lng) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 30,
    });
  }

  @Get()
  @Auth()
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

  @Get('admin-list')
  @Auth()
  @ApiOperation({ summary: 'Listado administrativo de usuarios con filtros' })
  findAllAdmin(
    @Query('q') q?: string,
    @Query('rol') rol?: string,
    @Query('estado') estado?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.usuariosService.findAllAdmin({
      q,
      rol,
      estado,
      page: Number(page),
      limit: Number(limit),
    });
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
  @Auth()
  @ApiOperation({ summary: 'Eliminar usuario' })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({ status: 200, description: 'Eliminado' })
  async delete(@Param('id') id: string, @GetUser() user: any) {
    const usuario = await this.usuariosService.findById(id);
    const result = await this.usuariosService.delete(id);
    this.auditoria.registrarDesdeUsuario(user, {
      accion: 'usuario.eliminar',
      modulo: 'usuarios',
      descripcion: `Usuario eliminado: ${usuario.nombre} (${usuario.email})`,
      recursoId: id,
      recursoTipo: 'Usuario',
      datosAnteriores: { nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
      severidad: 'critical',
    });
    return result;
  }

  @Patch('reset')
  async reset(@Body() dto: any) {
    // Si tu reset NO requiere code, se ignora dto.code
    return this.usuariosService.resetPassword(dto.email, dto.password);
  }

  @Patch(':id')
  @Auth()
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
        detallePromocion: {
          title: 'Circuito termal -25%',
          placeName: 'Wellness & Spa',
        },
      },
    },
  })
  async update(@Param('id') id: string, @Body() dto: any, @GetUser() user: any) {
    const permisos: string[] = user?.permisos ?? [];
    const soloFotos =
      permisos.includes('establecimientos.fotos') &&
      !permisos.includes('establecimientos.editar') &&
      !permisos.includes('usuarios.editar');
    const soloEditar =
      permisos.includes('establecimientos.editar') &&
      !permisos.includes('establecimientos.fotos') &&
      !permisos.includes('usuarios.editar');

    // mkt-fotos: solo puede tocar imageBase64, logoBase64, galeria y productos dentro de detallePromocion
    if (soloFotos) {
      const { imageBase64, logoBase64, galeria, productos } =
        dto?.detallePromocion ?? {};
      dto = { detallePromocion: { imageBase64, logoBase64, galeria, productos } };
    }

    // vendedor: no puede tocar las fotos, galería ni catálogo (puede editar cualquier establecimiento)
    if (soloEditar) {
      if (dto.detallePromocion) {
        delete dto.detallePromocion.imageBase64;
        delete dto.detallePromocion.logoBase64;
        delete dto.detallePromocion.galeria;
        delete dto.detallePromocion.productos;
      }
    }

    // Registrar historial para revisión del admin (solo para roles no-admin)
    const esAdmin = permisos.includes('dashboard.ver');
    if (!esAdmin) {
      const actual = await this.usuariosService.findByIdRaw(id);
      const datosAnteriores: Record<string, any> = {};
      for (const key of Object.keys(dto)) {
        datosAnteriores[key] = (actual as any)?.[key];
      }
      this.historialSvc.registrarCambio({
        establecimientoId: id,
        nombreEstablecimiento: (actual as any)?.nombre ?? id,
        editadoPorId: user._id?.toString(),
        editadoPorNombre: user.nombre ?? user.email,
        datosAnteriores,
        datosNuevos: { ...dto },
      });
    }

    const result = await this.usuariosService.update(id, dto);
    this.auditoria.registrarDesdeUsuario(user, {
      accion: 'usuario.editar',
      modulo: 'usuarios',
      descripcion: `Usuario actualizado: ${id}`,
      recursoId: id,
      recursoTipo: 'Usuario',
      datosNuevos: dto,
      severidad: dto.estado !== undefined ? 'warning' : 'info',
    });
    return result;
  }

  @Get('users-local/:id')
  @Auth()
  @ApiOperation({ summary: 'Listar usuarios creados por un responsable' })
  @ApiParam({ name: 'id', description: 'ID del responsable (usuarioCreacion)' })
  findLocalById(@Param('id') id: string) {
    return this.usuariosService.buscarTodosLosUsuariosPorResponsable(id);
  }

  @Post('users-local/:id')
  @Auth()
  @ApiOperation({
    summary: 'Crear usuario asignando responsable (usuarioCreacion)',
  })
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
  async obtenerDetalleMini(
    @Param('usuarioId') usuarioId: string,
  ): Promise<ComercioMiniResponse> {
    return this.usuariosService.obtenerInformacionComercioMini(usuarioId);
  }

  @Get('buscar/email/:email')
  async buscarPorEmail(@Param('email') email: string) {
    return this.usuariosService.buscarPorEmail(email);
  }

  @Patch('actualizar/contrasenia/recuperacion')
  async actualizarContraseniaRecuperacion(@Body() dto: any) {
    return this.usuariosService.actualizarContraseniaRecuperacion(
      dto.email,
      dto.password,
    );
  }

  @Patch(':id/fcm-token')
  async fcmToken(@Param('id') id: string, @Body('fcmToken') fcmToken: string) {
    await this.usuariosService.actualizarFcmToken(id, fcmToken);
    return { ok: true };
  }
}
