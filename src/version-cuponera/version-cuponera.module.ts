import { Module } from '@nestjs/common';
import { VersionCuponeraService } from './version-cuponera.service';
import { VersionCuponeraController } from './version-cuponera.controller';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { VersionCuponera, VersionCuponeraSchema } from './schemas/version-cuponera.schema';
import { UsuariosModule } from 'src/usuarios/usuarios.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VersionCuponera.name, schema: VersionCuponeraSchema },
    ]),
    UsuariosModule,
  ],
  controllers: [VersionCuponeraController],
  providers: [VersionCuponeraService],
  exports: [VersionCuponeraService],
})
export class VersionCuponeraModule {}
