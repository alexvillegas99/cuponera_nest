// src/empresas-solicitudes/empresas-solicitudes.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EmpresasSolicitudesService } from './empresas-solicitudes.service';
import { EmpresasSolicitudesController } from './empresas-solicitudes.controller';
import { EmpresaSolicitud, EmpresaSolicitudSchema } from './schema/empresa-solicitud.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmpresaSolicitud.name, schema: EmpresaSolicitudSchema },
    ]),
  ],
  controllers: [EmpresasSolicitudesController],
  providers: [EmpresasSolicitudesService],
  exports: [EmpresasSolicitudesService],
})
export class EmpresasSolicitudesModule {}
