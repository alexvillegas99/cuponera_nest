// src/clientes/clientes.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { validarCedulaEc, validarRucEc } from './utils/identificacion-ec';
import { validarClaveSegura } from '../common/validar-clave';
import * as bcrypt from 'bcrypt';
import {
  Cliente,
  ClienteDocument,
  TipoIdentificacion,
} from './schema/cliente.schema';
import { Ciudad, CiudadDocument } from 'src/ciudad/schema/ciudad.schema';
import {
  Provincia,
  ProvinciaDocument,
} from 'src/provincia/schema/provincia.schema';
import { Cupon, CuponDocument } from 'src/cupon/schemas/cupon.schema';
import {
  HistoricoCupon,
  HistoricoCuponDocument,
} from 'src/historico-cupon/schemas/historico-cupon.schema';
import {
  VersionCuponera,
  VersionCuponeraDocument,
} from 'src/version-cuponera/schemas/version-cuponera.schema';
import {
  Favorite,
  FavoriteDocument,
} from 'src/favorite/schema/favorite.schema';
import { AmazonS3Service } from 'src/amazon-s3/amazon-s3.service';
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';

@Injectable()
export class ClientesService implements OnModuleInit {
  constructor(
    @InjectModel(Cliente.name)
    private readonly clienteModel: Model<ClienteDocument>,
    @InjectModel(Cupon.name) private readonly cuponModel: Model<CuponDocument>,
    @InjectModel(VersionCuponera.name)
    private readonly versionModel: Model<VersionCuponeraDocument>,
    @InjectModel(Ciudad.name)
    private readonly ciudadModel: Model<CiudadDocument>,
    @InjectModel(Provincia.name)
    private readonly provinciaModel: Model<ProvinciaDocument>,
    @InjectModel(HistoricoCupon.name)
    private readonly historicoModel: Model<HistoricoCuponDocument>,
    // opcional si existe
    @InjectModel(Favorite.name)
    private readonly favoritoModel: Model<FavoriteDocument>,
    private readonly amazonS3Service: AmazonS3Service,
    private readonly notificacionesService: NotificacionesService,
  ) {}
  private readonly logger = new Logger(ClientesService.name);

  /**
   * Backfill al boot: asigna Tungurahua/Ambato a los clientes sin ubicación.
   * Idempotente: si todos ya tienen provincia/ciudad, no hace nada.
   */
  async onModuleInit() {
    try {
      const sinProvincia = await this.clienteModel.countDocuments({
        $or: [
          { provincia: null },
          { provincia: { $exists: false } },
          { ciudad: null },
          { ciudad: { $exists: false } },
        ],
      });
      if (sinProvincia === 0) return;

      const tungurahua = await this.provinciaModel
        .findOne({ slug: 'tungurahua' })
        .lean();
      if (!tungurahua) {
        // Slugs aún no generados (otro módulo correrá su init). Saltamos.
        this.logger.warn(
          `Backfill ubicación cliente: provincia Tungurahua no encontrada (slug). Reintento al próximo boot.`,
        );
        return;
      }

      const ambato = await this.ciudadModel
        .findOne({
          nombre: { $regex: /^ambato$/i },
          provincia: tungurahua._id,
        })
        .lean();
      if (!ambato) {
        this.logger.warn(
          `Backfill ubicación cliente: ciudad Ambato no encontrada en Tungurahua.`,
        );
        return;
      }

      const res = await this.clienteModel.updateMany(
        {
          $or: [
            { provincia: null },
            { provincia: { $exists: false } },
            { ciudad: null },
            { ciudad: { $exists: false } },
          ],
        },
        { $set: { provincia: tungurahua._id, ciudad: ambato._id } },
      );
      this.logger.log(
        `Backfill ubicación cliente: ${res.modifiedCount} cliente(s) asignados a Tungurahua/Ambato ✔`,
      );
    } catch (e: any) {
      this.logger.error(`onModuleInit backfill: ${e?.message}`);
    }
  }

  async actualizarFcmToken(clienteId: string, fcmToken: string): Promise<void> {
    if (!fcmToken || !fcmToken.trim()) return;
    // Mantener fcmToken (legacy) con el último y poblar fcmTokens (array)
    // sin duplicados — permite push a todos los devices del cliente.
    await this.clienteModel.findByIdAndUpdate(clienteId, {
      $set: { fcmToken },
      $addToSet: { fcmTokens: fcmToken },
    });
  }

  async obtenerFcmToken(clienteId: string): Promise<string | null> {
    const cliente = await this.clienteModel.findById(clienteId).select('fcmToken').lean();
    return (cliente as any)?.fcmToken ?? null;
  }

  /** Obtiene todos los tokens FCM del cliente (sin duplicados, no vacíos). */
  async obtenerFcmTokens(clienteId: string): Promise<string[]> {
    const cliente: any = await this.clienteModel
      .findById(clienteId)
      .select('fcmToken fcmTokens')
      .lean();
    if (!cliente) return [];
    const set = new Set<string>();
    if (Array.isArray(cliente.fcmTokens)) {
      for (const t of cliente.fcmTokens) {
        if (t && typeof t === 'string') set.add(t);
      }
    }
    if (cliente.fcmToken && typeof cliente.fcmToken === 'string') {
      set.add(cliente.fcmToken);
    }
    return Array.from(set);
  }

  /**
   * Envía un push a TODOS los devices del cliente. Si algún token es
   * inválido (FCM responde UNREGISTERED), lo limpiamos de la BD para no
   * volver a intentarlo. Best-effort: errores se loguean, nunca rompen
   * el flujo del que llama (login, switch).
   */
  async notificarTodosDispositivos(
    clienteId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    try {
      const tokens = await this.obtenerFcmTokens(clienteId);
      if (tokens.length === 0) return;
      const muertos: string[] = [];
      await Promise.all(
        tokens.map(async (token) => {
          try {
            await this.notificacionesService.enviarAToken(token, title, body, data);
          } catch (err: any) {
            const msg = (err?.message || '').toString();
            if (/UNREGISTERED|INVALID_ARGUMENT|NotRegistered/i.test(msg)) {
              muertos.push(token);
            } else {
              this.logger.warn(
                `notif push falló a token=${token.slice(0, 12)}…: ${msg}`,
              );
            }
          }
        }),
      );
      if (muertos.length > 0) {
        await this.clienteModel.findByIdAndUpdate(clienteId, {
          $pull: { fcmTokens: { $in: muertos } },
        });
        this.logger.log(
          `Limpiados ${muertos.length} token(s) muerto(s) del cliente ${clienteId}`,
        );
      }
    } catch (e: any) {
      this.logger.error(`notificarTodosDispositivos: ${e?.message}`);
    }
  }

  async create(dto: any) {
    const existsEmail = await this.clienteModel.exists({
      email: dto.email.toLowerCase(),
    });
    if (existsEmail) throw new BadRequestException('Email ya registrado');

   /*  const existsId = await this.clienteModel.exists({
      identificacion: dto.identificacion,
    });
    if (existsId) throw new BadRequestException('Identificación ya registrada'); */

    const doc = new this.clienteModel({
      ...dto,
      email: dto.email.toLowerCase(),
      password: dto.password, // se hashea en pre-save si existe
    });
    await doc.save();
    const obj = doc.toObject();
    delete (obj as any).password;
    return obj;
  }
  async findById(id: string) {
    const c: any = await this.clienteModel
      .findById(id)
      .populate('provincia', 'nombre slug')
      .populate('ciudad', 'nombre')
      .lean()
      .exec();
    if (!c) throw new NotFoundException('Cliente no encontrado');
    delete c.password;
    // Aplanar provinciaSlug + nombre para que la app lo lea sin acceder al populate.
    if (c.provincia && typeof c.provincia === 'object') {
      c.provinciaSlug = c.provincia.slug || null;
      c.provinciaNombre = c.provincia.nombre || null;
      c.provincia = c.provincia._id;
    }
    if (c.ciudad && typeof c.ciudad === 'object') {
      c.ciudadNombre = c.ciudad.nombre || null;
      c.ciudad = c.ciudad._id;
    }
    return c;
  }
  async findAdmin(filters: {
    q?: string;
    estado?: string;
    page: number;
    limit: number;
  }) {

    const { q, estado, page, limit } = filters;

    const query: any = {};

    // 🔎 Filtro estado
    if (estado !== undefined && estado !== '') {
      query.estado = estado === 'true';
    }

    // 🔎 Búsqueda global
    if (q && q.trim() !== '') {
      const regex = new RegExp(q.trim(), 'i');

      query.$or = [
        { nombres: regex },
        { apellidos: regex },
        { email: regex },
        { identificacion: regex },
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.clienteModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      this.clienteModel.countDocuments(query),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }
  findAll(q?: string, estado?: string) {
    const filter: any = {};
    if (q) {
      filter.$or = [
        { nombres: new RegExp(q, 'i') },
        { apellidos: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { identificacion: new RegExp(q, 'i') },
      ];
    }
    if (estado !== undefined) filter.estado = estado === 'true';
    return this.clienteModel.find(filter).limit(100).lean();
  }

  /**
   * Buscar un destinatario para un regalo por email o identificación exactos.
   * Devuelve datos mínimos para que el comprador confirme a quién le regala.
   */
  async buscarDestinatario(q: string) {
    const term = (q ?? '').trim();
    if (term.length < 3) {
      return { exists: false };
    }
    const cliente = await this.clienteModel
      .findOne({
        $or: [
          { email: new RegExp(`^${escapeRegExp(term)}$`, 'i') },
          { identificacion: term },
        ],
      })
      .select('nombres apellidos email identificacion')
      .lean();

    if (!cliente) return { exists: false };

    const nombre = [
      (cliente as any).nombres,
      (cliente as any).apellidos,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      exists: true,
      id: String((cliente as any)._id),
      nombre: nombre || (cliente as any).email,
      email: (cliente as any).email,
    };
  }

  async findByEmail(email: string, withPassword = false) {
    const q = this.clienteModel.findOne({ email: email.toLowerCase() });
    if (withPassword) q.select('+password');
    return q.lean().exec();
  }

  async validatePassword(plain: string, hashed?: string) {
    return hashed ? bcrypt.compare(plain, hashed) : false;
  }
  async updateMe(userId: string, dto: any) {
    if (!userId) throw new NotFoundException('Usuario no identificado');

    // Evitar duplicados de correo
    if (dto.correo) {
      const yaExiste = await this.clienteModel.exists({
        correo: dto.correo,
        _id: { $ne: userId },
      });
      if (yaExiste) {
        throw new ConflictException('El correo ya está en uso');
      }
    }

    // Construye el $set solo con los campos enviados (evita pisar con undefined).
    const set: Record<string, any> = {};
    if (dto.nombres !== undefined) set.nombres = dto.nombres;
    if (dto.apellidos !== undefined) set.apellidos = dto.apellidos;
    if (dto.correo !== undefined) set.correo = dto.correo;
    if (dto.telefono !== undefined) set.telefono = dto.telefono;

    // Foto de perfil: si llega un data URL (base64), súbela a S3 y guarda la URL.
    if (dto.fotoBase64) {
      const { url } = await this.amazonS3Service.uploadBase64({
        image: dto.fotoBase64,
        route: 'enjoy/clientes',
      });
      set.fotoUrl = url;
    }

    const updated = await this.clienteModel
      .findByIdAndUpdate(userId, { $set: set }, { new: true })
      .select('-clave -password -__v'); // oculta sensibles si existen

    if (!updated) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return updated;
  }

  async getPerfil(clienteId: string) {
    const t0 = Date.now();
    this.logger.log(
      `🧾 Iniciando consulta de perfil para clienteId="${clienteId}"`,
    );

    if (!Types.ObjectId.isValid(clienteId)) {
      this.logger.warn(`⚠️ clienteId inválido: "${clienteId}"`);
      throw new BadRequestException('El identificador de cliente no es válido');
    }

    const _id = new Types.ObjectId(clienteId);

    try {
      // 1) Cliente
      this.logger.debug('🔎 Buscando documento de Cliente…');
      const cliente = await this.clienteModel.findById(_id).lean();
      if (!cliente) {
        this.logger.warn(
          `🙅 Cliente no encontrado para _id=${_id.toHexString()}`,
        );
        throw new NotFoundException('Cliente no encontrado');
      }
      const name = `${cliente.nombres ?? ''} ${cliente.apellidos ?? ''}`.trim();
      this.logger.log(
        `👤 Cliente: "${name || '(sin nombre)'}" <${cliente.email ?? 's/correo'}>`,
      );

      // 2) Cupones del cliente + ciudades (populate directo a version.ciudadesDisponibles.nombre)
      this.logger.debug('🎫 Buscando cupones del cliente (con ciudades)…');
      const cupones: any = await this.cuponModel
        .find({ cliente: _id })
        .select({ _id: 1, version: 1 })
        .populate({
          path: 'version',
          select: 'ciudadesDisponibles',
          populate: { path: 'ciudadesDisponibles', select: 'nombre' },
        })
        .lean();

      const cuponerasCount = cupones.length; // ✅ cantidad de cupones del cliente
      this.logger.log(`🎫 Cupones encontrados: ${cuponerasCount}`);

      const cuponIds: Types.ObjectId[] = cupones.map(
        (c) => c._id as Types.ObjectId,
      );

      // 3) Paralelo: favoritos, escaneos

      const cuponIdStrs = cuponIds.map((id) =>
        id instanceof Types.ObjectId ? id.toHexString() : String(id),
      );
      this.logger.debug(
        '⚙️ Consultando favoritos, escaneos e info… ids=${JSON.stringify(cuponIdStrs)}',
      );
      this.logger.debug('⚙️ Contando favoritos y escaneos…');
      const [favoritosCount, escaneosCount] = await Promise.all([
        this.countFavoritosSafe(_id),
        cuponIds.length
          ? this.historicoModel.countDocuments({ cupon: { $in: cuponIdStrs } })
          : Promise.resolve(0),
      ]);
      this.logger.log(
        `⭐ Favoritos: ${favoritosCount} | 🧾 Escaneos: ${escaneosCount}`,
      );

      // 4) Ciudades únicas (por nombre) a partir de las versiones de esos cupones
      const ciudadSet = new Set<string>();
      for (const c of cupones) {
        const ciudades = c?.version?.ciudadesDisponibles ?? [];
        for (const ciu of ciudades as any[]) {
          const nombre = ciu?.nombre ? String(ciu.nombre).trim() : '';
          if (nombre) ciudadSet.add(nombre);
        }
      }
      const ciudades = Array.from(ciudadSet);
      this.logger.log(`🏙️ Ciudades: ${ciudades.join(', ') || '(ninguna)'}`);

      // 5) Categorías favoritas (nombres) vía histórico → usuario.categorias (populate anidado)
      this.logger.debug('🏷️ Calculando Top categorías favoritas…');
      const historicos: any[] = cuponIds.length
        ? await this.historicoModel
            .find({ cupon: { $in: cuponIdStrs } })
            .populate([
              {
                path: 'usuario',
                select: 'categorias',
                // si usuario.categorias es ref a Categoria[]
                populate: { path: 'categorias', select: 'nombre' },
              },
            ])
            .select({ usuario: 1 })
            .lean()
        : [];

      const cap = (s: string) =>
        s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

      const freqCat = new Map<string, number>();
      for (const h of historicos) {
        const cats = (h.usuario?.categorias ?? []) as any[];
        for (const raw of cats) {
          const nombre =
            raw && typeof raw === 'object' && 'nombre' in raw
              ? String(raw.nombre)
              : String(raw);
          const key = nombre.trim().toLowerCase();
          if (!key) continue;
          freqCat.set(key, (freqCat.get(key) ?? 0) + 1);
        }
      }
      const categoriasFav = [...freqCat.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([k]) => cap(k));

      this.logger.debug(`📊 Top categorías: ${JSON.stringify(categoriasFav)}`);

      // 6) Respuesta
      const payload = {
        _id: cliente._id.toString(),
        name,
        email: cliente.email ?? '',
        avatarUrl: (cliente as any).fotoUrl ?? null, // foto de perfil (S3)
        favoritos: favoritosCount,
        cuponeras: cuponerasCount, // ✅ ahora sí: cantidad de cupones
        escaneos: escaneosCount,
        ciudades, // únicas por nombre
        categoriasFav, // top por histórico (nombres)
      };

      const t1 = Date.now();
      this.logger.log(`✅ Perfil construido en ${t1 - t0} ms`);
      this.logger.debug(`📦 Respuesta perfil: ${JSON.stringify(payload)}`);

      return payload;
    } catch (err) {
      this.logger.error(
        `❌ Error al construir perfil del clienteId="${clienteId}": ${err?.message || err}`,
      );
      throw err;
    }
  }

  private async countFavoritosSafe(clienteId: Types.ObjectId): Promise<number> {
    try {
      if (!this.favoritoModel) return 0;
      return this.favoritoModel.countDocuments({ cliente: clienteId });
    } catch {
      return 0;
    }
  }

  async softDeleteCliente(clienteId: string) {
    const cliente = await this.clienteModel.findById(clienteId);
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    if (cliente.deleted) throw new BadRequestException('La cuenta ya fue eliminada');

    const timestamp = Date.now();
    const emailOriginal = cliente.email;
    const emailAnonymized = `deleted_${timestamp}_${emailOriginal}`;

    await this.clienteModel.findByIdAndUpdate(clienteId, {
      deleted: true,
      deletedAt: new Date(),
      emailOriginal,
      email: emailAnonymized,
      estado: false,
    });

    return { ok: true };
  }

  async resetPassword(email: string, password: string) {
    validarClaveSegura(password);

    const u = await this.clienteModel.findOne({ email: email.toLowerCase() });
    if (!u) throw new NotFoundException('Cuenta no encontrada');

    u.password = password; // se hashea en el pre-save del schema de Cliente
    await u.save();
    return { ok: true };
  }

   async emailExists(email: string): Promise<boolean> {
    // si tu esquema no está con lowercase, hacemos búsqueda case-insensitive
    const count = await this.clienteModel
      .countDocuments({ email: new RegExp(`^${escapeRegExp(email)}$`, 'i') })
      .exec();
    return count > 0;
  }
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}