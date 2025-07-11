import { Module } from '@nestjs/common';
import { HistoricoCuponService } from './historico-cupon.service';
import { HistoricoCuponController } from './historico-cupon.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  HistoricoCupon,
  HistoricoCuponSchema,
} from './schemas/historico-cupon.schema';
import { CuponModule } from 'src/cupon/cupon.module';
import { UsuariosModule } from 'src/usuarios/usuarios.module';
import { VersionCuponeraModule } from 'src/version-cuponera/version-cuponera.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HistoricoCupon.name, schema: HistoricoCuponSchema },
    ]),
    CuponModule,
    UsuariosModule,
    VersionCuponeraModule
  ],
  controllers: [HistoricoCuponController],
  providers: [HistoricoCuponService],
  exports: [HistoricoCuponService],
})
export class HistoricoCuponModule {}
