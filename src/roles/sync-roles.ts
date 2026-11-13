import { TODOS_LOS_PERMISOS } from './constants/permisos.constant';
import { RolPredefinido, ROLES_PREDEFINIDOS } from './constants/roles-predefinidos';

/**
 * Sincronización de roles predefinidos — lógica PURA (sin base de datos) para
 * poder probarla. La usan el arranque del backend y `scripts/fase3-roles.ts`.
 *
 * Reglas:
 *  - Cada rol guarda `permisosSincronizados`: lo que ya se le entregó desde la
 *    constante. Solo se SUMA lo que falte de ahí → si el admin quita un permiso
 *    desde /roles, no vuelve en el siguiente arranque.
 *  - Un rol predefinido que ya se creó alguna vez y el admin borró NO se recrea.
 *  - Roles que existían antes de la Fase 3 (admin, admin-local, staff,
 *    vendedor, marketing) reciben en su primera sincronización lo de la
 *    constante. Si un slug nuevo (atencion, finanzas, auditor) ya existía como
 *    rol propio, no se le suma nada (evita subir privilegios) y se avisa.
 *  - `admin` tiene siempre todo el catálogo (a propósito).
 */
export const ROLES_PREVIOS_A_FASE3 = ['admin', 'admin-local', 'staff', 'vendedor', 'marketing'];
export const ROLES_DE_SISTEMA = ['admin', 'admin-local', 'staff']; // no se pueden borrar

export interface RolActual {
  slug: string;
  permisos?: string[];
  permisosSincronizados?: string[] | null;
  /** true = rol propio que usa un slug predefinido: no se toca nunca. */
  sinSync?: boolean;
}

export type AccionSync =
  | { tipo: 'crear'; rol: RolPredefinido; permisos: string[]; esSistema: boolean }
  | { tipo: 'sumar'; slug: string; permisos: string[]; sincronizados: string[] }
  | { tipo: 'excluir'; slug: string; motivo: string }
  | { tipo: 'omitir'; slug: string; motivo: string };

const validos = (ps: string[]) => ps.filter((p) => TODOS_LOS_PERMISOS.includes(p));

export function planificarSync(
  actuales: RolActual[],
  creadosAntes: string[],
  definicion: RolPredefinido[] = ROLES_PREDEFINIDOS,
): AccionSync[] {
  const porSlug = new Map(actuales.map((r) => [r.slug, r]));
  const acciones: AccionSync[] = [];
  for (const def of definicion) {
    const objetivo = validos(def.slug === 'admin' ? [...TODOS_LOS_PERMISOS] : def.permisos);
    const rol = porSlug.get(def.slug);

    if (!rol) {
      if (creadosAntes.includes(def.slug)) {
        acciones.push({ tipo: 'omitir', slug: def.slug, motivo: 'lo borró un administrador: no se recrea' });
      } else {
        acciones.push({ tipo: 'crear', rol: def, permisos: objetivo, esSistema: ROLES_DE_SISTEMA.includes(def.slug) });
      }
      continue;
    }

    if (rol.sinSync) {
      acciones.push({ tipo: 'omitir', slug: def.slug, motivo: 'rol propio (sinSync): no se sincroniza' });
      continue;
    }
    const tiene = new Set(rol.permisos ?? []);
    let aEntregar: string[];
    if (def.slug === 'admin') {
      aEntregar = objetivo; // admin: siempre todo
    } else if (rol.permisosSincronizados == null) {
      if (ROLES_PREVIOS_A_FASE3.includes(def.slug) || creadosAntes.includes(def.slug)) {
        aEntregar = objetivo;
      } else {
        acciones.push({
          tipo: 'excluir', slug: def.slug,
          motivo: 'ya existía un rol propio con este slug: se marca sinSync y no se le suman permisos (revísalo en /roles)',
        });
        continue;
      }
    } else {
      const ya = new Set(rol.permisosSincronizados);
      aEntregar = objetivo.filter((p) => !ya.has(p)); // solo lo NUEVO de la constante
    }
    acciones.push({
      tipo: 'sumar',
      slug: def.slug,
      permisos: aEntregar.filter((p) => !tiene.has(p)),
      sincronizados: objetivo,
    });
  }
  return acciones;
}

/** Aplica el plan sobre la base (colecciones `rols` y `sistema_estado`). */
export async function aplicarSync(db: any, acciones: AccionSync[], log: (m: string) => void) {
  const rols = db.collection('rols');
  const estado = db.collection('sistema_estado');
  const ahora = new Date();
  for (const a of acciones) {
    if (a.tipo === 'crear') {
      await rols.updateOne(
        { slug: a.rol.slug },
        {
          $setOnInsert: {
            slug: a.rol.slug, nombre: a.rol.nombre, descripcion: a.rol.descripcion,
            esSistema: a.esSistema, estado: true, permisos: a.permisos,
            permisosSincronizados: a.permisos, createdAt: ahora, updatedAt: ahora,
          },
        },
        { upsert: true },
      );
      log(`rol "${a.rol.slug}" creado (${a.permisos.length} permisos)`);
    } else if (a.tipo === 'sumar') {
      await rols.updateOne(
        { slug: a.slug },
        {
          ...(a.permisos.length ? { $addToSet: { permisos: { $each: a.permisos } } } : {}),
          $set: { permisosSincronizados: a.sincronizados },
        },
      );
      if (a.permisos.length) log(`rol "${a.slug}": +${a.permisos.join(', ')}`);
    } else if (a.tipo === 'excluir') {
      await rols.updateOne({ slug: a.slug }, { $set: { sinSync: true } });
      log(`rol "${a.slug}": ${a.motivo}`);
    } else {
      log(`rol "${a.slug}": ${a.motivo}`);
    }
  }
  const slugs = acciones.filter((a) => a.tipo !== 'omitir').map((a) => (a.tipo === 'crear' ? a.rol.slug : a.slug));
  await estado.updateOne(
    { _id: 'roles-predefinidos' },
    { $addToSet: { creados: { $each: slugs } }, $set: { actualizado: ahora } },
    { upsert: true },
  );
}

export async function leerEstado(db: any): Promise<{ actuales: RolActual[]; creadosAntes: string[] }> {
  const actuales = await db.collection('rols').find({}, { projection: { slug: 1, permisos: 1, permisosSincronizados: 1, sinSync: 1 } }).toArray();
  const est = await db.collection('sistema_estado').findOne({ _id: 'roles-predefinidos' });
  return { actuales, creadosAntes: est?.creados ?? [] };
}
