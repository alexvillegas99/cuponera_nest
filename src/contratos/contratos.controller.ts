import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { ContratosService } from './contratos.service';

@ApiTags('Contratos')
@Controller('contratos')
export class ContratosController {
  constructor(private readonly service: ContratosService) {}

  /**
   * Devuelve el estado del contrato del usuario autenticado y los datos
   * que faltan para poder firmarlo (RUC, dirección, representante, etc.).
   * Si el usuario no es admin-local devuelve aceptado=true por compat.
   */
  @Get('mi-estado')
  @Auth()
  miEstado(@GetUser() user: any) {
    const rol = String(user?.rol || '').toLowerCase();
    // Solo bloqueamos a admin-local. Otros roles entran directo al panel.
    if (rol !== 'admin-local') {
      return {
        aceptado: true,
        contratoUrl: null,
        cedulaUrl: null,
        contratoVersion: null,
        contratoAceptadoEn: null,
        datosFaltantes: [],
        datosLocal: null,
      };
    }
    return this.service.miEstado(String(user._id));
  }

  @Post('aceptar')
  @Auth()
  @ApiOperation({ summary: 'Firmar el contrato — genera PDF + sube a S3' })
  aceptar(
    @GetUser() user: any,
    @Body()
    body: {
      cedulaBase64: string;
      datosLocal: {
        ruc?: string;
        direccion?: string;
        representanteLegal?: string;
        cedulaRepresentante?: string;
        estadoCivilRepresentante?: string;
        celular?: string;
      };
      aceptaTerminos: boolean;
    },
  ) {
    return this.service.aceptar(String(user._id), body);
  }
}
