import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import {
  RoutingConfig,
  RoutingConfigDocument,
} from './schema/routing-config.schema';
import {
  Conversacion,
  ConversacionDocument,
  EstadoConversacion,
} from './schema/conversacion.schema';
import { Usuario, UsuarioDocument } from '../usuarios/schema/usuario.schema';
import { Rol, RolDocument } from '../roles/schema/rol.schema';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    @InjectModel(RoutingConfig.name)
    private readonly cfgModel: Model<RoutingConfigDocument>,
    @InjectModel(Conversacion.name)
    private readonly convModel: Model<ConversacionDocument>,
    @InjectModel(Usuario.name)
    private readonly usuarioModel: Model<UsuarioDocument>,
    @InjectModel(Rol.name)
    private readonly rolModel: Model<RolDocument>,
    private readonly notif: NotificacionesService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly gateway: ChatGateway,
  ) {}

  // ── Config singleton ───────────────────────────────────────────────
  async getConfig(): Promise<RoutingConfigDocument> {
    let cfg = await this.cfgModel.findOne({ clave: 'default' });
    if (!cfg) {
      cfg = await this.cfgModel.create({
        clave: 'default',
        habilitado: true,
        escalacionMin: 30,
        pool: [],
        rotacionIndex: 0,
      });
    }
    return cfg;
  }

  async updateConfig(dto: {
    habilitado?: boolean;
    escalacionMin?: number;
    pool?: { userId: string; nombre: string }[];
  }) {
    const cfg = await this.getConfig();
    if (typeof dto.habilitado === 'boolean') cfg.habilitado = dto.habilitado;
    if (typeof dto.escalacionMin === 'number' && dto.escalacionMin > 0) {
      cfg.escalacionMin = Math.max(1, Math.min(720, dto.escalacionMin));
    }
    if (Array.isArray(dto.pool)) {
      cfg.pool = dto.pool.map((m) => ({
        userId: new Types.ObjectId(m.userId),
        nombre: m.nombre,
      }));
      cfg.rotacionIndex = 0;
    }
    await cfg.save();
    return cfg.toObject();
  }

  // ── Agentes disponibles (chat.ver) ─────────────────────────────────
  async listarAgentes(): Promise<
    { _id: string; nombre: string; email: string; rol: string }[]
  > {
    const roles = await this.rolModel
      .find({ permisos: 'chat.ver' }, { slug: 1 })
      .lean();
    const slugs = roles.map((r: any) => r.slug);
    if (!slugs.length) return [];
    const usuarios = await this.usuarioModel
      .find(
        { rol: { $in: slugs }, estado: true },
        { _id: 1, nombre: 1, email: 1, rol: 1 },
      )
      .sort({ nombre: 1 })
      .lean();
    return usuarios.map((u: any) => ({
      _id: u._id.toString(),
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
    }));
  }

  // ── Asignación inicial / re-asignación al recibir mensaje del LOCAL ─
  /**
   * Llamado cuando un mensaje del LOCAL llega.
   * Si no hay asignación o si la escalación ya venció, asigna al siguiente
   * en el pool y emite notificación.
   * Devuelve el _id del agente a notificar (o null si no hay pool).
   */
  async asignarAlRecibirMensaje(
    conv: ConversacionDocument,
  ): Promise<string | null> {
    const cfg = await this.getConfig();
    if (!cfg.habilitado || cfg.pool.length === 0) {
      return null;
    }

    const ahora = Date.now();
    const debeEscalar =
      conv.proximaEscalacion &&
      new Date(conv.proximaEscalacion).getTime() < ahora;

    if (conv.asignadoA && !debeEscalar) {
      // Sigue asignado y dentro del tiempo: actualizar timer y notificar a él.
      conv.proximaEscalacion = new Date(
        ahora + cfg.escalacionMin * 60_000,
      );
      await conv.save();
      return conv.asignadoA.toString();
    }

    // (re)asignar al siguiente del pool.
    const indicePrevio = cfg.rotacionIndex % cfg.pool.length;
    let nuevoIndice = indicePrevio;

    // Si ya estaba asignado al actual y escalamos, avanzar.
    if (debeEscalar && conv.asignadoA) {
      const idxActual = cfg.pool.findIndex(
        (m) => m.userId?.toString() === conv.asignadoA?.toString(),
      );
      if (idxActual >= 0) {
        nuevoIndice = (idxActual + 1) % cfg.pool.length;
      } else {
        nuevoIndice = cfg.rotacionIndex % cfg.pool.length;
      }
    }

    const nuevoAgente = cfg.pool[nuevoIndice];
    const tipo = conv.asignadoA ? 'ESCALACION' : 'ASIGNACION_INICIAL';

    conv.historialTransferencias = [
      ...(conv.historialTransferencias || []),
      {
        deUserId: conv.asignadoA || undefined,
        deNombre: conv.asignadoANombre || '',
        paraUserId: nuevoAgente.userId,
        paraNombre: nuevoAgente.nombre,
        observacion:
          tipo === 'ESCALACION'
            ? `Escalado automáticamente tras ${cfg.escalacionMin} min sin respuesta`
            : 'Asignación inicial automática',
        tipo: tipo as any,
        fecha: new Date(),
      },
    ];

    conv.asignadoA = nuevoAgente.userId;
    conv.asignadoANombre = nuevoAgente.nombre;
    conv.proximaEscalacion = new Date(
      ahora + cfg.escalacionMin * 60_000,
    );
    await conv.save();

    // Avanzar cursor de rotación para la próxima nueva conversación.
    cfg.rotacionIndex = (nuevoIndice + 1) % cfg.pool.length;
    await cfg.save();

    this.gateway
      .emitConversacionActualizada(conv.toObject())
      .catch(() => {});
    return nuevoAgente.userId.toString();
  }

  /** El agente asignado respondió: reset del timer. */
  async marcarRespuesta(conv: ConversacionDocument) {
    const cfg = await this.getConfig();
    if (!cfg.habilitado || cfg.pool.length === 0) return;
    if (!conv.asignadoA) return;
    conv.proximaEscalacion = new Date(
      Date.now() + cfg.escalacionMin * 60_000,
    );
    await conv.save();
  }

  // ── Transferencia manual ──────────────────────────────────────────
  async transferir(
    user: any,
    conv: ConversacionDocument,
    paraUserId: string,
    observacion: string,
  ) {
    if (!Types.ObjectId.isValid(paraUserId)) {
      throw new BadRequestException('ID de destino inválido');
    }
    if (!observacion || !observacion.trim()) {
      throw new BadRequestException('La observación es obligatoria');
    }

    const destino: any = await this.usuarioModel
      .findById(paraUserId, { nombre: 1, fcmToken: 1, email: 1 })
      .lean();
    if (!destino) throw new BadRequestException('Destino no encontrado');

    const cfg = await this.getConfig();
    const ahora = Date.now();

    conv.historialTransferencias = [
      ...(conv.historialTransferencias || []),
      {
        deUserId: new Types.ObjectId(user._id),
        deNombre: user.nombre || user.email || '',
        paraUserId: new Types.ObjectId(paraUserId),
        paraNombre: destino.nombre || destino.email || 'Agente',
        observacion: observacion.trim(),
        tipo: 'TRANSFERENCIA',
        fecha: new Date(),
      },
    ];
    conv.asignadoA = new Types.ObjectId(paraUserId);
    conv.asignadoANombre = destino.nombre || destino.email || 'Agente';
    conv.proximaEscalacion = cfg.habilitado
      ? new Date(ahora + cfg.escalacionMin * 60_000)
      : null;
    await conv.save();

    // Push al destino
    if (destino.fcmToken) {
      const titulo = 'Chat transferido a ti';
      const body = `De ${user.nombre || 'Agente'}: "${observacion.trim().slice(0, 80)}"`;
      this.notif
        .enviarAToken(destino.fcmToken, titulo, body, {
          tipo: 'chat',
          conversacionId: (conv._id as Types.ObjectId).toString(),
          autorTipo: 'TRANSFERENCIA',
        })
        .catch(() => {});
    }

    this.gateway
      .emitConversacionActualizada(conv.toObject())
      .catch(() => {});

    return conv.toObject();
  }

  // ── Cron de escalación ────────────────────────────────────────────
  @Cron(CronExpression.EVERY_MINUTE)
  async procesarEscalaciones() {
    try {
      const cfg = await this.getConfig();
      if (!cfg.habilitado || cfg.pool.length === 0) return;

      const ahora = new Date();
      const vencidas = await this.convModel
        .find({
          estado: EstadoConversacion.ABIERTA,
          asignadoA: { $ne: null },
          proximaEscalacion: { $lte: ahora },
          // Solo escalar si hay mensajes pendientes para el agente
          noLeidosSoporte: { $gt: 0 },
        })
        .limit(50);

      for (const conv of vencidas) {
        const nuevoId = await this.asignarAlRecibirMensaje(conv);
        if (nuevoId) {
          const destino: any = await this.usuarioModel
            .findById(nuevoId, { fcmToken: 1 })
            .lean();
          if (destino?.fcmToken) {
            const titulo = 'Chat escalado a ti';
            const body =
              conv.ultimoMensaje?.texto?.slice(0, 80) ||
              'Nuevo hilo asignado por escalación';
            this.notif
              .enviarAToken(destino.fcmToken, titulo, body, {
                tipo: 'chat',
                conversacionId: (conv._id as Types.ObjectId).toString(),
                autorTipo: 'ESCALACION',
              })
              .catch(() => {});
          }
        }
      }

      if (vencidas.length) {
        this.logger.log(`Escalaciones procesadas: ${vencidas.length}`);
      }
    } catch (e: any) {
      this.logger.error(`procesarEscalaciones: ${e?.message}`);
    }
  }
}
