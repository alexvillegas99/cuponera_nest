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
import axios from 'axios';

@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(
    @InjectModel(Pago.name) private readonly pagoModel: Model<PagoDocument>,
    private readonly configService: ConfiguracionService,
    private readonly solicitudService: SolicitudCuponeraService,
  ) {}

  /**
   * Obtiene la configuración de PayPhone desde la BD
   */
  private async getPayPhoneConfig() {
    const token = await this.configService.findByClave('payphone_token');
    const activo = await this.configService.findByClave('payphone_activo');

    return {
      token: token?.valor ?? '',
      activo: activo?.valor === 'true',
    };
  }

  /**
   * Crea una transacción de pago en PayPhone
   */
  async crearTransaccion(data: {
    clienteId: string;
    nombreCliente: string;
    emailCliente: string;
    telefonoCliente?: string;
    cuponeraNombre: string;
    cuponeraPrecio: string;
    responseUrl: string;
    cancellationUrl: string;
  }) {
    const config = await this.getPayPhoneConfig();
    if (!config.activo || !config.token) {
      throw new BadRequestException('PayPhone no está configurado o no está activo');
    }

    const monto = Math.round(parseFloat(data.cuponeraPrecio) * 100); // en centavos
    if (isNaN(monto) || monto <= 0) {
      throw new BadRequestException('Precio de cuponera inválido');
    }

    // Crear registro local
    const clientTransactionId = `ENJ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const pago = await this.pagoModel.create({
      cliente: new Types.ObjectId(data.clienteId),
      cuponeraNombre: data.cuponeraNombre,
      cuponeraPrecio: data.cuponeraPrecio,
      monto: monto / 100,
      clientTransactionId,
      status: 'PENDIENTE',
    });

    // Llamar a PayPhone API
    try {
      const response = await axios.post(
        'https://pay.payphonetodoesposible.com/api/v2/transaction/Create',
        {
          amount: monto,
          amountWithoutTax: monto,
          clientTransactionId,
          responseUrl: data.responseUrl,
          cancellationUrl: data.cancellationUrl,
          email: data.emailCliente,
          phoneNumber: data.telefonoCliente || '',
          documentId: '',
          reference: `Cuponera: ${data.cuponeraNombre}`,
        },
        {
          headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const payPhoneData = response.data;

      // Actualizar pago con transactionId de PayPhone
      await this.pagoModel.findByIdAndUpdate(pago._id, {
        transactionId: payPhoneData.transactionId?.toString() ?? null,
      });

      return {
        pagoId: pago._id,
        paymentUrl: payPhoneData.payWithCard ?? payPhoneData.paymentUrl,
        transactionId: payPhoneData.transactionId,
        clientTransactionId,
      };
    } catch (error) {
      this.logger.error(`Error PayPhone: ${error.response?.data ?? error.message}`);
      await this.pagoModel.findByIdAndUpdate(pago._id, { status: 'ERROR' });
      throw new BadRequestException(
        `Error al crear transacción: ${error.response?.data?.message ?? error.message}`,
      );
    }
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
    const resp = await axios.post(
      `${config.baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: { username: config.clientId, password: config.secret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    return resp.data.access_token;
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
    const config = await this.getPayPalConfig();
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

    try {
      const accessToken = await this.getPayPalAccessToken(config);

      const orderResp = await axios.post(
        `${config.baseUrl}/v2/checkout/orders`,
        {
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
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const order = orderResp.data;
      const approveLink = order.links?.find((l: any) => l.rel === 'approve');

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
      this.logger.error(`Error PayPal: ${error.response?.data ?? error.message}`);
      await this.pagoModel.findByIdAndUpdate(pago._id, { status: 'ERROR' });
      throw new BadRequestException(
        `Error al crear orden PayPal: ${JSON.stringify(error.response?.data?.details ?? error.message)}`,
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
