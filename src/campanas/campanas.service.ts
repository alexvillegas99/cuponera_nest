import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types, isValidObjectId } from 'mongoose';
import {
  Campana,
  CampanaDocument,
  EstadoCampana,
  TipoAccion,
  TipoSegmento,
} from './schema/campana.schema';
import {
  CampanaEntrega,
  CampanaEntregaDocument,
} from './schema/campana-entrega.schema';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CreateCampanaDto, UpdateCampanaDto } from './dto/create-campana.dto';

@Injectable()
export class CampanasService {
  private readonly logger = new Logger(CampanasService.name);

  constructor(
    @InjectModel(Campana.name)
    private readonly campanaModel: Model<CampanaDocument>,
    @InjectModel(CampanaEntrega.name)
    private readonly entregaModel: Model<CampanaEntregaDocument>,
    @InjectModel('Cliente')
    private readonly clienteModel: Model<any>,
    @InjectModel('Provincia')
    private readonly provinciaModel: Model<any>,
    @InjectModel('Ciudad')
    private readonly ciudadModel: Model<any>,
    private readonly notif: NotificacionesService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────
  private _normalizarRefId(id?: string | null) {
    if (!id) return null;
    return isValidObjectId(id) ? new Types.ObjectId(id) : null;
  }

  /**
   * Calcula la audiencia (clientes destinatarios) según el segmento.
   * Devuelve los IDs de cliente que deben recibir la campaña.
   */
  private async _resolverAudiencia(c: CampanaDocument): Promise<{
    clienteIds: Types.ObjectId[];
    topic: string | null;
  }> {
    let match: any = {};
    let topic: string | null = null;

    switch (c.tipoSegmento) {
      case TipoSegmento.TODOS:
        topic = 'all_clientes';
        break;
      case TipoSegmento.PROVINCIA:
        if (!c.provinciaId) {
          throw new BadRequestException(
            'Falta provinciaId para segmento PROVINCIA',
          );
        }
        match.provincia = c.provinciaId;
        {
          const prov: any = await this.provinciaModel
            .findById(c.provinciaId, { slug: 1 })
            .lean();
          if (prov?.slug) topic = `prov_${prov.slug}`;
        }
        break;
      case TipoSegmento.CIUDAD:
        if (!c.ciudadId) {
          throw new BadRequestException(
            'Falta ciudadId para segmento CIUDAD',
          );
        }
        match.ciudad = c.ciudadId;
        topic = `ciudad_${c.ciudadId.toString()}`;
        break;
      case TipoSegmento.CATEGORIA:
        if (!c.categoriaId) {
          throw new BadRequestException(
            'Falta categoriaId para segmento CATEGORIA',
          );
        }
        // Audiencia por categoría: por ahora delegamos al topic.
        // La persistencia in-app se hace a TODOS los clientes que tengan
        // esa categoría como favorita (cuando exista ese flag).
        topic = `cat_${c.categoriaId.toString()}`;
        break;
      case TipoSegmento.TOPIC:
        if (!c.topicCustom) {
          throw new BadRequestException(
            'Falta topicCustom para segmento TOPIC',
          );
        }
        topic = c.topicCustom;
        // Sin filtro de clientes — solo push, no se persiste in-app salvo a TODOS.
        // (caso límite avanzado)
        break;
    }

    match.estado = true;
    match.deleted = { $ne: true };
    const clientes = await this.clienteModel.find(match, { _id: 1 }).lean();
    return {
      clienteIds: clientes.map((c: any) => c._id as Types.ObjectId),
      topic,
    };
  }

  // ── CRUD admin ─────────────────────────────────────────────────────
  async crear(user: any, dto: CreateCampanaDto): Promise<any> {
    if (!user?._id) throw new BadRequestException('Usuario inválido');

    const estado = dto.guardarBorrador
      ? EstadoCampana.BORRADOR
      : dto.programadaPara
        ? EstadoCampana.PROGRAMADA
        : EstadoCampana.PROGRAMADA; // se enviará inmediatamente abajo

    const campana = await this.campanaModel.create({
      titulo: dto.titulo,
      cuerpo: dto.cuerpo,
      imagenUrl: dto.imagenUrl || '',
      tipoSegmento: dto.tipoSegmento,
      provinciaId: this._normalizarRefId(dto.provinciaId),
      ciudadId: this._normalizarRefId(dto.ciudadId),
      categoriaId: this._normalizarRefId(dto.categoriaId),
      topicCustom: dto.topicCustom || null,
      tipoAccion: dto.tipoAccion || TipoAccion.NINGUNA,
      accionRefId: this._normalizarRefId(dto.accionRefId),
      accionUrl: dto.accionUrl || '',
      estado,
      programadaPara: dto.programadaPara ? new Date(dto.programadaPara) : null,
      autorId: new Types.ObjectId(user._id),
      autorNombre: user.nombre || user.email || 'Admin',
    });

    // Envío inmediato si NO es borrador y NO está programada al futuro.
    if (!dto.guardarBorrador && !dto.programadaPara) {
      this.enviar(campana._id as Types.ObjectId, dto.enviarPush !== false)
        .catch((e) =>
          this.logger.error(`Envío inmediato falló: ${e?.message}`),
        );
    }

    return campana.toObject();
  }

  async actualizar(id: string, dto: UpdateCampanaDto) {
    if (!isValidObjectId(id)) throw new BadRequestException('ID inválido');
    const c = await this.campanaModel.findById(id);
    if (!c) throw new NotFoundException('Campaña no encontrada');
    if (c.estado === EstadoCampana.ENVIADA) {
      throw new BadRequestException(
        'No se puede editar una campaña ya enviada',
      );
    }

    Object.assign(c, {
      titulo: dto.titulo ?? c.titulo,
      cuerpo: dto.cuerpo ?? c.cuerpo,
      imagenUrl: dto.imagenUrl ?? c.imagenUrl,
      tipoSegmento: dto.tipoSegmento ?? c.tipoSegmento,
      provinciaId:
        dto.provinciaId !== undefined
          ? this._normalizarRefId(dto.provinciaId)
          : c.provinciaId,
      ciudadId:
        dto.ciudadId !== undefined
          ? this._normalizarRefId(dto.ciudadId)
          : c.ciudadId,
      categoriaId:
        dto.categoriaId !== undefined
          ? this._normalizarRefId(dto.categoriaId)
          : c.categoriaId,
      topicCustom: dto.topicCustom ?? c.topicCustom,
      tipoAccion: dto.tipoAccion ?? c.tipoAccion,
      accionRefId:
        dto.accionRefId !== undefined
          ? this._normalizarRefId(dto.accionRefId)
          : c.accionRefId,
      accionUrl: dto.accionUrl ?? c.accionUrl,
      programadaPara: dto.programadaPara
        ? new Date(dto.programadaPara)
        : c.programadaPara,
    });
    await c.save();
    return c.toObject();
  }

  async cancelar(id: string) {
    const c = await this.campanaModel.findById(id);
    if (!c) throw new NotFoundException('Campaña no encontrada');
    if (c.estado === EstadoCampana.ENVIADA) {
      throw new BadRequestException('Ya fue enviada');
    }
    c.estado = EstadoCampana.CANCELADA;
    await c.save();
    return c.toObject();
  }

  /**
   * Clona una campaña existente como BORRADOR (sin métricas ni entregas).
   * Útil para reenviar el mismo mensaje a la misma segmentación sin volver
   * a tipear todo. El admin después decide enviar ya o programar.
   */
  async duplicar(id: string, user: any) {
    if (!isValidObjectId(id)) throw new BadRequestException('ID inválido');
    const original = await this.campanaModel.findById(id).lean();
    if (!original) throw new NotFoundException('Campaña no encontrada');

    const sufijo = original.titulo?.includes('(copia)')
      ? ''
      : ' (copia)';
    const clon = await this.campanaModel.create({
      titulo: `${original.titulo}${sufijo}`,
      cuerpo: original.cuerpo,
      imagenUrl: original.imagenUrl || '',
      tipoSegmento: original.tipoSegmento,
      provinciaId: original.provinciaId || null,
      ciudadId: original.ciudadId || null,
      categoriaId: original.categoriaId || null,
      topicCustom: original.topicCustom || null,
      tipoAccion: original.tipoAccion || TipoAccion.NINGUNA,
      accionRefId: original.accionRefId || null,
      accionUrl: original.accionUrl || '',
      estado: EstadoCampana.BORRADOR,
      programadaPara: null,
      autorId: user?._id ? new Types.ObjectId(user._id) : original.autorId,
      autorNombre: user?.nombre || user?.email || original.autorNombre,
    });
    return clon.toObject();
  }

  /**
   * Elimina permanentemente una campaña y sus entregas a clientes.
   * Pensado para limpiar campañas ENVIADAS o CANCELADAS / FALLIDAS
   * que el admin no quiere seguir viendo en el panel ni en la bandeja
   * de los clientes.
   */
  async eliminar(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('ID inválido');
    const c = await this.campanaModel.findById(id);
    if (!c) throw new NotFoundException('Campaña no encontrada');
    await this.entregaModel.deleteMany({ campana: c._id });
    await this.campanaModel.deleteOne({ _id: c._id });
    return { ok: true, id };
  }

  async listar(query: { page?: number; limit?: number; estado?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const match: any = {};
    if (query.estado) match.estado = query.estado;
    const [items, total] = await Promise.all([
      this.campanaModel
        .find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.campanaModel.countDocuments(match),
    ]);
    return { items, total, page, limit };
  }

  async obtener(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('ID inválido');
    const c = await this.campanaModel
      .findById(id)
      .populate('provinciaId', 'nombre slug')
      .populate('ciudadId', 'nombre')
      .lean();
    if (!c) throw new NotFoundException('Campaña no encontrada');
    return c;
  }

  // ── Envío ──────────────────────────────────────────────────────────
  async enviar(idOrCampana: Types.ObjectId | string, conPush = true) {
    const c =
      typeof idOrCampana === 'string'
        ? await this.campanaModel.findById(idOrCampana)
        : await this.campanaModel.findById(idOrCampana);
    if (!c) throw new NotFoundException('Campaña no encontrada');
    if (c.estado === EstadoCampana.ENVIADA) return c.toObject();
    if (c.estado === EstadoCampana.CANCELADA) {
      throw new BadRequestException('La campaña fue cancelada');
    }

    try {
      const { clienteIds, topic } = await this._resolverAudiencia(c);

      // 1) Persistir entregas in-app (1 por cliente del segmento).
      if (clienteIds.length) {
        const snapshot = {
          titulo: c.titulo,
          cuerpo: c.cuerpo,
          imagenUrl: c.imagenUrl,
          tipoAccion: c.tipoAccion,
          accionRefId: c.accionRefId,
          accionUrl: c.accionUrl,
        };
        const ops = clienteIds.map((cliId) => ({
          updateOne: {
            filter: { campanaId: c._id, clienteId: cliId },
            update: {
              $setOnInsert: {
                campanaId: c._id,
                clienteId: cliId,
                ...snapshot,
                leida: false,
                pushSilencioso: false,
              },
            },
            upsert: true,
          },
        }));
        await this.entregaModel.bulkWrite(ops, { ordered: false });
      }

      // 2) Push FCM al topic (broadcast eficiente).
      let entregadasPush = 0;
      if (conPush && topic) {
        await this.notif.enviarATopic(
          topic,
          c.titulo,
          c.cuerpo,
          {
            tipo: 'campana',
            campanaId: (c._id as Types.ObjectId).toString(),
            accion: c.tipoAccion,
            accionRefId: c.accionRefId?.toString() || '',
            accionUrl: c.accionUrl || '',
          },
        );
        // FCM topic no devuelve count exacto; estimamos como totalDestinatarios.
        entregadasPush = clienteIds.length;
      }

      c.estado = EstadoCampana.ENVIADA;
      c.enviadaEn = new Date();
      c.totalDestinatarios = clienteIds.length;
      c.totalEntregadasPush = entregadasPush;
      c.errorDetalle = '';
      await c.save();
      this.logger.log(
        `Campaña ${c._id} enviada a ${clienteIds.length} cliente(s) ` +
          (topic ? `(topic=${topic})` : ''),
      );
      return c.toObject();
    } catch (e: any) {
      c.estado = EstadoCampana.FALLIDA;
      c.errorDetalle = e?.message || 'Error desconocido';
      await c.save();
      this.logger.error(`Falló campaña ${c._id}: ${e?.message}`);
      throw e;
    }
  }

  // ── Cron: procesar programadas ────────────────────────────────────
  @Cron(CronExpression.EVERY_MINUTE)
  async procesarProgramadas() {
    try {
      const ahora = new Date();
      const pendientes = await this.campanaModel
        .find({
          estado: EstadoCampana.PROGRAMADA,
          programadaPara: { $lte: ahora },
        })
        .limit(20);
      for (const c of pendientes) {
        try {
          await this.enviar(c._id as Types.ObjectId, true);
        } catch (e: any) {
          this.logger.error(`Programada falló: ${e?.message}`);
        }
      }
    } catch (e: any) {
      this.logger.error(`procesarProgramadas: ${e?.message}`);
    }
  }

  // ── Feed cliente (in-app) ──────────────────────────────────────────
  async feedCliente(
    clienteId: string,
    opts: { page?: number; limit?: number; soloNoLeidas?: boolean } = {},
  ) {
    if (!isValidObjectId(clienteId))
      throw new BadRequestException('ID inválido');
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(opts.limit) || 20));
    const match: any = { clienteId: new Types.ObjectId(clienteId) };
    if (opts.soloNoLeidas) match.leida = false;
    const [items, total, noLeidas] = await Promise.all([
      this.entregaModel
        .find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.entregaModel.countDocuments(match),
      this.entregaModel.countDocuments({
        clienteId: new Types.ObjectId(clienteId),
        leida: false,
      }),
    ]);
    return { items, total, page, limit, noLeidas };
  }

  async marcarLeida(clienteId: string, entregaId: string) {
    if (!isValidObjectId(entregaId)) return { ok: false };
    await this.entregaModel.updateOne(
      {
        _id: new Types.ObjectId(entregaId),
        clienteId: new Types.ObjectId(clienteId),
      },
      { $set: { leida: true, leidaEn: new Date() } },
    );
    return { ok: true };
  }

  async marcarTodasLeidas(clienteId: string) {
    if (!isValidObjectId(clienteId)) return { ok: false };
    const r = await this.entregaModel.updateMany(
      { clienteId: new Types.ObjectId(clienteId), leida: false },
      { $set: { leida: true, leidaEn: new Date() } },
    );
    return { ok: true, count: r.modifiedCount };
  }

  async contadorNoLeidas(clienteId: string) {
    if (!isValidObjectId(clienteId)) return 0;
    return this.entregaModel.countDocuments({
      clienteId: new Types.ObjectId(clienteId),
      leida: false,
    });
  }

  // ── Preferencias del cliente ──────────────────────────────────────
  async getPrefs(clienteId: string) {
    const c: any = await this.clienteModel
      .findById(clienteId, { prefsNotif: 1 })
      .lean();
    return (
      c?.prefsNotif ?? {
        push: true,
        promociones: true,
        nuevosLocales: true,
        actualizaciones: true,
      }
    );
  }

  async setPrefs(clienteId: string, prefs: Partial<any>) {
    const set: any = {};
    if (typeof prefs.push === 'boolean') set['prefsNotif.push'] = prefs.push;
    if (typeof prefs.promociones === 'boolean')
      set['prefsNotif.promociones'] = prefs.promociones;
    if (typeof prefs.nuevosLocales === 'boolean')
      set['prefsNotif.nuevosLocales'] = prefs.nuevosLocales;
    if (typeof prefs.actualizaciones === 'boolean')
      set['prefsNotif.actualizaciones'] = prefs.actualizaciones;
    if (!Object.keys(set).length) return { ok: false };
    await this.clienteModel.updateOne(
      { _id: new Types.ObjectId(clienteId) },
      { $set: set },
    );
    return { ok: true };
  }
}
