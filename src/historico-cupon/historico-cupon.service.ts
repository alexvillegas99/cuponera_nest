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

@Injectable()
export class HistoricoCuponService {
  constructor(
    @InjectModel(HistoricoCupon.name)
    private readonly historicoModel: Model<HistoricoCuponDocument>,
    private readonly cuponService: CuponService,
    private readonly versionService: VersionCuponeraService,
  ) {}

  async registrarEscaneo(
    dto: CreateHistoricoCuponDto,
  ): Promise<HistoricoCupon> {
    const cupon = await this.cuponService.findById(dto.cupon);

    if (cupon.estado === EstadoCupon.INACTIVO) {
      throw new BadRequestException(
        'El cupón está inactivo y no puede ser escaneado',
      );
    }
    if (cupon.estado === EstadoCupon.BLOQUEADO) {
      throw new BadRequestException(
        'El cupón está bloqueado y no puede ser escaneado',
      );
    }

    if (cupon.fechaVencimiento < new Date()) {
      throw new BadRequestException(
        'El cupón ha vencido y no puede ser escaneado',
      );
    }
    console.log('Cupón encontrado:', cupon);
    const version = await this.versionService.findById(
      cupon.version._id.toString(),
    );
   
    if (cupon.numeroDeEscaneos >= version.numeroDeLocales) {
      throw new BadRequestException(
        'Este cupón ya alcanzó el número máximo de escaneos permitidos',
      );
    }

    // Registrar histórico
    const historico = await this.historicoModel.create({
      cupon: dto.cupon,
      usuario: dto.usuario,
      fechaEscaneo: new Date(),
    });

    // Aumentar escaneos en el cupón
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
}
