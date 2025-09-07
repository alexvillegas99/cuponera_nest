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

@Injectable()
export class UsuariosService {
  constructor(
    @InjectModel(Usuario.name) private usuarioModel: Model<UsuarioDocument>,
    @InjectModel(Comentario.name)
    private readonly comentarioModel: Model<ComentarioDocument>,
  ) {}
  private readonly logger = new Logger(UsuariosService.name);

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

  // ===== CRUD usado por tu controlador =====

  async create(dto: any): Promise<any> {
    const existeEmail = await this.findByEmail(dto.email);
    if (existeEmail) throw new BadRequestException('El email ya está en uso');

    dto.clave = bcrypt.hashSync(dto.clave, 10);
    const created = await this.usuarioModel.create(dto);

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

    const updated = await this.usuarioModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate('ciudades', 'nombre')
      .populate('categorias', 'nombre')
      .lean();

    if (!updated)
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    return this.mapNombres(updated);
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
}
