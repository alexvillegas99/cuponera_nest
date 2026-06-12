import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { JwtService, JwtModule } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import axios from 'axios';
import { ClientesService } from 'src/clientes/clientes.service';
import { DateTimeService } from 'src/common/services/dateTimeService';
import { JWT_EXPIRES_IN, JWT_SECRET, FIREBASE_API_KEY } from 'src/config/config.env';
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
    private readonly config: ConfigService,
  ) {}

  // Devuelve qué tipos de cuenta existen para un correo (cliente y/o usuario).
  // El mismo correo puede existir en ambas colecciones (unique es por colección).
  async checkAccountTypes(
    correo: string,
  ): Promise<{ cliente: boolean; usuario: boolean }> {
    const email = (correo ?? '').toLowerCase().trim();
    if (!email) return { cliente: false, usuario: false };
    const [cli, usr] = await Promise.all([
      this.clienteService.findByEmail(email),
      this.usuariosService.findByEmail(email),
    ]);
    return { cliente: !!cli, usuario: !!usr };
  }

  // Cambia a la cuenta "hermana" del mismo correo (cliente <-> usuario) usando
  // la sesión actual válida. No pide contraseña: el usuario ya está autenticado.
  async switchAccount(currentUser: any) {
    const email = (currentUser?.email ?? '').toLowerCase().trim();
    if (!email) throw new UnauthorizedException('Sesión inválida');
    const currentKind = currentUser?.kind === 'CLIENTE' ? 'CLIENTE' : 'USUARIO';

    if (currentKind === 'CLIENTE') {
      // Cambiar a USUARIO / empresa
      const user: any = await this.usuariosService.findByEmail(email);
      if (!user) {
        throw new NotFoundException(
          'No tienes una cuenta de empresa con este correo',
        );
      }
      if (user.estado === false) {
        throw new UnauthorizedException('La cuenta de empresa está inactiva');
      }
      const accessToken = this.jwtService.sign({
        sub: user._id,
        kind: 'USUARIO' as const,
      });
      const permisos = await this.rolesService.getPermisosForUsuario(user);
      const userObj = user.toObject ? user.toObject() : { ...user };
      return {
        accessToken,
        kind: 'USUARIO',
        user: { ...userObj, _id: userObj._id?.toString(), permisos },
      };
    } else {
      // Cambiar a CLIENTE
      const cli: any = await this.clienteService.findByEmail(email);
      if (!cli) {
        throw new NotFoundException(
          'No tienes una cuenta de cliente con este correo',
        );
      }
      if (cli.deleted) {
        throw new UnauthorizedException('Esta cuenta ha sido eliminada');
      }
      const accessToken = this.jwtService.sign({
        sub: cli._id,
        kind: 'CLIENTE' as const,
      });
      const cliObj = cli.toObject ? cli.toObject() : { ...cli };
      delete cliObj.password;
      return { accessToken, kind: 'CLIENTE', cliente: cliObj };
    }
  }

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
    if (cli.deleted) throw new UnauthorizedException('Esta cuenta ha sido eliminada');

    // Cuenta creada con redes sociales (sin clave configurada).
    if (!cli.password) {
      throw new UnauthorizedException(
        'Tu usuario no tiene configurada una clave. Realiza la recuperación de credenciales.',
      );
    }

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

  /**
   * Registra un cliente y devuelve un accessToken para iniciar sesión de
   * inmediato (auto-login). Sirve tanto para registro con clave como con
   * redes sociales (en ese caso el cliente queda sin clave).
   */
  async registerCliente(dto: any) {
    const cliente: any = await this.clienteService.create(dto);
    const payload = { sub: cliente._id, kind: 'CLIENTE' as const };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, cliente };
  }

  private async _verifyFirebaseToken(idToken: string, opts: { requireEmailVerified?: boolean; providerLabel?: string } = {}) {
    const { requireEmailVerified = true, providerLabel = 'proveedor social' } = opts;
    try {
      const apiKey = this.config.get<string>(FIREBASE_API_KEY);
      const { data } = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        { idToken },
      );
      const user = data?.users?.[0];
      if (!user) throw new UnauthorizedException(`Token de ${providerLabel} inválido`);
      if (requireEmailVerified && !user.emailVerified)
        throw new UnauthorizedException(`El email de ${providerLabel} no está verificado`);
      return {
        email: user.email as string,
        given_name: user.displayName?.split(' ')[0] as string | undefined,
        family_name: user.displayName?.split(' ').slice(1).join(' ') as string | undefined,
        sub: user.localId as string,
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(`Token de ${providerLabel} inválido`);
    }
  }

  private async _verifyGoogleToken(idToken: string) {
    return this._verifyFirebaseToken(idToken, { requireEmailVerified: true, providerLabel: 'Google' });
  }

  private async _verifyAppleToken(identityToken: string) {
    this.logger.log('🍎 [Apple] Iniciando verificación del identity token...');
    this.logger.log(`🍎 [Apple] Token length: ${identityToken.length} chars`);
    try {
      const decoded = jwt.decode(identityToken, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        this.logger.error('🍎 [Apple] ❌ No se pudo decodificar el token');
        throw new UnauthorizedException('Token de Apple inválido');
      }
      this.logger.log(`🍎 [Apple] Header decodificado: alg=${decoded.header.alg} kid=${decoded.header.kid}`);
      const rawPayload = decoded.payload as Record<string, any>;
      this.logger.log(`🍎 [Apple] Payload claims — iss=${rawPayload.iss} | aud=${rawPayload.aud} | sub=${rawPayload.sub} | exp=${rawPayload.exp ? new Date(rawPayload.exp * 1000).toISOString() : 'N/A'}`);

      this.logger.log('🍎 [Apple] Descargando claves públicas de Apple (JWKS)...');
      const { data: jwks } = await axios.get<{ keys: any[] }>('https://appleid.apple.com/auth/keys');
      this.logger.log(`🍎 [Apple] JWKS recibido: ${jwks.keys.length} claves disponibles`);
      this.logger.log(`🍎 [Apple] kids disponibles: ${jwks.keys.map((k) => k.kid).join(', ')}`);

      const key = jwks.keys.find((k) => k.kid === decoded.header.kid);
      if (!key) {
        this.logger.error(`🍎 [Apple] ❌ No se encontró la clave con kid=${decoded.header.kid}`);
        throw new UnauthorizedException('Clave pública de Apple no encontrada');
      }
      this.logger.log(`🍎 [Apple] Clave encontrada: kid=${key.kid}`);

      const publicKey = crypto.createPublicKey({ key, format: 'jwk' });
      const pem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      this.logger.log('🍎 [Apple] Clave convertida a PEM correctamente');

      const bundleId = this.config.get<string>('APPLE_BUNDLE_ID') ?? 'com.pixelsmart.cuponeraapp';
      this.logger.log(`🍎 [Apple] Verificando JWT — issuer: https://appleid.apple.com | audience: ${bundleId}`);

      const payload = jwt.verify(identityToken, pem, {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        audience: bundleId,
      }) as Record<string, any>;

      this.logger.log(`🍎 [Apple] ✅ JWT verificado correctamente`);
      this.logger.log(`🍎 [Apple] sub: ${payload['sub']}`);
      this.logger.log(`🍎 [Apple] email: ${payload['email']}`);
      this.logger.log(`🍎 [Apple] email_verified: ${payload['email_verified']}`);
      this.logger.log(`🍎 [Apple] exp: ${new Date((payload['exp'] as number) * 1000).toISOString()}`);

      return {
        email: payload['email'] as string,
        given_name: undefined as string | undefined,
        family_name: undefined as string | undefined,
        sub: payload['sub'] as string,
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`🍎 [Apple] ❌ Error verificando token: ${err.name}: ${err.message}`);
      if (err.expiredAt) this.logger.error(`🍎 [Apple] expiredAt: ${err.expiredAt}`);
      this.logger.error(`🍎 [Apple] Stack: ${err.stack}`);
      throw new UnauthorizedException(`Token de Apple inválido (${err.name}: ${err.message})`);
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

  async loginWithApple(idToken: string, ip: string, ubicacion: string, dispositivo: string) {
    this.logger.log(`🍎 [Apple/Cliente] Login iniciado — ip: ${ip} | ubicacion: ${ubicacion} | dispositivo: ${dispositivo}`);
    const ap = await this._verifyAppleToken(idToken);
    const email = ap.email;
    const nombres = ap.given_name ?? email.split('@')[0];
    const apellidos = ap.family_name ?? '';

    this.logger.log(`🍎 [Apple/Cliente] Buscando cliente por email: ${email}`);
    const cliente: any = await this.clienteService.findByEmail(email);

    if (cliente) {
      this.logger.log(`🍎 [Apple/Cliente] ✅ Cliente encontrado: ${cliente._id} — generando accessToken`);
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
      this.logger.log(`🍎 [Apple/Cliente] ✅ Email de notificación enviado a ${cliente.email}`);
      return { registered: true, accessToken, cliente };
    }

    this.logger.log(`🍎 [Apple/Cliente] Cliente no encontrado con email: ${email} → retornando appleData para registro`);
    return { registered: false, appleData: { nombres, apellidos, email } };
  }

  async loginUsuarioWithApple(idToken: string, ip: string, ubicacion: string, dispositivo: string) {
    this.logger.log(`🍎 [Apple/Usuario] Login iniciado — ip: ${ip} | ubicacion: ${ubicacion} | dispositivo: ${dispositivo}`);
    const ap = await this._verifyAppleToken(idToken);

    this.logger.log(`🍎 [Apple/Usuario] Buscando usuario por email: ${ap.email}`);
    const user: any = await this.usuariosService.findByEmail(ap.email);
    if (!user) {
      this.logger.warn(`🍎 [Apple/Usuario] ❌ No existe usuario con email: ${ap.email}`);
      throw new UnauthorizedException('No existe una cuenta de empresa con ese Apple ID.');
    }
    if (!user.estado) {
      this.logger.warn(`🍎 [Apple/Usuario] ❌ Usuario desactivado: ${user._id}`);
      throw new UnauthorizedException('Usuario desactivado, comuníquese con el administrador.');
    }

    this.logger.log(`🍎 [Apple/Usuario] ✅ Usuario encontrado: ${user._id} — generando accessToken`);
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
    this.logger.log(`🍎 [Apple/Usuario] ✅ Email de notificación enviado a ${user.email}`);
    const userObj = user.toObject ? user.toObject() : { ...user };
    return { accessToken, user: { ...userObj, _id: userObj._id?.toString(), permisos } };
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

  renewToken(id: string, kind: 'USUARIO' | 'CLIENTE' = 'USUARIO') {
    try {
      const payload = { sub: id, kind };
      return this.jwtService.sign(payload);
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }
}
