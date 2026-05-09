import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  HistorialEstablecimiento,
  HistorialEstablecimientoSchema,
} from './schema/historial-establecimiento.schema';
import { HistorialEstablecimientosService } from './historial-establecimientos.service';
import { HistorialEstablecimientosController } from './historial-establecimientos.controller';
import { UsuariosModule } from 'src/usuarios/usuarios.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: HistorialEstablecimiento.name,
        schema: HistorialEstablecimientoSchema,
      },
    ]),
    UsuariosModule,
  ],
  controllers: [HistorialEstablecimientosController],
  providers: [HistorialEstablecimientosService],
  exports: [HistorialEstablecimientosService],
})
export class HistorialEstablecimientosModule {}
