import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ciudad, CiudadDocument } from './schema/ciudad.schema';

@Injectable()
export class CiudadService {
  constructor(
    @InjectModel(Ciudad.name)
    private readonly ciudadModel: Model<CiudadDocument>,
  ) {}

  create(data: Partial<Ciudad>) {
    return this.ciudadModel.create(data);
  }

  async findAll(params: {
    q?: string;
    estado?: string;
    limit?: number;
    page?: number;
  }) {
    const { q, estado, limit = 50, page = 1 } = params;

    const filter: any = {};
    if (q) filter.nombre = new RegExp(q, 'i');
    if (estado !== undefined) filter.estado = estado === 'true';

    const items = await this.ciudadModel
      .find(filter)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    const total = await this.ciudadModel.countDocuments(filter);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async findById(id: string) {
    const ciudad = await this.ciudadModel.findById(id).lean();
    if (!ciudad) throw new NotFoundException('Ciudad no encontrada');
    return ciudad;
  }

  async update(id: string, data: Partial<Ciudad>) {
    const updated = await this.ciudadModel
      .findByIdAndUpdate(id, data, { new: true })
      .lean();

    if (!updated) throw new NotFoundException('Ciudad no encontrada');
    return updated;
  }

  async activar(id: string) {
    return this.update(id, { estado: true });
  }

  async desactivar(id: string) {
    return this.update(id, { estado: false });
  }

  async remove(id: string) {
    const deleted = await this.ciudadModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Ciudad no encontrada');
    return { ok: true };
  }

  findParaRegistro() {
    return this.ciudadModel
      .find({ visibleParaRegistro: true })
      .sort({ nombre: 1 })
      .lean();
  }

  findParaPromociones() {
    return this.ciudadModel
      .find({ estado: true })
      .sort({ nombre: 1 })
      .lean();
  }
}
