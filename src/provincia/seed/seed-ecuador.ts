import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import configuration from '../../config/config.env';
import { DatabaseModule } from '../../database/database.module';
import {
  Provincia,
  ProvinciaDocument,
  ProvinciaSchema,
} from '../schema/provincia.schema';
import {
  Ciudad,
  CiudadDocument,
  CiudadSchema,
} from '../../ciudad/schema/ciudad.schema';
import { PROVINCIAS_SEED } from './provincias.data';
import { CANTONES_SEED } from '../../ciudad/seed/cantones.data';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    MongooseModule.forFeature([
      { name: Provincia.name, schema: ProvinciaSchema },
      { name: Ciudad.name, schema: CiudadSchema },
    ]),
  ],
})
class SeedModule {}

async function run() {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn', 'log'],
  });

  const provinciaModel = app.get<Model<ProvinciaDocument>>(
    getModelToken(Provincia.name),
  );
  const ciudadModel = app.get<Model<CiudadDocument>>(getModelToken(Ciudad.name));

  // 1) Provincias (upsert por nombre) → mapa codigo -> _id
  const codigoToId = new Map<string, any>();
  let provInsert = 0;
  let provSkip = 0;
  for (const p of PROVINCIAS_SEED) {
    const existing = await provinciaModel.findOne({ nombre: p.nombre }).lean();
    if (!existing) {
      const created = await provinciaModel.create({
        nombre: p.nombre,
        codigo: p.codigo,
        estado: true,
      });
      codigoToId.set(p.codigo, created._id);
      provInsert++;
    } else {
      if (!existing.codigo) {
        await provinciaModel.updateOne(
          { _id: existing._id },
          { $set: { codigo: p.codigo } },
        );
      }
      codigoToId.set(p.codigo, existing._id);
      provSkip++;
    }
  }

  // 2) Cantones (ciudades): upsert por nombre y asignar provincia
  let ciudadInsert = 0;
  let ciudadUpdated = 0;
  let ciudadSkip = 0;
  for (const c of CANTONES_SEED) {
    const provinciaId = codigoToId.get(c.provinciaCodigo);
    const existing = await ciudadModel.findOne({ nombre: c.nombre }).lean();
    if (!existing) {
      await ciudadModel.create({
        nombre: c.nombre,
        provincia: provinciaId,
        estado: true,
        visibleParaRegistro: true,
      });
      ciudadInsert++;
    } else if (!existing.provincia) {
      await ciudadModel.updateOne(
        { _id: existing._id },
        { $set: { provincia: provinciaId } },
      );
      ciudadUpdated++;
    } else {
      ciudadSkip++;
    }
  }

  // 3) Reporte de ciudades existentes que quedaron SIN provincia (no matchearon)
  const sinProvincia = await ciudadModel
    .find({ provincia: { $in: [null, undefined] } })
    .select('nombre')
    .lean();

  console.log(
    `\nSeed Ecuador terminado.\n` +
      `Provincias  -> insertadas: ${provInsert} | existentes: ${provSkip} | total: ${PROVINCIAS_SEED.length}\n` +
      `Ciudades    -> insertadas: ${ciudadInsert} | provincia asignada: ${ciudadUpdated} | ya tenían: ${ciudadSkip} | total cantones: ${CANTONES_SEED.length}\n` +
      `Ciudades sin provincia (revisar manualmente): ${sinProvincia.length}` +
      (sinProvincia.length
        ? `\n  -> ${sinProvincia.map((c: any) => c.nombre).join(', ')}`
        : ''),
  );

  await app.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error en seed de Ecuador:', err);
  process.exit(1);
});
