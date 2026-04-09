import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pago, PagoDocument } from './schema/pago.schema';
import { ConfiguracionService } from 'src/configuracion/configuracion.service';
import { SolicitudCuponeraService } from 'src/solicitud-cuponera/solicitud-cuponera.service';
import { EstadoSolicitud } from 'src/solicitud-cuponera/schema/solicitud-cuponera.schema';
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';
import { ClientesService } from 'src/clientes/clientes.service';
import axios from 'axios';

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    @InjectModel(Pago.name) private readonly pagoModel: Model<PagoDocument>,
    private readonly configService: ConfiguracionService,
    private readonly solicitudService: SolicitudCuponeraService,
    private readonly notificacionesService: NotificacionesService,
    private readonly clientesService: ClientesService,
  ) {}

  /**
   * Obtiene la configuración de PayPhone desde la BD
   */
  private async getPayPhoneConfig() {
    const token = await this.configService.findByClave('payphone_token');
    const activo = await this.configService.findByClave('payphone_activo');
    const storeId = await this.configService.findByClave('payphone_store_id');

    return {
      token: token?.valor ?? '',
      activo: activo?.valor === 'true',
      storeId: storeId?.valor ?? '',
    };
  }

  /**
   * Inicia un pago PayPhone: crea el registro y retorna la URL del formulario web
   */
  async iniciarPayPhone(data: {
    clienteId: string;
    nombreCliente: string;
    emailCliente: string;
    telefonoCliente?: string;
    cuponeraNombre: string;
    cuponeraPrecio: string;
  }): Promise<{ formularioUrl: string; clientTransactionId: string }> {
    this.logger.log(`[PayPhone] Iniciando — cliente: ${data.clienteId}, cuponera: ${data.cuponeraNombre}, precio: ${data.cuponeraPrecio}`);

    const config = await this.getPayPhoneConfig();
    if (!config.activo || !config.token) {
      throw new BadRequestException('PayPhone no está activo o no tiene token configurado');
    }
    if (!config.storeId) {
      throw new BadRequestException('Falta el StoreID de PayPhone en la configuración');
    }

    const monto = Math.round(parseFloat(data.cuponeraPrecio) * 100);
    if (isNaN(monto) || monto <= 0) {
      throw new BadRequestException('Precio de cuponera inválido');
    }

    const clientTransactionId = `ENJ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await this.pagoModel.create({
      cliente: new Types.ObjectId(data.clienteId),
      cuponeraNombre: data.cuponeraNombre,
      cuponeraPrecio: data.cuponeraPrecio,
      monto: monto / 100,
      clientTransactionId,
      status: 'PENDIENTE',
      metodo: 'payphone',
    });

    const backendUrl = process.env.BACKEND_PUBLIC_URL ?? '';
    const formularioUrl = `${backendUrl}/api/pagos/payphone/formulario?txn=${clientTransactionId}`;

    this.logger.log(`[PayPhone] Formulario URL generada: ${formularioUrl}`);
    return { formularioUrl, clientTransactionId };
  }

  /**
   * Genera la página HTML con el widget de PayPhone (llamada desde el WebView)
   */
  async generarHtmlFormulario(clientTransactionId: string): Promise<string> {
    const pago = await this.pagoModel.findOne({ clientTransactionId }).lean();
    if (!pago) throw new BadRequestException('Transacción no encontrada');

    const config = await this.getPayPhoneConfig();
    const monto = Math.round(pago.monto * 100);
    const backendUrl = process.env.BACKEND_PUBLIC_URL ?? '';
    const responseUrl = `${backendUrl}/api/pagos/payphone/resultado`;

    let phoneExtra = '';
    if ((pago as any).telefono) {
      let phone = (pago as any).telefono.replace(/[\s\-().]/g, '');
      if (phone.startsWith('09') && phone.length === 10) phone = '+593' + phone.slice(1);
      else if (phone.startsWith('593')) phone = '+' + phone;
      if (phone.startsWith('+593')) {
        phoneExtra = `phoneNumber: '${phone}',`;
      }
    }

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pago seguro — Enjoy</title>
  <link rel="stylesheet" href="https://cdn.payphonetodoesposible.com/box/v1.1/payphone-payment-box.css">
  <script type="module" src="https://cdn.payphonetodoesposible.com/box/v1.1/payphone-payment-box.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #EFF2F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; }
    .header { background: #152A47; padding: 16px 20px; display: flex; align-items: center; gap: 12px; }
    .header h1 { color: #FF9F1C; font-size: 20px; font-weight: 800; letter-spacing: 1px; }
    .header span { color: rgba(255,255,255,0.6); font-size: 13px; }
    .content { padding: 24px 16px; max-width: 480px; margin: 0 auto; }
    .card { background: white; border-radius: 16px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 16px; }
    .card-title { font-size: 13px; color: #7A869A; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .cuponera-nombre { font-size: 18px; font-weight: 800; color: #152A47; }
    .precio { font-size: 28px; font-weight: 900; color: #FF9F1C; }
    .seguro { display: flex; align-items: center; gap: 6px; color: #7A869A; font-size: 12px; margin-top: 16px; justify-content: center; }
    #pp-button { margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>ENJOY</h1>
      <span>Pago seguro</span>
    </div>
  </div>
  <div class="content">
    <div class="card">
      <div class="card-title">Cuponera seleccionada</div>
      <div class="cuponera-nombre">${pago.cuponeraNombre}</div>
      <div class="precio">$${pago.monto.toFixed(2)}</div>
    </div>
    <div class="card">
      <div id="pp-button"></div>
      <div class="seguro">🔒 Pago procesado de forma segura por PayPhone</div>
    </div>
  </div>
  <script>
    window.addEventListener('DOMContentLoaded', () => {
      new PayphoneButtonBox({
        token: '${config.token}',
        clientTransactionId: '${clientTransactionId}',
        amount: ${monto},
        amountWithoutTax: ${monto},
        tax: 0,
        storeId: '${config.storeId}',
        currency: 'USD',
        reference: 'Cuponera: ${pago.cuponeraNombre}',
        responseUrl: '${responseUrl}',
        lang: 'es',
        ${phoneExtra}
      }).render('pp-button');
    });
  </script>
</body>
</html>`;
  }

  /**
   * Confirma el pago con PayPhone y retorna HTML de resultado
   */
  async confirmarPagoPayPhone(id: string, clientTransactionId: string): Promise<string> {
    this.logger.log(`[PayPhone] Confirmando — id: ${id}, txn: ${clientTransactionId}`);
    const config = await this.getPayPhoneConfig();

    let aprobado = false;
    let mensaje = '';

    try {
      const resp = await axios.post(
        'https://pay.payphonetodoesposible.com/api/button/V2/Confirm',
        { id: parseInt(id, 10), clientTxId: clientTransactionId },
        {
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const data = resp.data;
      this.logger.log(`[PayPhone] Confirm response: ${JSON.stringify(data)}`);

      aprobado = data.statusCode === 3;
      mensaje = aprobado ? 'Pago aprobado' : (data.message ?? 'Pago no aprobado');

      const pago = await this.pagoModel.findOne({ clientTransactionId });
      if (pago) {
        pago.statusCode = data.statusCode;
        pago.status = aprobado ? 'APROBADO' : 'RECHAZADO';
        pago.transactionId = data.transactionId?.toString() ?? pago.transactionId;
        pago.fechaPago = new Date();
        await pago.save();

        if (aprobado) {
          await this.crearCuponDesdePago(pago, `PayPhone #${data.transactionId}`);
        } else {
          const clienteId = pago.cliente?.toString();
          if (clienteId) {
            const fcmToken = await this.clientesService.obtenerFcmToken(clienteId);
            await this.notificacionesService.enviarAToken(
              fcmToken,
              'Pago no completado',
              `Tu pago por "${pago.cuponeraNombre}" no fue aprobado. Intenta de nuevo.`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(`[PayPhone] Error al confirmar: ${JSON.stringify(error.response?.data ?? error.message)}`);
      mensaje = 'No se pudo verificar el pago';
    }

    const status = aprobado ? 'ok' : 'error';
    const redirectUrl = `enjoy://payphone-resultado?status=${status}&txn=${clientTransactionId}`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${aprobado ? 'Pago exitoso' : 'Pago no completado'} — Enjoy</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #EFF2F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
    .icon { font-size: 64px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 800; color: #152A47; margin-bottom: 8px; text-align: center; }
    .sub { font-size: 14px; color: #7A869A; text-align: center; margin-bottom: 32px; }
    .btn { background: #FF9F1C; color: white; border: none; padding: 14px 32px; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; width: 100%; max-width: 320px; }
  </style>
</head>
<body>
  <div class="icon">${aprobado ? '✅' : '❌'}</div>
  <div class="title">${aprobado ? '¡Pago exitoso!' : 'Pago no completado'}</div>
  <div class="sub">${aprobado ? 'Tu cuponera ha sido activada. Vuelve a la app.' : mensaje}</div>
  <button class="btn" onclick="window.location.href='${redirectUrl}'">Volver a la app</button>
  <script>setTimeout(() => { window.location.href = '${redirectUrl}'; }, 3000);</script>
</body>
</html>`;
  }

  /**
   * Webhook de PayPhone — confirma o rechaza el pago
   */
  async procesarWebhook(data: any) {
    const { clientTransactionId, transactionId, statusCode, transactionStatus } = data;

    const pago = await this.pagoModel.findOne({
      $or: [
        { clientTransactionId },
        { transactionId: transactionId?.toString() },
      ],
    });

    if (!pago) {
      this.logger.warn(`Webhook: pago no encontrado para txn ${clientTransactionId}`);
      return { ok: false };
    }

    pago.statusCode = statusCode;
    pago.status = statusCode === 3 ? 'APROBADO' : 'RECHAZADO';
    pago.transactionId = transactionId?.toString() ?? pago.transactionId;
    pago.fechaPago = new Date();
    await pago.save();

    // Si aprobado, crear solicitud y cupón automáticamente
    if (statusCode === 3) {
      await this.crearCuponDesdePago(pago, `PayPhone #${transactionId}`);
    }

    return { ok: true, status: pago.status };
  }

  /**
   * Consultar estado de un pago
   */
  async consultarEstado(clientTransactionId: string) {
    const pago = await this.pagoModel.findOne({ clientTransactionId }).lean();
    if (!pago) throw new NotFoundException('Pago no encontrado');
    return {
      status: pago.status,
      statusCode: pago.statusCode,
      fechaPago: pago.fechaPago,
    };
  }

  /** Verifica si PayPhone está activo */
  async estaActivo(): Promise<boolean> {
    const config = await this.getPayPhoneConfig();
    return config.activo && config.token.length > 0;
  }

  // ═══════════════════════════════════════════════════
  // PAYPAL
  // ═══════════════════════════════════════════════════

  private async getPayPalConfig() {
    const clientId = await this.configService.findByClave('paypal_client_id');
    const secret = await this.configService.findByClave('paypal_secret');
    const activo = await this.configService.findByClave('paypal_activo');
    const sandbox = await this.configService.findByClave('paypal_sandbox');

    const isSandbox = sandbox?.valor !== 'false';
    const baseUrl = isSandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';

    return {
      clientId: clientId?.valor ?? '',
      secret: secret?.valor ?? '',
      activo: activo?.valor === 'true',
      sandbox: isSandbox,
      baseUrl,
    };
  }

  /** Obtiene access token de PayPal via OAuth2 */
  private async getPayPalAccessToken(config: {
    clientId: string;
    secret: string;
    baseUrl: string;
  }): Promise<string> {
    try {
      const resp = await axios.post(
        `${config.baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: { username: config.clientId, password: config.secret },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      return resp.data.access_token;
    } catch (error) {
      const status = error.response?.status;
      if (status === 401) {
        throw new BadRequestException(
          'Las credenciales de PayPal son inválidas. Verifica el Client ID y Secret en la configuración.',
        );
      }
      throw new BadRequestException(
        `No se pudo conectar con PayPal: ${error.message}`,
      );
    }
  }

  /** Crear orden de pago en PayPal */
  async crearOrdenPayPal(data: {
    clienteId: string;
    nombreCliente: string;
    emailCliente: string;
    cuponeraNombre: string;
    cuponeraPrecio: string;
    returnUrl: string;
    cancelUrl: string;
  }) {
    this.logger.log(`[PayPal] Iniciando orden — cliente: ${data.clienteId}, cuponera: ${data.cuponeraNombre}, precio: ${data.cuponeraPrecio}`);

    const config = await this.getPayPalConfig();
    this.logger.log(`[PayPal] Config — activo: ${config.activo}, sandbox: ${config.sandbox}, clientId: ${config.clientId ? '***' + config.clientId.slice(-6) : 'VACÍO'}, secret: ${config.secret ? 'SET' : 'VACÍO'}`);

    if (!config.activo || !config.clientId || !config.secret) {
      throw new BadRequestException('PayPal no está configurado o no está activo');
    }

    const monto = parseFloat(data.cuponeraPrecio);
    if (isNaN(monto) || monto <= 0) {
      throw new BadRequestException('Precio de cuponera inválido');
    }

    const clientTransactionId = `ENJ-PP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Registro local
    const pago = await this.pagoModel.create({
      cliente: new Types.ObjectId(data.clienteId),
      cuponeraNombre: data.cuponeraNombre,
      cuponeraPrecio: data.cuponeraPrecio,
      monto,
      clientTransactionId,
      status: 'PENDIENTE',
      metodo: 'paypal',
    });
    this.logger.log(`[PayPal] Pago local creado — id: ${pago._id}, txn: ${clientTransactionId}`);

    try {
      this.logger.log(`[PayPal] Obteniendo access token desde: ${config.baseUrl}`);
      const accessToken = await this.getPayPalAccessToken(config);
      this.logger.log(`[PayPal] Access token obtenido OK`);

      const orderBody = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: clientTransactionId,
            description: `Cuponera: ${data.cuponeraNombre}`,
            amount: {
              currency_code: 'USD',
              value: monto.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: data.returnUrl,
          cancel_url: data.cancelUrl,
          brand_name: 'Enjoy',
          user_action: 'PAY_NOW',
        },
      };
      this.logger.log(`[PayPal] Creando orden → ${JSON.stringify(orderBody)}`);

      const orderResp = await axios.post(
        `${config.baseUrl}/v2/checkout/orders`,
        orderBody,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const order = orderResp.data;
      const approveLink = order.links?.find((l: any) => l.rel === 'approve');
      this.logger.log(`[PayPal] Orden creada OK — id: ${order.id}, approveUrl: ${approveLink?.href}`);

      await this.pagoModel.findByIdAndUpdate(pago._id, {
        transactionId: order.id,
      });

      return {
        pagoId: pago._id,
        orderId: order.id,
        approveUrl: approveLink?.href,
        clientTransactionId,
      };
    } catch (error) {
      // Si ya es un BadRequestException (ej: credenciales inválidas), relanzar directo
      if (error instanceof BadRequestException) {
        await this.pagoModel.findByIdAndUpdate(pago._id, { status: 'ERROR' });
        throw error;
      }
      this.logger.error(`[PayPal] Error status: ${error.response?.status}`);
      this.logger.error(`[PayPal] Error body: ${JSON.stringify(error.response?.data ?? error.message)}`);
      await this.pagoModel.findByIdAndUpdate(pago._id, { status: 'ERROR' });
      throw new BadRequestException(
        'No se pudo crear la orden de pago. Intenta de nuevo.',
      );
    }
  }

  /** Capturar pago PayPal después de que el usuario aprueba */
  async capturarPayPal(orderId: string) {
    const config = await this.getPayPalConfig();
    if (!config.activo) {
      throw new BadRequestException('PayPal no está activo');
    }

    const pago = await this.pagoModel.findOne({ transactionId: orderId });
    if (!pago) throw new NotFoundException('Pago no encontrado');

    if (pago.status === 'APROBADO') {
      return { ok: true, status: 'APROBADO', message: 'Pago ya fue procesado' };
    }

    try {
      const accessToken = await this.getPayPalAccessToken(config);

      const captureResp = await axios.post(
        `${config.baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const capture = captureResp.data;
      const completed = capture.status === 'COMPLETED';

      pago.statusCode = completed ? 3 : 2;
      pago.status = completed ? 'APROBADO' : 'RECHAZADO';
      pago.fechaPago = new Date();
      await pago.save();

      if (completed) {
        await this.crearCuponDesdePago(pago, `PayPal #${orderId}`);
      }

      return { ok: true, status: pago.status };
    } catch (error) {
      this.logger.error(`Error capturando PayPal: ${error.response?.data ?? error.message}`);
      throw new BadRequestException('Error al capturar el pago de PayPal');
    }
  }

  /** Webhook de PayPal */
  async procesarWebhookPayPal(body: any) {
    const eventType = body.event_type;
    const resource = body.resource;

    if (eventType !== 'CHECKOUT.ORDER.APPROVED' && eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
      return { ok: true, ignored: true };
    }

    const orderId = resource?.id ?? resource?.supplementary_data?.related_ids?.order_id;
    if (!orderId) return { ok: false };

    // Intentar capturar si es aprobación
    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      try {
        await this.capturarPayPal(orderId);
      } catch (e) {
        this.logger.error(`Webhook PayPal capture error: ${e.message}`);
      }
    }

    return { ok: true };
  }

  /** Crea solicitud + cupón desde un pago aprobado (compartido PayPhone/PayPal) */
  private async crearCuponDesdePago(pago: any, referencia: string) {
    try {
      const solicitud: any = await this.solicitudService.create({
        cliente: pago.cliente,
        nombreCliente: '',
        emailCliente: '',
        cuponeraNombre: pago.cuponeraNombre,
        cuponeraPrecio: pago.cuponeraPrecio,
        montoTransferido: pago.monto.toString(),
        observaciones: `Pago ${referencia}`,
      });

      await this.solicitudService.updateEstado(
        solicitud._id.toString(),
        EstadoSolicitud.APROBADO,
        `Pago confirmado: ${referencia}`,
      );

      pago.solicitudId = solicitud._id;
      await pago.save();

      // Notificación pago exitoso
      const clienteId = pago.cliente?.toString();
      if (clienteId) {
        const fcmToken = await this.clientesService.obtenerFcmToken(clienteId);
        await this.notificacionesService.enviarAToken(
          fcmToken,
          '¡Pago exitoso! 🎉',
          `Tu cuponera "${pago.cuponeraNombre}" está lista para usar.`,
        );
      }
    } catch (error) {
      this.logger.error(`Error creando cupón post-pago: ${error.message}`);
    }
  }

  /** Verifica si PayPal está activo */
  async paypalActivo(): Promise<boolean> {
    const config = await this.getPayPalConfig();
    return config.activo && config.clientId.length > 0;
  }

  /** Retorna estado de todos los métodos de pago */
  async metodosPago(): Promise<{ payphone: boolean; paypal: boolean }> {
    const [pp, pal] = await Promise.all([
      this.estaActivo(),
      this.paypalActivo(),
    ]);
    return { payphone: pp, paypal: pal };
  }
}
