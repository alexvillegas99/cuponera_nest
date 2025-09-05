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
import { Model, isValidObjectId } from 'mongoose';

@Injectable()
export class VersionCuponeraService {
  constructor(
    @InjectModel(VersionCuponera.name)
    private readonly versionModel: Model<VersionCuponeraDocument>,
  ) {}

  /** Convierte refs populadas a array de nombres */
  private toNames(doc: any) {
    if (!doc) return doc;
    const d = { ...doc };
    if (Array.isArray(d.ciudadesDisponibles)) {
      d.ciudadesDisponibles = d.ciudadesDisponibles
        .map((c: any) => (typeof c === 'string' ? c : c?.nombre))
        .filter(Boolean);
    }
    return d;
  }

  /** RAW sin populate (para validaciones/uso interno) */
  async findByIdRaw(id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('ID de versión inválido');
    const doc = await this.versionModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Versión de cuponera no encontrada');
    return doc;
  }

  async create(dto: any): Promise<any> {
    const created = await this.versionModel.create(dto);
    const populated = await this.versionModel
      .findById(created._id)
      .populate({ path: 'ciudadesDisponibles', select: 'nombre' })
      .lean();
    return this.toNames(populated);
  }

  async findAll(): Promise<any[]> {
    const list = await this.versionModel
      .find()
      .populate({ path: 'ciudadesDisponibles', select: 'nombre' })
      .lean();
    return list.map((d) => this.toNames(d));
  }

  async findById(id: string): Promise<any> {
    const version = await this.versionModel
      .findById(id)
      .populate({ path: 'ciudadesDisponibles', select: 'nombre' })
      .lean();
    if (!version) throw new NotFoundException('Versión de cuponera no encontrada');
    return this.toNames(version);
  }

  async delete(id: string): Promise<{ ok: true }> {
    const result = await this.versionModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Versión de cuponera no encontrada para eliminar');
    return { ok: true };
  }

  async update(id: string, dto: Partial<any>): Promise<any> {
    const updated = await this.versionModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate({ path: 'ciudadesDisponibles', select: 'nombre' })
      .lean();
    if (!updated) throw new NotFoundException('Versión de cuponera no encontrada');
    return this.toNames(updated);
  }
}
