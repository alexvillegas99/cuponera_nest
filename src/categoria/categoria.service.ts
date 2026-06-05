import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Categoria, CategoriaDocument } from './schema/categoria.schema';

/** Normaliza un nombre para comparar duplicados (sin tildes/mayúsculas/espacios extra). */
function normalizarNombre(nombre = ''): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class CategoriaService {
  constructor(
    @InjectModel(Categoria.name)
    private readonly categoriaModel: Model<CategoriaDocument>,
  ) {}

  /** Rechaza un nombre que ya existe (ignorando tildes, mayúsculas y espacios). */
  private async assertNombreUnico(nombre?: string, excluirId?: string) {
    const norm = normalizarNombre(nombre);
    if (!norm) return;
    const existentes = await this.categoriaModel
      .find()
      .select('_id nombre')
      .lean();
    const choca = existentes.find(
      (c: any) =>
        normalizarNombre(c.nombre) === norm &&
        (!excluirId || c._id.toString() !== excluirId),
    );
    if (choca) {
      throw new BadRequestException(
        `Ya existe una categoría "${(choca as any).nombre}"`,
      );
    }
  }

  async create(data: Partial<Categoria>) {
    await this.assertNombreUnico(data.nombre);
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
    if (data.nombre !== undefined) {
      await this.assertNombreUnico(data.nombre, id);
    }
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
