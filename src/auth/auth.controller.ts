import { Controller, Post, Body, Logger, Req, Res, Get } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';

import { Auth } from './decorators/auth.decorator';
import { GetUser } from './decorators';
import { UsuariosService } from 'src/usuarios/usuarios.service';

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
  async loginUser(
    @Body() body: { correo: string; clave: string },
    @Res() res: Response,
  ) {

    const result = await this.authService.loginUsuario(body);
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
  async loginCliente(@Body() body: { correo: string; clave: string }, @Res() res: Response) {
    const result = await this.authService.loginCliente(body);
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
