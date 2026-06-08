import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SolicitudCuponera, SolicitudCuponeraSchema } from './schema/solicitud-cuponera.schema';
import { SolicitudCuponeraService } from './solicitud-cuponera.service';
import { SolicitudCuponeraController } from './solicitud-cuponera.controller';
import { S3Module } from '../amazon-s3/amazon-s3.module';
import { CuponModule } from '../cupon/cupon.module';
import { VersionCuponeraModule } from '../version-cuponera/version-cuponera.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { ClientesModule } from '../clientes/clientes.module';
import { MailModule } from '../mail/mail.module';
import { ConfiguracionModule } from '../configuracion/configuracion.module';
import { Usuario, UsuarioSchema } from '../usuarios/schema/usuario.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SolicitudCuponera.name, schema: SolicitudCuponeraSchema },
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
    S3Module,
    CuponModule,
    VersionCuponeraModule,
    NotificacionesModule,
    ClientesModule,
    MailModule,
    ConfiguracionModule,
  ],
  controllers: [SolicitudCuponeraController],
  providers: [SolicitudCuponeraService],
  exports: [SolicitudCuponeraService],
})
export class SolicitudCuponeraModule {}
