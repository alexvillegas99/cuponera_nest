import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cupon, CuponSchema } from 'src/cupon/schemas/cupon.schema';
import { NotificacionesModule } from 'src/notificaciones/notificaciones.module';
import { TareasCronService } from './tareas-cron.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cupon.name, schema: CuponSchema }]),
    NotificacionesModule,
  ],
  providers: [TareasCronService],
})
export class TareasCronModule {}
