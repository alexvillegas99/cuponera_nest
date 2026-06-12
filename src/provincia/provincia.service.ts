import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Provincia, ProvinciaDocument } from './schema/provincia.schema';

/** Normaliza un nombre a un slug seguro para topic FCM (no permite tildes ni espacios). */
export function slugifyProvincia(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

@Injectable()
export class ProvinciaService implements OnModuleInit {
  private readonly logger = new Logger(ProvinciaService.name);

  constructor(
    @InjectModel(Provincia.name)
    private readonly provinciaModel: Model<ProvinciaDocument>,
  ) {}

  /** Asegura que TODAS las provincias tengan slug. Idempotente. */
  async onModuleInit() {
    try {
      const sinSlug = await this.provinciaModel
        .find({ $or: [{ slug: null }, { slug: '' }, { slug: { $exists: false } }] })
        .lean();
      if (!sinSlug.length) return;
      this.logger.log(`Generando slug para ${sinSlug.length} provincia(s)…`);
      for (const p of sinSlug) {
        const slug = slugifyProvincia(p.nombre);
        await this.provinciaModel.updateOne({ _id: p._id }, { $set: { slug } });
      }
      this.logger.log(`Slugs de provincia generados ✔`);
    } catch (e: any) {
      this.logger.error(`onModuleInit error: ${e?.message}`);
    }
  }

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
