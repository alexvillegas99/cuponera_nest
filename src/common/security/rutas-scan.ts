import * as fs from 'fs';
import * as path from 'path';

/**
 * Escáner estático de controladores (sin levantar Nest). Lo usan las pruebas
 * de seguridad para detectar:
 *  - rutas nuevas que quedaron sin sesión ni permiso;
 *  - permisos usados en el código que no existen en el catálogo.
 */
export interface RutaEscaneada {
  clave: string; // "GET /usuarios/:id"
  archivo: string;
  protegida: boolean;
}

const RE_RUTA = /@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)?\s*\)/g;
const PROTECCION = /@(Auth|AuthUsuario)\(|@UseGuards\(|@RequiereSesion\(/;

function archivosControladores(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...archivosControladores(p));
    else if (e.name.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}

const unir = (a: string, b: string) =>
  ('/' + [a, b].filter(Boolean).join('/')).replace(/\/+/g, '/').replace(/\/$/, '') || '/';

export function escanearRutas(srcDir: string): RutaEscaneada[] {
  const rutas: RutaEscaneada[] = [];
  for (const archivo of archivosControladores(srcDir)) {
    const s = fs.readFileSync(archivo, 'utf8');
    const iClase = s.indexOf('export class');
    if (iClase < 0) continue;
    const cabecera = s.slice(0, iClase);
    const mCtrl = cabecera.match(/@Controller\(\s*(?:'([^']*)'|"([^"]*)")?\s*\)/);
    const prefijo = mCtrl ? (mCtrl[1] ?? mCtrl[2] ?? '') : '';
    // Decoradores de clase: los que van después del último import.
    const iUltimoImport = cabecera.lastIndexOf('import ');
    const decoradoresClase = cabecera.slice(cabecera.indexOf('\n', iUltimoImport));
    const claseProtegida = PROTECCION.test(decoradoresClase);

    const cuerpo = s.slice(iClase);
    const matches = [...cuerpo.matchAll(RE_RUTA)];
    matches.forEach((m, k) => {
      const metodo = m[1].toUpperCase();
      const sub = m[2] ?? m[3] ?? m[4] ?? '';
      // Bloque de decoradores: desde la ruta hasta la firma del método.
      const desde = m.index!;
      const resto = cuerpo.slice(desde);
      const firma = resto.search(/\n\s*(?:public\s+|private\s+)?(?:async\s+)?[A-Za-z_]\w*\s*\(/);
      let bloque = firma > 0 ? resto.slice(0, firma) : resto.slice(0, 400);
      // Decoradores que van ANTES de la ruta (p. ej. @Auth() encima de @Get()).
      const anterior = k > 0 ? matches[k - 1].index! : 0;
      const previo = cuerpo.slice(anterior, desde);
      const iFinPrevio = Math.max(previo.lastIndexOf('}\n'), previo.lastIndexOf(';\n'));
      bloque = previo.slice(iFinPrevio > 0 ? iFinPrevio : 0) + bloque;
      rutas.push({
        clave: `${metodo} ${unir(prefijo, sub)}`,
        archivo: path.relative(srcDir, archivo),
        protegida: claseProtegida || PROTECCION.test(bloque),
      });
    });
  }
  return rutas.sort((a, b) => a.clave.localeCompare(b.clave));
}

/** Permisos citados en el código: @Auth('x.y'), @AuthUsuario(...), includes('x.y'). */
export function permisosUsados(srcDir: string): Array<{ permiso: string; archivo: string }> {
  const out: Array<{ permiso: string; archivo: string }> = [];
  const visitar = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) visitar(p);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') && e.name !== 'rutas-scan.ts') {
        const s = fs.readFileSync(p, 'utf8');
        for (const m of s.matchAll(/@(?:Auth|AuthUsuario)\(([^)]*)\)/g)) {
          for (const q of m[1].matchAll(/'([a-z-]+\.[a-z-]+)'/g)) out.push({ permiso: q[1], archivo: path.relative(srcDir, p) });
        }
        for (const q of s.matchAll(/permisos[^\n]*?\.includes\(\s*'([a-z-]+\.[a-z-]+)'\s*\)/g)) {
          out.push({ permiso: q[1], archivo: path.relative(srcDir, p) });
        }
      }
    }
  };
  visitar(srcDir);
  return out;
}
