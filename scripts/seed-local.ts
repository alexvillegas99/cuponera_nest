/**
 * Semilla para el ENTORNO LOCAL de pruebas (Mongo en Docker, puerto 27018).
 *
 *   npx ts-node -r tsconfig-paths/register scripts/seed-local.ts
 *
 * - Crea/actualiza los roles de sistema y predefinidos (misma lógica que
 *   RolesService.seed(), que en producción está desactivado a propósito).
 * - Crea 3 usuarios de prueba: Administrador, Admin Local y Cliente.
 *   Correos y contraseñas salen de .env (SEED_*), que está en .gitignore.
 *
 * Se niega a correr si MONGO_URL no apunta a localhost.
 */
import 'dotenv/config';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { TODOS_LOS_PERMISOS } from '../src/roles/constants/permisos.constant';

const url = process.env.MONGO_URL || '';
if (!/^mongodb:\/\/(localhost|127\.0\.0\.1)/.test(url)) {
  console.error('MONGO_URL no es local. Abortado para no tocar producción.');
  process.exit(1);
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name} en .env`);
  return v;
}

async function main() {
  await mongoose.connect(url);
  const db = mongoose.connection.db!;
  const roles = db.collection('rols');
  const usuarios = db.collection('usuarios');
  const clientes = db.collection('clientes');

  // ── Roles (igual que RolesService.seed) ──
  const porModulo = (mods: string[]) =>
    TODOS_LOS_PERMISOS.filter((p) => mods.includes(p.split('.')[0]));

  const defs = [
    { nombre: 'Administrador', descripcion: 'Acceso total al sistema', permisos: [...TODOS_LOS_PERMISOS], esSistema: true, slug: 'admin' },
    { nombre: 'Admin Local', descripcion: 'Administrador de establecimiento local', permisos: porModulo(['web', 'dashboard-local', 'usuarios-local', 'perfil-local', 'promociones-flash']), esSistema: true, slug: 'admin-local' },
    { nombre: 'Staff', descripcion: 'Personal con acceso básico', permisos: porModulo(['dashboard-local', 'historico']), esSistema: true, slug: 'staff' },
    { nombre: 'Vendedor', descripcion: 'Puede ver y editar solo los establecimientos que él mismo registró. Sin acceso a fotos.', permisos: ['web.acceso', 'establecimientos.ver', 'establecimientos.editar'], esSistema: false, slug: 'vendedor' },
    {
      nombre: 'Marketing', descripcion: 'Gestión de contenido, promociones y atención por chat', esSistema: false, slug: 'marketing',
      permisos: ['web.acceso', 'dashboard.ver', 'cupones.ver', 'cupones.crear', 'cupones.lote', 'versiones.ver', 'versiones.crear', 'versiones.editar', 'categorias.ver', 'categorias.crear', 'categorias.editar', 'establecimientos.ver', 'notificaciones.ver', 'notificaciones.enviar', 'chat.ver', 'chat.responder', 'promotores.ver'],
    },
  ];
  const now = new Date();
  for (const r of defs) {
    await roles.updateOne(
      { slug: r.slug },
      { $set: { ...r, estado: true, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }
  const rolId = async (slug: string) => (await roles.findOne({ slug }))!._id;
  console.log(`Roles: ${defs.length} listos`);

  // ── Usuarios del panel ──
  const panel = [
    { email: req('SEED_ADMIN_EMAIL'), pass: req('SEED_ADMIN_PASSWORD'), nombre: 'Admin Prueba', identificacion: '1710034065', rol: 'admin' },
    { email: req('SEED_LOCAL_EMAIL'), pass: req('SEED_LOCAL_PASSWORD'), nombre: 'Local de Prueba', identificacion: '1790012345001', rol: 'admin-local' },
  ];
  for (const u of panel) {
    await usuarios.updateOne(
      { email: u.email.toLowerCase() },
      {
        $set: {
          nombre: u.nombre,
          identificacion: u.identificacion,
          rol: u.rol,
          rolRef: await rolId(u.rol),
          clave: bcrypt.hashSync(u.pass, 10),
          estado: true,
          deleted: false,
          // El admin-local entra con el contrato ya aceptado para poder
          // recorrer el panel; el flujo de firma se prueba aparte.
          contratoAceptado: true,
          contratoAceptadoEn: now,
          updatedAt: now,
        },
        $setOnInsert: { email: u.email.toLowerCase(), createdAt: now },
      },
      { upsert: true },
    );
  }
  console.log('Usuarios del panel: admin y admin-local listos');

  // ── Cliente de la app ──
  await clientes.updateOne(
    { email: req('SEED_CLIENTE_EMAIL').toLowerCase() },
    {
      $set: {
        nombres: 'Cliente',
        apellidos: 'Prueba',
        tipoIdentificacion: 'CEDULA',
        identificacion: '1713175071',
        password: bcrypt.hashSync(req('SEED_CLIENTE_PASSWORD'), 10),
        estado: true,
        deleted: false,
        updatedAt: now,
      },
      $setOnInsert: { email: req('SEED_CLIENTE_EMAIL').toLowerCase(), createdAt: now },
    },
    { upsert: true },
  );
  console.log('Cliente de prueba listo');

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
