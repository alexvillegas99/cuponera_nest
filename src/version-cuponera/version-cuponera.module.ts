import { Module } from '@nestjs/common';
import { VersionCuponeraService } from './version-cuponera.service';
import { VersionCuponeraController } from './version-cuponera.controller';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { VersionCuponera, VersionCuponeraSchema } from './schemas/version-cuponera.schema';
import { UsuariosModule } from 'src/usuarios/usuarios.module';
import { Ciudad, CiudadSchema } from 'src/ciudad/schema/ciudad.schema';
import { NotificacionesModule } from 'src/notificaciones/notificaciones.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VersionCuponera.name, schema: VersionCuponeraSchema },
      { name: Ciudad.name, schema: CiudadSchema },
    ]),
    UsuariosModule,
    NotificacionesModule,
  ],
  controllers: [VersionCuponeraController],
  providers: [VersionCuponeraService],
  exports: [VersionCuponeraService],
})
export class VersionCuponeraModule {}
