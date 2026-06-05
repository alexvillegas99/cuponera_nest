import { BadRequestException } from '@nestjs/common';

/**
 * Valida que una clave cumpla los controles mínimos de seguridad.
 * Reglas: mínimo 8 caracteres, al menos una minúscula, una mayúscula y un número.
 * Lanza BadRequestException con un mensaje claro si no cumple.
 */
export function validarClaveSegura(password?: string): void {
  const p = (password ?? '').trim();
  const errores: string[] = [];
  if (p.length < 8) errores.push('al menos 8 caracteres');
  if (!/[a-z]/.test(p)) errores.push('una letra minúscula');
  if (!/[A-Z]/.test(p)) errores.push('una letra mayúscula');
  if (!/\d/.test(p)) errores.push('un número');

  if (errores.length) {
    throw new BadRequestException(
      `La contraseña debe tener ${errores.join(', ')}.`,
    );
  }
}
