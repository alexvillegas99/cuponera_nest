import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import {
  HistoricoCupon,
  HistoricoCuponSchema,
} from '../historico-cupon/schemas/historico-cupon.schema';
import { Usuario, UsuarioSchema } from '../usuarios/schema/usuario.schema';
import { Cliente, ClienteSchema } from '../clientes/schema/cliente.schema';
import { Pago, PagoSchema } from '../pagos/schema/pago.schema';
import {
  SolicitudCuponera,
  SolicitudCuponeraSchema,
} from '../solicitud-cuponera/schema/solicitud-cuponera.schema';
import {
  PromocionFlash,
  PromocionFlashSchema,
} from '../promociones-flash/schema/promocion-flash.schema';
import {
  HistoricoFlash,
  HistoricoFlashSchema,
} from '../promociones-flash/schema/historico-flash.schema';
import { Cupon, CuponSchema } from '../cupon/schemas/cupon.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HistoricoCupon.name, schema: HistoricoCuponSchema },
      { name: Usuario.name, schema: UsuarioSchema },
      { name: Cliente.name, schema: ClienteSchema },
      { name: Pago.name, schema: PagoSchema },
      { name: SolicitudCuponera.name, schema: SolicitudCuponeraSchema },
      { name: PromocionFlash.name, schema: PromocionFlashSchema },
      { name: HistoricoFlash.name, schema: HistoricoFlashSchema },
      { name: Cupon.name, schema: CuponSchema },
    ]),
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}
