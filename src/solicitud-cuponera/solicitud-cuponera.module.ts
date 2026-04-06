import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SolicitudCuponera, SolicitudCuponeraSchema } from './schema/solicitud-cuponera.schema';
import { SolicitudCuponeraService } from './solicitud-cuponera.service';
import { SolicitudCuponeraController } from './solicitud-cuponera.controller';
import { S3Module } from '../amazon-s3/amazon-s3.module';
import { CuponModule } from '../cupon/cupon.module';
import { VersionCuponeraModule } from '../version-cuponera/version-cuponera.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SolicitudCuponera.name, schema: SolicitudCuponeraSchema },
    ]),
    S3Module,
    CuponModule,
    VersionCuponeraModule,
  ],
  controllers: [SolicitudCuponeraController],
  providers: [SolicitudCuponeraService],
  exports: [SolicitudCuponeraService],
})
export class SolicitudCuponeraModule {}
