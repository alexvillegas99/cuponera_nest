// src/cupon/cupon.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CuponController } from './cupon.controller';
import { CuponService } from './cupon.service';

import { Cupon, CuponSchema } from './schemas/cupon.schema';

// ⬇️ importa los schemas reales
import { Usuario, UsuarioSchema } from 'src/usuarios/schema/usuario.schema';
import { HistoricoCupon, HistoricoCuponSchema } from 'src/historico-cupon/schemas/historico-cupon.schema';

import { VersionCuponeraModule } from 'src/version-cuponera/version-cuponera.module';
import { UsuariosModule } from 'src/usuarios/usuarios.module';
import { HistoricoCuponModule } from 'src/historico-cupon/historico-cupon.module';
import { NotificacionesModule } from 'src/notificaciones/notificaciones.module';
import { ClientesModule } from 'src/clientes/clientes.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cupon.name, schema: CuponSchema },
      { name: Usuario.name, schema: UsuarioSchema },          // 👈 necesario
      { name: HistoricoCupon.name, schema: HistoricoCuponSchema }, // 👈 necesario
    ]),
    VersionCuponeraModule,
    UsuariosModule,
    forwardRef(() => HistoricoCuponModule),
    NotificacionesModule,
    ClientesModule,
  ],
  controllers: [CuponController],
  providers: [CuponService],
  exports: [CuponService],
})
export class CuponModule {}
