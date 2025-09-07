import { Module } from '@nestjs/common';
import { ComentarioService } from './comentario.service';
import { ComentarioController } from './comentario.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Comentario, ComentarioSchema } from './schema/comentario.schema';
import { Usuario, UsuarioSchema } from 'src/usuarios/schema/usuario.schema';
import { HistoricoCupon, HistoricoCuponSchema } from 'src/historico-cupon/schemas/historico-cupon.schema';
import { VersionCuponera, VersionCuponeraSchema } from 'src/version-cuponera/schemas/version-cuponera.schema';
import { Cupon, CuponSchema } from 'src/cupon/schemas/cupon.schema';

@Module({
     imports: [
    MongooseModule.forFeature([
      { name: Comentario.name, schema: ComentarioSchema },
      { name: Usuario.name, schema: UsuarioSchema },
      { name: HistoricoCupon.name, schema: HistoricoCuponSchema }, 
       { name: VersionCuponera.name, schema: VersionCuponeraSchema },
          { name: Cupon.name, schema: CuponSchema },
    ]),
  ],

  controllers: [ComentarioController],
  providers: [ComentarioService],
})
export class ComentarioModule {}
