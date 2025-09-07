import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LogsModule } from './logs/logs.module';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/config.env';
import { DatabaseModule } from './database/database.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { VersionCuponeraModule } from './version-cuponera/version-cuponera.module';
import { CuponModule } from './cupon/cupon.module';
import { HistoricoCuponModule } from './historico-cupon/historico-cupon.module';
import { AuthModule } from './auth/auth.module';
import { CiudadModule } from './ciudad/ciudad.module';
import { CategoriaModule } from './categoria/categoria.module';
import { ComentarioModule } from './comentario/comentario.module';
import { ClientesModule } from './clientes/clientes.module';
import { FavoriteModule } from './favorite/favorite.module';
import { CompartidoModule } from './compartido/compartido.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { S3Module } from './amazon-s3/amazon-s3.module';
import { OtpModule } from './otp/otp.module';
import { MailService } from './mail/mail.service';
import { MailModule } from './mail/mail.module';
import { CommonModule } from './common/common.module';
import { IpDetailsModule } from './ip-details/ip-details.module';
import { EmpresasSolicitudesModule } from './empresas-solicitudes/empresas-solicitudes.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    LogsModule,
    UsuariosModule,
    VersionCuponeraModule,
    CuponModule,
    HistoricoCuponModule,
    AuthModule,
    CiudadModule,
    CategoriaModule,
    ComentarioModule,
    ClientesModule,
    FavoriteModule,
    CompartidoModule,
    NotificacionesModule,
    S3Module,
    OtpModule,
    MailModule,
    CommonModule,
    IpDetailsModule,
    EmpresasSolicitudesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
