// src/comentarios/schemas/comentario.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ComentarioDocument = HydratedDocument<Comentario>;

@Schema({ timestamps: true, collection: 'comentarios' })
export class Comentario {
  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true, index: true })
  usuario: Types.ObjectId; // local/negocio comentado

  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true, index: true })
  autor: Types.ObjectId; // cliente que comenta

  // opcional para que tu UI pueda enviar comentario sin texto
  @Prop({ type: String, trim: true, required: false, default: '' })
  texto?: string;

  @Prop({ type: Number, min: 1, max: 5, required: true, index: true })
  calificacion: number;
}

export const ComentarioSchema = SchemaFactory.createForClass(Comentario);

// Para tus queries: rápidos por usuario + recientes
ComentarioSchema.index({ usuario: 1, createdAt: -1 });

// Regla de negocio: 1 comentario por (usuario, autor)
ComentarioSchema.index(
  { usuario: 1, autor: 1 },
  { unique: true, name: 'uniq_usuario_autor' },
);

// (opcional) si algún día filtras por rating por usuario
// ComentarioSchema.index({ usuario: 1, calificacion: -1 });
