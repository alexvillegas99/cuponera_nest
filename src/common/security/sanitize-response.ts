import type { NextFunction, Request, Response } from 'express';

/**
 * Elimina de TODAS las respuestas JSON los datos sensibles, incluidas las
 * que se envían a mano con @Res(): hashes de contraseña y códigos OTP.
 *
 * `clave` y `password` solo se quitan si contienen un hash bcrypt, porque
 * `clave` también es el nombre legítimo de permisos y configuraciones.
 */
const SIEMPRE = new Set(['contratoOtp', 'contratoOtpHash', 'hashedCode', 'resetGrantUntil', 'resetGrantUsed']);
const SI_ES_HASH = new Set(['clave', 'password']);
const BCRYPT = /^\$2[aby]\$\d{2}\$/;

function limpiar(valor: any, ancestros: WeakSet<object>, prof: number): any {
  if (valor === null || typeof valor !== 'object' || prof > 25) return valor;

  const proto = Object.getPrototypeOf(valor);
  const esPlano = Array.isArray(valor) || proto === Object.prototype || proto === null;
  if (!esPlano) {
    // Documentos de Mongoose, ObjectId, Date…: usar su forma JSON.
    if (typeof valor.toJSON === 'function') {
      const j = valor.toJSON();
      return j === valor ? j : limpiar(j, ancestros, prof + 1);
    }
    return valor;
  }

  // Solo se cortan ciclos reales (el objeto es su propio ancestro). Un mismo
  // objeto puede aparecer varias veces en la respuesta (p. ej. populate).
  if (ancestros.has(valor)) return undefined;
  ancestros.add(valor);
  try {
    if (Array.isArray(valor)) return valor.map((v) => limpiar(v, ancestros, prof + 1));
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(valor)) {
      if (SIEMPRE.has(k)) continue;
      if (SI_ES_HASH.has(k) && typeof v === 'string' && BCRYPT.test(v)) continue;
      out[k] = limpiar(v, ancestros, prof + 1);
    }
    return out;
  } finally {
    ancestros.delete(valor);
  }
}

export function sanitizeResponseMiddleware(_req: Request, res: Response, next: NextFunction) {
  const original = res.json.bind(res);
  res.json = (body?: any) => original(limpiar(body, new WeakSet(), 0));
  next();
}
