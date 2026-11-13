import { ForbiddenException } from '@nestjs/common';

/**
 * Reglas de "dueño" reutilizables (Fase 5).
 *  - Un CLIENTE solo actúa sobre su propio id (el de la sesión).
 *  - Un USUARIO del panel necesita el permiso indicado.
 */
export const esCliente = (user: any) => user?.kind === 'CLIENTE';

export const tienePermiso = (user: any, ...permisos: string[]) =>
  !esCliente(user) && permisos.some((p) => (user?.permisos ?? []).includes(p));

/** Lanza 403 salvo que sea el propio cliente o personal con alguno de los permisos. */
export function assertClienteOPermiso(user: any, clienteId: string, ...permisos: string[]) {
  const propio = esCliente(user) && String(user._id) === String(clienteId);
  if (!propio && !tienePermiso(user, ...permisos)) {
    throw new ForbiddenException('No puedes acceder a datos de otra cuenta');
  }
}

/** Para rutas solo de clientes: devuelve el id de la sesión (ignora el que venga en la petición). */
export function clienteDeSesion(user: any): string {
  if (!esCliente(user)) throw new ForbiddenException('Solo para clientes');
  return String(user._id);
}
