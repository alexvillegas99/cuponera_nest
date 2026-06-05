import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Provincia, ProvinciaDocument } from './schema/provincia.schema';

@Injectable()
export class ProvinciaService {
  constructor(
    @InjectModel(Provincia.name)
    private readonly provinciaModel: Model<ProvinciaDocument>,
  ) {}

  create(data: Partial<Provincia>) {
    return this.provinciaModel.create(data);
  }

  findAll(q?: string, estado?: string) {
    const filter: any = {};
    if (q) filter.nombre = new RegExp(q, 'i');
    if (estado !== undefined) filter.estado = estado === 'true';
    return this.provinciaModel.find(filter).sort({ nombre: 1 }).lean();
  }

  findActivas() {
    return this.provinciaModel.find({ estado: true }).sort({ nombre: 1 }).lean();
  }

  async findById(id: string) {
    const doc = await this.provinciaModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Provincia no encontrada');
    return doc;
  }

  async update(id: string, data: Partial<Provincia>) {
    const updated = await this.provinciaModel
      .findByIdAndUpdate(id, data, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Provincia no encontrada');
    return updated;
  }

  activar(id: string) {
    return this.update(id, { estado: true });
  }

  desactivar(id: string) {
    return this.update(id, { estado: false });
  }

  async remove(id: string) {
    const deleted = await this.provinciaModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Provincia no encontrada');
    return { ok: true };
  }
}
