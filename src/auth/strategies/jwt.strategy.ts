import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ClientesService } from 'src/clientes/clientes.service';
import { JWT_SECRET } from 'src/config/config.env';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { RolesService } from 'src/roles/roles.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usuarioService: UsuariosService,
    private readonly configService: ConfigService,
    private readonly clientesService: ClientesService,
    private readonly rolesService: RolesService,
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
      return { ...cliente, kind: 'CLIENTE', permisos: [] };
    } else {
      const usuario = await this.usuarioService.findById(id).catch(() => null);
      if (!usuario) throw new UnauthorizedException('Token inválido o usuario no encontrado');

      // Resolver permisos del rol
      const permisos = await this.rolesService.getPermisosForUsuario(usuario);
      return { ...usuario, kind: 'USUARIO', permisos };
    }
  }
}
