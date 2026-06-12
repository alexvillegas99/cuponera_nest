import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cupon, CuponSchema } from 'src/cupon/schemas/cupon.schema';
import {
  HistoricoCupon,
  HistoricoCuponSchema,
} from 'src/historico-cupon/schemas/historico-cupon.schema';
import { NotificacionesModule } from 'src/notificaciones/notificaciones.module';
import { TareasCronService } from './tareas-cron.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cupon.name, schema: CuponSchema },
      { name: HistoricoCupon.name, schema: HistoricoCuponSchema },
    ]),
    NotificacionesModule,
  ],
  providers: [TareasCronService],
})
export class TareasCronModule {}
