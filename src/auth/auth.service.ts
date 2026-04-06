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
import { RolesService } from 'src/roles/roles.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';

@Injectable()
export class AuthService {
  logger: Logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly usuariosService: UsuariosService,
    private readonly clienteService: ClientesService,
    private readonly mailService: MailService,
    private readonly dateService: DateTimeService,
    private readonly rolesService: RolesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async loginUsuario(
    { correo, clave }: { correo: string; clave: string },
    ip,
    ubicacion,
    dispositivo,
  ) {
    const user: any = await this.usuariosService.findByEmail(correo);
    if (!user) {
      this.auditoria.registrar({
        accion: 'auth.login_fallido',
        modulo: 'auth',
        descripcion: `Login fallido: email no encontrado (${correo})`,
        ip,
        severidad: 'warning',
      });
      throw new UnauthorizedException(
        'Credenciales inválidas. Por favor, inténtalo de nuevo.',
      );
    }
    if (!user.estado) {
      this.auditoria.registrar({
        accion: 'auth.login_bloqueado',
        modulo: 'auth',
        descripcion: `Login bloqueado: usuario desactivado (${correo})`,
        usuarioId: user._id?.toString(),
        usuarioNombre: user.nombre,
        usuarioEmail: user.email,
        ip,
        severidad: 'warning',
      });
      throw new UnauthorizedException('Usuario desactivado, comuniquese con el administrador');
    }
    const isPasswordValid = await bcrypt.compare(clave, user.clave);
    if (!isPasswordValid) {
      this.auditoria.registrar({
        accion: 'auth.login_fallido',
        modulo: 'auth',
        descripcion: `Login fallido: contraseña incorrecta (${correo})`,
        usuarioId: user._id?.toString(),
        usuarioNombre: user.nombre,
        usuarioEmail: user.email,
        ip,
        severidad: 'warning',
      });
      throw new UnauthorizedException(
        'Credenciales inválidas. Por favor, inténtalo de nuevo.',
      );
    }

    const payload = { sub: user._id, kind: 'USUARIO' as const }; // 👈 añade kind
    const accessToken = this.jwtService.sign(payload);
    const fecha = this.dateService.formatEC();
    const html = this.mailService.getTemplate('login.html', {
      nombre: user.nombre,
      fecha: fecha,
      ubicacion,
      ip,
      dispositivo,
    });
    await this.mailService.enviar(user.email, 'Inicio de sesión', html);
    this.usuariosService.actualizarUltimaConeccion(user._id);

    // Auditoría de login
    this.auditoria.registrar({
      accion: 'auth.login',
      modulo: 'auth',
      descripcion: `Inicio de sesión: ${user.nombre} (${user.email})`,
      usuarioId: user._id?.toString(),
      usuarioNombre: user.nombre,
      usuarioEmail: user.email,
      ip: ip,
      severidad: 'info',
    });

    // Adjuntar permisos del rol al usuario
    const permisos = await this.rolesService.getPermisosForUsuario(user);
    return { accessToken, user: { ...user, permisos } };
  }

  async loginCliente(
    { correo, clave }: { correo: string; clave: string },
    ip,
    ubicacion,
    dispositivo,
  ) {
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
      dispositivo,
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
