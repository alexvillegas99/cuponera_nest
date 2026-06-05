import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import configuration from '../../config/config.env';
import { DatabaseModule } from '../../database/database.module';
import {
  Usuario,
  UsuarioDocument,
  UsuarioSchema,
} from '../schema/usuario.schema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    MongooseModule.forFeature([
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
  ],
})
class BackfillModule {}

/**
 * Re-deriva la portada (detallePromocion.imageUrl) a partir de la PRIMERA FOTO
 * (type === 'image') de detallePromocion.galeria. Ignora videos. No toca locales
 * sin galería ni galerías que solo tengan videos.
 */
async function run() {
  const app = await NestFactory.createApplicationContext(BackfillModule, {
    logger: ['error', 'warn', 'log'],
  });

  const model = app.get<Model<UsuarioDocument>>(getModelToken(Usuario.name));

  const docs = await model
    .find({ 'detallePromocion.galeria.0': { $exists: true } })
    .select({ 'detallePromocion.galeria': 1, 'detallePromocion.imageUrl': 1 })
    .lean();

  let actualizados = 0;
  let sinFoto = 0;
  let iguales = 0;

  for (const d of docs as any[]) {
    const galeria = d?.detallePromocion?.galeria ?? [];
    const primeraFoto = galeria.find(
      (m: any) => m?.type === 'image' && m?.url,
    );
    if (!primeraFoto) {
      sinFoto++;
      continue;
    }
    if (d?.detallePromocion?.imageUrl === primeraFoto.url) {
      iguales++;
      continue;
    }
    await model.updateOne(
      { _id: d._id },
      { $set: { 'detallePromocion.imageUrl': primeraFoto.url } },
    );
    actualizados++;
  }

  console.log(
    `\nBackfill portada terminado.  Con galería: ${docs.length}  |  Actualizados: ${actualizados}  |  Ya iguales: ${iguales}  |  Solo videos (sin cambio): ${sinFoto}`,
  );

  await app.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error en backfill de portada:', err);
  process.exit(1);
});
