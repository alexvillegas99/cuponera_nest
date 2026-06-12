import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import {
  Conversacion,
  ConversacionDocument,
  EstadoConversacion,
} from './schema/conversacion.schema';
import {
  Mensaje,
  MensajeDocument,
  AutorTipo,
} from './schema/mensaje.schema';
import { Usuario, UsuarioDocument } from '../usuarios/schema/usuario.schema';
import { Rol, RolDocument } from '../roles/schema/rol.schema';
import { UsuariosService } from '../usuarios/usuarios.service';
import { AmazonS3Service } from '../amazon-s3/amazon-s3.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { ChatGateway } from './chat.gateway';
import { RoutingService } from './routing.service';

const PERM_VER = 'chat.ver';
const PERM_RESPONDER = 'chat.responder';
const ATIENDE_TIMEOUT_MS = 15 * 60 * 1000; // 15 min

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Conversacion.name)
    private readonly convModel: Model<ConversacionDocument>,
    @InjectModel(Mensaje.name)
    private readonly msgModel: Model<MensajeDocument>,
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
    @InjectModel(Rol.name)
    private readonly rolModel: Model<RolDocument>,
    private readonly usuariosService: UsuariosService,
    private readonly s3: AmazonS3Service,
    private readonly notif: NotificacionesService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly gateway: ChatGateway,
    @Inject(forwardRef(() => RoutingService))
    private readonly routing: RoutingService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────
  private esSoporte(user: any): boolean {
    const permisos: string[] = user?.permisos ?? [];
    return permisos.includes(PERM_VER) || permisos.includes(PERM_RESPONDER);
  }

  private puedeResponder(user: any): boolean {
    const permisos: string[] = user?.permisos ?? [];
    return permisos.includes(PERM_RESPONDER) || permisos.includes('dashboard.ver');
  }

  /**
   * Devuelve el localId (Usuario admin-local) al que pertenece el usuario
   * actual cuando NO es soporte. Si es staff, sube a su admin-local.
   */
  private async resolverLocalId(user: any): Promise<Types.ObjectId> {
    const admin = await this.usuariosService.getAdminLocalRaw(user._id);
    return new Types.ObjectId(admin._id.toString());
  }

  private async asegurarConversacionDeLocal(
    localId: Types.ObjectId,
  ): Promise<ConversacionDocument> {
    let conv = await this.convModel.findOne({ localId });
    if (conv) return conv;

    const local = await this.usuariosService.findByIdRaw(localId.toString());
    conv = await this.convModel.create({
      localId,
      localNombre: local?.nombre || '',
      localLogo: (local as any)?.logoUrl || (local as any)?.detallePromocion?.logoUrl || '',
      estado: EstadoConversacion.ABIERTA,
    });
    return conv;
  }

  /**
   * Libera la atención si excedió el timeout sin actividad.
   * Llamado en cada read del hilo.
   */
  private async _expirarAtencion(
    conv: ConversacionDocument,
  ): Promise<ConversacionDocument> {
    const a: any = conv.atendiendoAhora;
    if (!a) return conv;
    const ultima = a.ultimaActividad
      ? new Date(a.ultimaActividad).getTime()
      : 0;
    if (Date.now() - ultima > ATIENDE_TIMEOUT_MS) {
      conv.atendiendoAhora = null;
      await conv.save();
      this.gateway
        .emitConversacionActualizada(conv.toObject())
        .catch(() => {});
    }
    return conv;
  }

  private async _enriquecer(conv: ConversacionDocument): Promise<any> {
    await this._expirarAtencion(conv);
    // Refresca snapshot de logo/nombre si están vacíos.
    if (!conv.localNombre || !conv.localLogo) {
      const local = await this.usuariosService.findByIdRaw(conv.localId.toString());
      if (local) {
        const nombre = local.nombre || conv.localNombre || '';
        const logo =
          (local as any).logoUrl ||
          (local as any).detallePromocion?.logoUrl ||
          conv.localLogo ||
          '';
        if (nombre !== conv.localNombre || logo !== conv.localLogo) {
          conv.localNombre = nombre;
          conv.localLogo = logo;
          await conv.save();
        }
      }
    }
    return conv.toObject();
  }

  // ── Endpoints ────────────────────────────────────────────────────────
  /**
   * Lista hilos.
   *  - Soporte: lista todos (con búsqueda + filtros).
   *  - Local/staff: devuelve solo SU hilo (lo crea si no existe).
   */
  async listarHilos(
    user: any,
    opts: {
      q?: string;
      estado?: 'ABIERTA' | 'CERRADA';
      asignadoMi?: boolean;
      page?: number;
      limit?: number;
    },
  ): Promise<any> {
    if (!this.esSoporte(user)) {
      const localId = await this.resolverLocalId(user);
      const conv = await this.asegurarConversacionDeLocal(localId);
      return {
        items: [await this._enriquecer(conv)],
        total: 1,
        page: 1,
        limit: 1,
      };
    }

    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(opts.limit) || 20));

    const match: any = {};
    if (opts.estado) match.estado = opts.estado;
    if (opts.asignadoMi) match.asignadoA = new Types.ObjectId(user._id);
    if (opts.q && opts.q.trim()) {
      const rx = new RegExp(opts.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      match.localNombre = rx;
    }

    const [items, total] = await Promise.all([
      this.convModel
        .find(match)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.convModel.countDocuments(match),
    ]);

    return { items, total, page, limit };
  }

  /** Devuelve el documento Mongoose del hilo (uso interno). */
  async obtenerHiloDoc(id: string): Promise<ConversacionDocument> {
    if (!isValidObjectId(id))
      throw new BadRequestException('ID inválido');
    const conv = await this.convModel.findById(id);
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv;
  }

  async obtenerHiloPorId(user: any, id: string): Promise<any> {
    if (!isValidObjectId(id)) throw new BadRequestException('ID inválido');
    const conv = await this.convModel.findById(id);
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    await this.validarAcceso(user, conv);
    return this._enriquecer(conv);
  }

  /**
   * Devuelve el hilo del local actual (crea si no existe). Solo para no-soporte.
   */
  async miHilo(user: any): Promise<any> {
    if (this.esSoporte(user)) {
      throw new ForbiddenException(
        'El equipo de soporte debe abrir un hilo específico desde la bandeja.',
      );
    }
    const localId = await this.resolverLocalId(user);
    const conv = await this.asegurarConversacionDeLocal(localId);
    return this._enriquecer(conv);
  }

  async listarMensajes(
    user: any,
    conversacionId: string,
    cursor?: string,
    limit = 30,
  ): Promise<any> {
    if (!isValidObjectId(conversacionId))
      throw new BadRequestException('ID inválido');
    const conv = await this.convModel.findById(conversacionId);
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    await this.validarAcceso(user, conv);

    const lim = Math.min(80, Math.max(1, Number(limit) || 30));
    const match: any = { conversacionId: conv._id };
    if (cursor && isValidObjectId(cursor)) {
      match._id = { $lt: new Types.ObjectId(cursor) };
    }

    const docs = await this.msgModel
      .find(match)
      .sort({ _id: -1 })
      .limit(lim + 1)
      .lean();

    const hayMas = docs.length > lim;
    const items = (hayMas ? docs.slice(0, lim) : docs).reverse();
    const nextCursor = hayMas ? docs[lim - 1]._id.toString() : null;

    return { items, nextCursor };
  }

  async enviarMensaje(
    user: any,
    conversacionId: string,
    dto: { texto?: string; imagenBase64?: string },
  ): Promise<any> {
    if (!isValidObjectId(conversacionId))
      throw new BadRequestException('ID inválido');
    const conv = await this.convModel.findById(conversacionId);
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    await this.validarAcceso(user, conv);

    const yoSoyLocal = !this.esSoporte(user);
    if (!yoSoyLocal && !this.puedeResponder(user)) {
      throw new ForbiddenException('No tienes permiso para responder.');
    }

    const texto = (dto.texto || '').trim();
    let adjuntoUrl: string | null = null;
    if (dto.imagenBase64 && dto.imagenBase64.trim()) {
      const up = await this.s3.uploadBase64({
        image: dto.imagenBase64,
        route: `chat/${(conv._id as Types.ObjectId).toString()}`,
      } as any);
      adjuntoUrl = up?.url || null;
    }
    if (!texto && !adjuntoUrl) {
      throw new BadRequestException('El mensaje no puede estar vacío.');
    }
    if (conv.estado === EstadoConversacion.CERRADA) {
      conv.estado = EstadoConversacion.ABIERTA;
    }

    // Si el que envía es SOPORTE: claim/refresh atención automática.
    // Y resetear el timer de escalación.
    if (!yoSoyLocal) {
      await this._expirarAtencion(conv);
      const actual: any = conv.atendiendoAhora;
      if (!actual || actual.userId?.toString() === user._id.toString()) {
        conv.atendiendoAhora = {
          userId: new Types.ObjectId(user._id),
          nombre: user.nombre || user.email || 'Agente',
          ultimaActividad: new Date(),
        };
      }
      // Si el que responde es el asignado → reset timer
      if (conv.asignadoA?.toString() === user._id.toString()) {
        await this.routing.marcarRespuesta(conv);
      }
    }

    const autorTipo: AutorTipo = yoSoyLocal ? 'LOCAL' : 'SOPORTE';
    const mensaje = await this.msgModel.create({
      conversacionId: conv._id,
      autorId: new Types.ObjectId(user._id),
      autorTipo,
      autorNombre: user.nombre || user.email || '',
      texto,
      adjuntoUrl,
    });

    // Actualizar conversación
    if (yoSoyLocal) conv.noLeidosSoporte = (conv.noLeidosSoporte || 0) + 1;
    else conv.noLeidosLocal = (conv.noLeidosLocal || 0) + 1;
    conv.ultimoMensaje = {
      texto: texto || (adjuntoUrl ? '📷 Imagen' : ''),
      autorId: new Types.ObjectId(user._id),
      autorNombre: user.nombre || user.email || '',
      autorTipo,
      conAdjunto: !!adjuntoUrl,
      fecha: new Date(),
    };
    await conv.save();

    const msgObj = mensaje.toObject();

    // Si el mensaje viene del LOCAL → activar routing/asignación.
    if (yoSoyLocal) {
      await this.routing.asignarAlRecibirMensaje(conv).catch(() => null);
    }

    // Emitir por WS + push
    this.gateway.emitMensaje((conv._id as Types.ObjectId).toString(), msgObj);
    this.gateway
      .emitConversacionActualizada(conv.toObject())
      .catch(() => {});
    this.enviarPush(conv, msgObj, user).catch((e) =>
      console.error('chat push error', e?.message),
    );

    return msgObj;
  }

  async marcarLeidos(user: any, conversacionId: string): Promise<any> {
    if (!isValidObjectId(conversacionId))
      throw new BadRequestException('ID inválido');
    const conv = await this.convModel.findById(conversacionId);
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    await this.validarAcceso(user, conv);

    const yoSoyLocal = !this.esSoporte(user);
    const now = new Date();
    const filtroAutor: AutorTipo = yoSoyLocal ? 'SOPORTE' : 'LOCAL';
    await this.msgModel.updateMany(
      { conversacionId: conv._id, autorTipo: filtroAutor, leidoEn: null },
      { $set: { leidoEn: now } },
    );

    if (yoSoyLocal) conv.noLeidosLocal = 0;
    else conv.noLeidosSoporte = 0;
    await conv.save();

    this.gateway.emitLeido((conv._id as Types.ObjectId).toString(), {
      lectorId: user._id,
      lectorTipo: yoSoyLocal ? 'LOCAL' : 'SOPORTE',
      fecha: now,
    });

    return { ok: true };
  }

  async asignarHilo(user: any, conversacionId: string, agenteId?: string) {
    if (!this.puedeResponder(user))
      throw new ForbiddenException('Sin permiso');
    if (!isValidObjectId(conversacionId))
      throw new BadRequestException('ID inválido');
    const conv = await this.convModel.findById(conversacionId);
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    const id = agenteId || user._id;
    if (!isValidObjectId(id))
      throw new BadRequestException('ID de agente inválido');
    conv.asignadoA = new Types.ObjectId(id);
    await conv.save();
    return conv.toObject();
  }

  // ── Presencia multi-agente (soft-lock) ─────────────────────────────
  /**
   * Reclama / refresca la atención del agente sobre la conversación.
   * - Si nadie atiende → se reclama para el agente actual.
   * - Si lo atiende EL MISMO usuario → solo refresca su `ultimaActividad`.
   * - Si lo atiende OTRO y siguen siendo <15min → no roba, retorna conv
   *   indicando quién está atendiendo (la UI muestra "X está atendiendo").
   * - Si lo atiende OTRO pero pasaron >15min → toma el control.
   */
  async claimAtencion(user: any, conversacionId: string) {
    if (!this.esSoporte(user))
      throw new ForbiddenException('Solo agentes de soporte');
    if (!isValidObjectId(conversacionId))
      throw new BadRequestException('ID inválido');
    const conv = await this.convModel.findById(conversacionId);
    if (!conv) throw new NotFoundException('Conversación no encontrada');

    await this._expirarAtencion(conv);

    const ahora = new Date();
    const yo = user._id.toString();
    const actual: any = conv.atendiendoAhora;

    let cambio = false;
    if (!actual) {
      conv.atendiendoAhora = {
        userId: new Types.ObjectId(yo),
        nombre: user.nombre || user.email || 'Agente',
        ultimaActividad: ahora,
      };
      cambio = true;
    } else if (actual.userId?.toString() === yo) {
      conv.atendiendoAhora = { ...actual, ultimaActividad: ahora };
    }
    // else: otro agente está atendiendo y aún no expira → no robamos.

    await conv.save();
    if (cambio) {
      this.gateway
        .emitConversacionActualizada(conv.toObject())
        .catch(() => {});
    }
    return conv.toObject();
  }

  /** Heartbeat: refresca actividad. */
  async heartbeatAtencion(user: any, conversacionId: string) {
    if (!isValidObjectId(conversacionId))
      throw new BadRequestException('ID inválido');
    const conv = await this.convModel.findById(conversacionId);
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    const actual: any = conv.atendiendoAhora;
    if (actual?.userId?.toString() === user._id.toString()) {
      conv.atendiendoAhora = { ...actual, ultimaActividad: new Date() };
      await conv.save();
    }
    return { ok: true };
  }

  /** Libera explícitamente la atención (al cerrar la pantalla). */
  async liberarAtencion(user: any, conversacionId: string) {
    if (!isValidObjectId(conversacionId))
      throw new BadRequestException('ID inválido');
    const conv = await this.convModel.findById(conversacionId);
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    const actual: any = conv.atendiendoAhora;
    if (actual?.userId?.toString() === user._id.toString()) {
      conv.atendiendoAhora = null;
      await conv.save();
      this.gateway
        .emitConversacionActualizada(conv.toObject())
        .catch(() => {});
    }
    return { ok: true };
  }

  async cambiarEstado(
    user: any,
    conversacionId: string,
    estado: EstadoConversacion,
  ) {
    if (!this.puedeResponder(user))
      throw new ForbiddenException('Sin permiso');
    if (!isValidObjectId(conversacionId))
      throw new BadRequestException('ID inválido');
    const conv = await this.convModel.findById(conversacionId);
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    conv.estado = estado;
    await conv.save();
    return conv.toObject();
  }

  async contadorNoLeidos(user: any): Promise<number> {
    if (this.esSoporte(user)) {
      const agg = await this.convModel.aggregate([
        { $match: { noLeidosSoporte: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$noLeidosSoporte' } } },
      ]);
      return agg[0]?.total || 0;
    }
    const localId = await this.resolverLocalId(user);
    const conv = await this.convModel.findOne({ localId });
    return conv?.noLeidosLocal || 0;
  }

  // ── Helpers internos ─────────────────────────────────────────────────
  async validarAcceso(
    user: any,
    conv: ConversacionDocument | { localId: any; _id: any },
  ): Promise<void> {
    if (this.esSoporte(user)) return;
    const localId = await this.resolverLocalId(user);
    if (localId.toString() !== conv.localId.toString()) {
      throw new ForbiddenException('No tienes acceso a esta conversación.');
    }
  }

  private async enviarPush(
    conv: ConversacionDocument,
    mensaje: any,
    autor: any,
  ): Promise<void> {
    try {
      const convId = (conv._id as Types.ObjectId).toString();
      const titulo =
        mensaje.autorTipo === 'LOCAL'
          ? autor.nombre || 'Local'
          : 'Soporte Enjoy';
      const body = mensaje.texto || (mensaje.adjuntoUrl ? '📷 Imagen' : '');
      const data = {
        tipo: 'chat',
        conversacionId: convId,
        autorTipo: mensaje.autorTipo,
      };

      // ── Mensaje del soporte → notificar al local dueño
      if (mensaje.autorTipo === 'SOPORTE') {
        const receptor: any = await this.usuariosService
          .findByIdRaw(conv.localId.toString())
          .catch(() => null);
        if (receptor?.fcmToken) {
          await this.notif.enviarAToken(receptor.fcmToken, titulo, body, data);
        }
        return;
      }

      // ── Mensaje del LOCAL → push al asignado (routing ya lo determinó).
      //   Si no hay asignado (pool vacío) → fallback a todos los chat.responder.
      let agenteIds: string[] = [];
      if (conv.asignadoA) {
        agenteIds = [conv.asignadoA.toString()];
      } else {
        agenteIds = await this._idsAgentesConPermiso(['chat.responder']);
      }

      for (const id of agenteIds) {
        if (id === autor._id?.toString()) continue;
        const u: any = await this.usuariosService
          .findByIdRaw(id)
          .catch(() => null);
        if (u?.fcmToken) {
          await this.notif.enviarAToken(u.fcmToken, titulo, body, data);
        }
      }
    } catch (e: any) {
      console.error('chat enviarPush', e?.message);
    }
  }

  /**
   * Devuelve los _id (string) de los usuarios cuyo rol incluye alguno de
   * los permisos dados. Usa el campo `rol` (slug).
   */
  private async _idsAgentesConPermiso(perms: string[]): Promise<string[]> {
    const roles = await this.rolModel
      .find({ permisos: { $in: perms } }, { slug: 1 })
      .lean();
    const slugs = roles.map((r: any) => r.slug);
    if (!slugs.length) return [];
    const usuarios = await this.usuarioModel
      .find({ rol: { $in: slugs }, estado: true }, { _id: 1 })
      .lean();
    return usuarios.map((u: any) => u._id.toString());
  }
}
