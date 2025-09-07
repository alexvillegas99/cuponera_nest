// src/empresas-solicitudes/empresas-solicitudes.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmpresaSolicitud, EmpresaSolicitudDocument } from './schema/empresa-solicitud.schema';


@Injectable()
export class EmpresasSolicitudesService {
  constructor(
    @InjectModel(EmpresaSolicitud.name)
    private readonly model: Model<EmpresaSolicitudDocument>,
  ) {}

  async create(dto: any) {
    try {
      // Normaliza email a minúsculas siempre
      dto.email = dto.email.toLowerCase();
      return await this.model.create(dto);
    } catch (e: any) {
      if (e?.code === 11000 && e?.keyPattern?.email) {
        throw new ConflictException(
          'Ya existe una solicitud registrada con este correo.',
        );
      }
      throw e;
    }
  }

  async checkEmailAvailability(email: string) {
    const exists = await this.model.exists({ email: email.toLowerCase() });
    return { available: !exists };
  }

  async findAll(estado?: any) {
    const q: any = {};
    if (estado) q.estado = estado;
    return this.model
      .find(q)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findOne(id: string) {
    const found = await this.model.findById(id).lean().exec();
    if (!found) throw new NotFoundException('Solicitud no encontrada');
    return found;
  }

  async update(id: string, dto: any) {
    if (dto.email) delete dto.email; // no permitir cambiar email (clave lógica)
    const upd = await this.model
      .findByIdAndUpdate(id, dto, { new: true })
      .lean()
      .exec();
    if (!upd) throw new NotFoundException('Solicitud no encontrada');
    return upd;
  }

  async remove(id: string) {
    const del = await this.model.findByIdAndDelete(id).lean().exec();
    if (!del) throw new NotFoundException('Solicitud no encontrada');
    return { ok: true };
  }
}
