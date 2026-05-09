import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HistorialEstablecimientoDocument = HistorialEstablecimiento & Document;

@Schema({ timestamps: true, collection: 'historial_establecimientos' })
export class HistorialEstablecimiento {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  establecimientoId: Types.ObjectId;

  @Prop({ type: String, required: true })
  nombreEstablecimiento: string;

  @Prop({ type: Types.ObjectId, required: true })
  editadoPorId: Types.ObjectId;

  @Prop({ type: String, required: true })
  editadoPorNombre: string;

  /** Snapshot de los campos ANTES del cambio (solo los campos que se modificaron) */
  @Prop({ type: Object, required: true })
  datosAnteriores: Record<string, any>;

  /** Datos enviados en el PATCH (lo que se intentó guardar) */
  @Prop({ type: Object, required: true })
  datosNuevos: Record<string, any>;

  @Prop({
    type: String,
    enum: ['pendiente', 'aprobado', 'revertido'],
    default: 'pendiente',
    index: true,
  })
  estado: string;

  @Prop({ type: Types.ObjectId })
  revisadoPorId?: Types.ObjectId;

  @Prop({ type: String })
  revisadoPorNombre?: string;

  @Prop({ type: Date })
  fechaRevision?: Date;
}

export const HistorialEstablecimientoSchema = SchemaFactory.createForClass(HistorialEstablecimiento);
