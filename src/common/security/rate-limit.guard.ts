import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const KEY = 'rate-limit';
type Regla = { max: number; ventanaMs: number };
const hits = new Map<string, number[]>();

/**
 * Límite simple por cuenta (email) o, si no hay email, por IP + ruta (en memoria del proceso). Suficiente para frenar
 * fuerza bruta de OTP y spam de correos en una instancia; si el backend corre
 * en varias instancias, reemplazar por @nestjs/throttler con almacenamiento compartido.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const regla = this.reflector.get<Regla>(KEY, ctx.getHandler());
    if (!regla) return true;
    const req = ctx.switchToHttp().getRequest();
    // Se limita por CUENTA (email del cuerpo) cuando existe: la IP se puede
    // falsificar con X-Forwarded-For, el email objetivo no.
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    // Orden: cuenta objetivo (email) > sesión > id de la ruta > IP. La IP es
    // el último recurso: se falsifica con X-Forwarded-For y la comparten
    // muchos usuarios detrás del mismo NAT de la operadora.
    const sujeto = email
      ? `email:${email}`
      : req.user?._id
        ? `user:${req.user._id}`
        : req.params?.id
          ? `id:${req.params.id}`
          : `ip:${req.ip || 'desconocida'}`;
    const clave = `${sujeto}|${req.method}|${req.route?.path ?? req.url}`;
    const ahora = Date.now();
    const recientes = (hits.get(clave) ?? []).filter((t) => ahora - t < regla.ventanaMs);
    if (recientes.length >= regla.max) {
      throw new HttpException('Demasiadas solicitudes. Intenta en unos minutos.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recientes.push(ahora);
    hits.set(clave, recientes);
    if (hits.size > 10000) hits.clear(); // evita crecer sin límite
    return true;
  }
}

/** @RateLimit(5, 15 * 60_000) → máx. 5 solicitudes por cuenta/IP cada 15 min. */
export const RateLimit = (max: number, ventanaMs: number) =>
  applyDecorators(SetMetadata(KEY, { max, ventanaMs }), UseGuards(RateLimitGuard));
