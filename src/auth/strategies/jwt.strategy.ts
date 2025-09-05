import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClientesService } from 'src/clientes/clientes.service';
import { JWT_SECRET } from 'src/config/config.env';
import { UsuariosService } from 'src/usuarios/usuarios.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usuarioService: UsuariosService,
    private readonly configService: ConfigService,
      private readonly clientesService: ClientesService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(JWT_SECRET)!,
    });
  }

 async validate(payload: any) {
    const { sub: id, kind } = payload as { sub: string; kind?: 'USUARIO' | 'CLIENTE' };

    // Por compatibilidad: si no viene kind, asumimos USUARIO
    if (kind === 'CLIENTE') {
      const cliente = await this.clientesService.findById(id).catch(() => null);
      if (!cliente) throw new UnauthorizedException('Token inválido o cliente no encontrado');
      // Lo que retornas aquí queda en req.user
      return { ...cliente, kind: 'CLIENTE' };
    } else {
      const usuario = await this.usuarioService.findById(id).catch(() => null);
      if (!usuario) throw new UnauthorizedException('Token inválido o usuario no encontrado');
      return { ...usuario, kind: 'USUARIO' };
    }
  }
}
