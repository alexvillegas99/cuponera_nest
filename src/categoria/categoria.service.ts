import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Categoria, CategoriaDocument } from './schema/categoria.schema';

@Injectable()
export class CategoriaService {
  constructor(
    @InjectModel(Categoria.name)
    private readonly categoriaModel: Model<CategoriaDocument>,
  ) {}

  create(data: Partial<Categoria>) {
    return this.categoriaModel.create(data);
  }

  findAll(q?: string, estado?: string) {
    const filter: any = {};
    if (q) filter.nombre = new RegExp(q, 'i');
    if (estado !== undefined) filter.estado = estado === 'true';

    return this.categoriaModel.find(filter).lean();
  }

  async findById(id: string) {
    const doc = await this.categoriaModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Categoría no encontrada');
    return doc;
  }

  async update(id: string, data: Partial<Categoria>) {
    const updated = await this.categoriaModel
      .findByIdAndUpdate(id, data, { new: true })
      .lean();

    if (!updated) throw new NotFoundException('Categoría no encontrada');
    return updated;
  }

  activar(id: string) {
    return this.update(id, { estado: true });
  }

  desactivar(id: string) {
    return this.update(id, { estado: false });
  }

  async remove(id: string) {
    const deleted = await this.categoriaModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Categoría no encontrada');
    return { ok: true };
  }

  findActivas() {
    return this.categoriaModel.find({ estado: true }).lean();
  }
}
