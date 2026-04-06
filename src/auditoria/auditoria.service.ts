import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Auditoria, AuditoriaDocument } from './schema/auditoria.schema';

export interface RegistroAuditoria {
  accion: string;
  modulo: string;
  descripcion: string;
  usuarioId?: string;
  usuarioNombre?: string;
  usuarioEmail?: string;
  recursoId?: string;
  recursoTipo?: string;
  datosAnteriores?: Record<string, any>;
  datosNuevos?: Record<string, any>;
  ip?: string;
  severidad?: 'info' | 'warning' | 'critical';
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    @InjectModel(Auditoria.name)
    private readonly model: Model<AuditoriaDocument>,
  ) {}

  /** Registra una acción en el log de auditoría */
  async registrar(data: RegistroAuditoria): Promise<void> {
    try {
      await this.model.create({
        ...data,
        usuarioId: data.usuarioId
          ? new Types.ObjectId(data.usuarioId)
          : null,
        severidad: data.severidad ?? 'info',
      });
    } catch (error) {
      // Nunca romper el flujo principal por un error de auditoría
      this.logger.error(`Error al registrar auditoría: ${error.message}`);
    }
  }

  /** Registra desde req.user (atajo para controllers) */
  async registrarDesdeUsuario(
    user: any,
    data: Omit<RegistroAuditoria, 'usuarioId' | 'usuarioNombre' | 'usuarioEmail'>,
  ): Promise<void> {
    await this.registrar({
      ...data,
      usuarioId: user?._id?.toString() ?? user?.sub,
      usuarioNombre: user?.nombre ?? '',
      usuarioEmail: user?.email ?? '',
    });
  }

  /** Buscar logs con filtros */
  async buscar(filtros?: {
    modulo?: string;
    accion?: string;
    usuarioId?: string;
    severidad?: string;
    desde?: string;
    hasta?: string;
    page?: number;
    limit?: number;
  }) {
    const query: any = {};

    if (filtros?.modulo) query.modulo = filtros.modulo;
    if (filtros?.accion) query.accion = { $regex: filtros.accion, $options: 'i' };
    if (filtros?.usuarioId) query.usuarioId = new Types.ObjectId(filtros.usuarioId);
    if (filtros?.severidad) query.severidad = filtros.severidad;

    if (filtros?.desde || filtros?.hasta) {
      query.createdAt = {};
      if (filtros.desde) query.createdAt.$gte = new Date(filtros.desde);
      if (filtros.hasta) query.createdAt.$lte = new Date(filtros.hasta + 'T23:59:59');
    }

    const page = filtros?.page || 1;
    const limit = filtros?.limit || 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments(query),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }
}
