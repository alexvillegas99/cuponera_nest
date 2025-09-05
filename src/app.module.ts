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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
