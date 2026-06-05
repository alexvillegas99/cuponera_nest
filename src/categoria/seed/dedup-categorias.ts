import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import configuration from '../../config/config.env';
import { DatabaseModule } from '../../database/database.module';
import {
  Categoria,
  CategoriaDocument,
  CategoriaSchema,
} from '../schema/categoria.schema';
import {
  Usuario,
  UsuarioDocument,
  UsuarioSchema,
} from '../../usuarios/schema/usuario.schema';
import { CATEGORIAS_SEED } from './categorias.data';

/**
 * Deduplica categorías repetidas y deja las referencias consistentes.
 *
 * Qué hace:
 *  1) Agrupa las categorías por nombre NORMALIZADO (trim + minúsculas + sin tildes
 *     + espacios colapsados). Así detecta repetidas exactas y variantes por
 *     mayúsculas/tildes/espacios (p. ej. "Restaurante " vs "restaurante").
 *     NO une singular/plural distintos (p. ej. "Bar" vs "Bares") para no borrar de más.
 *  2) Por cada grupo con más de una, elige una CANÓNICA (la que está en el seed
 *     oficial > la que tiene ícono > la más antigua) y trata el resto como duplicadas.
 *  3) SUSTITUYE las referencias: en usuarios.categorias reemplaza el id de la
 *     duplicada por el de la canónica (addToSet + pull, sin dejar repetidos en el array).
 *  4) Borra las categorías duplicadas (ya sin referencias).
 *  5) Limpia referencias HUÉRFANAS: ids en usuarios.categorias que no existen como
 *     categoría.
 *
 * Seguridad: por defecto corre en DRY-RUN (solo reporta, no modifica nada).
 * Para aplicar los cambios: pasa el flag --apply.
 *
 *   npm run dedup:categorias            # dry-run (no escribe)
 *   npm run dedup:categorias -- --apply # aplica cambios
 */

const APPLY = process.argv.includes('--apply');

function normalizar(nombre: string): string {
  return (nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes/diacríticos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Nombres oficiales del seed (normalizados) para preferir la canónica correcta.
const NOMBRES_SEED = new Set(CATEGORIAS_SEED.map((c) => normalizar(c.nombre)));

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    MongooseModule.forFeature([
      { name: Categoria.name, schema: CategoriaSchema },
      { name: Usuario.name, schema: UsuarioSchema },
    ]),
  ],
})
class DedupModule {}

async function run() {
  const app = await NestFactory.createApplicationContext(DedupModule, {
    logger: ['error', 'warn'],
  });

  const categoriaModel = app.get<Model<CategoriaDocument>>(
    getModelToken(Categoria.name),
  );
  const usuarioModel = app.get<Model<UsuarioDocument>>(
    getModelToken(Usuario.name),
  );

  console.log(
    `\n=== Dedupe de categorías — ${APPLY ? 'APLICANDO CAMBIOS' : 'DRY-RUN (no escribe)'} ===\n`,
  );

  const categorias = await categoriaModel.find().lean();
  console.log(`Total categorías en BD: ${categorias.length}`);

  // 1) Agrupar por nombre normalizado
  const grupos = new Map<string, any[]>();
  for (const c of categorias) {
    const key = normalizar(c.nombre);
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(c);
  }

  const duplicados = [...grupos.entries()].filter(([, arr]) => arr.length > 1);
  console.log(`Grupos con duplicados: ${duplicados.length}\n`);

  let categoriasEliminadas = 0;
  let usuariosReasignados = 0;

  for (const [key, arr] of duplicados) {
    // 2) Elegir canónica: seed > con ícono > más antigua (createdAt / _id)
    const ordenadas = [...arr].sort((a, b) => {
      const aSeed = NOMBRES_SEED.has(normalizar(a.nombre)) ? 1 : 0;
      const bSeed = NOMBRES_SEED.has(normalizar(b.nombre)) ? 1 : 0;
      if (aSeed !== bSeed) return bSeed - aSeed;
      const aIcon = a.icono && String(a.icono).trim() ? 1 : 0;
      const bIcon = b.icono && String(b.icono).trim() ? 1 : 0;
      if (aIcon !== bIcon) return bIcon - aIcon;
      const aT = new Date(a.createdAt || 0).getTime();
      const bT = new Date(b.createdAt || 0).getTime();
      return aT - bT;
    });

    const canonica = ordenadas[0];
    const dupes = ordenadas.slice(1);

    console.log(`• "${key}"`);
    console.log(
      `   canónica: ${canonica._id} ("${canonica.nombre}", icono=${canonica.icono ?? '—'})`,
    );

    for (const dupe of dupes) {
      const refs = await usuarioModel.countDocuments({
        categorias: dupe._id,
      });
      console.log(
        `   duplicada: ${dupe._id} ("${dupe.nombre}") — usuarios que la referencian: ${refs}`,
      );

      if (APPLY) {
        if (refs > 0) {
          // 3) Sustituir referencias: agrega la canónica y quita la duplicada.
          //    Dos pasos para que addToSet no choque con pull en la misma op.
          await usuarioModel.updateMany(
            { categorias: dupe._id },
            { $addToSet: { categorias: new Types.ObjectId(canonica._id) } },
          );
          const res = await usuarioModel.updateMany(
            { categorias: dupe._id },
            { $pull: { categorias: dupe._id } },
          );
          usuariosReasignados += res.modifiedCount ?? 0;
        }
        // 4) Borrar la duplicada
        await categoriaModel.deleteOne({ _id: dupe._id });
        categoriasEliminadas++;
      } else {
        usuariosReasignados += refs;
        categoriasEliminadas++;
      }
    }
    console.log('');
  }

  // 5) Referencias huérfanas (ids en usuarios.categorias sin categoría existente)
  const idsValidos = new Set(
    (await categoriaModel.find().select('_id').lean()).map((c: any) =>
      c._id.toString(),
    ),
  );
  // Nota: si este script ya aplicó borrados, idsValidos ya excluye las duplicadas.
  const usuariosConCategorias = await usuarioModel
    .find({ categorias: { $exists: true, $ne: [] } })
    .select('_id categorias')
    .lean();

  let huerfanasTotales = 0;
  let usuariosConHuerfanas = 0;
  for (const u of usuariosConCategorias) {
    const huerfanas = (u.categorias || []).filter(
      (id: any) => !idsValidos.has(id.toString()),
    );
    if (huerfanas.length) {
      usuariosConHuerfanas++;
      huerfanasTotales += huerfanas.length;
      console.log(
        `   ref huérfana: usuario ${u._id} → ${huerfanas.map((x: any) => x.toString()).join(', ')}`,
      );
      if (APPLY) {
        await usuarioModel.updateOne(
          { _id: u._id },
          { $pull: { categorias: { $in: huerfanas } } },
        );
      }
    }
  }

  console.log('\n=== Resumen ===');
  console.log(`Grupos duplicados: ${duplicados.length}`);
  console.log(
    `Categorías a eliminar: ${categoriasEliminadas}${APPLY ? ' (eliminadas)' : ' (simulado)'}`,
  );
  console.log(
    `Usuarios reasignados: ${usuariosReasignados}${APPLY ? '' : ' (estimado)'}`,
  );
  console.log(
    `Referencias huérfanas: ${huerfanasTotales} en ${usuariosConHuerfanas} usuarios${
      APPLY ? ' (limpiadas)' : ' (simulado)'
    }`,
  );
  if (!APPLY) {
    console.log(
      '\nDRY-RUN: no se modificó nada. Para aplicar: npm run dedup:categorias -- --apply',
    );
  }

  await app.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error en dedupe de categorías:', err);
  process.exit(1);
});
