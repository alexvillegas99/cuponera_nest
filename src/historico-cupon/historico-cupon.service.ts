import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import {
  HistoricoCupon,
  HistoricoCuponDocument,
} from './schemas/historico-cupon.schema';
import { CreateHistoricoCuponDto } from './dto/create-historico-cupon.dto';
import { CuponService } from 'src/cupon/cupon.service';
import { VersionCuponeraService } from 'src/version-cuponera/version-cuponera.service';
import { EstadoCupon } from 'src/cupon/enum/estados_cupon';
import { UsuariosService } from 'src/usuarios/usuarios.service';

@Injectable()
export class HistoricoCuponService {
  constructor(
    @InjectModel(HistoricoCupon.name)
    private readonly historicoModel: Model<HistoricoCuponDocument>,
     @Inject(forwardRef(() => CuponService))
        private readonly cuponService: CuponService,
    private readonly versionService: VersionCuponeraService,
    private readonly _usuariosModel: UsuariosService,
  ) {}

  // ===================== Helpers =====================

  /** Normaliza cualquier id u objeto a string */
  private asIdString(v: any): string | null {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (v._id) return String(v._id);
    if (v.toString) return String(v.toString());
    return null;
  }

  /** Devuelve el conjunto de strings de ObjectIds */
  private toIdSet(arr: any[]): Set<string> {
    return new Set((arr ?? []).map((x) => this.asIdString(x)).filter(Boolean) as string[]);
  }

  /** Valida que el admin-local y la versión compartan al menos una ciudad */
  private async assertMismaCiudad(usuarioId: string, versionId: string) {
    if (!isValidObjectId(usuarioId))
      throw new BadRequestException('ID de usuario inválido');
    if (!isValidObjectId(versionId))
      throw new BadRequestException('ID de versión inválido');

    // 1) Admin base (si STAFF → su usuarioCreacion; si no → él)
    const admin = await this._usuariosModel.getAdminLocalRaw(usuarioId);
    const adminCitiesSet = this.toIdSet(admin?.ciudades ?? []);
    if (!adminCitiesSet.size) {
      throw new BadRequestException(
        'El administrador del local no tiene ciudades asignadas',
      );
    }

    // 2) Versión RAW (ObjectIds)
    const versionRaw = await this.versionService.findByIdRaw(versionId);
    const versionCitiesSet = this.toIdSet(versionRaw?.ciudadesDisponibles ?? []);
    if (!versionCitiesSet.size) {
      throw new BadRequestException(
        'La versión de cuponera no tiene ciudades disponibles configuradas',
      );
    }

    // 3) Intersección
    const shareCity = [...adminCitiesSet].some((c) => versionCitiesSet.has(c));
    if (!shareCity) {
      throw new BadRequestException(
        'El administrador del local y la versión de la cuponera no comparten ninguna ciudad',
      );
    }
  }

  /** Reglas de estado del cupón */
  private validarEstadoCupon(cupon: any) {
    if (cupon.estado === EstadoCupon.INACTIVO) {
      return { ...cupon, valido: false, message: 'Cupón inactivo' };
    }
    if (cupon.estado === EstadoCupon.BLOQUEADO) {
      return { ...cupon, valido: false, message: 'Cupón bloqueado' };
    }
    if (cupon.fechaVencimiento && cupon.fechaVencimiento < new Date()) {
      return { ...cupon, valido: false, message: 'Cupón vencido' };
    }
    return null;
  }

  /** IDs (string) de usuarios que se consideran "mismo grupo" para control de repetición */
  private async obtenerIdsUsuariosRelacionados(usuarioId: string): Promise<string[]> {
    const user: any = await this._usuariosModel.findById(usuarioId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    let idsUsuarios: string[] = [];

    // Si NO es staff → incluye el usuario y todos los usuarios creados por él (responsable)
    if (String(user.rol).toLowerCase() !== 'staff') {
      const usuarios = await this._usuariosModel.buscarTodosLosUsuariosPorResponsable(
        user._id,
      );
      idsUsuarios = usuarios.map((u: any) => String(u._id));
      idsUsuarios.push(String(user._id));
    } else {
      // Si es staff → solo él (y opcionalmente podrías incluir creador, pero tu código original no lo hacía)
      idsUsuarios = [String(user._id)];
    }

    return idsUsuarios;
  }

  // ===================== Casos de uso =====================

  /** Registrar escaneo de cupón (con validación de ciudad común) */
  async registrarEscaneo(dto: CreateHistoricoCuponDto): Promise<HistoricoCupon> {
    const arrayUsuarios = await this.obtenerIdsUsuariosRelacionados(dto.usuario);

    // 1) Anti-duplicado por grupo de usuarios
    const historicoExistente = await this.historicoModel.findOne({
      cupon: dto.cupon,
      usuario: { $in: arrayUsuarios },
    });
    if (historicoExistente) {
      throw new BadRequestException(
        'El usuario ya ha escaneado este cupón anteriormente',
      );
    }

    // 2) Estado del cupón
    const cupon = await this.cuponService.findById(dto.cupon);
    const estadoInvalido = this.validarEstadoCupon(cupon);
    if (estadoInvalido) {
      throw new BadRequestException(estadoInvalido.message);
    }

    // 3) Validación de ciudad común (admin-local VS versión)
    const versionId =
      this.asIdString(cupon.version) || this.asIdString(cupon.version?._id);
    if (!versionId) {
      throw new BadRequestException(
        'El cupón no tiene una versión asociada válida',
      );
    }
    await this.assertMismaCiudad(dto.usuario, versionId);

    // 4) Límite de escaneos
  /*   const version = await this.versionService.findByIdRaw(versionId);
    if (Number(cupon.numeroDeEscaneos) >= Number(version.numeroDeLocales)) {
      throw new BadRequestException(
        'Este cupón ya alcanzó el número máximo de escaneos permitidos',
      );
    } */

      

    // 5) Registrar histórico + aumentar contador de cupón
    const historico = await this.historicoModel.create({
      cupon: dto.cupon,
      usuario: dto.usuario,
      fechaEscaneo: new Date(),
    });

    await this.cuponService.incrementarEscaneos(dto.cupon);

    return historico;
  }

  async findAll(): Promise<HistoricoCupon[]> {
    return this.historicoModel
      .find()
      .populate('cupon')
      .populate('usuario')
      .sort({ fechaEscaneo: -1 })
      .exec();
  }

  /** Consulta por fechas (UTC-5) con populate */
  async buscarPorFechasEcuador(
    fechaInicio: Date,
    fechaFin: Date,
    secuencial?: number,
  ) {
    const inicio = new Date(fechaInicio);
    inicio.setUTCHours(5, 0, 0, 0); // 00:00 hora local (Ecuador = UTC-5)

    const fin = new Date(fechaFin);
    fin.setUTCHours(28, 59, 59, 999); // 23:59:59 local (23 + 5 offset)

    const filter: any = {
      fechaEscaneo: { $gte: inicio, $lte: fin },
    };
    if (typeof secuencial === 'number') {
      // Si necesitas filtrar por secuencial del cupón, se hace vía pipeline o populate + match post-process.
      // Por simplicidad, se filtra después del populate abajo si llega "secuencial".
    }

    const result = await this.historicoModel
      .find(filter)
      .populate({
        path: 'cupon',
        select: 'estado fechaActivacion numeroDeEscaneos secuencial version',
        populate: {
          path: 'version',
          model: 'VersionCuponera',
        },
      })
      .populate({
        path: 'usuario',
        select: 'nombre email usuarioCreacion',
        populate: {
          path: 'usuarioCreacion',
          model: 'Usuario',
          select: 'nombre email',
        },
      })
      .sort({ fechaEscaneo: -1 })
      .lean()
      .exec();

    if (typeof secuencial === 'number') {
      return result.filter((r: any) => r?.cupon?.secuencial === secuencial);
    }
    return result;
  }

  /** Búsqueda por usuario considerando grupo (responsable vs staff) */
  async buscarPorIdDeUsuario(id: string) {
    const user: any = await this._usuariosModel.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    let idsUsuarios: string[];
    if (String(user.rol).toLowerCase() !== 'staff') {
      const usuarios =
        await this._usuariosModel.buscarTodosLosUsuariosPorResponsable(
          user._id,
        );
      idsUsuarios = usuarios.map((u) => String(u._id));
      idsUsuarios.push(String(user._id));
    } else {
      idsUsuarios = [String(user._id)];
    }

    const cupones = await this.historicoModel
      .find({ usuario: { $in: idsUsuarios } })
      .populate({
        path: 'usuario',
        select: 'nombre email usuarioCreacion',
        populate: {
          path: 'usuarioCreacion',
          model: 'Usuario',
          select: 'nombre email',
        },
      })
      .populate({
        path: 'cupon',
        select: 'estado fechaActivacion numeroDeEscaneos secuencial version',
        populate: {
          path: 'version',
          model: 'VersionCuponera',
        },
      })
      .sort({ fechaEscaneo: -1 })
      .exec();

    if (!cupones.length) {
      throw new NotFoundException('No se encontraron cupones para este usuario');
    }
    return cupones;
  }

  /** Dashboard: por usuario + fechas (con grupo y zona horaria) */
  async buscarPorIdDeUsuarioFechas(body: {
    id: string;
    fechaInicio: string;
    fechaFin: string;
  }) {
    const inicio = new Date(body.fechaInicio);
    inicio.setUTCHours(5, 0, 0, 0);

    const fin = new Date(body.fechaFin);
    fin.setUTCHours(28, 59, 59, 999);

    const arrayUsuarios = await this.obtenerIdsUsuariosRelacionados(body.id);

    return this.historicoModel
      .find({
        fechaEscaneo: { $gte: inicio, $lte: fin },
        usuario: { $in: arrayUsuarios },
      })
      .populate('cupon')
      .populate({
        path: 'usuario',
        select: 'nombre email usuarioCreacion',
        populate: {
          path: 'usuarioCreacion',
          model: 'Usuario',
          select: 'nombre email',
        },
      })
      .exec();
  }

  /** Validación rápida antes de registrar (con ciudad común) */
  async validarCuponPorId(body: { id: string; usuarioId: string }) {
    const { id, usuarioId } = body;

    const arrayUsuarios = await this.obtenerIdsUsuariosRelacionados(usuarioId);

    const cupon = await this.cuponService.findById(id);
    const estadoInvalido = this.validarEstadoCupon(cupon);
    if (estadoInvalido) return estadoInvalido;

    // Validación de ciudad común (admin-local VS versión)
    const versionId =
      this.asIdString(cupon.version) || this.asIdString(cupon.version?._id);
    if (!versionId) {
      return { ...cupon, valido: false, message: 'El cupón no tiene versión válida' };
    }
    await this.assertMismaCiudad(usuarioId, versionId);

    const historicoExistente = await this.historicoModel
      .findOne({ cupon: id, usuario: { $in: arrayUsuarios } })
      .lean();

    if (historicoExistente) {
      return { ...cupon, valido: false, message: 'Cupon ya registrado' };
    }

    return { ...cupon, valido: true, message: 'Cupón válido para registro' };
  }

   /**
   * Cuenta cuántos registros de histórico existen para un cupón.
   * @param cuponId ObjectId del cupón
   * @returns number (cantidad de escaneos)
   */
  async contarPorCupon(cuponId: string): Promise<number> {
    if (!isValidObjectId(cuponId)) {
      throw new BadRequestException('ID de cupón inválido');
    }

    const count = await this.historicoModel
      .countDocuments({ cupon: cuponId })
      .exec();

    return count;
  }
}
