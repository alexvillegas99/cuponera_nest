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
  ) {}

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
      const ciudades = await this.ciudadModel
        .find({ provincia: { $in: provIds } })
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
    return this.toNames(updated);
  }

  // ... otros métodos existentes ...

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
}
