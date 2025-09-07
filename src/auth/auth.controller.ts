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

    console.log(ua);
    console.log(ip);
    const ipQuery = ip.query;
    const ubicacion = ip.city + ' - ' + ip.country;
     const dispositivo = ua?.device?.vendor
      ? ua.os.name + ' - ' + ua.device.vendor
      : ua.os.name;
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

    console.log(ua);
    console.log(ip);
    const ipQuery = ip.query;
    const ubicacion = ip.city + ' - ' + ip.country;
     const dispositivo = ua?.device?.vendor
      ? ua.os.name + ' - ' + ua.device.vendor
      : ua.os.name;
      
    const result = await this.authService.loginCliente(body,ipQuery,ubicacion,dispositivo);
    return res.status(200).json(result);
  }

  @Auth()
  @ApiOperation({ summary: 'Renueva el token de autenticación' })
  @Get('refresh-token')
  async refreshToken(@Res() res: Response, @GetUser() user: any) {
    const result = await this.authService.renewToken(user._id);
    delete user.clkave;
    console.log('user', user);
    return res.status(200).json({ user, token: result });
  }

  
}
