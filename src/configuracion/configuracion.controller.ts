import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthUsuario } from 'src/auth/decorators/auth.decorator';
import { ConfiguracionService } from './configuracion.service';

/**
 * Lo único que se expone sin sesión (lo que leen la app y la web públicas).
 * Todo lo demás —credenciales de pago, correos internos, datos legales del
 * contrato— solo se lee desde el panel con `configuracion.ver`.
 */
const CLAVES_PUBLICAS = new Set([
  'whatsapp_numero',
  'whatsapp_mensaje',
  'cuentas_bancarias',
  'transferencia_instrucciones',
  'cuponeras_disponibles',
  'mostrar_eliminar_cuenta',
  'correo_soporte',
]);
const esPublica = (clave: string) => CLAVES_PUBLICAS.has(clave || '');

@ApiTags('Configuracion')
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly service: ConfiguracionService) {}

  @Get()
  @ApiOperation({ summary: 'Configuraciones públicas (lista blanca)' })
  async findAll() {
    const todas: any[] = (await this.service.findAll()) as any[];
    return todas.filter((c) => esPublica(c?.clave));
  }

  @Get('admin/todas')
  @AuthUsuario('configuracion.ver', 'pagos.configurar')
  @ApiOperation({ summary: 'Todas las configuraciones (panel)' })
  findAllAdmin() {
    return this.service.findAll();
  }

  @Get(':clave')
  @ApiOperation({ summary: 'Obtener configuración pública por clave' })
  findByClave(@Param('clave') clave: string) {
    if (!esPublica(clave)) throw new ForbiddenException('Configuración restringida');
    return this.service.findByClave(clave);
  }

  @Patch(':clave')
  @AuthUsuario('configuracion.editar', 'pagos.configurar')
  @ApiOperation({ summary: 'Crear o actualizar una configuración' })
  upsert(
    @Param('clave') clave: string,
    @Body() body: { valor: string; descripcion?: string },
  ) {
    return this.service.upsert(clave, body);
  }

  @Delete(':clave')
  @AuthUsuario('configuracion.eliminar')
  @ApiOperation({ summary: 'Eliminar una configuración' })
  remove(@Param('clave') clave: string) {
    return this.service.remove(clave);
  }
}
