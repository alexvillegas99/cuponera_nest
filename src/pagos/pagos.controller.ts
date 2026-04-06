import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PagosService } from './pagos.service';
import { Auth } from 'src/auth/decorators/auth.decorator';

@ApiTags('Pagos')
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  // ── Estado general ──
  @Get('metodos')
  @ApiOperation({ summary: 'Métodos de pago activos (payphone, paypal)' })
  metodosPago() {
    return this.pagosService.metodosPago();
  }

  @Get('estado/:clientTransactionId')
  @Auth()
  @ApiOperation({ summary: 'Consultar estado de un pago' })
  consultarEstado(@Param('clientTransactionId') id: string) {
    return this.pagosService.consultarEstado(id);
  }

  // ── PayPhone ──
  @Post('payphone/crear')
  @Auth()
  @ApiOperation({ summary: 'Crear transacción PayPhone' })
  crearTransaccionPayPhone(@Body() body: any) {
    return this.pagosService.crearTransaccion(body);
  }

  @Post('payphone/webhook')
  @ApiOperation({ summary: 'Webhook de PayPhone (público)' })
  webhookPayPhone(@Body() body: any) {
    return this.pagosService.procesarWebhook(body);
  }

  // ── PayPal ──
  @Post('paypal/crear')
  @Auth()
  @ApiOperation({ summary: 'Crear orden de pago PayPal' })
  crearOrdenPayPal(@Body() body: any) {
    return this.pagosService.crearOrdenPayPal(body);
  }

  @Post('paypal/capturar/:orderId')
  @Auth()
  @ApiOperation({ summary: 'Capturar pago PayPal después de aprobación' })
  capturarPayPal(@Param('orderId') orderId: string) {
    return this.pagosService.capturarPayPal(orderId);
  }

  @Post('paypal/webhook')
  @ApiOperation({ summary: 'Webhook de PayPal (público)' })
  webhookPayPal(@Body() body: any) {
    return this.pagosService.procesarWebhookPayPal(body);
  }

  // ── Legacy (mantener compatibilidad) ──
  @Post('crear')
  @Auth()
  @ApiOperation({ summary: 'Crear transacción PayPhone (legacy)' })
  crearTransaccion(@Body() body: any) {
    return this.pagosService.crearTransaccion(body);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook PayPhone (legacy)' })
  webhook(@Body() body: any) {
    return this.pagosService.procesarWebhook(body);
  }

  @Get('activo')
  @ApiOperation({ summary: 'Verificar si PayPhone está activo (legacy)' })
  estaActivo() {
    return this.pagosService.estaActivo();
  }
}
