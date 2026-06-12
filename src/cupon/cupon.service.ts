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
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';
import { ClientesService } from 'src/clientes/clientes.service';

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
    private readonly _notificaciones: NotificacionesService,
    private readonly _clientesService: ClientesService,
  ) {}
  private readonly logger = new Logger(CuponService.name);
  /**
   * Crear un nuevo cupón
   */
  async create(dto: any): Promise<any> {
    // 4. Validar fechas si vienen
    if (dto.fechaActivacion && dto.fechaVencimiento) {
      const fechaActivacion = new Date(dto.fechaActivacion);
      const fechaVencimiento = new Date(dto.fechaVencimiento);

      if (fechaActivacion >= fechaVencimiento) {
        throw new BadRequestException(
          'La fecha de vencimiento debe ser posterior a la de activación',
        );
      }
    }

    // 5. Calcular secuencial si no viene
    let secuencial;
    const ultimoCupon = await this._cuponModel
      .findOne({ version: new Types.ObjectId(dto.version) })
      .sort({ secuencial: -1 })
      .select('secuencial')
      .lean();

    secuencial = ultimoCupon ? ultimoCupon.secuencial + 1 : 1;

    const fechaActivacion = new Date();
    const fechaVencimiento = new Date(fechaActivacion);
    fechaVencimiento.setFullYear(fechaVencimiento.getFullYear() + 1);
    // 6. Establecer valores por defecto
    const esRegalo = dto.esRegalo === true;
    const cuponData = {
      version: new Types.ObjectId(dto.version),
      cliente: new Types.ObjectId(dto.cliente),
      usuarioActivador: dto.usuarioActivador
        ? new Types.ObjectId(dto.usuarioActivador)
        : undefined,
      secuencial,
      estado: EstadoCupon.ACTIVO,
      numeroDeEscaneos: 0,
      fechaActivacion,
      fechaVencimiento,
      ultimoScaneo: null,
      // Regalo
      esRegalo,
      regaloAbierto: esRegalo ? dto.regaloAbierto === true : true,
      regaloDe: esRegalo ? (dto.regaloDe ?? null) : null,
      regaloMensaje: esRegalo ? (dto.regaloMensaje ?? null) : null,
      compradorId: dto.compradorId
        ? new Types.ObjectId(dto.compradorId)
        : undefined,
    };

    // 7. Crear el cupón
    const cupon = new this._cuponModel(cuponData);
    await cupon.save();

    // 8. Retornar el cupón creado con populate
    // 9. Retornar el cupón creado con populate
    return this._cuponModel
      .findById(cupon._id)
      .populate([
        { path: 'version', select: 'nombre estado precio' },
        { path: 'cliente', select: 'nombres apellidos email identificacion' },
        { path: 'usuarioActivador', select: 'nombre email' },
      ])
      .lean();
  }

  async findAll(
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ data: Cupon[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;

    // 🔎 condiciones OR globales (planas)
    const orConditions: any[] = [];

    if (search) {
      // campos del cupón
      orConditions.push(
        { secuencial: Number(search) || -1 },
        { estado: { $regex: search, $options: 'i' } },
      );

      // campos del cliente
      orConditions.push(
        { 'cliente.nombres': { $regex: search, $options: 'i' } },
        { 'cliente.apellidos': { $regex: search, $options: 'i' } },
        { 'cliente.identificacion': { $regex: search, $options: 'i' } },
        { 'cliente.email': { $regex: search, $options: 'i' } },
      );
    }

    const pipeline: any[] = [
      // 🔗 JOIN cliente
      {
        $lookup: {
          from: 'clientes',
          localField: 'cliente',
          foreignField: '_id',
          as: 'cliente',
        },
      },
      {
        $unwind: {
          path: '$cliente',
          preserveNullAndEmptyArrays: true,
        },
      },

      // 🔎 MATCH GLOBAL
      ...(search ? [{ $match: { $or: orConditions } }] : []),

      // 🔗 JOIN usuario activador
      {
        $lookup: {
          from: 'usuarios',
          localField: 'usuarioActivador',
          foreignField: '_id',
          as: 'usuarioActivador',
        },
      },
      {
        $unwind: {
          path: '$usuarioActivador',
          preserveNullAndEmptyArrays: true,
        },
      },

      // 📄 ORDEN (opcional, recomendado)
      { $sort: { updatedAt: -1 } },

      // 📊 PAGINACIÓN
      { $skip: skip },
      { $limit: limit },
    ];

    // 🧮 TOTAL CORRECTO (sin skip/limit)
    const totalPipeline = pipeline.filter(
      (stage) => !('$skip' in stage) && !('$limit' in stage),
    );

    const [data, totalArr] = await Promise.all([
      this._cuponModel.aggregate(pipeline),
      this._cuponModel.aggregate([...totalPipeline, { $count: 'total' }]),
    ]);

    return {
      data,
      total: totalArr[0]?.total ?? 0,
      page,
      limit,
    };
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
      .populate('version', 'nombre descripcion precio')
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
          esRegalo: c?.esRegalo === true,
          regaloAbierto: c?.esRegalo === true ? c?.regaloAbierto === true : true,
          regaloDe: c?.regaloDe ?? null,
          regaloMensaje: c?.regaloMensaje ?? null,
        };
      }),
    );

    return result;
  }

  /**
   * Versión paginada de las cuponeras del cliente (endpoint nuevo, aditivo):
   * soloActivas, q (nombre de la cuponera), page/limit.
   */
  async obtenerCuponerasPorClientePaginado(params: {
    clienteId: string;
    soloActivas?: boolean;
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    if (!Types.ObjectId.isValid(params.clienteId)) {
      throw new BadRequestException('clienteId inválido');
    }
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 30));

    const match: any = { cliente: new Types.ObjectId(params.clienteId) };
    if (params.soloActivas !== false) match.estado = EstadoCupon.ACTIVO;

    let docs = await this._cuponModel
      .find(match)
      .populate('version', 'nombre descripcion precio')
      .sort({ createdAt: -1 })
      .lean();

    // Búsqueda por nombre de la cuponera (la versión es populate → en memoria).
    if (params.q && params.q.trim() !== '') {
      const rx = params.q.trim().toLowerCase();
      docs = docs.filter((c: any) =>
        (c?.version?.nombre ?? '').toLowerCase().includes(rx),
      );
    }

    const total = docs.length;
    const pageDocs = docs.slice((page - 1) * limit, page * limit);
    const data = pageDocs.map((c: any) => {
      const codigo = String(c._id);
      return {
        _id: codigo,
        nombre: c?.version?.nombre ?? 'Cuponera',
        descripcion: c?.version?.descripcion ?? '',
        ultimoScaneo: c?.ultimoScaneo ?? null,
        codigo,
        emitidaEl: c?.fechaActivacion ?? c?.createdAt ?? new Date(),
        expiraEl: c?.fechaVencimiento ?? null,
        qrData: codigo,
        totalEscaneos: Number(c?.numeroDeEscaneos ?? 0),
        secuencial: c.secuencial,
        esRegalo: c?.esRegalo === true,
        regaloAbierto: c?.esRegalo === true ? c?.regaloAbierto === true : true,
        regaloDe: c?.regaloDe ?? null,
        regaloMensaje: c?.regaloMensaje ?? null,
      };
    });

    return { data, total, page, limit, hasMore: page * limit < total };
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

    // Notificar al cliente su nueva membresía (best-effort, no bloquea).
    try {
      const token = await this._clientesService.obtenerFcmToken(clienteId);
      await this._notificaciones.enviarAToken(
        token,
        '¡Tienes una nueva membresía! 🎉',
        'Se asignó una cuponera a tu cuenta. ¡Ya puedes usarla!',
      );
    } catch (e: any) {
      this.logger.error(`Error notificando asignación: ${e?.message}`);
    }

    return { ok: true, cuponId: String(cupon._id) };
  }

  // 🎁 El destinatario abre su regalo: marca regaloAbierto=true.
  async abrirRegalo(cuponId: string, clienteId: string) {
    if (
      !Types.ObjectId.isValid(cuponId) ||
      !Types.ObjectId.isValid(clienteId)
    ) {
      throw new BadRequestException('cuponId o clienteId inválido');
    }
    const cupon = await this._cuponModel.findOne({
      _id: new Types.ObjectId(cuponId),
      cliente: new Types.ObjectId(clienteId),
      esRegalo: true,
    });
    if (!cupon) throw new NotFoundException('Regalo no encontrado');
    const yaEstabaAbierto = cupon.regaloAbierto === true;
    if (!yaEstabaAbierto) {
      cupon.regaloAbierto = true;
      await cupon.save();
      // Avisar al comprador que su regalo fue abierto (best-effort).
      this._notificarCompradorRegaloAbierto(cupon, clienteId).catch((e) =>
        this.logger.error(`Error notificando apertura de regalo: ${e?.message}`),
      );
    }
    return { ok: true, cuponId: String(cupon._id) };
  }

  /** Push al comprador cuando el destinatario abre su regalo. */
  private async _notificarCompradorRegaloAbierto(
    cupon: any,
    destinatarioId: string,
  ) {
    const compradorId = cupon.compradorId?.toString();
    if (!compradorId) return;
    let nombreDest = 'Tu destinatario';
    try {
      const dest = await this._clientesService.findById(destinatarioId);
      const n = [(dest as any)?.nombres, (dest as any)?.apellidos]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (n) nombreDest = n;
    } catch (_) {
      // sin nombre → usa genérico
    }
    try {
      const token = await this._clientesService.obtenerFcmToken(compradorId);
      if (token) {
        await this._notificaciones.enviarAToken(
          token,
          '¡Tu regalo fue abierto! 🎁',
          `${nombreDest} ya abrió el regalo que le enviaste. ¡Gracias por compartir Enjoy!`,
        );
      }
    } catch (e: any) {
      this.logger.error(`Error push comprador regalo: ${e?.message}`);
    }
  }

  // ✅ Listar cupones asignados a un cliente (tus “cuponeras”)
  async obtenerCuponesPorCliente(clienteId: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(clienteId)) {
      throw new BadRequestException('clienteId inválido');
    }

    const cupones = await this._cuponModel
      .find({ cliente: new Types.ObjectId(clienteId) })
      .populate('version', 'nombre precio') // trae el nombre de la versión
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
        versionId: c?.version?._id ? String(c.version._id) : null,
        codigo,
        emitidaEl,
        expiraEl,
        qrData: codigo,
        totalEscaneos: Number(c?.numeroDeEscaneos ?? 0),
        scans: [],
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
            'nombre estado ciudadesDisponibles descripcion precio',
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

      // Ciudades de la versión EXPANDIENDO provincias completas (provinciasDisponibles).
      const ciudadesVersionIds: Types.ObjectId[] =
        await this._versionModel.ciudadIdsDeVersion(String(version._id));

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
          _id: version._id ? String(version._id) : null,
          nombre: version.nombre,
          estado: !!version.estado,
          ciudadesDisponibles: ciudadesVersionNombres,
          totalLocales: candidatos.length,
          descripcion: version.descripcion,
          precio: version.precio,
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

  /**
   * Busca cupones activos de un cliente que pueden canjearse en un local específico.
   * Empata por ciudades de la versión vs ciudades del local.
   * Excluye cupones ya escaneados en ese local.
   */
  async findDisponiblesParaLocal(
    clienteId: string,
    usuarioId: string,
  ): Promise<any[]> {
    // 1) Obtener ciudades del local
    const local = await this._usuarioModel.findById(usuarioId).lean();
    if (!local) throw new NotFoundException('Local no encontrado');
    const ciudadesLocal = (local.ciudades || []).map((c: any) => c.toString());

    if (ciudadesLocal.length === 0) return [];

    // 2) Obtener cupones activos del cliente
    const cupones = await this._cuponModel
      .find({
        cliente: new Types.ObjectId(clienteId),
        estado: EstadoCupon.ACTIVO,
      })
      .populate('version', 'nombre ciudadesDisponibles precio')
      .lean();

    // 3) Obtener histórico de escaneos en este local.
    //    El escaneo puede haberlo hecho el admin-local o cualquiera de su staff
    //    (el histórico se guarda con el id de quien escaneó). Para que el filtro
    //    coincida con el anti-duplicado de registrarEscaneo, consideramos a todo
    //    el grupo del local: admin-local + sus usuarios staff.
    const adminLocal = await this._usuariosModel.getAdminLocalRaw(usuarioId);
    const staffLocal =
      await this._usuariosModel.buscarTodosLosUsuariosPorResponsable(
        String(adminLocal._id),
      );
    const idsLocal = [
      new Types.ObjectId(String(adminLocal._id)),
      ...staffLocal.map((u: any) => new Types.ObjectId(String(u._id))),
    ];

    const historicos = await this._historicoModel
      .find({ usuario: { $in: idsLocal } })
      .select('cupon')
      .lean();
    const cuponesYaEscaneados = new Set(
      historicos.map((h: any) => h.cupon.toString()),
    );

    // 4) Filtrar cupones cuya versión comparte ciudad con el local y no fueron escaneados ahí
    return cupones.filter((cupon: any) => {
      if (!cupon.version) return false;

      // Ya escaneado en este local
      if (cuponesYaEscaneados.has(cupon._id.toString())) return false;

      // Empate por ciudades
      const ciudadesVersion = (cupon.version.ciudadesDisponibles || []).map(
        (c: any) => c.toString(),
      );
      return ciudadesVersion.some((c: string) => ciudadesLocal.includes(c));
    });
  }

  /**
   * Ids de locales donde el cliente tiene al menos un cupón disponible para
   * canjear (sin canjear en ese grupo de local). Para el filtro "solo con
   * cupón disponible" del home.
   */
  async findLocalesDisponibles(clienteId: string): Promise<string[]> {
    const cupones = await this._cuponModel
      .find({
        cliente: new Types.ObjectId(clienteId),
        estado: EstadoCupon.ACTIVO,
      })
      .populate('version', 'ciudadesDisponibles')
      .lean();
    if (!cupones.length) return [];

    const cuponCities = new Set<string>();
    for (const c of cupones as any[]) {
      for (const cid of c.version?.ciudadesDisponibles ?? []) {
        cuponCities.add(String(cid));
      }
    }
    if (!cuponCities.size) return [];

    const candidatos = await this._usuarioModel
      .find({
        detallePromocion: { $exists: true, $ne: null },
        estado: true,
        ciudades: {
          $in: Array.from(cuponCities).map((id) => new Types.ObjectId(id)),
        },
      })
      .select('_id')
      .lean();

    const disponibles: string[] = [];
    for (const local of candidatos as any[]) {
      const disp = await this.findDisponiblesParaLocal(
        clienteId,
        String(local._id),
      );
      if (disp.length > 0) disponibles.push(String(local._id));
    }
    return disponibles;
  }
}
