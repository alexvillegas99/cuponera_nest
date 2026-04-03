import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Usuario, UsuarioDocument } from './schema/usuario.schema';
import { RolUsuario } from './enums/roles.enum';
import {
  Comentario,
  ComentarioDocument,
} from 'src/comentario/schema/comentario.schema';
import {
  ComercioMiniResponse,
  PromoPrincipalDto,
  ComentarioDto,
} from './dto/comercio-detalle.dto';
import { AmazonS3Service } from 'src/amazon-s3/amazon-s3.service';
import { MailService } from 'src/mail/mail.service';
import { DateTimeService } from 'src/common/services/dateTimeService';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectModel(Usuario.name) private usuarioModel: Model<UsuarioDocument>,
    @InjectModel(Comentario.name)
    private readonly comentarioModel: Model<ComentarioDocument>,
    private readonly amazonS3Service: AmazonS3Service,
    private readonly mailService: MailService,
    private readonly dateService: DateTimeService,
  ) {}
  private readonly logger = new Logger(UsuariosService.name);

  // ===== Helpers internos =====
  private async procesarImagen(
    base64?: string,
    route?: string,
  ): Promise<string | undefined> {
    if (!base64) return undefined;
    if (base64.startsWith('http')) return base64; // 👈 ya es URL
    const uploaded = await this.amazonS3Service.uploadBase64({
      image: base64,
      route: route || 'enjoy/usuarios',
    });
    return uploaded?.url;
  }

  private async procesarPromocion(
    promo: any,
    nombreLocal: string,
  ): Promise<any> {
    if (!promo) return promo;
    const safeName = nombreLocal?.replace(/\s+/g, '-').toLowerCase() || 'promo';
    const route = `enjoy/promos/${safeName}`;

    return {
      ...promo,
      logoUrl: await this.procesarImagen(
        promo.logoBase64 || promo.logoUrl,
        `${route}/logos`,
      ),
      imageUrl: await this.procesarImagen(
        promo.imageBase64 || promo.imageUrl,
        `${route}/imagenes`,
      ),
    };
  }

  // ===== Helpers base existentes =====
  findByEmail(email: string) {
    return this.usuarioModel.findOne({ email }).exec();
  }

  private mapNombres(user: any) {
    if (!user) return user;
    const u = { ...user };
    if (Array.isArray(u.ciudades)) {
      u.ciudades = u.ciudades
        .map((c: any) => (typeof c === 'string' ? c : c?.nombre))
        .filter(Boolean);
    }
    if (Array.isArray(u.categorias)) {
      u.categorias = u.categorias
        .map((c: any) => (typeof c === 'string' ? c : c?.nombre))
        .filter(Boolean);
    }
    return u;
  }

  // ===== NUEVO: helpers RAW para validaciones =====

  /** Devuelve el documento RAW (sin mapear nombres), útil para validaciones */
  async findByIdRaw(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('ID inválido');
    const doc = await this.usuarioModel.findById(id).lean();
    return doc; // ciudades / categorias como ObjectId[]
  }

  /**
   * Resuelve el "admin-local" base de un usuario:
   * - Si el usuario es STAFF => su usuarioCreacion
   * - Si es ADMIN_LOCAL u otro => él mismo
   */
  async getAdminLocalRaw(usuarioId: string) {
    const user = await this.findByIdRaw(usuarioId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const rol = String(user.rol || '').toLowerCase();

    if (rol === 'staff') {
      if (!user.usuarioCreacion) {
        throw new BadRequestException('Usuario STAFF sin usuarioCreacion');
      }
      const admin = await this.findByIdRaw(String(user.usuarioCreacion));
      if (!admin) throw new NotFoundException('Admin local no encontrado');
      return admin;
    }

    // admin-local u otro rol con ciudades propias
    return user;
  }

  strongPassword(len = 12) {
    const U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const L = 'abcdefghijklmnopqrstuvwxyz';
    const D = '0123456789';
    const S = '!@#$%^&*()-_=+[]{};:,.?/';

    const all = U + L + D + S;

    // asegurar al menos uno de cada
    const req = [
      U[Math.floor(Math.random() * U.length)],
      L[Math.floor(Math.random() * L.length)],
      D[Math.floor(Math.random() * D.length)],
      S[Math.floor(Math.random() * S.length)],
    ];

    // completar hasta len
    for (let i = req.length; i < len; i++) {
      req.push(all[Math.floor(Math.random() * all.length)]);
    }

    // mezclar (Fisher–Yates)
    for (let i = req.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [req[i], req[j]] = [req[j], req[i]];
    }

    return req.join('');
  }
  // ===== CRUD usado por tu controlador =====

  async create(dto: any): Promise<any> {
    const existeEmail = await this.findByEmail(dto.email);
    if (existeEmail) throw new BadRequestException('El email ya está en uso');
    let claveSinEncriptar;
    //crearClaveAleatoria
    if (!dto.clave) {
      dto.clave = this.strongPassword(12); // generar clave aleatoria de 12 caracteres
      claveSinEncriptar = dto.clave;
    }

    dto.clave = bcrypt.hashSync(dto.clave, 10);

    // 👇 Procesa imágenes del detalle principal
    if (dto.detallePromocion) {
      dto.detallePromocion = await this.procesarPromocion(
        dto.detallePromocion,
        dto.nombre,
      );
    }
    // 👇 Procesa imágenes de extras
    if (Array.isArray(dto.detallePromocionesExtra)) {
      dto.detallePromocionesExtra = await Promise.all(
        dto.detallePromocionesExtra.map((p: any) =>
          this.procesarPromocion(p, dto.nombre),
        ),
      );
    }
    const fecha = this.dateService.formatEC();
    // Año actual (4 dígitos)
    const anio = this.dateService.getYear();

    const created = await this.usuarioModel.create(dto);
    const html = this.mailService.getTemplate('bienvenida.html', {
      nombre: dto.nombre,
      email: dto.email,
      fecha,
      anio,
      enlace_portal: 'https://portal.ecuenjoy.com/',
      enlace_soporte:  'https://portal.ecuenjoy.com/soporte',
    });

    await this.mailService.enviar(dto.email, 'Bienvenido/a a Enjoy', html);
    const populated = await this.usuarioModel
      .findById(created._id)
      .populate('ciudades', 'nombre')
      .populate('categorias', 'nombre')
      .lean();

    return this.mapNombres(populated);
  }

  async findAll(): Promise<any[]> {
    const docs = await this.usuarioModel
      .find()
      .populate('usuarioCreacion', 'nombre email')
      .populate('ciudades', 'nombre')
      .populate('categorias', 'nombre')
      .lean();
    return docs.map((d) => this.mapNombres(d));
  }

  async findById(id: string): Promise<any> {
    const usuario = await this.usuarioModel
      .findById(id)
      .populate('ciudades', 'nombre')
      .populate('categorias', 'nombre')
      .lean();
    if (!usuario)
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    return this.mapNombres(usuario);
  }

  async delete(id: string): Promise<{ ok: true }> {
    await this.usuarioModel.findByIdAndDelete(id).exec();
    return { ok: true };
  }

  buscarTodosLosUsuariosPorResponsable(_id: string) {
    if (!isValidObjectId(_id)) throw new BadRequestException('ID inválido');
    return this.usuarioModel
      .find({ usuarioCreacion: _id })
      .populate('ciudades', 'nombre')
      .populate('categorias', 'nombre')
      .lean()
      .then((arr) => arr.map((d) => this.mapNombres(d)));
  }

  async update(id: string, dto: any) {
    if (dto.email) {
      const existente = await this.findByEmail(dto.email);
      if (existente && String(existente._id) !== String(id)) {
        throw new BadRequestException('El email ya está en uso');
      }
    }

    if (dto.clave) {
      dto.clave = bcrypt.hashSync(dto.clave, 10);
    }

    if (dto.detallePromocion) {
      dto.detallePromocion = await this.procesarPromocion(
        dto.detallePromocion,
        dto.nombre,
      );
    }
    if (Array.isArray(dto.detallePromocionesExtra)) {
      dto.detallePromocionesExtra = await Promise.all(
        dto.detallePromocionesExtra.map((p: any) =>
          this.procesarPromocion(p, dto.nombre),
        ),
      );
    }

    const updated = await this.usuarioModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate('ciudades', 'nombre')
      .populate('categorias', 'nombre')
      .lean();

    if (!updated)
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    return this.mapNombres(updated);
  }

  async findAllAdmin(params: any) {
    const { q, rol, estado, page, limit } = params;

    const filter: any = {};

    if (q) {
      filter.$or = [
        { nombre: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { identificacion: { $regex: q, $options: 'i' } },
      ];
    }

    if (rol) filter.rol = rol;
    if (estado !== undefined) filter.estado = estado === 'true';

    const data = await this.usuarioModel
      .find(filter)
      .select('-clave')
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await this.usuarioModel.countDocuments(filter);

    return { data, total, page, limit };
  }

  async createUserWithLocal(id: string, dto: any) {
    if (!isValidObjectId(id))
      throw new BadRequestException('ID de responsable inválido');

    const existeEmail = await this.findByEmail(dto.email);
    if (existeEmail) throw new BadRequestException('El email ya está en uso');

    dto.usuarioCreacion = id as any;
    dto.rol = RolUsuario.STAFF;
    dto.clave = bcrypt.hashSync(dto.clave, 10);

    const created = await this.usuarioModel.create(dto);

    const populated = await this.usuarioModel
      .findById(created._id)
      .populate('ciudades', 'nombre')
      .populate('categorias', 'nombre')
      .lean();

    return this.mapNombres(populated);
  }

  async findByCiudadesConPromo(ciudadIds: string[]): Promise<
    Array<{
      _id: string;
      detallePromocion: any;
      ciudades: string[];
      categorias: string[];
    }>
  > {
    if (!Array.isArray(ciudadIds) || ciudadIds.length === 0) {
      throw new BadRequestException('Debes enviar al menos un id de ciudad');
    }

    const docs = await this.usuarioModel
      .find(
        {
          ciudades: { $in: ciudadIds },
          detallePromocion: { $exists: true, $ne: null },
        },
        {
          detallePromocion: 1,
          ciudades: 1,
          categorias: 1,
          promedioCalificacion: 1,
        },
      )
      .populate('ciudades', 'nombre')
      .populate('categorias', 'nombre')
      .lean();

    return docs.map((d: any) => {
      const ratingFromRoot =
        typeof d?.promedioCalificacion === 'number'
          ? d.promedioCalificacion
          : null;

      const negocioIdStr = String(d._id);

      // 👇 tomamos el detalle y FORZAMOS su "id" = _id raíz
      const detalleOriginal = d?.detallePromocion ?? {};
      const detalle = {
        ...detalleOriginal,
        id: negocioIdStr, // ✅ ahora detallePromocion.id = _id
        rating: ratingFromRoot,
      };

      return {
        _id: negocioIdStr,
        detallePromocion: detalle,
        ciudades: Array.isArray(d.ciudades)
          ? d.ciudades
              .map((c: any) => (typeof c === 'string' ? c : c?.nombre))
              .filter(Boolean)
          : [],
        categorias: Array.isArray(d.categorias)
          ? d.categorias
              .map((c: any) => (typeof c === 'string' ? c : c?.nombre))
              .filter(Boolean)
          : [],
      };
    });
  }

  async obtenerInformacionComercioMini(
    usuarioId: string,
  ): Promise<ComercioMiniResponse> {
    const C = 'obtenerInformacionComercioMini';
    if (!Types.ObjectId.isValid(usuarioId)) {
      this.logger.warn(`[${C}] usuarioId inválido: ${usuarioId}`);
      throw new BadRequestException('usuarioId inválido');
    }

    const u: any = await this.usuarioModel
      .findById(usuarioId, {
        ciudades: 1,
        categorias: 1,
        detallePromocion: 1,
        promedioCalificacion: 1,
        totalComentarios: 1,
        telefono: 1,
      })
      .populate({ path: 'ciudades', select: 'nombre', options: { lean: true } })
      .populate({
        path: 'categorias',
        select: 'nombre',
        options: { lean: true },
      })
      .lean();

    if (!u) throw new NotFoundException('Comercio no encontrado');

    const promo: PromoPrincipalDto | undefined = u.detallePromocion
      ? {
          id: u.detallePromocion.id,
          title: u.detallePromocion.title,
          placeName: u.detallePromocion.placeName,
          description: u.detallePromocion.description,
          imageUrl: u.detallePromocion.imageUrl,
          logoUrl: u.detallePromocion.logoUrl,
          isTwoForOne: u.detallePromocion.isTwoForOne,
          tags: u.detallePromocion.tags ?? [],
          rating: u.detallePromocion.rating,
          scheduleLabel: u.detallePromocion.scheduleLabel,
          distanceLabel: u.detallePromocion.distanceLabel,
          startDate: u.detallePromocion.startDate
            ? new Date(u.detallePromocion.startDate).toISOString()
            : null,
          endDate: u.detallePromocion.endDate
            ? new Date(u.detallePromocion.endDate).toISOString()
            : null,
          isFlash: u.detallePromocion.isFlash,
          address: u.detallePromocion.address,
          aplicaTodosLosDias: u.detallePromocion.aplicaTodosLosDias,
          fechasExcluidas: Array.isArray(u.detallePromocion.fechasExcluidas)
            ? u.detallePromocion.fechasExcluidas.map((d: any) =>
                new Date(d).toISOString(),
              )
            : [],
        }
      : undefined;

    // Comentarios (opcional): trae los últimos N
    let comentarios: ComentarioDto[] = [];

    if (this.comentarioModel) {
      const rows = await this.comentarioModel
        .find(
          { usuario: new Types.ObjectId(usuarioId) },
          {
            texto: 1,
            calificacion: 1,
            createdAt: 1,
            autor: 1,
          },
        )
        .populate({
          path: 'autor', // ref: 'Cliente'
          select: 'nombres apellidos email',
          options: { lean: true },
        })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean();

      // 👇 OJO: aquí ASIGNAMOS a la variable externa
      console.log(rows);
      comentarios = rows.map((r: any) => ({
        autorNombre:
          `${r?.autor?.nombres ?? ''} ${r?.autor?.apellidos ?? ''}`.trim() ||
          'Anónimo',
        texto: r?.texto ?? '',
        rating:
          typeof r?.calificacion === 'number' ? r.calificacion : undefined,
        fecha: r?.createdAt ? new Date(r.createdAt).toISOString() : undefined,
      }));
    }

    return {
      promoPrincipal: promo,
      ciudades: Array.isArray(u.ciudades)
        ? u.ciudades.map((c: any) => c?.nombre).filter(Boolean)
        : [],
      categorias: Array.isArray(u.categorias)
        ? u.categorias.map((c: any) => c?.nombre).filter(Boolean)
        : [],
      promedioCalificacion: Number(u.promedioCalificacion ?? 0),
      totalComentarios: Number(u.totalComentarios ?? 0),
      telefono: u.telefono ?? undefined,
      comentarios,
    };
  }

  async resetPassword(email: string, password: string) {
    const u = await this.usuarioModel.findOne({ email: email.toLowerCase() });
    if (!u) throw new NotFoundException('Cuenta no encontrada');

    const hash = await bcrypt.hash(password, 10);
    u.clave = hash;
    await u.save();
    return { ok: true };
  }

  async findEstablecimientos({
    page = 1,
    limit = 12,
    q = '',
  }: {
    page: number;
    limit: number;
    q?: string;
  }) {
    const ctx = 'findEstablecimientos';
    this.logger.log(`[${ctx}] INIT → page=${page}, limit=${limit}, q=${q}`);

    const safePage = Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number(limit) > 0 ? Number(limit) : 12;
    const skip = (safePage - 1) * safeLimit;

    const searchText =
      typeof q === 'string' && q !== 'undefined' ? q.trim() : '';

    this.logger.log(`[${ctx}] searchText="${searchText}", skip=${skip}`);

    const search = searchText
      ? {
          $or: [
            { nombre: { $regex: searchText, $options: 'i' } },
            { email: { $regex: searchText, $options: 'i' } },
            { identificacion: { $regex: searchText, $options: 'i' } },
            { promocion: { $regex: searchText, $options: 'i' } },
            { 'detallePromocion.title': { $regex: searchText, $options: 'i' } },
            { 'detallePromocion.tags': { $in: [new RegExp(searchText, 'i')] } },
          ],
        }
      : {};

    const baseQuery = {
      rol: { $in: [RolUsuario.LOCAL] },
      ...search,
    };

    this.logger.log(`[${ctx}] baseQuery=${JSON.stringify(baseQuery)}`);

    try {
      this.logger.log(`[${ctx}] Ejecutando queries…`);

      const [items, total] = await Promise.all([
        this.usuarioModel
          .find(baseQuery, {
            nombre: 1,
            email: 1,
            estado: 1,
            ciudades: 1,
            categorias: 1,
            detallePromocion: 1,
            promedioCalificacion: 1,
            telefono: 1,
          })
          .populate('ciudades', 'nombre')
          .populate('categorias', 'nombre')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(safeLimit)
          .lean(),

        this.usuarioModel.countDocuments(baseQuery),
      ]);

      this.logger.log(
        `[${ctx}] Query OK → items=${items.length}, total=${total}`,
      );

      return {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit),
        items: items.map((i) => this.mapNombres(i)),
      };
    } catch (error) {
      this.logger.error(
        `[${ctx}] ERROR ejecutando query`,
        error?.stack || error,
      );
      throw error;
    }
  }
  async buscarPorEmail(email: string) {
    const data = await this.usuarioModel
      .findOne({ email: email.toLowerCase() })
      .lean()
      .then((d) => this.mapNombres(d));
    //si existe retirbna true sino false
    return !!data;
  }
  async actualizarContraseniaRecuperacion(email: string, nuevaClave: string) {
    const data = await this.usuarioModel.findOneAndUpdate(
      { email: email.toLowerCase() },
      { clave: bcrypt.hashSync(nuevaClave, 10) },
      { new: true },
    );
    const template = this.mailService.getTemplate('credenciales.html', {
      nombre: data?.nombre || 'Usuario',
      fecha: this.dateService.formatEC(),
         enlace_soporte:  'https://portal.ecuenjoy.com/soporte',
    });
    this.mailService.enviar(email, 'Recuperación de contraseña', template);
    return !!data;
  }

  async actualizarUltimaConeccion(_id: string) {
    return this.usuarioModel.findByIdAndUpdate(
      _id,
      { ultimaConexion: new Date() },
      { new: true },
    );
  }
}
