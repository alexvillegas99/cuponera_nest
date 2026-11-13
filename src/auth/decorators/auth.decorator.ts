import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { UsuarioKindGuard } from '../guards/usuario-kind.guard';
import { PERMISSIONS_KEY } from './permissions.decorator';

export function Auth(...permissions: string[]) {
  const decorators: (ClassDecorator | MethodDecorator | PropertyDecorator)[] = [
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'No tiene permisos para realizar esta acción',
    }),
  ];

  if (permissions.length > 0) {
    decorators.push(
      SetMetadata(PERMISSIONS_KEY, permissions),
      UseGuards(PermissionsGuard),
    );
  }

  return applyDecorators(...decorators);
}

/**
 * Igual que @Auth(), pero además exige que el token sea de un USUARIO del
 * panel (nunca de un CLIENTE). Si se pasan permisos, basta con tener uno.
 */
export function AuthUsuario(...permissions: string[]) {
  const decorators: (ClassDecorator | MethodDecorator | PropertyDecorator)[] = [
    UseGuards(JwtAuthGuard, UsuarioKindGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'No tiene permisos para realizar esta acción',
    }),
  ];
  if (permissions.length > 0) {
    decorators.push(
      SetMetadata(PERMISSIONS_KEY, permissions),
      UseGuards(PermissionsGuard),
    );
  }
  return applyDecorators(...decorators);
}
