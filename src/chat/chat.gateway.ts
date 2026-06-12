import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { JWT_SECRET } from '../config/config.env';
import { UsuariosService } from '../usuarios/usuarios.service';
import { RolesService } from '../roles/roles.service';
import { ChatService } from './chat.service';

interface ChatSocket extends Socket {
  user?: any;
}

@Injectable()
@WebSocketGateway({
  namespace: '/ws/chat',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private presencia = new Map<string, Set<string>>(); // userId → set(socketIds)

  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly usuariosService: UsuariosService,
    private readonly roles: RolesService,
    @Inject(forwardRef(() => ChatService))
    private readonly chat: ChatService,
  ) {}

  async handleConnection(client: ChatSocket) {
    try {
      const tokenRaw =
        (client.handshake.auth as any)?.token ||
        client.handshake.headers?.authorization ||
        '';
      const token = String(tokenRaw).replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        client.disconnect(true);
        return;
      }
      const secret = this.cfg.get<string>(JWT_SECRET)!;
      const payload: any = await this.jwt.verifyAsync(token, { secret });
      const usuario = await this.usuariosService.findById(payload.sub).catch(() => null);
      if (!usuario) {
        client.disconnect(true);
        return;
      }
      const usuarioObj: any = (usuario as any).toObject
        ? (usuario as any).toObject()
        : usuario;
      const permisos = await this.roles.getPermisosForUsuario(usuario);
      client.user = {
        ...usuarioObj,
        _id: usuarioObj._id?.toString(),
        kind: 'USUARIO',
        permisos,
      };

      // Sala personal del usuario
      client.join(`u:${client.user._id}`);

      // Marcar presencia
      const set = this.presencia.get(client.user._id) || new Set<string>();
      set.add(client.id);
      this.presencia.set(client.user._id, set);
      this.server.emit('presencia', { userId: client.user._id, online: true });
    } catch (e: any) {
      this.logger.warn(`WS auth fail: ${e?.message || e}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: ChatSocket) {
    const uid = client.user?._id;
    if (!uid) return;
    const set = this.presencia.get(uid);
    if (set) {
      set.delete(client.id);
      if (set.size === 0) {
        this.presencia.delete(uid);
        this.server.emit('presencia', { userId: uid, online: false });
      }
    }
  }

  // ── Suscripciones ─────────────────────────────────────────────────────
  @SubscribeMessage('join')
  async onJoin(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { conversacionId: string },
  ) {
    if (!client.user || !body?.conversacionId) return;
    try {
      // Valida acceso antes de unirlo a la sala.
      await this.chat.obtenerHiloPorId(client.user, body.conversacionId);
      client.join(`c:${body.conversacionId}`);
      client.emit('joined', { conversacionId: body.conversacionId });
    } catch (e: any) {
      client.emit('error', { message: e?.message || 'No autorizado' });
    }
  }

  @SubscribeMessage('leave')
  onLeave(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { conversacionId: string },
  ) {
    if (body?.conversacionId) client.leave(`c:${body.conversacionId}`);
  }

  @SubscribeMessage('escribiendo')
  onTyping(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { conversacionId: string; escribiendo: boolean },
  ) {
    if (!client.user || !body?.conversacionId) return;
    client.to(`c:${body.conversacionId}`).emit('escribiendo', {
      conversacionId: body.conversacionId,
      userId: client.user._id,
      nombre: client.user.nombre || client.user.email || '',
      escribiendo: !!body.escribiendo,
    });
  }

  @SubscribeMessage('presencia:get')
  onPresenciaGet(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { userIds: string[] },
  ) {
    const result: Record<string, boolean> = {};
    (body?.userIds || []).forEach((id) => {
      result[id] = (this.presencia.get(id)?.size || 0) > 0;
    });
    client.emit('presencia:lista', result);
  }

  // ── Emisores invocados desde el service ──────────────────────────────
  emitMensaje(conversacionId: string, mensaje: any) {
    if (!this.server) return;
    this.server.to(`c:${conversacionId}`).emit('mensaje', mensaje);
  }

  emitLeido(conversacionId: string, info: any) {
    if (!this.server) return;
    this.server.to(`c:${conversacionId}`).emit('leido', {
      conversacionId,
      ...info,
    });
  }

  async emitConversacionActualizada(conv: any) {
    if (!this.server) return;
    // Broadcast a todos los conectados. La bandeja de cada cliente ignora
    // hilos que no son visibles para su rol (vendedor → solo los que creó).
    this.server.emit('conversacion:actualizada', conv);
  }
}
