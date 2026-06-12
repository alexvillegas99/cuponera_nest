// src/clientes/clientes.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiParam,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { ClientesService } from './clientes.service';

@ApiTags('Clientes')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}


    @Get('admin')
  @Auth()
  async findAdmin(
    @Query('q') q?: string,
    @Query('estado') estado?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.service.findAdmin({
      q,
      estado,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Post()
  @ApiOperation({
    summary: 'Registrar cliente',
    description:
      'Permite registrar un nuevo cliente con sus datos personales, cédula/RUC y correo electrónico únicos.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cliente registrado exitosamente',
    schema: {
      example: {
        _id: '66d63c8f8baf234aa11e9999',
        nombres: 'Juan',
        apellidos: 'Pérez',
        tipoIdentificacion: 'CEDULA',
        identificacion: '1712345678',
        email: 'juan.perez@ejemplo.com',
        telefono: '0999999999',
        direccion: 'Av. Siempre Viva 123',
        estado: true,
        createdAt: '2025-09-02T12:00:00.000Z',
        updatedAt: '2025-09-02T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Error de validación (cédula, RUC, email o identificación duplicados)',
  })
  @ApiBody({
    description: 'Datos necesarios para registrar un nuevo cliente',
    schema: {
      example: {
        nombres: 'Juan',
        apellidos: 'Pérez',
        tipoIdentificacion: 'CEDULA',
        identificacion: '1712345678',
        email: 'juan.perez@ejemplo.com',
        telefono: '0999999999',
        direccion: 'Av. Siempre Viva 123',
        fechaNacimiento: '1990-05-10T00:00:00.000Z',
        password: 'MiClaveSegura123',
      },
    },
  })
  create(@Body() dto: any) {
    return this.service.create(dto);
  }
  @Get('check-email')
  @ApiOperation({ summary: 'Verifica si un email está disponible' })
  @ApiQuery({ name: 'email', required: true, example: 'correo@dominio.com' })
  @ApiResponse({
    status: 200,
    description: 'Devuelve available=true si el email NO existe',
    schema: { example: { available: true } },
  })
  async checkEmail(@Query('email') email?: string) {
    if (!email || !email.trim()) {
      throw new BadRequestException('email es requerido');
    }
    // normaliza por si el schema no tiene lowercase automático
    const exists = await this.service.emailExists(email.trim().toLowerCase());
    return { available: !exists };
  }
  @Get()
  @Auth()
  @ApiOperation({
    summary: 'Listar clientes',
    description:
      'Devuelve todos los clientes registrados. Permite filtrar por texto (`q`) y estado (`true`/`false`).',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description:
      'Filtro de búsqueda (nombre, apellido, email o identificación)',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    type: String,
    description: 'Filtrar por estado: true o false',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de clientes',
    schema: {
      example: [
        {
          _id: '66d63c8f8baf234aa11e9999',
          nombres: 'Juan',
          apellidos: 'Pérez',
          identificacion: '1712345678',
          email: 'juan.perez@ejemplo.com',
          estado: true,
        },
        {
          _id: '66d63c8f8baf234aa11e9998',
          nombres: 'María',
          apellidos: 'González',
          identificacion: '0998765432',
          email: 'maria.gonzalez@ejemplo.com',
          estado: false,
        },
      ],
    },
  })
  findAll(@Query('q') q?: string, @Query('estado') estado?: string) {
    return this.service.findAll(q, estado);
  }

  @Get('buscar-destinatario')
  @Auth()
  @ApiOperation({
    summary: 'Buscar destinatario para un regalo',
    description:
      'Busca un cliente por email o identificación exactos. Devuelve datos mínimos para confirmar a quién se le regala.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Email o identificación del destinatario',
  })
  buscarDestinatario(@Query('q') q?: string) {
    return this.service.buscarDestinatario(q ?? '');
  }

  @Get(':id')
  @Auth()
  @ApiOperation({
    summary: 'Obtener cliente por ID',
    description: 'Devuelve la información detallada de un cliente por su ID.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID del cliente en MongoDB',
  })
  @ApiResponse({
    status: 200,
    description: 'Cliente encontrado',
    schema: {
      example: {
        _id: '66d63c8f8baf234aa11e9999',
        nombres: 'Juan',
        apellidos: 'Pérez',
        tipoIdentificacion: 'CEDULA',
        identificacion: '1712345678',
        email: 'juan.perez@ejemplo.com',
        telefono: '0999999999',
        direccion: 'Av. Siempre Viva 123',
        estado: true,
        createdAt: '2025-09-02T12:00:00.000Z',
        updatedAt: '2025-09-02T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put('me/:id')
  async updateMe(@Body() dto: any, @Param('id') id: string) {
    return this.service.updateMe(id, dto);
  }

  @Get('perfil/:id')
  async PerfilCliente(@Body() dto: any, @Param('id') id: string) {
    return await this.service.getPerfil(id);
  }

  @Patch('reset')
  async reset(@Body() dto: any) {
    // Si tu reset NO requiere code, se ignora dto.code
    return this.service.resetPassword(dto.email, dto.password);
  }

  @Patch(':id/fcm-token')
  async fcmToken(@Param('id') id: string, @Body('fcmToken') fcmToken: string) {
    await this.service.actualizarFcmToken(id, fcmToken);
    return { ok: true };
  }

  /**
   * Dispara un push a TODOS los devices del cliente avisando que cambió
   * de cuenta. El cliente Flutter llama esto desde el AccountPicker tras
   * un switch biométrico exitoso.
   */
  @Post('notify-switch')
  @Auth()
  async notifySwitch(
    @GetUser() user: any,
    @Body() body: { dispositivo?: string; nombreCuenta?: string } = {},
  ) {
    if (!user?._id) return { ok: false };
    const nombre = body.nombreCuenta || 'tu cuenta';
    const dev = body.dispositivo || 'tu dispositivo';
    await this.service.notificarTodosDispositivos(
      user._id.toString(),
      '🔄 Cambio de cuenta',
      `Cambiaste a ${nombre} desde ${dev}.`,
      { tipo: 'switch', dispositivo: dev },
    );
    return { ok: true };
  }

  @Delete('me')
  @Auth()
  async deleteMe(@GetUser() user: any) {
    return this.service.softDeleteCliente(user._id.toString());
  }
}
