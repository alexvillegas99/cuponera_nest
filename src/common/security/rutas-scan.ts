import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../../auth/decorators/permissions.decorator';

/**
 * Inventario de rutas a partir de los METADATOS reales de Nest (no del texto):
 * importa cada controlador y lee ruta, método HTTP y guards de clase y de
 * método. Una ruta está protegida solo si lleva `JwtAuthGuard` (lo ponen
 * @Auth() y @AuthUsuario()). Un guard que no autentica (RateLimit, el JWT
 * opcional) NO cuenta. Comentarios u orden de decoradores no influyen.
 */
export interface RutaEscaneada {
  clave: string; // "GET /usuarios/:id"
  archivo: string;
  protegida: boolean;
  permisos: string[];
}

const GUARD_SESION = 'JwtAuthGuard';

function archivosTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...archivosTs(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const unir = (...partes: string[]) =>
  ('/' + partes.filter(Boolean).join('/')).replace(/\/+/g, '/').replace(/\/$/, '') || '/';

const nombreGuard = (g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name ?? '');

export function escanearRutas(srcDir: string): RutaEscaneada[] {
  const rutas: RutaEscaneada[] = [];
  // Solo archivos que declaran un @Controller (sin importar el nombre del archivo).
  for (const archivo of archivosTs(srcDir).filter((f) => /@Controller\(/.test(fs.readFileSync(f, 'utf8')))) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(archivo);
    let aporto = false;
    for (const exp of Object.values<any>(mod)) {
      if (typeof exp !== 'function') continue;
      const prefijos = Reflect.getMetadata(PATH_METADATA, exp);
      if (prefijos === undefined) continue; // no es un controlador
      aporto = true;
      const guardsClase: any[] = Reflect.getMetadata(GUARDS_METADATA, exp) ?? [];
      const permisosClase: string[] = Reflect.getMetadata(PERMISSIONS_KEY, exp) ?? [];
      // Métodos propios y heredados (controladores base).
      const nombres = new Set<string>();
      for (let p = exp.prototype; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
        for (const n of Object.getOwnPropertyNames(p)) if (n !== 'constructor') nombres.add(n);
      }
      for (const nombre of nombres) {
        const handler = exp.prototype[nombre];
        if (typeof handler !== 'function') continue;
        const metodo = Reflect.getMetadata(METHOD_METADATA, handler);
        const subrutas = Reflect.getMetadata(PATH_METADATA, handler);
        if (metodo === undefined || subrutas === undefined) continue;
        const guards = [...guardsClase, ...(Reflect.getMetadata(GUARDS_METADATA, handler) ?? [])];
        const protegida = guards.some((g) => nombreGuard(g) === GUARD_SESION);
        const permisos = [...permisosClase, ...(Reflect.getMetadata(PERMISSIONS_KEY, handler) ?? [])];
        for (const pre of [].concat(prefijos)) {
          for (const sub of [].concat(subrutas)) {
            rutas.push({
              clave: `${RequestMethod[metodo]} ${unir(String(pre ?? ''), String(sub ?? ''))}`,
              archivo: path.relative(srcDir, archivo),
              protegida,
              permisos,
            });
          }
        }
      }
    }
    if (!aporto) {
      // Un @Controller que no se exporta no se puede revisar: que falle la prueba.
      rutas.push({ clave: `?? controlador no exportado`, archivo: path.relative(srcDir, archivo), protegida: false, permisos: [] });
    }
  }
  return rutas.sort((a, b) => a.clave.localeCompare(b.clave));
}

/** Permisos citados en el código fuera de decoradores: `permisos.includes('x.y')`. */
export function permisosEnCodigo(srcDir: string): Array<{ permiso: string; archivo: string }> {
  const out: Array<{ permiso: string; archivo: string }> = [];
  for (const f of archivosTs(srcDir)) {
    if (f.endsWith('rutas-scan.ts')) continue;
    // Sin comentarios, para no contar código desactivado.
    const s = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const q of s.matchAll(/\.includes\(\s*'([a-z-]+\.[a-z-]+)'\s*\)/g)) {
      out.push({ permiso: q[1], archivo: path.relative(srcDir, f) });
    }
    for (const q of s.matchAll(/tienePermiso\([^)]*\)/g)) {
      for (const r of q[0].matchAll(/'([a-z-]+\.[a-z-]+)'/g)) out.push({ permiso: r[1], archivo: path.relative(srcDir, f) });
    }
    for (const q of s.matchAll(/assertClienteOPermiso\([^)]*\)/g)) {
      for (const r of q[0].matchAll(/'([a-z-]+\.[a-z-]+)'/g)) out.push({ permiso: r[1], archivo: path.relative(srcDir, f) });
    }
  }
  return out;
}
