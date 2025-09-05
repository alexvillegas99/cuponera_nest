// src/compartidos/compartidos.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Compartido, CompartidoDocument } from './schemas/compartido.schema';
import { CreateCompartidoDto, ResumenCompartidosDto } from './dto/create-compartido.dto';
import { CanalCompartir } from './enum/canal.enum';

@Injectable()
export class CompartidosService {
  constructor(
    @InjectModel(Compartido.name)
    private readonly compartidoModel: Model<CompartidoDocument>,
  ) {}

  async crear(dto: CreateCompartidoDto) {
    const { clienteId, usuarioId } = dto;
    if (!Types.ObjectId.isValid(clienteId) || !Types.ObjectId.isValid(usuarioId)) {
      throw new BadRequestException('clienteId o usuarioId inválidos');
    }

    const doc = await this.compartidoModel.create({
      cliente: new Types.ObjectId(clienteId),
      usuario: new Types.ObjectId(usuarioId),
      canal: dto.canal,
      telefonoDestino: dto.telefonoDestino || null,
      mensaje: dto.mensaje || null,
      origen: dto.origen || null,
      origenId: dto.origenId ? new Types.ObjectId(dto.origenId) : null,
    });

    return { ok: true, id: String(doc._id) };
  }

  async resumenPorUsuario(usuarioId: string): Promise<ResumenCompartidosDto> {
    if (!Types.ObjectId.isValid(usuarioId)) {
      throw new BadRequestException('usuarioId inválido');
    }

    const rows = await this.compartidoModel.aggregate([
      { $match: { usuario: new Types.ObjectId(usuarioId) } },
      { $group: { _id: '$canal', count: { $sum: 1 } } },
    ]);

    const porCanal: Record<string, number> = {
      [CanalCompartir.WHATSAPP]: 0,
      [CanalCompartir.SISTEMA]: 0,
    };

    let total = 0;
    for (const r of rows) {
      porCanal[r._id] = r.count;
      total += r.count;
    }

    return { total, porCanal };
  }
}
