import { Module } from '@nestjs/common';
import { CiudadService } from './ciudad.service';
import { CiudadController } from './ciudad.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Ciudad, CiudadSchema } from './schema/ciudad.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Ciudad.name, schema: CiudadSchema }]),
  ],
  controllers: [CiudadController],
  providers: [CiudadService],
})
export class CiudadModule {}
