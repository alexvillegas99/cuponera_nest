import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { Ciudad, CiudadDocument } from './schema/ciudad.schema';

/** Castea un id de provincia a ObjectId (evita el mismatch string vs ObjectId). */
function provinciaFilter(provincia?: string) {
  if (!provincia) return undefined;
  return isValidObjectId(provincia)
    ? new Types.ObjectId(provincia)
    : provincia;
}

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
    provincia?: string;
    limit?: number;
    page?: number;
  }) {
    const { q, estado, provincia, limit = 50, page = 1 } = params;

    const filter: any = {};
    if (q) filter.nombre = new RegExp(q, 'i');
    if (estado !== undefined) filter.estado = estado === 'true';
    if (provincia) filter.provincia = provinciaFilter(provincia);

    const items = await this.ciudadModel
      .find(filter)
      .populate('provincia', 'nombre codigo')
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
    const ciudad = await this.ciudadModel
      .findById(id)
      .populate('provincia', 'nombre codigo')
      .lean();
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

  findParaRegistro(provincia?: string) {
    const filter: any = { visibleParaRegistro: true };
    if (provincia) filter.provincia = provinciaFilter(provincia);
    return this.ciudadModel
      .find(filter)
      .populate('provincia', 'nombre codigo')
      .sort({ nombre: 1 })
      .lean();
  }

  findParaPromociones(provincia?: string) {
    const filter: any = { estado: true };
    if (provincia) filter.provincia = provinciaFilter(provincia);
    return this.ciudadModel
      .find(filter)
      .populate('provincia', 'nombre codigo')
      .sort({ nombre: 1 })
      .lean();
  }
}
