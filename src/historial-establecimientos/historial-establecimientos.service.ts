import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  HistorialEstablecimiento,
  HistorialEstablecimientoDocument,
} from './schema/historial-establecimiento.schema';
import { UsuariosService } from 'src/usuarios/usuarios.service';

@Injectable()
export class HistorialEstablecimientosService {
  constructor(
    @InjectModel(HistorialEstablecimiento.name)
    private readonly model: Model<HistorialEstablecimientoDocument>,
    private readonly usuariosService: UsuariosService,
  ) {}

  async registrarCambio(data: {
    establecimientoId: string;
    nombreEstablecimiento: string;
    editadoPorId: string;
    editadoPorNombre: string;
    datosAnteriores: Record<string, any>;
    datosNuevos: Record<string, any>;
  }) {
    return this.model.create(data);
  }

  async findAll(params: {
    estado?: string;
    page?: number;
    limit?: number;
  }) {
    const { estado, page = 1, limit = 15 } = params;
    const query: any = {};
    if (estado) query.estado = estado;

    const total = await this.model.countDocuments(query);
    const items = await this.model
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async contarPendientes(): Promise<number> {
    return this.model.countDocuments({ estado: 'pendiente' });
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Registro no encontrado');
    return doc;
  }

  async aprobar(id: string, adminUser: any) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Registro no encontrado');
    if (doc.estado !== 'pendiente')
      throw new BadRequestException('Solo se pueden revisar cambios pendientes');

    doc.estado = 'aprobado';
    doc.revisadoPorId = adminUser._id;
    doc.revisadoPorNombre = adminUser.nombre ?? adminUser.email;
    doc.fechaRevision = new Date();
    await doc.save();
    return { ok: true };
  }

  async revertir(id: string, adminUser: any) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Registro no encontrado');
    if (doc.estado !== 'pendiente')
      throw new BadRequestException('Solo se pueden revertir cambios pendientes');

    await this.usuariosService.update(
      doc.establecimientoId.toString(),
      doc.datosAnteriores,
    );

    doc.estado = 'revertido';
    doc.revisadoPorId = adminUser._id;
    doc.revisadoPorNombre = adminUser.nombre ?? adminUser.email;
    doc.fechaRevision = new Date();
    await doc.save();
    return { ok: true };
  }
}
