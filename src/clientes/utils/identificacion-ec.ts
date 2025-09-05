// src/clientes/utils/identificacion-ec.ts
export function validarCedulaEc(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const prov = parseInt(cedula.slice(0, 2), 10);
  if (prov < 1 || prov > 24) return false;
  const d = cedula.split('').map((n) => parseInt(n, 10));
  const verificador = d[9];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let mult = d[i] * (i % 2 === 0 ? 2 : 1);
    if (mult > 9) mult -= 9;
    suma += mult;
  }
  const decena = Math.ceil(suma / 10) * 10;
  const digito = (decena - suma) % 10;
  return digito === verificador;
}

export function validarRucEc(ruc: string): boolean {
  // Simplificada: 13 dígitos, termina con 001, prefijo de provincia válido.
  if (!/^\d{13}$/.test(ruc)) return false;
  const prov = parseInt(ruc.slice(0, 2), 10);
  if (prov < 1 || prov > 24) return false;
  if (ruc.slice(-3) !== '001') return false;
  // Tipos: públicas (20-24), privadas (10-19), natural (cedula+001)
  const tercer = parseInt(ruc[2], 10);
  if (tercer < 0 || tercer > 9) return false;

  // Caso natural: validar cédula base
  if (tercer < 6) return validarCedulaEc(ruc.slice(0, 10));
  // (Opcional) implementar validación completa para públicas/privadas.
  return true;
}
