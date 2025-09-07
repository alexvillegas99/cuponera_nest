import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Cliente, ClienteSchema } from './schema/cliente.schema';
import { Ciudad, CiudadSchema } from 'src/ciudad/schema/ciudad.schema';
import { Cupon, CuponSchema } from 'src/cupon/schemas/cupon.schema';
import { Favorite, FavoriteSchema } from 'src/favorite/schema/favorite.schema';
import { HistoricoCupon, HistoricoCuponSchema } from 'src/historico-cupon/schemas/historico-cupon.schema';
import { VersionCuponera, VersionCuponeraSchema } from 'src/version-cuponera/schemas/version-cuponera.schema';

@Module({
  imports: [
    MongooseModule.forFeature([ { name: Cliente.name, schema: ClienteSchema },
      { name: Cupon.name, schema: CuponSchema },
      { name: VersionCuponera.name, schema: VersionCuponeraSchema },
      { name: Ciudad.name, schema: CiudadSchema },
      { name: HistoricoCupon.name, schema: HistoricoCuponSchema },
      // Comenta esta línea si aún no tienes la colección de favoritos:
      { name: Favorite.name, schema: FavoriteSchema },]),
  ],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports:[ClientesService]
})
export class ClientesModule {}
