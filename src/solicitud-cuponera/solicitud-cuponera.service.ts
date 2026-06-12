import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SolicitudCuponera, EstadoSolicitud } from './schema/solicitud-cuponera.schema';
import { AmazonS3Service } from '../amazon-s3/amazon-s3.service';
import { CuponService } from '../cupon/cupon.service';
import { VersionCuponeraService } from '../version-cuponera/version-cuponera.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { ClientesService } from '../clientes/clientes.service';
import { MailService } from '../mail/mail.service';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { Usuario } from '../usuarios/schema/usuario.schema';

@Injectable()
export class SolicitudCuponeraService {
  private readonly logger = new Logger(SolicitudCuponeraService.name);

  constructor(
    @InjectModel(SolicitudCuponera.name)
    private readonly model: Model<SolicitudCuponera>,
    private readonly s3: AmazonS3Service,
    private readonly cuponService: CuponService,
    private readonly versionService: VersionCuponeraService,
    private readonly notificacionesService: NotificacionesService,
    private readonly clientesService: ClientesService,
    private readonly mailService: MailService,
    private readonly configuracionService: ConfiguracionService,
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<Usuario>,
  ) {}

  async create(dto: any): Promise<SolicitudCuponera> {
    let comprobanteUrl: string | undefined;

    if (dto.comprobanteBase64) {
      const result = await this.s3.uploadBase64({
        image: dto.comprobanteBase64,
        route: 'comprobantes-cuponera',
      });
      comprobanteUrl = result.url;
    }

    const solicitud = await this.model.create({
      ...dto,
      comprobanteBase64: undefined,
      comprobanteUrl,
      estado: EstadoSolicitud.PENDIENTE,
    });

    // Notificar a los admins (best-effort: no bloquea ni rompe la creación).
    this._notificarAdminNuevaSolicitud(solicitud).catch((e) =>
      this.logger.error(`Error notificando nueva solicitud: ${e?.message}`),
    );

    return solicitud;
  }

  /** Correo + push a la lista de admins configurada (solicitud_notif_emails). */
  private async _notificarAdminNuevaSolicitud(solicitud: any) {
    let emails: string[] = [];
    try {
      const cfg = await this.configuracionService.findByClave(
        'solicitud_notif_emails',
      );
      emails = ((cfg as any)?.valor ?? '')
        .split(',')
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);
    } catch (_) {
      // clave inexistente → sin notificación de admin
    }
    if (!emails.length) return;

    const titulo = 'Nueva solicitud de cuponera';
    const cuerpo = `${solicitud.nombreCliente ?? 'Un cliente'} solicitó "${
      solicitud.cuponeraNombre ?? 'una cuponera'
    }".`;

    // Correo a cada admin de la lista.
    for (const email of emails) {
      try {
        const html = this.mailService.getTemplate('solicitud-nueva.html', {
          nombreCliente: solicitud.nombreCliente ?? '—',
          emailCliente: solicitud.emailCliente ?? '—',
          cuponera: solicitud.cuponeraNombre ?? '—',
          monto: (solicitud.montoTransferido ?? '—').toString(),
          fecha: new Date().toLocaleString('es-EC'),
          anio: new Date().getFullYear().toString(),
        });
        await this.mailService.enviar(email, titulo, html);
      } catch (e) {
        this.logger.error(`Error correo admin ${email}: ${e?.message}`);
      }
    }

    // Push a los usuarios admin (de la lista) que tengan fcmToken.
    try {
      const admins = await this.usuarioModel
        .find({
          email: { $in: emails },
          fcmToken: { $exists: true, $ne: null },
        })
        .select('fcmToken')
        .lean();
      for (const a of admins as any[]) {
        if (a.fcmToken) {
          await this.notificacionesService.enviarAToken(
            a.fcmToken,
            titulo,
            cuerpo,
          );
        }
      }
    } catch (e) {
      this.logger.error(`Error push admin: ${e?.message}`);
    }
  }

  async findAll(filtros?: { estado?: string; page?: number; limit?: number }) {
    const query: any = {};
    if (filtros?.estado) query.estado = filtros.estado;

    const page = filtros?.page || 1;
    const limit = filtros?.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('cliente', 'nombres apellidos email')
        .exec(),
      this.model.countDocuments(query),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<SolicitudCuponera> {
    const doc = await this.model
      .findById(id)
      .populate('cliente', 'nombres apellidos email telefono');
    if (!doc) throw new NotFoundException('Solicitud no encontrada');
    return doc;
  }

  async findByCliente(clienteId: string): Promise<any[]> {
    const docs = await this.model
      .find({ cliente: clienteId })
      .sort({ createdAt: -1 })
      .populate({ path: 'cuponRegaloId', select: 'regaloAbierto' })
      .lean();

    // Para regalos, exponer si el destinatario ya lo abrió.
    return docs.map((d: any) => {
      const out = { ...d };
      if (d.esRegalo) {
        out.regaloAbierto = d.cuponRegaloId?.regaloAbierto === true;
      }
      // No filtramos cuponRegaloId; el front solo usa regaloAbierto.
      return out;
    });
  }

  async updateEstado(
    id: string,
    estado: EstadoSolicitud,
    notaAdmin?: string,
  ): Promise<any> {
    // Transición ATÓMICA: solo de PENDIENTE → APROBADO/RECHAZADO.
    // Evita que un doble click (o doble request) procese la misma solicitud
    // dos veces y cree cuponeras duplicadas: solo la PRIMERA matchea.
    const doc = await this.model.findOneAndUpdate(
      { _id: id, estado: EstadoSolicitud.PENDIENTE },
      { estado, ...(notaAdmin && { notaAdmin }) },
      { new: true },
    );
    if (!doc) {
      const existe = await this.model.exists({ _id: id });
      if (!existe) throw new NotFoundException('Solicitud no encontrada');
      // Ya estaba aprobada/rechazada → no se vuelve a procesar.
      throw new BadRequestException('La solicitud ya fue procesada');
    }

    // Enviar notificación push + correo al cliente
    const clienteId = (doc.cliente as any)?._id?.toString() ?? doc.cliente?.toString();
    const anio = new Date().getFullYear().toString();

    if (estado === EstadoSolicitud.APROBADO) {
      // Push
      if (clienteId) {
        const fcmToken = await this.clientesService.obtenerFcmToken(clienteId);
        const tituloPush = doc.esRegalo
          ? '¡Regalo enviado! 🎁'
          : '¡Solicitud aprobada! 🎉';
        const cuerpoPush = doc.esRegalo
          ? `Tu regalo "${doc.cuponeraNombre}" fue enviado a ${
              doc.destinatarioNombre ?? 'tu destinatario'
            }.`
          : `Tu cuponera "${doc.cuponeraNombre}" fue aprobada. ¡Ya puedes usarla!`;
        await this.notificacionesService.enviarAToken(
          fcmToken,
          tituloPush,
          cuerpoPush,
        );
      }
      // Correo
      try {
        const html = this.mailService.getTemplate('solicitud-aprobada.html', {
          nombre: doc.nombreCliente,
          cuponera: doc.cuponeraNombre,
          anio,
        });
        await this.mailService.enviar(
          doc.emailCliente,
          `¡Tu cuponera "${doc.cuponeraNombre}" fue aprobada! 🎉`,
          html,
        );
      } catch (e) {
        this.logger.error(`Error enviando correo de aprobación: ${e.message}`);
      }
    } else if (estado === EstadoSolicitud.RECHAZADO) {
      // Push
      if (clienteId) {
        const fcmToken = await this.clientesService.obtenerFcmToken(clienteId);
        await this.notificacionesService.enviarAToken(
          fcmToken,
          'Solicitud no aprobada',
          notaAdmin
            ? `Tu solicitud de "${doc.cuponeraNombre}" no fue aprobada: ${notaAdmin}`
            : `Tu solicitud de "${doc.cuponeraNombre}" no fue aprobada.`,
        );
      }
      // Correo
      try {
        const notaSeccion = notaAdmin
          ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="margin-bottom:20px; border-radius:12px; border:1px solid #fecaca; overflow:hidden;">
              <tr>
                <td style="padding:14px 16px; background:#fff1f1;">
                  <p style="margin:0 0 4px; font:600 11px/1 Arial, sans-serif; color:#dc2626; text-transform:uppercase; letter-spacing:.4px;">Motivo</p>
                  <p style="margin:0; font:14px/22px Arial, sans-serif; color:#7f1d1d;" class="nota-text">${notaAdmin}</p>
                </td>
              </tr>
            </table>`
          : '';
        const html = this.mailService.getTemplate('solicitud-rechazada.html', {
          nombre: doc.nombreCliente,
          cuponera: doc.cuponeraNombre,
          nota_seccion: notaSeccion,
          anio,
        });
        await this.mailService.enviar(
          doc.emailCliente,
          `Tu solicitud de "${doc.cuponeraNombre}" no fue aprobada`,
          html,
        );
      } catch (e) {
        this.logger.error(`Error enviando correo de rechazo: ${e.message}`);
      }
    }

    // Si se aprueba, crear cupón automáticamente
    if (estado === EstadoSolicitud.APROBADO) {
      try {
        const cupon = await this.crearCuponDesdeAprobacion(doc);
        return { solicitud: doc, cuponCreado: cupon };
      } catch (error) {
        this.logger.error(
          `Error al crear cupón automático para solicitud ${id}: ${error.message}`,
        );
        return { solicitud: doc, cuponCreado: null, error: error.message };
      }
    }

    return { solicitud: doc };
  }

  /**
   * Busca la versión de cuponera por nombre y crea un cupón activo
   * asignado al cliente de la solicitud.
   */
  private async crearCuponDesdeAprobacion(solicitud: SolicitudCuponera) {
    // Buscar versión por nombre exacto (case-insensitive)
    const versiones = await this.versionService.buscarPorNombre(
      solicitud.cuponeraNombre,
      'true',
    );

    if (!versiones || versiones.length === 0) {
      throw new Error(
        `No se encontró versión de cuponera activa con nombre "${solicitud.cuponeraNombre}"`,
      );
    }

    // Tomar la primera coincidencia
    const version = versiones[0];

    // ── Regalo ────────────────────────────────────────────────────────
    // El cupón se asigna al DESTINATARIO pero queda "cerrado" hasta que
    // la persona lo abre. Se le notifica de forma especial.
    if (solicitud.esRegalo && solicitud.destinatarioId) {
      const cupon = await this.cuponService.create({
        version: version._id,
        cliente: solicitud.destinatarioId,
        esRegalo: true,
        regaloAbierto: false,
        regaloDe: solicitud.nombreCliente,
        regaloMensaje: solicitud.mensajeRegalo ?? null,
        compradorId: solicitud.cliente,
      });

      this.logger.log(
        `Regalo (cupón ${cupon._id}) creado para destinatario ${solicitud.destinatarioId} desde solicitud ${solicitud._id}`,
      );

      // Guardar referencia del cupón en la solicitud (para ver si se abrió).
      try {
        await this.model.updateOne(
          { _id: solicitud._id },
          { cuponRegaloId: cupon._id },
        );
      } catch (e) {
        this.logger.error(`Error guardando cuponRegaloId: ${e?.message}`);
      }

      // Notificar al destinatario (best-effort).
      this._notificarRegaloAlDestinatario(solicitud, cupon).catch((e) =>
        this.logger.error(`Error notificando regalo: ${e?.message}`),
      );

      return cupon;
    }

    // Crear cupón activo asignado al cliente
    const cupon = await this.cuponService.create({
      version: version._id,
      cliente: solicitud.cliente,
    });

    this.logger.log(
      `Cupón ${cupon._id} creado automáticamente para solicitud ${solicitud._id}`,
    );

    return cupon;
  }

  /** Push + correo especial al destinatario de un regalo. */
  private async _notificarRegaloAlDestinatario(
    solicitud: any,
    cupon: any,
  ) {
    const destinatarioId = solicitud.destinatarioId?.toString();
    if (!destinatarioId) return;

    const titulo = `¡Tienes un regalo de ${solicitud.nombreCliente}! 🎁`;
    const cuerpo = `Te regalaron la cuponera "${solicitud.cuponeraNombre}". Ábrela en la app para descubrirla.`;

    // Push
    try {
      const fcmToken = await this.clientesService.obtenerFcmToken(
        destinatarioId,
      );
      if (fcmToken) {
        await this.notificacionesService.enviarAToken(fcmToken, titulo, cuerpo);
      }
    } catch (e) {
      this.logger.error(`Error push regalo destinatario: ${e?.message}`);
    }

    // Correo (best-effort, plantilla genérica si no existe la específica).
    try {
      const destinatario = await this.clientesService.findById(destinatarioId);
      const email = (destinatario as any)?.correo ?? (destinatario as any)?.email;
      if (email) {
        const anio = new Date().getFullYear().toString();
        const mensajeRegalo = (solicitud.mensajeRegalo ?? '').toString().trim();
        const mensajeSeccion = mensajeRegalo
          ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="margin-bottom:20px; border-radius:12px; border:1px solid #fde6c4; overflow:hidden;" class="msg-box">
              <tr>
                <td style="padding:14px 16px; background:#fff8ee;" class="msg-box">
                  <span style="font:600 11px/1 Arial, sans-serif; color:#c2410c; text-transform:uppercase; letter-spacing:.4px;">Mensaje</span>
                  <p style="margin:6px 0 0; font:italic 14px/22px Arial, sans-serif; color:#7c2d12;" class="text">${mensajeRegalo}</p>
                </td>
              </tr>
            </table>`
          : '';
        let html: string;
        try {
          html = this.mailService.getTemplate('regalo-recibido.html', {
            nombreDestinatario:
              solicitud.destinatarioNombre ??
              (destinatario as any)?.nombres ??
              '',
            nombreRegalador: solicitud.nombreCliente,
            cuponera: solicitud.cuponeraNombre,
            mensaje_seccion: mensajeSeccion,
            anio,
          });
        } catch (_) {
          html = `<p>${titulo}</p><p>${cuerpo}</p>${
            mensajeRegalo ? `<blockquote>${mensajeRegalo}</blockquote>` : ''
          }`;
        }
        await this.mailService.enviar(email, titulo, html);
      }
    } catch (e) {
      this.logger.error(`Error correo regalo destinatario: ${e?.message}`);
    }
  }
}
