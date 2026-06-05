import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import configuration from '../../config/config.env';
import { DatabaseModule } from '../../database/database.module';
import {
  Categoria,
  CategoriaDocument,
  CategoriaSchema,
} from '../schema/categoria.schema';
import { CATEGORIAS_SEED } from './categorias.data';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    MongooseModule.forFeature([
      { name: Categoria.name, schema: CategoriaSchema },
    ]),
  ],
})
class SeedModule {}

async function run() {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn', 'log'],
  });

  const model = app.get<Model<CategoriaDocument>>(
    getModelToken(Categoria.name),
  );

  let inserted = 0;
  let iconFilled = 0;
  let skipped = 0;

  for (const cat of CATEGORIAS_SEED) {
    const existing = await model.findOne({ nombre: cat.nombre }).lean();

    if (!existing) {
      await model.create({
        nombre: cat.nombre,
        icono: cat.icono,
        descripcion: cat.descripcion,
        estado: cat.estado ?? true,
      });
      inserted++;
    } else if (!existing.icono || existing.icono.trim() === '') {
      await model.updateOne(
        { _id: existing._id },
        { $set: { icono: cat.icono } },
      );
      iconFilled++;
    } else {
      skipped++;
    }
  }

  console.log(
    `\nSeed categorías terminado.  Insertadas: ${inserted}  |  Ícono actualizado: ${iconFilled}  |  Sin cambios: ${skipped}  |  Total: ${CATEGORIAS_SEED.length}`,
  );

  await app.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error en seed de categorías:', err);
  process.exit(1);
});
