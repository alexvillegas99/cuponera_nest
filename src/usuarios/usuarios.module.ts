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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Usuario.name, schema: UsuarioSchema },
      { name: Comentario.name, schema: ComentarioSchema },
    ]),
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
