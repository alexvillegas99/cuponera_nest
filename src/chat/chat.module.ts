import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JWT_EXPIRES_IN, JWT_SECRET } from '../config/config.env';
import {
  Conversacion,
  ConversacionSchema,
} from './schema/conversacion.schema';
import { Mensaje, MensajeSchema } from './schema/mensaje.schema';
import { Usuario, UsuarioSchema } from '../usuarios/schema/usuario.schema';
import { Rol, RolSchema } from '../roles/schema/rol.schema';
import {
  RoutingConfig,
  RoutingConfigSchema,
} from './schema/routing-config.schema';
import { RoutingService } from './routing.service';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { S3Module } from '../amazon-s3/amazon-s3.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversacion.name, schema: ConversacionSchema },
      { name: Mensaje.name, schema: MensajeSchema },
      { name: Usuario.name, schema: UsuarioSchema },
      { name: Rol.name, schema: RolSchema },
      { name: RoutingConfig.name, schema: RoutingConfigSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(JWT_SECRET),
        signOptions: { expiresIn: config.get(JWT_EXPIRES_IN) },
      }),
      inject: [ConfigService],
    }),
    UsuariosModule,
    S3Module,
    NotificacionesModule,
    RolesModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, RoutingService],
  exports: [ChatService, RoutingService],
})
export class ChatModule {}
