import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/** Rechaza tokens de CLIENTE: la ruta es exclusiva de usuarios del panel. */
@Injectable()
export class UsuarioKindGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (user?.kind !== 'USUARIO') {
      throw new ForbiddenException('Acción reservada al personal de Enjoy y establecimientos');
    }
    return true;
  }
}
