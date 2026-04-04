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
}

export const SolicitudCuponeraSchema =
  SchemaFactory.createForClass(SolicitudCuponera);
