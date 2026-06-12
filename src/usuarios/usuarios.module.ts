import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Usuario, UsuarioSchema } from './schema/usuario.schema';
import { ComentarioModule } from 'src/comentario/comentario.module';
import {
  Comentario,
  ComentarioSchema,
} from 'src/comentario/schema/comentario.schema';
import { Ciudad, CiudadSchema } from 'src/ciudad/schema/ciudad.schema';
import { S3Module } from 'src/amazon-s3/amazon-s3.module';
import {
  PromocionFlash,
  PromocionFlashSchema,
} from 'src/promociones-flash/schema/promocion-flash.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Usuario.name, schema: UsuarioSchema },
      { name: Comentario.name, schema: ComentarioSchema },
      { name: Ciudad.name, schema: CiudadSchema },
      { name: PromocionFlash.name, schema: PromocionFlashSchema },
    ]),
    S3Module
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
