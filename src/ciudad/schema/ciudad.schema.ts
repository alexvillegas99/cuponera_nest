import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CiudadDocument = Ciudad & Document;

@Schema({ timestamps: true, collection: 'ciudades' })
export class Ciudad {
  @Prop({ required: true, trim: true })
  nombre: string;

  /** Provincia a la que pertenece la ciudad (cantón) */
  @Prop({ type: Types.ObjectId, ref: 'Provincia' })
  provincia?: Types.ObjectId;

  @Prop({ default: true })
  estado: boolean;

  @Prop({ type: { lat: Number, lng: Number }, _id: false })
  geo?: { lat: number; lng: number };

    @Prop({ default: true })
  visibleParaRegistro: boolean;
}

export const CiudadSchema = SchemaFactory.createForClass(Ciudad);

// índices útiles
CiudadSchema.index({ nombre: 1 }, { unique: true });
CiudadSchema.index({ visibleParaRegistro: 1 });
CiudadSchema.index({ provincia: 1 });
