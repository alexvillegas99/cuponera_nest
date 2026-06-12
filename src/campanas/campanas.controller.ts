import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CampanasService } from './campanas.service';
import { CreateCampanaDto, UpdateCampanaDto } from './dto/create-campana.dto';

@ApiTags('campanas')
@Controller('campanas')
export class CampanasController {
  constructor(private readonly svc: CampanasService) {}

  // ── Admin ──────────────────────────────────────────────────────────
  @Post()
  @Auth('notificaciones.enviar')
  crear(@GetUser() user: any, @Body() dto: CreateCampanaDto) {
    return this.svc.crear(user, dto);
  }

  @Get()
  @Auth('notificaciones.ver')
  listar(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('estado') estado?: string,
  ) {
    return this.svc.listar({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      estado,
    });
  }

  @Get(':id')
  @Auth('notificaciones.ver')
  obtener(@Param('id') id: string) {
    return this.svc.obtener(id);
  }

  @Patch(':id')
  @Auth('notificaciones.enviar')
  actualizar(@Param('id') id: string, @Body() dto: UpdateCampanaDto) {
    return this.svc.actualizar(id, dto);
  }

  @Post(':id/enviar')
  @Auth('notificaciones.enviar')
  enviar(@Param('id') id: string) {
    return this.svc.enviar(id, true);
  }

  @Delete(':id')
  @Auth('notificaciones.enviar')
  cancelar(@Param('id') id: string) {
    return this.svc.cancelar(id);
  }

  @Delete(':id/hard')
  @Auth('notificaciones.enviar')
  eliminar(@Param('id') id: string) {
    return this.svc.eliminar(id);
  }

  @Post(':id/duplicar')
  @Auth('notificaciones.enviar')
  duplicar(@Param('id') id: string, @GetUser() user: any) {
    return this.svc.duplicar(id, user);
  }

  // ── Cliente (feed in-app) ──────────────────────────────────────────
  @Get('cliente/feed')
  @Auth()
  feed(
    @GetUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('soloNoLeidas') soloNoLeidas?: string,
  ) {
    return this.svc.feedCliente(user._id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      soloNoLeidas: soloNoLeidas === 'true',
    });
  }

  @Get('cliente/no-leidas')
  @Auth()
  noLeidas(@GetUser() user: any) {
    return this.svc.contadorNoLeidas(user._id).then((total) => ({ total }));
  }

  @Post('cliente/leer/:entregaId')
  @Auth()
  leerUna(@GetUser() user: any, @Param('entregaId') entregaId: string) {
    return this.svc.marcarLeida(user._id, entregaId);
  }

  @Post('cliente/leer-todas')
  @Auth()
  leerTodas(@GetUser() user: any) {
    return this.svc.marcarTodasLeidas(user._id);
  }

  // ── Preferencias ───────────────────────────────────────────────────
  @Get('cliente/prefs')
  @Auth()
  getPrefs(@GetUser() user: any) {
    return this.svc.getPrefs(user._id);
  }

  @Patch('cliente/prefs')
  @Auth()
  setPrefs(
    @GetUser() user: any,
    @Body()
    body: {
      push?: boolean;
      promociones?: boolean;
      nuevosLocales?: boolean;
      actualizaciones?: boolean;
    },
  ) {
    return this.svc.setPrefs(user._id, body || {});
  }
}
