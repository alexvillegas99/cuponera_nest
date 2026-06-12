import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types, isValidObjectId } from 'mongoose';
import {
  PromocionFlash,
  PromocionFlashDocument,
  EstadoPromocionFlash,
  TipoPromocionFlash,
} from './schema/promocion-flash.schema';
import {
  HistoricoFlash,
  HistoricoFlashDocument,
} from './schema/historico-flash.schema';
import { AmazonS3Service } from '../amazon-s3/amazon-s3.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CreatePromocionFlashDto } from './dto/create-promocion-flash.dto';
import { UpdatePromocionFlashDto } from './dto/update-promocion-flash.dto';

@Injectable()
export class PromocionesFlashService {
  private readonly logger = new Logger(PromocionesFlashService.name);

  private readonly MAX_ACTIVAS = 5;
  private readonly MAX_DIAS = 30; // duración máxima (permite programar a futuro)
  private readonly MAX_IMG_BYTES = 2 * 1024 * 1024; // red de seguridad ~2MB

  constructor(
    @InjectModel(PromocionFlash.name)
    private readonly model: Model<PromocionFlashDocument>,
    @InjectModel(HistoricoFlash.name)
    private readonly historicoModel: Model<HistoricoFlashDocument>,
    @InjectModel('Ciudad') private readonly ciudadModel: Model<any>,
    private readonly s3: AmazonS3Service,
    private readonly usuariosService: UsuariosService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async _subirImagen(base64: string): Promise<string> {
    const limpio = base64.includes(',') ? base64.split(',').pop()! : base64;
    const approxBytes = Math.floor((limpio.length * 3) / 4);
    if (approxBytes > this.MAX_IMG_BYTES) {
      throw new BadRequestException(
        'La imagen supera el tamaño permitido (~2MB). Comprímela antes de subir.',
      );
    }
    const { url } = await this.s3.uploadBase64({
      image: base64,
      route: 'promociones-flash',
    });
    return url;
  }

  /** Calcula inicia/vence aplicando el tope de 7 días. */
  private _calcVigencia(iniciaStr?: string | Date, venceStr?: string | Date) {
    const inicia = iniciaStr ? new Date(iniciaStr) : new Date();
    const max = new Date(inicia.getTime() + this.MAX_DIAS * 86400000);
    let vence = venceStr ? new Date(venceStr) : max;
    if (isNaN(vence.getTime()) || vence > max || vence <= inicia) vence = max;
    return { inicia, vence };
  }

  /** Mapea para la gestión del local (incluye flags y métricas). */
  private _mine(d: any) {
    return {
      ...d,
      _id: String(d._id),
      vencida: new Date(d.vence) < new Date(),
    };
  }

  /** Mapea para el cliente (card del feed / detalle). */
  private _card(d: any, full = false) {
    const local = d.usuario && typeof d.usuario === 'object' ? d.usuario : null;
    const dp = local?.detallePromocion || {};
    return {
      _id: String(d._id),
      titulo: d.titulo,
      descripcion: d.descripcion ?? '',
      imagenUrl: d.imagenUrl,
      tipo: d.tipo,
      etiqueta: d.etiqueta ?? null,
      precio: d.precio ?? null,
      precioAntes: d.precioAntes ?? null,
      inicia: d.inicia,
      vence: d.vence,
      canjeable: d.canjeable === true,
      cupos: d.cupos ?? null,
      canjes: d.canjes ?? 0,
      limitePorCliente: d.limitePorCliente ?? 1,
      localId: local ? String(local._id) : String(d.usuario),
      localNombre: dp.placeName || local?.nombre || '',
      localLogo: dp.logoUrl || '',
      ...(full
        ? {
            localDireccion: dp.address ?? '',
            ubicacion: local?.ubicacion ?? null,
          }
        : {}),
    };
  }

  private async _validarElegibilidad(doc: any, clienteId: string) {
    if (doc.cupos != null && (doc.canjes ?? 0) >= doc.cupos) {
      throw new BadRequestException('Esta promoción ya no tiene cupos.');
    }
    const usados = await this.historicoModel.countDocuments({
      promocion: doc._id,
      cliente: new Types.ObjectId(clienteId),
    });
    if (usados >= (doc.limitePorCliente ?? 1)) {
      throw new BadRequestException('Ya canjeaste esta promoción.');
    }
  }

  // ── Admin-local ──────────────────────────────────────────────────────────

  async crear(usuarioId: string, dto: CreatePromocionFlashDto) {
    const local = await this.usuariosService.getAdminLocalRaw(usuarioId);

    const activas = await this.model.countDocuments({
      usuario: new Types.ObjectId(String(local._id)),
      estado: EstadoPromocionFlash.ACTIVA,
      vence: { $gt: new Date() },
    });
    if (activas >= this.MAX_ACTIVAS) {
      throw new BadRequestException(
        `Alcanzaste el máximo de ${this.MAX_ACTIVAS} promociones flash activas.`,
      );
    }

    let imagenUrl = dto.imagenUrl;
    if (dto.imagenBase64) imagenUrl = await this._subirImagen(dto.imagenBase64);
    if (!imagenUrl) throw new BadRequestException('La imagen es obligatoria.');

    const ciudades = (local.ciudades || []).map(
      (c: any) => new Types.ObjectId(String(c)),
    );
    const { inicia, vence } = this._calcVigencia(dto.inicia, dto.vence);
    const canjeable = dto.canjeable === true;

    const doc = await this.model.create({
      usuario: new Types.ObjectId(String(local._id)),
      ciudades,
      titulo: dto.titulo,
      descripcion: dto.descripcion ?? '',
      imagenUrl,
      tipo: dto.tipo ?? TipoPromocionFlash.ANUNCIO,
      etiqueta: dto.etiqueta ?? null,
      precio: dto.precio ?? null,
      precioAntes: dto.precioAntes ?? null,
      inicia,
      vence,
      canjeable,
      cupos: canjeable ? (dto.cupos ?? null) : null,
      limitePorCliente: canjeable ? (dto.limitePorCliente ?? 1) : 1,
      estado: EstadoPromocionFlash.ACTIVA,
    });
    return this._mine(doc.toObject());
  }

  async listarMias(usuarioId: string, estado?: string) {
    const local = await this.usuariosService.getAdminLocalRaw(usuarioId);
    const q: any = {
      usuario: new Types.ObjectId(String(local._id)),
      estado: { $ne: EstadoPromocionFlash.ELIMINADA },
    };
    if (estado) q.estado = estado;
    const docs = await this.model.find(q).sort({ createdAt: -1 }).lean();
    const activas = docs.filter(
      (d: any) =>
        d.estado === EstadoPromocionFlash.ACTIVA &&
        new Date(d.vence) >= new Date(),
    ).length;
    return {
      data: docs.map((d) => this._mine(d)),
      activas,
      max: this.MAX_ACTIVAS,
    };
  }

  async actualizar(
    usuarioId: string,
    id: string,
    dto: UpdatePromocionFlashDto,
  ) {
    const local = await this.usuariosService.getAdminLocalRaw(usuarioId);
    const doc = await this.model.findOne({
      _id: id,
      usuario: new Types.ObjectId(String(local._id)),
      estado: { $ne: EstadoPromocionFlash.ELIMINADA },
    });
    if (!doc) throw new NotFoundException('Promoción no encontrada');

    if (dto.imagenBase64) doc.imagenUrl = await this._subirImagen(dto.imagenBase64);
    else if (dto.imagenUrl) doc.imagenUrl = dto.imagenUrl;

    if (dto.titulo !== undefined) doc.titulo = dto.titulo;
    if (dto.descripcion !== undefined) doc.descripcion = dto.descripcion;
    if (dto.tipo !== undefined) doc.tipo = dto.tipo;
    if (dto.etiqueta !== undefined) doc.etiqueta = dto.etiqueta;
    if (dto.precio !== undefined) doc.precio = dto.precio;
    if (dto.precioAntes !== undefined) doc.precioAntes = dto.precioAntes;

    if (dto.inicia !== undefined || dto.vence !== undefined) {
      const { inicia, vence } = this._calcVigencia(
        dto.inicia ?? doc.inicia,
        dto.vence,
      );
      doc.inicia = inicia;
      doc.vence = vence;
    }

    if (dto.canjeable !== undefined) {
      doc.canjeable = dto.canjeable;
      if (!dto.canjeable) {
        doc.cupos = null;
        doc.limitePorCliente = 1;
      }
    }
    if (doc.canjeable) {
      if (dto.cupos !== undefined) doc.cupos = dto.cupos;
      if (dto.limitePorCliente !== undefined)
        doc.limitePorCliente = dto.limitePorCliente;
    }

    if (
      dto.estado &&
      [EstadoPromocionFlash.ACTIVA, EstadoPromocionFlash.PAUSADA].includes(
        dto.estado,
      )
    ) {
      doc.estado = dto.estado;
    }

    await doc.save();
    return this._mine(doc.toObject());
  }

  async eliminar(usuarioId: string, id: string) {
    const local = await this.usuariosService.getAdminLocalRaw(usuarioId);
    const r = await this.model.updateOne(
      { _id: id, usuario: new Types.ObjectId(String(local._id)) },
      { estado: EstadoPromocionFlash.ELIMINADA },
    );
    if (!r.matchedCount) throw new NotFoundException('Promoción no encontrada');
    return { ok: true };
  }

  // ── Cliente ────────────────────────────────────────────────────────────────

  async feed(params: {
    ciudades?: string;
    provincia?: string;
    page?: number;
    limit?: number;
  }) {
    let cityIds: Types.ObjectId[] = [];
    if (params.ciudades) {
      cityIds = params.ciudades
        .split(',')
        .map((s) => s.trim())
        .filter((s) => isValidObjectId(s))
        .map((s) => new Types.ObjectId(s));
    } else if (params.provincia && isValidObjectId(params.provincia)) {
      const cs = await this.ciudadModel
        .find({ provincia: new Types.ObjectId(params.provincia) })
        .select('_id')
        .lean();
      cityIds = cs.map((c: any) => c._id);
    }

    const now = new Date();
    // Incluye las ACTIVAS vigentes y las que empiezan dentro de las próximas
    // 24h ("Próximamente"), para mostrarlas con cuenta regresiva al inicio.
    const en24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const match: any = {
      estado: EstadoPromocionFlash.ACTIVA,
      vence: { $gt: now },
      inicia: { $lte: en24h },
    };
    if (cityIds.length) match.ciudades = { $in: cityIds };

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));

    const [items, total] = await Promise.all([
      this.model
        .find(match)
        .sort({ vence: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: 'usuario',
          select: 'nombre detallePromocion ubicacion',
        })
        .lean(),
      this.model.countDocuments(match),
    ]);

    return {
      data: items.map((d) => this._card(d)),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  async detalle(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('id inválido');
    const doc = await this.model
      .findByIdAndUpdate(id, { $inc: { vistas: 1 } }, { new: true })
      .populate({ path: 'usuario', select: 'nombre detallePromocion ubicacion' })
      .lean();
    if (!doc || (doc as any).estado === EstadoPromocionFlash.ELIMINADA) {
      throw new NotFoundException('Promoción no encontrada');
    }
    return this._card(doc, true);
  }

  /** El cliente pide usar la promo: pre-valida y devuelve el QR a mostrar. */
  async usar(clienteId: string, id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('id inválido');
    const doc: any = await this.model.findById(id).lean();
    if (!doc || doc.estado !== EstadoPromocionFlash.ACTIVA) {
      throw new NotFoundException('Promoción no disponible');
    }
    if (!doc.canjeable) {
      throw new BadRequestException(
        'Esta promoción es solo informativa, no requiere canje.',
      );
    }
       if (new Date(doc.inicia) > new Date()) {
      throw new BadRequestException('La promoción aún no ha comenzado.');
    }
 if (new Date(doc.vence) < new Date()) {
      throw new BadRequestException('La promoción ya venció.');
    }
    await this._validarElegibilidad(doc, clienteId);
    return { qrData: `flash:${id}:${clienteId}`, titulo: doc.titulo };
  }

  /** El staff escanea el QR del cliente y confirma el canje. */
  async validar(params: {
    promocionId: string;
    clienteId: string;
    staff: any;
  }) {
    const { promocionId, clienteId, staff } = params;
    if (!isValidObjectId(promocionId) || !isValidObjectId(clienteId)) {
      throw new BadRequestException('Datos de canje inválidos');
    }
    const doc = await this.model.findById(promocionId);
    if (!doc || doc.estado !== EstadoPromocionFlash.ACTIVA) {
      throw new NotFoundException('Promoción no disponible');
    }
    if (!doc.canjeable) {
      throw new BadRequestException('Esta promoción no es canjeable.');
    }
       if (new Date(doc.inicia) > new Date()) {
      throw new BadRequestException('La promoción aún no ha comenzado.');
    }
 if (new Date(doc.vence) < new Date()) {
      throw new BadRequestException('La promoción ya venció.');
    }

    // El staff/admin-local solo valida promos de SU local.
    const localStaff = await this.usuariosService.getAdminLocalRaw(
      String(staff._id),
    );
    if (String(localStaff._id) !== String(doc.usuario)) {
      throw new ForbiddenException('Esta promoción no pertenece a tu local.');
    }

    await this._validarElegibilidad(doc, clienteId);

    await this.historicoModel.create({
      promocion: doc._id,
      cliente: new Types.ObjectId(clienteId),
      local: doc.usuario,
      validadoPor: new Types.ObjectId(String(staff._id)),
    });
    doc.canjes = (doc.canjes ?? 0) + 1;
    await doc.save();

    return { ok: true, titulo: doc.titulo, canjes: doc.canjes };
  }

  // ── Mantenimiento (cron) ────────────────────────────────────────────────────

  /** Marca como VENCIDA las promociones cuya fecha de vigencia ya pasó. */
  async expirarVencidas(): Promise<number> {
    const r = await this.model.updateMany(
      { estado: EstadoPromocionFlash.ACTIVA, vence: { $lt: new Date() } },
      { estado: EstadoPromocionFlash.VENCIDA },
    );
    return r.modifiedCount ?? 0;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cronExpirar() {
    try {
      const n = await this.expirarVencidas();
      if (n) this.logger.log(`⏱️ Promos flash marcadas como vencidas: ${n}`);
    } catch (e: any) {
      this.logger.error(`Error expirando promos flash: ${e?.message}`);
    }
  }
}
