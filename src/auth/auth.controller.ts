import { Controller, Post, Body, Logger, Req, Res, Get, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';

import { Auth } from './decorators/auth.decorator';
import { GetUser } from './decorators';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { IpDetailsInterceptor } from 'src/common/interceptors';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usuariosService: UsuariosService,
  ) {}
  logger: Logger = new Logger(AuthController.name);

  @ApiOperation({ summary: 'Autentica al usuario con email y contraseña' })
  @Post('login')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        correo: { type: 'string' },
        clave: { type: 'string' },
      },
      example: {
        correo: 'avillegas7510@gmail.com',
        clave: '123456',
      },
    },
  })
  @UseInterceptors(IpDetailsInterceptor)
  async loginUser(
    @Body() body: { correo: string; clave: string },
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const ua = req['ua'];
    const ip = req['ipd'];
    const ipQuery = ip?.query ?? 'Desconocida';
    const ubicacion = (ip?.city && ip?.country) ? `${ip.city} - ${ip.country}` : 'Red interna';
    const dispositivo = (ua?.os?.name ?? 'Desconocido') + (ua?.device?.vendor ? ` · ${ua.device.vendor}` : '');
    const result = await this.authService.loginUsuario(body,ipQuery,ubicacion,dispositivo);
    return res.status(200).json(result);
  } 


  @ApiOperation({ summary: 'Login de cliente (email/clave)' })
  @Post('login/cliente')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { correo: { type: 'string' }, clave: { type: 'string' } },
      example: { correo: 'cliente@mail.com', clave: '123456' },
    },
  })
    @UseInterceptors(IpDetailsInterceptor)
  async loginCliente(@Body() body: { correo: string; clave: string }, @Res() res: Response,   @Req() req: Request,) {
     const ua = req['ua'];
    const ip = req['ipd'];
    const ipQuery = ip?.query ?? 'Desconocida';
    const ubicacion = (ip?.city && ip?.country) ? `${ip.city} - ${ip.country}` : 'Red interna';
    const dispositivo = (ua?.os?.name ?? 'Desconocido') + (ua?.device?.vendor ? ` · ${ua.device.vendor}` : '');
    const result = await this.authService.loginCliente(body,ipQuery,ubicacion,dispositivo);
    return res.status(200).json(result);
  }

  @ApiOperation({
    summary: 'Tipos de cuenta existentes para un correo (cliente y/o usuario)',
  })
  @Post('account-types')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { correo: { type: 'string' } },
      example: { correo: 'usuario@ejemplo.com' },
    },
  })
  async accountTypes(
    @Body() body: { correo: string },
    @Res() res: Response,
  ) {
    const result = await this.authService.checkAccountTypes(body?.correo);
    return res.status(200).json(result);
  }

  @ApiOperation({ summary: 'Registro de cliente con auto-login (devuelve accessToken)' })
  @Post('register/cliente')
  async registerCliente(@Body() dto: any, @Res() res: Response) {
    const result = await this.authService.registerCliente(dto);
    return res.status(201).json(result);
  }

  @ApiOperation({ summary: 'Login de cliente con Google (Firebase ID token)' })
  @Post('google/cliente')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { idToken: { type: 'string' } },
      example: { idToken: 'eyJhbGciOi...' },
    },
  })
  @UseInterceptors(IpDetailsInterceptor)
  async loginWithGoogle(@Body() body: { idToken: string }, @Res() res: Response, @Req() req: Request) {
    const ua = req['ua'];
    const ip = req['ipd'];
    const ipQuery = ip?.query ?? 'Desconocida';
    const ubicacion = (ip?.city && ip?.country) ? `${ip.city} - ${ip.country}` : 'Red interna';
    const dispositivo = (ua?.os?.name ?? 'Desconocido') + (ua?.device?.vendor ? ` · ${ua.device.vendor}` : '');
    const result = await this.authService.loginWithGoogle(body.idToken, ipQuery, ubicacion, dispositivo);
    return res.status(200).json(result);
  }

  @ApiOperation({ summary: 'Login de usuario/empresa con Google (Firebase ID token)' })
  @Post('google/usuario')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { idToken: { type: 'string' } },
      example: { idToken: 'eyJhbGciOi...' },
    },
  })
  @UseInterceptors(IpDetailsInterceptor)
  async loginUsuarioWithGoogle(@Body() body: { idToken: string }, @Res() res: Response, @Req() req: Request) {
    const ua = req['ua'];
    const ip = req['ipd'];
    const ipQuery = ip?.query ?? 'Desconocida';
    const ubicacion = (ip?.city && ip?.country) ? `${ip.city} - ${ip.country}` : 'Red interna';
    const dispositivo = (ua?.os?.name ?? 'Desconocido') + (ua?.device?.vendor ? ` · ${ua.device.vendor}` : '');
    const result = await this.authService.loginUsuarioWithGoogle(body.idToken, ipQuery, ubicacion, dispositivo);
    return res.status(200).json(result);
  }

  @ApiOperation({ summary: 'Login de cliente con Apple (Firebase ID token)' })
  @Post('apple/cliente')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { idToken: { type: 'string' } },
      example: { idToken: 'eyJhbGciOi...' },
    },
  })
  @UseInterceptors(IpDetailsInterceptor)
  async loginWithApple(@Body() body: { idToken: string }, @Res() res: Response, @Req() req: Request) {
    const ua = req['ua'];
    const ip = req['ipd'];
    const ipQuery = ip?.query ?? 'Desconocida';
    const ubicacion = (ip?.city && ip?.country) ? `${ip.city} - ${ip.country}` : 'Red interna';
    const dispositivo = (ua?.os?.name ?? 'Desconocido') + (ua?.device?.vendor ? ` · ${ua.device.vendor}` : '');
    const result = await this.authService.loginWithApple(body.idToken, ipQuery, ubicacion, dispositivo);
    return res.status(200).json(result);
  }

  @ApiOperation({ summary: 'Login de usuario/empresa con Apple (Firebase ID token)' })
  @Post('apple/usuario')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { idToken: { type: 'string' } },
      example: { idToken: 'eyJhbGciOi...' },
    },
  })
  @UseInterceptors(IpDetailsInterceptor)
  async loginUsuarioWithApple(@Body() body: { idToken: string }, @Res() res: Response, @Req() req: Request) {
    const ua = req['ua'];
    const ip = req['ipd'];
    const ipQuery = ip?.query ?? 'Desconocida';
    const ubicacion = (ip?.city && ip?.country) ? `${ip.city} - ${ip.country}` : 'Red interna';
    const dispositivo = (ua?.os?.name ?? 'Desconocido') + (ua?.device?.vendor ? ` · ${ua.device.vendor}` : '');
    const result = await this.authService.loginUsuarioWithApple(body.idToken, ipQuery, ubicacion, dispositivo);
    return res.status(200).json(result);
  }

  @Auth()
  @ApiOperation({
    summary: 'Cambia a la cuenta hermana del mismo correo (cliente <-> empresa)',
  })
  @Post('switch')
  async switchAccount(@GetUser() user: any, @Res() res: Response) {
    const result = await this.authService.switchAccount(user);
    return res.status(200).json(result);
  }

  @Auth()
  @ApiOperation({ summary: 'Renueva el token de autenticación' })
  @Get('refresh-token')
  async refreshToken(@Res() res: Response, @GetUser() user: any) {
    const kind: 'USUARIO' | 'CLIENTE' = user?.kind === 'CLIENTE' ? 'CLIENTE' : 'USUARIO';
    const result = this.authService.renewToken(user._id, kind);
    delete user.clkave;
    return res.status(200).json({ user, token: result });
  }

  
}
