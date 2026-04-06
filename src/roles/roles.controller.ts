import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators';
import { AuditoriaService } from 'src/auditoria/auditoria.service';

@ApiTags('Roles')
@Controller('roles')
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Get('permisos')
  @Auth()
  @ApiOperation({ summary: 'Lista maestra de permisos agrupados por módulo' })
  getPermisos() {
    return this.rolesService.getPermisosCatalog();
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Listar todos los roles' })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Obtener rol por ID' })
  findById(@Param('id') id: string) {
    return this.rolesService.findById(id);
  }

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Crear nuevo rol' })
  async create(@Body() dto: CreateRolDto, @GetUser() user: any) {
    const result = await this.rolesService.create(dto);
    this.auditoria.registrarDesdeUsuario(user, {
      accion: 'rol.crear',
      modulo: 'roles',
      descripcion: `Rol creado: ${dto.nombre}`,
      recursoId: result._id?.toString(),
      recursoTipo: 'Rol',
      datosNuevos: { nombre: dto.nombre, permisos: dto.permisos },
      severidad: 'critical',
    });
    return result;
  }

  @Patch(':id')
  @Auth()
  @ApiOperation({ summary: 'Actualizar rol' })
  async update(@Param('id') id: string, @Body() dto: UpdateRolDto, @GetUser() user: any) {
    const anterior = await this.rolesService.findById(id);
    const result = await this.rolesService.update(id, dto);
    this.auditoria.registrarDesdeUsuario(user, {
      accion: 'rol.editar',
      modulo: 'roles',
      descripcion: `Rol editado: ${anterior.nombre}`,
      recursoId: id,
      recursoTipo: 'Rol',
      datosAnteriores: { nombre: anterior.nombre, permisos: anterior.permisos },
      datosNuevos: dto,
      severidad: 'critical',
    });
    return result;
  }

  @Delete(':id')
  @Auth()
  @ApiOperation({ summary: 'Eliminar rol (solo personalizados)' })
  async delete(@Param('id') id: string, @GetUser() user: any) {
    const rol = await this.rolesService.findById(id);
    const result = await this.rolesService.delete(id);
    this.auditoria.registrarDesdeUsuario(user, {
      accion: 'rol.eliminar',
      modulo: 'roles',
      descripcion: `Rol eliminado: ${rol.nombre}`,
      recursoId: id,
      recursoTipo: 'Rol',
      datosAnteriores: { nombre: rol.nombre, slug: rol.slug },
      severidad: 'critical',
    });
    return result;
  }
}
