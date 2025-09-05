import { Module } from '@nestjs/common';
import { CategoriaService } from './categoria.service';
import { CategoriaController } from './categoria.controller';
import { Categoria, CategoriaSchema } from './schema/categoria.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
   imports: [
      MongooseModule.forFeature([{ name: Categoria.name, schema: CategoriaSchema }]),
    ],
  controllers: [CategoriaController],
  providers: [CategoriaService],
})
export class CategoriaModule {}
