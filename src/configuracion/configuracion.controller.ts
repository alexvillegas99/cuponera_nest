import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfiguracionService } from './configuracion.service';

@ApiTags('Configuracion')
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly service: ConfiguracionService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las configuraciones' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':clave')
  @ApiOperation({ summary: 'Obtener configuración por clave' })
  findByClave(@Param('clave') clave: string) {
    return this.service.findByClave(clave);
  }

  @Patch(':clave')
  @ApiOperation({ summary: 'Crear o actualizar una configuración' })
  upsert(
    @Param('clave') clave: string,
    @Body() body: { valor: string; descripcion?: string },
  ) {
    return this.service.upsert(clave, body);
  }

  @Delete(':clave')
  @ApiOperation({ summary: 'Eliminar una configuración' })
  remove(@Param('clave') clave: string) {
    return this.service.remove(clave);
  }
}
 