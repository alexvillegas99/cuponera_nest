import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Compartido, CompartidoSchema } from './schemas/compartido.schema';
import { CompartidosController } from './compartido.controller';
import { CompartidosService } from './compartido.service';

@Module({
   imports: [
    MongooseModule.forFeature([{ name: Compartido.name, schema: CompartidoSchema }]),
  ],
  controllers: [CompartidosController],
  providers: [CompartidosService],
})
export class CompartidoModule {}
