// src/empresas-solicitudes/empresas-solicitudes.controller.ts
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
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EmpresasSolicitudesService } from './empresas-solicitudes.service';
import { SolicitudEstado } from './schema/empresa-solicitud.schema';

@ApiTags('Empresas - Solicitudes')
@Controller('empresas/solicitudes')
export class EmpresasSolicitudesController {
  constructor(private readonly service: EmpresasSolicitudesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear solicitud de empresa' })
  @ApiResponse({
    status: 201,
    description: 'Solicitud creada',
  })
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Get('check-email')
  @ApiOperation({ summary: 'Verificar si un email ya tiene solicitud' })
  @ApiQuery({ name: 'email', required: true })
  async checkEmail(@Query('email') email: string) {
    return this.service.checkEmailAvailability(email);
  }

  @Get()
  @ApiOperation({ summary: 'Listar solicitudes (opcional: por estado)' })
  @ApiQuery({ name: 'estado', required: false, enum: SolicitudEstado })
  findAll(@Query('estado') estado?: any) {
    return this.service.findAll(estado);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una solicitud por ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar solicitud (ej. estado, notas)' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar solicitud' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
