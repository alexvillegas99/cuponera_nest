/**
 * Fase 3 — Roles predefinidos (idempotente, con DRY-RUN por defecto).
 *
 *   npx ts-node -r tsconfig-paths/register scripts/fase3-roles.ts            # solo muestra
 *   npx ts-node -r tsconfig-paths/register scripts/fase3-roles.ts --aplicar  # aplica
 *
 * Para producción hace falta además `--confirmo-produccion` (y respaldo previo
 * de `rols` y `usuarios`: mongodump --collection rols / usuarios).
 *
 * Qué hace:
 *  1. Crea o actualiza los 8 roles. A los existentes solo les SUMA permisos
 *     (no borra personalizaciones); `admin` queda con todos.
 *  2. Reasigna usuarios de roles obsoletos (sin subir privilegios) y borra
 *     esos roles: visualizador→auditor, mkt-fotos→marketing,
 *     soporte→atencion, contador→finanzas, supervisor→auditor.
 *  3. Rellena `rolRef` de cada usuario según su `rol` (slug).
 *  4. Crea índice único en `rols.slug` (si no hay duplicados).
 */
import 'dotenv/config';
import * as mongoose from 'mongoose';
import { TODOS_LOS_PERMISOS } from '../src/roles/constants/permisos.constant';
import { ROLES_OBSOLETOS, ROLES_PREDEFINIDOS } from '../src/roles/constants/roles-predefinidos';

const APLICAR = process.argv.includes('--aplicar');
const PROD_OK = process.argv.includes('--confirmo-produccion');
const url = process.env.MONGO_URL || '';
const esLocal = /^mongodb:\/\/(localhost|127\.0\.0\.1)/.test(url);
if (!esLocal && APLICAR && !PROD_OK) {
  console.error('MONGO_URL no es local. Para aplicar en producción añade --confirmo-produccion (con respaldo previo).');
  process.exit(1);
}

const ROLES_FASE3 = ROLES_PREDEFINIDOS;
const OBSOLETOS = ROLES_OBSOLETOS;

async function main() {
  await mongoose.connect(url);
  const db = mongoose.connection.db!;
  const rols = db.collection('rols');
  const usuarios = db.collection('usuarios');
  const modo = APLICAR ? 'APLICANDO' : 'DRY-RUN (no cambia nada)';
  console.log(`\n== Fase 3 — roles · ${modo} · base: ${db.databaseName} (${esLocal ? 'local' : 'REMOTA'})\n`);

  // 1) Roles
  for (const r of ROLES_FASE3) {
    const actual: any = await rols.findOne({ slug: r.slug });
    const validos = r.permisos.filter((p) => TODOS_LOS_PERMISOS.includes(p));
    if (!actual) {
      console.log(`+ crear ${r.slug.padEnd(12)} (${validos.length} permisos)`);
      if (APLICAR) {
        await rols.insertOne({
          slug: r.slug, nombre: r.nombre, descripcion: r.descripcion, esSistema: true,
          permisos: validos, createdAt: new Date(), updatedAt: new Date(),
        });
      }
    } else {
      const nuevos = validos.filter((p) => !(actual.permisos ?? []).includes(p));
      console.log(`~ ${r.slug.padEnd(12)} suma ${nuevos.length ? nuevos.join(', ') : '—'}`);
      if (APLICAR) {
        await rols.updateOne(
          { _id: actual._id },
          { $addToSet: { permisos: { $each: validos } }, $set: { nombre: r.nombre, descripcion: r.descripcion, esSistema: true, updatedAt: new Date() } },
        );
      }
    }
  }

  // 2) Obsoletos
  for (const [slug, destino] of Object.entries(OBSOLETOS)) {
    const viejo: any = await rols.findOne({ slug });
    const nUsuarios = await usuarios.countDocuments({ $or: [{ rol: slug }, ...(viejo ? [{ rolRef: viejo._id }] : [])] });
    if (!viejo && !nUsuarios) continue;
    console.log(`- obsoleto ${slug}: ${nUsuarios} usuario(s) → ${destino}${viejo ? ', se elimina el rol' : ''}`);
    if (APLICAR) {
      const dest: any = await rols.findOne({ slug: destino });
      await usuarios.updateMany(
        { $or: [{ rol: slug }, ...(viejo ? [{ rolRef: viejo._id }] : [])] },
        { $set: { rol: destino, rolRef: dest?._id ?? null } },
      );
      if (viejo) await rols.deleteOne({ _id: viejo._id });
    }
  }

  // 3) rolRef coherente con el slug
  const porSlug = new Map<string, any>();
  for (const r of await rols.find({}).toArray()) porSlug.set(r.slug, r._id);
  let arreglar = 0;
  const sinRol: string[] = [];
  for await (const u of usuarios.find({}, { projection: { rol: 1, rolRef: 1, email: 1 } })) {
    const id = porSlug.get(u.rol);
    if (!id) { sinRol.push(`${u.email ?? u._id} (rol "${u.rol}")`); continue; }
    if (String(u.rolRef ?? '') !== String(id)) {
      arreglar++;
      if (APLICAR) await usuarios.updateOne({ _id: u._id }, { $set: { rolRef: id } });
    }
  }
  console.log(`· rolRef a corregir: ${arreglar}`);
  if (sinRol.length) console.log(`! usuarios con un rol que no existe (revisar a mano): ${sinRol.join('; ')}`);

  // 4) Índice único en slug
  const dup = await rols.aggregate([{ $group: { _id: '$slug', n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }]).toArray();
  if (dup.length) {
    console.log(`! slugs duplicados, no se crea el índice: ${dup.map((d) => d._id).join(', ')}`);
  } else {
    const idx = (await rols.indexes()).find((i: any) => JSON.stringify(i.key) === JSON.stringify({ slug: 1 }));
    if (idx?.unique) {
      console.log(`· índice único rols.slug ya existe (${idx.name})`);
    } else if (idx) {
      console.log(`! existe índice NO único en slug (${idx.name}): bórralo y vuelve a correr el script`);
    } else {
      console.log('· crear índice único rols.slug');
      if (APLICAR) await rols.createIndex({ slug: 1 }, { unique: true, name: 'slug_1' });
    }
  }

  console.log(`\nRoles finales: ${(await rols.find({}, { projection: { slug: 1 } }).toArray()).map((r) => r.slug).join(', ')}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
