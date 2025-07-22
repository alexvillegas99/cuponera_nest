import { Module } from '@nestjs/common';
import { CuponService } from './cupon.service';
import { CuponController } from './cupon.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Cupon, CuponSchema } from './schemas/cupon.schema';
import { VersionCuponeraModule } from 'src/version-cuponera/version-cuponera.module';
import { UsuariosModule } from 'src/usuarios/usuarios.module';
import { HistoricoCuponModule } from 'src/historico-cupon/historico-cupon.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cupon.name, schema: CuponSchema }]),
    VersionCuponeraModule,
    UsuariosModule,
  ],
  controllers: [CuponController],
  providers: [CuponService],
  exports: [CuponService],
})
export class CuponModule {}
