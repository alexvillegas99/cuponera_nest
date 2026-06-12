import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ChatService } from './chat.service';
import { EnviarMensajeDto } from './dto/enviar-mensaje.dto';
import { EstadoConversacion } from './schema/conversacion.schema';
import { RoutingService } from './routing.service';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly svc: ChatService,
    private readonly routing: RoutingService,
  ) {}

  // ── Routing config ────────────────────────────────────────────────
  @Get('config/routing')
  @Auth('chat.ver')
  getRouting() {
    return this.routing.getConfig().then((c) => c.toObject());
  }

  @Patch('config/routing')
  @Auth('roles.editar')
  updateRouting(
    @Body()
    body: {
      habilitado?: boolean;
      escalacionMin?: number;
      pool?: { userId: string; nombre: string }[];
    },
  ) {
    return this.routing.updateConfig(body || {});
  }

  @Get('agentes')
  @Auth('chat.ver')
  listarAgentes() {
    return this.routing.listarAgentes();
  }

  @Post('hilos/:id/transferir')
  @Auth('chat.ver')
  async transferir(
    @GetUser() user: any,
    @Param('id') id: string,
    @Body() body: { paraUserId: string; observacion: string },
  ) {
    const conv = await this.svc.obtenerHiloDoc(id);
    return this.routing.transferir(
      user,
      conv,
      body?.paraUserId,
      body?.observacion,
    );
  }

  @Get('hilos')
  @Auth()
  listarHilos(
    @GetUser() user: any,
    @Query('q') q?: string,
    @Query('estado') estado?: string,
    @Query('asignadoMi') asignadoMi?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listarHilos(user, {
      q,
      estado: estado === 'CERRADA' || estado === 'ABIERTA' ? estado : undefined,
      asignadoMi: asignadoMi === 'true' || asignadoMi === '1',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('mi-hilo')
  @Auth()
  miHilo(@GetUser() user: any) {
    return this.svc.miHilo(user);
  }

  @Get('no-leidos')
  @Auth()
  noLeidos(@GetUser() user: any) {
    return this.svc.contadorNoLeidos(user).then((total) => ({ total }));
  }

  @Get('hilos/:id')
  @Auth()
  obtener(@GetUser() user: any, @Param('id') id: string) {
    return this.svc.obtenerHiloPorId(user, id);
  }

  @Get('hilos/:id/mensajes')
  @Auth()
  mensajes(
    @GetUser() user: any,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listarMensajes(user, id, cursor, limit ? Number(limit) : undefined);
  }

  @Post('hilos/:id/mensajes')
  @Auth()
  enviar(
    @GetUser() user: any,
    @Param('id') id: string,
    @Body() dto: EnviarMensajeDto,
  ) {
    return this.svc.enviarMensaje(user, id, dto);
  }

  @Post('hilos/:id/leer')
  @Auth()
  leer(@GetUser() user: any, @Param('id') id: string) {
    return this.svc.marcarLeidos(user, id);
  }

  @Patch('hilos/:id/asignar')
  @Auth('chat.responder')
  asignar(
    @GetUser() user: any,
    @Param('id') id: string,
    @Body() body: { agenteId?: string },
  ) {
    return this.svc.asignarHilo(user, id, body?.agenteId);
  }

  // ── Presencia multi-agente ───────────────────────────────────────
  @Post('hilos/:id/atender')
  @Auth()
  atender(@GetUser() user: any, @Param('id') id: string) {
    return this.svc.claimAtencion(user, id);
  }

  @Post('hilos/:id/heartbeat')
  @Auth()
  heartbeat(@GetUser() user: any, @Param('id') id: string) {
    return this.svc.heartbeatAtencion(user, id);
  }

  @Post('hilos/:id/liberar')
  @Auth()
  liberar(@GetUser() user: any, @Param('id') id: string) {
    return this.svc.liberarAtencion(user, id);
  }

  @Patch('hilos/:id/cerrar')
  @Auth('chat.responder')
  cerrar(@GetUser() user: any, @Param('id') id: string) {
    return this.svc.cambiarEstado(user, id, EstadoConversacion.CERRADA);
  }

  @Patch('hilos/:id/reabrir')
  @Auth('chat.responder')
  reabrir(@GetUser() user: any, @Param('id') id: string) {
    return this.svc.cambiarEstado(user, id, EstadoConversacion.ABIERTA);
  }
}
