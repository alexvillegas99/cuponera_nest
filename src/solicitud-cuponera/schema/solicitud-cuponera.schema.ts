import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum EstadoSolicitud {
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
}

@Schema({ timestamps: true, collection: 'solicitudes_cuponera' })
export class SolicitudCuponera extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true })
  cliente: Types.ObjectId;

  @Prop({ required: true, trim: true })
  nombreCliente: string;

  @Prop({ required: true, trim: true })
  emailCliente: string;

  @Prop({ trim: true })
  telefonoCliente: string;

  @Prop({ required: true, trim: true })
  cuponeraNombre: string;

  @Prop({ required: true, trim: true })
  cuponeraPrecio: string;

  @Prop({ trim: true })
  montoTransferido: string;

  @Prop({ trim: true })
  comprobanteBase64: string;

  @Prop({ trim: true })
  comprobanteUrl: string;

  @Prop({
    type: String,
    enum: Object.values(EstadoSolicitud),
    default: EstadoSolicitud.PENDIENTE,
    index: true,
  })
  estado: EstadoSolicitud;

  @Prop({ trim: true })
  observaciones: string;

  @Prop({ trim: true })
  notaAdmin: string;

  // ── Regalo ──────────────────────────────────────────────────────────
  @Prop({ type: Boolean, default: false, index: true })
  esRegalo: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: false })
  destinatarioId: Types.ObjectId;

  @Prop({ trim: true })
  destinatarioNombre: string;

  @Prop({ trim: true })
  mensajeRegalo: string;

  // Cupón de regalo generado al aprobar (para ver si el destinatario lo abrió).
  @Prop({ type: Types.ObjectId, ref: 'Cupon', default: null })
  cuponRegaloId: Types.ObjectId;
}

export const SolicitudCuponeraSchema =
  SchemaFactory.createForClass(SolicitudCuponera);
