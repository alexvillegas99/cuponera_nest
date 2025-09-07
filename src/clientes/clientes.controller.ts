// src/clientes/clientes.controller.ts
import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiParam,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';

@ApiTags('Clientes')
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

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
  create(@Body() dto: CreateClienteDto) {
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

  @Get(':id')
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
      return this.service.resetPassword(
        dto.email,
        dto.password
      );
    }


}
