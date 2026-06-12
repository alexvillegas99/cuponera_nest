import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoutingConfigDocument = RoutingConfig & Document;

/**
 * Documento singleton (clave='default') que define cómo se enrutan los
 * mensajes entrantes del cliente:
 *  - pool: lista ordenada de agentes de primera línea (round-robin).
 *  - escalacionMin: si el agente asignado no responde en N min,
 *    se reasigna al siguiente en el pool.
 *  - rotacionIndex: cursor del round-robin (en qué agente toca el próximo).
 */
@Schema({ timestamps: true, collection: 'chat_routing' })
export class RoutingConfig {
  @Prop({ type: String, default: 'default', unique: true })
  clave: string;

  @Prop({ type: Boolean, default: true })
  habilitado: boolean;

  @Prop({ type: Number, default: 30 })
  escalacionMin: number;

  /** Pool ordenado de agentes (primero = primero en recibir). */
  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'Usuario' },
        nombre: String,
      },
    ],
    default: [],
  })
  pool: { userId: Types.ObjectId; nombre: string }[];

  /** Cursor para round-robin entre los miembros del pool. */
  @Prop({ type: Number, default: 0 })
  rotacionIndex: number;
}

export const RoutingConfigSchema =
  SchemaFactory.createForClass(RoutingConfig);
