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
import { DateTimeService } from 'src/common/services/dateTimeService';
import { JWT_EXPIRES_IN, JWT_SECRET } from 'src/config/config.env';
import { MailService } from 'src/mail/mail.service';
import { UsuariosService } from 'src/usuarios/usuarios.service';

@Injectable()
export class AuthService {
  logger: Logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usuariosService: UsuariosService,
    private readonly clienteService: ClientesService,
    private readonly mailService: MailService,
    private readonly dateService: DateTimeService,
  ) {}

  async loginUsuario({ correo, clave }: { correo: string; clave: string },ip,ubicacion,dispositivo) {
    const user: any = await this.usuariosService.findByEmail(correo);
    console.log(user);
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');

    const isPasswordValid = await bcrypt.compare(clave, user.clave);
    if (!isPasswordValid)
      throw new UnauthorizedException('Credenciales incorrectas');

    const payload = { sub: user._id, kind: 'USUARIO' as const }; // 👈 añade kind
    const accessToken = this.jwtService.sign(payload);
    const fecha = this.dateService.formatEC();
    const html = this.mailService.getTemplate('login.html', {
      nombre: user.nombre,
      fecha: fecha,
      ubicacion,
      ip,
      dispositivo
    });
      await this.mailService.enviar(user.email, 'Inicio de sesión', html);
    return { accessToken, user };
  }

  async loginCliente({ correo, clave }: { correo: string; clave: string },ip,ubicacion,dispositivo) {
    const cli: any = await this.clienteService.findByEmail(correo, true);
    if (!cli) throw new UnauthorizedException('Credenciales incorrectas');

    const ok = await this.clienteService.validatePassword(clave, cli.password);
    if (!ok) throw new UnauthorizedException('Credenciales incorrectas');

    const payload = { sub: cli._id, kind: 'CLIENTE' as const }; // ya lo tienes
    const accessToken = this.jwtService.sign(payload);

    delete cli.password;
     const fecha = this.dateService.formatEC();
    const html = this.mailService.getTemplate('login.html', {
      nombre: cli.nombres + ' ' + cli.apellidos,
      fecha: fecha,
      ubicacion,
      ip,
      dispositivo
    });
      await this.mailService.enviar(cli.email, 'Inicio de sesión', html);
    return { accessToken, cliente: cli };
  }

  generateRefreshToken(userId: string) {
    console.log(userId, 'userId');
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
