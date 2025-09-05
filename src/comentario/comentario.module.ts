import { Module } from '@nestjs/common';
import { ComentarioService } from './comentario.service';
import { ComentarioController } from './comentario.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Comentario, ComentarioSchema } from './schema/comentario.schema';
import { Usuario, UsuarioSchema } from 'src/usuarios/schema/usuario.schema';

@Module({
     imports: [
    MongooseModule.forFeature([
      { name: Comentario.name, schema: ComentarioSchema },
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
  ],

  controllers: [ComentarioController],
  providers: [ComentarioService],
})
export class ComentarioModule {}
