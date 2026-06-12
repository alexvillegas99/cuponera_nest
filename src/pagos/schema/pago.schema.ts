import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PagoDocument = Pago & Document;

@Schema({ timestamps: true, collection: 'pagos' })
export class Pago {
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true })
  cliente: Types.ObjectId;

  @Prop({ required: true })
  cuponeraNombre: string;

  @Prop({ required: true })
  cuponeraPrecio: string;

  @Prop({ required: true })
  monto: number;

  @Prop({ default: null })
  transactionId: string;

  @Prop({ default: null })
  clientTransactionId: string;

  @Prop({ default: 0 })
  statusCode: number;

  @Prop({ default: 'PENDIENTE' })
  status: string;

  @Prop({ default: null })
  fechaPago: Date;

  @Prop({ type: Types.ObjectId, ref: 'SolicitudCuponera', default: null })
  solicitudId: Types.ObjectId;

  @Prop({ default: 'payphone' })
  metodo: string;

  // Datos del comprador (para "regaloDe" y correos).
  @Prop({ default: '' })
  nombreCliente: string;

  @Prop({ default: '' })
  emailCliente: string;

  // ── Regalo ──────────────────────────────────────────────────────────
  @Prop({ type: Boolean, default: false })
  esRegalo: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Cliente', default: null })
  destinatarioId: Types.ObjectId;

  @Prop({ default: '' })
  destinatarioNombre: string;

  @Prop({ default: '' })
  mensajeRegalo: string;
}

export const PagoSchema = SchemaFactory.createForClass(Pago);

PagoSchema.index({ clientTransactionId: 1 });
PagoSchema.index({ transactionId: 1 });
PagoSchema.index({ cliente: 1, createdAt: -1 });
