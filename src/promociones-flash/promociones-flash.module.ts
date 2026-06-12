import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromocionesFlashController } from './promociones-flash.controller';
import { PromocionesFlashService } from './promociones-flash.service';
import {
  PromocionFlash,
  PromocionFlashSchema,
} from './schema/promocion-flash.schema';
import {
  HistoricoFlash,
  HistoricoFlashSchema,
} from './schema/historico-flash.schema';
import { Ciudad, CiudadSchema } from '../ciudad/schema/ciudad.schema';
import { S3Module } from '../amazon-s3/amazon-s3.module';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PromocionFlash.name, schema: PromocionFlashSchema },
      { name: HistoricoFlash.name, schema: HistoricoFlashSchema },
      { name: Ciudad.name, schema: CiudadSchema },
    ]),
    S3Module,
    UsuariosModule,
  ],
  controllers: [PromocionesFlashController],
  providers: [PromocionesFlashService],
  exports: [PromocionesFlashService],
})
export class PromocionesFlashModule {}
