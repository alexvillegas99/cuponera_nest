import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cupon, CuponDocument } from './schemas/cupon.schema';
import { CreateCuponDto } from './dto/create-cupon.dto';
import { VersionCuponeraService } from 'src/version-cuponera/version-cuponera.service';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { EstadoCupon } from './enum/estados_cupon';
import { Types } from 'mongoose';
@Injectable()
export class CuponService {
  constructor(
    @InjectModel(Cupon.name) private readonly _cuponModel: Model<CuponDocument>,
    private readonly _versionModel: VersionCuponeraService,
    private readonly _usuariosModel: UsuariosService,
  ) {}

  async create(dto: CreateCuponDto): Promise<Cupon> {
    const version = await this._versionModel.findById(dto.version);
    if (!version)
      throw new NotFoundException('Versión de cuponera no encontrada');

    // Validar fechas
    if (dto.fechaActivacion && dto.fechaVencimiento) {
      const f1 = new Date(dto.fechaActivacion);
      const f2 = new Date(dto.fechaVencimiento);
      if (f1 >= f2) {
        throw new BadRequestException(
          'La fecha de vencimiento debe ser posterior a la de activación',
        );
      }
    }

    // Calcular secuencial si no viene en el DTO
    let secuencial = dto.secuencial;
    if (!secuencial) {
      const count = await this._cuponModel.countDocuments({
        version: dto.version,
      });
      secuencial = count + 1;
    }

    const cupon = new this._cuponModel({
      ...dto,
      secuencial,
    });

    return cupon.save();
  }

  async findAll(): Promise<Cupon[]> {
    return this._cuponModel.find().populate('version').exec();
  }

  async findById(id: string): Promise<Cupon> {
    const cupon = await this._cuponModel
      .findById(id)
      .populate('version usuarioActivador')
      .lean()
      .exec();
    if (!cupon) throw new NotFoundException('Cupón no encontrado');

    return cupon;
  }

  async delete(id: string): Promise<void> {
    const result = await this._cuponModel.findByIdAndDelete(id).exec();
    if (!result)
      throw new NotFoundException('Cupón no encontrado para eliminar');
  }

  async incrementarEscaneos(id: string): Promise<void> {
    const cupon = await this._cuponModel.findById(id).exec(); // Este es CuponDocument | null
    if (!cupon) throw new NotFoundException('Cupón no encontrado');

    cupon.numeroDeEscaneos++;
    await cupon.save(); // ✔️ Esto ya no da error
  }

  async activarCuponPorSecuencial(
    versionId: string,
    secuencial: number,
    usuarioId: string,
  ): Promise<Cupon> {
    const cupon = await this._cuponModel
      .findOne({ version: new Types.ObjectId(versionId), secuencial })
      .exec();

    if (!cupon)
      throw new NotFoundException(
        'Cupón no encontrado para esa versión y secuencial',
      );

    if (cupon.estado === EstadoCupon.ACTIVO) {
      throw new BadRequestException('El cupón ya está activo');
    }
    if (cupon.estado === EstadoCupon.BLOQUEADO) {
      throw new BadRequestException(
        'El cupón está bloqueado y no puede activarse',
      );
    }

    cupon.estado = EstadoCupon.ACTIVO;
    cupon.usuarioActivador = new Types.ObjectId(usuarioId);
    cupon.fechaActivacion = new Date();

    // poner fecha de vencimiento de 1 anio a partir de la activación
    const fechaVencimiento = new Date(cupon.fechaActivacion);
    fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 1);
    cupon.fechaVencimiento = fechaVencimiento;

    return cupon.save();
  }

  async generarLote(
    versionId: string,
    cantidad: number,
    fechaActivacion?: string,
    fechaVencimiento?: string,
  ): Promise<Cupon[]> {
    const version = await this._versionModel.findById(versionId);
    if (!version)
      throw new NotFoundException('Versión de cuponera no encontrada');

    const count = await this._cuponModel.countDocuments({ version: versionId });

    const cupones: Cupon[] = [];

    for (let i = 0; i < cantidad; i++) {
      const cupon = new this._cuponModel({
        version: new Types.ObjectId(versionId),
        secuencial: count + i + 1,
        estado: 'inactivo',
        fechaActivacion: fechaActivacion ? new Date(fechaActivacion) : null,
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
      });

      cupones.push(cupon);
    }

    return this._cuponModel.insertMany(cupones);
  }

  async findByVersionId(versionId: string) {
    const cupones = await this._cuponModel
      .find({ version: new Types.ObjectId(versionId) })
      .populate('usuarioActivador')
      .sort({ secuencial: 1 })
      .exec();
    if (cupones.length === 0)
      throw new NotFoundException(
        'No se encontraron cupones para esta versión',
      );

    return cupones;
  }

  async desactivarCuponPorSecuencial(versionId: string, secuencial: number) {
    try {
      return await this._cuponModel.findOneAndUpdate(
        { version: new Types.ObjectId(versionId), secuencial },
        {
          estado: EstadoCupon.INACTIVO,
          usuarioActivador: null,
          fechaActivacion: null,
          fechaVencimiento: null,
        },
        { new: true },
      );
    } catch (error) {
      console.log('Error al desactivar cupón:', error);
      throw new NotFoundException('Versión de cuponera no encontrada');
    }
  }

}
