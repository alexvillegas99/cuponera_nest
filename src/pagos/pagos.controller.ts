import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PagosService } from './pagos.service';
import { Auth, AuthUsuario } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators';

@ApiTags('Pagos')
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  /** Un cliente siempre paga a su nombre (se ignora el clienteId del body). */
  private conCliente(body: any, user: any) {
    return user?.kind === 'CLIENTE' ? { ...body, clienteId: String(user._id) } : body;
  }

  // ── Estado general ──
  @Get('metodos')
  @ApiOperation({ summary: 'Métodos de pago activos (payphone, paypal)' })
  metodosPago() {
    return this.pagosService.metodosPago();
  }

  @Get('estado/:clientTransactionId')
  @Auth()
  @ApiOperation({ summary: 'Consultar estado de un pago' })
  consultarEstado(@Param('clientTransactionId') id: string, @GetUser() user: any) {
    return this.pagosService.consultarEstado(id, user);
  }

  // ── Admin: pagos cobrados que necesitan atención ──
  @Get('admin/por-atender')
  @AuthUsuario('solicitudes.aprobar')
  @ApiOperation({ summary: 'Pagos aprobados sin cupón o en revisión' })
  porAtender() {
    return this.pagosService.pagosPorAtender();
  }

  @Post('admin/:id/reemitir')
  @AuthUsuario('solicitudes.aprobar')
  @ApiOperation({ summary: 'Reintentar la emisión del cupón de un pago aprobado (idempotente)' })
  reemitir(@Param('id') id: string) {
    if (!/^[a-f0-9]{24}$/i.test(String(id))) throw new BadRequestException('Id inválido');
    return this.pagosService.emitirCuponDePago(id).then((estado) => ({ estado }));
  }

  @Post('admin/:id/resolver')
  @AuthUsuario('solicitudes.aprobar')
  @ApiOperation({ summary: 'Resolver un pago en REVISION: aprobar (emite cupón) o rechazar' })
  resolver(@Param('id') id: string, @Body() body: { accion: 'aprobar' | 'rechazar'; nota?: string }) {
    if (!/^[a-f0-9]{24}$/i.test(String(id))) throw new BadRequestException('Id inválido');
    if (body?.accion !== 'aprobar' && body?.accion !== 'rechazar') {
      throw new BadRequestException("accion debe ser 'aprobar' o 'rechazar'");
    }
    return this.pagosService.resolverRevision(id, body.accion, body.nota);
  }

  // ── PayPhone ──
  @Post('payphone/iniciar')
  @Auth()
  @ApiOperation({ summary: 'Inicia pago PayPhone — retorna URL del formulario web' })
  iniciarPayPhone(@Body() body: any, @GetUser() user: any) {
    return this.pagosService.iniciarPayPhone(this.conCliente(body, user));
  }

  @Get('payphone/formulario')
  @ApiOperation({ summary: 'Página HTML con el widget de PayPhone (pública)' })
  async formularioPayPhone(@Query('txn') txn: string, @Res() res: Response) {
    const html = await this.pagosService.generarHtmlFormulario(txn);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('payphone/resultado')
  @ApiOperation({ summary: 'Resultado del pago — PayPhone redirige aquí (público)' })
  async resultadoPayPhone(
    @Query('id') id: string,
    @Query('clientTransactionId') clientTransactionId: string,
    @Res() res: Response,
  ) {
    const html = await this.pagosService.confirmarPagoPayPhone(id, clientTransactionId);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Post('payphone/webhook')
  @ApiOperation({ summary: 'Webhook legado de PayPhone (público)' })
  webhookPayPhone(@Body() body: any) {
    return this.pagosService.procesarWebhook(body);
  }

  // ── PayPal ──
  @Post('paypal/crear')
  @Auth()
  @ApiOperation({ summary: 'Crear orden de pago PayPal' })
  crearOrdenPayPal(@Body() body: any, @GetUser() user: any) {
    return this.pagosService.crearOrdenPayPal(this.conCliente(body, user));
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
  crearTransaccion(@Body() body: any, @GetUser() user: any) {
    return this.pagosService.iniciarPayPhone(this.conCliente(body, user));
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
