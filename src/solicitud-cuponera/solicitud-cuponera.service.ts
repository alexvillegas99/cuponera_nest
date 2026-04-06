import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SolicitudCuponera, EstadoSolicitud } from './schema/solicitud-cuponera.schema';
import { AmazonS3Service } from '../amazon-s3/amazon-s3.service';
import { CuponService } from '../cupon/cupon.service';
import { VersionCuponeraService } from '../version-cuponera/version-cuponera.service';

@Injectable()
export class SolicitudCuponeraService {
  private readonly logger = new Logger(SolicitudCuponeraService.name);

  constructor(
    @InjectModel(SolicitudCuponera.name)
    private readonly model: Model<SolicitudCuponera>,
    private readonly s3: AmazonS3Service,
    private readonly cuponService: CuponService,
    private readonly versionService: VersionCuponeraService,
  ) {}

  async create(dto: any): Promise<SolicitudCuponera> {
    let comprobanteUrl: string | undefined;

    if (dto.comprobanteBase64) {
      const result = await this.s3.uploadBase64({
        image: dto.comprobanteBase64,
        route: 'comprobantes-cuponera',
      });
      comprobanteUrl = result.url;
    }

    return this.model.create({
      ...dto,
      comprobanteBase64: undefined,
      comprobanteUrl,
      estado: EstadoSolicitud.PENDIENTE,
    });
  }

  async findAll(filtros?: { estado?: string; page?: number; limit?: number }) {
    const query: any = {};
    if (filtros?.estado) query.estado = filtros.estado;

    const page = filtros?.page || 1;
    const limit = filtros?.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('cliente', 'nombres apellidos email')
        .exec(),
      this.model.countDocuments(query),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<SolicitudCuponera> {
    const doc = await this.model
      .findById(id)
      .populate('cliente', 'nombres apellidos email telefono');
    if (!doc) throw new NotFoundException('Solicitud no encontrada');
    return doc;
  }

  async findByCliente(clienteId: string): Promise<SolicitudCuponera[]> {
    return this.model
      .find({ cliente: clienteId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateEstado(
    id: string,
    estado: EstadoSolicitud,
    notaAdmin?: string,
  ): Promise<any> {
    const doc = await this.model.findByIdAndUpdate(
      id,
      { estado, ...(notaAdmin && { notaAdmin }) },
      { new: true },
    );
    if (!doc) throw new NotFoundException('Solicitud no encontrada');

    // Si se aprueba, crear cupón automáticamente
    if (estado === EstadoSolicitud.APROBADO) {
      try {
        const cupon = await this.crearCuponDesdeAprobacion(doc);
        return { solicitud: doc, cuponCreado: cupon };
      } catch (error) {
        this.logger.error(
          `Error al crear cupón automático para solicitud ${id}: ${error.message}`,
        );
        return { solicitud: doc, cuponCreado: null, error: error.message };
      }
    }

    return { solicitud: doc };
  }

  /**
   * Busca la versión de cuponera por nombre y crea un cupón activo
   * asignado al cliente de la solicitud.
   */
  private async crearCuponDesdeAprobacion(solicitud: SolicitudCuponera) {
    // Buscar versión por nombre exacto (case-insensitive)
    const versiones = await this.versionService.buscarPorNombre(
      solicitud.cuponeraNombre,
      'true',
    );

    if (!versiones || versiones.length === 0) {
      throw new Error(
        `No se encontró versión de cuponera activa con nombre "${solicitud.cuponeraNombre}"`,
      );
    }

    // Tomar la primera coincidencia
    const version = versiones[0];

    // Crear cupón activo asignado al cliente
    const cupon = await this.cuponService.create({
      version: version._id,
      cliente: solicitud.cliente,
    });

    this.logger.log(
      `Cupón ${cupon._id} creado automáticamente para solicitud ${solicitud._id}`,
    );

    return cupon;
  }
}
