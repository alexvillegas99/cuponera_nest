import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import PDFDocument = require('pdfkit');
import { Usuario, UsuarioDocument } from 'src/usuarios/schema/usuario.schema';
import { AmazonS3Service } from 'src/amazon-s3/amazon-s3.service';
import { MailService } from 'src/mail/mail.service';
import { ConfiguracionService } from 'src/configuracion/configuracion.service';
import {
  ContratoOtp,
  ContratoOtpDocument,
} from './schema/contrato-otp.schema';
import {
  DatosContratoV1,
  renderContratoV1,
} from './templates/contrato-v1';

/** Datos de la firma OTP que terminan en el QR del PDF. */
interface FirmaEvidencia {
  usuarioId: string;
  email: string;
  nombre: string;
  /** IP desde la que se verificó el OTP y se firmó. */
  ip?: string | null;
  /** IP desde la que se solicitó el OTP. */
  ipSolicitudOtp?: string | null;
  firmadoEn: string;
  otpHash: string;
  hash: string;
}

export interface ContratoEstado {
  aceptado: boolean;
  contratoUrl: string | null;
  cedulaUrl: string | null;
  contratoVersion: string | null;
  contratoAceptadoEn: string | null;
  datosFaltantes: string[];
  /** Veces que el usuario pulsó "Omitir por ahora" hasta ahora. */
  omisionesUsadas: number;
  /** Cuántas veces más puede pulsar "Omitir por ahora" antes de forzar. */
  omisionesRestantes: number;
  /** Datos actuales del local — para pre-rellenar el form en cliente. */
  datosLocal: {
    nombreLocal: string;
    ruc: string | null;
    direccion: string | null;
    representanteLegal: string | null;
    cedulaRepresentante: string | null;
    estadoCivilRepresentante: string | null;
    celular: string | null;
  };
}

@Injectable()
export class ContratosService {
  private readonly logger = new Logger(ContratosService.name);
  private readonly VERSION_ACTUAL = 'v1';
  private readonly OTP_TTL_MS = 5 * 60 * 1000;
  private readonly MAX_INTENTOS = 5;
  /** Máximo de veces que el admin-local puede "Omitir por ahora" la firma. */
  private readonly MAX_OMISIONES = 3;

  constructor(
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
    @InjectModel(ContratoOtp.name)
    private readonly otpModel: Model<ContratoOtpDocument>,
    private readonly s3: AmazonS3Service,
    private readonly mailService: MailService,
    private readonly configService: ConfiguracionService,
  ) {}

  /** Lee las constantes del contrato desde el módulo de configuración. */
  private async _constantesContrato(): Promise<{
    cedulaContratado: string;
    rucContratado: string;
    representanteEnjoy: string;
    estadoCivilEnjoy: string;
    multaIncumplimiento: string;
    diasNotificacion: string;
  }> {
    const get = async (k: string, def: string): Promise<string> => {
      try {
        const v = (await this.configService.findByClave(k))?.valor;
        return v && String(v).trim() !== '' ? String(v) : def;
      } catch {
        return def;
      }
    };
    return {
      cedulaContratado: await get('contrato_enjoy_cedula_representante', '1802497279'),
      rucContratado: await get('contrato_enjoy_ruc', '__________'),
      representanteEnjoy: await get('contrato_enjoy_representante', 'JHON __________'),
      estadoCivilEnjoy: await get('contrato_enjoy_estado_civil_representante', '__________'),
      multaIncumplimiento: await get('contrato_multa_incumplimiento', '500'),
      diasNotificacion: await get('contrato_dias_notificacion_cambios', '15'),
    };
  }

  /**
   * Genera un OTP de 6 dígitos y lo envía por email al admin-local.
   * Retorna { email, expiraEn } sin exponer el código.
   */
  async solicitarOtp(
    usuarioId: string,
    contexto?: { ip?: string | null },
  ): Promise<{ email: string; expiraEn: string }> {
    const usuario = await this.usuarioModel.findById(usuarioId).lean();
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    const email = String((usuario as any).email || '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException(
        'No hay email registrado para enviar el código.',
      );
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = this._hashOtp(otp);
    const ahora = new Date();
    const expiraEn = new Date(ahora.getTime() + this.OTP_TTL_MS);
    const ipSolicitud = contexto?.ip ?? null;

    // Upsert en DB — sobreescribe cualquier OTP previo del mismo usuario.
    // Persistir en Mongo (con TTL index) asegura que aguante reinicios de PM2.
    // Guardamos la IP de solicitud para ligarla luego con la firma (auditoría).
    await this.otpModel.findOneAndUpdate(
      { usuario: new Types.ObjectId(usuarioId) },
      { otpHash, expiraEn, intentos: 0, ipSolicitud, solicitadoEn: ahora },
      { upsert: true, new: true },
    );

    // Correo bonito — reusa la plantilla `otp.html` ya existente.
    let correoSoporte = 'soporte@ecuenjoy.com';
    try {
      const cfg = await this.configService.findByClave('correo_soporte');
      if (cfg?.valor) correoSoporte = String(cfg.valor);
    } catch (_) {}
    const html = this.mailService.getTemplate('otp.html', {
      codigo: otp,
      correo_soporte: correoSoporte,
      anio: new Date().getFullYear().toString(),
    });

    try {
      await this.mailService.enviar(
        email,
        'Tu código para firmar el contrato',
        html,
      );
    } catch (e: any) {
      this.logger.error(`solicitarOtp: error enviando correo: ${e?.message}`);
      throw new BadRequestException(
        'No se pudo enviar el código. Intentá nuevamente en unos minutos.',
      );
    }

    return {
      email: email.replace(
        /^(.)(.*)(@.+)$/,
        (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 3)) + c,
      ),
      expiraEn: expiraEn.toISOString(),
    };
  }

  /**
   * Verifica el OTP del usuario contra Mongo. Lanza si no coincide.
   * Persistir en DB nos da:
   *   - Aguanta reinicios de PM2.
   *   - Conteo de intentos contra fuerza bruta.
   *   - TTL automático para limpiar OTPs caducados.
   */
  private async _verificarOtp(
    usuarioId: string,
    otp: string,
  ): Promise<{
    otpHash: string;
    ipSolicitud: string | null;
    solicitadoEn: Date | null;
  }> {
    const usuarioOid = new Types.ObjectId(usuarioId);
    const entry = await this.otpModel.findOne({ usuario: usuarioOid });
    if (!entry) {
      throw new BadRequestException(
        'No solicitaste un código (o ya expiró). Pedí uno nuevo y volvé a intentar.',
      );
    }
    if (entry.expiraEn.getTime() < Date.now()) {
      await this.otpModel.deleteOne({ _id: (entry as any)._id });
      throw new BadRequestException(
        'El código expiró (válido por 5 minutos). Pedí uno nuevo.',
      );
    }
    const ingresado = String(otp ?? '').trim();
    if (!/^\d{6}$/.test(ingresado)) {
      throw new BadRequestException('El código debe ser de 6 dígitos.');
    }
    if (this._hashOtp(ingresado) !== entry.otpHash) {
      // Suma intento — al llegar a MAX_INTENTOS borra el OTP.
      const intentos = (entry.intentos ?? 0) + 1;
      if (intentos >= this.MAX_INTENTOS) {
        await this.otpModel.deleteOne({ _id: (entry as any)._id });
        throw new BadRequestException(
          'Demasiados intentos fallidos. Pedí un código nuevo.',
        );
      }
      entry.intentos = intentos;
      await entry.save();
      throw new BadRequestException(
        `El código es incorrecto. Intentos restantes: ${this.MAX_INTENTOS - intentos}.`,
      );
    }
    return {
      otpHash: entry.otpHash,
      ipSolicitud: (entry as any).ipSolicitud ?? null,
      solicitadoEn: (entry as any).solicitadoEn ?? null,
    };
  }

  /** Consume (borra) el OTP de un usuario tras una firma exitosa. */
  private async _consumirOtp(usuarioId: string): Promise<void> {
    await this.otpModel.deleteOne({ usuario: new Types.ObjectId(usuarioId) });
  }

  private _hashOtp(otp: string): string {
    return crypto.createHash('sha256').update(otp).digest('hex');
  }

  /**
   * Estado del contrato para el admin-local autenticado. Devuelve qué datos
   * faltan para que el cliente pueda pintar el form previo.
   */
  async miEstado(usuarioId: string): Promise<ContratoEstado> {
    const u = await this.usuarioModel.findById(usuarioId).lean();
    if (!u) throw new NotFoundException('Usuario no encontrado');

    const faltantes: string[] = [];
    if (!(u as any).ruc) faltantes.push('ruc');
    if (!(u as any).direccion) faltantes.push('direccion');
    if (!(u as any).representanteLegal) faltantes.push('representanteLegal');
    if (!(u as any).cedulaRepresentante) faltantes.push('cedulaRepresentante');
    if (!(u as any).celular && !(u as any).telefono) faltantes.push('celular');

    const omisionesUsadas = Math.max(
      0,
      Number((u as any).contratoOmisiones ?? 0),
    );
    const omisionesRestantes = Math.max(
      0,
      this.MAX_OMISIONES - omisionesUsadas,
    );

    return {
      aceptado: !!(u as any).contratoAceptado,
      contratoUrl: (u as any).contratoUrl ?? null,
      cedulaUrl: (u as any).cedulaUrl ?? null,
      contratoVersion: (u as any).contratoVersion ?? null,
      contratoAceptadoEn:
        (u as any).contratoAceptadoEn?.toISOString?.() ?? null,
      datosFaltantes: faltantes,
      omisionesUsadas,
      omisionesRestantes,
      datosLocal: {
        nombreLocal: (u as any).nombre ?? '',
        ruc: (u as any).ruc ?? null,
        direccion: (u as any).direccion ?? null,
        representanteLegal: (u as any).representanteLegal ?? null,
        cedulaRepresentante: (u as any).cedulaRepresentante ?? null,
        estadoCivilRepresentante:
          (u as any).estadoCivilRepresentante ?? null,
        celular: (u as any).celular ?? (u as any).telefono ?? null,
      },
    };
  }

  /**
   * Acepta el contrato: persiste datos del local, genera el PDF con los
   * datos rellenados + la cédula al final, sube a S3 y marca aceptado.
   */
  async aceptar(
    usuarioId: string,
    dto: {
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
    contexto?: { ip?: string | null },
  ): Promise<{ contratoUrl: string; cedulaUrl: string; selfieUrl: string | null }> {
    if (!dto?.aceptaTerminos) {
      throw new BadRequestException('Tenés que aceptar los términos.');
    }
    if (!dto?.cedulaBase64) {
      throw new BadRequestException('Falta la foto de la cédula.');
    }
    if (!dto?.otp) {
      throw new BadRequestException(
        'Falta el código de verificación. Pedí uno y volvé a intentar.',
      );
    }

    const usuario = await this.usuarioModel.findById(usuarioId);
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    // Verificar OTP antes de hacer cualquier upload. Devuelve el hash + la IP
    // desde la que se SOLICITÓ el OTP (para el rastro de auditoría).
    const otpInfo = await this._verificarOtp(usuarioId, dto.otp);
    const otpHash = otpInfo.otpHash;
    const ipSolicitudOtp = otpInfo.ipSolicitud;
    const otpSolicitadoEn = otpInfo.solicitadoEn;
    // El código en texto plano es exactamente el que el usuario ingresó y que
    // ya validamos que coincide — lo guardamos para auditoría.
    const otpUsado = String(dto.otp).trim();
    // IP desde la que se verifica/firma (puede diferir de la de solicitud).
    const ipVerificacion = contexto?.ip ?? null;
    // OTP consumido — borrarlo de DB para que no se reuse.
    await this._consumirOtp(usuarioId);

    // Evidencia que va dentro del QR de firma del PDF.
    const firmadoEn = new Date().toISOString();
    const evidenciaBase: Omit<FirmaEvidencia, 'hash'> = {
      usuarioId,
      email: ((usuario as any).email ?? '').toString().toLowerCase(),
      nombre: (usuario as any).nombre ?? '',
      ip: ipVerificacion,
      ipSolicitudOtp,
      firmadoEn,
      otpHash,
    };
    const evidencia: FirmaEvidencia = {
      ...evidenciaBase,
      hash: crypto
        .createHash('sha256')
        .update(JSON.stringify(evidenciaBase))
        .digest('hex'),
    };

    // 1) Actualizar datos del local con los del form (si no estaban).
    const updates: any = {};
    const set = (k: string, v?: string) => {
      if (v && String(v).trim() !== '') updates[k] = String(v).trim();
    };
    set('ruc', dto.datosLocal?.ruc);
    set('direccion', dto.datosLocal?.direccion);
    set('representanteLegal', dto.datosLocal?.representanteLegal);
    set('cedulaRepresentante', dto.datosLocal?.cedulaRepresentante);
    set('estadoCivilRepresentante', dto.datosLocal?.estadoCivilRepresentante);
    set('celular', dto.datosLocal?.celular);
    if (Object.keys(updates).length) {
      Object.assign(usuario, updates);
      await usuario.save();
    }

    // 2) Subir cédula a S3.
    const cedula = await this.s3.uploadBase64({
      image: dto.cedulaBase64,
      route: `contratos/${usuarioId}`,
    });

    // 3) Subir selfie a S3 si vino.
    let selfieUrl: string | null = null;
    let selfieBuffer: Buffer | null = null;
    if (dto.selfieBase64 && dto.selfieBase64.trim() !== '') {
      try {
        const r = await this.s3.uploadBase64({
          image: dto.selfieBase64,
          route: `contratos/${usuarioId}`,
        });
        selfieUrl = r.url;
        const comma = dto.selfieBase64.indexOf(',');
        const b64 = comma >= 0 ? dto.selfieBase64.slice(comma + 1) : dto.selfieBase64;
        selfieBuffer = Buffer.from(b64, 'base64');
      } catch (e: any) {
        this.logger.warn(`No se pudo subir selfie: ${e?.message}`);
      }
    }

    // 4) Bajar la cédula como Buffer para embeber en el PDF.
    let cedulaBuffer: Buffer | null = null;
    try {
      const dataUrl = dto.cedulaBase64;
      const comma = dataUrl.indexOf(',');
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      cedulaBuffer = Buffer.from(b64, 'base64');
    } catch (_) {
      cedulaBuffer = null;
    }

    // 5) Generar QR con la evidencia de firma.
    const qrBuffer = await this._generarQrEvidencia(evidencia);

    // 6) Cargar constantes editables (RUC, representante Enjoy, multa, etc.)
    const constantes = await this._constantesContrato();

    // 7) Generar el PDF del contrato firmado (con QR + selfie + cédula).
    const pdfBuffer = await this._generarPdf(usuario, cedulaBuffer, constantes, {
      qrBuffer,
      evidencia,
      selfieBuffer,
    });

    // 8) Subir el PDF a S3.
    const contrato = await this.s3.uploadBuffer({
      buffer: pdfBuffer,
      contentType: 'application/pdf',
      route: `contratos/${usuarioId}`,
      // Timestamp en el nombre para evitar caché de navegador/CDN cuando un
      // usuario re-firma. La S3 url cambia cada vez.
      fileName: `contrato-${this.VERSION_ACTUAL}-${Date.now()}.pdf`,
    });

    // 9) Marcar aceptado + persistir la evidencia de firma para auditoría.
    usuario.set('contratoAceptado', true);
    usuario.set('contratoAceptadoEn', new Date());
    usuario.set('contratoUrl', contrato.url);
    usuario.set('cedulaUrl', cedula.url);
    if (selfieUrl) usuario.set('selfieUrl', selfieUrl);
    usuario.set('contratoVersion', this.VERSION_ACTUAL);
    // Evidencia de firma electrónica — queda consultable en base por usuario.
    usuario.set('contratoOtp', otpUsado);
    usuario.set('contratoOtpHash', otpHash);
    usuario.set('contratoHashEvidencia', evidencia.hash);
    usuario.set('contratoIpSolicitudOtp', ipSolicitudOtp);
    usuario.set('contratoIpVerificacion', ipVerificacion);
    usuario.set('contratoOtpSolicitadoEn', otpSolicitadoEn);
    await usuario.save();

    // 10) Enviar correo al admin-local con el contrato firmado (best-effort,
    // no bloquea la respuesta — si falla el envío, igual el contrato ya quedó
    // registrado y subido a S3).
    this._enviarCorreoContratoFirmado(usuario, contrato.url, evidencia).catch(
      (e) =>
        this.logger.warn(
          `No se pudo enviar correo de contrato firmado: ${e?.message}`,
        ),
    );

    return {
      contratoUrl: contrato.url,
      cedulaUrl: cedula.url,
      selfieUrl,
    };
  }

  /**
   * Envía un correo con el resumen y el link del PDF firmado al email del
   * representante. Usa la plantilla `contrato-firmado.html`.
   */
  private async _enviarCorreoContratoFirmado(
    usuario: UsuarioDocument,
    contratoUrl: string,
    evidencia: FirmaEvidencia,
  ): Promise<void> {
    const email = String((usuario as any).email || '').trim().toLowerCase();
    if (!email) return;
    const nombre =
      (usuario as any).representanteLegal ||
      (usuario as any).nombre ||
      'representante';
    const nombreLocal = (usuario as any).nombre || '—';
    const numeroContrato =
      'EJ-' + (String(usuario._id) || '').slice(-8).toUpperCase();
    const fechaFirma = new Date(evidencia.firmadoEn).toLocaleString('es-EC', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
    // Lee el correo de soporte de configuración (o cae a default).
    let correoSoporte = 'soporte@ecuenjoy.com';
    try {
      const cfg = await this.configService.findByClave('correo_soporte');
      if (cfg?.valor) correoSoporte = String(cfg.valor);
    } catch (_) {
      // no existe → usar default
    }

    const html = this.mailService.getTemplate('contrato-firmado.html', {
      nombre,
      nombre_local: nombreLocal,
      numero_contrato: numeroContrato,
      fecha_firma: fechaFirma,
      url_contrato: contratoUrl,
      correo: email,
      correo_soporte: correoSoporte,
      anio: new Date().getFullYear().toString(),
    });
    await this.mailService.enviar(
      email,
      `Tu contrato con Club Enjoy — ${numeroContrato}`,
      html,
    );
  }

  /**
   * Registra una "omisión" del flujo de firma. Devuelve el nuevo contador y
   * cuántas omisiones le quedan. Rechaza si ya llegó al tope: el cliente
   * debe ocultar el botón cuando `omisionesRestantes === 0`, pero además
   * validamos acá para evitar bypass manual.
   */
  async omitir(usuarioId: string): Promise<{
    omisionesUsadas: number;
    omisionesRestantes: number;
  }> {
    const u = await this.usuarioModel.findById(usuarioId);
    if (!u) throw new NotFoundException('Usuario no encontrado');
    if ((u as any).contratoAceptado) {
      // Ya firmó — no tiene sentido omitir.
      return { omisionesUsadas: 0, omisionesRestantes: 0 };
    }
    const actuales = Math.max(0, Number((u as any).contratoOmisiones ?? 0));
    if (actuales >= this.MAX_OMISIONES) {
      throw new BadRequestException(
        'Ya no podés omitir más veces. Tenés que firmar el contrato para continuar.',
      );
    }
    const nuevas = actuales + 1;
    (u as any).contratoOmisiones = nuevas;
    await u.save();
    return {
      omisionesUsadas: nuevas,
      omisionesRestantes: Math.max(0, this.MAX_OMISIONES - nuevas),
    };
  }

  /**
   * Migración: marca como contratoAceptado=true a todos los admin-local
   * creados antes de [fechaCorte]. Se invoca una vez al boot. Idempotente.
   */
  async bootstrapMarcarExistentes(fechaCorte: Date): Promise<number> {
    try {
      // Solo marcar usuarios que NUNCA tuvieron el campo `contratoAceptado`
      // (admin-local legacy creados antes del feature). Si el campo existe —
      // incluso si es `false` (porque alguien lo reseteó manualmente para
      // que vuelva a firmar) — NO tocar. `$exists: false` ≠ `{$ne: true}`:
      // el primero solo matchea documentos sin el campo, el segundo matchea
      // también los que tienen el campo en false/null.
      const res = await this.usuarioModel.updateMany(
        {
          rol: 'admin-local',
          createdAt: { $lt: fechaCorte },
          contratoAceptado: { $exists: false },
        },
        {
          $set: {
            contratoAceptado: true,
            contratoAceptadoEn: fechaCorte,
            contratoVersion: 'legacy',
          },
        },
      );
      this.logger.log(
        `Bootstrap contratos: ${res.modifiedCount} admin-local legacy marcados como aceptado`,
      );
      return res.modifiedCount ?? 0;
    } catch (e: any) {
      this.logger.error(`bootstrapMarcarExistentes: ${e?.message}`);
      return 0;
    }
  }

  /** Genera un QR PNG (buffer) que codifica la evidencia de firma como JSON. */
  private async _generarQrEvidencia(
    evidencia: FirmaEvidencia,
  ): Promise<Buffer> {
    const payload = JSON.stringify({
      tipo: 'firma-enjoy-v1',
      ...evidencia,
    });
    return await QRCode.toBuffer(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: { dark: '#1A1206', light: '#FFFFFF' },
    });
  }

  /** Render del PDF estilo "premium banco" con pdfkit. */
  private async _generarPdf(
    usuario: UsuarioDocument,
    cedulaBuffer: Buffer | null,
    constantes: {
      cedulaContratado: string;
      rucContratado: string;
      representanteEnjoy: string;
      estadoCivilEnjoy: string;
      multaIncumplimiento: string;
      diasNotificacion: string;
    },
    firma?: {
      qrBuffer: Buffer;
      evidencia: FirmaEvidencia;
      selfieBuffer?: Buffer | null;
    },
  ): Promise<Buffer> {
    const datos: DatosContratoV1 = {
      nombreLocal: (usuario as any).nombre ?? '',
      representanteLegal: (usuario as any).representanteLegal ?? '',
      cedulaRepresentante: (usuario as any).cedulaRepresentante ?? '',
      estadoCivilRepresentante:
        (usuario as any).estadoCivilRepresentante ?? '',
      rucLocal: (usuario as any).ruc ?? '',
      direccionLocal: (usuario as any).direccion ?? '',
      celularLocal:
        (usuario as any).celular ?? (usuario as any).telefono ?? '',
      fechaLiteral: this._fechaLiteral(new Date()),
      cedulaContratado: constantes.cedulaContratado,
      rucContratado: constantes.rucContratado,
      representanteEnjoy: constantes.representanteEnjoy,
      estadoCivilEnjoy: constantes.estadoCivilEnjoy,
      multaIncumplimiento: constantes.multaIncumplimiento,
      diasNotificacion: constantes.diasNotificacion,
    };
    const render = renderContratoV1(datos);

    // Paleta estilo banco
    const COLOR = {
      primary: '#0E2A5E', // azul navy serio
      accent: '#FF9F1C', // naranja Enjoy
      ink: '#1A1A1A',
      body: '#2B2B2B',
      mute: '#6B7280',
      line: '#E5E7EB',
      surface: '#F7F9FC',
    };

    const numeroContrato =
      'EJ-' + (String(usuario._id) || '').slice(-8).toUpperCase();

    return await new Promise<Buffer>((resolve, reject) => {
      try {
        // ──────────────────────────────────────────────────────────────────
        // ESTRATEGIA:
        //   1. Márgenes generosos (top 72 para que entre el header chrome).
        //   2. Todo el cuerpo del contrato fluye con `doc.text(content)` sin
        //      coordenadas absolutas. pdfkit maneja saltos de página solo.
        //   3. La página de firmas + anexos usa addPage() + image() con coords
        //      absolutas (no triggers de page break porque están dentro de
        //      cada página recién creada).
        //   4. Header + footer se pintan AL FINAL con bufferPages, iterando
        //      sobre cada página ya renderizada. Evita los page breaks
        //      recursivos que producían 27 páginas.
        // ──────────────────────────────────────────────────────────────────
        const doc = new (PDFDocument as any)({
          size: 'A4',
          // top 95 = banda navy (68) + line acento (4) + padding 23.
          margins: { top: 95, bottom: 58, left: 56, right: 56 },
          bufferPages: true,
          info: {
            Title: `Contrato Club Enjoy — ${datos.nombreLocal}`,
            Author: 'Club Enjoy',
            Subject: `Contrato de cooperación ${numeroContrato}`,
          },
        });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const contentWidth = pageWidth - 112;
        const xLeft = 56;
        const xRight = pageWidth - 56;

        // ═══════════════════════════ PÁGINA 1 ═══════════════════════════
        // Bloque de datos del contrato como tabla simple en flow.
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(COLOR.primary)
          .text('CONTRATO DE COOPERACIÓN ENTRE MARCAS', { align: 'center' });
        doc.moveDown(0.2);
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(COLOR.mute)
          .text(`N° ${numeroContrato}  ·  Club Enjoy — Ambato, Ecuador`, {
            align: 'center',
          });
        doc.moveDown(1.2);

        // Box de datos — fondo + bordes, usando doc.y como anchor pero sin
        // mover el cursor con coords absolutas dentro del box.
        const boxY = doc.y;
        const boxH = 92;
        doc.save();
        doc
          .roundedRect(xLeft, boxY, contentWidth, boxH, 6)
          .fillAndStroke(COLOR.surface, COLOR.line);
        doc.restore();
        // Contenido del box — texto dentro de la caja
        const colW = (contentWidth - 32) / 2;
        const drawCell = (
          label: string,
          value: string,
          cx: number,
          cy: number,
        ) => {
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(COLOR.mute)
            .text(label.toUpperCase(), cx, cy, {
              width: colW,
              lineBreak: false,
            });
          doc
            .font('Helvetica-Bold')
            .fontSize(9.5)
            .fillColor(COLOR.ink)
            .text(value || '—', cx, cy + 10, {
              width: colW,
              ellipsis: true,
              lineBreak: false,
            });
        };
        drawCell(
          'Contratado',
          `CLUB ENJOY · RUC ${constantes.rucContratado}`,
          xLeft + 14,
          boxY + 12,
        );
        drawCell(
          'Representante Enjoy',
          constantes.representanteEnjoy,
          xLeft + 14,
          boxY + 12 + 32,
        );
        drawCell(
          'Contratante (local)',
          `${datos.nombreLocal} · RUC ${datos.rucLocal || '—'}`,
          xLeft + 14 + colW + 16,
          boxY + 12,
        );
        drawCell(
          'Representante local',
          `${datos.representanteLegal} · C.I. ${datos.cedulaRepresentante}`,
          xLeft + 14 + colW + 16,
          boxY + 12 + 32,
        );
        // Reposicionar cursor DESPUÉS del box (en flow). Esto es CRÍTICO:
        // los drawCell anteriores dejaron doc.x/doc.y dentro de la caja.
        doc.x = xLeft;
        doc.y = boxY + boxH + 18;

        // ════════════════════ CUERPO DEL CONTRATO (FLOW) ════════════════════
        // Todo va en flow desde acá. Sin coordenadas absolutas. pdfkit maneja
        // los saltos de página naturalmente.
        let clausulaIdx = 0;
        for (const b of render.bloques) {
          if (b.tipo === 'titulo') {
            clausulaIdx++;
            doc.moveDown(0.6);
            // Heading "01  ANTECEDENTES" — número en navy + título en ink
            const badge = String(clausulaIdx).padStart(2, '0');
            const cleanTitle = b.texto.replace(/^CLÁUSULA[^:]*:\s*/i, '');
            doc
              .font('Helvetica-Bold')
              .fontSize(11)
              .fillColor(COLOR.primary)
              .text(badge + '   ', { continued: true })
              .fillColor(COLOR.ink)
              .text(cleanTitle);
            // Línea acento debajo del título
            const lineY = doc.y + 2;
            doc
              .save()
              .strokeColor(COLOR.accent)
              .lineWidth(1.2)
              .moveTo(xLeft, lineY)
              .lineTo(xLeft + 36, lineY)
              .stroke()
              .restore();
            doc.moveDown(0.5);
          } else if (b.tipo === 'parrafo') {
            doc
              .font('Helvetica')
              .fontSize(9.5)
              .fillColor(COLOR.body)
              .text(b.texto, { align: 'justify', lineGap: 2.2 });
            doc.moveDown(0.35);
          } else if (b.tipo === 'lista') {
            for (const it of b.items) {
              doc
                .font('Helvetica')
                .fontSize(9.5)
                .fillColor(COLOR.body)
                .text(it, { align: 'justify', indent: 14, lineGap: 2.2 });
              doc.moveDown(0.12);
            }
            doc.moveDown(0.3);
          }
        }

        // ─────────────────── Página de firmas + evidencia ───────────────────
        if (firma?.qrBuffer) {
          doc.addPage();
          // doc.y queda en topMargin (95) automáticamente al añadir página.
          // Título sección firma
          doc
            .font('Helvetica-Bold')
            .fontSize(14)
            .fillColor(COLOR.primary)
            .text('Firma electrónica simple', { align: 'left' });
          doc
            .font('Helvetica')
            .fontSize(9.5)
            .fillColor(COLOR.mute)
            .text(
              'Esta firma fue generada tras la verificación de un código OTP enviado al correo del representante. El QR contiene la evidencia del acto firmado.',
              { lineGap: 2 },
            );
          doc.moveDown(1);

          const yFirmas = doc.y;
          const halfW = (contentWidth - 24) / 2;
          // Columna izquierda — Club Enjoy
          doc.save();
          doc.roundedRect(56, yFirmas, halfW, 220, 8).fillAndStroke(COLOR.surface, COLOR.line);
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor(COLOR.mute)
            .text('CONTRATADO', 68, yFirmas + 14);
          doc
            .font('Helvetica-Bold')
            .fontSize(13)
            .fillColor(COLOR.ink)
            .text('CLUB ENJOY', 68, yFirmas + 28, { width: halfW - 24 });
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor(COLOR.body)
            .text(`RUC: ${constantes.rucContratado}`, 68, yFirmas + 52)
            .text(`Representante: ${constantes.representanteEnjoy}`, 68, yFirmas + 66, { width: halfW - 24 })
            .text(`C.I.: ${constantes.cedulaContratado}`, 68, yFirmas + 96);
          // Línea de firma manual
          doc
            .strokeColor(COLOR.mute)
            .lineWidth(0.7)
            .moveTo(68, yFirmas + 170)
            .lineTo(56 + halfW - 12, yFirmas + 170)
            .stroke();
          doc
            .font('Helvetica-Oblique')
            .fontSize(8)
            .fillColor(COLOR.mute)
            .text('Firma del representante', 68, yFirmas + 176, {
              width: halfW - 24,
              align: 'center',
            });
          doc.restore();

          // Columna derecha — Local (QR firma)
          const xR = 56 + halfW + 24;
          doc.save();
          doc.roundedRect(xR, yFirmas, halfW, 220, 8).fillAndStroke(COLOR.surface, COLOR.line);
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor(COLOR.mute)
            .text('CONTRATANTE', xR + 12, yFirmas + 14);
          doc
            .font('Helvetica-Bold')
            .fontSize(13)
            .fillColor(COLOR.ink)
            .text(datos.nombreLocal, xR + 12, yFirmas + 28, {
              width: halfW - 24,
            });
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor(COLOR.body)
            .text(`RUC: ${datos.rucLocal || '—'}`, xR + 12, yFirmas + 52)
            .text(`Representante: ${datos.representanteLegal}`, xR + 12, yFirmas + 66, { width: halfW - 24 })
            .text(`C.I.: ${datos.cedulaRepresentante}`, xR + 12, yFirmas + 96);
          // QR de firma
          const qrSize = 90;
          const qrX = xR + (halfW - qrSize) / 2;
          try {
            doc.image(firma.qrBuffer, qrX, yFirmas + 115, {
              width: qrSize,
              height: qrSize,
            });
          } catch (e: any) {
            this.logger.warn(`QR firma: ${e?.message}`);
          }
          doc
            .font('Helvetica-Bold')
            .fontSize(8)
            .fillColor(COLOR.accent)
            .text('FIRMA SIMPLE · OTP VERIFICADO', xR + 12, yFirmas + 210, {
              width: halfW - 24,
              align: 'center',
            });
          doc.restore();

          // Evidencia debajo
          const evY = yFirmas + 240;
          doc
            .font('Helvetica-Bold')
            .fontSize(9.5)
            .fillColor(COLOR.primary)
            .text('Evidencia de firma electrónica', 56, evY);
          const firmadoFmt = new Date(firma.evidencia.firmadoEn).toLocaleString(
            'es-EC',
            { dateStyle: 'long', timeStyle: 'short' },
          );
          doc
            .font('Helvetica')
            .fontSize(8.5)
            .fillColor(COLOR.body)
            .text(`• Firmado por: ${firma.evidencia.email}`, 56, evY + 18, { lineGap: 2 })
            .text(`• Fecha y hora: ${firmadoFmt}`, 56, doc.y + 2, { lineGap: 2 })
            .text(`• IP de solicitud del código: ${firma.evidencia.ipSolicitudOtp ?? 'n/d'}`, 56, doc.y + 2, { lineGap: 2 })
            .text(`• IP de verificación (firma): ${firma.evidencia.ip ?? 'n/d'}`, 56, doc.y + 2, { lineGap: 2 })
            .text(`• Hash de evidencia (SHA-256): ${firma.evidencia.hash}`, 56, doc.y + 2, {
              lineGap: 2,
              width: contentWidth,
            })
            .text(`• Hash del OTP (SHA-256): ${firma.evidencia.otpHash.slice(0, 32)}…`, 56, doc.y + 2, {
              lineGap: 2,
            });

          // Selfie + cédula en página nueva
          if (firma.selfieBuffer || cedulaBuffer) {
            doc.addPage();
            doc
              .font('Helvetica-Bold')
              .fontSize(14)
              .fillColor(COLOR.primary)
              .text('Anexos de identidad', { align: 'left' });
            doc.moveDown(0.6);

            const colWImg = (contentWidth - 24) / 2;
            const imgH = 230;
            const startY = doc.y;

            if (firma.selfieBuffer) {
              doc
                .font('Helvetica-Bold')
                .fontSize(10)
                .fillColor(COLOR.ink)
                .text('Selfie del representante', 56, startY);
              doc
                .font('Helvetica')
                .fontSize(8)
                .fillColor(COLOR.mute)
                .text('Captura con verificación de vida (ML on-device).', 56, startY + 14);
              try {
                doc.image(firma.selfieBuffer, 56, startY + 30, {
                  fit: [colWImg, imgH],
                  align: 'center',
                });
              } catch (e: any) {
                this.logger.warn(`selfie image: ${e?.message}`);
              }
            }

            if (cedulaBuffer) {
              const xC = firma.selfieBuffer ? 56 + colWImg + 24 : 56;
              doc
                .font('Helvetica-Bold')
                .fontSize(10)
                .fillColor(COLOR.ink)
                .text('Cédula del representante', xC, startY);
              doc
                .font('Helvetica')
                .fontSize(8)
                .fillColor(COLOR.mute)
                .text('Documento adjuntado al firmar.', xC, startY + 14);
              try {
                doc.image(cedulaBuffer, xC, startY + 30, {
                  fit: [colWImg, imgH],
                  align: 'center',
                });
              } catch (e: any) {
                this.logger.warn(`cedula image: ${e?.message}`);
              }
            }
          }
        }

        // ═══════════════════ CHROME (header + footer) ═══════════════════
        // Iteramos todas las páginas YA renderizadas y dibujamos header +
        // footer encima. Como las páginas ya existen, ningún dibujo
        // dispara page breaks recursivos.
        const fechaLargaPdf = new Date().toLocaleDateString('es-EC', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const range = doc.bufferedPageRange();
        const total = range.start + range.count;
        for (let i = range.start; i < total; i++) {
          doc.switchToPage(i);
          // CRÍTICO: anular el margen inferior en la página ya renderizada.
          // El footer se pinta en y≈pageHeight-34, que cae DEBAJO del límite
          // maxY = pageHeight - margins.bottom (58). Sin esto, cada doc.text()
          // del footer "desborda" el margen y pdfkit inserta una página nueva
          // en blanco (2 textos × N páginas = páginas fantasma), además de
          // partir el bloque save()/restore() y corromper el estado gráfico.
          doc.page.margins.bottom = 0;

          // ── Header: banda navy delgada con logo + título + N° ──
          doc.save();
          doc.rect(0, 0, pageWidth, 56).fill(COLOR.primary);
          // Logo box (placeholder con letra)
          doc.rect(40, 13, 30, 30).fill(COLOR.accent);
          doc
            .fillColor('#FFFFFF')
            .font('Helvetica-Bold')
            .fontSize(17)
            .text('E', 40, 17, {
              width: 30,
              align: 'center',
              lineBreak: false,
            });
          // Marca + subtítulo
          doc
            .fillColor('#FFFFFF')
            .font('Helvetica-Bold')
            .fontSize(12)
            .text('CLUB ENJOY', 80, 16, { lineBreak: false });
          doc
            .fillColor('#C9D6F0')
            .font('Helvetica')
            .fontSize(8)
            .text('Contrato de cooperación entre marcas', 80, 32, {
              lineBreak: false,
            });
          // Lado derecho — N° contrato + fecha
          doc
            .fillColor('#FFFFFF')
            .font('Helvetica-Bold')
            .fontSize(9)
            .text(`N° ${numeroContrato}`, pageWidth - 200, 18, {
              width: 160,
              align: 'right',
              lineBreak: false,
            });
          doc
            .fillColor('#C9D6F0')
            .font('Helvetica')
            .fontSize(8)
            .text(fechaLargaPdf, pageWidth - 200, 32, {
              width: 160,
              align: 'right',
              lineBreak: false,
            });
          // Línea de acento
          doc.rect(0, 56, pageWidth, 3).fill(COLOR.accent);
          doc.restore();

          // ── Footer: línea + texto pequeño + página X de Y ──
          const fY = pageHeight - 34;
          doc.save();
          doc
            .strokeColor(COLOR.line)
            .lineWidth(0.5)
            .moveTo(xLeft, fY)
            .lineTo(xRight, fY)
            .stroke();
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(COLOR.mute)
            .text(
              `Club Enjoy · Contrato ${numeroContrato} · ${datos.nombreLocal || '—'}`,
              xLeft,
              fY + 6,
              {
                width: contentWidth - 80,
                align: 'left',
                lineBreak: false,
              },
            );
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(COLOR.mute)
            .text(
              `Página ${i - range.start + 1} de ${range.count}`,
              xRight - 80,
              fY + 6,
              { width: 80, align: 'right', lineBreak: false },
            );
          doc.restore();
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  private _fechaLiteral(d: Date): string {
    const meses = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    return `a los ${d.getDate()} días del mes de ${meses[d.getMonth()]} del año ${d.getFullYear()}`;
  }
}
