import * as path from 'path';
import { escanearRutas, permisosEnCodigo } from './rutas-scan';
import { RUTAS_PUBLICAS } from './rutas-publicas';
import { TODOS_LOS_PERMISOS } from '../../roles/constants/permisos.constant';

const SRC = path.resolve(__dirname, '../..');
let rutas: ReturnType<typeof escanearRutas>;

beforeAll(() => {
  rutas = escanearRutas(SRC);
}, 60_000);

describe('Rutas protegidas (metadatos reales de Nest)', () => {
  it('encuentra las rutas de los controladores', () => {
    expect(rutas.length).toBeGreaterThan(200);
  });

  it('toda ruta sin sesión está en la lista de rutas públicas', () => {
    const sinListar = rutas
      .filter((r) => !r.protegida && !RUTAS_PUBLICAS[r.clave])
      .map((r) => `${r.clave}  (${r.archivo})`);
    // Si falla: protege la ruta con @Auth()/@AuthUsuario('permiso') o, si de
    // verdad debe ser pública, agrégala a rutas-publicas.ts con su motivo.
    expect(sinListar).toEqual([]);
  });

  it('la lista de rutas públicas no tiene entradas viejas', () => {
    const publicasHoy = new Set(rutas.filter((r) => !r.protegida).map((r) => r.clave));
    const sobran = Object.keys(RUTAS_PUBLICAS).filter((k) => !publicasHoy.has(k));
    // Si falla: la ruta ya se protegió o se borró → quítala de rutas-publicas.ts.
    expect(sobran).toEqual([]);
  });
});

describe('Permisos', () => {
  it('los de los decoradores existen en el catálogo (sin erratas)', () => {
    const malos = rutas
      .flatMap((r) => r.permisos.map((p) => ({ p, r })))
      .filter(({ p }) => !TODOS_LOS_PERMISOS.includes(p))
      .map(({ p, r }) => `${p}  (${r.clave})`);
    expect(malos).toEqual([]);
  });

  it('los citados en el código existen en el catálogo', () => {
    const malos = permisosEnCodigo(SRC)
      .filter((u) => !TODOS_LOS_PERMISOS.includes(u.permiso))
      .map((u) => `${u.permiso}  (${u.archivo})`);
    expect(malos).toEqual([]);
  });
});
