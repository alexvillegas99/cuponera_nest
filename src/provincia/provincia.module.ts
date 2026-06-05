import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProvinciaController } from './provincia.controller';
import { ProvinciaService } from './provincia.service';
import { Provincia, ProvinciaSchema } from './schema/provincia.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Provincia.name, schema: ProvinciaSchema },
    ]),
  ],
  controllers: [ProvinciaController],
  providers: [ProvinciaService],
  exports: [ProvinciaService],
})
export class ProvinciaModule {}
