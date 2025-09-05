// src/compartidos/schemas/compartido.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CanalCompartir } from '../enum/canal.enum';

export type CompartidoDocument = HydratedDocument<Compartido>;

@Schema({ timestamps: true, collection: 'compartidos' })
export class Compartido {
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true, index: true })
  cliente: Types.ObjectId;                 // Quién comparte (cliente app)

  @Prop({ type: Types.ObjectId, ref: 'Usuario', required: true, index: true })
  usuario: Types.ObjectId;                 // A qué comercio/usuario se comparte (admin-local)

  @Prop({ type: String, enum: CanalCompartir, required: true, index: true })
  canal: CanalCompartir;                   // whatsapp | sistema

  @Prop({ type: String, trim: true })
  telefonoDestino?: string;                // E164 si aplica (para WA)

  @Prop({ type: String })
  mensaje?: string;                        // mensaje enviado

  @Prop({ type: String })
  origen?: 'comercio' | 'cupon';           // opcional: desde dónde

  @Prop({ type: Types.ObjectId })
  origenId?: Types.ObjectId;               // id del comercio/usuario o cupón
}

export const CompartidoSchema = SchemaFactory.createForClass(Compartido);

// Índices útiles
CompartidoSchema.index({ usuario: 1, canal: 1, createdAt: -1 });
CompartidoSchema.index({ cliente: 1, createdAt: -1 });
