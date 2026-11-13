/**
 * Copia a la base LOCAL los locales con promoción que producción publica sin
 * sesión (GET /usuarios/promos): nombre, promoción, productos/platos, galería,
 * logo, horarios, ciudades, categorías y ubicación. No copia correos ni datos
 * personales (no vienen en esa ruta). Producción solo se LEE.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/seed-demo-desde-prod.ts
 *
 * Crea además una versión de cuponera de demo disponible en esas ciudades.
 * Idempotente: vuelve a ejecutar y actualiza los mismos locales.
 */
import 'dotenv/config';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const PROD_API = process.env.DEMO_SOURCE_API || 'https://enjoyback.avillegas.digital/api';
const url = process.env.MONGO_URL || '';
if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)/.test(url)) {
  console.error('MONGO_URL no es local. Abortado para no tocar producción.');
  process.exit(1);
}

const slug = (s: string) =>
  (s || 'local').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

async function getJson(path: string) {
  const r = await fetch(`${PROD_API}${path}`);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

async function main() {
  const provs: any = await getJson('/provincias');
  const provIds = (Array.isArray(provs) ? provs : provs.data).map((p: any) => p._id).join(',');
  const promos: any = await getJson(`/usuarios/promos?page=1&limit=100&provincias=${provIds}`);
  const locales: any[] = (promos.data || []).filter(
    (l: any) => (l.detallePromocion?.placeName || '').trim().toLowerCase() !== 'demo',
  );
  console.log(`Producción: ${locales.length} locales con promoción`);

  await mongoose.connect(url);
  const db = mongoose.connection.db!;
  const porNombre = async (col: string) => {
    const m = new Map<string, any>();
    for (const d of await db.collection(col).find({}, { projection: { nombre: 1 } }).toArray()) {
      m.set(String(d.nombre).trim().toLowerCase(), d._id);
    }
    return m;
  };
  // Categorías: completar con las que producción tiene y la semilla local no.
  const catsProd: any = await getJson('/categorias');
  let nuevasCat = 0;
  for (const c of Array.isArray(catsProd) ? catsProd : catsProd.data || []) {
    const r = await db.collection('categorias').updateOne(
      { nombre: c.nombre },
      { $setOnInsert: { nombre: c.nombre, icono: c.icono ?? null, descripcion: c.descripcion ?? '', estado: c.estado !== false, createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true },
    );
    nuevasCat += r.upsertedCount;
  }
  console.log(`Categorías nuevas desde producción: ${nuevasCat}`);

  const ciudades = await porNombre('ciudades');
  const categorias = await porNombre('categorias');
  // Nombres cortos usados en producción → nombre oficial del catálogo local.
  const ALIAS_CIUDAD: Record<string, string> = { 'baños': 'baños de agua santa' };
  for (const [corto, oficial] of Object.entries(ALIAS_CIUDAD)) {
    if (!ciudades.has(corto) && ciudades.has(oficial)) ciudades.set(corto, ciudades.get(oficial));
  }
  const rolLocal = await db.collection('rols').findOne({ slug: 'admin-local' });
  const admin = await db.collection('usuarios').findOne({ rol: 'admin' });
  const now = new Date();
  const ciudadesUsadas = new Set<string>();
  let sinMapa = 0;

  for (const l of locales) {
    const dp = l.detallePromocion || {};
    const nombre = (dp.placeName || 'Local').trim();
    const ciuIds = (l.ciudades || []).map((n: string) => ciudades.get(String(n).trim().toLowerCase())).filter(Boolean);
    const catIds = (l.categorias || []).map((n: string) => categorias.get(String(n).trim().toLowerCase())).filter(Boolean);
    sinMapa += (l.ciudades?.length || 0) - ciuIds.length + (l.categorias?.length || 0) - catIds.length;
    ciuIds.forEach((id: any) => ciudadesUsadas.add(String(id)));

    const { id: _ignorado, ...detalle } = dp;
    await db.collection('usuarios').updateOne(
      { email: `demo+${slug(nombre)}@enjoy.local` },
      {
        $set: {
          nombre,
          identificacion: '1790000000001',
          rol: 'admin-local',
          rolRef: rolLocal?._id ?? null,
          estado: true,
          deleted: false,
          contratoAceptado: true,
          contratoAceptadoEn: now,
          usuarioCreacion: admin?._id ?? null,
          ciudades: ciuIds,
          categorias: catIds,
          ubicacion: l.ubicacion ? { lat: l.ubicacion.lat, lng: l.ubicacion.lng } : null,
          promocion: dp.title || '',
          detallePromocion: detalle,
          updatedAt: now,
        },
        $setOnInsert: {
          clave: bcrypt.hashSync(randomBytes(16).toString('hex'), 10), // nadie entra con estas cuentas
          promedioCalificacion: dp.rating || 0,
          totalComentarios: 0,
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }
  console.log(`Locales demo cargados: ${locales.length} (ciudades/categorías sin equivalente local: ${sinMapa})`);

  // Versión de cuponera de demo disponible en esas ciudades.
  await db.collection('versioncuponeras').updateOne(
    { nombre: 'ENJOY-DEMO-2026' },
    {
      $set: {
        estado: true,
        descripcion: 'Cuponera de demostración para el entorno local',
        precio: '20.00',
        ciudadesDisponibles: [...ciudadesUsadas].map((id) => new mongoose.Types.ObjectId(id)),
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  console.log(`Versión ENJOY-DEMO-2026 disponible en ${ciudadesUsadas.size} ciudades`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
