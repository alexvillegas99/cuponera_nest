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
import { VersionCuponeraService } from 'src/version-cuponera/version-cuponera.service';
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
    private readonly versionService: VersionCuponeraService,
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

  // ═══════════════════ Núcleo seguro (Fase 2) ═══════════════════

  /** URL base de la API de PayPhone (configurable para pruebas locales). */
  private get payphoneApi(): string {
    return process.env.PAYPHONE_API_URL || 'https://pay.payphonetodoesposible.com';
  }

  /** Precio REAL de la cuponera (de la versión activa), nunca el del cliente. */
  private async precioServidor(cuponeraNombre: string): Promise<{ nombre: string; precio: string; monto: number; versionId: string }> {
    const version = await this.versionService.buscarActivaPorNombreExacto(cuponeraNombre);
    if (!version) {
      throw new BadRequestException('La cuponera no existe o no está a la venta');
    }
    const monto = Number.parseFloat(String(version.precio ?? '').replace(',', '.'));
    if (!Number.isFinite(monto) || monto <= 0) {
      throw new BadRequestException('La cuponera no tiene un precio válido');
    }
    return { nombre: version.nombre, precio: monto.toFixed(2), monto: Math.round(monto * 100) / 100, versionId: String(version._id) };
  }

  /** Escapa texto para insertarlo en HTML o en un string JS entre comillas simples. */
  private esc(v: unknown): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\\/g, '&#92;');
  }

  /** Pregunta a PayPhone el estado real de la transacción (fuente de verdad). */
  private async verificarPayPhone(id: string | number, clientTransactionId: string) {
    const config = await this.getPayPhoneConfig();
    const resp = await axios.post(
      `${this.payphoneApi}/api/button/V2/Confirm`,
      { id: Number.parseInt(String(id), 10), clientTxId: clientTransactionId },
      { headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' }, timeout: 15000 },
    );
    return resp.data ?? {};
  }

  /**
   * Aplica el resultado VERIFICADO de un pago.
   * - APROBADO: transición atómica; luego se emite el cupón (idempotente).
   * - REVISION: el proveedor cobró pero algo no cuadra (monto/moneda/ref):
   *   nunca se marca rechazado; queda para revisión manual.
   * - RECHAZADO: solo si no estaba APROBADO ni en REVISION.
   */
  private async aplicarResultado(
    pagoId: any,
    r: { tipo: 'APROBADO' | 'RECHAZADO' | 'REVISION'; statusCode?: number; transactionId?: string; referencia: string; motivo?: string },
  ): Promise<'EMITIDO' | 'YA_PROCESADO' | 'RECHAZADO' | 'REVISION' | 'ERROR' | 'EN_CURSO' | 'NO_APROBADO' | 'ANTERIOR'> {
    if (r.tipo === 'APROBADO') {
      const claimed = await this.pagoModel.findOneAndUpdate(
        { _id: pagoId, status: { $nin: ['APROBADO'] } },
        {
          $set: {
            status: 'APROBADO',
            statusCode: r.statusCode ?? 3,
            ...(r.transactionId ? { transactionId: r.transactionId } : {}),
            fechaPago: new Date(),
            cuponEstado: 'PENDIENTE',
            cuponIntentoEn: null,
            observacionReferencia: r.referencia,
          },
        },
        { new: true },
      );
      // Ganara o no la transición, asegurar el cupón (idempotente).
      const res = await this.emitirCuponDePago(pagoId, r.referencia);
      return claimed ? res : res === 'EMITIDO' ? 'YA_PROCESADO' : res;
    }
    if (r.tipo === 'REVISION') {
      await this.pagoModel.updateOne(
        { _id: pagoId, status: { $nin: ['APROBADO', 'REVISION'] } },
        { $set: { status: 'REVISION', statusCode: r.statusCode ?? 0, revisionMotivo: r.motivo ?? 'No cuadra con el proveedor', fechaPago: new Date() } },
      );
      this.logger.error(`[Pagos] Pago ${pagoId} en REVISION: ${r.motivo}`);
      return 'REVISION';
    }
    const res = await this.pagoModel.updateOne(
      { _id: pagoId, status: { $nin: ['APROBADO', 'RECHAZADO', 'REVISION'] } },
      {
        $set: {
          status: 'RECHAZADO',
          statusCode: r.statusCode ?? 2,
          ...(r.transactionId ? { transactionId: r.transactionId } : {}),
          fechaPago: new Date(),
        },
      },
    );
    if (res.modifiedCount === 1) {
      const pago: any = await this.pagoModel.findById(pagoId).lean();
      const clienteId = pago?.cliente?.toString();
      if (clienteId) {
        const fcmToken = await this.clientesService.obtenerFcmToken(clienteId).catch(() => null);
        await this.notificacionesService
          .enviarAToken(fcmToken, 'Pago no completado', `Tu pago por "${pago.cuponeraNombre}" no fue aprobado. Intenta de nuevo.`)
          .catch(() => undefined);
      }
    }
    return 'RECHAZADO';
  }

  /**
   * Emite el cupón de un pago APROBADO una sola vez. Se puede llamar las
   * veces que sea (redirect, webhook, captura, admin): reclama la emisión de
   * forma atómica y reutiliza la solicitud si ya existe.
   */
  async emitirCuponDePago(pagoId: any, referencia?: string): Promise<'EMITIDO' | 'ERROR' | 'EN_CURSO' | 'NO_APROBADO' | 'ANTERIOR'> {
    const hace2min = new Date(Date.now() - 2 * 60 * 1000);
    // Pagos aprobados ANTES de este cambio (sin cuponEstado) ya emitieron su
    // cupón con el flujo viejo: nunca se reemiten automáticamente.
    const previo: any = await this.pagoModel.findById(pagoId).lean();
    if (!previo) throw new NotFoundException('Pago no encontrado');
    if (previo.status !== 'APROBADO') return 'NO_APROBADO';
    if (previo.cuponEstado == null) return 'ANTERIOR';
    const pago: any = await this.pagoModel.findOneAndUpdate(
      {
        _id: pagoId,
        status: 'APROBADO',
        $or: [
          { cuponEstado: { $in: ['PENDIENTE', 'ERROR'] }, $or: [{ cuponIntentoEn: null }, { cuponIntentoEn: { $lt: hace2min } }] },
          // Un intento que se quedó a medias (proceso caído) se retoma.
          { cuponEstado: 'EMITIENDO', cuponIntentoEn: { $lt: hace2min } },
        ],
      },
      { $set: { cuponEstado: 'EMITIENDO', cuponIntentoEn: new Date() } },
      { new: true },
    );
    if (!pago) {
      const actual: any = await this.pagoModel.findById(pagoId).lean();
      return actual?.cuponEstado === 'EMITIDO' ? 'EMITIDO' : 'EN_CURSO';
    }

    const ref = referencia ?? (pago as any).observacionReferencia ?? `Pago ${pago.clientTransactionId}`;
    try {
      let solicitudId = pago.solicitudId ? String(pago.solicitudId) : null;
      if (!solicitudId) {
        const solicitud: any = await this.solicitudService.create({
          cliente: pago.cliente,
          nombreCliente: pago.nombreCliente ?? '',
          emailCliente: pago.emailCliente ?? '',
          cuponeraNombre: pago.cuponeraNombre,
          cuponeraPrecio: pago.cuponeraPrecio,
          montoTransferido: pago.monto.toString(),
          observaciones: `Pago ${ref}`,
          versionId: pago.versionId ?? null,
          esRegalo: pago.esRegalo === true,
          destinatarioId: pago.esRegalo ? pago.destinatarioId : undefined,
          destinatarioNombre: pago.esRegalo ? pago.destinatarioNombre : undefined,
          mensajeRegalo: pago.esRegalo ? pago.mensajeRegalo : undefined,
        });
        solicitudId = String(solicitud._id);
        // Enlazar de inmediato: un reintento reutiliza esta solicitud.
        await this.pagoModel.updateOne({ _id: pago._id }, { $set: { solicitudId: solicitud._id } });
      }

      const solicitud: any = await this.solicitudService.findById(solicitudId).catch(() => null);
      let cupon: any;
      if (solicitud?.estado === EstadoSolicitud.APROBADO) {
        cupon = await this.solicitudService.emitirCupon(solicitudId);
      } else {
        const res: any = await this.solicitudService.updateEstado(solicitudId, EstadoSolicitud.APROBADO, `Pago confirmado: ${ref}`);
        if (res?.error) throw new Error(res.error);
        cupon = res?.cuponCreado;
      }
      if (!cupon?._id) throw new Error('La aprobación no generó el cupón');

      await this.pagoModel.updateOne(
        { _id: pago._id },
        { $set: { cuponEstado: 'EMITIDO', cuponError: null } },
      );
      return 'EMITIDO';
    } catch (error) {
      this.logger.error(`[Pagos] Pago ${pago.clientTransactionId} aprobado SIN cupón: ${error.message}`);
      await this.pagoModel.updateOne(
        { _id: pago._id },
        { $set: { cuponEstado: 'ERROR', cuponError: String(error.message).slice(0, 500) } },
      );
      return 'ERROR';
    }
  }

  /**
   * Admin resuelve un pago en REVISION (cobrado pero no cuadraba):
   * 'aprobar' → APROBADO + emite cupón; 'rechazar' → RECHAZADO (reembolso manual).
   */
  async resolverRevision(pagoId: string, accion: 'aprobar' | 'rechazar', nota?: string) {
    const nuevo = accion === 'aprobar' ? 'APROBADO' : 'RECHAZADO';
    const pago = await this.pagoModel.findOneAndUpdate(
      { _id: pagoId, status: 'REVISION' },
      {
        $set: {
          status: nuevo,
          revisionMotivo: `${nota ?? ''} [resuelto: ${accion}]`.trim(),
          ...(accion === 'aprobar' ? { cuponEstado: 'PENDIENTE', cuponIntentoEn: null } : {}),
        },
      },
      { new: true },
    );
    if (!pago) throw new BadRequestException('El pago no está en revisión');
    if (accion === 'rechazar') return { status: 'RECHAZADO' };
    const cupon = await this.emitirCuponDePago(pago._id, `Revisión manual ${pago.clientTransactionId}`);
    return { status: 'APROBADO', cupon };
  }

  /** Pagos cobrados que necesitan atención (sin cupón o en revisión). */
  async pagosPorAtender() {
    return this.pagoModel
      .find({
        $or: [
          { status: 'APROBADO', cuponEstado: { $in: ['PENDIENTE', 'ERROR', 'EMITIENDO'] } },
          { status: 'REVISION' },
        ],
      })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();
  }

  /** Confirma un pago PayPhone consultando al proveedor y validando que sea ESTE pago. */
  private async confirmarPayPhoneVerificado(pago: any, providerId: string | number) {
    if (pago.metodo && pago.metodo !== 'payphone') {
      return { aprobado: false, resultado: 'IGNORADO', mensaje: 'Pago no corresponde a PayPhone' };
    }
    const data = await this.verificarPayPhone(providerId, pago.clientTransactionId);
    const txnOk = String(data.clientTransactionId ?? '') === String(pago.clientTransactionId);
    if (!txnOk) {
      // La respuesta es de OTRA transacción: no se toca este pago.
      this.logger.warn(`[PayPhone] Confirm de ${providerId} no corresponde a ${pago.clientTransactionId}`);
      return { aprobado: false, resultado: 'IGNORADO', mensaje: 'No se pudo verificar el pago' };
    }
    const montoOk = Number(data.amount) === Math.round(Number(pago.monto) * 100);
    const tipo = data.statusCode === 3 ? (montoOk ? 'APROBADO' : 'REVISION') : 'RECHAZADO';
    const resultado = await this.aplicarResultado(pago._id, {
      tipo,
      statusCode: data.statusCode,
      transactionId: data.transactionId?.toString(),
      referencia: `PayPhone #${data.transactionId ?? providerId}`,
      motivo: tipo === 'REVISION' ? `Monto cobrado ${data.amount} ≠ esperado ${Math.round(Number(pago.monto) * 100)} (centavos)` : undefined,
    });
    return {
      aprobado: tipo === 'APROBADO',
      resultado,
      mensaje: tipo === 'APROBADO' ? 'Pago aprobado' : tipo === 'REVISION' ? 'Estamos revisando tu pago' : (data.message ?? 'Pago no aprobado'),
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
    esRegalo?: boolean;
    destinatarioId?: string;
    destinatarioNombre?: string;
    mensajeRegalo?: string;
  }): Promise<{ formularioUrl: string; clientTransactionId: string }> {
    this.logger.log(`[PayPhone] Iniciando — cliente: ${data.clienteId}, cuponera: ${data.cuponeraNombre}, precio: ${data.cuponeraPrecio}`);

    const config = await this.getPayPhoneConfig();
    if (!config.activo || !config.token) {
      throw new BadRequestException('PayPhone no está activo o no tiene token configurado');
    }
    if (!config.storeId) {
      throw new BadRequestException('Falta el StoreID de PayPhone en la configuración');
    }

    // Precio desde la versión (el que manda la app solo se registra en logs).
    const real = await this.precioServidor(data.cuponeraNombre);
    if (String(data.cuponeraPrecio ?? '') !== real.precio) {
      this.logger.warn(`[PayPhone] Precio enviado (${data.cuponeraPrecio}) ≠ precio real (${real.precio}) para "${real.nombre}"`);
    }

    const clientTransactionId = `ENJ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await this.pagoModel.create({
      cliente: new Types.ObjectId(data.clienteId),
      cuponeraNombre: real.nombre,
      cuponeraPrecio: real.precio,
      versionId: real.versionId,
      monto: real.monto,
      clientTransactionId,
      status: 'PENDIENTE',
      metodo: 'payphone',
      nombreCliente: data.nombreCliente ?? '',
      emailCliente: data.emailCliente ?? '',
      esRegalo: data.esRegalo === true,
      destinatarioId:
        data.esRegalo && data.destinatarioId
          ? new Types.ObjectId(data.destinatarioId)
          : null,
      destinatarioNombre: data.esRegalo ? (data.destinatarioNombre ?? '') : '',
      mensajeRegalo: data.esRegalo ? (data.mensajeRegalo ?? '') : '',
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
    const txn = String(clientTransactionId ?? '');
    if (!/^ENJ-[A-Za-z0-9-]{1,60}$/.test(txn)) throw new BadRequestException('Transacción no encontrada');
    const pago = await this.pagoModel.findOne({ clientTransactionId: txn, metodo: 'payphone' }).lean();
    if (!pago) throw new BadRequestException('Transacción no encontrada');
    if (pago.status !== 'PENDIENTE') throw new BadRequestException('Este pago ya fue procesado');
    // Valores dentro de <script>: JSON (y sin "<" para no cerrar la etiqueta).
    const js = (v: unknown) => JSON.stringify(v ?? '').replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

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
      <div class="cuponera-nombre">${this.esc(pago.cuponeraNombre)}</div>
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
        token: ${js(config.token)},
        clientTransactionId: ${js(pago.clientTransactionId)},
        amount: ${monto},
        amountWithoutTax: ${monto},
        tax: 0,
        storeId: ${js(config.storeId)},
        currency: 'USD',
        reference: ${js('Cuponera: ' + pago.cuponeraNombre)},
        responseUrl: ${js(responseUrl)},
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

    let aprobado = false;
    let mensaje = 'No se pudo verificar el pago';
    let cuponPendiente = false;
    // Solo transacciones nuestras y existentes (evita inyectar texto en la página).
    const txnValida = /^ENJ-[A-Za-z0-9-]{1,60}$/.test(String(clientTransactionId ?? ''));
    const pago = txnValida ? await this.pagoModel.findOne({ clientTransactionId }).lean() : null;

    if (pago && /^\d{1,20}$/.test(String(id ?? ''))) {
      try {
        let res: string;
        if (pago.status === 'APROBADO') {
          aprobado = true;
          mensaje = 'Pago aprobado';
          res = pago.cuponEstado === 'EMITIDO' ? 'EMITIDO' : await this.emitirCuponDePago(pago._id);
        } else {
          const r = await this.confirmarPayPhoneVerificado(pago, id);
          aprobado = r.aprobado;
          mensaje = r.mensaje;
          res = r.resultado;
        }
        cuponPendiente = aprobado && res !== 'EMITIDO' && res !== 'YA_PROCESADO';
      } catch (error) {
        this.logger.error(`[PayPhone] Error al confirmar: ${JSON.stringify(error.response?.data ?? error.message)}`);
        mensaje = 'No se pudo verificar el pago';
      }
    }

    const status = aprobado ? 'ok' : 'error';
    const redirectUrl = `enjoy://payphone-resultado?status=${status}&txn=${encodeURIComponent(pago?.clientTransactionId ?? '')}`;

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
  <div class="sub">${aprobado ? (cuponPendiente ? 'Pago recibido. Estamos activando tu cuponera; si en unos minutos no aparece, escríbenos.' : 'Tu cuponera ha sido activada. Vuelve a la app.') : this.esc(mensaje)}</div>
  <button class="btn" onclick="window.location.href='${redirectUrl}'">Volver a la app</button>
  <script>setTimeout(() => { window.location.href = '${redirectUrl}'; }, 3000);</script>
</body>
</html>`;
  }

  /**
   * Webhook de PayPhone — confirma o rechaza el pago
   */
  async procesarWebhook(data: any) {
    // El body NO se usa como verdad (cualquiera puede enviarlo): solo sirve
    // para saber qué pago revisar. El estado se pregunta a PayPhone.
    const clientTransactionId = String(
      data?.clientTransactionId ?? data?.ClientTransactionId ?? data?.clientTxId ?? '',
    );
    const providerId = data?.transactionId ?? data?.TransactionId ?? data?.id ?? data?.Id;
    if (!/^ENJ-[A-Za-z0-9-]{1,60}$/.test(clientTransactionId) || !/^\d{1,20}$/.test(String(providerId ?? ''))) {
      return { ok: false };
    }
    const pago = await this.pagoModel.findOne({ clientTransactionId }).lean();
    if (!pago) {
      this.logger.warn(`Webhook: pago no encontrado para txn ${clientTransactionId}`);
      return { ok: false };
    }
    if (pago.status === 'APROBADO') {
      if (pago.cuponEstado !== 'EMITIDO') await this.emitirCuponDePago(pago._id);
      return { ok: true, status: 'APROBADO' };
    }
    try {
      const r = await this.confirmarPayPhoneVerificado(pago, providerId);
      return { ok: true, status: r.aprobado ? 'APROBADO' : 'RECHAZADO' };
    } catch (error) {
      this.logger.error(`[PayPhone] Webhook: no se pudo verificar ${clientTransactionId}: ${error.message}`);
      return { ok: false };
    }
  }

  /**
   * Consultar estado de un pago
   */
  async consultarEstado(clientTransactionId: string, user?: any) {
    const pago = await this.pagoModel.findOne({ clientTransactionId }).lean();
    if (!pago) throw new NotFoundException('Pago no encontrado');
    if (user?.kind === 'CLIENTE' && String(pago.cliente) !== String(user._id)) {
      throw new NotFoundException('Pago no encontrado');
    }
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
    let baseUrl = isSandbox
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com';
    // Solo para pruebas locales contra un simulador.
    if (process.env.PAYPAL_API_URL) baseUrl = process.env.PAYPAL_API_URL;

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
    esRegalo?: boolean;
    destinatarioId?: string;
    destinatarioNombre?: string;
    mensajeRegalo?: string;
  }) {
    this.logger.log(`[PayPal] Iniciando orden — cliente: ${data.clienteId}, cuponera: ${data.cuponeraNombre}, precio: ${data.cuponeraPrecio}`);

    const config = await this.getPayPalConfig();
    this.logger.log(`[PayPal] Config — activo: ${config.activo}, sandbox: ${config.sandbox}, clientId: ${config.clientId ? '***' + config.clientId.slice(-6) : 'VACÍO'}, secret: ${config.secret ? 'SET' : 'VACÍO'}`);

    if (!config.activo || !config.clientId || !config.secret) {
      throw new BadRequestException('PayPal no está configurado o no está activo');
    }

    const real = await this.precioServidor(data.cuponeraNombre);
    if (String(data.cuponeraPrecio ?? '') !== real.precio) {
      this.logger.warn(`[PayPal] Precio enviado (${data.cuponeraPrecio}) ≠ precio real (${real.precio}) para "${real.nombre}"`);
    }
    const monto = real.monto;

    const clientTransactionId = `ENJ-PP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Registro local
    const pago = await this.pagoModel.create({
      cliente: new Types.ObjectId(data.clienteId),
      cuponeraNombre: real.nombre,
      cuponeraPrecio: real.precio,
      versionId: real.versionId,
      monto,
      clientTransactionId,
      status: 'PENDIENTE',
      metodo: 'paypal',
      nombreCliente: data.nombreCliente ?? '',
      emailCliente: data.emailCliente ?? '',
      esRegalo: data.esRegalo === true,
      destinatarioId:
        data.esRegalo && data.destinatarioId
          ? new Types.ObjectId(data.destinatarioId)
          : null,
      destinatarioNombre: data.esRegalo ? (data.destinatarioNombre ?? '') : '',
      mensajeRegalo: data.esRegalo ? (data.mensajeRegalo ?? '') : '',
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
            description: `Cuponera: ${real.nombre}`,
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

    const pago = await this.pagoModel.findOne({ transactionId: String(orderId), metodo: 'paypal' });
    if (!pago) throw new NotFoundException('Pago no encontrado');

    if (pago.status === 'APROBADO') {
      if (pago.cuponEstado !== 'EMITIDO') await this.emitirCuponDePago(pago._id);
      return { ok: true, status: 'APROBADO', message: 'Pago ya fue procesado' };
    }

    const accessToken = await this.getPayPalAccessToken(config);
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
    let order: any;
    try {
      const captureResp = await axios.post(`${config.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, { headers, timeout: 20000 });
      order = captureResp.data;
    } catch (error) {
      // Ya capturada (redirect + webhook a la vez) u otro error: leer la orden.
      try {
        const getResp = await axios.get(`${config.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`, { headers, timeout: 20000 });
        order = getResp.data;
      } catch {
        this.logger.error(`Error capturando PayPal: ${JSON.stringify(error.response?.data ?? error.message)}`);
        throw new BadRequestException('Error al capturar el pago de PayPal');
      }
    }
    return this.aplicarOrdenPayPal(pago, order, orderId);
  }

  /** Decide con la orden de PayPal ya leída/capturada. */
  private async aplicarOrdenPayPal(pago: any, order: any, orderId: string) {
    const unidad = order?.purchase_units?.[0];
    const captura = unidad?.payments?.captures?.[0];
    const capturaStatus = captura?.status;

    if (order?.status !== 'COMPLETED' || !captura) {
      // Aún sin cobro definitivo (no aprobada, o sin datos de captura).
      return { ok: false, status: pago.status };
    }
    if (capturaStatus === 'PENDING') {
      // Cobro retenido por PayPal: no se rechaza; se aplicará con el webhook
      // PAYMENT.CAPTURE.COMPLETED o en un nuevo intento.
      this.logger.warn(`[PayPal] Captura PENDING para ${pago.clientTransactionId}: ${captura?.status_details?.reason ?? ''}`);
      return { ok: true, status: 'PENDIENTE' };
    }
    if (capturaStatus !== 'COMPLETED') {
      const resultado = await this.aplicarResultado(pago._id, { tipo: 'RECHAZADO', statusCode: 2, referencia: `PayPal #${orderId}` });
      return { ok: true, status: 'RECHAZADO', resultado };
    }

    const cuadra =
      captura?.amount?.currency_code === 'USD' &&
      Number(captura?.amount?.value).toFixed(2) === Number(pago.monto).toFixed(2) &&
      (unidad?.reference_id === undefined || unidad.reference_id === pago.clientTransactionId);

    const resultado = await this.aplicarResultado(pago._id, {
      tipo: cuadra ? 'APROBADO' : 'REVISION',
      statusCode: cuadra ? 3 : 0,
      referencia: `PayPal #${orderId}`,
      motivo: cuadra ? undefined : `Captura ${JSON.stringify(captura?.amount)} ref ${unidad?.reference_id} ≠ pago ${pago.monto} USD ${pago.clientTransactionId}`,
    });
    return { ok: true, status: cuadra ? 'APROBADO' : 'REVISION', resultado };
  }

  /** Webhook de PayPal */
  async procesarWebhookPayPal(body: any) {
    // El body es solo una pista: el estado se lee de PayPal con nuestras credenciales.
    const eventType = body?.event_type;
    const resource = body?.resource;
    if (eventType !== 'CHECKOUT.ORDER.APPROVED' && eventType !== 'PAYMENT.CAPTURE.COMPLETED') {
      return { ok: true, ignored: true };
    }
    const orderId =
      eventType === 'PAYMENT.CAPTURE.COMPLETED'
        ? resource?.supplementary_data?.related_ids?.order_id
        : resource?.id;
    if (!orderId || !/^[A-Za-z0-9-]{1,64}$/.test(String(orderId))) return { ok: false };
    try {
      await this.capturarPayPal(String(orderId));
    } catch (e) {
      this.logger.error(`Webhook PayPal (${eventType}) error: ${e.message}`);
    }
    return { ok: true };
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
