import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CampanasController } from './campanas.controller';
import { CampanasService } from './campanas.service';
import { Campana, CampanaSchema } from './schema/campana.schema';
import {
  CampanaEntrega,
  CampanaEntregaSchema,
} from './schema/campana-entrega.schema';
import { Cliente, ClienteSchema } from '../clientes/schema/cliente.schema';
import {
  Provincia,
  ProvinciaSchema,
} from '../provincia/schema/provincia.schema';
import { Ciudad, CiudadSchema } from '../ciudad/schema/ciudad.schema';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Campana.name, schema: CampanaSchema },
      { name: CampanaEntrega.name, schema: CampanaEntregaSchema },
      { name: Cliente.name, schema: ClienteSchema },
      { name: Provincia.name, schema: ProvinciaSchema },
      { name: Ciudad.name, schema: CiudadSchema },
    ]),
    NotificacionesModule,
  ],
  controllers: [CampanasController],
  providers: [CampanasService],
  exports: [CampanasService],
})
export class CampanasModule {}
