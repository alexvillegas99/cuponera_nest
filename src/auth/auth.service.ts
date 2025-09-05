import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { JwtService, JwtModule } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { ClientesService } from 'src/clientes/clientes.service';
import { JWT_EXPIRES_IN, JWT_SECRET } from 'src/config/config.env';
import { UsuariosService } from 'src/usuarios/usuarios.service';

@Injectable()
export class AuthService {
  logger: Logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usuariosService: UsuariosService,
    private readonly clienteService: ClientesService,
  ) {}

async loginUsuario({ correo, clave }: { correo: string; clave: string }) {
  const user: any = await this.usuariosService.findByEmail(correo);
  if (!user) throw new UnauthorizedException('Credenciales incorrectas');

  const isPasswordValid = await bcrypt.compare(clave, user.clave);
  if (!isPasswordValid) throw new UnauthorizedException('Credenciales incorrectas');

  const payload = { sub: user._id, kind: 'USUARIO' as const }; // 👈 añade kind
  const accessToken = this.jwtService.sign(payload);

  return { accessToken, user };
}

async loginCliente({ correo, clave }: { correo: string; clave: string }) {
  const cli: any = await this.clienteService.findByEmail(correo, true);
  if (!cli) throw new UnauthorizedException('Credenciales incorrectas');

  const ok = await this.clienteService.validatePassword(clave, cli.password);
  if (!ok) throw new UnauthorizedException('Credenciales incorrectas');

  const payload = { sub: cli._id, kind: 'CLIENTE' as const }; // ya lo tienes
  const accessToken = this.jwtService.sign(payload);

  delete cli.password;
  return { accessToken, cliente: cli };
}



  generateRefreshToken(userId: string) {
    console.log(userId,'userId');
    const payload = { sub: userId };
    return this.jwtService.sign(payload, { expiresIn: '7d' }); // Refresh token válido por 7 días
  }

  renewToken(id: string) {
    try {
      const payload = { sub: id };
      return this.jwtService.sign(payload);
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }
}
