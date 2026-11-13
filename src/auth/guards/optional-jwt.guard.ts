import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT opcional: si llega un token válido deja `req.user`; si no llega (o no
 * es válido) sigue sin usuario. Para rutas que la app publicada aún llama sin
 * token (Fase 5: pasarán a exigir sesión).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(_err: any, user: any) {
    return user || null;
  }
}
