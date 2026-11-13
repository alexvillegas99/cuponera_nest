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
import { ROLES_OBSOLETOS } from '../src/roles/constants/roles-predefinidos';
import { aplicarSync, leerEstado, planificarSync } from '../src/roles/sync-roles';

const APLICAR = process.argv.includes('--aplicar');
const PROD_OK = process.argv.includes('--confirmo-produccion');
const FORZAR = process.argv.includes('--forzar');
const url = process.env.MONGO_URL || '';
const esLocal = /^mongodb:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);
if (!esLocal && APLICAR && !PROD_OK) {
  console.error('MONGO_URL no es local. Para aplicar en producción añade --confirmo-produccion (con respaldo previo).');
  process.exit(1);
}

const OBSOLETOS = ROLES_OBSOLETOS;

async function main() {
  await mongoose.connect(url);
  const db = mongoose.connection.db!;
  const rols = db.collection('rols');
  const usuarios = db.collection('usuarios');
  const modo = APLICAR ? 'APLICANDO' : 'DRY-RUN (no cambia nada)';
  console.log(`\n== Fase 3 — roles · ${modo} · base: ${db.databaseName} (${esLocal ? 'local' : 'REMOTA'})\n`);

  // 1) Roles: misma lógica que el arranque (src/roles/sync-roles.ts)
  const { actuales, creadosAntes } = await leerEstado(db);
  const plan = planificarSync(actuales, creadosAntes);
  for (const a of plan) {
    if (a.tipo === 'crear') console.log(`+ crear ${a.rol.slug.padEnd(12)} (${a.permisos.length} permisos)`);
    else if (a.tipo === 'sumar') console.log(`~ ${a.slug.padEnd(12)} suma ${a.permisos.length ? a.permisos.join(', ') : '—'}`);
    else console.log(`! ${(a as any).slug.padEnd(12)} ${(a as any).motivo}`);
  }
  if (APLICAR) await aplicarSync(db, plan, () => undefined);

  // 2) Obsoletos: sin subir privilegios (si el destino da más, hay que --forzar)
  let bloqueado = false;
  for (const [slug, destino] of Object.entries(OBSOLETOS)) {
    const viejo: any = await rols.findOne({ slug });
    const filtro = { $or: [{ rol: slug }, ...(viejo ? [{ rolRef: viejo._id }] : [])] };
    const nUsuarios = await usuarios.countDocuments(filtro);
    if (!viejo && !nUsuarios) continue;
    const dest: any = await rols.findOne({ slug: destino });
    // Permisos que tendrá el destino según el plan (también en dry-run, aunque aún no exista).
    const permisosDestino = (slugX: string, actual: any) => {
      const a: any = plan.find((x: any) => (x.rol?.slug ?? x.slug) === slugX && (x.tipo === 'crear' || x.tipo === 'sumar'));
      return [...new Set([...(actual?.permisos ?? []), ...(a?.permisos ?? [])])];
    };
    const viejos: string[] = viejo?.permisos ?? [];
    const ganan = permisosDestino(destino, dest).filter((p: string) => !viejos.includes(p));
    // "De un local" = su usuarioCreacion es un admin-local (el admin también
    // rellena usuarioCreacion al crear personal global, así que no basta con != null).
    const idsLocales = (await usuarios.find({ rol: 'admin-local' }, { projection: { _id: 1 } }).toArray()).flatMap((u: any) => [u._id, String(u._id)]);
    const filtroLocal = { ...filtro, usuarioCreacion: { $in: idsLocales } };
    const filtroGlobal = { ...filtro, usuarioCreacion: { $nin: idsLocales } };
    const deLocal = await usuarios.countDocuments(filtroLocal);
    const staffDef: any = await rols.findOne({ slug: 'staff' });
    const ganaStaff = deLocal ? permisosDestino('staff', staffDef).filter((p: string) => !viejos.includes(p)) : [];
    console.log(`- obsoleto ${slug}: ${nUsuarios} usuario(s) → ${destino}${deLocal ? ` (${deLocal} de un local → staff)` : ''}${viejo ? ', se elimina el rol' : ''}`);
    if (ganan.length) console.log(`    ganarían (${destino}): ${ganan.join(', ')}`);
    if (ganaStaff.length) console.log(`    ganarían (staff): ${ganaStaff.join(', ')}`);
    if ((ganan.length || ganaStaff.length) && !FORZAR) { bloqueado = true; continue; }
    if (APLICAR) {
      const staff: any = await rols.findOne({ slug: 'staff' });
      const destAhora: any = await rols.findOne({ slug: destino });
      await usuarios.updateMany(filtroLocal, { $set: { rol: 'staff', rolRef: staff?._id ?? null } });
      await usuarios.updateMany(filtroGlobal, { $set: { rol: destino, rolRef: destAhora?._id ?? null } });
      if (viejo) await rols.deleteOne({ _id: viejo._id });
    }
  }
  if (bloqueado) {
    console.log('\n! Algún rol obsoleto pasaría a un rol con MÁS permisos. Revisa la lista y usa --forzar si es lo correcto.');
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
