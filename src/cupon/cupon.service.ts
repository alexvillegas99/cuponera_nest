import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
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
import { HistoricoCuponService } from 'src/historico-cupon/historico-cupon.service';

// ⬇️ NUEVOS IMPORTS
import { Usuario, UsuarioDocument } from 'src/usuarios/schema/usuario.schema';
import {
  HistoricoCupon,
  HistoricoCuponDocument,
} from 'src/historico-cupon/schemas/historico-cupon.schema';
import { RolUsuario } from 'src/usuarios/enums/roles.enum';

@Injectable()
export class CuponService {
  constructor(
    @InjectModel(Cupon.name) private readonly _cuponModel: Model<CuponDocument>,
    private readonly _versionModel: VersionCuponeraService,
    private readonly _usuariosModel: UsuariosService,
    @Inject(forwardRef(() => HistoricoCuponService))
    private readonly historicoService: HistoricoCuponService,
    // ⬇️ NUEVO
    @InjectModel(Usuario.name)
    private readonly _usuarioModel: Model<UsuarioDocument>,
    @InjectModel(HistoricoCupon.name)
    private readonly _historicoModel: Model<HistoricoCuponDocument>,
  ) {}
  private readonly logger = new Logger(CuponService.name);
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

  async findAgregarUsuarioCliente(id: string) {
    const cupon = await this._cuponModel
      .findById(id)
      .populate('version cliente')
      .lean()
      .exec();

    if (!cupon) {
      throw new NotFoundException('Cupón no encontrado');
    }

    // Debe estar ACTIVO para permitir asignación de responsable
    if (cupon.estado !== EstadoCupon.ACTIVO) {
      throw new BadRequestException(
        'El cupón está inactivo o no disponible para asignar.',
      );
    }

    // No debe tener ya un usuario responsable asignado
    if (cupon.cliente) {
      throw new ConflictException(
        'El cupón ya se encuentra asignado a un usuario.',
      );
    }

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
    cupon.ultimoScaneo = new Date();
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

    const count = await this._cuponModel.countDocuments({
      version: new Types.ObjectId(versionId),
    });
    console.log('Cantidad de cupones existentes:', count);
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

  buscarPorFechas(fechaInicio: any, fechaFin: any) {
    console.log('Buscar por fechas:', fechaInicio, 'fechaInicio', fechaFin);
    // Buscar cupones por rango de fechas
    fechaInicio = new Date(fechaInicio);
    fechaFin = new Date(fechaFin);
    if (fechaInicio > fechaFin) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser mayor que la fecha de fin',
      );
    }

    return this._cuponModel
      .find({
        fechaActivacion: { $gte: fechaInicio, $lte: fechaFin },
      })
      .populate('version usuarioActivador')
      .lean()
      .exec();
  }

  async obtenerCuponerasPorCliente(
    clienteId: string,
    soloActivas = true,
  ): Promise<any[]> {
    if (!Types.ObjectId.isValid(clienteId)) {
      throw new BadRequestException('clienteId inválido');
    }

    const match: any = { cliente: new Types.ObjectId(clienteId) };
    if (soloActivas) {
      match.estado = EstadoCupon.ACTIVO;
    }

    const docs = await this._cuponModel
      .find(match)
      .populate('version', 'nombre numeroDeLocales descripcion')
      .sort({ createdAt: -1 })
      .lean();

    // Resolver en paralelo
    const result = await Promise.all(
      docs.map(async (c: any) => {
        const nombreVersion = c?.version?.nombre ?? 'Cuponera';
        const emitidaEl: Date =
          c?.fechaActivacion ?? c?.createdAt ?? new Date();
        const expiraEl: Date | null = c?.fechaVencimiento ?? null;
        const codigo = String(c?._id);
        const secuencial = c.secuencial;

        return {
          _id: String(c._id),
          nombre: nombreVersion,
          descripcion: c?.version?.descripcion ?? '',
          ultimoScaneo: c?.ultimoScaneo ?? null,
          codigo,
          emitidaEl,
          expiraEl,
          qrData: codigo,
          totalEscaneos: Number(c?.numeroDeEscaneos ?? 0),
          secuencial,
        };
      }),
    );

    return result;
  }

  // ✅ Asignar un cupón específico a un cliente
  async asignarCuponACliente(
    cuponId: string,
    clienteId: string,
    { override = false } = {},
  ) {
    if (
      !Types.ObjectId.isValid(cuponId) ||
      !Types.ObjectId.isValid(clienteId)
    ) {
      throw new BadRequestException('cuponId o clienteId inválido');
    }

    const filter: any = { _id: new Types.ObjectId(cuponId) };
    if (!override) {
      // solo asigna si NO tiene cliente y está ACTIVO
      filter.cliente = { $in: [null, undefined] };
      filter.estado = EstadoCupon.ACTIVO;
    }

    const cupon = await this._cuponModel.findOne(filter);
    if (!cupon) {
      if (override) throw new NotFoundException('Cupón no encontrado');
      throw new ConflictException('Cupón no disponible para asignar');
    }

    cupon.cliente = new Types.ObjectId(clienteId);
    if (cupon.estado === EstadoCupon.INACTIVO) {
      cupon.estado = EstadoCupon.ACTIVO; // si tu enum tiene ACTIVO
      cupon.fechaActivacion = new Date();
    }
    await cupon.save();

    return { ok: true, cuponId: String(cupon._id) };
  }

  // ✅ Listar cupones asignados a un cliente (tus “cuponeras”)
  async obtenerCuponesPorCliente(clienteId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(clienteId)) {
      throw new BadRequestException('clienteId inválido');
    }

    const cupones = await this._cuponModel
      .find({ cliente: new Types.ObjectId(clienteId) })
      .populate('version', 'nombre numeroDeLocales') // trae el nombre de la versión
      .sort({ createdAt: -1 })
      .lean();

    return cupones.map((c: any) => {
      const nombreVersion = c?.version?.nombre ?? 'Cuponera';
      const emitidaEl: Date = c?.fechaActivacion ?? c?.createdAt ?? new Date();
      const expiraEl: Date | null = c?.fechaVencimiento ?? null;
      const codigo = c?.codigo ?? String(c?._id);

      return {
        _id: String(c._id),
        nombre: nombreVersion,
        codigo,
        emitidaEl,
        expiraEl,
        qrData: codigo,
        totalEscaneos: Number(c?.numeroDeEscaneos ?? 0),
        scans: [], // cuando tengas historial real, lo llenas aquí
      };
    });
  }
  /**
   * Detalle para la pantalla de cuponera (SIN IDs en la respuesta).
   * - Cupón + Versión (con nombres de ciudades)
   * - Usuarios "LOCAL" candidatos por ciudades (con nombres de ciudades)
   * - Historial agregado por usuario (count, lastScan)
   * - Lugares sin escanear
   */
  // Dentro de CuponService

  async obtenerDetalleCupon(cuponId: string) {
    const C = 'obtenerDetalleCupon';
    const t0 = Date.now();
    this.logger.log(`[${C}] INICIO cuponId=${cuponId}`);

    try {
      if (!Types.ObjectId.isValid(cuponId)) {
        this.logger.warn(`[${C}] cuponId inválido: ${cuponId}`);
        throw new BadRequestException('cuponId inválido');
      }

      // Paso 1: Cupón con versión + ciudades
      const cupon: any = await this._cuponModel
        .findById(cuponId)
        .populate({
          path: 'version',
          select:
            'nombre estado ciudadesDisponibles numeroDeLocales descripcion',
          populate: {
            path: 'ciudadesDisponibles',
            select: 'nombre',
            options: { lean: true },
          },
          options: { lean: true },
        })
        .lean()
        .exec();

      if (!cupon) throw new NotFoundException('Cupón no encontrado');
      if (!cupon.version)
        throw new NotFoundException('Versión de cuponera no encontrada');

      const version = cupon.version;
      const ciudadesVersionNombres: string[] = Array.isArray(
        version.ciudadesDisponibles,
      )
        ? version.ciudadesDisponibles.map((c: any) => c?.nombre).filter(Boolean)
        : [];

      const ciudadesVersionIds: Types.ObjectId[] = Array.isArray(
        version.ciudadesDisponibles,
      )
        ? version.ciudadesDisponibles
            .map((c: any) => c?._id)
            .filter((id: any) => Types.ObjectId.isValid(id))
            .map((id: any) => new Types.ObjectId(id))
        : [];

      // Paso 2: Candidatos
      const ciudadFilter =
        ciudadesVersionIds.length > 0
          ? { ciudades: { $in: ciudadesVersionIds } }
          : {};
      const candidatos = await this._usuarioModel
        .find(
          {
            rol: RolUsuario.LOCAL,
            estado: true,
            ...ciudadFilter,
             'detallePromocion.title': { $exists: true, $ne: null },
          },
          {
            nombre: 1,
            email: 1,
            ciudades: 1,
            'detallePromocion.title': 1,
            'detallePromocion.logoUrl': 1,
            'detallePromocion.rating': 1,
            'detallePromocion.scheduleLabel': 1,
             'detallePromocion.placeName': 1,
          },
        )
        .populate({
          path: 'ciudades',
          select: 'nombre',
          options: { lean: true },
        })
        .lean()
        .exec();

      const candidatosMap = new Map<
        string,
        {
          _id: string;
          nombre: string;
          email: string;
          ciudadesNombres: string[];
          title?: string;
          logoUrl?: string;
          rating?: number;
          scheduleLabel?: string;
        }
      >();

      for (const u of candidatos) {
        const ciudadesNombres = Array.isArray(u.ciudades)
          ? u.ciudades.map((x: any) => x?.nombre).filter(Boolean)
          : [];
        candidatosMap.set(String(u._id), {
          _id: String(u._id),
          nombre: u.detallePromocion?.placeName || u.nombre,
          email: u.email,
          ciudadesNombres,
          title: u.detallePromocion?.title,
          logoUrl: u.detallePromocion?.logoUrl,
          rating: u.detallePromocion?.rating,
          scheduleLabel: u.detallePromocion?.scheduleLabel,
        });
      }

      // Paso 3: Historial agregado
      const agg = await this._historicoModel.aggregate<{
        _id: Types.ObjectId;
        count: number;
        lastScan: Date;
      }>([
        { $match: { cupon: cuponId } },
        {
          $group: {
            _id: '$usuario',
            count: { $sum: 1 },
            lastScan: { $max: '$fechaEscaneo' },
          },
        },
      ]);

      // Paso 4: Construir lugaresScaneados
      const lugaresScaneados: Array<any> = [];
      let totalEscaneos = 0;

      for (const row of agg) {
        const uid = row._id?.toString();
        if (!uid) continue;
        const info: any = candidatosMap.get(uid);
        if (!info) continue;

        totalEscaneos += row.count;
        lugaresScaneados.push({
          usuarioId: info._id, // 👈 NUEVO
          nombre: info.detallePromocion?.placeName || info.nombre,
          email: info.email,
          ciudades: info.ciudadesNombres,
          title: info.title,
          logoUrl: info.logoUrl,
          rating: info.rating,
          scheduleLabel: info.scheduleLabel,
          count: row.count,
          lastScan: row.lastScan ? row.lastScan.toISOString() : null,
        });
      }

      // Paso 5: Lugares sin scannear
      const yaScaneadosClave = new Set(lugaresScaneados.map((x) => x.email));
      const lugaresSinScannear = candidatos
        .filter((c) => !yaScaneadosClave.has(c.email))
        .map((c) => ({
          usuarioId: String(c._id),
          nombre: c.detallePromocion?.placeName || c.nombre,
          email: c.email,
          ciudades: (Array.isArray(c.ciudades) ? c.ciudades : [])
            .map((x: any) => x?.nombre)
            .filter(Boolean),
          title: c.detallePromocion?.title,
          logoUrl: c.detallePromocion?.logoUrl,
          rating: c.detallePromocion?.rating,
          scheduleLabel: c.detallePromocion?.scheduleLabel,
        }));

      // Paso 6: Respuesta
      return {
        cupon: {
          secuencial: cupon.secuencial,
          estado: cupon.estado,
          numeroDeEscaneos: Number(cupon.numeroDeEscaneos ?? 0),
          fechaActivacion: cupon.fechaActivacion
            ? new Date(cupon.fechaActivacion).toISOString()
            : null,
          fechaVencimiento: cupon.fechaVencimiento
            ? new Date(cupon.fechaVencimiento).toISOString()
            : null,
          ultimoScaneo: cupon.ultimoScaneo
            ? new Date(cupon.ultimoScaneo).toISOString()
            : null,
        },
        version: {
          nombre: version.nombre,
          estado: !!version.estado,
          ciudadesDisponibles: ciudadesVersionNombres,
          numeroDeLocales: version.numeroDeLocales,
          descripcion: version.descripcion,
        },
        candidatosTotal: candidatos.length,
        lugaresScaneados: lugaresScaneados.sort(
          (a, b) =>
            (b.lastScan ? Date.parse(b.lastScan) : 0) -
            (a.lastScan ? Date.parse(a.lastScan) : 0),
        ),
        lugaresSinScannear,
        totalLugaresScaneados: lugaresScaneados.length,
        totalEscaneos,
      };
    } catch (err) {
      this.logger.error(
        `[obtenerDetalleCupon] ERROR: ${err?.message}`,
        err?.stack,
      );
      throw err;
    }
  }
}
