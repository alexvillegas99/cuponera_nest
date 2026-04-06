import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pago, PagoSchema } from './schema/pago.schema';
import { PagosService } from './pagos.service';
import { PagosController } from './pagos.controller';
import { ConfiguracionModule } from 'src/configuracion/configuracion.module';
import { SolicitudCuponeraModule } from 'src/solicitud-cuponera/solicitud-cuponera.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Pago.name, schema: PagoSchema }]),
    ConfiguracionModule,
    SolicitudCuponeraModule,
  ],
  controllers: [PagosController],
  providers: [PagosService],
  exports: [PagosService],
})
export class PagosModule {}
