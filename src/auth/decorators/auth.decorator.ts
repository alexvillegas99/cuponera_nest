import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
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
