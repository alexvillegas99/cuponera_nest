// src/empresas-solicitudes/schemas/empresa-solicitud.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmpresaSolicitudDocument = HydratedDocument<EmpresaSolicitud>;

export enum SolicitudEstado {
  PENDIENTE = 'PENDIENTE',
  CONTACTADO = 'CONTACTADO',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
}

@Schema({ timestamps: true, collection: 'empresas_solicitudes' })
export class EmpresaSolicitud {
  @Prop({ type: String, required: true, trim: true })
  empresa!: string;

  // 👇 Tipo explícito y sin `| null` en TS; default puede ser null
  @Prop({ type: String, trim: true, default: null })
  ruc?: string;

  @Prop({ type: String, required: true, trim: true })
  contacto!: string;

  @Prop({ type: String, required: true, trim: true, lowercase: true, unique: true })
  email!: string; // único: 1 solicitud por email

  @Prop({ type: String, required: true, trim: true })
  telefono!: string;

  @Prop({ type: String, required: true, trim: true })
  ciudad!: string;

  @Prop({ type: String, trim: true, default: null })
  mensaje?: string;

  @Prop({ type: String, trim: true, default: 'ENJOY_APP' })
  origen?: string;

  @Prop({
    type: String,
    enum: Object.values(SolicitudEstado),
    default: SolicitudEstado.PENDIENTE,
  })
  estado!: SolicitudEstado;
}

export const EmpresaSolicitudSchema = SchemaFactory.createForClass(EmpresaSolicitud);

// Índices adicionales opcionales
EmpresaSolicitudSchema.index({ estado: 1, createdAt: -1 });
