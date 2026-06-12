import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MensajeDocument = Mensaje & Document;

export type AutorTipo = 'LOCAL' | 'SOPORTE';

@Schema({ timestamps: true, collection: 'chat_mensajes' })
export class Mensaje {
  @Prop({
    type: Types.ObjectId,
    ref: 'Conversacion',
    required: true,
    index: true,
  })
  conversacionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true })
  autorId: Types.ObjectId;

  @Prop({ type: String, enum: ['LOCAL', 'SOPORTE'], required: true })
  autorTipo: AutorTipo;

  /** Snapshot del nombre para no popular en cada listado. */
  @Prop({ type: String, default: '' })
  autorNombre: string;

  @Prop({ type: String, trim: true, default: '' })
  texto: string;

  /** URL de la imagen adjunta (opcional). */
  @Prop({ type: String, default: null })
  adjuntoUrl: string | null;

  /** Fecha en que el receptor marcó el mensaje como leído. */
  @Prop({ type: Date, default: null })
  leidoEn: Date | null;
}

export const MensajeSchema = SchemaFactory.createForClass(Mensaje);

MensajeSchema.index({ conversacionId: 1, createdAt: -1 });
