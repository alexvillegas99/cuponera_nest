import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { ContratosService } from './contratos.service';

/** Obtiene la IP real del cliente considerando el proxy/nginx (x-forwarded-for). */
function extraerIp(req: any): string | null {
  return (
    (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req?.ip ||
    req?.connection?.remoteAddress ||
    null
  );
}

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
    if (rol !== 'admin-local') {
      return {
        aceptado: true,
        contratoUrl: null,
        cedulaUrl: null,
        contratoVersion: null,
        contratoAceptadoEn: null,
        datosFaltantes: [],
        omisionesUsadas: 0,
        omisionesRestantes: 0,
        datosLocal: null,
      };
    }
    return this.service.miEstado(String(user._id));
  }

  /**
   * Registra que el admin-local pulsó "Omitir por ahora". Tope duro en el
   * service (3 veces). Devuelve el nuevo contador y las restantes.
   */
  @Post('omitir')
  @Auth()
  @ApiOperation({
    summary: 'Posponer la firma del contrato (máx. 3 veces por usuario)',
  })
  omitir(@GetUser() user: any) {
    const rol = String(user?.rol || '').toLowerCase();
    if (rol !== 'admin-local') {
      return { omisionesUsadas: 0, omisionesRestantes: 0 };
    }
    return this.service.omitir(String(user._id));
  }

  /**
   * Genera y envía por email un OTP de 6 dígitos para firmar el contrato.
   * El código expira a los 5 minutos y se consume al firmar.
   */
  @Post('solicitar-otp')
  @Auth()
  @ApiOperation({ summary: 'Solicitar código OTP para firmar el contrato' })
  solicitarOtp(@GetUser() user: any, @Req() req: any) {
    return this.service.solicitarOtp(String(user._id), { ip: extraerIp(req) });
  }

  @Post('aceptar')
  @Auth()
  @ApiOperation({
    summary: 'Firmar el contrato — valida OTP y genera PDF con QR + sube a S3',
  })
  aceptar(
    @GetUser() user: any,
    @Req() req: any,
    @Body()
    body: {
      cedulaBase64: string;
      selfieBase64?: string;
      datosLocal: {
        ruc?: string;
        direccion?: string;
        representanteLegal?: string;
        cedulaRepresentante?: string;
        estadoCivilRepresentante?: string;
        celular?: string;
      };
      aceptaTerminos: boolean;
      otp: string;
    },
  ) {
    return this.service.aceptar(String(user._id), body, { ip: extraerIp(req) });
  }
}
