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
import axios from 'axios';
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
    const userObj = user.toObject ? user.toObject() : { ...user };
    return { accessToken, user: { ...userObj, _id: userObj._id?.toString(), permisos } };
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

  private async _verifyGoogleToken(idToken: string) {
    try {
      const { data } = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
      );
      if (data.email_verified !== 'true') {
        throw new UnauthorizedException('El email de Google no está verificado');
      }
      return data as { email: string; given_name?: string; family_name?: string; sub: string };
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token de Google inválido');
    }
  }

  async loginWithGoogle(idToken: string, ip: string, ubicacion: string, dispositivo: string) {
    const gp = await this._verifyGoogleToken(idToken);
    const email = gp.email;
    const nombres = gp.given_name ?? email.split('@')[0];
    const apellidos = gp.family_name ?? '';
    const googleId = gp.sub;

    const cliente: any = await this.clienteService.findByEmail(email);

    if (cliente) {
      const accessToken = this.jwtService.sign({ sub: cliente._id, kind: 'CLIENTE' as const });
      const fecha = this.dateService.formatEC();
      const html = this.mailService.getTemplate('login.html', {
        nombre: cliente.nombres + ' ' + cliente.apellidos,
        fecha,
        ubicacion,
        ip,
        dispositivo,
      });
      await this.mailService.enviar(cliente.email, 'Inicio de sesión', html);
      return { registered: true, accessToken, cliente };
    }

    return { registered: false, googleData: { nombres, apellidos, email, googleId } };
  }

  async loginUsuarioWithGoogle(idToken: string, ip: string, ubicacion: string, dispositivo: string) {
    const gp = await this._verifyGoogleToken(idToken);

    const user: any = await this.usuariosService.findByEmail(gp.email);
    if (!user) {
      throw new UnauthorizedException(
        'No existe una cuenta de empresa con ese correo de Google.',
      );
    }
    if (!user.estado) {
      throw new UnauthorizedException('Usuario desactivado, comuníquese con el administrador.');
    }

    const accessToken = this.jwtService.sign({ sub: user._id, kind: 'USUARIO' as const });
    const permisos = await this.rolesService.getPermisosForUsuario(user);
    const fecha = this.dateService.formatEC();
    const html = this.mailService.getTemplate('login.html', {
      nombre: user.nombre,
      fecha,
      ubicacion,
      ip,
      dispositivo,
    });
    await this.mailService.enviar(user.email, 'Inicio de sesión', html);
    const userObj = user.toObject ? user.toObject() : { ...user };
    return { accessToken, user: { ...userObj, _id: userObj._id?.toString(), permisos } };
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
