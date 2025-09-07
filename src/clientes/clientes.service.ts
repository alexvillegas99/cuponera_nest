// src/clientes/clientes.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { validarCedulaEc, validarRucEc } from './utils/identificacion-ec';
import * as bcrypt from 'bcrypt';
import {
  Cliente,
  ClienteDocument,
  TipoIdentificacion,
} from './schema/cliente.schema';
import { Ciudad, CiudadDocument } from 'src/ciudad/schema/ciudad.schema';
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

@Injectable()
export class ClientesService {
  constructor(
    @InjectModel(Cliente.name)
    private readonly clienteModel: Model<ClienteDocument>,
    @InjectModel(Cupon.name) private readonly cuponModel: Model<CuponDocument>,
    @InjectModel(VersionCuponera.name)
    private readonly versionModel: Model<VersionCuponeraDocument>,
    @InjectModel(Ciudad.name)
    private readonly ciudadModel: Model<CiudadDocument>,
    @InjectModel(HistoricoCupon.name)
    private readonly historicoModel: Model<HistoricoCuponDocument>,
    // opcional si existe
    @InjectModel(Favorite.name)
    private readonly favoritoModel: Model<FavoriteDocument>,
  ) {}
  private readonly logger = new Logger(ClientesService.name);
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
    const c = await this.clienteModel.findById(id).lean().exec();
    if (!c) throw new NotFoundException('Cliente no encontrado');
    delete (c as any).password;
    return c;
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

    const updated = await this.clienteModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            nombres: dto.nombres,
            apellidos: dto.apellidos,
            correo: dto.correo,
            telefono: dto.telefono,
          },
        },
        { new: true },
      )
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

  async resetPassword(email: string, password: string) {
    const u = await this.clienteModel.findOne({ email: email.toLowerCase() });
    if (!u) throw new NotFoundException('Cuenta no encontrada');

    u.password = password;
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