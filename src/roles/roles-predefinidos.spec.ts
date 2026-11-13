import { TODOS_LOS_PERMISOS } from './constants/permisos.constant';
import {
  PERMISOS_PROHIBIDOS_PARA_LOCALES,
  ROLES_OBSOLETOS,
  ROLES_PREDEFINIDOS,
} from './constants/roles-predefinidos';

describe('Roles predefinidos', () => {
  const porSlug = new Map(ROLES_PREDEFINIDOS.map((r) => [r.slug, r]));

  it('no repiten slug', () => {
    expect(porSlug.size).toBe(ROLES_PREDEFINIDOS.length);
  });

  it('solo usan permisos del catálogo', () => {
    const malos = ROLES_PREDEFINIDOS.flatMap((r) =>
      r.permisos.filter((p) => !TODOS_LOS_PERMISOS.includes(p)).map((p) => `${r.slug}: ${p}`),
    );
    expect(malos).toEqual([]);
  });

  it('admin tiene TODO el catálogo (las funciones nuevas le llegan solas)', () => {
    const admin = porSlug.get('admin')!;
    expect(TODOS_LOS_PERMISOS.filter((p) => !admin.permisos.includes(p))).toEqual([]);
  });

  it('los roles de local no tienen permisos globales', () => {
    for (const slug of ['admin-local', 'staff']) {
      const r = porSlug.get(slug)!;
      expect(r.permisos.filter((p) => PERMISOS_PROHIBIDOS_PARA_LOCALES.includes(p))).toEqual([]);
    }
  });

  it('staff y admin-local pueden canjear', () => {
    for (const slug of ['admin-local', 'staff']) {
      expect(porSlug.get(slug)!.permisos).toEqual(expect.arrayContaining(['historico.crear', 'historico.validar']));
    }
  });

  it('el auditor solo lee', () => {
    const escribe = porSlug.get('auditor')!.permisos.filter((p) => p !== 'web.acceso' && !p.endsWith('.ver'));
    expect(escribe).toEqual([]);
  });

  it('los roles obsoletos pasan a un rol vigente y nunca a admin', () => {
    for (const [viejo, destino] of Object.entries(ROLES_OBSOLETOS)) {
      expect(porSlug.has(viejo)).toBe(false);
      expect(porSlug.has(destino)).toBe(true);
      expect(destino).not.toBe('admin');
    }
  });

  it('todo permiso del catálogo lo tiene al menos un rol además de admin, o es solo de admin a propósito', () => {
    // Permisos que, por diseño, solo tiene admin.
    const SOLO_ADMIN = new Set([
      'usuarios.crear', 'usuarios.editar', 'usuarios.eliminar', 'clientes.editar',
      'cupones.eliminar', 'cupones.activar', 'cupones.asignar',
      'categorias.eliminar', 'categorias.activar',
      'ciudades.crear', 'ciudades.editar', 'ciudades.eliminar', 'ciudades.activar',
      'configuracion.editar', 'configuracion.eliminar',
      'versiones.eliminar', 'versiones.activar', 'pagos.configurar',
      'promotores.gestionar', 'roles.crear', 'roles.editar', 'roles.eliminar',
    ]);
    const otros = ROLES_PREDEFINIDOS.filter((r) => r.slug !== 'admin').flatMap((r) => r.permisos);
    const huerfanos = TODOS_LOS_PERMISOS.filter((p) => !otros.includes(p) && !SOLO_ADMIN.has(p));
    // Si falla: hay un permiso nuevo en el catálogo. Dáselo al rol que
    // corresponda en roles-predefinidos.ts o márcalo como SOLO_ADMIN aquí.
    expect(huerfanos).toEqual([]);
  });
});
