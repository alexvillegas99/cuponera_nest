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

  // ── Programa de promotores (snapshot al momento de la compra) ──
  /** Código que digitó el comprador. Null si no aplicó código. */
  @Prop({ type: String, default: null, uppercase: true, trim: true })
  codigoPromotor?: string | null;

  /** Cliente promotor referido por el código. */
  @Prop({ type: Types.ObjectId, ref: 'Cliente', default: null, index: true })
  promotorId?: Types.ObjectId | null;

  @Prop({ type: Number, default: 0 })
  porcentajeDescuento?: number;
  @Prop({ type: Number, default: 0 })
  porcentajeComision?: number;
  @Prop({ type: Number, default: 0 })
  montoDescuento?: number;
  @Prop({ type: Number, default: 0 })
  montoComision?: number;
  /** Monto realmente pagado por el cliente con el descuento ya aplicado. */
  @Prop({ type: Number, default: 0 })
  montoFinal?: number;
  /**
   * Marca idempotente: cuando el pago llega a APROBADO la comisión se
   * acredita una sola vez al saldoPromotor del referente.
   */
  @Prop({ type: Boolean, default: false, index: true })
  comisionAcreditada?: boolean;
}

export const PagoSchema = SchemaFactory.createForClass(Pago);

PagoSchema.index({ clientTransactionId: 1 });
PagoSchema.index({ transactionId: 1 });
PagoSchema.index({ cliente: 1, createdAt: -1 });
