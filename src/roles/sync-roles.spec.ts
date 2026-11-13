import { planificarSync } from './sync-roles';
import { TODOS_LOS_PERMISOS } from './constants/permisos.constant';
import { ROLES_PREDEFINIDOS } from './constants/roles-predefinidos';

const def = (slug: string) => ROLES_PREDEFINIDOS.find((r) => r.slug === slug)!;
const accion = (acc: any[], slug: string, tipo?: string) =>
  acc.find((a) => (a.slug ?? a.rol?.slug) === slug && (!tipo || a.tipo === tipo));

describe('Sincronización de roles predefinidos', () => {
  it('crea los roles que nunca existieron', () => {
    const acc = planificarSync([], []);
    expect(accion(acc, 'finanzas', 'crear')).toBeTruthy();
    expect(accion(acc, 'admin', 'crear').esSistema).toBe(true);
    expect(accion(acc, 'marketing', 'crear').esSistema).toBe(false); // se puede borrar
  });

  it('un permiso que el admin QUITÓ no vuelve en el siguiente arranque', () => {
    const atencion = def('atencion');
    const sinCupones = atencion.permisos.filter((p) => p !== 'cupones.ver');
    const acc = planificarSync(
      [{ slug: 'atencion', permisos: sinCupones, permisosSincronizados: atencion.permisos }],
      ['atencion'],
      [atencion],
    );
    expect(accion(acc, 'atencion', 'sumar').permisos).toEqual([]);
  });

  it('un permiso NUEVO en la constante llega una sola vez', () => {
    const base = def('finanzas');
    const conNuevo = { ...base, permisos: [...base.permisos, 'reportes.ver', 'cupones.ver'] };
    const acc = planificarSync(
      [{ slug: 'finanzas', permisos: base.permisos, permisosSincronizados: base.permisos }],
      ['finanzas'],
      [conNuevo],
    );
    expect(accion(acc, 'finanzas', 'sumar').permisos).toEqual(['cupones.ver']);
  });

  it('un rol predefinido que el admin BORRÓ no se recrea', () => {
    const acc = planificarSync([], ['marketing'], [def('marketing')]);
    expect(accion(acc, 'marketing', 'omitir')).toBeTruthy();
    expect(accion(acc, 'marketing', 'crear')).toBeFalsy();
  });

  it('no sube privilegios a un rol propio que ya usaba un slug nuevo (ni ahora ni después)', () => {
    const acc = planificarSync([{ slug: 'auditor', permisos: ['web.acceso'] }], [], [def('auditor')]);
    expect(accion(acc, 'auditor', 'sumar')).toBeFalsy();
    expect(accion(acc, 'auditor', 'excluir')).toBeTruthy();
    // En arranques siguientes queda marcado sinSync y no recibe nada nuevo.
    const despues = planificarSync([{ slug: 'auditor', permisos: ['web.acceso'], sinSync: true }], ['auditor'], [def('auditor')]);
    expect(accion(despues, 'auditor', 'sumar')).toBeFalsy();
  });

  it('los roles de antes de la Fase 3 reciben lo suyo en la primera sincronización', () => {
    const acc = planificarSync([{ slug: 'vendedor', permisos: ['web.acceso', 'establecimientos.ver', 'establecimientos.editar'] }], [], [def('vendedor')]);
    expect(accion(acc, 'vendedor', 'sumar').permisos).toEqual(['establecimientos.crear']);
  });

  it('admin siempre completa el catálogo', () => {
    const acc = planificarSync([{ slug: 'admin', permisos: ['web.acceso'], permisosSincronizados: TODOS_LOS_PERMISOS }], ['admin'], [def('admin')]);
    expect(accion(acc, 'admin', 'sumar').permisos.length).toBe(TODOS_LOS_PERMISOS.length - 1);
  });
});
