import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Auditoria, AuditoriaSchema } from './schema/auditoria.schema';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaController } from './auditoria.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Auditoria.name, schema: AuditoriaSchema },
    ]),
  ],
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
