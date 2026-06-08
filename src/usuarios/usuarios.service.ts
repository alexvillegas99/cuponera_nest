import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { validarClaveSegura } from '../common/validar-clave';
import { Usuario, UsuarioDocument } from './schema/usuario.schema';
import { Ciudad } from '../ciudad/schema/ciudad.schema';
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
    @InjectModel(Ciudad.name)
    private readonly ciudadModel: Model<any>,
    private readonly amazonS3Service: AmazonS3Service,
    private readonly mailService: MailService,
    private readonly dateService: DateTimeService,
  ) {}

  /** Establecimientos con promo de TODA una provincia (expande a sus ciudades). */
  async findByProvinciaConPromo(provinciaId: string) {
    if (!isValidObjectId(provinciaId)) {
      throw new BadRequestException('Provincia inválida');
    }
    const ciudades = await this.ciudadModel
      .find({ provincia: new Types.ObjectId(provinciaId) })
      .select('_id')
      .lean();
    const ids = ciudades.map((c: any) => c._id.toString());
    if (!ids.length) return [];
    return this.findByCiudadesConPromo(ids);
  }
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

  /** Infiere el tipo de medio (image|video) desde el data URL, la URL o el type explícito */
  private inferirTipoMedia(item: any): 'image' | 'video' {
    if (item?.type === 'video' || item?.type === 'image') return item.type;
    const src: string = item?.base64 || item?.url || '';
    if (/^data:video\//i.test(src)) return 'video';
    if (/\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(src)) return 'video';
    return 'image';
  }

  /**
   * Procesa la galería del local (máx 5). Sube los items con base64 a S3 y conserva
   * los que ya traen URL. No toca imageUrl. Devuelve [{ url, type, thumbnailUrl? }].
   */
  private async procesarGaleria(
    galeria: any,
    route: string,
    prevGaleria?: any[],
  ): Promise<any[] | undefined> {
    // Si no viene la clave en el request, conservamos lo existente.
    if (galeria === undefined) return prevGaleria;
    if (!Array.isArray(galeria)) return prevGaleria ?? [];

    const items = galeria.slice(0, 5);
    const procesados = await Promise.all(
      items.map(async (item: any) => {
        const type = this.inferirTipoMedia(item);
        const url = await this.procesarImagen(
          item?.base64 || item?.url,
          `${route}/${type === 'video' ? 'videos' : 'fotos'}`,
        );
        if (!url) return null;
        const out: any = { url, type };
        if (item?.thumbnailUrl) out.thumbnailUrl = item.thumbnailUrl;
        return out;
      }),
    );

    return procesados.filter(Boolean);
  }

  /**
   * Procesa el catálogo del local (productos/servicios), SIN límite de cantidad.
   * Sube los items con base64 a S3 y conserva los que ya traen URL.
   * Devuelve [{ url, nombre?, descripcion? }]. Descarta items sin imagen.
   */
  private async procesarProductos(
    productos: any,
    route: string,
    prevProductos?: any[],
  ): Promise<any[] | undefined> {
    // Si no viene la clave en el request, conservamos lo existente.
    if (productos === undefined) return prevProductos;
    if (!Array.isArray(productos)) return prevProductos ?? [];

    const procesados = await Promise.all(
      productos.map(async (item: any) => {
        const url = await this.procesarImagen(
          item?.base64 || item?.url,
          `${route}/fotos`,
        );
        if (!url) return null;
        const out: any = { url };
        if (item?.nombre) out.nombre = String(item.nombre).trim();
        if (item?.descripcion) out.descripcion = String(item.descripcion).trim();
        return out;
      }),
    );

    return procesados.filter(Boolean);
  }

  private async procesarPromocion(
    promo: any,
    nombreLocal: string,
    existente: any = {},
  ): Promise<any> {
    if (!promo) return promo;
    const prev = existente || {};
    const safeName = nombreLocal?.replace(/\s+/g, '-').toLowerCase() || 'promo';
    const route = `enjoy/promos/${safeName}`;

    // Merge sobre lo existente para no borrar campos que no vienen en el request,
    // y conservar las imágenes previas si no se sube una nueva.
    const galeria = await this.procesarGaleria(
      promo.galeria,
      `${route}/galeria`,
      prev.galeria,
    );

    const productos = await this.procesarProductos(
      promo.productos,
      `${route}/productos`,
      prev.productos,
    );

    // Solo cuenta como "imagen nueva explícita" una subida base64 fresca.
    // (Los fronts reenvían el imageUrl previo; eso NO debe bloquear la portada.)
    const subioImagenNueva = !!promo.imageBase64;
    let imageUrl = await this.procesarImagen(
      promo.imageBase64 || promo.imageUrl || prev.imageUrl,
      `${route}/imagenes`,
    );

    // La galería MANDA sobre la portada: si hay una foto en la galería y no se
    // subió una imagen nueva en esta petición, la portada (imageUrl) es SIEMPRE
    // la primera foto del array de la galería. Así las tarjetas/listados muestran
    // exactamente la primera imagen de la galería.
    if (!subioImagenNueva && Array.isArray(galeria) && galeria.length) {
      const primeraFoto = galeria.find((m: any) => m?.type === 'image' && m?.url);
      if (primeraFoto) imageUrl = primeraFoto.url;
    }

    const resultado = {
      ...prev,
      ...promo,
      logoUrl: await this.procesarImagen(
        promo.logoBase64 || promo.logoUrl || prev.logoUrl,
        `${route}/logos`,
      ),
      imageUrl,
      galeria,
      productos,
    };

    // Limpieza en S3: borra las imágenes que estaban antes y ya no se referencian
    // (quitadas de galería/catálogo, logo o portada reemplazados). Se usa un diff de
    // conjuntos sobre TODAS las urls para no borrar una imagen que sigue en uso
    // (p.ej. imageUrl que coincide con la primera foto de la galería).
    await this.limpiarImagenesHuerfanas(prev, resultado);

    return resultado;
  }

  /** Recolecta todas las urls http de un detallePromocion (logo, portada, galería, catálogo). */
  private _urlsDeDetalle(detalle: any): Set<string> {
    const urls = new Set<string>();
    const add = (u: any) => {
      if (typeof u === 'string' && /^https?:\/\//i.test(u)) urls.add(u);
    };
    if (!detalle) return urls;
    add(detalle.logoUrl);
    add(detalle.imageUrl);
    if (Array.isArray(detalle.galeria)) {
      for (const m of detalle.galeria) {
        add(m?.url);
        add(m?.thumbnailUrl);
      }
    }
    if (Array.isArray(detalle.productos)) {
      for (const p of detalle.productos) add(p?.url);
    }
    return urls;
  }

  /**
   * Borra de S3 las imágenes presentes en `prev` que ya no están en `nuevo`.
   * Nunca lanza: cualquier fallo (S3, datos corruptos) se traga para no bloquear
   * el guardado del establecimiento.
   */
  private async limpiarImagenesHuerfanas(prev: any, nuevo: any): Promise<void> {
    try {
      const antes = this._urlsDeDetalle(prev);
      const ahora = this._urlsDeDetalle(nuevo);
      const aBorrar = [...antes].filter(
        (u) => !ahora.has(u) && /\.amazonaws\.com\//i.test(u),
      );
      if (!aBorrar.length) return;
      await Promise.all(
        aBorrar.map((u) =>
          this.amazonS3Service.deleteImageByUrl(u).catch(() => false),
        ),
      );
    } catch (err: any) {
      // Borrado best-effort: registrar y continuar, jamás romper el guardado.
      this.logger?.warn?.(
        `Limpieza de imágenes huérfanas falló (ignorado): ${err?.message ?? err}`,
      );
    }
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
      .populate({
        path: 'ciudades',
        select: 'nombre provincia',
        populate: { path: 'provincia', select: 'nombre' },
      })
      .populate('categorias', 'nombre')
      .lean();
    if (!usuario)
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);

    // Derivar la provincia desde la 1ª ciudad ANTES de aplanar a nombres,
    // para que los fronts puedan precargar el selector de provincia.
    let provinciaId: string | null = null;
    let provinciaNombre: string | null = null;
    const c0: any = Array.isArray(usuario.ciudades)
      ? usuario.ciudades[0]
      : null;
    if (c0 && c0.provincia) {
      provinciaId = String(c0.provincia._id ?? c0.provincia);
      provinciaNombre = c0.provincia.nombre ?? null;
    }

    return { ...this.mapNombres(usuario), provinciaId, provinciaNombre };
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

    // Documento actual: se usa para hacer merge de detallePromocion y no perder
    // campos/imágenes que no vengan en el request.
    const actual: any =
      dto.detallePromocion || Array.isArray(dto.detallePromocionesExtra)
        ? await this.usuarioModel.findById(id).lean()
        : null;

    if (dto.detallePromocion) {
      dto.detallePromocion = await this.procesarPromocion(
        dto.detallePromocion,
        dto.nombre ?? actual?.nombre,
        actual?.detallePromocion,
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
          estado: true,
        },
        {
          detallePromocion: 1,
          ciudades: 1,
          categorias: 1,
          promedioCalificacion: 1,
          ubicacion: 1,
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

      const detalleOriginal = d?.detallePromocion ?? {};
      const detalle = {
        ...detalleOriginal,
        id: negocioIdStr,
        rating: ratingFromRoot,
      };

      return {
        _id: negocioIdStr,
        detallePromocion: detalle,
        ubicacion: d.ubicacion ?? null,
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

  // ===== Paginación de locales con promo (endpoint nuevo, aditivo) =====

  private _escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** Distancia en metros entre dos coordenadas (haversine). */
  private _haversine(
    lat1: number,
    lng1: number,
    lat2?: number,
    lng2?: number,
  ): number {
    if (lat2 == null || lng2 == null) return Number.POSITIVE_INFINITY;
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /** Mapea un doc de usuario al shape de promo que consume la app. */
  private _mapPromoDoc(d: any) {
    const ratingFromRoot =
      typeof d?.promedioCalificacion === 'number'
        ? d.promedioCalificacion
        : null;
    const negocioIdStr = String(d._id);
    const detalle = {
      ...(d?.detallePromocion ?? {}),
      id: negocioIdStr,
      rating: ratingFromRoot,
    };
    return {
      _id: negocioIdStr,
      detallePromocion: detalle,
      ubicacion: d.ubicacion ?? null,
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
  }

  /**
   * Locales con promo paginados, con filtros opcionales por provincia(s),
   * ciudad(es), nombre (q), Hoy (isToday) y Flash (isFlash).
   * Defaults seguros: page=1, limit=30. Endpoint NUEVO — no afecta a los
   * endpoints existentes que usan las apps ya publicadas.
   */
  async findPromosPaginado(params: {
    provincias?: string;
    ciudades?: string;
    localIds?: string;
    q?: string;
    isToday?: boolean;
    isFlash?: boolean;
    lat?: number;
    lng?: number;
    page?: number;
    limit?: number;
  }): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 30));

    // 1) Resolver ciudades del scope
    let cityIds: string[] = [];
    if (params.ciudades) {
      cityIds = params.ciudades
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (params.provincias) {
      const provIds = params.provincias
        .split(',')
        .map((s) => s.trim())
        .filter((id) => isValidObjectId(id))
        .map((id) => new Types.ObjectId(id));
      if (provIds.length) {
        const ciudades = await this.ciudadModel
          .find({ provincia: { $in: provIds } })
          .select('_id')
          .lean();
        cityIds = ciudades.map((c: any) => String(c._id));
      }
    }

    if (!cityIds.length) {
      return { data: [], total: 0, page, limit, hasMore: false };
    }

    // 2) Filtro base
    const filter: any = {
      ciudades: { $in: cityIds },
      detallePromocion: { $exists: true, $ne: null },
      estado: true,
    };

    // Búsqueda por nombre (dentro del scope)
    if (params.q && params.q.trim()) {
      const rx = new RegExp(this._escapeRegex(params.q.trim()), 'i');
      filter.$or = [
        { nombre: rx },
        { 'detallePromocion.title': rx },
        { 'detallePromocion.placeName': rx },
        { 'detallePromocion.tags': rx },
      ];
    }

    if (params.isFlash) {
      filter['detallePromocion.isFlash'] = true;
    }

    if (params.isToday) {
      const dias = [
        'domingo',
        'lunes',
        'martes',
        'miercoles',
        'jueves',
        'viernes',
        'sabado',
      ];
      const hoy = dias[new Date().getDay()];
      filter.$and = [
        ...(filter.$and ?? []),
        {
          $or: [
            { 'detallePromocion.aplicaTodosLosDias': true },
            { 'detallePromocion.diasAplicables': hoy },
          ],
        },
      ];
    }

    // Filtro por ids de locales (soloConCupon: locales con canje disponible).
    if (params.localIds != null) {
      const lids = params.localIds
        .split(',')
        .map((s) => s.trim())
        .filter((id) => isValidObjectId(id))
        .map((id) => new Types.ObjectId(id));
      if (!lids.length) {
        return { data: [], total: 0, page, limit, hasMore: false };
      }
      filter._id = { $in: lids };
    }

    const projection: any = {
      detallePromocion: 1,
      ciudades: 1,
      categorias: 1,
      promedioCalificacion: 1,
      ubicacion: 1,
    };

    // 3a) Orden por distancia (si hay coordenadas): ordena el match completo
    //     por cercanía y luego pagina.
    if (params.lat != null && params.lng != null) {
      const all = await this.usuarioModel.find(filter, { ubicacion: 1 }).lean();
      const ordenados = all
        .map((d: any) => ({
          id: String(d._id),
          dist: this._haversine(
            params.lat!,
            params.lng!,
            d.ubicacion?.lat,
            d.ubicacion?.lng,
          ),
        }))
        .sort((a, b) => a.dist - b.dist);
      const total = ordenados.length;
      const pageIds = ordenados
        .slice((page - 1) * limit, page * limit)
        .map((x) => x.id);
      const docs = await this.usuarioModel
        .find({ _id: { $in: pageIds } }, projection)
        .populate('ciudades', 'nombre')
        .populate('categorias', 'nombre')
        .lean();
      const byId = new Map(docs.map((d: any) => [String(d._id), d]));
      const data = pageIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((d: any) => this._mapPromoDoc(d));
      return { data, total, page, limit, hasMore: page * limit < total };
    }

    // 3b) Orden estable por _id (default).
    const total = await this.usuarioModel.countDocuments(filter);
    const docs = await this.usuarioModel
      .find(filter, projection)
      .populate('ciudades', 'nombre')
      .populate('categorias', 'nombre')
      .sort({ _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      data: docs.map((d: any) => this._mapPromoDoc(d)),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
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
        ubicacion: 1,
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
          galeria: Array.isArray(u.detallePromocion.galeria)
            ? u.detallePromocion.galeria
            : [],
          productos: Array.isArray(u.detallePromocion.productos)
            ? u.detallePromocion.productos
            : [],
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
      ubicacion: u.ubicacion ?? null,
      comentarios,
    };
  }

  async resetPassword(email: string, password: string) {
    validarClaveSegura(password);

    const u = await this.usuarioModel
      .findOne({ email: email.toLowerCase() })
      .select('_id');
    if (!u) throw new NotFoundException('Cuenta no encontrada');

    const hash = await bcrypt.hash(password, 10);
    // updateOne (NO u.save()): solo setea la clave y evita disparar el hook
    // pre('save') que revalida detallePromocion (días/horarios) y haría fallar
    // el cambio de clave si el establecimiento tiene datos inconsistentes.
    await this.usuarioModel.updateOne({ _id: u._id }, { $set: { clave: hash } });
    return { ok: true };
  }

  async findEstablecimientos({
    page = 1,
    limit = 12,
    q = '',
    soloCreadorId,
  }: {
    page: number;
    limit: number;
    q?: string;
    soloCreadorId?: string;
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

    const baseQuery: any = {
      rol: { $in: [RolUsuario.LOCAL] },
      ...(soloCreadorId ? { usuarioCreacion: soloCreadorId } : {}),
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

  async actualizarFcmToken(usuarioId: string, fcmToken: string): Promise<void> {
    await this.usuarioModel.findByIdAndUpdate(usuarioId, { fcmToken });
  }

  async obtenerFcmToken(usuarioId: string): Promise<string | null> {
    const doc = await this.usuarioModel.findById(usuarioId).select('fcmToken').lean();
    return (doc as any)?.fcmToken ?? null;
  }
}
