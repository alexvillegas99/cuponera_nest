import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
    private readonly cuponService: CuponService,
    private readonly versionService: VersionCuponeraService,
    private readonly _usuariosModel: UsuariosService,
  ) {}
  async registrarEscaneo(
    dto: CreateHistoricoCuponDto,
  ): Promise<HistoricoCupon> {
    const arrayUsuarios = await this.obtenerIdsUsuariosRelacionados(
      dto.usuario,
    );

    const historicoExistente = await this.historicoModel.findOne({
      cupon: dto.cupon,
      usuario: { $in: arrayUsuarios },
    });
    if (historicoExistente) {
      throw new BadRequestException(
        'El usuario ya ha escaneado este cupón anteriormente',
      );
    }

    const cupon = await this.cuponService.findById(dto.cupon);

    // Validación de estado
    const estadoInvalido = this.validarEstadoCupon(cupon);
    if (estadoInvalido) {
      throw new BadRequestException(estadoInvalido.message);
    }

    const version = await this.versionService.findById(
      cupon.version._id.toString(),
    );

    if (cupon.numeroDeEscaneos >= version.numeroDeLocales) {
      throw new BadRequestException(
        'Este cupón ya alcanzó el número máximo de escaneos permitidos',
      );
    }

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
  async buscarPorFechasEcuador(
    fechaInicio: Date,
    fechaFin: Date,
    secuencial?: number,
  ) {
    // Ajuste a zona horaria UTC-5
    const inicio = new Date(fechaInicio);
    inicio.setUTCHours(5, 0, 0, 0); // 00:00 hora local

    const fin = new Date(fechaFin);
    fin.setUTCHours(28, 59, 59, 999); // 23:59:59 en hora local (28 = 23 + 5 de UTC offset)

    return this.historicoModel
      .find({
        fechaEscaneo: {
          $gte: inicio,
          $lte: fin,
        },
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

      .sort({ fechaEscaneo: -1 })
      .exec();
  }

  async buscarPorIdDeUsuario(id: string) {
    //validar si el rol del usuario.

    const user: any = await this._usuariosModel.findById(id);
    console.log('Usuario encontrado:', user);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    //si el rol de usuario es staff, buscar el usuario responsable de crear el usuario.
    let idsUsuarios: any;
    if (user.rol !== 'staff') {
      //buscar todos los usuarios que fueron crados por el usuario responsable.
      const usuarios =
        await this._usuariosModel.buscarTodosLosUsuariosPorResponsable(
          user._id,
        );
      console.log('Usuarios encontrados:', usuarios);
      //obtener solo los ids de los usuarios.
      idsUsuarios = usuarios.map((u) => u._id);
      idsUsuarios.push(user._id); //agregar el usuario actual
    } else {
      //buscar todos los usuarios que fueron crados por el usuario responsable.
      const usuarios =
        await this._usuariosModel.buscarTodosLosUsuariosPorResponsable(
          user.usuarioCreacion,
        );
      console.log('Usuarios encontrados:', usuarios);
      //obtener solo los ids de los usuarios.
      idsUsuarios = usuarios.map((u) => u._id);
      idsUsuarios = [user._id];
    }

    //hacer cast de objetId a string
    idsUsuarios = idsUsuarios.map((id) => id.toString());
    console.log('IDs de usuarios a buscar:', idsUsuarios);
    const cupones = await this.historicoModel
      .find({ usuario: { $in: idsUsuarios } })
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
      .sort({ fechaEscaneo: -1 })
      .exec();

    if (cupones.length === 0) {
      throw new NotFoundException(
        'No se encontraron cupones para este usuario',
      );
    }
    return cupones;
  }

  async validarCuponPorId(body: { id: string; usuarioId: string }) {
    const { id, usuarioId } = body;

    const arrayUsuarios = await this.obtenerIdsUsuariosRelacionados(usuarioId);

    const cupon = await this.cuponService.findById(id);
    const estadoInvalido = this.validarEstadoCupon(cupon);
    if (estadoInvalido) return estadoInvalido;

    const historicoExistente = await this.historicoModel.findOne({
      cupon: id,
      usuario: { $in: arrayUsuarios },
    }).lean();

    if (historicoExistente) {
      return {
        ...cupon,
        valido: false,
        message: 'El usuario ya ha escaneado este cupón anteriormente',
      };
    }

    return {
      ...cupon,
      valido: true,
      message: 'Cupón válido para registro',
    };
  }

  private async obtenerIdsUsuariosRelacionados(
    usuarioId: string,
  ): Promise<string[]> {
    const user: any = await this._usuariosModel.findById(usuarioId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    let usuarios: any[];

    if (user.rol !== 'staff') {
      usuarios = await this._usuariosModel.buscarTodosLosUsuariosPorResponsable(
        user._id,
      );
      usuarios.push(user);
    } else {
      usuarios = await this._usuariosModel.buscarTodosLosUsuariosPorResponsable(
        user.usuarioCreacion,
      );
      usuarios.push({ _id: user.usuarioCreacion });
    }

    return usuarios.map((u) => u._id.toString());
  }

  private validarEstadoCupon(cupon: any) {
    if (cupon.estado === EstadoCupon.INACTIVO) {
      return {
        ...cupon,
        valido: false,
        message: 'El cupón está inactivo y no puede ser registrado',
      };
    }

    if (cupon.estado === EstadoCupon.BLOQUEADO) {
      return {
        ...cupon,
        valido: false,
        message: 'El cupón está bloqueado y no puede ser registrado',
      };
    }

    if (cupon.fechaVencimiento < new Date()) {
      return {
        ...cupon,
        valido: false,
        message: 'El cupón ha vencido y no puede ser registrado',
      };
    }

    return null; // significa que pasó todas las validaciones
  }

  async buscarPorIdDeUsuarioFechas(body: {
    id: string;
    fechaInicio: string;
    fechaFin: string;
  }) {
    console.log('Buscar cupones por usuario y fechas:', body);
    
    // Ajuste a zona horaria UTC-5
    const inicio = new Date(body.fechaInicio);
    inicio.setUTCHours(5, 0, 0, 0); // 00:00 hora local

    const fin = new Date(body.fechaFin);
    fin.setUTCHours(28, 59, 59, 999); // 23:59:59 en hora local (28 = 23 + 5 de UTC offset)

    const arrayUsuarios = await this.obtenerIdsUsuariosRelacionados(body.id);

    return this.historicoModel
      .find({
        fechaEscaneo: {
          $gte: inicio,
          $lte: fin,
        },
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
}
