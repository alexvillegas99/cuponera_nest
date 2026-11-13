import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  VersionCuponera,
  VersionCuponeraDocument,
} from './schemas/version-cuponera.schema';
import { Model, isValidObjectId, Types } from 'mongoose';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { Ciudad, CiudadDocument } from 'src/ciudad/schema/ciudad.schema';
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';

/** Populate compartido para refs de ciudades y provincias */
const POPULATE_REFS = [
  { path: 'ciudadesDisponibles', select: 'nombre' },
  { path: 'provinciasDisponibles', select: 'nombre' },
];

@Injectable()
export class VersionCuponeraService {
  constructor(
    @InjectModel(VersionCuponera.name)
    private readonly versionModel: Model<VersionCuponeraDocument>,
    @InjectModel(Ciudad.name)
    private readonly ciudadModel: Model<CiudadDocument>,
    private readonly usuariosService: UsuariosService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /// Notifica a TODOS los clientes (topic 'general') una nueva membresía.
  private async _notificarNuevaPromo(version: any) {
    try {
      const nombre = version?.nombre ?? 'Una nueva membresía';
      await this.notificaciones.enviarATopic(
        'general',
        '¡Nueva membresía disponible! 🎉',
        `"${nombre}" ya está disponible. ¡Descúbrela en la app!`,
      );
    } catch (_) {}
  }

  /** Convierte refs populadas (ciudades y provincias) a arrays de nombres */
  private toNames(doc: any) {
    if (!doc) return doc;
    const d = { ...doc };
    const mapNombres = (arr: any) =>
      Array.isArray(arr)
        ? arr
            .map((c: any) => (typeof c === 'string' ? c : c?.nombre))
            .filter(Boolean)
        : arr;
    d.ciudadesDisponibles = mapNombres(d.ciudadesDisponibles);
    d.provinciasDisponibles = mapNombres(d.provinciasDisponibles);
    return d;
  }

  /**
   * Conjunto de ids de ciudad para una versión: ciudadesDisponibles +
   * todas las ciudades de las provinciasDisponibles. Devuelve string[].
   */
  private async expandirCiudades(version: any): Promise<string[]> {
    const set = new Set<string>();
    for (const c of version.ciudadesDisponibles || []) {
      set.add(c.toString());
    }
    const provIds = (version.provinciasDisponibles || []).map((p: any) =>
      p.toString(),
    );
    if (provIds.length) {
      // ObjectId explícito: con strings la consulta no coincide y las
      // cuponeras definidas por provincia quedaban sin ciudades ni locales.
      const ciudades = await this.ciudadModel
        .find({ provincia: { $in: provIds.map((id: string) => new Types.ObjectId(id)) } })
        .select('_id')
        .lean();
      for (const c of ciudades) set.add(c._id.toString());
    }
    return [...set];
  }

  /** RAW sin populate (para validaciones/uso interno) */
  async findByIdRaw(id: string) {
    if (!isValidObjectId(id))
      throw new BadRequestException('ID de versión inválido');
    const doc = await this.versionModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Versión de cuponera no encontrada');
    return doc;
  }

  async create(dto: any): Promise<any> {
    const created = await this.versionModel.create(dto);
    const populated = await this.versionModel
      .findById(created._id)
      .populate(POPULATE_REFS)
      .lean();
    // Si nace activa, avisar a los clientes.
    if (created?.estado === true) {
      this._notificarNuevaPromo(populated ?? created);
    }
    return this.toNames(populated);
  }

  async findAll(): Promise<any[]> {
    const list = await this.versionModel
      .find()
      .populate(POPULATE_REFS)
      .lean();
    return list.map((d) => this.toNames(d));
  }

  async findById(id: string): Promise<any> {
    const version = await this.versionModel
      .findById(id)
      .populate(POPULATE_REFS)
      .lean();
    if (!version)
      throw new NotFoundException('Versión de cuponera no encontrada');
    return this.toNames(version);
  }

  async delete(id: string): Promise<{ ok: true }> {
    const result = await this.versionModel.findByIdAndDelete(id).exec();
    if (!result)
      throw new NotFoundException(
        'Versión de cuponera no encontrada para eliminar',
      );
    return { ok: true };
  }

  async update(id: string, dto: Partial<any>): Promise<any> {
    const updated = await this.versionModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate(POPULATE_REFS)
      .lean();
    if (!updated)
      throw new NotFoundException('Versión de cuponera no encontrada');
    // Al ACTIVAR la versión, avisar a los clientes.
    if ((dto as any)?.estado === true) {
      this._notificarNuevaPromo(updated);
    }
    return this.toNames(updated);
  }

  // ... otros métodos existentes ...

  /** Versión ACTIVA con ese nombre exacto (sin distinguir mayúsculas). */
  async buscarActivaPorNombreExacto(nombre: string): Promise<any | null> {
    const limpio = String(nombre ?? '').trim();
    if (!limpio) return null;
    const escapado = limpio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.versionModel
      .findOne({ nombre: { $regex: `^${escapado}$`, $options: 'i' }, estado: true })
      .lean();
  }

  async buscarPorNombre(nombre?: string, estado?: string): Promise<any[]> {
    // Construir filtro dinámico
    const filtro: any = {};

    if (nombre && nombre.trim() !== '') {
      // Búsqueda case-insensitive con regex
      filtro.nombre = {
        $regex: nombre.trim(),
        $options: 'i',
      };
    }

    if (estado !== undefined) {
      // Convertir string a boolean
      filtro.estado = estado === 'true' || estado === '1';
    }

    const resultados = await this.versionModel
      .find(filtro)
      .populate(POPULATE_REFS)
      .sort({ nombre: 1 }) // Ordenar alfabéticamente
      .lean();

    return resultados.map((d) => this.toNames(d));
  }

  /**
   * Catálogo de versiones paginado (endpoint nuevo, aditivo): nombre (q),
   * estado, provincia(s)/ciudad(es), page/limit. No reemplaza buscarPorNombre.
   */
  async buscarPaginado(params: {
    nombre?: string;
    estado?: string;
    provincias?: string;
    ciudades?: string;
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
    const filtro: any = {};

    if (params.nombre && params.nombre.trim() !== '') {
      filtro.nombre = {
        $regex: params.nombre.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
    }
    if (params.estado !== undefined) {
      filtro.estado = params.estado === 'true' || params.estado === '1';
    }

    if (params.ciudades) {
      const cityIds = params.ciudades
        .split(',')
        .map((s) => s.trim())
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
      if (cityIds.length) filtro.ciudadesDisponibles = { $in: cityIds };
    } else if (params.provincias) {
      const provIds = params.provincias
        .split(',')
        .map((s) => s.trim())
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
      if (provIds.length) {
        const ciudades = await this.ciudadModel
          .find({ provincia: { $in: provIds } })
          .select('_id')
          .lean();
        const cityIds = ciudades.map((c: any) => c._id);
        filtro.$or = [
          { provinciasDisponibles: { $in: provIds } },
          { ciudadesDisponibles: { $in: cityIds } },
        ];
      }
    }

    const total = await this.versionModel.countDocuments(filtro);
    const docs = await this.versionModel
      .find(filtro)
      .populate(POPULATE_REFS)
      .sort({ nombre: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return {
      data: docs.map((d) => this.toNames(d)),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  /** Ids de ciudad (ObjectId) de una versión, expandiendo provincias. Uso externo. */
  async ciudadIdsDeVersion(versionId: string): Promise<Types.ObjectId[]> {
    const version = await this.findByIdRaw(versionId);
    const ids = await this.expandirCiudades(version);
    return ids.map((id) => new Types.ObjectId(id));
  }

  /** Retorna los locales disponibles para una versión (ciudades + provincias expandidas) */
  async findLocalesByVersion(versionId: string) {
    const version = await this.findByIdRaw(versionId);
    const ciudadIds = await this.expandirCiudades(version);

    if (ciudadIds.length === 0) return [];

    return this.usuariosService.findByCiudadesConPromo(ciudadIds);
  }

  /**
   * Cuponeras activas para el selector de compra de la app: precio, cobertura
   * (provincias y ciudades, expandidas para poder buscar), nº de locales y
   * distancia al local afiliado más cercano. Ordenadas por cercanía si se
   * envían lat/lng; si no, por nombre.
   */
  async disponibles(lat?: number, lng?: number) {
    const versiones: any[] = await this.versionModel.find({ estado: true }).lean();
    const tieneUbicacion = Number.isFinite(lat) && Number.isFinite(lng);
    const rad = (x: number) => (x * Math.PI) / 180;
    const km = (a: { lat: number; lng: number }) => {
      const dLat = rad(a.lat - (lat as number));
      const dLng = rad(a.lng - (lng as number));
      const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat as number)) * Math.cos(rad(a.lat)) * Math.sin(dLng / 2) ** 2;
      return 6371 * 2 * Math.asin(Math.sqrt(h));
    };

    const out: any[] = [];
    for (const v of versiones) {
      const ciudadIds = await this.expandirCiudades(v);
      const ciudades: any[] = ciudadIds.length
        ? await this.ciudadModel
            .find({ _id: { $in: ciudadIds } })
            .select('nombre provincia')
            .populate({ path: 'provincia', select: 'nombre' })
            .lean()
        : [];
      const locales: any[] = ciudadIds.length
        ? await this.usuariosService.findByCiudadesConPromo(ciudadIds)
        : [];
      let distanciaKm: number | null = null;
      if (tieneUbicacion) {
        for (const l of locales) {
          const u = l?.ubicacion;
          if (u && Number.isFinite(u.lat) && Number.isFinite(u.lng)) {
            const d = km(u);
            if (distanciaKm === null || d < distanciaKm) distanciaKm = d;
          }
        }
      }
      const provincias = [...new Set(ciudades.map((c) => c?.provincia?.nombre).filter(Boolean))];
      out.push({
        _id: v._id,
        nombre: v.nombre,
        descripcion: v.descripcion ?? '',
        precio: v.precio,
        provincias,
        ciudades: ciudades.map((c) => c.nombre).sort((a, b) => a.localeCompare(b, 'es')),
        totalLocales: locales.length,
        distanciaKm: distanciaKm === null ? null : Math.round(distanciaKm * 10) / 10,
      });
    }
    out.sort((a, b) => {
      if (a.distanciaKm !== null && b.distanciaKm !== null) return a.distanciaKm - b.distanciaKm;
      if (a.distanciaKm !== null) return -1;
      if (b.distanciaKm !== null) return 1;
      return String(a.nombre).localeCompare(String(b.nombre), 'es');
    });
    return out;
  }
}
